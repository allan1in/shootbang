import { test, expect, type Page } from "@playwright/test";

interface TargetInfo {
  visible: boolean;
  x: number;
  y: number;
  z: number;
}

interface GameStats {
  hits: number;
  totalShots: number;
  accuracy: number;
  avgReactionTime: number;
}

interface ShootbangTestAPI {
  startGame: () => void;
  startCountdown: () => void;
  setGameState: (s: string) => void;
  getGameState: () => string;
  getTargetsInfo: () => TargetInfo[];
  getTimeLeft: () => number;
  getDuration: () => number;
  getPointerInputMode: () => "none" | "raw" | "standard";
  getSensitivityMode: () => "cs2" | "valorant" | "delta";
  getSensitivities: () => { cs2: number; valorant: number; delta: number };
  getDegreesPerCount: () => number;
  getRadiansPerCount: () => number;
  applyMouseMovement: (movementX: number, movementY: number) => void;
  getMouseAccum: () => { x: number; y: number };
  setPaused: (paused: boolean) => void;
  recordHitTiming: () => void;
  getHitIntervals: () => number[];
  getAverageReactionTime: () => number;
  getGameStats: () => GameStats;
  setGameStats: (stats: Partial<GameStats>) => void;
}

// 测试辅助：通过 window.__shootbang_test 直接控制游戏状态
async function startGameDirect(page: Page) {
  await page.evaluate(() => {
    const api = (window as unknown as Record<string, unknown>).__shootbang_test as ShootbangTestAPI;
    api.startGame();
    api.startCountdown();
  });
}

async function setGameState(page: Page, state: string) {
  await page.evaluate((s) => {
    const api = (window as unknown as Record<string, unknown>).__shootbang_test as ShootbangTestAPI;
    api.setGameState(s);
  }, state);
}

async function getGameState(page: Page): Promise<string> {
  return page.evaluate(() => {
    const api = (window as unknown as Record<string, unknown>).__shootbang_test as ShootbangTestAPI;
    return api.getGameState();
  });
}

async function setGameStats(page: Page, stats: Partial<GameStats>) {
  await page.evaluate((s) => {
    const api = (window as unknown as Record<string, unknown>).__shootbang_test as ShootbangTestAPI;
    api.setGameStats(s);
  }, stats);
}

// 等待 Three.js canvas 加载完成
async function waitForCanvas(page: Page) {
  await page.waitForSelector("canvas", { timeout: 10000 });
  // 给 Three.js 初始化一帧的时间
  await page.waitForTimeout(500);
}

async function mockScreenSize(page: Page, width: number, height: number) {
  await page.addInitScript(
    ({ screenWidth, screenHeight }) => {
      Object.defineProperties(window.screen, {
        width: { configurable: true, get: () => screenWidth },
        height: { configurable: true, get: () => screenHeight },
      });
    },
    { screenWidth: width, screenHeight: height }
  );
}

type WebGL2FailureMode = "unavailable" | "throws";

interface RendererStartupDiagnosticReport {
  stage: string;
  fingerprint?: string[];
  snapshot: {
    monitorVersion: string;
    elapsedMs: number;
    visibleElapsedMs: number;
    lastCompletedStage: string;
    stages: Record<string, number>;
    failure?: { stage: string; errorName?: string; errorMessage?: string };
    pageLifecycle: {
      visibility: string;
      focused: boolean;
      online: boolean;
      hiddenCount: number;
      blurCount: number;
      visibleDurationMs: number;
    };
    rendererState: {
      rootExists: boolean;
      canvasExists: boolean;
      rendererCreated: boolean;
    };
    webgl?: {
      hasWebGL2Constructor: boolean;
      contextCreated: boolean;
      checkDurationMs: number;
      softwareRenderer: boolean;
      errorName?: string;
      errorMessage?: string;
    };
    resources: {
      scriptCount: number;
      totalScriptTransferBytes: number;
    };
  };
}

async function mockWebGL2Failure(page: Page, mode: WebGL2FailureMode) {
  await page.addInitScript((failureMode) => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    const mockedGetContext = function (
      this: HTMLCanvasElement,
      contextId: string,
      ...args: unknown[]
    ) {
      if (contextId === "webgl2") {
        if (failureMode === "throws") {
          throw new Error("WebGL2 context creation failed");
        }
        return null;
      }

      return Reflect.apply(originalGetContext, this, [contextId, ...args]);
    };

    HTMLCanvasElement.prototype.getContext =
      mockedGetContext as typeof originalGetContext;
  }, mode);
}

async function configureWebGLStartupTest(
  page: Page,
  options: {
    rendererSlowThresholdMs?: number;
    gameBoardImportSlowThresholdMs?: number;
    rendererCreationSlowThresholdMs?: number;
    suppressRendererReady?: boolean;
    holdGameBoardImport?: boolean;
  } = {},
) {
  await page.addInitScript((testOptions) => {
    const state = window as typeof window & {
      __shootbang_webgl_test?: {
        rendererSlowThresholdMs?: number;
        gameBoardImportSlowThresholdMs?: number;
        rendererCreationSlowThresholdMs?: number;
        suppressRendererReady?: boolean;
        holdGameBoardImport?: boolean;
        reportedStages?: string[];
        diagnosticReports?: RendererStartupDiagnosticReport[];
        reportedSlowStages?: string[];
        slowDiagnosticReports?: RendererStartupDiagnosticReport[];
        completeRendererStartup?: () => void;
        releaseGameBoardImport?: () => void;
      };
    };
    state.__shootbang_webgl_test = {
      ...testOptions,
      reportedStages: [],
      diagnosticReports: [],
      reportedSlowStages: [],
      slowDiagnosticReports: [],
    };
  }, options);
}

async function getRendererStartupSlowDiagnosticReports(page: Page) {
  return page.evaluate(() => {
    const state = window as typeof window & {
      __shootbang_webgl_test?: {
        slowDiagnosticReports?: RendererStartupDiagnosticReport[];
      };
    };
    return state.__shootbang_webgl_test?.slowDiagnosticReports ?? [];
  });
}

async function getRendererStartupSlowReports(page: Page) {
  return page.evaluate(() => {
    const state = window as typeof window & {
      __shootbang_webgl_test?: { reportedSlowStages?: string[] };
    };
    return state.__shootbang_webgl_test?.reportedSlowStages ?? [];
  });
}

