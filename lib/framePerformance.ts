export const PERFORMANCE_THRESHOLD_VERSION = "strict-v1";

export const PERFORMANCE_CALIBRATION_MS = 2_000;
export const PERFORMANCE_WINDOW_MS = 5_000;
export const PERFORMANCE_SETTLING_MS = 1_000;
export const PERFORMANCE_REPORT_LIMIT = 3;

const MIN_BASELINE_FRAME_MS = 4;
const MAX_BASELINE_FRAME_MS = 20;
const MIN_AVERAGE_FPS = 55;
const BASELINE_FPS_RATIO = 0.8;
const MIN_P95_FRAME_MS = 25;
const BASELINE_P95_MULTIPLIER = 2.5;
const HITCH_FRAME_MS = 50;
const SEVERE_HITCH_FRAME_MS = 100;
const REPEATED_HITCH_COUNT = 2;

export type StutterReason =
  | "average_fps"
  | "p95_frame_time"
  | "repeated_hitches"
  | "severe_hitch";

export interface FramePerformanceWindow {
  durationMs: number;
  sampleCount: number;
  averageFps: number;
  p95FrameMs: number;
  maxFrameMs: number;
  hitchCount: number;
  severeHitchCount: number;
  longTaskCount: number;
  longTaskTotalMs: number;
  longTaskMaxMs: number;
}

export interface PerformanceReportContext {
  theme: string;
  dpr: number;
  viewportWidth: number;
  viewportHeight: number;
  trainingDurationSeconds: number;
}

export interface FramePerformanceReport extends FramePerformanceWindow {
  thresholdVersion: typeof PERFORMANCE_THRESHOLD_VERSION;
  baselineFrameMs: number;
  baselineFps: number;
  averageFpsThreshold: number;
  p95FrameMsThreshold: number;
  reasons: StutterReason[];
  context: PerformanceReportContext;
}

export interface FramePerformanceResult {
  window: FramePerformanceWindow;
  report: FramePerformanceReport | null;
  queued: boolean;
}

export interface PerformanceMonitorState {
  active: boolean;
  settlingRemainingMs: number;
  baselineFrameMs: number | null;
  baselineFps: number | null;
  calibrationElapsedMs: number;
  windowElapsedMs: number;
  pendingReportCount: number;
  sessionReportCount: number;
  lastResult: FramePerformanceResult | null;
}

function round(value: number, precision = 2) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function percentile(values: number[], ratio: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.floor((sorted.length - 1) * ratio);
  return sorted[index];
}

function isValidDuration(durationMs: number) {
  return Number.isFinite(durationMs) && durationMs > 0;
}

class FramePerformanceAnalyzer {
  private calibrationFrames: number[] = [];
  private calibrationElapsedMs = 0;
  private baselineFrameMs: number | null = null;
  private windowFrames: number[] = [];
  private windowElapsedMs = 0;
  private longTaskCount = 0;
  private longTaskTotalMs = 0;
  private longTaskMaxMs = 0;

  resetGame() {
    this.calibrationFrames = [];
    this.calibrationElapsedMs = 0;
    this.baselineFrameMs = null;
    this.resetWindow();
  }

  resetWindow() {
    this.windowFrames = [];
    this.windowElapsedMs = 0;
    this.longTaskCount = 0;
    this.longTaskTotalMs = 0;
    this.longTaskMaxMs = 0;
  }

  recordLongTask(durationMs: number) {
    if (this.baselineFrameMs === null || !isValidDuration(durationMs)) return;
    this.longTaskCount += 1;
    this.longTaskTotalMs += durationMs;
    this.longTaskMaxMs = Math.max(this.longTaskMaxMs, durationMs);
  }

  recordFrame(
    durationMs: number,
    context: PerformanceReportContext,
  ): Omit<FramePerformanceResult, "queued"> | null {
    if (!isValidDuration(durationMs)) return null;

    if (this.baselineFrameMs === null) {
      this.calibrationFrames.push(durationMs);
      this.calibrationElapsedMs += durationMs;
      if (this.calibrationElapsedMs >= PERFORMANCE_CALIBRATION_MS) {
        const calibratedFrameMs = percentile(this.calibrationFrames, 0.2);
        this.baselineFrameMs = Math.min(
          MAX_BASELINE_FRAME_MS,
          Math.max(MIN_BASELINE_FRAME_MS, calibratedFrameMs),
        );
        this.calibrationFrames = [];
      }
      return null;
    }

    this.windowFrames.push(durationMs);
    this.windowElapsedMs += durationMs;
    if (this.windowElapsedMs < PERFORMANCE_WINDOW_MS) return null;

    const performanceWindow = this.createWindow();
    const report = this.createReport(performanceWindow, context);
    this.resetWindow();
    return { window: performanceWindow, report };
  }

  getState() {
    return {
      baselineFrameMs: this.baselineFrameMs,
      baselineFps:
        this.baselineFrameMs === null ? null : round(1_000 / this.baselineFrameMs),
      calibrationElapsedMs: round(this.calibrationElapsedMs),
      windowElapsedMs: round(this.windowElapsedMs),
    };
  }

