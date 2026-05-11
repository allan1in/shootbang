"use client";

import { useEffect } from "react";
import { AuthDialog } from "@/components/AuthDialog";
import { Crosshair } from "@/components/Crosshair";
import { Hud } from "@/components/Hud";
import { PauseOverlay } from "@/components/PauseOverlay";
import { IdleScreen } from "@/components/IdleScreen";
import { FinishedScreen } from "@/components/FinishedScreen";
import { CountdownOverlay } from "@/components/CountdownOverlay";
import { useSettings } from "@/hooks/useSettings";
import { useAuth } from "@/hooks/useAuth";
import { useThreeScene } from "@/hooks/useThreeScene";
import { useGameLogic } from "@/hooks/useGameLogic";
import { useScoreSubmission } from "@/hooks/useScoreSubmission";

export default function GameBoard() {
  const settings = useSettings();
  const auth = useAuth();
  const scene = useThreeScene();

  /* eslint-disable react-hooks/refs -- 传递 ref 对象本身，非 .current 值 */
  const game = useGameLogic({
    targetsRef: scene.targetsRef,
    cameraRef: scene.cameraRef,
    raycasterRef: scene.raycasterRef,
    mouseAccum: scene.mouseAccum,
    containerRef: scene.containerRef,
    gridPositionsRef: settings.gridPositionsRef,
    targetCountRef: settings.targetCountRef,
    durationRef: settings.durationRef,
    sensitivityRef: settings.sensitivityRef,
    targetSizeRef: settings.targetSizeRef,
  });
  /* eslint-enable react-hooks/refs */

  const scores = useScoreSubmission({
    gameState: game.gameState,
    score: game.score,
    hits: game.hits,
    totalClicks: game.totalClicks,
    hitRate: game.hitRate,
    reactionAvg: game.reactionAvg,
    gridSize: settings.gridSize,
    targetCount: settings.targetCount,
    duration: settings.duration,
    targetSize: settings.targetSize,
    user: auth.user,
    shotLogRef: game.shotLogRef,
  });

  // 动画循环 - 仅在 playing 状态运行
  useEffect(() => {
    const renderer = scene.rendererRef.current;
    const camera = scene.cameraRef.current;
    const sc = scene.sceneRef.current;
    if (!renderer || !camera || !sc) return;

    if (game.gameState !== "playing") {
      renderer.setAnimationLoop(null);
      /* eslint-disable react-hooks/immutability */
      for (const t of scene.targetsRef.current) t.mesh.visible = false;
      /* eslint-enable react-hooks/immutability */
      renderer.render(sc, camera);
      return;
    }

    renderer.setAnimationLoop(() => {
      camera.rotation.y = scene.mouseAccum.current.x;
      camera.rotation.x = Math.max(
        -Math.PI / 2,
        Math.min(Math.PI / 2, scene.mouseAccum.current.y),
      );
      renderer.render(sc, camera);
    });

    return () => {
      renderer.setAnimationLoop(null);
    };
  }, [game.gameState]);

  return (
    <div className="relative w-full h-screen bg-background">
      {/* 准星 */}
      {game.gameState === "playing" && game.isLocked && (
        <Crosshair
          size={settings.crosshairSize}
          style={settings.crosshairStyle}
        />
      )}

      {/* HUD */}
      {game.gameState === "playing" && (
        <Hud
          score={game.score}
          timeLeft={game.timeLeft}
          hitRate={game.hitRate}
          streak={game.streak}
          floatingScores={game.floatingScores}
        />
      )}

      {/* 暂停提示 */}
      {game.gameState === "playing" && game.isPaused && (
        <PauseOverlay
          onHome={() => {
            document.exitPointerLock();
            game.setGameState("idle");
          }}
          onRestart={() => {
            document.exitPointerLock();
            game.triggerStart();
          }}
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
          onSaveSettings={() => settings.saveSettings(auth.user)}
          tempSensitivity={settings.tempSensitivity}
          tempGridSize={settings.tempGridSize}
          tempTargetCount={settings.tempTargetCount}
          tempDuration={settings.tempDuration}
          setTempSensitivity={settings.setTempSensitivity}
          setTempGridSize={settings.setTempGridSize}
          setTempTargetCount={settings.setTempTargetCount}
          setTempDuration={settings.setTempDuration}
          tempCrosshairSize={settings.tempCrosshairSize}
          tempCrosshairStyle={settings.tempCrosshairStyle}
          tempTargetSize={settings.tempTargetSize}
          setTempCrosshairSize={settings.setTempCrosshairSize}
          setTempCrosshairStyle={settings.setTempCrosshairStyle}
          setTempTargetSize={settings.setTempTargetSize}
          user={auth.user}
          onLogout={() => {
            fetch("/api/auth/logout", { method: "POST" }).then(() =>
              auth.setUser(null),
            );
          }}
          onShowAuth={() => auth.setShowAuth(true)}
        />
      )}

      {/* 结算页面 */}
      {game.gameState === "finished" && (
        <FinishedScreen
          score={game.score}
          hits={game.hits}
          totalClicks={game.totalClicks}
          hitRate={game.hitRate}
          reactionAvg={game.reactionAvg}
          isNewBest={scores.isNewBest}
          shotLog={game.shotLogRef.current}
          shotHits={game.shotHitsRef.current}
          scoreBreakdown={game.scoreBreakdownRef.current}
          gridSize={settings.gridSize}
          targetCount={settings.targetCount}
          duration={settings.duration}
          targetSize={settings.targetSize}
          onRestart={game.triggerStart}
          onGoHome={() => game.setGameState("idle")}
        />
      )}

      {/* 倒计时 */}
      <CountdownOverlay countdown={game.countdown} />

      {/* 登录/注册对话框 */}
      <AuthDialog
        open={auth.showAuth}
        onClose={() => auth.setShowAuth(false)}
        onAuth={(u) => {
          auth.setUser(u);
          scores.setIsNewBest(false);
          // 登录后从数据库同步设置覆盖本地
          fetch("/api/settings")
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
              if (data?.settings) {
                settings.applySettingsFromServer(data.settings);
              }
            })
            .catch(() => {});
        }}
      />

      {/* 3D 场景 */}
      <div
        ref={scene.containerRef} // eslint-disable-line react-hooks/refs -- 传递 ref 对象本身
        tabIndex={-1}
        className={`w-full h-full ${game.isLocked ? "cursor-none" : "cursor-default"}`}
      />
    </div>
  );
}
