import * as Sentry from "@sentry/nextjs";
import type { Context, Contexts } from "@sentry/nextjs";
import {
  claimRendererStartupSlowReport,
  claimRendererStartupFailureReport,
  finishRendererStartupAttempt,
  getRendererStartupDiagnosticsSnapshot,
  isSoftwareWebGLRenderer,
  recordWebGLStartupDiagnostics,
  RENDERER_STARTUP_MONITOR_VERSION,
  sanitizeRendererStartupText,
  type RendererStartupDiagnosticsSnapshot,
  type RendererStartupFailureStage,
  type RendererStartupOutcomeReport,
  type RendererStartupSlowStage,
  type WebGLStartupDiagnostics,
} from "@/lib/rendererStartupDiagnostics";

export type WebGLStartupFailureStage = RendererStartupFailureStage;

interface WebGLStartupTestReport {
  stage: RendererStartupFailureStage;
  snapshot: RendererStartupDiagnosticsSnapshot;
}

interface RendererStartupSlowTestReport {
  stage: RendererStartupSlowStage;
  snapshot: RendererStartupDiagnosticsSnapshot;
  fingerprint: string[];
}

interface WebGLTestControls {
  rendererSlowThresholdMs?: number;
  gameBoardImportSlowThresholdMs?: number;
  rendererCreationSlowThresholdMs?: number;
  suppressRendererReady?: boolean;
  holdGameBoardImport?: boolean;
  reportedStages?: RendererStartupFailureStage[];
  diagnosticReports?: WebGLStartupTestReport[];
  reportedSlowStages?: RendererStartupSlowStage[];
  slowDiagnosticReports?: RendererStartupSlowTestReport[];
  outcomeReports?: RendererStartupOutcomeReport[];
  getDiagnostics?: () => RendererStartupDiagnosticsSnapshot | null;
  completeRendererStartup?: () => void;
  releaseGameBoardImport?: () => void;
}

declare global {
  interface Window {
    __shootbang_webgl_test?: WebGLTestControls;
  }
}

interface WebGLDebugRendererInfo {
  UNMASKED_VENDOR_WEBGL: number;
  UNMASKED_RENDERER_WEBGL: number;
}

const DEFAULT_RENDERER_SLOW_THRESHOLD_MS = 10_000;
let cachedWebGL2Support: boolean | null = null;
let cachedWebGLDiagnostics: WebGLStartupDiagnostics | null = null;

