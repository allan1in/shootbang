"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { RootState } from "@react-three/fiber";
import { Crosshair } from "@/components/Crosshair";
import { PauseOverlay } from "@/components/PauseOverlay";
import { IdleScreen } from "@/components/IdleScreen";
import { CountdownOverlay } from "@/components/CountdownOverlay";
import { EndingOverlay } from "@/components/EndingOverlay";
import { FinishedOverlay } from "@/components/FinishedOverlay";
import { TimerBar } from "@/components/TimerBar";
import { FpsCounter } from "@/components/FpsCounter";
import { SettingsDialog } from "@/components/SettingsDialog";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { UpdateAnnouncementDialog } from "@/components/UpdateAnnouncementDialog";
import { useSettings } from "@/hooks/useSettings";
import { useR3FBridge } from "@/hooks/useR3FBridge";
import { useGameLogic } from "@/hooks/useGameLogic";
import { useGameStore, useSettingsStore } from "@/stores/gameStore";
import { useTheme, type Theme } from "@/hooks/useTheme";
import { SceneCanvas } from "@/components/r3f/SceneCanvas";
import { toast } from "sonner";
import { setMasterVolume } from "@/lib/sounds";
import { markRendererStartupStage } from "@/lib/rendererStartupDiagnostics";
import { captureAnalytics } from "@/lib/analytics";
import { getTrainingProperties } from "@/lib/trainingAnalytics";
import {
  UPDATE_ANNOUNCEMENT_ID,
  UPDATE_ANNOUNCEMENT_STORAGE_KEY,
} from "@/lib/updateAnnouncement";

interface GameBoardProps {
  onRendererReady?: () => void;
}

