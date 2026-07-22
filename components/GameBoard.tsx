"use client";

import { useState, useCallback, useEffect } from "react";
import type { RootState } from "@react-three/fiber";
import { Crosshair } from "@/components/Crosshair";
import { PauseOverlay } from "@/components/PauseOverlay";
import { IdleScreen } from "@/components/IdleScreen";
import { CountdownOverlay } from "@/components/CountdownOverlay";
import { FinishedOverlay } from "@/components/FinishedOverlay";
import { TimerBar } from "@/components/TimerBar";
import { FpsCounter } from "@/components/FpsCounter";
import { SettingsDialog } from "@/components/SettingsDialog";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { useSettings } from "@/hooks/useSettings";
import { useR3FBridge } from "@/hooks/useR3FBridge";
import { useGameLogic } from "@/hooks/useGameLogic";
import { useGameStore, useSettingsStore } from "@/stores/gameStore";
import { useTheme, type Theme } from "@/hooks/useTheme";
import { SceneCanvas } from "@/components/r3f/SceneCanvas";
import { toast } from "sonner";
import { setMasterVolume } from "@/lib/sounds";

export default function GameBoard() {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const settings = useSettings();
  const {
    openSettings: openTrainingSettings,
    cancelSettings: cancelTrainingSettings,
    saveSettings: saveTrainingSettings,
  } = settings;
  const bridge = useR3FBridge();
  const { theme, setTheme } = useTheme();
  const volume = useSettingsStore((s) => s.volume);
  const volumePreview = useSettingsStore((s) => s.volumePreview);
  const setVolume = useSettingsStore((s) => s.setVolume);
  const setVolumePreview = useSettingsStore((s) => s.setVolumePreview);
  const clearVolumePreview = useSettingsStore((s) => s.clearVolumePreview);

  useEffect(() => {
    setMasterVolume(volumePreview ?? volume);
  }, [volume, volumePreview]);

  // 主题面板状态
  const [tempTheme, setTempTheme] = useState<Theme>(theme);
  const [tempVolume, setTempVolumeDraft] = useState(volume);

  const openSettings = useCallback(() => {
    openTrainingSettings();
    clearVolumePreview();
    setTempTheme(theme);
    setTempVolumeDraft(volume);
  }, [clearVolumePreview, openTrainingSettings, theme, volume]);

  const cancelSettings = useCallback(() => {
    clearVolumePreview();
    cancelTrainingSettings();
  }, [cancelTrainingSettings, clearVolumePreview]);

  const previewVolume = useCallback((nextVolume: number) => {
    setTempVolumeDraft(nextVolume);
    setVolumePreview(nextVolume);
  }, [setVolumePreview]);

  const saveSettings = useCallback(() => {
    saveTrainingSettings();
    setTheme(tempTheme);
    setVolume(tempVolume);
  }, [saveTrainingSettings, setTheme, setVolume, tempTheme, tempVolume]);

  const game = useGameLogic({
    targetsRef: bridge.targetsRef,
    cameraRef: bridge.cameraRef,
    raycasterRef: bridge.raycasterRef,
    mouseAccum: bridge.mouseAccum,
    containerRef: bridge.canvasRef,
  });
  const { triggerStart, triggerResume } = game;

  // 稳定回调
  const handlePauseHome = useCallback(() => {
    document.exitPointerLock();
    useGameStore.getState().setGameState("idle");
  }, []);

  const handlePauseRestart = useCallback(() => {
    document.exitPointerLock();
    triggerStart();
  }, [triggerStart]);

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
          onResume={triggerResume}
          onOpenFeedback={() => setFeedbackOpen(true)}
        />
      )}

      {/* 开始页面 */}
      {game.gameState === "idle" && (
        <IdleScreen
          onStart={triggerStart}
          onOpenSettings={openSettings}
          onOpenFeedback={() => setFeedbackOpen(true)}
        />
      )}

      {game.gameState === "idle" && (
        <SettingsDialog
          open={settings.showSettings}
          onCancel={cancelSettings}
          onSave={saveSettings}
          tempSensitivity={settings.tempSensitivity}
          tempGridSize={settings.tempGridSize}
          tempDuration={settings.tempDuration}
          setTempSensitivity={settings.setTempSensitivity}
          setTempGridSize={settings.setTempGridSize}
          setTempDuration={settings.setTempDuration}
          tempTargetSize={settings.tempTargetSize}
          setTempTargetSize={settings.setTempTargetSize}
          tempTheme={tempTheme}
          setTempTheme={setTempTheme}
          tempVolume={tempVolume}
          setTempVolume={previewVolume}
        />
      )}

      {/* 结束页面 */}
      {game.gameState === "finished" && (
        <FinishedOverlay
          stats={game.gameStats}
          onRestart={triggerStart}
          onHome={handleFinishedHome}
          onOpenFeedback={() => setFeedbackOpen(true)}
        />
      )}

      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />

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
        gameSessionId={game.gameSessionId}
        timeLeftRef={game.timeLeftRef}
      />
    </div>
  );
}
