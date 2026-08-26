import { devices, expect, test, type Page } from "@playwright/test";

const WEBGL_FAILURE_MESSAGE =
  "加载失败，请刷新页面，或使用最新版 Chrome 或 Edge 浏览器重试";
const { defaultBrowserType: _iphoneBrowser, ...iphone15 } =
  devices["iPhone 15"];
const { defaultBrowserType: _ipadBrowser, ...ipadPro11 } =
  devices["iPad Pro 11"];
void _iphoneBrowser;
void _ipadBrowser;

async function expectMobilePrompt(page: Page) {
  await page.goto("/");

  await expect(page.getByText("请使用 PC 端访问", { exact: true })).toBeVisible();
  await expect(
    page.getByText("需要鼠标和键盘进行操作，暂不支持移动设备", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.getByText(WEBGL_FAILURE_MESSAGE, { exact: true })).toHaveCount(
    0,
  );
}

test.describe("macOS Safari（WebKit）", () => {
  test("能够初始化 WebGL 场景并打开设置", async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));

    await page.goto("/");

    await expect(page.locator("canvas")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "Shootbang" })).toBeVisible();
    await expect(page.getByRole("button", { name: "开始" })).toBeVisible();
    await expect(page.getByText(WEBGL_FAILURE_MESSAGE, { exact: true })).toHaveCount(
      0,
    );

    await page.getByRole("button", { name: "设置" }).click();
    await expect(page.getByRole("dialog", { name: "设置" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "训练" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "体验" })).toBeVisible();

    expect(pageErrors).toEqual([]);
  });

  test("原始鼠标输入不可用时回退到标准 Pointer Lock", async ({ page }) => {
    await page.addInitScript(() => {
      const state = window as typeof window & {
        __applePointerLockRequests?: Array<"raw" | "standard">;
        __applePointerLockElement?: Element | null;
      };
      state.__applePointerLockRequests = [];
      state.__applePointerLockElement = null;
      Object.defineProperty(Document.prototype, "pointerLockElement", {
        configurable: true,
        get: () => state.__applePointerLockElement ?? null,
      });

      Element.prototype.requestPointerLock = function (
        options?: PointerLockOptions,
      ) {
        const mode = options?.unadjustedMovement ? "raw" : "standard";
        state.__applePointerLockRequests!.push(mode);

        if (mode === "raw") {
          return Promise.reject(
            new DOMException("Raw input unavailable", "NotSupportedError"),
          );
        }

        state.__applePointerLockElement = this;
        queueMicrotask(() =>
          document.dispatchEvent(new Event("pointerlockchange")),
        );
        return Promise.resolve();
      };
    });

    await page.goto("/");
    await expect(page.getByRole("button", { name: "开始" })).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole("button", { name: "开始" }).click();

    await expect
      .poll(() =>
        page.evaluate(() => {
          const state = window as typeof window & {
            __applePointerLockRequests?: Array<"raw" | "standard">;
          };
          return state.__applePointerLockRequests;
        }),
      )
      .toEqual(["raw", "standard"]);
    await expect(
      page.getByText("按 Esc 退出瞄准模式", { exact: true }),
    ).toBeVisible();
  });
});

test.describe("iPhone Safari（WebKit）", () => {
  test.use(iphone15);

  test("显示移动设备提示且不加载游戏场景", async ({ page }) => {
    await expectMobilePrompt(page);
  });
});

test.describe("iPad Safari（WebKit）", () => {
  test.use(ipadPro11);

  test("显示移动设备提示且不加载游戏场景", async ({ page }) => {
    await expectMobilePrompt(page);
  });
});