function now() {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

function roundMs(value: number) {
  return Math.round(Math.max(0, value) * 10) / 10;
}

function readWebGLString(
  context: WebGL2RenderingContext,
  parameter: number,
) {
  try {
    const value = context.getParameter(parameter);
    return typeof value === "string" ? value : undefined;
  } catch {
    return undefined;
  }
}

function releaseWebGLContext(context: WebGL2RenderingContext | null) {
  if (!context) return;
  try {
    context.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    // The temporary capability check must never break application startup.
  }
}

function getWebGLEnvironmentDiagnostics() {
  return {
    requestedContextAttributes: "browser-default" as const,
    navigatorGpuAvailable:
      typeof navigator !== "undefined" && "gpu" in navigator,
    secureContext:
      typeof window !== "undefined" && window.isSecureContext === true,
  };
}

function serializeWebGLContextAttributes(
  attributes: WebGLContextAttributes | null,
) {
  if (!attributes) return undefined;

  return Object.fromEntries(
    Object.entries(attributes).filter(
      (entry): entry is [string, boolean | string] =>
        typeof entry[1] === "boolean" || typeof entry[1] === "string",
    ),
  );
}

export function detectWebGL2Support() {
  if (cachedWebGL2Support !== null && cachedWebGLDiagnostics) {
    recordWebGLStartupDiagnostics({
      ...cachedWebGLDiagnostics,
      checkDurationMs: 0,
      cached: true,
    });
    return cachedWebGL2Support;
  }

  const startedAt = now();
  let context: WebGL2RenderingContext | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let contextCreationError: string | undefined;
  const handleContextCreationError = (event: Event) => {
    const statusMessage =
      "statusMessage" in event && typeof event.statusMessage === "string"
        ? event.statusMessage
        : undefined;
    contextCreationError = sanitizeRendererStartupText(statusMessage);
  };

  try {
    const hasWebGL2Constructor =
      typeof window !== "undefined" &&
      typeof window.WebGL2RenderingContext !== "undefined";
    if (!hasWebGL2Constructor) {
      cachedWebGL2Support = false;
      cachedWebGLDiagnostics = {
        hasWebGL2Constructor: false,
        contextCreated: false,
        checkDurationMs: roundMs(now() - startedAt),
        contextFailureReason: "constructor-missing",
        ...getWebGLEnvironmentDiagnostics(),
        softwareRenderer: false,
      };
      recordWebGLStartupDiagnostics(cachedWebGLDiagnostics);
      return cachedWebGL2Support;
    }

    canvas = document.createElement("canvas");
    canvas.addEventListener(
      "webglcontextcreationerror",
      handleContextCreationError,
      { passive: true },
    );
    context = canvas.getContext("webgl2");
    const contextCreated = context !== null;
    let vendor: string | undefined;
    let renderer: string | undefined;

    if (context) {
      const debugInfo = context.getExtension(
        "WEBGL_debug_renderer_info",
      ) as WebGLDebugRendererInfo | null;
      vendor = debugInfo
        ? readWebGLString(context, debugInfo.UNMASKED_VENDOR_WEBGL)
        : readWebGLString(context, context.VENDOR);
      renderer = debugInfo
        ? readWebGLString(context, debugInfo.UNMASKED_RENDERER_WEBGL)
        : readWebGLString(context, context.RENDERER);
    }

    cachedWebGL2Support = contextCreated;
    cachedWebGLDiagnostics = {
      hasWebGL2Constructor: true,
      contextCreated,
      checkDurationMs: roundMs(now() - startedAt),
      contextFailureReason: contextCreated ? "none" : "context-null",
      ...getWebGLEnvironmentDiagnostics(),
      contextAttributes: serializeWebGLContextAttributes(
        context?.getContextAttributes() ?? null,
      ),
      contextCreationError,
      vendor: sanitizeRendererStartupText(vendor),
      renderer: sanitizeRendererStartupText(renderer),
      softwareRenderer: isSoftwareWebGLRenderer(renderer),
    };
    recordWebGLStartupDiagnostics(cachedWebGLDiagnostics);
    return cachedWebGL2Support;
  } catch (error) {
    const errorValue = error instanceof Error ? error : undefined;
    cachedWebGL2Support = false;
    cachedWebGLDiagnostics = {
      hasWebGL2Constructor:
        typeof window !== "undefined" &&
        typeof window.WebGL2RenderingContext !== "undefined",
      contextCreated: context !== null,
      checkDurationMs: roundMs(now() - startedAt),
      contextFailureReason: "exception",
      ...getWebGLEnvironmentDiagnostics(),
      contextAttributes: serializeWebGLContextAttributes(
        context?.getContextAttributes() ?? null,
      ),
      contextCreationError,
      softwareRenderer: false,
      errorName: sanitizeRendererStartupText(errorValue?.name, 80),
      errorMessage: sanitizeRendererStartupText(errorValue?.message),
    };
    recordWebGLStartupDiagnostics(cachedWebGLDiagnostics);
    return cachedWebGL2Support;
  } finally {
    canvas?.removeEventListener(
      "webglcontextcreationerror",
      handleContextCreationError,
    );
    releaseWebGLContext(context);
  }
}

export function getRendererSlowThresholdMs(stage: RendererStartupSlowStage) {
  if (process.env.NODE_ENV !== "production") {
    const stageThreshold =
      stage === "gameboard-import-slow"
        ? window.__shootbang_webgl_test?.gameBoardImportSlowThresholdMs
        : window.__shootbang_webgl_test?.rendererCreationSlowThresholdMs;
    return (
      stageThreshold ??
      window.__shootbang_webgl_test?.rendererSlowThresholdMs ??
      DEFAULT_RENDERER_SLOW_THRESHOLD_MS
    );
  }

  return DEFAULT_RENDERER_SLOW_THRESHOLD_MS;
}

export function shouldSuppressRendererReadyForTest() {
  return (
    process.env.NODE_ENV !== "production" &&
    window.__shootbang_webgl_test?.suppressRendererReady === true
  );
}

export async function waitForGameBoardImportTestRelease() {
  if (
    process.env.NODE_ENV === "production" ||
    window.__shootbang_webgl_test?.holdGameBoardImport !== true
  ) {
    return;
  }

  await new Promise<void>((resolve) => {
    if (!window.__shootbang_webgl_test) {
      resolve();
      return;
    }
    window.__shootbang_webgl_test.releaseGameBoardImport = resolve;
  });
}

export function installRendererStartupTestAccess(
  completeRendererStartup?: () => void,
) {
  if (
    process.env.NODE_ENV === "production" ||
    !window.__shootbang_webgl_test
  ) {
    return;
  }
  window.__shootbang_webgl_test.getDiagnostics =
    getRendererStartupDiagnosticsSnapshot;
  window.__shootbang_webgl_test.completeRendererStartup =
    completeRendererStartup;
}

export function createRendererStartupSentryData(
  stage: RendererStartupFailureStage,
  snapshot: RendererStartupDiagnosticsSnapshot,
) {
  const contexts: Contexts = {
    renderer_startup: {
      attempt_id: snapshot.attemptId,
      monitor_version: snapshot.monitorVersion,
      elapsed_ms: snapshot.elapsedMs,
      visible_elapsed_ms: snapshot.visibleElapsedMs,
      active_elapsed_ms: snapshot.activeElapsedMs,
      last_completed_stage: snapshot.lastCompletedStage,
      stages: snapshot.stages,
      failure: snapshot.failure,
    },
    page_lifecycle: { ...snapshot.pageLifecycle } as Context,
    renderer_state: { ...snapshot.rendererState } as Context,
    webgl_startup: snapshot.webgl
      ? ({ ...snapshot.webgl } as Context)
      : { available: false },
    device: { ...snapshot.device } as Context,
    network: { ...snapshot.network } as Context,
    resources: { ...snapshot.resources } as Context,
    main_thread: { ...snapshot.mainThread } as Context,
  };

  return {
    fingerprint: ["shootbang-renderer-startup-v3", stage],
    tags: {
      component: "game-render-loop",
      failure_stage: stage,
      last_completed_stage: snapshot.lastCompletedStage,
      page_visibility: snapshot.pageLifecycle.visibility,
      window_focused: String(snapshot.pageLifecycle.focused),
      online: String(snapshot.pageLifecycle.online),
      software_renderer: String(snapshot.webgl?.softwareRenderer ?? false),
      monitor_version: RENDERER_STARTUP_MONITOR_VERSION,
    },
    contexts,
  };
}

export function createRendererStartupSlowSentryData(
  stage: RendererStartupSlowStage,
  snapshot: RendererStartupDiagnosticsSnapshot,
) {
  const contexts: Contexts = {
    renderer_startup: {
      attempt_id: snapshot.attemptId,
      monitor_version: snapshot.monitorVersion,
      elapsed_ms: snapshot.elapsedMs,
      visible_elapsed_ms: snapshot.visibleElapsedMs,
      active_elapsed_ms: snapshot.activeElapsedMs,
      last_completed_stage: snapshot.lastCompletedStage,
      slow_stage: stage,
      stages: snapshot.stages,
    },
    page_lifecycle: { ...snapshot.pageLifecycle } as Context,
    renderer_state: { ...snapshot.rendererState } as Context,
    webgl_startup: snapshot.webgl
      ? ({ ...snapshot.webgl } as Context)
      : { available: false },
    device: { ...snapshot.device } as Context,
    network: { ...snapshot.network } as Context,
    resources: { ...snapshot.resources } as Context,
    main_thread: { ...snapshot.mainThread } as Context,
  };

  return {
    fingerprint: ["shootbang-renderer-startup-slow-v1", stage],
    tags: {
      component: "game-render-loop",
      slow_stage: stage,
      last_completed_stage: snapshot.lastCompletedStage,
      page_visibility: snapshot.pageLifecycle.visibility,
      window_focused: String(snapshot.pageLifecycle.focused),
      online: String(snapshot.pageLifecycle.online),
      software_renderer: String(snapshot.webgl?.softwareRenderer ?? false),
      monitor_version: RENDERER_STARTUP_MONITOR_VERSION,
    },
    contexts,
  };
}

export function reportRendererStartupSlow(stage: RendererStartupSlowStage) {
  const snapshot = claimRendererStartupSlowReport(stage);
  if (!snapshot) return;
  const sentryData = createRendererStartupSlowSentryData(stage, snapshot);

  if (process.env.NODE_ENV !== "production") {
    window.__shootbang_webgl_test?.reportedSlowStages?.push(stage);
    window.__shootbang_webgl_test?.slowDiagnosticReports?.push({
      stage,
      snapshot,
      fingerprint: sentryData.fingerprint,
    });
  }

  Sentry.captureMessage("Game renderer initialization is slow", {
    level: "warning",
    ...sentryData,
  });
}

export function reportWebGLStartupFailure(
  stage: RendererStartupFailureStage,
) {
  const snapshot = claimRendererStartupFailureReport(stage);
  if (!snapshot) return;

  if (process.env.NODE_ENV !== "production") {
    window.__shootbang_webgl_test?.reportedStages?.push(stage);
    window.__shootbang_webgl_test?.diagnosticReports?.push({
      stage,
      snapshot,
    });
  }

  Sentry.captureMessage("Game renderer initialization failed", {
    level: "warning",
    ...createRendererStartupSentryData(stage, snapshot),
  });
  finishRendererStartupAttempt();
}
