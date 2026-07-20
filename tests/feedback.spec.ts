import { expect, test, type Page } from "@playwright/test";
import {
  FEEDBACK_ACTION,
  createFeedbackEmail,
  parseFeedbackRequest,
  processFeedback,
  type FeedbackContext,
  type FeedbackEmail,
  type FeedbackRequest,
} from "../lib/feedback";

const VALID_REQUEST: FeedbackRequest = {
  content: "目标偶尔会闪烁。",
  turnstileToken: "test-token",
  submissionId: "550e8400-e29b-41d4-a716-446655440000",
  page: "/",
};

const VALID_CONTEXT: FeedbackContext = {
  allowedHostnames: new Set(["localhost"]),
  from: "Shootbang <feedback@send.example.com>",
  to: "owner@example.com",
  environment: "preview",
  release: "commit-sha",
  userAgent: "Test Browser",
  now: new Date("2026-07-20T10:00:00.000Z"),
};

test.describe("反馈服务逻辑", () => {
  test("严格校验 1～2000 字、UUID、token 和页面路径", () => {
    expect(parseFeedbackRequest(VALID_REQUEST)).toEqual(VALID_REQUEST);
    expect(
      parseFeedbackRequest({ ...VALID_REQUEST, content: "x".repeat(2_000) }),
    ).not.toBeNull();
    expect(
      parseFeedbackRequest({ ...VALID_REQUEST, content: "x".repeat(2_001) }),
    ).toBeNull();
    expect(parseFeedbackRequest({ ...VALID_REQUEST, content: "   " })).toBeNull();
    expect(
      parseFeedbackRequest({ ...VALID_REQUEST, submissionId: "not-a-uuid" }),
    ).toBeNull();
    expect(
      parseFeedbackRequest({ ...VALID_REQUEST, turnstileToken: "" }),
    ).toBeNull();
    expect(
      parseFeedbackRequest({ ...VALID_REQUEST, page: "https://evil.test" }),
    ).toBeNull();
  });

  test("验证通过后构建最小邮件并使用固定幂等键", async () => {
    const sent: FeedbackEmail[] = [];
    const result = await processFeedback(VALID_REQUEST, VALID_CONTEXT, {
      verifyTurnstile: async () => ({
        success: true,
        action: FEEDBACK_ACTION,
        hostname: "LOCALHOST",
      }),
      sendEmail: async (email) => {
        sent.push(email);
      },
    });

    expect(result).toEqual({ ok: true });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      from: VALID_CONTEXT.from,
      to: VALID_CONTEXT.to,
      subject: "Shootbang User Feedback [preview]",
      idempotencyKey: `feedback/${VALID_REQUEST.submissionId}`,
    });
    expect(sent[0].text).toContain(VALID_REQUEST.content);
    expect(sent[0].text.startsWith(VALID_REQUEST.content)).toBe(true);
    expect(sent[0].text).toContain("----------------------------------------");
    expect(sent[0].text).toContain("Page: /");
    expect(sent[0].text).toContain("Browser: Test Browser");
    expect(sent[0].text).toContain("Release: commit-sha");
    expect(sent[0].text).not.toContain(VALID_REQUEST.turnstileToken);
    expect(sent[0].text).not.toContain("IP");
  });

  test("错误 action、hostname 或拒绝结果都不会发邮件", async () => {
    let sendCount = 0;
    for (const verification of [
      { success: false, action: FEEDBACK_ACTION, hostname: "localhost" },
      { success: true, action: "login", hostname: "localhost" },
      { success: true, action: FEEDBACK_ACTION, hostname: "other.test" },
    ]) {
      const result = await processFeedback(VALID_REQUEST, VALID_CONTEXT, {
        verifyTurnstile: async () => verification,
        sendEmail: async () => {
          sendCount += 1;
        },
      });
      expect(result).toEqual({ ok: false, code: "verification_failed" });
    }
    expect(sendCount).toBe(0);
  });

  test("外部服务异常带安全的 provider 分类", async () => {
    await expect(
      processFeedback(VALID_REQUEST, VALID_CONTEXT, {
        verifyTurnstile: async () => {
          throw new Error("network unavailable");
        },
        sendEmail: async () => {},
      }),
    ).rejects.toMatchObject({
      name: "FeedbackProviderError",
      provider: "turnstile",
    });

    await expect(
      processFeedback(VALID_REQUEST, VALID_CONTEXT, {
        verifyTurnstile: async () => ({
          success: true,
          action: FEEDBACK_ACTION,
          hostname: "localhost",
        }),
        sendEmail: async () => {
          throw new Error("send unavailable");
        },
      }),
    ).rejects.toMatchObject({
      name: "FeedbackProviderError",
      provider: "resend",
    });
  });

  test("邮件正文清理诊断字段中的换行", () => {
    const email = createFeedbackEmail(VALID_REQUEST, {
      ...VALID_CONTEXT,
      environment: "preview\nInjected",
      release: "sha\r\nInjected",
      userAgent: "Browser\nInjected",
    });
    expect(email.subject).toBe("Shootbang User Feedback [preview Injected]");
    expect(email.text).toContain("Release: sha Injected");
    expect(email.text).toContain("Browser: Browser Injected");
  });
});

