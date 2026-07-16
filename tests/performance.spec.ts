import { test, expect, type Page } from "@playwright/test";

const FRAME_60HZ_MS = 16.67;
const FRAME_144HZ_MS = 6.95;

interface PerformanceReport {
  thresholdVersion: string;
  baselineFps: number;
  averageFps: number;
  p95FrameMs: number;
  maxFrameMs: number;
  hitchCount: number;
  severeHitchCount: number;
  longTaskCount: number;
  longTaskTotalMs: number;
  reasons: string[];
  context: Record<string, unknown>;
}

interface PerformanceResult {
  report: PerformanceReport | null;
  queued: boolean;
}

interface PerformanceTestApi {
  reset: () => void;
  startGame: () => PerformanceReport[];
  setActive: (active: boolean) => PerformanceReport[];
  restartWindow: () => void;
  injectFrames: (durationsMs: number[]) => PerformanceResult[];
  injectLongTask: (durationMs: number) => void;
  flush: () => PerformanceReport[];
  getState: () => {
    active: boolean;
    settlingRemainingMs: number;
    baselineFps: number | null;
    calibrationElapsedMs: number;
    windowElapsedMs: number;
    pendingReportCount: number;
    sessionReportCount: number;
    lastResult: PerformanceResult | null;
  };
  getPendingReports: () => PerformanceReport[];
  getSentReports: () => PerformanceReport[];
  getBreadcrumbCount: () => number;
  getSentryConfig: () => { message: string; fingerprint: string };
}

async function getApi(page: Page) {
  return page.evaluateHandle(() => {
    const testWindow = window as typeof window & {
      __shootbang_performance_test?: PerformanceTestApi;
    };
    if (!testWindow.__shootbang_performance_test) {
      throw new Error("Performance test API is unavailable");
    }
    return testWindow.__shootbang_performance_test;
  });
}

async function initializeMonitor(page: Page, frameMs: number) {
  await page.evaluate(
    ({ settlingFrames, calibrationFrames, duration }) => {
      const api = (window as typeof window & {
        __shootbang_performance_test: PerformanceTestApi;
      }).__shootbang_performance_test;
      api.reset();
      api.startGame();
      api.setActive(true);
      api.injectFrames([
        duration,
        ...Array(settlingFrames).fill(duration),
        ...Array(calibrationFrames).fill(duration),
      ]);
    },
    {
      duration: frameMs,
      settlingFrames: Math.ceil(1_000 / frameMs),
      calibrationFrames: Math.ceil(2_000 / frameMs),
    },
  );
}

async function injectFrames(page: Page, frames: number[]) {
  return page.evaluate((durations) => {
    const api = (window as typeof window & {
      __shootbang_performance_test: PerformanceTestApi;
    }).__shootbang_performance_test;
    return api.injectFrames(durations);
  }, frames);
}

async function getState(page: Page) {
  return page.evaluate(() => {
    const api = (window as typeof window & {
      __shootbang_performance_test: PerformanceTestApi;
    }).__shootbang_performance_test;
    return api.getState();
  });
}