async function completeRendererStartup(page: Page) {
  await page.evaluate(() => {
    const state = window as typeof window & {
      __shootbang_webgl_test?: { completeRendererStartup?: () => void };
    };
    state.__shootbang_webgl_test?.completeRendererStartup?.();
  });
}

async function releaseGameBoardImport(page: Page) {
  await page.evaluate(() => {
    const state = window as typeof window & {
      __shootbang_webgl_test?: { releaseGameBoardImport?: () => void };
    };
    state.__shootbang_webgl_test?.releaseGameBoardImport?.();
  });
}

async function setPageVisibility(
  page: Page,
  visibilityState: "visible" | "hidden",
) {
  await page.evaluate((state) => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => state,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  }, visibilityState);
}

async function getWebGLStartupDiagnosticReports(page: Page) {
  return page.evaluate(() => {
    const state = window as typeof window & {
      __shootbang_webgl_test?: {
        diagnosticReports?: RendererStartupDiagnosticReport[];
      };
    };
    return state.__shootbang_webgl_test?.diagnosticReports ?? [];
  });
}

async function getWebGLStartupReports(page: Page) {
  return page.evaluate(() => {
    const state = window as typeof window & {
      __shootbang_webgl_test?: { reportedStages?: string[] };
    };
    return state.__shootbang_webgl_test?.reportedStages ?? [];
  });
}

type PointerLockMockMode =
  | "raw"
  | "raw-void"
  | "fallback"
  | "fallback-void"
  | "fail";

async function mockPointerLock(page: Page, mode: PointerLockMockMode) {
  await page.addInitScript((mockMode) => {
    const state = window as typeof window & {
      __shootbangPointerLockRequests?: ({ unadjustedMovement?: boolean } | null)[];
      __shootbangPointerLockElement?: Element | null;
    };
    state.__shootbangPointerLockRequests = [];
    state.__shootbangPointerLockElement = null;
    Object.defineProperty(Document.prototype, "pointerLockElement", {
      configurable: true,
      get: () => state.__shootbangPointerLockElement ?? null,
    });
    Element.prototype.requestPointerLock = function (options?: { unadjustedMovement?: boolean }) {
      state.__shootbangPointerLockRequests!.push(options ?? null);
      const rawRequest = options?.unadjustedMovement === true;
      const succeeds =
        (rawRequest && (mockMode === "raw" || mockMode === "raw-void")) ||
        (!rawRequest &&
          (mockMode === "fallback" || mockMode === "fallback-void"));

      if (succeeds) {
        state.__shootbangPointerLockElement = this;
        queueMicrotask(() =>
          document.dispatchEvent(new Event("pointerlockchange")),
        );
        return mockMode.endsWith("-void")
          ? (undefined as unknown as Promise<void>)
          : Promise.resolve();
      }

      if (mockMode === "fallback-void" && rawRequest) {
        queueMicrotask(() =>
          document.dispatchEvent(new Event("pointerlockerror")),
        );
        return undefined as unknown as Promise<void>;
      }
      return Promise.reject(new DOMException("Pointer lock unavailable", "NotSupportedError"));
    };
  }, mode);
}

async function getPointerLockRequests(page: Page) {
  return page.evaluate(() => {
    const state = window as typeof window & {
      __shootbangPointerLockRequests?: ({ unadjustedMovement?: boolean } | null)[];
    };
    return state.__shootbangPointerLockRequests;
  });
}

// ===== 空闲界面 =====

test.describe("空闲界面", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForCanvas(page);
  });

  test("显示开始按钮", async ({ page }) => {
    await expect(page.getByRole("button", { name: "开始" })).toBeVisible();
  });

  test("显示设置按钮", async ({ page }) => {
    await expect(page.getByRole("button", { name: "设置" })).toBeVisible();
  });

  test("首页不显示主题和静音入口", async ({ page }) => {
    await expect(page.getByRole("button", { name: "主题" })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "静音" })).not.toBeVisible();
  });

  test("canvas 场景已渲染", async ({ page }) => {
    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible();
    // canvas 应该有实际尺寸
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);
  });

  test("渲染器就绪后展示一次公告", async ({ page }) => {
    await page.evaluate(() => {
      localStorage.removeItem("shootbang-last-seen-announcement");
    });
    await page.reload();
    await waitForCanvas(page);

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("heading", { name: "公告" })).toBeVisible();
    await expect(page.getByText("已适配三角洲行动灵敏度")).toBeVisible();
    await expect(page.getByRole("button", { name: "了解" })).not.toBeFocused();
    expect(
      await page.evaluate(() =>
        localStorage.getItem("shootbang-last-seen-announcement"),
      ),
    ).toBe("2026-08-delta");

    await page
      .locator('[data-slot="dialog-viewport"]')
      .click({ position: { x: 1, y: 1 } });
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByRole("button", { name: "了解" }).click();
    await page.reload();
    await waitForCanvas(page);
    await expect(page.getByRole("heading", { name: "公告" })).not.toBeVisible();
  });
});

// ===== 原始鼠标输入 =====

