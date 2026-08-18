import * as Sentry from "@sentry/nextjs";
import type { Context, Contexts } from "@sentry/nextjs";
import {
  claimRendererStartupFailureReport,
  finishRendererStartupAttempt,
  getRendererStartupDiagnosticsSnapshot,
  isSoftwareWebGLRenderer,
  recordWebGLStartupDiagnostics,
  RENDERER_STARTUP_MONITOR_VERSION,
  sanitizeRendererStartupText,
  type RendererStartupDiagnosticsSnapshot,
  type RendererStartupFailureStage,
  type WebGLStartupDiagnostics,
} from "@/lib/rendererStartupDiagnostics";

export type WebGLStartupFailureStage = RendererStartupFailureStage;

interface WebGLStartupTestReport {
  stage: RendererStartupFailureStage;
  snapshot: RendererStartupDiagnosticsSnapshot;
}

interface WebGLTestControls {
  rendererTimeoutMs?: number;
  suppressRendererReady?: boolean;
  reportedStages?: RendererStartupFailureStage[];
  diagnosticReports?: WebGLStartupTestReport[];
  getDiagnostics?: () => RendererStartupDiagnosticsSnapshot | null;
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

const DEFAULT_RENDERER_TIMEOUT_MS = 10_000;
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
        softwareRenderer: false,
      };
      recordWebGLStartupDiagnostics(cachedWebGLDiagnostics);
      return cachedWebGL2Support;
    }

    const canvas = document.createElement("canvas");
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
      softwareRenderer: false,
      errorName: sanitizeRendererStartupText(errorValue?.name, 80),
      errorMessage: sanitizeRendererStartupText(errorValue?.message),
    };
    recordWebGLStartupDiagnostics(cachedWebGLDiagnostics);
    return cachedWebGL2Support;
  } finally {
    releaseWebGLContext(context);
  }
}

export function getRendererInitializationTimeoutMs() {
  if (process.env.NODE_ENV !== "production") {
    return (
      window.__shootbang_webgl_test?.rendererTimeoutMs ??
      DEFAULT_RENDERER_TIMEOUT_MS
    );
  }

  return DEFAULT_RENDERER_TIMEOUT_MS;
}

export function shouldSuppressRendererReadyForTest() {
  return (
    process.env.NODE_ENV !== "production" &&
    window.__shootbang_webgl_test?.suppressRendererReady === true
  );
}

export function installRendererStartupTestAccess() {
  if (
    process.env.NODE_ENV === "production" ||
    !window.__shootbang_webgl_test
  ) {
    return;
  }
  window.__shootbang_webgl_test.getDiagnostics =
    getRendererStartupDiagnosticsSnapshot;
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
  };

  return {
    fingerprint: ["shootbang-renderer-startup-v2", stage],
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