test.describe("游戏卡顿监控", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("canvas", { timeout: 10_000 });
    await expect.poll(async () => {
      const handle = await getApi(page).catch(() => null);
      await handle?.dispose();
      return Boolean(handle);
    }).toBe(true);
  });

  test("稳定 60Hz 和 144Hz 不产生告警", async ({ page }) => {
    await initializeMonitor(page, FRAME_60HZ_MS);
    let results = await injectFrames(page, Array(300).fill(FRAME_60HZ_MS));
    expect(results).toHaveLength(1);
    expect(results[0].report).toBeNull();
    expect((await getState(page)).baselineFps).toBeCloseTo(60, 0);

    await initializeMonitor(page, FRAME_144HZ_MS);
    results = await injectFrames(page, Array(720).fill(FRAME_144HZ_MS));
    expect(results).toHaveLength(1);
    expect(results[0].report).toBeNull();
    expect((await getState(page)).baselineFps).toBeCloseTo(144, 0);
  });

  test("60Hz 与 144Hz 环境使用动态平均帧率门槛", async ({ page }) => {
    await initializeMonitor(page, FRAME_60HZ_MS);
    let results = await injectFrames(page, Array(264).fill(19));
    expect(results[0].report?.reasons).toContain("average_fps");
    expect(results[0].report?.averageFps).toBeLessThan(55);

    await initializeMonitor(page, FRAME_144HZ_MS);
    results = await injectFrames(page, Array(550).fill(9.1));
    expect(results[0].report?.reasons).toContain("average_fps");
    expect(results[0].report?.baselineFps).toBeCloseTo(144, 0);
  });

  test("p95、重复卡顿和严重冻结可以独立触发", async ({ page }) => {
    await initializeMonitor(page, FRAME_144HZ_MS);
    let results = await injectFrames(page, [
      ...Array(40).fill(26),
      ...Array(570).fill(FRAME_144HZ_MS),
    ]);
    expect(results[0].report?.reasons).toEqual(["p95_frame_time"]);

    await initializeMonitor(page, FRAME_60HZ_MS);
    results = await injectFrames(page, [
      ...Array(295).fill(FRAME_60HZ_MS),
      60,
      60,
    ]);
    expect(results[0].report?.reasons).toEqual(["repeated_hitches"]);

    await initializeMonitor(page, FRAME_60HZ_MS);
    results = await injectFrames(page, [
      ...Array(294).fill(FRAME_60HZ_MS),
      101,
    ]);
    expect(results[0].report?.reasons).toEqual(["severe_hitch"]);
  });

  test("等于 50ms 或 100ms 的边界值不触发对应条件", async ({ page }) => {
    await initializeMonitor(page, FRAME_60HZ_MS);
    let results = await injectFrames(page, [
      ...Array(294).fill(FRAME_60HZ_MS),
      50,
      50,
    ]);
    expect(results[0].report).toBeNull();

    results = await injectFrames(page, [
      ...Array(294).fill(FRAME_60HZ_MS),
      100,
    ]);
    expect(results[0].report).toBeNull();
  });

  test("暂停会丢弃部分窗口，恢复首帧和稳定期不参与采样", async ({ page }) => {
    await initializeMonitor(page, FRAME_60HZ_MS);
    await injectFrames(page, [101, ...Array(50).fill(FRAME_60HZ_MS)]);

    await page.evaluate((frameMs) => {
      const api = (window as typeof window & {
        __shootbang_performance_test: PerformanceTestApi;
      }).__shootbang_performance_test;
      api.setActive(false);
      api.setActive(true);
      api.injectFrames([
        500,
        ...Array(60).fill(frameMs),
        ...Array(300).fill(frameMs),
      ]);
    }, FRAME_60HZ_MS);

    const state = await getState(page);
    expect(state.lastResult?.report).toBeNull();
    expect(state.pendingReportCount).toBe(0);
  });

  test("环境变化重置当前窗口，新游戏重校准但保留会话限流计数", async ({ page }) => {
    await initializeMonitor(page, FRAME_60HZ_MS);
    const result = await page.evaluate((frameMs) => {
      const api = (window as typeof window & {
        __shootbang_performance_test: PerformanceTestApi;
      }).__shootbang_performance_test;

      api.injectFrames([101, ...Array(50).fill(frameMs)]);
      api.restartWindow();
      api.injectFrames([
        500,
        ...Array(60).fill(frameMs),
        ...Array(300).fill(frameMs),
      ]);
      api.injectFrames([...Array(294).fill(frameMs), 101]);
      const beforeNewGame = api.getState();
      api.startGame();
      return {
        beforeNewGame,
        afterNewGame: api.getState(),
        sent: api.getSentReports(),
      };
    }, FRAME_60HZ_MS);

    expect(result.beforeNewGame.pendingReportCount).toBe(1);
    expect(result.afterNewGame.baselineFps).toBeNull();
    expect(result.afterNewGame.sessionReportCount).toBe(1);
    expect(result.sent).toHaveLength(1);
  });

  test("Long Task 只作为异常窗口的诊断数据", async ({ page }) => {
    await initializeMonitor(page, FRAME_60HZ_MS);
    const results = await page.evaluate((frameMs) => {
      const api = (window as typeof window & {
        __shootbang_performance_test: PerformanceTestApi;
      }).__shootbang_performance_test;
      api.injectLongTask(75);
      return api.injectFrames([
        ...Array(294).fill(frameMs),
        101,
      ]);
    }, FRAME_60HZ_MS);

    expect(results[0].report?.longTaskCount).toBe(1);
    expect(results[0].report?.longTaskTotalMs).toBe(75);
    expect(results[0].report?.reasons).not.toContain("long_task");
  });

  test("每个异常窗口记录 breadcrumb，但每页最多发送三条", async ({ page }) => {
    await initializeMonitor(page, FRAME_60HZ_MS);
    const result = await page.evaluate((frameMs) => {
      const api = (window as typeof window & {
        __shootbang_performance_test: PerformanceTestApi;
      }).__shootbang_performance_test;
      const severeWindow = [
        ...Array(294).fill(frameMs),
        101,
      ];
      for (let index = 0; index < 4; index += 1) {
        api.injectFrames(severeWindow);
      }
      const pendingBeforePause = api.getPendingReports();
      api.setActive(false);
      return {
        pendingBeforePause,
        sent: api.getSentReports(),
        state: api.getState(),
        breadcrumbCount: api.getBreadcrumbCount(),
        sentry: api.getSentryConfig(),
      };
    }, FRAME_60HZ_MS);

    expect(result.breadcrumbCount).toBe(4);
    expect(result.pendingBeforePause).toHaveLength(3);
    expect(result.sent).toHaveLength(3);
    expect(result.state.sessionReportCount).toBe(3);
    expect(result.sent.every((report) => report.thresholdVersion === "strict-v1")).toBe(true);
    expect(result.sentry).toEqual({
      message: "Game render stutter detected",
      fingerprint: "shootbang-game-stutter-v1",
    });
    expect(result.sent[0]).not.toHaveProperty("frames");
    expect(result.sent[0].context).toEqual({
      theme: "default",
      dpr: 1,
      viewportWidth: 1280,
      viewportHeight: 720,
      trainingDurationSeconds: 30,
    });
  });
});