export default function GameBoard({ onRendererReady }: GameBoardProps) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const announcementCheckedRef = useRef(false);
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
    markRendererStartupStage("gameboard-mounted");
    markRendererStartupStage("canvas-render-started");
  }, []);

  useEffect(() => {
    setMasterVolume(volumePreview ?? volume);
  }, [volume, volumePreview]);

  // 主题面板状态
  const [tempTheme, setTempTheme] = useState<Theme>(theme);
  const [tempVolume, setTempVolumeDraft] = useState(volume);

  const openSettings = useCallback(() => {
    captureAnalytics("settings opened", {});
    openTrainingSettings();
    clearVolumePreview();
    setTempTheme(theme);
    setTempVolumeDraft(volume);
  }, [clearVolumePreview, openTrainingSettings, theme, volume]);

  const cancelSettings = useCallback(() => {
    captureAnalytics("settings dismissed", {});
    clearVolumePreview();
    cancelTrainingSettings();
  }, [cancelTrainingSettings, clearVolumePreview]);

  const previewVolume = useCallback((nextVolume: number) => {
    setTempVolumeDraft(nextVolume);
    setVolumePreview(nextVolume);
  }, [setVolumePreview]);

  const saveSettings = useCallback(() => {
    const before = useSettingsStore.getState();
    const changedFields = [
      ...(before.sensitivityMode !== settings.tempSensitivityMode ? ["sensitivity_mode"] : []),
      ...(JSON.stringify(before.sensitivities) !== JSON.stringify(settings.tempSensitivities) ? ["sensitivity"] : []),
      ...(before.duration !== settings.tempDuration ? ["duration"] : []),
      ...(before.gridSize !== settings.tempGridSize ? ["grid_size"] : []),
      ...(before.targetSize !== settings.tempTargetSize ? ["target_size"] : []),
      ...(JSON.stringify(before.crosshair) !== JSON.stringify(settings.tempCrosshair) ? ["crosshair"] : []),
      ...(theme !== tempTheme ? ["theme"] : []),
      ...(before.volume !== tempVolume ? ["volume"] : []),
    ];
    saveTrainingSettings();
    setTheme(tempTheme);
    setVolume(tempVolume);
    captureAnalytics("settings saved", { ...getTrainingProperties(), changed_fields: changedFields });
  }, [saveTrainingSettings, setTheme, setVolume, tempTheme, tempVolume, settings, theme]);

  const game = useGameLogic({
    targetsRef: bridge.targetsRef,
    cameraRef: bridge.cameraRef,
    raycasterRef: bridge.raycasterRef,
    mouseAccum: bridge.mouseAccum,
    containerRef: bridge.canvasRef,
  });
  const { triggerStart, triggerResume, abandonTraining } = game;

  const openFeedback = useCallback(() => {
    captureAnalytics("feedback opened", { source: useGameStore.getState().gameState });
    setFeedbackOpen(true);
  }, []);

  const showUpdateAnnouncement = useCallback(() => {
    if (announcementCheckedRef.current) return;
    announcementCheckedRef.current = true;
    try {
      if (
        localStorage.getItem(UPDATE_ANNOUNCEMENT_STORAGE_KEY) ===
        UPDATE_ANNOUNCEMENT_ID
      ) {
        return;
      }
      localStorage.setItem(
        UPDATE_ANNOUNCEMENT_STORAGE_KEY,
        UPDATE_ANNOUNCEMENT_ID,
      );
    } catch {
      // 存储不可用时仍展示一次，但不影响游戏初始化。
    }
    setAnnouncementOpen(true);
  }, []);

  // 稳定回调
  const handlePauseHome = useCallback(() => {
    abandonTraining("home");
    document.exitPointerLock();
    useGameStore.getState().setGameState("idle");
  }, [abandonTraining]);

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
      onRendererReady?.();
      showUpdateAnnouncement();
    },
    [bridge.canvasRef, onRendererReady, showUpdateAnnouncement],
  );

  return (
    <div
      className="relative w-full h-screen bg-background"
      data-game-renderer-root
    >
      {/* 计时进度条 */}
      {game.gameState === "playing" && (
        <TimerBar timeLeftRef={game.timeLeftRef} duration={settings.duration} />
      )}

      {/* 帧率 */}
      <FpsCounter />

      {/* 准星 */}
      {game.gameState === "playing" && game.isLocked && (
        <Crosshair settings={settings.crosshair} />
      )}

      {/* 暂停提示 */}
      {game.gameState === "playing" && game.isPaused && (
        <PauseOverlay
          onHome={handlePauseHome}
          onRestart={handlePauseRestart}
          onResume={triggerResume}
          onOpenFeedback={openFeedback}
        />
      )}

      {/* 开始页面 */}
      {game.gameState === "idle" && (
        <IdleScreen
          onStart={triggerStart}
          onOpenSettings={openSettings}
          onOpenFeedback={openFeedback}
        />
      )}

      {game.gameState === "idle" && (
        <SettingsDialog
          open={settings.showSettings}
          onCancel={cancelSettings}
          onSave={saveSettings}
          tempSensitivityMode={settings.tempSensitivityMode}
          tempSensitivities={settings.tempSensitivities}
          tempGridSize={settings.tempGridSize}
          tempDuration={settings.tempDuration}
          setTempSensitivity={settings.setTempSensitivity}
          setTempSensitivityMode={settings.setTempSensitivityMode}
          setTempGridSize={settings.setTempGridSize}
          setTempDuration={settings.setTempDuration}
          tempTargetSize={settings.tempTargetSize}
          setTempTargetSize={settings.setTempTargetSize}
          tempCrosshair={settings.tempCrosshair}
          setTempCrosshair={settings.setTempCrosshair}
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
          onOpenFeedback={openFeedback}
        />
      )}

      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
      <UpdateAnnouncementDialog
        open={announcementOpen}
        onOpenChange={setAnnouncementOpen}
      />

      {/* 倒计时 */}
      {game.countdown !== null && (
        <CountdownOverlay countdown={game.countdown} />
      )}

      {game.gameState === "ending" && <EndingOverlay />}

      {/* 暴雪白化遮罩 */}
      {theme === "blizzard" && (
        <div
          className="absolute inset-0 z-10 pointer-events-none"
          style={{ backgroundColor: "rgba(190,196,205,0.08)", opacity: "var(--whiteout, 0)" }}
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
