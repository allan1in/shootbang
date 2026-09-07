import * as Sentry from "@sentry/nextjs";

export const RENDERER_STARTUP_MONITOR_VERSION = "renderer-startup-v4";

const STARTUP_OBSERVER_TIMEOUT_MS = 60_000;
const NORMAL_STARTUP_SAMPLE_RATE = 0.05;
const NEXT_CHUNK_PREFIX = "/_next/static/chunks/";
const MAX_REPORTED_CHUNKS = 5;

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
  contextFailureReason:
    | "none"
    | "constructor-missing"
    | "context-null"
    | "exception";
  requestedContextAttributes: "browser-default";
  contextAttributes?: Record<string, boolean | string>;
  contextCreationError?: string;
  navigatorGpuAvailable: boolean;
  secureContext: boolean;
  vendor?: string;
  renderer?: string;
  softwareRenderer: boolean;
  errorName?: string;
  errorMessage?: string;
  cached?: boolean;
}

export type RendererStartupOutcome =
  | "success"
  | "pending"
  | "slow_recovered"
  | "failed";

export interface RendererChunkDiagnostics {
  path: string;
  status: "pending" | "loaded" | "error";
  startMs?: number;
  ttfbMs?: number;
  downloadMs?: number;
  durationMs?: number;
  transferSize?: number;
  encodedBodySize?: number;
  decodedBodySize?: number;
  protocol?: string;
  cacheStatus?: "cache" | "network" | "unknown";
}

export interface RendererStartupOutcomeReport {
  outcome: RendererStartupOutcome;
  slowStage?: RendererStartupSlowStage;
  sampled: boolean;
  snapshot: RendererStartupDiagnosticsSnapshot;
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
    nextChunkCount: number;
    pendingChunkCount: number;
    failedChunkCount: number;
    topChunks: RendererChunkDiagnostics[];
    pendingChunkPaths: string[];
    failedChunkPaths: string[];
  };
  mainThread: {
    observerSupported: boolean;
    longTaskCount: number;
    totalLongTaskDurationMs: number;
    maxLongTaskDurationMs: number;
  };
}

interface ObservedChunk {
  path: string;
  status: RendererChunkDiagnostics["status"];
  timing?: Omit<RendererChunkDiagnostics, "path" | "status">;
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
  sampleNormalOutcome: boolean;
  slowReportedStages: Set<RendererStartupSlowStage>;
  slowReportedAtMs: Partial<Record<RendererStartupSlowStage, number>>;
  chunks: Map<string, ObservedChunk>;
  mainThread: RendererStartupDiagnosticsSnapshot["mainThread"];
  removeLifecycleListeners?: () => void;
  stopObservers?: () => void;
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

function getNextChunkPath(value: string) {
  if (typeof location === "undefined") return undefined;

  try {
    const url = new URL(value, location.href);
    if (
      url.origin !== location.origin ||
      !url.pathname.startsWith(NEXT_CHUNK_PREFIX) ||
      !url.pathname.endsWith(".js")
    ) {
      return undefined;
    }
    return url.pathname.slice(0, 240);
  } catch {
    return undefined;
  }
}

function getChunkCacheStatus(entry: PerformanceResourceTiming) {
  if (entry.transferSize > 0) return "network" as const;
  if (entry.decodedBodySize > 0 || entry.encodedBodySize > 0) {
    return "cache" as const;
  }
  return "unknown" as const;
}

function recordChunkResourceTiming(
  attempt: RendererStartupAttempt,
  entry: PerformanceResourceTiming,
) {
  if (entry.initiatorType !== "script") return;
  const path = getNextChunkPath(entry.name);
  if (!path) return;

  // A one-second allowance captures a chunk whose request began just before the
  // React effect installed the observers, without mixing in the initial route.
  if (entry.responseEnd < attempt.startedAt - 1_000) return;

  attempt.chunks.set(path, {
    path,
    status: "loaded",
    timing: {
      startMs: roundMs(entry.startTime - attempt.startedAt),
      ttfbMs: roundMs(entry.responseStart - entry.requestStart),
      downloadMs: roundMs(entry.responseEnd - entry.responseStart),
      durationMs: roundMs(entry.duration),
      transferSize: Math.max(0, entry.transferSize || 0),
      encodedBodySize: Math.max(0, entry.encodedBodySize || 0),
      decodedBodySize: Math.max(0, entry.decodedBodySize || 0),
      protocol: sanitizeRendererStartupText(entry.nextHopProtocol, 40),
      cacheStatus: getChunkCacheStatus(entry),
    },
  });
}

function installStartupObservers(attempt: RendererStartupAttempt) {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    typeof performance === "undefined"
  ) {
    return;
  }