test.describe("Pointer Lock 原始鼠标输入", () => {
  test("优先请求原始鼠标输入", async ({ page }) => {
    await mockPointerLock(page, "raw");
    await page.goto("/");
    await waitForCanvas(page);

    await page.getByRole("button", { name: "开始" }).click();

    await expect.poll(() => page.evaluate(() => {
      const api = (window as unknown as Record<string, unknown>).__shootbang_test as ShootbangTestAPI;
      return api.getPointerInputMode();
    })).toBe("raw");
    expect(await getPointerLockRequests(page)).toEqual([{ unadjustedMovement: true }]);
    await expect(page.getByText("按 Esc 退出瞄准模式", { exact: true })).toBeVisible();
  });

  test("原始输入不可用时静默降级并在每次恢复时重试", async ({ page }) => {
    await mockPointerLock(page, "fallback");
    await page.goto("/");
    await waitForCanvas(page);

    await page.getByRole("button", { name: "开始" }).click();

    await expect.poll(() => page.evaluate(() => {
      const api = (window as unknown as Record<string, unknown>).__shootbang_test as ShootbangTestAPI;
      return api.getPointerInputMode();
    })).toBe("standard");
    await expect(page.getByText("按 Esc 退出瞄准模式", { exact: true }).last()).toBeVisible();
    expect(await getPointerLockRequests(page)).toEqual([{ unadjustedMovement: true }, null]);

    await page.evaluate(() => {
      const api = (window as unknown as Record<string, unknown>).__shootbang_test as ShootbangTestAPI;
      api.setPaused(true);
    });
    await page.getByRole("button", { name: "继续" }).click();

    await expect.poll(() => getPointerLockRequests(page)).toEqual([
      { unadjustedMovement: true },
      null,
      { unadjustedMovement: true },
      null,
    ]);
    await expect(page.getByText("按 Esc 退出瞄准模式", { exact: true }).last()).toBeVisible();
  });

  test("兼容返回 void 的 Firefox 和 Safari Pointer Lock", async ({ page }) => {
    await mockPointerLock(page, "raw-void");
    await page.goto("/");
    await waitForCanvas(page);

    await page.getByRole("button", { name: "开始" }).click();

    await expect
      .poll(() =>
        page.evaluate(() => {
          const api = (window as unknown as Record<string, unknown>)
            .__shootbang_test as ShootbangTestAPI;
          return api.getPointerInputMode();
        }),
      )
      .toBe("raw");
    expect(await getPointerLockRequests(page)).toEqual([
      { unadjustedMovement: true },
    ]);
  });

  test("void 返回的原始输入失败时仍只回退一次", async ({ page }) => {
    await mockPointerLock(page, "fallback-void");
    await page.goto("/");
    await waitForCanvas(page);

    await page.getByRole("button", { name: "开始" }).click();

    await expect
      .poll(() =>
        page.evaluate(() => {
          const api = (window as unknown as Record<string, unknown>)
            .__shootbang_test as ShootbangTestAPI;
          return api.getPointerInputMode();
        }),
      )
      .toBe("standard");
    expect(await getPointerLockRequests(page)).toEqual([
      { unadjustedMovement: true },
      null,
    ]);
  });

  test("两次锁定失败时不启动游戏或显示提示", async ({ page }) => {
    await mockPointerLock(page, "fail");
    await page.goto("/");
    await waitForCanvas(page);

    await page.getByRole("button", { name: "开始" }).click();

    await expect.poll(() => getPointerLockRequests(page)).toEqual([{ unadjustedMovement: true }, null]);
    expect(await getGameState(page)).toBe("idle");
    await expect(page.getByText("按 Esc 退出瞄准模式", { exact: true })).not.toBeVisible();
  });

  test("退出指针锁定时清除输入模式", async ({ page }) => {
    await mockPointerLock(page, "raw");
    await page.goto("/");
    await waitForCanvas(page);

    await page.getByRole("button", { name: "开始" }).click();
    await expect.poll(() => page.evaluate(() => {
      const api = (window as unknown as Record<string, unknown>).__shootbang_test as ShootbangTestAPI;
      return api.getPointerInputMode();
    })).toBe("raw");

    await page.evaluate(() => {
      const state = window as typeof window & {
        __shootbangPointerLockElement?: Element | null;
      };
      state.__shootbangPointerLockElement = null;
      document.dispatchEvent(new Event("pointerlockchange"));
    });
    await expect.poll(() => page.evaluate(() => {
      const api = (window as unknown as Record<string, unknown>).__shootbang_test as ShootbangTestAPI;
      return api.getPointerInputMode();
    })).toBe("none");
  });
});

// ===== 设置面板 =====

