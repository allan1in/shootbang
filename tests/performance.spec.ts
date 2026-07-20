import { expect, test, type Page } from "@playwright/test";

interface PerformanceReport {
  monitorVersion: string;
  gameSessionId: number;
  observedPeakFps: number;
  averageFps: number;
  latestFps: number;
  declineRatio: number;
  declineThresholdFps: number;
  sampleDurationMs: number;
  sampleCount: number;
  context: {
    theme: string;
    dpr: number;
    viewportWidth: number;
    viewportHeight: number;
    trainingDurationSeconds: number;
    activeTrainingTimeMs: number;
  };
}

interface MonitorEligibility {
  gameState: string;
  isPaused: boolean;
  countdown: number | null;
  isLocked: boolean;
  isPageVisible: boolean;
  isWindowFocused: boolean;
  isContextAvailable: boolean;
}

interface CapturedEvent {
  message: string;
  level: string;
  fingerprint: string[];
  tags: Record<string, string>;
  contexts: {
    game_performance: Record<string, number | string>;
    game_environment: Record<string, number | string>;
  };
}

interface PerformanceTestApi {
  reset: () => void;
  startGame: () => number;
  setActive: (active: boolean) => void;
  advanceActiveTime: (durationMs: number) => void;
  restartSampling: () => void;
  simulateDecline: (sample: {
    fps: number;
    refreshrate: number;
    averages: number[];
  }) => PerformanceReport | null;
  getBounds: (observedPeakFps: number) => [number, number];
  canMonitor: (eligibility: MonitorEligibility) => boolean;
  getState: () => {
    active: boolean;
    gameSessionId: number;
    reportedCurrentGame: boolean;
    samplingGeneration: number;
    activeTrainingTimeMs: number;
  };
  getRuntimeState: () => {
    active: boolean;
    gameSessionId: number;
    samplingGeneration: number;
  };
  getReports: () => PerformanceReport[];
  getCapturedEvents: () => CapturedEvent[];
  getMonitorConfig: () => {
    ms: number;
    iterations: number;
    threshold: number;
    lowerBoundRatio: number;
    upperBoundRatio: number;
    version: string;
  };
  getSentryConfig: () => {
    messagePrefix: string;
    fingerprint: string;
    customPerformanceBreadcrumbs: boolean;
  };
}

declare global {
  interface Window {
    __shootbang_performance_test?: PerformanceTestApi;
    __shootbang_test?: {
      startGame: () => void;
      setPaused: (paused: boolean) => void;
    };
  }
}

async function waitForPerformanceApi(page: Page) {
  await page.waitForSelector("canvas", { timeout: 10_000 });
  await page.waitForFunction(
    () => "__shootbang_performance_test" in window,
  );
}

const DECLINE_SAMPLE = {
  fps: 78,
  refreshrate: 100,
  averages: [70, 72, 74, 76, 78, 70, 72, 74, 76, 78],
};