  const observers: Array<{ disconnect: () => void }> = [];
  const scriptListenerCleanups = new Set<() => void>();
  let stopped = false;

  const recordResourceEntries = (entries: readonly PerformanceEntry[]) => {
    for (const entry of entries) {
      if (entry.entryType !== "resource") continue;
      recordChunkResourceTiming(attempt, entry as PerformanceResourceTiming);
    }
  };

  const watchScript = (script: HTMLScriptElement) => {
    const path = getNextChunkPath(script.src);
    if (!path) return;

    const existing = attempt.chunks.get(path);
    if (!existing) {
      attempt.chunks.set(path, { path, status: "pending" });
    }
    if (existing?.status === "loaded" || existing?.status === "error") return;

    let listenerActive = true;
    const cleanup = () => {
      if (!listenerActive) return;
      listenerActive = false;
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
      scriptListenerCleanups.delete(cleanup);
    };
    const handleLoad = () => {
      const current = attempt.chunks.get(path);
      attempt.chunks.set(path, {
        path,
        status: "loaded",
        timing: current?.timing,
      });
      cleanup();
    };
    const handleError = () => {
      const current = attempt.chunks.get(path);
      attempt.chunks.set(path, {
        path,
        status: "error",
        timing: current?.timing,
      });
      cleanup();
    };

    script.addEventListener("load", handleLoad, { once: true, passive: true });
    script.addEventListener("error", handleError, { once: true, passive: true });
    scriptListenerCleanups.add(cleanup);
  };

  try {
    recordResourceEntries(performance.getEntriesByType("resource"));
  } catch {
    // Diagnostics must never interfere with renderer startup.
  }