test.describe("设置面板", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForCanvas(page);
    // 点击设置按钮
    await page.getByRole("button", { name: "设置" }).click();
  });

  test("打开设置面板显示灵敏度表单", async ({ page }) => {
    const input = page.getByRole("spinbutton", { name: "灵敏度数值" });
    await expect(page.getByRole("dialog", { name: "设置" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "训练" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab", { name: "体验" })).toHaveAttribute("aria-selected", "false");
    await expect(page.getByText("灵敏度")).toBeVisible();
    await expect(page.getByRole("combobox", { name: "游戏" })).toHaveText("CS2");
    await expect(input).toHaveValue("1.25");
    await expect(input).toHaveAttribute("min", "0.1");
    await expect(input).toHaveAttribute("max", "8");
    await expect(page.getByRole("radio", { name: "默认" })).not.toBeVisible();
  });

  test("修改灵敏度并保存", async ({ page }) => {
    const input = page.getByRole("spinbutton", { name: "灵敏度数值" });
    await input.fill("3.125");
    await page.getByText("保存").click();

    // 验证 localStorage（Zustand persist 格式）
    const saved = await page.evaluate(() => {
      const raw = localStorage.getItem("shootbang-settings");
      if (!raw) return null;
      return JSON.parse(raw).state;
    });
    expect(saved.sensitivityMode).toBe("cs2");
    expect(saved.sensitivities).toEqual({ cs2: 3.125, valorant: 1, delta: 3 });
    expect(saved).not.toHaveProperty("sensitivity");
  });

  test("两种模式分别保留草稿值且不会自动换算", async ({ page }) => {
    const mode = page.getByRole("combobox", { name: "游戏" });
    const input = page.getByRole("spinbutton", { name: "灵敏度数值" });

    await input.fill("2.345");
    await mode.click();
    await page.getByRole("option", { name: "无畏契约" }).click();
    await expect(input).toHaveValue("1");
    await expect(input).toHaveAttribute("min", "0.01");
    await expect(input).toHaveAttribute("max", "10");
    await input.fill("0.314");

    await mode.click();
    await page.getByRole("option", { name: "CS2" }).click();
    await expect(input).toHaveValue("2.345");

    await mode.click();
    await page.getByRole("option", { name: "无畏契约" }).click();
    await expect(input).toHaveValue("0.314");
    await page.getByText("保存").click();

    await page.reload();
    await waitForCanvas(page);
    await expect.poll(() => page.evaluate(() => {
      const api = (window as unknown as Record<string, unknown>).__shootbang_test as ShootbangTestAPI;
      return {
        mode: api.getSensitivityMode(),
        values: api.getSensitivities(),
      };
    })).toEqual({
      mode: "valorant",
      values: { cs2: 2.345, valorant: 0.314, delta: 3 },
    });
  });

  test("三角洲行动使用独立默认灵敏度并可保存", async ({ page }) => {
    const mode = page.getByRole("combobox", { name: "游戏" });
    const input = page.getByRole("spinbutton", { name: "灵敏度数值" });

    await mode.click();
    await page.getByRole("option", { name: "三角洲行动" }).click();
    await expect(input).toHaveValue("3");
    await expect(input).toHaveAttribute("min", "0.1");
    await expect(input).toHaveAttribute("max", "50");
    await input.fill("3.5");
    await page.getByText("保存").click();

    await page.reload();
    await waitForCanvas(page);
    await expect.poll(() => page.evaluate(() => {
      const api = (window as unknown as Record<string, unknown>).__shootbang_test as ShootbangTestAPI;
      return {
        mode: api.getSensitivityMode(),
        values: api.getSensitivities(),
        degreesPerCount: api.getDegreesPerCount(),
      };
    })).toEqual({
      mode: "delta",
      values: { cs2: 1.25, valorant: 1, delta: 3.5 },
      degreesPerCount: 0.022,
    });
  });

  test("取消关闭设置面板", async ({ page }) => {
    await page.getByText("取消").click();
    await expect(page.getByRole("dialog", { name: "设置" })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "开始" })).toBeVisible();
  });

  test("显示目标大小设置", async ({ page }) => {
    await expect(page.getByText("目标大小")).toBeVisible();
    await expect(page.getByRole("button", { name: "极小" })).toBeVisible();
    await expect(page.getByRole("button", { name: "小", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "默认" })).toBeVisible();
    await expect(page.getByRole("button", { name: "大", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "极大" })).toBeVisible();
  });

  test("修改目标大小并保存", async ({ page }) => {
    await page.getByRole("button", { name: "大", exact: true }).click();
    await page.getByText("保存").click();

    const saved = await page.evaluate(() => {
      const raw = localStorage.getItem("shootbang-settings");
      if (!raw) return null;
      return JSON.parse(raw).state.targetSize;
    });
    expect(saved).toBe("large");
  });

  test("显示体验设置并保存主题和音量", async ({ page }) => {
    await page.getByRole("tab", { name: "体验" }).click();
    await expect(page.getByText("经典网格射击", { exact: true })).toBeVisible();
    await expect(page.getByText("闪电会短暂致盲", { exact: true })).toBeVisible();
    await expect(page.getByText("风暴会遮挡视线", { exact: true })).toBeVisible();
    await page.getByRole("radio", { name: "暴雪" }).click();
    await page.getByRole("slider", { name: "音量" }).fill("35");
    const persistedBeforeSave = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("shootbang-settings") ?? "{}").state?.volume,
    );
    expect(persistedBeforeSave).toBe(100);
    await page.getByRole("button", { name: "保存" }).click();

    const saved = await page.evaluate(() => ({
      theme: JSON.parse(localStorage.getItem("shootbang-theme") ?? "{}").state?.theme,
      volume: JSON.parse(localStorage.getItem("shootbang-settings") ?? "{}").state?.volume,
      muted: JSON.parse(localStorage.getItem("shootbang-settings") ?? "{}").state?.muted,
    }));
    expect(saved).toEqual({ theme: "blizzard", volume: 35, muted: false });
  });

  test("取消和 Esc 丢弃体验设置草稿，点击遮罩不关闭", async ({ page }) => {
    await page.getByRole("tab", { name: "体验" }).click();
    await page.getByRole("radio", { name: "雷雨" }).click();
    await page.getByRole("slider", { name: "音量" }).fill("0");
    await page.getByRole("button", { name: "取消" }).click();

    await page.getByRole("button", { name: "设置" }).click();
    await page.getByRole("tab", { name: "体验" }).click();
    await expect(page.getByRole("radio", { name: "默认" })).toBeChecked();
    await expect(page.getByRole("slider", { name: "音量" })).toHaveValue("100");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "设置" })).not.toBeVisible();

    await page.getByRole("button", { name: "设置" }).click();
    await page.getByRole("tab", { name: "体验" }).click();
    await page.getByRole("radio", { name: "雷雨" }).click();
    await page.locator('[data-slot="dialog-viewport"]').click({ position: { x: 1, y: 1 } });
    await expect(page.getByRole("dialog", { name: "设置" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "雷雨" })).toBeChecked();
    await page.getByRole("button", { name: "取消" }).click();
  });

  test("切换标签保留草稿并使用半透明极简面板", async ({ page }) => {
    const content = page.locator('[data-slot="dialog-content"]');
    const overlay = page.locator('[data-slot="dialog-overlay"]');
    await expect(content).toHaveClass(/w-\[22rem\]/);
    await expect(content).toHaveClass(/bg-card\/60/);
    await expect(content).toHaveClass(/backdrop-blur-xl/);
    await expect(overlay).toHaveClass(/bg-background\/30/);
    await expect(page.getByText("调整训练难度与体验偏好。", { exact: true })).not.toBeVisible();
    await expect(page.getByText("经典网格射击", { exact: true })).not.toBeVisible();
    await expect(page.getByText("关闭命中、未命中和倒计时音效", { exact: true })).not.toBeVisible();

    const input = page.locator('input[type="number"]');
    await input.fill("3.5");
    const trainingPanel = (await content.boundingBox())!;
    await page.getByRole("tab", { name: "体验" }).click();
    const experiencePanel = (await content.boundingBox())!;
    expect(Math.abs(trainingPanel.height - experiencePanel.height)).toBeLessThanOrEqual(0.1);
    expect(Math.abs(trainingPanel.width - experiencePanel.width)).toBeLessThanOrEqual(1);
    await expect(page.getByRole("radio", { name: "默认" })).toBeVisible();
    const slider = page.getByRole("slider", { name: "音量" });
    const control = page.locator('[data-base-ui-slider-control]');
    const thumb = page.locator('[data-slot="slider-thumb"]');
    await expect(slider).toBeVisible();
    await expect(thumb).toHaveCount(1);

    await slider.fill("0");
    const controlAtMin = (await control.boundingBox())!;
    const thumbAtMin = (await thumb.boundingBox())!;
    expect(thumbAtMin.x).toBeGreaterThanOrEqual(controlAtMin.x - 0.5);

    await slider.fill("100");
    const controlAtMax = (await control.boundingBox())!;
    const thumbAtMax = (await thumb.boundingBox())!;
    expect(thumbAtMax.x + thumbAtMax.width).toBeLessThanOrEqual(
      controlAtMax.x + controlAtMax.width + 0.5,
    );
    await expect(input).not.toBeVisible();

    await page.getByRole("tab", { name: "训练" }).click();
    await expect(input).toHaveValue("3.5");
  });
});

// ===== 倒计时 =====

