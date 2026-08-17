"use client";

import { useEffect, useState } from "react";
import { detectWebGL2Support } from "@/lib/webglSupport";

export type WebGLSupportStatus =
  | "checking"
  | "supported"
  | "unsupported";

export function useWebGLSupport(enabled: boolean): WebGLSupportStatus {
  const [status, setStatus] = useState<WebGLSupportStatus>("checking");

  useEffect(() => {
    if (!enabled) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus(detectWebGL2Support() ? "supported" : "unsupported");
  }, [enabled]);

  return status;
}
