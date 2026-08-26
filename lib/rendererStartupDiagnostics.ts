import * as Sentry from "@sentry/nextjs";

export const RENDERER_STARTUP_MONITOR_VERSION = "renderer-startup-v3";

export type RendererStartupStage =
  | "startup-started"
  | "device-check-completed"
  | "webgl2-check-started"
  | "webgl2-check-completed"
  | "gameboard-import-started"
  | "gameboard-import-completed"
  | "gameboard-mounted"
  | "canvas-render-started"
  | "renderer-created";

export type RendererStartupFailureStage =
  | "webgl2-check"
  | "gameboard-import"
  | "react-render";

export type RendererStartupSlowStage =
  | "gameboard-import-slow"
  | "renderer-creation-slow";

export interface WebGLStartupDiagnostics {
  hasWebGL2Constructor: boolean;
  contextCreated: boolean;
  checkDurationMs: number;
  vendor?: string;
  renderer?: string;
  softwareRenderer: boolean;
  errorName?: string;
  errorMessage?: string;
  cached?: boolean;
}

interface StartupFailureDetails {
  stage: RendererStartupFailureStage;
  errorName?: string;
  errorMessage?: string;
}

interface LifecycleState {
  visibility: DocumentVisibilityState;
  focused: boolean;
  online: boolean;
  hiddenCount: number;
  blurCount: number;
  hiddenDurationMs: number;
  unfocusedDurationMs: number;
  visibleDurationMs: number;
  activeDurationMs: number;
  lastUpdatedAt: number;
}

export interface RendererStartupDiagnosticsSnapshot {
  monitorVersion: typeof RENDERER_STARTUP_MONITOR_VERSION;
  attemptId: string;
  elapsedMs: number;
  visibleElapsedMs: number;
  activeElapsedMs: number;
  lastCompletedStage: RendererStartupStage;
  stages: Partial<Record<RendererStartupStage, number>>;
  failure?: StartupFailureDetails;
  pageLifecycle: {
    visibility: DocumentVisibilityState;
    focused: boolean;
    online: boolean;
    readyState: DocumentReadyState;
    hiddenCount: number;
    blurCount: number;
    hiddenDurationMs: number;
    unfocusedDurationMs: number;
    visibleDurationMs: number;
  };
  rendererState: {
    rootExists: boolean;
    canvasExists: boolean;
    rendererCreated: boolean;
  };
  webgl?: WebGLStartupDiagnostics;
  device: {
    devicePixelRatio: number;
    viewportWidth: number;
    viewportHeight: number;
    screenWidth: number;
    screenHeight: number;
    hardwareConcurrency?: number;
    deviceMemoryGb?: number;
  };
  network: {
    effectiveType?: string;
    rttMs?: number;
    downlinkMbps?: number;
    saveData?: boolean;
  };
  resources: {
    navigationType?: string;
    scriptCount: number;
    totalScriptTransferBytes: number;
    slowestScriptPath?: string;
    slowestScriptDurationMs?: number;
  };
}

interface RendererStartupAttempt {
  attemptId: string;
  startedAt: number;
  lastCompletedStage: RendererStartupStage;
  stages: Partial<Record<RendererStartupStage, number>>;
  lifecycle: LifecycleState;
  webgl?: WebGLStartupDiagnostics;
  failure?: StartupFailureDetails;
  reported: boolean;
  slowReportedStages: Set<RendererStartupSlowStage>;
  removeLifecycleListeners?: () => void;
}

type RendererStartupStageListener = (stage: RendererStartupStage) => void;

interface NavigatorWithDiagnostics extends Navigator {
  connection?: {
    effectiveType?: string;
    rtt?: number;
    downlink?: number;
    saveData?: boolean;
  };
  deviceMemory?: number;
}

let currentAttempt: RendererStartupAttempt | null = null;
const stageListeners = new Set<RendererStartupStageListener>();