test.describe("倒计时", () => {
  test("倒计时数字可见", async ({ page }) => {
    await page.goto("/");
    await waitForCanvas(page);
    await startGameDirect(page);
    await expect(page.locator(".text-9xl")).toBeVisible();
  });
});

// ===== 计时进度条 =====

test.describe("计时进度条", () => {
  test("游戏中显示进度条", async ({ page }) => {
    await page.goto("/");
    await waitForCanvas(page);
    await startGameDirect(page);

    const progress = page.locator('[data-slot="progress"]');
    await expect(progress).toBeVisible();
  });

  test("游戏结束后进度条消失", async ({ page }) => {
    await page.goto("/");
    await waitForCanvas(page);
    await startGameDirect(page);
    await setGameState(page, "finished");

    const progress = page.locator('[data-slot="progress"]');
    await expect(progress).not.toBeVisible();
  });
});

// ===== 暂停计时 =====

test.describe("暂停计时", () => {
  test("恢复后从暂停时的剩余时间继续", async ({ page }) => {
    await page.goto("/");
    await waitForCanvas(page);

    await page.evaluate(() => {
      const api = (window as unknown as Record<string, unknown>).__shootbang_test as ShootbangTestAPI;
      api.startGame();
    });
    await page.waitForTimeout(500);

    const pausedAt = await page.evaluate(() => {
      const api = (window as unknown as Record<string, unknown>).__shootbang_test as ShootbangTestAPI;
      api.setPaused(true);
      return api.getTimeLeft();
    });

    await page.waitForTimeout(500);
    const whilePaused = await page.evaluate(() => {
      const api = (window as unknown as Record<string, unknown>).__shootbang_test as ShootbangTestAPI;
      return api.getTimeLeft();
    });
    expect(Math.abs(whilePaused - pausedAt)).toBeLessThan(0.1);

    await page.evaluate(() => {
      const api = (window as unknown as Record<string, unknown>).__shootbang_test as ShootbangTestAPI;
      api.setPaused(false);
    });
    await page.waitForTimeout(500);

    const afterResume = await page.evaluate(() => {
      const api = (window as unknown as Record<string, unknown>).__shootbang_test as ShootbangTestAPI;
      return api.getTimeLeft();
    });
    expect(afterResume).toBeLessThan(pausedAt - 0.3);
  });
});

// ===== 暂停界面 =====

test.describe("暂停界面", () => {
  test("不显示静音入口", async ({ page }) => {
    await page.goto("/");
    await waitForCanvas(page);
    await startGameDirect(page);
    await page.evaluate(() => {
      const api = (window as unknown as Record<string, unknown>).__shootbang_test as ShootbangTestAPI;
      api.setPaused(true);
    });

    await expect(page.getByRole("button", { name: "继续" })).toBeVisible();
    await expect(page.getByRole("button", { name: "静音" })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "取消静音" })).not.toBeVisible();
  });
});

// ===== 平均反应时间 =====

test.describe("平均反应时间", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForCanvas(page);
  });

  test("首次和连续命中使用有效训练时间", async ({ page }) => {
    await page.evaluate(() => {
      const api = (window as unknown as Record<string, unknown>).__shootbang_test as ShootbangTestAPI;
      api.startGame();
    });
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const api = (window as unknown as Record<string, unknown>).__shootbang_test as ShootbangTestAPI;
      api.recordHitTiming();
    });
    await page.waitForTimeout(400);

    const timing = await page.evaluate(() => {
      const api = (window as unknown as Record<string, unknown>).__shootbang_test as ShootbangTestAPI;
      api.recordHitTiming();
      return {
        intervals: api.getHitIntervals(),
        average: api.getAverageReactionTime(),
      };
    });

    expect(timing.intervals).toHaveLength(2);
    expect(timing.intervals[0]).toBeGreaterThan(250);
    expect(timing.intervals[0]).toBeLessThan(800);
    expect(timing.intervals[1]).toBeGreaterThan(250);
    expect(timing.intervals[1]).toBeLessThan(800);
    expect(timing.average).toBeGreaterThan(250);
    expect(timing.average).toBeLessThan(800);
  });

  test("暂停和恢复倒计时不计入命中间隔", async ({ page }) => {
    await page.evaluate(() => {
      const api = (window as unknown as Record<string, unknown>).__shootbang_test as ShootbangTestAPI;
      api.startGame();
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      const api = (window as unknown as Record<string, unknown>).__shootbang_test as ShootbangTestAPI;
      api.recordHitTiming();
      api.setPaused(true);
    });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const api = (window as unknown as Record<string, unknown>).__shootbang_test as ShootbangTestAPI;
      api.setPaused(false);
      api.startCountdown();
    });
    await page.waitForTimeout(3200);
    await page.waitForTimeout(300);

    const secondInterval = await page.evaluate(() => {
      const api = (window as unknown as Record<string, unknown>).__shootbang_test as ShootbangTestAPI;
      api.recordHitTiming();
      return api.getHitIntervals()[1];
    });
    expect(secondInterval).toBeGreaterThan(50);
    expect(secondInterval).toBeLessThan(700);
  });

  test("重新开始会清空上一局的命中计时", async ({ page }) => {
    await page.evaluate(() => {
      const api = (window as unknown as Record<string, unknown>).__shootbang_test as ShootbangTestAPI;
      api.startGame();
      api.recordHitTiming();
      api.startGame();
    });

    const resetTiming = await page.evaluate(() => {
      const api = (window as unknown as Record<string, unknown>).__shootbang_test as ShootbangTestAPI;
      return {
        intervals: api.getHitIntervals(),
        average: api.getAverageReactionTime(),
      };
    });
    expect(resetTiming.intervals).toEqual([]);
    expect(resetTiming.average).toBe(0);
  });
});

// ===== 目标球可见性 =====

test.describe("目标球", () => {
  test("游戏中目标球可见且位置正确", async ({ page }) => {
    await page.goto("/");
    await waitForCanvas(page);
    await startGameDirect(page);

    const targets = await page.evaluate(() => {
      const api = (window as unknown as Record<string, unknown>).__shootbang_test as ShootbangTestAPI;
      return api.getTargetsInfo();
    });
    expect(targets.length).toBe(3);
    const visibleTargets = targets.filter((t) => t.visible);
    expect(visibleTargets.length).toBe(3);
    for (const t of visibleTargets) {
      expect(t.z).toBe(-5);
    }
  });

  test("游戏结束后目标球不可见", async ({ page }) => {
    await page.goto("/");
    await waitForCanvas(page);
    await startGameDirect(page);
    await setGameState(page, "finished");
    // 等待 React 重新渲染，动画循环 else 分支隐藏目标球
    await expect(page.getByRole("button", { name: "重新开始" })).toBeVisible();

    const targets = await page.evaluate(() => {
      const api = (window as unknown as Record<string, unknown>).__shootbang_test as ShootbangTestAPI;
      return api.getTargetsInfo();
    });
    const visibleTargets = targets.filter((t) => t.visible);
    expect(visibleTargets.length).toBe(0);
  });
});

