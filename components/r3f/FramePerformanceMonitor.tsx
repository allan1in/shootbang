"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  PerformanceMonitor,
  type PerformanceMonitorApi,
} from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as Sentry from "@sentry/nextjs";
import {
  PERFORMANCE_MONITOR_CONFIG,
  PERFORMANCE_SENTRY_FINGERPRINT,
  PERFORMANCE_SENTRY_MESSAGE_PREFIX,
  createPerformanceSentryEvent,
  gatePerformanceDecline,
  getPerformanceBounds,
  shouldMonitorPerformance,
  type PerformanceDeclineReport,
  type PerformanceMonitorEligibility,
  type PerformanceReportContext,
  type PerformanceSampleSnapshot,
  type PerformanceSentryEvent,
} from "@/lib/performanceMonitoring";
import {
  useGameStore,
  useSettingsStore,
  useThemeStore,
} from "@/stores/gameStore";

interface MemoryCapture {
  report: PerformanceDeclineReport;
  event: PerformanceSentryEvent;
}

interface RuntimeMonitorState {
  active: boolean;
  gameSessionId: number;
  samplingGeneration: number;
}

const DEVELOPMENT_CONTEXT: Omit<
  PerformanceReportContext,
  "activeTrainingTimeMs"
> = {
  theme: "default",
  dpr: 1,
  viewportWidth: 1280,
  viewportHeight: 720,
  trainingDurationSeconds: 30,
};

function copyReport(report: PerformanceDeclineReport) {
  return { ...report, context: { ...report.context } };
}

function copyEvent(event: PerformanceSentryEvent) {
  return {
    ...event,
    fingerprint: [...event.fingerprint],
    tags: { ...event.tags },
    contexts: {
      game_performance: { ...event.contexts.game_performance },
      game_environment: { ...event.contexts.game_environment },
    },
  };
}

function createDevelopmentTestApi(
  captures: MemoryCapture[],
  getRuntimeState: () => RuntimeMonitorState,
) {
  let gameSessionId = 0;
  let reportedGameSessionId: number | null = null;
  let active = false;
  let activeTrainingTimeMs = 0;
  let samplingGeneration = 0;

  const simulateDecline = ({
    fps,
    refreshrate,
    averages,
  }: {
    fps: number;
    refreshrate: number;
    averages: number[];
  }) => {
    const sample: PerformanceSampleSnapshot = {
      latestFps: fps,
      observedPeakFps: refreshrate,
      averages: [...averages],
    };
    const result = gatePerformanceDecline({
      active,
      gameSessionId,
      reportedGameSessionId,
      sample,
      context: { ...DEVELOPMENT_CONTEXT, activeTrainingTimeMs },
    });
    reportedGameSessionId = result.reportedGameSessionId;
    if (!result.report) return null;

    captures.push({
      report: result.report,
      event: createPerformanceSentryEvent(result.report),
    });
    return copyReport(result.report);
  };

  return {
    reset: () => {
      gameSessionId = 0;
      reportedGameSessionId = null;
      active = false;
      activeTrainingTimeMs = 0;
      samplingGeneration = 0;
      captures.length = 0;
    },
    startGame: () => {
      gameSessionId += 1;
      active = false;
      activeTrainingTimeMs = 0;
      return gameSessionId;
    },
    setActive: (nextActive: boolean) => {
      active = nextActive;
    },
    advanceActiveTime: (durationMs: number) => {
      if (active && Number.isFinite(durationMs) && durationMs > 0) {
        activeTrainingTimeMs += durationMs;
      }
    },
    restartSampling: () => {
      samplingGeneration += 1;
    },
    simulateDecline,
    getBounds: (observedPeakFps: number) =>
      getPerformanceBounds(observedPeakFps),
    canMonitor: (eligibility: PerformanceMonitorEligibility) =>
      shouldMonitorPerformance(eligibility),
    getState: () => ({
      active,
      gameSessionId,
      reportedCurrentGame:
        gameSessionId > 0 && reportedGameSessionId === gameSessionId,
      samplingGeneration,
      activeTrainingTimeMs,
    }),
    getRuntimeState: () => ({ ...getRuntimeState() }),
    getReports: () => captures.map(({ report }) => copyReport(report)),
    getCapturedEvents: () => captures.map(({ event }) => copyEvent(event)),
    getMonitorConfig: () => ({ ...PERFORMANCE_MONITOR_CONFIG }),
    getSentryConfig: () => ({
      messagePrefix: PERFORMANCE_SENTRY_MESSAGE_PREFIX,
      fingerprint: PERFORMANCE_SENTRY_FINGERPRINT,
      customPerformanceBreadcrumbs: false,
    }),
  };
}

function capturePerformanceEvent(
  report: PerformanceDeclineReport,
  developmentCaptures: MemoryCapture[],
) {
  const event = createPerformanceSentryEvent(report);
  if (process.env.NODE_ENV !== "production") {
    developmentCaptures.push({ report, event });
    return;
  }

  Sentry.captureEvent({
    message: event.message,
    level: event.level,
    fingerprint: event.fingerprint,
    tags: event.tags,
    contexts: event.contexts,
  });
}

function snapshotPerformanceApi(
  api: PerformanceMonitorApi,
): PerformanceSampleSnapshot {
  return {
    latestFps: api.fps,
    observedPeakFps: api.refreshrate,
    averages: [...api.averages],
  };
}

