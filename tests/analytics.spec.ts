import { expect, test, type Page } from "@playwright/test";
import { createAnalyticsBuffer, sanitizeAnalyticsEvent } from "../lib/analytics";

test("early events keep order, original timestamp and once-only semantics", () => {
  const buffer = createAnalyticsBuffer();
  const events: string[] = [];
  const timestamp = new Date("2026-09-11T00:00:00Z");
  buffer.capture({ event: "$pageview", properties: {}, timestamp }, "page");
  buffer.capture({ event: "$pageview", properties: {}, timestamp }, "page");
  buffer.capture({ event: "renderer ready", properties: {}, timestamp });
  buffer.connect((event) => {
    expect(event.timestamp).toEqual(timestamp);
    events.push(event.event);
  });
  expect(events).toEqual(["$pageview", "renderer ready"]);
  buffer.stop();
  buffer.capture({ event: "training started", properties: {}, timestamp });
  expect(events).toHaveLength(2);
});

test("analytics failures never escape and a stalled SDK has a bounded queue", () => {
  const buffer = createAnalyticsBuffer();
  for (let i = 0; i < 200; i++) buffer.capture({ event: "$pageview", properties: {}, timestamp: new Date() });
  let count = 0;
  expect(() => buffer.connect(() => { count++; throw new Error("SDK unavailable"); })).not.toThrow();
  expect(count).toBe(100);
});

test("privacy filter removes content, identity details, raw URLs and automatic events", () => {
  expect(sanitizeAnalyticsEvent({ event: "$autocapture", properties: {} })).toBeNull();
  expect(sanitizeAnalyticsEvent({ event: "toString", properties: {} })).toBeNull();
  const event = sanitizeAnalyticsEvent({ event: "feedback sent", $set_once: { email: "private@example.com" }, properties: {
    distinct_id: "anonymous", $session_id: "session", attempt_id: "attempt", elapsed_ms: 20,
    content: "private message", email: "private@example.com", $ip: "1.2.3.4",
    $set: { email: "private@example.com" }, $referrer: "https://example.com/?secret=123",
    $current_url: "https://shootbang.allan1in.top/?secret=123#private",
  } });
  expect(event?.properties).toEqual({
    distinct_id: "anonymous", $session_id: "session", attempt_id: "attempt", elapsed_ms: 20,
    $current_url: "https://shootbang.allan1in.top/",
    $process_person_profile: false, $geoip_disable: true,
  });
  expect(event).not.toHaveProperty("$set_once");
});

async function events(page: Page, name: string) {
  return page.evaluate((name) => window.__shootbang_analytics_test?.filter((event) => event.event === name) ?? [], name);
}

