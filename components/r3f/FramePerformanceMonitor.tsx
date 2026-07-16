"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as Sentry from "@sentry/nextjs";
import {
  FramePerformanceMonitorCore,
  type FramePerformanceReport,
  type PerformanceReportContext,
} from "@/lib/framePerformance";
import {
  useGameStore,
  useSettingsStore,
  useThemeStore,
} from "@/stores/gameStore";

const SENTRY_MESSAGE = "Game render stutter detected";
const SENTRY_FINGERPRINT = "shootbang-game-stutter-v1";

function getReportContext(): PerformanceReportContext {
  return {
    theme: useThemeStore.getState().theme,
    dpr: window.devicePixelRatio,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    trainingDurationSeconds: useSettingsStore.getState().duration,
  };
}

function reportToSentry(report: FramePerformanceReport) {
  if (process.env.NODE_ENV !== "production") return;

  Sentry.withScope((scope) => {
    scope.setLevel("warning");
    scope.setFingerprint([SENTRY_FINGERPRINT]);
    scope.setTag("component", "game-render-loop");
    scope.setTag("threshold_version", report.thresholdVersion);
    scope.setTag("theme", report.context.theme);
    scope.setTag("stutter_reasons", report.reasons.join(","));
    scope.setContext("game_performance", {
      baseline_fps: report.baselineFps,
      baseline_frame_ms: report.baselineFrameMs,
      average_fps: report.averageFps,
      average_fps_threshold: report.averageFpsThreshold,
      p95_frame_ms: report.p95FrameMs,
      p95_frame_ms_threshold: report.p95FrameMsThreshold,
      max_frame_ms: report.maxFrameMs,
      hitch_count: report.hitchCount,
      severe_hitch_count: report.severeHitchCount,
      long_task_count: report.longTaskCount,
      long_task_total_ms: report.longTaskTotalMs,
      long_task_max_ms: report.longTaskMaxMs,
      window_duration_ms: report.durationMs,
      sample_count: report.sampleCount,
      reasons: report.reasons.join(","),
    });
    scope.setContext("game_environment", {
      theme: report.context.theme,
      dpr: report.context.dpr,
      viewport_width: report.context.viewportWidth,
      viewport_height: report.context.viewportHeight,
      training_duration_seconds: report.context.trainingDurationSeconds,
    });
    Sentry.captureMessage(SENTRY_MESSAGE);
  });
}

function addPerformanceBreadcrumb(report: FramePerformanceReport) {
  if (process.env.NODE_ENV !== "production") return;

  Sentry.addBreadcrumb({
    category: "game.performance",
    message: SENTRY_MESSAGE,
    level: "warning",
    data: {
      threshold_version: report.thresholdVersion,
      reasons: report.reasons.join(","),
      baseline_fps: report.baselineFps,
      average_fps: report.averageFps,
      p95_frame_ms: report.p95FrameMs,
      max_frame_ms: report.maxFrameMs,
      hitch_count: report.hitchCount,
      severe_hitch_count: report.severeHitchCount,
    },
  });
}

function createDevelopmentTestApi() {
  const core = new FramePerformanceMonitorCore();
  const sentReports: FramePerformanceReport[] = [];
  let breadcrumbCount = 0;
  const context: PerformanceReportContext = {
    theme: "default",
    dpr: 1,
    viewportWidth: 1280,
    viewportHeight: 720,
    trainingDurationSeconds: 30,
  };

  const collectReports = (reports: FramePerformanceReport[]) => {
    sentReports.push(...reports);
    return reports;
  };

  return {
    reset: () => {
      core.resetSession();
      sentReports.length = 0;
      breadcrumbCount = 0;
    },
    startGame: () => collectReports(core.startGame()),
    setActive: (active: boolean) => collectReports(core.setActive(active)),
    restartWindow: () => core.restartWindow(),
    injectFrames: (durationsMs: number[]) => {
      const results = [];
      for (const durationMs of durationsMs) {
        const result = core.recordFrame(durationMs, context);
        if (result) {
          results.push(result);
          if (result.report) breadcrumbCount += 1;
        }
      }
      return results;
    },
    injectLongTask: (durationMs: number) => core.recordLongTask(durationMs),
    flush: () => collectReports(core.drainReports()),
    getState: () => core.getState(),
    getPendingReports: () => core.getPendingReports(),
    getSentReports: () => sentReports.map((report) => ({
      ...report,
      reasons: [...report.reasons],
      context: { ...report.context },
    })),
    getBreadcrumbCount: () => breadcrumbCount,
    getSentryConfig: () => ({
      message: SENTRY_MESSAGE,
      fingerprint: SENTRY_FINGERPRINT,
    }),
  };
}