test.describe("游戏性能下降监控", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForPerformanceApi(page);
  });

  test("使用 250ms、10 次采样和相对 FPS 边界", async ({ page }) => {
    const result = await page.evaluate(() => {
      const api = window.__shootbang_performance_test!;
      api.reset();
      return {
        config: api.getMonitorConfig(),
        bounds60: api.getBounds(60),
        bounds144: api.getBounds(144),
      };
    });

    expect(result.config).toEqual({
      ms: 250,
      iterations: 10,
      threshold: 0.75,
      lowerBoundRatio: 0.8,
      upperBoundRatio: 0.9,
      version: "drei-simple-v1",
    });
    expect(result.bounds60).toEqual([48, 54]);
    expect(result.bounds144).toEqual([115.2, 129.6]);
  });

  test("生成不含原始样本的最小报告", async ({ page }) => {
    const report = await page.evaluate((sample) => {
      const api = window.__shootbang_performance_test!;
      api.reset();
      api.startGame();
      api.setActive(true);
      api.advanceActiveTime(1_234);
      return api.simulateDecline(sample);
    }, DECLINE_SAMPLE);

    expect(report).toMatchObject({
      monitorVersion: "drei-simple-v1",
      gameSessionId: 1,
      observedPeakFps: 100,
      averageFps: 74,
      latestFps: 78,
      declineRatio: 0.26,
      declineThresholdFps: 80,
      sampleDurationMs: 2_500,
      sampleCount: 10,
      context: {
        theme: "default",
        dpr: 1,
        viewportWidth: 1280,
        viewportHeight: 720,
        trainingDurationSeconds: 30,
        activeTrainingTimeMs: 1_234,
      },
    });
    expect(report).not.toHaveProperty("averages");
    expect(report).not.toHaveProperty("frames");
    expect(report).not.toHaveProperty("p95FrameMs");
    expect(report).not.toHaveProperty("longTaskCount");
  });

  test("同一局只报告一次，暂停恢复不重置门控或累计暂停时间", async ({
    page,
  }) => {
    const result = await page.evaluate((sample) => {
      const api = window.__shootbang_performance_test!;
      api.reset();
      api.startGame();
      api.setActive(true);
      api.advanceActiveTime(500);
      const first = api.simulateDecline(sample);
      const duplicate = api.simulateDecline(sample);

      api.setActive(false);
      api.advanceActiveTime(1_000);
      const pausedState = api.getState();
      const whilePaused = api.simulateDecline(sample);

      api.setActive(true);
      api.advanceActiveTime(250);
      const afterResume = api.simulateDecline(sample);
      return {
        first,
        duplicate,
        whilePaused,
        afterResume,
        pausedState,
        finalState: api.getState(),
        reports: api.getReports(),
      };
    }, DECLINE_SAMPLE);

    expect(result.first).not.toBeNull();
    expect(result.duplicate).toBeNull();
    expect(result.whilePaused).toBeNull();
    expect(result.afterResume).toBeNull();
    expect(result.pausedState.activeTrainingTimeMs).toBe(500);
    expect(result.finalState.activeTrainingTimeMs).toBe(750);
    expect(result.finalState.reportedCurrentGame).toBe(true);
    expect(result.reports).toHaveLength(1);
  });

  test("新一局产生不同消息，但继续使用同一 Sentry fingerprint", async ({
    page,
  }) => {
    const result = await page.evaluate((sample) => {
      const api = window.__shootbang_performance_test!;
      api.reset();

      api.startGame();
      api.setActive(true);
      api.simulateDecline(sample);

      api.startGame();
      api.setActive(true);
      api.simulateDecline(sample);

      return {
        reports: api.getReports(),
        events: api.getCapturedEvents(),
        sentry: api.getSentryConfig(),
      };
    }, DECLINE_SAMPLE);

    expect(result.reports.map((report) => report.gameSessionId)).toEqual([1, 2]);
    expect(result.events).toHaveLength(2);
    expect(result.events[0].message).toContain("[game 1]");
    expect(result.events[1].message).toContain("[game 2]");
    expect(result.events[0].message).not.toBe(result.events[1].message);
    expect(result.events[0].fingerprint).toEqual([
      "shootbang-performance-decline-v1",
    ]);
    expect(result.events[1].fingerprint).toEqual(
      result.events[0].fingerprint,
    );
    expect(result.events.every((event) => event.level === "warning")).toBe(true);
    expect(result.events[0].tags).toEqual({
      monitor_version: "drei-simple-v1",
      theme: "default",
      component: "game-render-loop",
    });
    expect(result.events[0].contexts).toEqual({
      game_performance: {
        game_number: 1,
        observed_peak_fps: 100,
        average_fps: 74,
        latest_fps: 78,
        decline_ratio: 0.26,
        decline_threshold_fps: 80,
        sample_duration_ms: 2_500,
        sample_count: 10,
        active_training_time_ms: 0,
      },
      game_environment: {
        theme: "default",
        dpr: 1,
        viewport_width: 1280,
        viewport_height: 720,
        training_duration_seconds: 30,
      },
    });
    expect(result.sentry).toEqual({
      messagePrefix: "Game performance decline detected",
      fingerprint: "shootbang-performance-decline-v1",
      customPerformanceBreadcrumbs: false,
    });
  });

  test("只在完整的有效训练条件下接受下降事件", async ({ page }) => {
    const result = await page.evaluate((sample) => {
      const api = window.__shootbang_performance_test!;
      const valid: MonitorEligibility = {
        gameState: "playing",
        isPaused: false,
        countdown: null,
        isLocked: true,
        isPageVisible: true,
        isWindowFocused: true,
        isContextAvailable: true,
      };
      const invalid = [
        { ...valid, gameState: "idle" },
        { ...valid, isPaused: true },
        { ...valid, countdown: 3 },
        { ...valid, isLocked: false },
        { ...valid, isPageVisible: false },
        { ...valid, isWindowFocused: false },
        { ...valid, isContextAvailable: false },
      ];

      api.reset();
      api.startGame();
      const inactiveReport = api.simulateDecline(sample);
      return {
        valid: api.canMonitor(valid),
        invalid: invalid.map((eligibility) => api.canMonitor(eligibility)),
        inactiveReport,
        reportCount: api.getReports().length,
      };
    }, DECLINE_SAMPLE);

    expect(result.valid).toBe(true);
    expect(result.invalid).toEqual(Array(7).fill(false));
    expect(result.inactiveReport).toBeNull();
    expect(result.reportCount).toBe(0);
  });

  test("真实组件会随训练生命周期卸载并在 resize 后重建采样", async ({
    page,
  }) => {
    const runtimeState = () =>
      page.evaluate(
        () => window.__shootbang_performance_test!.getRuntimeState(),
      );

    expect((await runtimeState()).active).toBe(false);

    await page.evaluate(() => {
      window.__shootbang_test!.startGame();
      Object.defineProperty(document, "pointerLockElement", {
        configurable: true,
        value: document.querySelector("canvas"),
      });
      document.dispatchEvent(new Event("pointerlockchange"));
    });
    await expect.poll(async () => (await runtimeState()).active).toBe(true);

    await page.evaluate(() => window.__shootbang_test!.setPaused(true));
    await expect.poll(async () => (await runtimeState()).active).toBe(false);
    await page.evaluate(() => window.__shootbang_test!.setPaused(false));
    await expect.poll(async () => (await runtimeState()).active).toBe(true);

    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await expect.poll(async () => (await runtimeState()).active).toBe(false);
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect.poll(async () => (await runtimeState()).active).toBe(true);

    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect.poll(async () => (await runtimeState()).active).toBe(false);
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "visible",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect.poll(async () => (await runtimeState()).active).toBe(true);

    const generationBeforeResize = (await runtimeState()).samplingGeneration;
    await page.setViewportSize({ width: 1200, height: 800 });
    await expect
      .poll(async () => (await runtimeState()).samplingGeneration)
      .toBeGreaterThan(generationBeforeResize);

    await page.evaluate(() => {
      Object.defineProperty(document, "pointerLockElement", {
        configurable: true,
        value: null,
      });
      document.dispatchEvent(new Event("pointerlockchange"));
    });
    await expect.poll(async () => (await runtimeState()).active).toBe(false);
  });

  test("resize 或 DPR 重置采样，但不会解除本局报告门控", async ({ page }) => {
    const result = await page.evaluate((sample) => {
      const api = window.__shootbang_performance_test!;
      api.reset();
      api.startGame();
      api.setActive(true);
      api.simulateDecline(sample);

      api.restartSampling();
      api.restartSampling();
      const afterRestart = api.getState();
      const duplicate = api.simulateDecline(sample);

      api.startGame();
      const newGameState = api.getState();
      api.setActive(true);
      const nextGame = api.simulateDecline(sample);
      return {
        afterRestart,
        duplicate,
        newGameState,
        nextGame,
        reportCount: api.getReports().length,
      };
    }, DECLINE_SAMPLE);

    expect(result.afterRestart.samplingGeneration).toBe(2);
    expect(result.afterRestart.reportedCurrentGame).toBe(true);
    expect(result.duplicate).toBeNull();
    expect(result.newGameState.reportedCurrentGame).toBe(false);
    expect(result.newGameState.activeTrainingTimeMs).toBe(0);
    expect(result.nextGame).not.toBeNull();
    expect(result.reportCount).toBe(2);
  });
});