  try {
    document
      .querySelectorAll<HTMLScriptElement>("script[src]")
      .forEach(watchScript);
    const mutationObserver = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node instanceof HTMLScriptElement) watchScript(node);
          node
            .querySelectorAll<HTMLScriptElement>("script[src]")
            .forEach(watchScript);
        }
      }
    });
    mutationObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    observers.push(mutationObserver);
  } catch {
    // MutationObserver is best-effort diagnostics only.
  }

  if (typeof PerformanceObserver !== "undefined") {
    try {
      const resourceObserver = new PerformanceObserver((list) => {
        recordResourceEntries(list.getEntries());
      });
      resourceObserver.observe({ type: "resource", buffered: true });
      observers.push(resourceObserver);
    } catch {
      // Resource Timing remains available through getEntriesByType below.
    }

    try {
      const supportedEntryTypes = PerformanceObserver.supportedEntryTypes ?? [];
      if (supportedEntryTypes.includes("longtask")) {
        attempt.mainThread.observerSupported = true;
        const longTaskObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.startTime < attempt.startedAt) continue;
            const duration = Math.max(0, entry.duration);
            attempt.mainThread.longTaskCount += 1;
            attempt.mainThread.totalLongTaskDurationMs += duration;
            attempt.mainThread.maxLongTaskDurationMs = Math.max(
              attempt.mainThread.maxLongTaskDurationMs,
              duration,
            );
          }
        });
        longTaskObserver.observe({ type: "longtask", buffered: true });
        observers.push(longTaskObserver);
      }
    } catch {
      attempt.mainThread.observerSupported = false;
    }
  }

  const timeoutId = window.setTimeout(() => {
    attempt.stopObservers?.();
  }, STARTUP_OBSERVER_TIMEOUT_MS);

  attempt.stopObservers = () => {
    if (stopped) return;
    stopped = true;
    window.clearTimeout(timeoutId);
    observers.forEach((observer) => observer.disconnect());
    scriptListenerCleanups.forEach((cleanup) => cleanup());
    scriptListenerCleanups.clear();
    attempt.stopObservers = undefined;
  };
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
  attempt.stopObservers?.();
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
    sampleNormalOutcome: Math.random() < NORMAL_STARTUP_SAMPLE_RATE,
    slowReportedStages: new Set(),
    slowReportedAtMs: {},
    chunks: new Map(),
    mainThread: {
      observerSupported: false,
      longTaskCount: 0,
      totalLongTaskDurationMs: 0,
      maxLongTaskDurationMs: 0,
    },
  };

  currentAttempt = attempt;
  installLifecycleListeners(attempt);
  installStartupObservers(attempt);
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
  const contextAttributes = diagnostics.contextAttributes
    ? Object.fromEntries(
        Object.entries(diagnostics.contextAttributes).flatMap(([key, value]) => {
          const safeKey = sanitizeRendererStartupText(key, 60);
          const safeValue =
            typeof value === "boolean"
              ? value
              : sanitizeRendererStartupText(value, 80);
          return safeKey && safeValue !== undefined
            ? [[safeKey, safeValue]]
            : [];
        }),
      )
    : undefined;
  currentAttempt.webgl = {
    ...diagnostics,
    contextAttributes,
    contextCreationError: sanitizeRendererStartupText(
      diagnostics.contextCreationError,
    ),
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

function getResourceDiagnostics(attempt: RendererStartupAttempt) {
  if (typeof performance === "undefined" || typeof location === "undefined") {
    return {
      scriptCount: 0,
      totalScriptTransferBytes: 0,
      nextChunkCount: 0,
      pendingChunkCount: 0,
      failedChunkCount: 0,
      topChunks: [],
      pendingChunkPaths: [],
      failedChunkPaths: [],
    };
  }

  let resourceEntries: PerformanceResourceTiming[] = [];
  try {
    resourceEntries = performance.getEntriesByType(
      "resource",
    ) as PerformanceResourceTiming[];
    resourceEntries.forEach((entry) => {
      recordChunkResourceTiming(attempt, entry);
    });
  } catch {
    // A partial snapshot is still more useful than dropping the report.
  }

  const scripts = resourceEntries
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
  const chunks = Array.from(attempt.chunks.values()).map(
    ({ path, status, timing }): RendererChunkDiagnostics => ({
      path,
      status,
      ...timing,
    }),
  );
  const topChunks = [...chunks]
    .sort((left, right) => {
      const statusWeight = { error: 2, pending: 1, loaded: 0 } as const;
      const statusDifference =
        statusWeight[right.status] - statusWeight[left.status];
      if (statusDifference !== 0) return statusDifference;
      return (right.durationMs ?? -1) - (left.durationMs ?? -1);
    })
    .slice(0, MAX_REPORTED_CHUNKS);
  const pendingChunkPaths = chunks
    .filter((chunk) => chunk.status === "pending")
    .map((chunk) => chunk.path)
    .slice(0, MAX_REPORTED_CHUNKS);
  const failedChunkPaths = chunks
    .filter((chunk) => chunk.status === "error")
    .map((chunk) => chunk.path)
    .slice(0, MAX_REPORTED_CHUNKS);

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
    nextChunkCount: chunks.length,
    pendingChunkCount: chunks.filter((chunk) => chunk.status === "pending")
      .length,
    failedChunkCount: chunks.filter((chunk) => chunk.status === "error")
      .length,
    topChunks,
    pendingChunkPaths,
    failedChunkPaths,
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
    resources: getResourceDiagnostics(attempt),
    mainThread: {
      observerSupported: attempt.mainThread.observerSupported,
      longTaskCount: attempt.mainThread.longTaskCount,
      totalLongTaskDurationMs: roundMs(
        attempt.mainThread.totalLongTaskDurationMs,
      ),
      maxLongTaskDurationMs: roundMs(attempt.mainThread.maxLongTaskDurationMs),
    },
  };
}