export function FramePerformanceMonitor({
  gameSessionId,
}: {
  gameSessionId: number;
}) {
  const [core] = useState(() => new FramePerformanceMonitorCore());
  const lastDprRef = useRef(
    typeof window === "undefined" ? 1 : window.devicePixelRatio,
  );
  const gameState = useGameStore((state) => state.gameState);
  const isPaused = useGameStore((state) => state.isPaused);
  const isLocked = useGameStore((state) => state.isLocked);
  const countdown = useGameStore((state) => state.countdown);
  const canvas = useThree((state) => state.gl.domElement);
  const [isPageVisible, setIsPageVisible] = useState(() =>
    typeof document === "undefined" ? true : document.visibilityState === "visible",
  );
  const [isWindowFocused, setIsWindowFocused] = useState(() =>
    typeof document === "undefined" ? true : document.hasFocus(),
  );
  const [isContextAvailable, setIsContextAvailable] = useState(true);

  const flushReports = useCallback((reports: FramePerformanceReport[]) => {
    for (const report of reports) reportToSentry(report);
  }, []);

  const active =
    gameState === "playing" &&
    !isPaused &&
    isLocked &&
    countdown === null &&
    isPageVisible &&
    isWindowFocused &&
    isContextAvailable;

  useEffect(() => {
    flushReports(core.startGame());
  }, [core, flushReports, gameSessionId]);

  useEffect(() => {
    flushReports(core.setActive(active));
  }, [active, core, flushReports]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageVisible(document.visibilityState === "visible");
    };
    const handleFocus = () => setIsWindowFocused(true);
    const handleBlur = () => setIsWindowFocused(false);
    const handleResize = () => core.restartWindow();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("resize", handleResize);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("resize", handleResize);
    };
  }, [core]);

  useEffect(() => {
    const handleContextLost = () => setIsContextAvailable(false);
    const handleContextRestored = () => setIsContextAvailable(true);
    canvas.addEventListener("webglcontextlost", handleContextLost);
    canvas.addEventListener("webglcontextrestored", handleContextRestored);
    return () => {
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", handleContextRestored);
    };
  }, [canvas]);

  useEffect(() => {
    if (
      typeof PerformanceObserver === "undefined" ||
      !PerformanceObserver.supportedEntryTypes?.includes("longtask")
    ) {
      return;
    }

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        core.recordLongTask(entry.duration);
      }
    });
    observer.observe({ entryTypes: ["longtask"] });
    return () => observer.disconnect();
  }, [core]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const testWindow = window as typeof window & {
      __shootbang_performance_test?: ReturnType<typeof createDevelopmentTestApi>;
    };
    testWindow.__shootbang_performance_test = createDevelopmentTestApi();
    return () => {
      delete testWindow.__shootbang_performance_test;
    };
  }, []);

  useFrame((_, delta) => {
    if (lastDprRef.current !== window.devicePixelRatio) {
      lastDprRef.current = window.devicePixelRatio;
      core.restartWindow();
      return;
    }
    const result = core.recordFrame(delta * 1_000, getReportContext());
    if (result?.report) addPerformanceBreadcrumb(result.report);
  });

  return null;
}