function now() {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

function roundMs(value: number) {
  return Math.round(Math.max(0, value) * 10) / 10;
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

export function sanitizeRendererStartupText(
  value: unknown,
  maxLength = 200,
) {
  if (typeof value !== "string") return undefined;
  return value.replace(/[\r\n\t]+/g, " ").trim().slice(0, maxLength) || undefined;
}

export function isSoftwareWebGLRenderer(renderer?: string) {
  return Boolean(renderer && /swiftshader|llvmpipe|software/i.test(renderer));
}

function createAttemptId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function updateLifecycleDurations(
  lifecycle: LifecycleState,
  timestamp: number,
) {
  const duration = Math.max(0, timestamp - lifecycle.lastUpdatedAt);
  if (lifecycle.visibility === "hidden") {
    lifecycle.hiddenDurationMs += duration;
  }
  if (!lifecycle.focused) {
    lifecycle.unfocusedDurationMs += duration;
  }
  if (lifecycle.visibility === "visible") {
    lifecycle.visibleDurationMs += duration;
  }
  if (lifecycle.visibility === "visible" && lifecycle.focused) {
    lifecycle.activeDurationMs += duration;
  }
  lifecycle.lastUpdatedAt = timestamp;
}

function installLifecycleListeners(attempt: RendererStartupAttempt) {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const refreshState = () => {
    if (currentAttempt !== attempt) return;

    const timestamp = now();
    updateLifecycleDurations(attempt.lifecycle, timestamp);

    const visibility = document.visibilityState;
    const focused = document.hasFocus();
    if (
      attempt.lifecycle.visibility !== "hidden" &&
      visibility === "hidden"
    ) {
      attempt.lifecycle.hiddenCount += 1;
    }
    if (attempt.lifecycle.focused && !focused) {
      attempt.lifecycle.blurCount += 1;
    }

    attempt.lifecycle.visibility = visibility;
    attempt.lifecycle.focused = focused;
    attempt.lifecycle.online = navigator.onLine;
  };

  document.addEventListener("visibilitychange", refreshState);
  window.addEventListener("focus", refreshState);
  window.addEventListener("blur", refreshState);
  window.addEventListener("online", refreshState);
  window.addEventListener("offline", refreshState);

  attempt.removeLifecycleListeners = () => {
    document.removeEventListener("visibilitychange", refreshState);
    window.removeEventListener("focus", refreshState);
    window.removeEventListener("blur", refreshState);
    window.removeEventListener("online", refreshState);
    window.removeEventListener("offline", refreshState);
  };
}

function stopAttempt(attempt: RendererStartupAttempt) {
  attempt.removeLifecycleListeners?.();
  attempt.removeLifecycleListeners = undefined;
  if (currentAttempt === attempt) currentAttempt = null;
}

export function startRendererStartupAttempt() {
  if (currentAttempt) return currentAttempt.attemptId;

  const startedAt = now();
  const visibility =
    typeof document === "undefined" ? "visible" : document.visibilityState;
  const focused =
    typeof document === "undefined" ? true : document.hasFocus();
  const online = typeof navigator === "undefined" ? true : navigator.onLine;

  const attempt: RendererStartupAttempt = {
    attemptId: createAttemptId(),
    startedAt,
    lastCompletedStage: "startup-started",
    stages: { "startup-started": 0 },
    lifecycle: {
      visibility,
      focused,
      online,
      hiddenCount: 0,
      blurCount: 0,
      hiddenDurationMs: 0,
      unfocusedDurationMs: 0,
      visibleDurationMs: 0,
      activeDurationMs: 0,
      lastUpdatedAt: startedAt,
    },
    reported: false,
    slowReportedStages: new Set(),
  };

  currentAttempt = attempt;
  installLifecycleListeners(attempt);
  Sentry.addBreadcrumb({
    category: "renderer.startup",
    level: "info",
    message: "startup-started",
    data: { elapsed_ms: 0 },
  });

  return attempt.attemptId;
}

export function markRendererStartupStage(stage: RendererStartupStage) {
  const attempt = currentAttempt;
  if (!attempt || attempt.stages[stage] !== undefined) return;

  const elapsedMs = roundMs(now() - attempt.startedAt);
  attempt.stages[stage] = elapsedMs;
  attempt.lastCompletedStage = stage;
  Sentry.addBreadcrumb({
    category: "renderer.startup",
    level: "info",
    message: stage,
    data: { elapsed_ms: elapsedMs },
  });
  stageListeners.forEach((listener) => listener(stage));
}

export function subscribeRendererStartupStages(
  listener: RendererStartupStageListener,
) {
  stageListeners.add(listener);
  return () => {
    stageListeners.delete(listener);
  };
}

export function getRendererStartupSlowStage(
  stage: RendererStartupStage,
): RendererStartupSlowStage | null {
  if (stage === "renderer-created") return null;
  if (
    stage === "gameboard-import-completed" ||
    stage === "gameboard-mounted" ||
    stage === "canvas-render-started"
  ) {
    return "renderer-creation-slow";
  }
  return "gameboard-import-slow";
}

export function recordWebGLStartupDiagnostics(
  diagnostics: WebGLStartupDiagnostics,
) {
  if (!currentAttempt) return;
  currentAttempt.webgl = {
    ...diagnostics,
    vendor: sanitizeRendererStartupText(diagnostics.vendor),
    renderer: sanitizeRendererStartupText(diagnostics.renderer),
    errorName: sanitizeRendererStartupText(diagnostics.errorName, 80),
    errorMessage: sanitizeRendererStartupText(diagnostics.errorMessage),
  };
}

export function markRendererStartupFailure(
  stage: RendererStartupFailureStage,
  error?: unknown,
) {
  const attempt = currentAttempt;
  if (!attempt || attempt.failure) return;

  const errorValue = error instanceof Error ? error : undefined;
  attempt.failure = {
    stage,
    errorName: sanitizeRendererStartupText(errorValue?.name, 80),
    errorMessage: sanitizeRendererStartupText(errorValue?.message),
  };
  Sentry.addBreadcrumb({
    category: "renderer.startup",
    level: "error",
    message: stage,
    data: {
      elapsed_ms: roundMs(now() - attempt.startedAt),
      error_name: attempt.failure.errorName,
    },
  });
}

function getResourceDiagnostics() {
  if (typeof performance === "undefined" || typeof location === "undefined") {
    return {
      scriptCount: 0,
      totalScriptTransferBytes: 0,
    };
  }

  const scripts = (performance.getEntriesByType("resource") as PerformanceResourceTiming[])
    .filter((entry) => entry.initiatorType === "script")
    .flatMap((entry) => {
      try {
        const url = new URL(entry.name, location.href);
        if (url.origin !== location.origin) return [];
        return [{ entry, path: url.pathname.slice(0, 240) }];
      } catch {
        return [];
      }
    });
  const slowest = scripts.reduce<(typeof scripts)[number] | undefined>(
    (current, item) =>
      !current || item.entry.duration > current.entry.duration ? item : current,
    undefined,
  );
  const navigation = performance.getEntriesByType(
    "navigation",
  )[0] as PerformanceNavigationTiming | undefined;

  return {
    navigationType: sanitizeRendererStartupText(navigation?.type, 40),
    scriptCount: scripts.length,
    totalScriptTransferBytes: scripts.reduce(
      (total, item) => total + Math.max(0, item.entry.transferSize || 0),
      0,
    ),
    slowestScriptPath: slowest?.path,
    slowestScriptDurationMs:
      slowest && roundMs(slowest.entry.duration),
  };
}

export function getRendererStartupDiagnosticsSnapshot(): RendererStartupDiagnosticsSnapshot | null {
  const attempt = currentAttempt;
  if (!attempt) return null;

  const timestamp = now();
  const lifecycle = { ...attempt.lifecycle };
  updateLifecycleDurations(lifecycle, timestamp);
  const navigatorWithDiagnostics =
    typeof navigator === "undefined"
      ? undefined
      : (navigator as NavigatorWithDiagnostics);
  const connection = navigatorWithDiagnostics?.connection;

  return {
    monitorVersion: RENDERER_STARTUP_MONITOR_VERSION,
    attemptId: attempt.attemptId,
    elapsedMs: roundMs(timestamp - attempt.startedAt),
    visibleElapsedMs: roundMs(lifecycle.visibleDurationMs),
    activeElapsedMs: roundMs(lifecycle.activeDurationMs),
    lastCompletedStage: attempt.lastCompletedStage,
    stages: { ...attempt.stages },
    failure: attempt.failure && { ...attempt.failure },
    pageLifecycle: {
      visibility: lifecycle.visibility,
      focused: lifecycle.focused,
      online: lifecycle.online,
      readyState:
        typeof document === "undefined" ? "complete" : document.readyState,
      hiddenCount: lifecycle.hiddenCount,
      blurCount: lifecycle.blurCount,
      hiddenDurationMs: roundMs(lifecycle.hiddenDurationMs),
      unfocusedDurationMs: roundMs(lifecycle.unfocusedDurationMs),
      visibleDurationMs: roundMs(lifecycle.visibleDurationMs),
    },
    rendererState: {
      rootExists:
        typeof document !== "undefined" &&
        document.querySelector("[data-game-renderer-root]") !== null,
      canvasExists:
        typeof document !== "undefined" &&
        document.querySelector("[data-game-renderer-root] canvas") !== null,
      rendererCreated:
        attempt.stages["renderer-created"] !== undefined,
    },
    webgl: attempt.webgl && { ...attempt.webgl },
    device: {
      devicePixelRatio: typeof window === "undefined" ? 0 : window.devicePixelRatio,
      viewportWidth: typeof window === "undefined" ? 0 : window.innerWidth,
      viewportHeight: typeof window === "undefined" ? 0 : window.innerHeight,
      screenWidth: typeof screen === "undefined" ? 0 : screen.width,
      screenHeight: typeof screen === "undefined" ? 0 : screen.height,
      hardwareConcurrency: finiteNumber(
        navigatorWithDiagnostics?.hardwareConcurrency,
      ),
      deviceMemoryGb: finiteNumber(navigatorWithDiagnostics?.deviceMemory),
    },
    network: {
      effectiveType: sanitizeRendererStartupText(connection?.effectiveType, 40),
      rttMs: finiteNumber(connection?.rtt),
      downlinkMbps: finiteNumber(connection?.downlink),
      saveData:
        typeof connection?.saveData === "boolean" ? connection.saveData : undefined,
    },
    resources: getResourceDiagnostics(),
  };
}

export function claimRendererStartupFailureReport(
  stage: RendererStartupFailureStage,
  error?: unknown,
) {
  const attempt = currentAttempt;
  if (!attempt || attempt.reported) return null;

  markRendererStartupFailure(stage, error);
  attempt.reported = true;
  return getRendererStartupDiagnosticsSnapshot();
}

export function claimRendererStartupSlowReport(
  stage: RendererStartupSlowStage,
) {
  const attempt = currentAttempt;
  if (!attempt || attempt.slowReportedStages.has(stage)) return null;

  attempt.slowReportedStages.add(stage);
  return getRendererStartupDiagnosticsSnapshot();
}

export function finishRendererStartupAttempt() {
  if (!currentAttempt) return;
  stopAttempt(currentAttempt);
}

export function abortRendererStartupAttempt() {
  if (!currentAttempt) return;
  stopAttempt(currentAttempt);
}
