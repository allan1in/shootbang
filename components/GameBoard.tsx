"use client";

import { useState, useCallback, useEffect } from "react";
import type { RootState } from "@react-three/fiber";
import { RotateCcw, Home, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Crosshair } from "@/components/Crosshair";
import { PauseOverlay } from "@/components/PauseOverlay";
import { IdleScreen } from "@/components/IdleScreen";
import { CountdownOverlay } from "@/components/CountdownOverlay";
import { TimerBar } from "@/components/TimerBar";
import { FpsCounter } from "@/components/FpsCounter";
import { ResultStats } from "@/components/ResultStats";
import { useSettings } from "@/hooks/useSettings";
import { useR3FBridge } from "@/hooks/useR3FBridge";
import { useGameLogic } from "@/hooks/useGameLogic";
import { useGameStore, useSettingsStore } from "@/stores/gameStore";
import { useTheme, type Theme } from "@/hooks/useTheme";
import { SceneCanvas } from "@/components/r3f/SceneCanvas";
import { toast } from "sonner";
import { setMasterMuted } from "@/lib/sounds";

export default function GameBoard() {
  const settings = useSettings();
  const bridge = useR3FBridge();
  const { theme, setTheme } = useTheme();
  const muted = useSettingsStore((s) => s.muted);
  const toggleMute = useSettingsStore((s) => s.toggleMute);

  useEffect(() => {
    setMasterMuted(muted);
  }, [muted]);

  // 主题面板状态
  const [showThemePanel, setShowThemePanel] = useState(false);
  const [tempTheme, setTempTheme] = useState<"default" | "thunderstorm" | "blizzard">(theme);

  const openTheme = useCallback(() => {
    setTempTheme(theme);
    setShowThemePanel(true);
  }, [theme]);

  const cancelTheme = useCallback(() => {
    setShowThemePanel(false);
  }, []);

  const saveTheme = useCallback(() => {
    setTheme(tempTheme);
    setShowThemePanel(false);
  }, [tempTheme, setTheme]);

  const game = useGameLogic({
    targetsRef: bridge.targetsRef,
    cameraRef: bridge.cameraRef,
    raycasterRef: bridge.raycasterRef,
    mouseAccum: bridge.mouseAccum,
    containerRef: bridge.canvasRef,
  });

  // 稳定回调
  const handlePauseHome = useCallback(() => {
    document.exitPointerLock();
    useGameStore.getState().setGameState("idle");
  }, []);

  const handlePauseRestart = useCallback(() => {
    document.exitPointerLock();
    game.triggerStart();
  }, [game.triggerStart]);

  const handleFinishedHome = useCallback(() => {
    useGameStore.getState().setGameState("idle");
  }, []);

  const handleCreated = useCallback(
    (state: RootState) => {
      bridge.canvasRef.current = state.gl.domElement; // eslint-disable-line react-hooks/immutability

      const canvas = state.gl.domElement;
      const onLost = (e: Event) => e.preventDefault();
      const onRestored = () =>
        toast.error("WebGL context 已恢复，如画面异常请刷新页面");
      canvas.addEventListener("webglcontextlost", onLost);
      canvas.addEventListener("webglcontextrestored", onRestored);
    },
    [bridge.canvasRef],
  );

  return (
    <div className="relative w-full h-screen bg-background">
      {/* 计时进度条 */}
      {game.gameState === "playing" && (
        <TimerBar timeLeftRef={game.timeLeftRef} duration={settings.duration} />
      )}

      {/* 帧率 */}
      <FpsCounter />

      {/* 准星 */}
      {game.gameState === "playing" && game.isLocked && <Crosshair />}

      {/* 暂停提示 */}
      {game.gameState === "playing" && game.isPaused && (
        <PauseOverlay
          onHome={handlePauseHome}
          onRestart={handlePauseRestart}
          onResume={game.triggerResume}
          muted={muted}
          onToggleMute={toggleMute}
        />
      )}

      {/* 开始页面 */}
      {game.gameState === "idle" && (
        <IdleScreen
          showSettings={settings.showSettings}
          onStart={game.triggerStart}
          onOpenSettings={settings.openSettings}
          onCancelSettings={settings.cancelSettings}
          onSaveSettings={settings.saveSettings}
          tempSensitivity={settings.tempSensitivity}
          tempGridSize={settings.tempGridSize}
          tempDuration={settings.tempDuration}
          setTempSensitivity={settings.setTempSensitivity}
          setTempGridSize={settings.setTempGridSize}
          setTempDuration={settings.setTempDuration}
          tempTargetSize={settings.tempTargetSize}
          setTempTargetSize={settings.setTempTargetSize}
          showThemePanel={showThemePanel}
          onOpenTheme={openTheme}
          onCancelTheme={cancelTheme}
          onSaveTheme={saveTheme}
          tempTheme={tempTheme}
          setTempTheme={setTempTheme}
          muted={muted}
          onToggleMute={toggleMute}
        />
      )}

      {/* 结束页面 */}
      {game.gameState === "finished" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/50 cursor-default">
          <div className="flex flex-col items-center">
            <ResultStats stats={game.gameStats} />
            <div className="flex items-center gap-3">
              <Button variant="outline" className="cursor-pointer border-foreground/10" onClick={game.triggerStart}>
                <RotateCcw data-icon="inline-start" className="size-4" />
                重新开始
              </Button>
              <Button variant="outline" className="cursor-pointer border-foreground/10" onClick={handleFinishedHome}>
                <Home data-icon="inline-start" className="size-4" />
                回到首页
              </Button>
              <Button variant="outline" className="cursor-pointer border-foreground/10" onClick={toggleMute}>
                {muted ? <VolumeX data-icon="inline-start" className="size-4" /> : <Volume2 data-icon="inline-start" className="size-4" />}
                {muted ? "取消静音" : "静音"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 倒计时 */}
      {game.countdown !== null && (
        <CountdownOverlay countdown={game.countdown} />
      )}

      {/* 暴雪白化遮罩 */}
      {theme === "blizzard" && (
        <div
          className="absolute inset-0 z-10 pointer-events-none"
          style={{ backgroundColor: "rgba(255,255,255,0.15)", opacity: "var(--whiteout, 0)" }}
        />
      )}

      {/* 3D 场景 */}
      <SceneCanvas
        className={`w-full h-full ${game.isLocked ? "cursor-none" : "cursor-default"}`}
        onCreated={handleCreated}
        sceneProvider={bridge.SceneProvider}
        gameState={game.gameState}
        theme={theme}
      />
    </div>
  );
}
