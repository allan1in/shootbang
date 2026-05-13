"use client";

import { useEffect } from "react";
import { RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Crosshair } from "@/components/Crosshair";
import { PauseOverlay } from "@/components/PauseOverlay";
import { IdleScreen } from "@/components/IdleScreen";
import { CountdownOverlay } from "@/components/CountdownOverlay";
import { useSettings } from "@/hooks/useSettings";
import { useThreeScene } from "@/hooks/useThreeScene";
import { useGameLogic } from "@/hooks/useGameLogic";

export default function GameBoard() {
  const settings = useSettings();
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

  // 动画循环
  useEffect(() => {
    const renderer = scene.rendererRef.current;
    const camera = scene.cameraRef.current;
    const sc = scene.sceneRef.current;
    if (!renderer || !camera || !sc) return;

    if (game.gameState === "playing") {
      renderer.setAnimationLoop(() => {
        camera.rotation.y = scene.mouseAccum.current.x;
        camera.rotation.x = Math.max(
          -Math.PI / 2,
          Math.min(Math.PI / 2, scene.mouseAccum.current.y),
        );
        renderer.render(sc, camera);
      });
    } else {
      renderer.setAnimationLoop(null);
      /* eslint-disable react-hooks/immutability */
      for (const t of scene.targetsRef.current) t.mesh.visible = false;
      /* eslint-enable react-hooks/immutability */
      renderer.render(sc, camera);
    }

    return () => {
      renderer.setAnimationLoop(null);
    };
  }, [game.gameState]);

  return (
    <div className="relative w-full h-screen bg-background">
      {/* 准星 */}
      {game.gameState === "playing" && game.isLocked && (
        <Crosshair />
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
          onSaveSettings={settings.saveSettings}
          tempSensitivity={settings.tempSensitivity}
          tempGridSize={settings.tempGridSize}
          tempDuration={settings.tempDuration}
          setTempSensitivity={settings.setTempSensitivity}
          setTempGridSize={settings.setTempGridSize}
          setTempDuration={settings.setTempDuration}
          tempTargetSize={settings.tempTargetSize}
          setTempTargetSize={settings.setTempTargetSize}
        />
      )}

      {/* 结束页面 */}
      {game.gameState === "finished" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/50 cursor-default">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon-lg"
              className="cursor-pointer border-foreground/10"
              aria-label="再来一局"
              onClick={game.triggerStart}
            >
              <RotateCcw className="size-5" />
            </Button>
            <Button
              variant="outline"
              size="icon-lg"
              className="cursor-pointer border-foreground/10"
              aria-label="返回首页"
              onClick={() => game.setGameState("idle")}
            >
              <Home className="size-5" />
            </Button>
          </div>
        </div>
      )}

      {/* 倒计时 */}
      <CountdownOverlay countdown={game.countdown} />

      {/* 3D 场景 */}
      <div
        ref={scene.containerRef} // eslint-disable-line react-hooks/refs -- 传递 ref 对象本身
        tabIndex={-1}
        className={`w-full h-full ${game.isLocked ? "cursor-none" : "cursor-default"}`}
      />
    </div>
  );
}