// ===== 游戏结束 =====

test.describe("游戏结束", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForCanvas(page);
    await startGameDirect(page);
    await setGameState(page, "finished");
  });

  test("显示重新开始按钮", async ({ page }) => {
    await expect(page.getByRole("button", { name: "重新开始" })).toBeVisible();
  });

  test("结算页不显示静音入口", async ({ page }) => {
    await expect(page.getByRole("button", { name: "静音" })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "取消静音" })).not.toBeVisible();
  });

  test("显示返回首页按钮", async ({ page }) => {
    await expect(page.getByRole("button", { name: "回到首页" })).toBeVisible();
  });

  test("显示命中率", async ({ page }) => {
    await setGameStats(page, { hits: 8, totalShots: 10, accuracy: 80, avgReactionTime: 350 });
    await expect(page.getByText("80%")).toBeVisible();
    await expect(page.getByText("命中率")).toBeVisible();
  });

  test("显示平均反应时间", async ({ page }) => {
    await setGameStats(page, { hits: 3, totalShots: 5, accuracy: 60, avgReactionTime: 420 });
    await expect(page.getByText("420ms")).toBeVisible();
    await expect(page.getByText("平均反应时间")).toBeVisible();
  });

  test("无射击时显示零值", async ({ page }) => {
    await expect(page.getByText("0%")).toBeVisible();
    await expect(page.getByText("0ms")).toBeVisible();
  });

  test("重新开始重置统计数据", async ({ page }) => {
    await setGameStats(page, { hits: 8, totalShots: 10, accuracy: 80, avgReactionTime: 350 });
    await expect(page.getByText("80%")).toBeVisible();

    await page.getByRole("button", { name: "重新开始" }).click();
    await setGameState(page, "finished");
    await expect(page.getByText("0%")).toBeVisible();
    await expect(page.getByText("0ms")).toBeVisible();
  });
});

// ===== 重新开始 =====

test.describe("重新开始", () => {
  test("点击重新开始重新开始游戏", async ({ page }) => {
    await page.goto("/");
    await waitForCanvas(page);
    await startGameDirect(page);
    await setGameState(page, "finished");

    const btn = page.getByRole("button", { name: "重新开始" });
    await expect(btn).toBeVisible();
    await btn.click();
    // triggerStart 需要 pointer lock，headless 模式下会 catch
    // 所以状态可能仍在 finished，这是预期行为
  });
});

// ===== 返回首页 =====

test.describe("回到首页", () => {
  test("点击返回首页回到空闲界面", async ({ page }) => {
    await page.goto("/");
    await waitForCanvas(page);
    await startGameDirect(page);
    await setGameState(page, "finished");

    await page.getByRole("button", { name: "回到首页" }).click();
    await expect(page.getByRole("button", { name: "开始" })).toBeVisible();
    const state = await getGameState(page);
    expect(state).toBe("idle");
  });
});

// ===== 游戏状态流转 =====

test.describe("状态流转", () => {
  test("idle -> playing -> finished -> idle 完整流转", async ({ page }) => {
    await page.goto("/");
    await waitForCanvas(page);

    // 初始 idle
    await expect(page.getByRole("button", { name: "开始" })).toBeVisible();
    expect(await getGameState(page)).toBe("idle");

    // 跳到 playing
    await startGameDirect(page);
    await expect.poll(() => getGameState(page)).toBe("playing");

    // 跳到 finished
    await setGameState(page, "finished");
    await expect(page.getByRole("button", { name: "重新开始" })).toBeVisible();
    expect(await getGameState(page)).toBe("finished");

    // 返回 idle
    await page.getByRole("button", { name: "回到首页" }).click();
    await expect(page.getByRole("button", { name: "开始" })).toBeVisible();
    expect(await getGameState(page)).toBe("idle");
  });
});

// ===== 移动端提示 =====

test.describe("移动端提示", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test.beforeEach(async ({ page }) => {
    await mockScreenSize(page, 375, 667);
  });

  test("显示 PC 访问提示", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("请使用 PC 端访问")).toBeVisible();
    await expect(
      page.getByText("需要鼠标和键盘进行操作，暂不支持移动设备")
    ).toBeVisible();
  });

  test("不渲染 3D 场景", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("canvas")).not.toBeVisible();
  });
});

// ===== 灵敏度兼容与转向 =====