  private createWindow(): FramePerformanceWindow {
    const sampleCount = this.windowFrames.length;
    const maxFrameMs = Math.max(...this.windowFrames);
    return {
      durationMs: round(this.windowElapsedMs),
      sampleCount,
      averageFps: round((sampleCount * 1_000) / this.windowElapsedMs),
      p95FrameMs: round(percentile(this.windowFrames, 0.95)),
      maxFrameMs: round(maxFrameMs),
      hitchCount: this.windowFrames.filter((frame) => frame > HITCH_FRAME_MS).length,
      severeHitchCount: this.windowFrames.filter(
        (frame) => frame > SEVERE_HITCH_FRAME_MS,
      ).length,
      longTaskCount: this.longTaskCount,
      longTaskTotalMs: round(this.longTaskTotalMs),
      longTaskMaxMs: round(this.longTaskMaxMs),
    };
  }

  private createReport(
    performanceWindow: FramePerformanceWindow,
    context: PerformanceReportContext,
  ): FramePerformanceReport | null {
    const baselineFrameMs = this.baselineFrameMs!;
    const baselineFps = 1_000 / baselineFrameMs;
    const averageFpsThreshold = Math.max(
      MIN_AVERAGE_FPS,
      baselineFps * BASELINE_FPS_RATIO,
    );
    const p95FrameMsThreshold = Math.max(
      MIN_P95_FRAME_MS,
      baselineFrameMs * BASELINE_P95_MULTIPLIER,
    );
    const reasons: StutterReason[] = [];

    if (performanceWindow.averageFps < averageFpsThreshold) {
      reasons.push("average_fps");
    }
    if (performanceWindow.p95FrameMs > p95FrameMsThreshold) {
      reasons.push("p95_frame_time");
    }
    if (performanceWindow.hitchCount >= REPEATED_HITCH_COUNT) {
      reasons.push("repeated_hitches");
    }
    if (performanceWindow.severeHitchCount > 0) {
      reasons.push("severe_hitch");
    }

    if (reasons.length === 0) return null;

    return {
      ...performanceWindow,
      thresholdVersion: PERFORMANCE_THRESHOLD_VERSION,
      baselineFrameMs: round(baselineFrameMs),
      baselineFps: round(baselineFps),
      averageFpsThreshold: round(averageFpsThreshold),
      p95FrameMsThreshold: round(p95FrameMsThreshold),
      reasons,
      context: { ...context },
    };
  }
}

export class FramePerformanceMonitorCore {
  private readonly analyzer = new FramePerformanceAnalyzer();
  private active = false;
  private skipNextFrame = false;
  private settlingRemainingMs = 0;
  private pendingReports: FramePerformanceReport[] = [];
  private sessionReportCount = 0;
  private lastResult: FramePerformanceResult | null = null;

  startGame() {
    const pending = this.drainReports();
    this.analyzer.resetGame();
    this.lastResult = null;
    if (this.active) this.beginSettling();
    return pending;
  }

  setActive(active: boolean) {
    if (this.active === active) return [];
    this.active = active;
    this.analyzer.resetWindow();
    if (active) {
      this.beginSettling();
      return [];
    }
    this.skipNextFrame = false;
    this.settlingRemainingMs = 0;
    return this.drainReports();
  }

  restartWindow() {
    this.analyzer.resetWindow();
    if (this.active) this.beginSettling();
  }

  recordFrame(durationMs: number, context: PerformanceReportContext) {
    if (!this.active || !isValidDuration(durationMs)) return null;
    if (this.skipNextFrame) {
      this.skipNextFrame = false;
      return null;
    }
    if (this.settlingRemainingMs > 0) {
      this.settlingRemainingMs = Math.max(
        0,
        this.settlingRemainingMs - durationMs,
      );
      return null;
    }

    const result = this.analyzer.recordFrame(durationMs, context);
    if (!result) return null;

    let queued = false;
    if (
      result.report &&
      this.sessionReportCount < PERFORMANCE_REPORT_LIMIT
    ) {
      this.pendingReports.push(result.report);
      this.sessionReportCount += 1;
      queued = true;
    }

    this.lastResult = { ...result, queued };
    return this.lastResult;
  }

  recordLongTask(durationMs: number) {
    if (!this.active || this.skipNextFrame || this.settlingRemainingMs > 0) return;
    this.analyzer.recordLongTask(durationMs);
  }

  drainReports() {
    const reports = this.pendingReports.map((report) => ({
      ...report,
      reasons: [...report.reasons],
      context: { ...report.context },
    }));
    this.pendingReports = [];
    return reports;
  }

  getPendingReports() {
    return this.pendingReports.map((report) => ({
      ...report,
      reasons: [...report.reasons],
      context: { ...report.context },
    }));
  }

  getState(): PerformanceMonitorState {
    const analyzerState = this.analyzer.getState();
    return {
      active: this.active,
      settlingRemainingMs: round(this.settlingRemainingMs),
      ...analyzerState,
      pendingReportCount: this.pendingReports.length,
      sessionReportCount: this.sessionReportCount,
      lastResult: this.lastResult
        ? {
            ...this.lastResult,
            window: { ...this.lastResult.window },
            report: this.lastResult.report
              ? {
                  ...this.lastResult.report,
                  reasons: [...this.lastResult.report.reasons],
                  context: { ...this.lastResult.report.context },
                }
              : null,
          }
        : null,
    };
  }

  resetSession() {
    this.active = false;
    this.skipNextFrame = false;
    this.settlingRemainingMs = 0;
    this.pendingReports = [];
    this.sessionReportCount = 0;
    this.lastResult = null;
    this.analyzer.resetGame();
  }

  private beginSettling() {
    this.skipNextFrame = true;
    this.settlingRemainingMs = PERFORMANCE_SETTLING_MS;
  }
}