function getStageDurationMs(
  snapshot: RendererStartupDiagnosticsSnapshot,
  start: RendererStartupStage,
  end: RendererStartupStage,
) {
  const startedAt = snapshot.stages[start];
  const endedAt = snapshot.stages[end];
  if (startedAt === undefined || endedAt === undefined) return undefined;
  return roundMs(endedAt - startedAt);
}

function getRecoveryBucket(recoveryMs?: number) {
  if (recoveryMs === undefined) return undefined;
  if (recoveryMs < 1_000) return "under_1s";
  if (recoveryMs < 5_000) return "1s_to_5s";
  if (recoveryMs < 15_000) return "5s_to_15s";
  if (recoveryMs < 30_000) return "15s_to_30s";
  if (recoveryMs < 60_000) return "30s_to_60s";
  return "over_60s";
}

function reportRendererStartupOutcome(
  attempt: RendererStartupAttempt,
  snapshot: RendererStartupDiagnosticsSnapshot,
  outcome: RendererStartupOutcome,
  slowStage?: RendererStartupSlowStage,
) {
  const shouldEmit = outcome !== "success" || attempt.sampleNormalOutcome;
  if (!shouldEmit) return;

  const slowReportedAtValues = Object.values(attempt.slowReportedAtMs).filter(
    (value): value is number => value !== undefined,
  );
  const firstSlowReportedAt = slowReportedAtValues.length
    ? Math.min(...slowReportedAtValues)
    : undefined;
  const recoveryMs =
    outcome === "slow_recovered" && firstSlowReportedAt !== undefined
      ? roundMs(snapshot.elapsedMs - firstSlowReportedAt)
      : undefined;
  const importDurationMs = getStageDurationMs(
    snapshot,
    "gameboard-import-started",
    "gameboard-import-completed",
  );
  const rendererCreationDurationMs = getStageDurationMs(
    snapshot,
    "gameboard-import-completed",
    "renderer-created",
  );
  const topChunkAttributes = Object.fromEntries(
    snapshot.resources.topChunks.flatMap((chunk, index) => {
      const prefix = `chunk_${index + 1}`;
      return [
        [`${prefix}_path`, chunk.path],
        [`${prefix}_status`, chunk.status],
        [`${prefix}_duration_ms`, chunk.durationMs],
        [`${prefix}_ttfb_ms`, chunk.ttfbMs],
        [`${prefix}_download_ms`, chunk.downloadMs],
        [`${prefix}_cache`, chunk.cacheStatus],
        [`${prefix}_protocol`, chunk.protocol],
      ].filter((entry) => entry[1] !== undefined);
    }),
  );
  const attributes = {
    attempt_id: snapshot.attemptId,
    monitor_version: snapshot.monitorVersion,
    outcome,
    slow_stage: slowStage,
    failure_stage: snapshot.failure?.stage,
    last_completed_stage: snapshot.lastCompletedStage,
    startup_duration_ms: snapshot.elapsedMs,
    visible_duration_ms: snapshot.visibleElapsedMs,
    active_duration_ms: snapshot.activeElapsedMs,
    import_duration_ms: importDurationMs,
    renderer_creation_duration_ms: rendererCreationDurationMs,
    recovery_ms: recoveryMs,
    recovery_bucket: getRecoveryBucket(recoveryMs),
    page_visibility: snapshot.pageLifecycle.visibility,
    window_focused: snapshot.pageLifecycle.focused,
    online: snapshot.pageLifecycle.online,
    effective_type: snapshot.network.effectiveType,
    network_rtt_ms: snapshot.network.rttMs,
    network_downlink_mbps: snapshot.network.downlinkMbps,
    next_chunk_count: snapshot.resources.nextChunkCount,
    pending_chunk_count: snapshot.resources.pendingChunkCount,
    failed_chunk_count: snapshot.resources.failedChunkCount,
    long_task_count: snapshot.mainThread.longTaskCount,
    total_long_task_duration_ms: snapshot.mainThread.totalLongTaskDurationMs,
    max_long_task_duration_ms: snapshot.mainThread.maxLongTaskDurationMs,
    webgl_context_created: snapshot.webgl?.contextCreated,
    webgl_context_failure_reason: snapshot.webgl?.contextFailureReason,
    webgl_creation_error: snapshot.webgl?.contextCreationError,
    software_renderer: snapshot.webgl?.softwareRenderer,
    navigator_gpu_available: snapshot.webgl?.navigatorGpuAvailable,
    secure_context: snapshot.webgl?.secureContext,
    ...topChunkAttributes,
  };

  try {
    if (outcome === "failed") {
      Sentry.logger.error("Renderer startup outcome", attributes);
    } else if (outcome === "pending") {
      Sentry.logger.warn("Renderer startup outcome", attributes);
    } else {
      Sentry.logger.info("Renderer startup outcome", attributes);
    }

    const metricAttributes = {
      monitor_version: snapshot.monitorVersion,
      outcome,
      slow_stage: slowStage ?? "none",
      failure_stage: snapshot.failure?.stage ?? "none",
      last_completed_stage: snapshot.lastCompletedStage,
      page_visibility: snapshot.pageLifecycle.visibility,
      window_focused: snapshot.pageLifecycle.focused,
      effective_type: snapshot.network.effectiveType ?? "unknown",
    };
    Sentry.metrics.count("shootbang.renderer_startup.attempt", 1, {
      attributes: metricAttributes,
    });
    Sentry.metrics.distribution(
      "shootbang.renderer_startup.duration",
      snapshot.elapsedMs,
      { unit: "millisecond", attributes: metricAttributes },
    );
    if (importDurationMs !== undefined) {
      Sentry.metrics.distribution(
        "shootbang.renderer_startup.import_duration",
        importDurationMs,
        { unit: "millisecond", attributes: metricAttributes },
      );
    }
    if (rendererCreationDurationMs !== undefined) {
      Sentry.metrics.distribution(
        "shootbang.renderer_startup.renderer_creation_duration",
        rendererCreationDurationMs,
        { unit: "millisecond", attributes: metricAttributes },
      );
    }
  } catch {
    // Telemetry must remain passive even if the SDK rejects a value.
  }

  if (process.env.NODE_ENV !== "production") {
    window.__shootbang_webgl_test?.outcomeReports?.push({
      outcome,
      slowStage,
      sampled: attempt.sampleNormalOutcome,
      snapshot,
    });
  }
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
  attempt.slowReportedAtMs[stage] = roundMs(now() - attempt.startedAt);
  const snapshot = getRendererStartupDiagnosticsSnapshot();
  if (snapshot) {
    reportRendererStartupOutcome(attempt, snapshot, "pending", stage);
  }
  return snapshot;
}

export function finishRendererStartupAttempt() {
  if (!currentAttempt) return;
  const attempt = currentAttempt;
  const snapshot = getRendererStartupDiagnosticsSnapshot();
  if (snapshot) {
    const slowStage = attempt.slowReportedStages.values().next().value as
      | RendererStartupSlowStage
      | undefined;
    const outcome: RendererStartupOutcome = attempt.failure
      ? "failed"
      : slowStage
        ? "slow_recovered"
        : "success";
    reportRendererStartupOutcome(attempt, snapshot, outcome, slowStage);
  }
  stopAttempt(attempt);
}

export function abortRendererStartupAttempt() {
  if (!currentAttempt) return;
  stopAttempt(currentAttempt);
}
