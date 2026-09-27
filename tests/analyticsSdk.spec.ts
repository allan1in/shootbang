import { expect, test } from "@playwright/test";
import { gunzipSync } from "node:zlib";
import { UPDATE_ANNOUNCEMENT_ID, UPDATE_ANNOUNCEMENT_STORAGE_KEY } from "../lib/updateAnnouncement";

// Run against a production build with a dummy project token. All ingestion is intercepted.
test.describe("PostHog production transport", () => {
  test.skip(process.env.POSTHOG_SDK_TEST !== "1", "Requires the documented production SDK test build");
  test.use({ baseURL: process.env.POSTHOG_SDK_BASE_URL ?? "http://localhost:3001" });

  test("real SDK sends sanitized anonymous events and retains identity across reloads", async ({ page }) => {
    test.setTimeout(60000);
    const received: { event: string; properties: Record<string, unknown> }[] = [];
    await page.route(/https:\/\/[^/]*posthog\.com\//, async (route) => {
      const request = route.request();
      if (request.method() === "POST" && request.postDataBuffer()) {
        const buffer = request.postDataBuffer()!;
        const text = buffer[0] === 0x1f && buffer[1] === 0x8b
          ? gunzipSync(buffer).toString("utf8")
          : buffer.toString("utf8");
        const data = JSON.parse(text);
        received.push(...(Array.isArray(data) ? data : data.batch ?? [data]));
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: 1 }) });
    });
    await page.addInitScript(({ key, value }) => {
      localStorage.setItem(key, value);
      // Must be ignored in production, even if someone sets the test global.
      window.__shootbang_analytics_test = [];
    }, { key: UPDATE_ANNOUNCEMENT_STORAGE_KEY, value: UPDATE_ANNOUNCEMENT_ID });
    await page.goto("/?utm_source=douyin&private=do_not_send#secret");
    await expect(page.getByRole("button", { name: "开始", exact: true })).toBeVisible({ timeout: 15000 });
    await expect.poll(() => received.filter((event) => event.event === "$pageview").length, { timeout: 15000 }).toBe(1);
    const first = received.find((event) => event.event === "$pageview")!;
    expect(first.properties.distinct_id).toEqual(expect.any(String));
    expect(first.properties.$session_id).toEqual(expect.any(String));
    expect(first.properties).toMatchObject({ $process_person_profile: false, $geoip_disable: true, environment: "preview", utm_source: "douyin" });
    expect(JSON.stringify(received)).not.toContain("do_not_send");
    expect(JSON.stringify(received)).not.toContain("secret");
    expect(await page.evaluate(() => window.__shootbang_analytics_test)).toEqual([]);
    await page.getByRole("button", { name: "设置", exact: true }).click();
    await page.getByRole("button", { name: "取消", exact: true }).click();
    await expect.poll(() => received.filter((event) => event.event === "settings dismissed").length, { timeout: 15000 }).toBe(1);
    await page.reload();
    await expect.poll(() => received.filter((event) => event.event === "$pageview").length, { timeout: 15000 }).toBe(2);
    const second = received.filter((event) => event.event === "$pageview")[1];
    expect(second.properties.distinct_id).toBe(first.properties.distinct_id);
    expect(second.properties.page_id).not.toBe(first.properties.page_id);
    expect(received.some((event) => event.event === "$autocapture" || event.event === "$snapshot")).toBe(false);
  });

  test("blocked ingestion does not block renderer or settings", async ({ page }) => {
    await page.route(/https:\/\/[^/]*posthog\.com\//, (route) => route.abort());
    await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
      key: UPDATE_ANNOUNCEMENT_STORAGE_KEY, value: UPDATE_ANNOUNCEMENT_ID,
    });
    await page.goto("/");
    await page.getByRole("button", { name: "设置", exact: true }).click();
    await page.getByRole("button", { name: "15s", exact: true }).click();
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.getByRole("button", { name: "开始", exact: true })).toBeVisible();
    await expect(page.locator("canvas")).toBeVisible();
  });
});