export function FramePerformanceMonitor({
  gameSessionId,
  timeLeftRef,
}: {
  gameSessionId: number;
  timeLeftRef: RefObject<number>;
}) {
  const gameState = useGameStore((state) => state.gameState);
  const isPaused = useGameStore((state) => state.isPaused);
  const isLocked = useGameStore((state) => state.isLocked);
  const countdown = useGameStore((state) => state.countdown);
  const gl = useThree((state) => state.gl);
  const canvas = gl.domElement;
  const [isPageVisible, setIsPageVisible] = useState(() =>
    typeof document === "undefined"
      ? true
      : document.visibilityState === "visible",
  );
  const [isWindowFocused, setIsWindowFocused] = useState(() =>
    typeof document === "undefined" ? true : document.hasFocus(),
  );
  const [isContextAvailable, setIsContextAvailable] = useState(true);
  const isContextAvailableRef = useRef(true);
  const [samplingGeneration, setSamplingGeneration] = useState(0);
  const reportedGameSessionIdRef = useRef<number | null>(null);
  const developmentCapturesRef = useRef<MemoryCapture[]>([]);
  const runtimeStateRef = useRef<RuntimeMonitorState>({
    active: false,
    gameSessionId,
    samplingGeneration: 0,
  });

  const active = shouldMonitorPerformance({
    gameState,
    isPaused,
    countdown,
    isLocked,
    isPageVisible,
    isWindowFocused,
    isContextAvailable,
  });

  const restartSampling = useCallback(() => {
    setSamplingGeneration((generation) => generation + 1);
  }, []);

  const handleDecline = useCallback(
    (api: PerformanceMonitorApi) => {
      const currentGameState = useGameStore.getState();
      const currentlyActive = shouldMonitorPerformance({
        gameState: currentGameState.gameState,
        isPaused: currentGameState.isPaused,
        countdown: currentGameState.countdown,
        isLocked: currentGameState.isLocked,
        isPageVisible: document.visibilityState === "visible",
        isWindowFocused: document.hasFocus(),
        isContextAvailable: isContextAvailableRef.current,
      });
      const duration = useSettingsStore.getState().duration;
      const activeTrainingTimeMs = Math.min(
        duration * 1_000,
        Math.max(0, (duration - timeLeftRef.current) * 1_000),
      );
      const context: PerformanceReportContext = {
        theme: useThemeStore.getState().theme,
        dpr: gl.getPixelRatio(),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        trainingDurationSeconds: duration,
        activeTrainingTimeMs,
      };
      const result = gatePerformanceDecline({
        active: currentlyActive,
        gameSessionId,
        reportedGameSessionId: reportedGameSessionIdRef.current,
        sample: snapshotPerformanceApi(api),
        context,
      });

      reportedGameSessionIdRef.current = result.reportedGameSessionId;
      if (result.report) {
        capturePerformanceEvent(
          result.report,
          developmentCapturesRef.current,
        );
      }
    },
    [gameSessionId, gl, timeLeftRef],
  );

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageVisible(document.visibilityState === "visible");
    };
    const handleFocus = () => setIsWindowFocused(true);
    const handleBlur = () => setIsWindowFocused(false);

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  useEffect(() => {
    window.addEventListener("resize", restartSampling);
    return () => window.removeEventListener("resize", restartSampling);
  }, [restartSampling]);

  useEffect(() => {
    let query = window.matchMedia(
      `(resolution: ${window.devicePixelRatio}dppx)`,
    );
    const handleDprChange = () => {
      query.removeEventListener("change", handleDprChange);
      restartSampling();
      query = window.matchMedia(
        `(resolution: ${window.devicePixelRatio}dppx)`,
      );
      query.addEventListener("change", handleDprChange);
    };

    query.addEventListener("change", handleDprChange);
    return () => query.removeEventListener("change", handleDprChange);
  }, [restartSampling]);

  useEffect(() => {
    const handleContextLost = () => {
      isContextAvailableRef.current = false;
      setIsContextAvailable(false);
    };
    const handleContextRestored = () => {
      isContextAvailableRef.current = true;
      setIsContextAvailable(true);
    };
    canvas.addEventListener("webglcontextlost", handleContextLost);
    canvas.addEventListener("webglcontextrestored", handleContextRestored);
    return () => {
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", handleContextRestored);
    };
  }, [canvas]);

  useEffect(() => {
    runtimeStateRef.current = {
      active,
      gameSessionId,
      samplingGeneration,
    };
  }, [active, gameSessionId, samplingGeneration]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const testWindow = window as typeof window & {
      __shootbang_performance_test?: ReturnType<
        typeof createDevelopmentTestApi
      >;
    };
    const api = createDevelopmentTestApi(
      developmentCapturesRef.current,
      () => runtimeStateRef.current,
    );
    testWindow.__shootbang_performance_test = api;
    return () => {
      if (testWindow.__shootbang_performance_test === api) {
        delete testWindow.__shootbang_performance_test;
      }
    };
  }, []);

  if (!active) return null;

  return (
    <PerformanceMonitor
      key={`${gameSessionId}:${samplingGeneration}`}
      ms={PERFORMANCE_MONITOR_CONFIG.ms}
      iterations={PERFORMANCE_MONITOR_CONFIG.iterations}
      threshold={PERFORMANCE_MONITOR_CONFIG.threshold}
      bounds={getPerformanceBounds}
      onDecline={handleDecline}
    />
  );
}
