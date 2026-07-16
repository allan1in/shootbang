"use client";

import { type ReactNode } from "react";
import { Canvas, type RootState } from "@react-three/fiber";
import * as THREE from "three";
import { SceneBridge, CameraController, SceneLights, RoomWalls, TargetPool } from "./SceneSetup";
import { Thunderstorm } from "./Thunderstorm";
import { Blizzard } from "./Blizzard";
import { FramePerformanceMonitor } from "./FramePerformanceMonitor";

interface SceneCanvasProps {
  className?: string;
  onCreated?: (state: RootState) => void;
  children?: ReactNode;
  sceneProvider: (props: { children: ReactNode }) => ReactNode;
  gameState?: string;
  theme?: string;
  gameSessionId: number;
}

export function SceneCanvas({ className, onCreated, children, sceneProvider: SceneProvider, gameState, theme, gameSessionId }: SceneCanvasProps) {
  return (
    <Canvas
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.2,
      }}
      camera={{
        fov: 73.74,
        position: [0, 6.5, 12.5],
        near: 0.1,
        far: 100,
      }}
      dpr={[1, 2]}
      onCreated={(state) => {
        state.gl.shadowMap.enabled = true;
        state.gl.shadowMap.type = THREE.PCFShadowMap;
        onCreated?.(state);
      }}
      className={className}
      style={{ touchAction: "none" }}
    >
      <FramePerformanceMonitor gameSessionId={gameSessionId} />
      <SceneProvider>
        <SceneBridge theme={theme} />
        <CameraController />
        <SceneLights />
        <RoomWalls theme={theme} />
        <TargetPool gameState={gameState ?? "idle"} theme={theme} />
        {theme === "thunderstorm" && <Thunderstorm />}
        {theme === "blizzard" && <Blizzard />}
        {children}
      </SceneProvider>
    </Canvas>
  );
}
