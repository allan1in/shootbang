"use client";

import { useState, useCallback } from "react";
import type { RootState } from "@react-three/fiber";
import { RotateCcw, Home } from "lucide-react";
import { IconButton } from "@/components/IconButton";
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
import { useTheme, type Theme } from "@/hooks/useTheme";
import { SceneCanvas } from "@/components/r3f/SceneCanvas";
import { toast } from "sonner";

export default function GameBoard() {
  const settings = useSettings();
  const bridge = useR3FBridge();
  const { theme, setTheme } = useTheme();

  // 主题面板状态
  const [showThemePanel, setShowThemePanel] = useState(false);
  const [tempTheme, setTempTheme] = useState<Theme>(theme);

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
    gridPositionsRef: settings.gridPositionsRef,
    targetCountRef: settings.targetCountRef,
    durationRef: settings.durationRef,
    sensitivityRef: settings.sensitivityRef,
    targetSizeRef: settings.targetSizeRef,
  });

  // 稳定回调
  const handlePauseHome = useCallback(() => {
    document.exitPointerLock();
    game.setGameState("idle");
  }, [game.setGameState]);

  const handlePauseRestart = useCallback(() => {
    document.exitPointerLock();
    game.triggerStart();
  }, [game.triggerStart]);

  const handleFinishedHome = useCallback(() => {
    game.setGameState("idle");
  }, [game.setGameState]);

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
        />
      )}

      {/* 结束页面 */}
      {game.gameState === "finished" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/50 cursor-default">
          <div className="flex flex-col items-center">
            <ResultStats stats={game.gameStats} />
            <div className="flex items-center gap-3">
              <IconButton
                icon={RotateCcw}
                label="再来一局"
                onClick={game.triggerStart}
              />
              <IconButton
                icon={Home}
                label="返回首页"
                onClick={handleFinishedHome}
              />
            </div>
          </div>
        </div>
      )}

      {/* 倒计时 */}
      {game.countdown !== null && (
        <CountdownOverlay countdown={game.countdown} />
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
