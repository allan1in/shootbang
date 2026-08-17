import * as Sentry from "@sentry/nextjs";

export type WebGLStartupFailureStage =
  | "webgl2-check"
  | "renderer-timeout";

interface WebGLTestControls {
  rendererTimeoutMs?: number;
  suppressRendererReady?: boolean;
  reportedStages?: WebGLStartupFailureStage[];
}

declare global {
  interface Window {
    __shootbang_webgl_test?: WebGLTestControls;
  }
}

const DEFAULT_RENDERER_TIMEOUT_MS = 10_000;
let cachedWebGL2Support: boolean | null = null;
let hasReportedStartupFailure = false;

export function detectWebGL2Support() {
  if (cachedWebGL2Support !== null) return cachedWebGL2Support;

  try {
    if (typeof window === "undefined" || !window.WebGL2RenderingContext) {
      cachedWebGL2Support = false;
      return cachedWebGL2Support;
    }

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2");
    cachedWebGL2Support = context !== null;
    return cachedWebGL2Support;
  } catch {
    cachedWebGL2Support = false;
    return cachedWebGL2Support;
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

export function reportWebGLStartupFailure(
  stage: WebGLStartupFailureStage,
) {
  if (hasReportedStartupFailure) return;
  hasReportedStartupFailure = true;

  if (process.env.NODE_ENV !== "production") {
    window.__shootbang_webgl_test?.reportedStages?.push(stage);
  }

  Sentry.captureMessage("Game renderer initialization failed", {
    level: "warning",
    fingerprint: ["shootbang-webgl-startup-v1"],
    tags: {
      component: "game-render-loop",
      failure_stage: stage,
    },
    contexts: {
      webgl_startup: {
        stage,
        has_webgl2_constructor:
          typeof window !== "undefined" &&
          typeof window.WebGL2RenderingContext !== "undefined",
        device_pixel_ratio:
          typeof window === "undefined" ? 0 : window.devicePixelRatio,
        viewport_width: typeof window === "undefined" ? 0 : window.innerWidth,
        viewport_height:
          typeof window === "undefined" ? 0 : window.innerHeight,
      },
    },
  });
}
