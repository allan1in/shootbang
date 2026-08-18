"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { useMobileDetect } from "@/hooks/useMobileDetect";
import { useWebGLSupport } from "@/hooks/useWebGLSupport";
import { LoadingScreen } from "@/components/LoadingScreen";
import { MobilePrompt } from "@/components/MobilePrompt";
import {
  getRendererInitializationTimeoutMs,
  installRendererStartupTestAccess,
  reportWebGLStartupFailure,
  shouldSuppressRendererReadyForTest,
} from "@/lib/webglSupport";
import {
  abortRendererStartupAttempt,
  finishRendererStartupAttempt,
  markRendererStartupFailure,
  markRendererStartupStage,
  startRendererStartupAttempt,
} from "@/lib/rendererStartupDiagnostics";

// 动态导入：移动端只渲染提示语，不下载 three.js/tone.js 等游戏依赖
const GameBoard = dynamic(
  async () => {
    markRendererStartupStage("gameboard-import-started");
    try {
      const gameBoardModule = await import("@/components/GameBoard");
      markRendererStartupStage("gameboard-import-completed");
      return gameBoardModule;
    } catch (error) {
      markRendererStartupFailure("gameboard-import", error);
      throw error;
    }
  },
  {
    ssr: false,
    loading: () => <LoadingScreen />,
  },
);

export function MobileGate() {
  const { isMobile, ready } = useMobileDetect();
  useEffect(() => {
    if (!ready || isMobile) return;

    startRendererStartupAttempt();
    markRendererStartupStage("device-check-completed");
    installRendererStartupTestAccess();
    return abortRendererStartupAttempt;
  }, [isMobile, ready]);

  const webGLStatus = useWebGLSupport(ready && !isMobile);
  const [rendererReady, setRendererReady] = useState(false);
  const [rendererTimedOut, setRendererTimedOut] = useState(false);

  const handleRendererReady = useCallback(() => {
    if (shouldSuppressRendererReadyForTest()) return;
    markRendererStartupStage("renderer-created");
    finishRendererStartupAttempt();
    setRendererReady(true);
  }, []);

  useEffect(() => {
    if (webGLStatus !== "unsupported") return;
    reportWebGLStartupFailure("webgl2-check");
  }, [webGLStatus]);

  useEffect(() => {
    if (webGLStatus !== "supported" || rendererReady) return;

    const timeoutId = window.setTimeout(() => {
      reportWebGLStartupFailure("renderer-timeout");
      setRendererTimedOut(true);
    }, getRendererInitializationTimeoutMs());

    return () => window.clearTimeout(timeoutId);
  }, [rendererReady, webGLStatus]);

  if (!ready) return <LoadingScreen />;
  if (isMobile) return <MobilePrompt />;
  if (webGLStatus === "checking") return <LoadingScreen />;
  if (webGLStatus === "unsupported" || rendererTimedOut) {
    return <LoadingScreen status="failed" />;
  }

  return (
    <div className="relative h-screen w-full">
      <div
        aria-hidden={!rendererReady}
        className={`h-full ${rendererReady ? "visible" : "invisible"}`}
      >
        <GameBoard onRendererReady={handleRendererReady} />
      </div>
      {!rendererReady && (
        <div className="absolute inset-0">
          <LoadingScreen />
        </div>
      )}
    </div>
  );
}
