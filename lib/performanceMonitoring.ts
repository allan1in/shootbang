export const PERFORMANCE_MONITOR_CONFIG = {
  ms: 250,
  iterations: 10,
  threshold: 0.75,
  lowerBoundRatio: 0.8,
  upperBoundRatio: 0.9,
  version: "drei-simple-v1",
} as const;

export const PERFORMANCE_SENTRY_FINGERPRINT =
  "shootbang-performance-decline-v1";
export const PERFORMANCE_SENTRY_MESSAGE_PREFIX =
  "Game performance decline detected";

export interface PerformanceMonitorEligibility {
  gameState: string;
  isPaused: boolean;
  countdown: number | null;
  isLocked: boolean;
  isPageVisible: boolean;
  isWindowFocused: boolean;
  isContextAvailable: boolean;
}

export interface PerformanceSampleSnapshot {
  observedPeakFps: number;
  latestFps: number;
  averages: readonly number[];
}

export interface PerformanceReportContext {
  theme: string;
  dpr: number;
  viewportWidth: number;
  viewportHeight: number;
  trainingDurationSeconds: number;
  activeTrainingTimeMs: number;
}

export interface PerformanceDeclineReport {
  monitorVersion: typeof PERFORMANCE_MONITOR_CONFIG.version;
  gameSessionId: number;
  observedPeakFps: number;
  averageFps: number;
  latestFps: number;
  declineRatio: number;
  declineThresholdFps: number;
  sampleDurationMs: number;
  sampleCount: number;
  context: PerformanceReportContext;
}

export interface PerformanceSentryEvent {
  message: string;
  level: "warning";
  fingerprint: string[];
  tags: {
    monitor_version: typeof PERFORMANCE_MONITOR_CONFIG.version;
    theme: string;
    component: "game-render-loop";
  };
  contexts: {
    game_performance: Record<string, number | string>;
    game_environment: Record<string, number | string>;
  };
}

export interface PerformanceDeclineGateResult {
  reportedGameSessionId: number | null;
  report: PerformanceDeclineReport | null;
}

function round(value: number, precision = 2) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function shouldMonitorPerformance(
  eligibility: PerformanceMonitorEligibility,
) {
  return (
    eligibility.gameState === "playing" &&
    !eligibility.isPaused &&
    eligibility.countdown === null &&
    eligibility.isLocked &&
    eligibility.isPageVisible &&
    eligibility.isWindowFocused &&
    eligibility.isContextAvailable
  );
}

export function getPerformanceBounds(
  observedPeakFps: number,
): [lower: number, upper: number] {
  const peakFps = Math.max(0, observedPeakFps);
  return [
    round(peakFps * PERFORMANCE_MONITOR_CONFIG.lowerBoundRatio),
    round(peakFps * PERFORMANCE_MONITOR_CONFIG.upperBoundRatio),
  ];
}

export function createPerformanceDeclineReport(
  sample: PerformanceSampleSnapshot,
  context: PerformanceReportContext,
  gameSessionId: number,
): PerformanceDeclineReport {
  const averages = sample.averages.filter(
    (fps) => Number.isFinite(fps) && fps >= 0,
  );
  const sampleCount = averages.length;
  const averageFps = sampleCount
    ? averages.reduce((sum, fps) => sum + fps, 0) / sampleCount
    : Math.max(0, sample.latestFps);
  const observedPeakFps = Math.max(0, sample.observedPeakFps);
  const declineRatio = observedPeakFps
    ? Math.min(1, Math.max(0, (observedPeakFps - averageFps) / observedPeakFps))
    : 0;

  return {
    monitorVersion: PERFORMANCE_MONITOR_CONFIG.version,
    gameSessionId,
    observedPeakFps: round(observedPeakFps),
    averageFps: round(averageFps),
    latestFps: round(Math.max(0, sample.latestFps)),
    declineRatio: round(declineRatio, 4),
    declineThresholdFps: getPerformanceBounds(observedPeakFps)[0],
    sampleDurationMs: sampleCount * PERFORMANCE_MONITOR_CONFIG.ms,
    sampleCount,
    context: {
      theme: context.theme,
      dpr: round(context.dpr),
      viewportWidth: context.viewportWidth,
      viewportHeight: context.viewportHeight,
      trainingDurationSeconds: context.trainingDurationSeconds,
      activeTrainingTimeMs: round(context.activeTrainingTimeMs),
    },
  };
}

export function gatePerformanceDecline({
  active,
  gameSessionId,
  reportedGameSessionId,
  sample,
  context,
}: {
  active: boolean;
  gameSessionId: number;
  reportedGameSessionId: number | null;
  sample: PerformanceSampleSnapshot;
  context: PerformanceReportContext;
}): PerformanceDeclineGateResult {
  if (
    !active ||
    gameSessionId <= 0 ||
    reportedGameSessionId === gameSessionId
  ) {
    return { reportedGameSessionId, report: null };
  }

  return {
    reportedGameSessionId: gameSessionId,
    report: createPerformanceDeclineReport(sample, context, gameSessionId),
  };
}

export function createPerformanceSentryEvent(
  report: PerformanceDeclineReport,
): PerformanceSentryEvent {
  return {
    message: `${PERFORMANCE_SENTRY_MESSAGE_PREFIX} [game ${report.gameSessionId}]`,
    level: "warning",
    fingerprint: [PERFORMANCE_SENTRY_FINGERPRINT],
    tags: {
      monitor_version: report.monitorVersion,
      theme: report.context.theme,
      component: "game-render-loop",
    },
    contexts: {
      game_performance: {
        game_number: report.gameSessionId,
        observed_peak_fps: report.observedPeakFps,
        average_fps: report.averageFps,
        latest_fps: report.latestFps,
        decline_ratio: report.declineRatio,
        decline_threshold_fps: report.declineThresholdFps,
        sample_duration_ms: report.sampleDurationMs,
        sample_count: report.sampleCount,
        active_training_time_ms: report.context.activeTrainingTimeMs,
      },
      game_environment: {
        theme: report.context.theme,
        dpr: report.context.dpr,
        viewport_width: report.context.viewportWidth,
        viewport_height: report.context.viewportHeight,
        training_duration_seconds: report.context.trainingDurationSeconds,
      },
    },
  };
}