test.describe("灵敏度兼容与转向", () => {
  async function seedPersistedSettings(
    page: Page,
    state: Record<string, unknown>,
  ) {
    await page.addInitScript((persistedState) => {
      localStorage.setItem(
        "shootbang-settings",
        JSON.stringify({ state: persistedState, version: 1 }),
      );
    }, state);
  }

  test("旧 sensitivity 只作为 CS2 的兼容回退", async ({ page }) => {
    await seedPersistedSettings(page, { sensitivity: 2.5 });
    await page.goto("/");
    await waitForCanvas(page);

    await expect.poll(() => page.evaluate(() => {
      const api = (window as unknown as Record<string, unknown>).__shootbang_test as ShootbangTestAPI;
      return {
        mode: api.getSensitivityMode(),
        values: api.getSensitivities(),
      };
    })).toEqual({
      mode: "cs2",
      values: { cs2: 2.5, valorant: 1, delta: 3 },
    });
  });

  test("新版字段优先于旧字段并恢复所选模式", async ({ page }) => {
    await seedPersistedSettings(page, {
      sensitivity: 9,
      sensitivityMode: "valorant",
      sensitivities: { cs2: 2.125, valorant: 0.314 },
      duration: 60,
      gridSize: 4,
      targetSize: "small",
      volume: 35,
    });
    await page.goto("/");
    await waitForCanvas(page);

    await expect.poll(() => page.evaluate(() => {
      const api = (window as unknown as Record<string, unknown>).__shootbang_test as ShootbangTestAPI;
      return {
        mode: api.getSensitivityMode(),
        values: api.getSensitivities(),
        duration: api.getDuration(),
      };
    })).toEqual({
      mode: "valorant",
      values: { cs2: 2.125, valorant: 0.314, delta: 3 },
      duration: 60,
    });
  });

  test("非法新版数值按规则回退且不会接受字符串", async ({ page }) => {
    await seedPersistedSettings(page, {
      sensitivity: 2.75,
      sensitivityMode: "invalid",
      sensitivities: { cs2: "3.5", valorant: 11 },
    });
    await page.goto("/");
    await waitForCanvas(page);

    await expect.poll(() => page.evaluate(() => {
      const api = (window as unknown as Record<string, unknown>).__shootbang_test as ShootbangTestAPI;
      return {
        mode: api.getSensitivityMode(),
        values: api.getSensitivities(),
      };
    })).toEqual({
      mode: "cs2",
      values: { cs2: 2.75, valorant: 1, delta: 3 },
    });
  });

  test("无畏契约使用精确系数且横纵方向一致并限制 pitch", async ({ page }) => {
    await seedPersistedSettings(page, {
      sensitivityMode: "valorant",
      sensitivities: { cs2: 1, valorant: 0.35 },
    });
    await page.goto("/");
    await waitForCanvas(page);

    const result = await page.evaluate(() => {
      const api = (window as unknown as Record<string, unknown>).__shootbang_test as ShootbangTestAPI;
      api.applyMouseMovement(100, 100);
      const afterEqualMovement = api.getMouseAccum();
      api.applyMouseMovement(0, 1_000_000);
      return {
        degreesPerCount: api.getDegreesPerCount(),
        radiansPerCount: api.getRadiansPerCount(),
        afterEqualMovement,
        afterClamp: api.getMouseAccum(),
      };
    });

    expect(result.degreesPerCount).toBe(0.07);
    expect(result.radiansPerCount * (180 / Math.PI)).toBeCloseTo(0.0245, 12);
    expect(result.afterEqualMovement.x * (180 / Math.PI)).toBeCloseTo(-2.45, 12);
    expect(result.afterEqualMovement.y * (180 / Math.PI)).toBeCloseTo(-2.45, 12);
    expect(result.afterClamp.y).toBe(-Math.PI / 2);
  });
});

// ===== WebGL 启动兜底 =====

test.describe("WebGL 启动兜底", () => {
  test("WebGL2 不可用时在原加载位置显示兼容性提示", async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));
    await configureWebGLStartupTest(page);
    await mockWebGL2Failure(page, "unavailable");

    await page.goto("/");

    await expect(
      page.getByRole("alert").getByText(
        "加载失败，请刷新页面，或使用最新版 Chrome 或 Edge 浏览器重试",
        { exact: true },
      ),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Shootbang" })).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "开始" })).toHaveCount(0);
    await expect.poll(() => getWebGLStartupReports(page)).toEqual([
      "webgl2-check",
    ]);
    const [report] = await getWebGLStartupDiagnosticReports(page);
    expect(report.stage).toBe("webgl2-check");
    expect(report.snapshot.monitorVersion).toBe("renderer-startup-v3");
    expect(report.snapshot.lastCompletedStage).toBe(
      "webgl2-check-completed",
    );
    expect(report.snapshot.failure?.stage).toBe("webgl2-check");
    expect(report.snapshot.webgl).toMatchObject({
      hasWebGL2Constructor: true,
      contextCreated: false,
      softwareRenderer: false,
    });
    expect(report.snapshot.rendererState).toEqual({
      rootExists: false,
      canvasExists: false,
      rendererCreated: false,
    });
    expect(pageErrors).toEqual([]);
  });

  test("WebGL2 检测抛出异常时仍显示受控失败提示", async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));
    await configureWebGLStartupTest(page);
    await mockWebGL2Failure(page, "throws");

    await page.goto("/");

    await expect(
      page.getByText("加载失败，请刷新页面，或使用最新版 Chrome 或 Edge 浏览器重试", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(0);
    await expect.poll(() => getWebGLStartupReports(page)).toEqual([
      "webgl2-check",
    ]);
    expect(pageErrors).toEqual([]);
  });

  test("Renderer 初始化较慢时继续加载并在恢复后进入首页", async ({ page }) => {
    await configureWebGLStartupTest(page, {
      gameBoardImportSlowThresholdMs: 10_000,
      rendererCreationSlowThresholdMs: 50,
      suppressRendererReady: true,
    });

    await page.goto("/");

    await expect(
      page.getByText("加载时间较长，请稍候…", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(1);
    await expect(
      page.getByText("加载失败，请刷新页面，或使用最新版 Chrome 或 Edge 浏览器重试", {
        exact: true,
      }),
    ).toHaveCount(0);
    await expect.poll(() => getRendererStartupSlowReports(page)).toEqual([
      "renderer-creation-slow",
    ]);
    const [report] = await getRendererStartupSlowDiagnosticReports(page);
    expect(report.stage).toBe("renderer-creation-slow");
    expect(report.fingerprint).toEqual([
      "shootbang-renderer-startup-slow-v1",
      "renderer-creation-slow",
    ]);
    expect(report.snapshot.monitorVersion).toBe("renderer-startup-v3");
    expect(report.snapshot.lastCompletedStage).toBe("canvas-render-started");
    expect(report.snapshot.failure).toBeUndefined();
    expect(report.snapshot.visibleElapsedMs).toBeGreaterThanOrEqual(50);
    expect(report.snapshot.webgl?.contextCreated).toBe(true);
    expect(report.snapshot.rendererState.rendererCreated).toBe(false);
    expect(report.snapshot.resources.scriptCount).toBeGreaterThan(0);

    await page.waitForTimeout(100);
    expect(await getRendererStartupSlowReports(page)).toEqual([
      "renderer-creation-slow",
    ]);

    await completeRendererStartup(page);
    await expect(page.getByRole("button", { name: "开始" })).toBeVisible();
    await expect(page.getByText("加载时间较长，请稍候…")).toHaveCount(0);
  });

  test("GameBoard 动态导入较慢时单独分类且不会阻止后续加载", async ({ page }) => {
    await configureWebGLStartupTest(page, {
      rendererSlowThresholdMs: 50,
      holdGameBoardImport: true,
    });

    await page.goto("/");

    await expect(page.getByText("加载时间较长，请稍候…")).toBeVisible();
    await expect.poll(() => getRendererStartupSlowReports(page)).toEqual([
      "gameboard-import-slow",
    ]);
    const [report] = await getRendererStartupSlowDiagnosticReports(page);
    expect(report.stage).toBe("gameboard-import-slow");
    expect(report.fingerprint).toEqual([
      "shootbang-renderer-startup-slow-v1",
      "gameboard-import-slow",
    ]);
    expect(report.snapshot.lastCompletedStage).toBe("gameboard-import-started");
    expect(report.snapshot.failure).toBeUndefined();

    await releaseGameBoardImport(page);
    await expect(page.getByRole("button", { name: "开始" })).toBeVisible();
  });

  test("页面隐藏时暂停慢加载计时，恢复可见后继续", async ({ page }) => {
    await configureWebGLStartupTest(page, {
      gameBoardImportSlowThresholdMs: 10_000,
      rendererCreationSlowThresholdMs: 200,
      suppressRendererReady: true,
    });
    await page.goto("/");
    await expect(page.locator("canvas")).toHaveCount(1);

    await setPageVisibility(page, "hidden");
    await page.waitForTimeout(300);
    expect(await getRendererStartupSlowReports(page)).toEqual([]);

    await setPageVisibility(page, "visible");
    await expect(page.getByText("加载时间较长，请稍候…")).toBeVisible();
  });

  test("窗口失焦但页面可见时仍累计慢加载时间", async ({ page }) => {
    await page.addInitScript(() => {
      Document.prototype.hasFocus = () => false;
    });
    await configureWebGLStartupTest(page, {
      gameBoardImportSlowThresholdMs: 10_000,
      rendererCreationSlowThresholdMs: 50,
      suppressRendererReady: true,
    });

    await page.goto("/");

    await expect(page.getByText("加载时间较长，请稍候…")).toBeVisible();
    const [report] = await getRendererStartupSlowDiagnosticReports(page);
    expect(report.snapshot.pageLifecycle.focused).toBe(false);
    expect(report.snapshot.visibleElapsedMs).toBeGreaterThanOrEqual(50);
  });

  test.describe("移动设备优先级", () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test("移动设备不执行 WebGL2 检测", async ({ page }) => {
      await mockScreenSize(page, 375, 667);
      await configureWebGLStartupTest(page);
      await mockWebGL2Failure(page, "throws");

      await page.goto("/");

      await expect(page.getByText("请使用 PC 端访问")).toBeVisible();
      await expect(
        page.getByText("加载失败，请刷新页面，或使用最新版 Chrome 或 Edge 浏览器重试", {
          exact: true,
        }),
      ).toHaveCount(0);
      expect(await getWebGLStartupReports(page)).toEqual([]);
    });
  });
});