test.describe("product event integration", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.__shootbang_analytics_test = [];
      let locked: Element | null = null;
      Object.defineProperty(document, "pointerLockElement", { configurable: true, get: () => locked });
      Element.prototype.requestPointerLock = function () {
        // Browser API emulation must retain the element receiving the call.
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        locked = this;
        document.dispatchEvent(new Event("pointerlockchange"));
        return Promise.resolve();
      };
      document.exitPointerLock = () => {
        locked = null;
        document.dispatchEvent(new Event("pointerlockchange"));
        return Promise.resolve();
      };
    });
  });

  test("page funnel is deduplicated; saving settings records actual changes, cancelling does not", async ({ page }) => {
    await page.goto("/?utm_source=douyin&secret=private#private");
    await expect(page.getByRole("button", { name: "设置", exact: true })).toBeVisible();
    await expect.poll(async () => (await events(page, "renderer ready")).length).toBe(1);
    const views = await events(page, "$pageview");
    expect(views).toHaveLength(1);
    expect(views[0].properties.utm_source).toBe("douyin");
    expect(JSON.stringify(views)).not.toContain("private");
    await page.getByRole("button", { name: "设置", exact: true }).click();
    await page.getByRole("button", { name: "15s", exact: true }).click();
    await page.getByRole("tab", { name: "准星", exact: true }).click();
    await page.getByRole("button", { name: "中心点", exact: true }).click();
    await page.getByRole("button", { name: "保存", exact: true }).click();
    const saved = await events(page, "settings saved");
    expect(saved).toHaveLength(1);
    expect(saved[0].properties.changed_fields).toEqual(["duration", "crosshair"]);
    expect(saved[0].properties.crosshair_customized).toBe(true);
    await page.getByRole("button", { name: "设置", exact: true }).click();
    await page.getByRole("button", { name: "60s", exact: true }).click();
    await page.getByRole("button", { name: "取消", exact: true }).click();
    expect(await events(page, "settings saved")).toHaveLength(1);
    expect(await events(page, "settings dismissed")).toHaveLength(1);
    expect(await events(page, "settings opened")).toHaveLength(2);
    expect((await events(page, "settings tab viewed"))[0].properties.tab).toBe("crosshair");
  });

  test("actual start, pause/resume, abandonment and completion have consistent run IDs", async ({ page }) => {
    test.setTimeout(60000);
    await page.goto("/");
    await page.getByRole("button", { name: "设置", exact: true }).click();
    await page.getByRole("button", { name: "15s", exact: true }).click();
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await page.getByRole("button", { name: "开始", exact: true }).click();
    await expect.poll(async () => (await events(page, "training started")).length).toBe(1);
    await page.evaluate(() => document.exitPointerLock());
    await page.getByRole("button", { name: "继续", exact: true }).click();
    expect(await events(page, "training started")).toHaveLength(1);
    await page.evaluate(() => document.exitPointerLock());
    await page.getByRole("button", { name: "回到首页", exact: true }).click();
    const abandoned = await events(page, "training abandoned");
    expect(abandoned).toHaveLength(1);
    expect(abandoned[0].properties.reason).toBe("home");
    const started = await events(page, "training started");
    expect(abandoned[0].properties.run_id).toBe(started[0].properties.run_id);
    await page.getByRole("button", { name: "开始", exact: true }).click();
    await expect.poll(async () => (await events(page, "training completed")).length, { timeout: 25000 }).toBe(1);
    const completed = (await events(page, "training completed"))[0];
    const runs = await events(page, "training started");
    expect(runs).toHaveLength(2);
    expect(completed.properties.run_id).toBe(runs[1].properties.run_id);
    expect(completed.properties).toMatchObject({ hits: 0, total_shots: 0, accuracy: 0, duration: 15 });
    expect(runs[0].properties.run_id).not.toBe(runs[1].properties.run_id);
  });

  test("denied pointer lock is a failed request, never a started training", async ({ page }) => {
    await page.addInitScript(() => {
      Element.prototype.requestPointerLock = () => Promise.reject(new Error("denied"));
    });
    await page.goto("/");
    await page.getByRole("button", { name: "开始", exact: true }).click();
    await expect.poll(async () => (await events(page, "training start failed")).length).toBe(1);
    expect(await events(page, "training started")).toHaveLength(0);
  });

  test("feedback retries record outcome and duration without the message", async ({ page }) => {
    let requests = 0;
    await page.route("**/api/feedback", (route) => route.fulfill({
      status: ++requests === 1 ? 429 : 200,
      contentType: "application/json",
      body: JSON.stringify(requests === 1 ? { ok: false, code: "rate_limited" } : { ok: true }),
    }));
    await page.goto("/");
    await page.getByRole("button", { name: "反馈", exact: true }).click();
    await page.getByRole("textbox", { name: "反馈内容" }).fill("private feedback sample");
    await page.getByRole("button", { name: "发送", exact: true }).click();
    await expect.poll(async () => (await events(page, "feedback failed")).length).toBe(1);
    await page.getByRole("button", { name: "发送", exact: true }).click();
    await expect.poll(async () => (await events(page, "feedback sent")).length).toBe(1);
    const submitted = await events(page, "feedback submitted");
    expect(submitted).toHaveLength(2);
    expect((await events(page, "feedback failed"))[0].properties.attempt_id).toBe(submitted[0].properties.attempt_id);
    expect((await events(page, "feedback sent"))[0].properties.attempt_id).toBe(submitted[1].properties.attempt_id);
    expect(await page.evaluate(() => JSON.stringify(window.__shootbang_analytics_test))).not.toContain("private feedback sample");
  });

  test("mobile visits are distinguishable from desktop loading failures", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(screen, "width", { get: () => 390 });
      Object.defineProperty(screen, "height", { get: () => 844 });
    });
    await page.goto("/");
    await expect(page.getByText("请使用 PC 端访问")).toBeVisible();
    expect(await events(page, "mobile prompt shown")).toHaveLength(1);
    expect(await events(page, "renderer ready")).toHaveLength(0);
    expect(await events(page, "renderer failed")).toHaveLength(0);
  });
});
