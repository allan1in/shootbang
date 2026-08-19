"use client";

import { useEffect, useState } from "react";
import { detectWebGL2Support } from "@/lib/webglSupport";
import { markRendererStartupStage } from "@/lib/rendererStartupDiagnostics";

export type WebGLSupportStatus =
  | "checking"
  | "supported"
  | "unsupported";

export function useWebGLSupport(enabled: boolean): WebGLSupportStatus {
  const [status, setStatus] = useState<WebGLSupportStatus>("checking");

  useEffect(() => {
    if (!enabled) return;

    markRendererStartupStage("webgl2-check-started");
    const supported = detectWebGL2Support();
    markRendererStartupStage("webgl2-check-completed");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus(supported ? "supported" : "unsupported");
  }, [enabled]);

  return status;
}