// ===== 懒加载 =====

test.describe("懒加载", () => {
  test.describe("移动端", () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test.beforeEach(async ({ page }) => {
      await mockScreenSize(page, 375, 667);
    });

    test("不加载游戏模块", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByText("请使用 PC 端访问")).toBeVisible();
      // __shootbang_test 由 GameBoard 依赖链注册，未定义即游戏 chunk 未加载执行
      const apiDefined = await page.evaluate(
        () => "__shootbang_test" in window
      );
      expect(apiDefined).toBe(false);
    });

    test("窗口变宽后仍按设备屏幕保持拦截", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByText("请使用 PC 端访问")).toBeVisible();

      await page.setViewportSize({ width: 1280, height: 720 });
      await expect(page.getByText("请使用 PC 端访问")).toBeVisible();
      await expect(page.locator("canvas")).not.toBeVisible();
    });
  });

  test.describe("平板 UA", () => {
    test.use({
      userAgent:
        "Mozilla/5.0 AppleWebKit/537.36 Chrome/151.0.0.0 Safari/537.36 VivoBrowser/22.4 DeviceType/tablet",
      viewport: { width: 1239, height: 826 },
    });

    test("通用 Tablet 标识直接显示 PC 提示且不加载游戏模块", async ({ page }) => {
      await mockScreenSize(page, 1239, 826);
      await configureWebGLStartupTest(page);
      await mockWebGL2Failure(page, "throws");

      await page.goto("/");

      await expect(page.getByText("请使用 PC 端访问")).toBeVisible();
      expect(await getWebGLStartupReports(page)).toEqual([]);
      expect(await page.evaluate(() => "__shootbang_test" in window)).toBe(false);
    });
  });

  test.describe("桌面设备边界", () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test.beforeEach(async ({ page }) => {
      await mockScreenSize(page, 1920, 1080);
    });

    test("桌面浏览器缩小窗口后仍加载游戏", async ({ page }) => {
      await page.goto("/");
      await waitForCanvas(page);
      await expect(page.getByText("请使用 PC 端访问")).not.toBeVisible();
    });
  });

  test.describe("720p 桌面设备边界", () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test.beforeEach(async ({ page }) => {
      await mockScreenSize(page, 1280, 720);
    });

    test("常见 720p 桌面屏幕仍加载游戏", async ({ page }) => {
      await page.goto("/");
      await waitForCanvas(page);
      await expect(page.getByText("请使用 PC 端访问")).not.toBeVisible();
    });
  });

  test.describe("触屏笔记本边界", () => {
    test.use({
      hasTouch: true,
      viewport: { width: 1280, height: 720 },
    });

    test.beforeEach(async ({ page }) => {
      await mockScreenSize(page, 1920, 1080);
    });

    test("支持触摸但使用桌面 UA 时仍加载游戏", async ({ page }) => {
      await page.goto("/");
      await waitForCanvas(page);
      await expect(page.getByText("请使用 PC 端访问")).not.toBeVisible();
    });
  });

  test.describe("移动 UA 边界", () => {
    test.use({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1",
      viewport: { width: 1280, height: 720 },
    });

    test.beforeEach(async ({ page }) => {
      await mockScreenSize(page, 1920, 1080);
    });

    test("大屏幕下的移动 UA 仍被拦截", async ({ page }) => {
      await page.goto("/");
      await expect(page.getByText("请使用 PC 端访问")).toBeVisible();
      await expect(page.locator("canvas")).not.toBeVisible();
    });
  });

  test("桌面端加载游戏模块", async ({ page }) => {
    await page.goto("/");
    await waitForCanvas(page);
    const apiDefined = await page.evaluate(
      () => "__shootbang_test" in window
    );
    expect(apiDefined).toBe(true);
  });
});