async function installTurnstileMock(
  page: Page,
  outcome: "success" | "error" = "success",
) {
  await page.route(
    "https://challenges.cloudflare.com/turnstile/v0/api.js*",
    async (route) => {
      await route.fulfill({
        contentType: "application/javascript",
        body: `
          (() => {
            let options;
            window.__turnstileResetCount = 0;
            window.turnstile = {
              render(container, nextOptions) {
                options = nextOptions;
                container.dataset.turnstileReady = "true";
                return "feedback-widget";
              },
              execute() {
                setTimeout(() => {
                  if (${JSON.stringify(outcome)} === "success") {
                    options.callback("mock-turnstile-token");
                  } else {
                    options["error-callback"]("mock-error");
                  }
                }, 0);
              },
              reset() { window.__turnstileResetCount += 1; },
              remove() {},
            };
          })();
        `,
      });
    },
  );
}

async function waitForGame(page: Page) {
  await page.goto("/");
  await page.waitForSelector("canvas", { timeout: 10_000 });
  await page.waitForFunction(() => "__shootbang_test" in window);
}

test.describe("反馈 Dialog", () => {
  test("Textarea 使用统一滚动条样式并保留原生滚动行为", async ({ page }) => {
    await installTurnstileMock(page);
    await waitForGame(page);
    await page.getByRole("button", { name: "反馈" }).click();

    const textarea = page.getByRole("textbox", { name: "反馈内容" });
    const lines = Array.from(
      { length: 40 },
      (_, index) => `Feedback line ${index + 1}`,
    ).join("\n");
    await textarea.fill(lines);

    const styles = await textarea.evaluate((element) => {
      const scrollbar = getComputedStyle(element, "::-webkit-scrollbar");
      const button = getComputedStyle(element, "::-webkit-scrollbar-button");
      const track = getComputedStyle(element, "::-webkit-scrollbar-track");
      const thumb = getComputedStyle(element, "::-webkit-scrollbar-thumb");

      element.scrollTop = element.scrollHeight;

      return {
        buttonDisplay: button.display,
        marginBottom: track.marginBottom,
        marginTop: track.marginTop,
        scrollbarCursor: scrollbar.cursor,
        scrollbarWidth: scrollbar.width,
        scrollTop: element.scrollTop,
        thumbBackground: thumb.backgroundColor,
        thumbBackgroundClip: thumb.backgroundClip,
        thumbBorderLeft: thumb.borderLeftWidth,
        thumbBorderRight: thumb.borderRightWidth,
        thumbCursor: thumb.cursor,
        thumbRadius: Number.parseFloat(thumb.borderRadius),
        trackCursor: track.cursor,
      };
    });

    expect(styles.scrollbarWidth).toBe("12px");
    expect(styles.thumbBorderLeft).toBe("2px");
    expect(styles.thumbBorderRight).toBe("2px");
    expect(styles.thumbBackgroundClip).toBe("content-box");
    expect(styles.buttonDisplay).toBe("none");
    expect(styles.marginTop).toBe("4px");
    expect(styles.marginBottom).toBe("4px");
    expect(styles.scrollbarCursor).toBe("default");
    expect(styles.trackCursor).toBe("default");
    expect(styles.thumbCursor).toBe("default");
    expect(styles.thumbRadius).toBeGreaterThan(0);
    expect(styles.thumbBackground).not.toBe("rgba(0, 0, 0, 0)");
    expect(styles.scrollTop).toBeGreaterThan(0);

    await textarea.press("Control+Home");
    await textarea.press("Shift+ArrowRight");
    await expect
      .poll(() =>
        textarea.evaluate((element) => ({
          end: (element as HTMLTextAreaElement).selectionEnd,
          start: (element as HTMLTextAreaElement).selectionStart,
        })),
      )
      .toEqual({ start: 0, end: 1 });
  });

  test("开始页提交成功并防止双击重复请求", async ({ page }) => {
    await installTurnstileMock(page);
    let requestCount = 0;
    let capturedBody: Record<string, unknown> | null = null;
    let releaseResponse!: () => void;
    const responseGate = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });
    await page.route("**/api/feedback", async (route) => {
      requestCount += 1;
      capturedBody = route.request().postDataJSON();
      await responseGate;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });
    await waitForGame(page);

    await page.getByRole("button", { name: "反馈" }).click();
    const dialog = page.getByRole("dialog", { name: "反馈" });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("textarea")).toHaveAttribute("maxlength", "2000");
    await expect(page.getByRole("button", { name: "发送" })).toBeDisabled();

    await dialog.locator("textarea").fill("  目标偶尔会闪烁。  ");
    await expect(page.getByText("12 / 2000")).toBeVisible();
    await expect(
      page.locator('[data-turnstile-ready="true"]'),
    ).toHaveAttribute("data-turnstile-ready", "true");
    const sendButton = dialog
      .locator('[data-slot="dialog-footer"] button')
      .last();
    await sendButton.click();
    await expect(sendButton).toBeDisabled();
    await sendButton.evaluate((button) => (button as HTMLElement).click());
    releaseResponse();

    await expect(page.getByText("反馈已发送，感谢你的反馈。")).toBeVisible();
    await expect(dialog).not.toBeVisible();
    expect(requestCount).toBe(1);
    expect(capturedBody).not.toBeNull();
    const submittedBody = capturedBody as unknown as Record<string, unknown>;
    expect(submittedBody).toMatchObject({
      content: "目标偶尔会闪烁。",
      turnstileToken: "mock-turnstile-token",
      page: "/",
    });
    expect(String(submittedBody.submissionId)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  test("发送失败保留草稿、重置验证并复用提交 ID", async ({ page }) => {
    await installTurnstileMock(page);
    const submissionIds: string[] = [];
    await page.route("**/api/feedback", async (route) => {
      const body = route.request().postDataJSON() as { submissionId: string };
      submissionIds.push(body.submissionId);
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, code: "send_failed" }),
      });
    });
    await waitForGame(page);
    await page.getByRole("button", { name: "反馈" }).click();
    await page.getByRole("textbox", { name: "反馈内容" }).fill("发送失败测试");
    await expect(
      page.locator('[data-turnstile-ready="true"]'),
    ).toHaveAttribute("data-turnstile-ready", "true");

    await page.getByRole("button", { name: "发送" }).click();
    await expect(page.getByText("反馈发送失败，请稍后重试。")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "反馈内容" })).toHaveValue(
      "发送失败测试",
    );
    await page.getByRole("button", { name: "发送" }).click();
    await expect.poll(() => submissionIds.length).toBe(2);
    expect(submissionIds[1]).toBe(submissionIds[0]);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as typeof window & { __turnstileResetCount?: number })
              .__turnstileResetCount,
        ),
      )
      .toBe(2);
  });

  test("取消、Esc、叉号丢弃草稿，遮罩点击不关闭", async ({ page }) => {
    await installTurnstileMock(page);
    await waitForGame(page);
    const open = () => page.getByRole("button", { name: "反馈" }).click();

    await open();
    await page.getByRole("textbox", { name: "反馈内容" }).fill("草稿一");
    await page.locator('[data-slot="dialog-viewport"]').click({ position: { x: 1, y: 1 } });
    await expect(page.getByRole("dialog", { name: "反馈" })).toBeVisible();
    await page.getByRole("button", { name: "取消" }).click();

    await open();
    await expect(page.getByRole("textbox", { name: "反馈内容" })).toHaveValue("");
    await page.getByRole("textbox", { name: "反馈内容" }).fill("草稿二");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "反馈" })).not.toBeVisible();

    await open();
    await expect(page.getByRole("textbox", { name: "反馈内容" })).toHaveValue("");
    await page.getByRole("button", { name: "关闭对话框" }).click();
    await expect(page.getByRole("dialog", { name: "反馈" })).not.toBeVisible();
  });

  test("Turnstile 失败时不请求邮件接口", async ({ page }) => {
    await installTurnstileMock(page, "error");
    let requestCount = 0;
    await page.route("**/api/feedback", async (route) => {
      requestCount += 1;
      await route.abort();
    });
    await waitForGame(page);
    await page.getByRole("button", { name: "反馈" }).click();
    await page.getByRole("textbox", { name: "反馈内容" }).fill("验证失败测试");
    await expect(
      page.locator('[data-turnstile-ready="true"]'),
    ).toHaveAttribute("data-turnstile-ready", "true");
    await page.getByRole("button", { name: "发送" }).click();

    await expect(page.getByText("验证或发送失败，请稍后重试。")).toBeVisible();
    expect(requestCount).toBe(0);
  });

  test("暂停和结算页面入口不改变游戏状态", async ({ page }) => {
    await installTurnstileMock(page);
    await waitForGame(page);

    await page.evaluate(() => {
      const api = (
        window as typeof window & {
          __shootbang_test: {
            startGame: () => void;
            setPaused: (paused: boolean) => void;
          };
        }
      ).__shootbang_test;
      api.startGame();
      api.setPaused(true);
    });
    await expect(page.getByRole("button", { name: "继续" })).toBeVisible();
    await page.getByRole("button", { name: "反馈" }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "继续" })).toBeVisible();

    await page.evaluate(() => {
      (
        window as typeof window & {
          __shootbang_test: { setGameState: (state: string) => void };
        }
      ).__shootbang_test.setGameState("finished");
    });
    await expect(page.getByRole("button", { name: "重新开始" })).toBeVisible();
    await page.getByRole("button", { name: "反馈" }).click();
    await expect(page.getByRole("dialog", { name: "反馈" })).toBeVisible();
  });
});

test.describe("反馈 Route Handler", () => {
  test("在调用外部服务前拒绝错误格式和超长内容", async ({ request }) => {
    const nonJson = await request.post("/api/feedback", {
      data: "invalid",
      headers: { "Content-Type": "text/plain" },
    });
    expect(nonJson.status()).toBe(400);
    expect(await nonJson.json()).toEqual({ ok: false, code: "invalid_input" });

    const tooLong = await request.post("/api/feedback", {
      data: { ...VALID_REQUEST, content: "x".repeat(2_001) },
    });
    expect(tooLong.status()).toBe(400);
    expect(await tooLong.json()).toEqual({ ok: false, code: "invalid_input" });
  });
});
