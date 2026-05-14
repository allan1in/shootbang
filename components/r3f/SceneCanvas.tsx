"use client";

import { type ReactNode } from "react";
import { Canvas, type RootState } from "@react-three/fiber";
import * as THREE from "three";
import { SceneBridge, CameraController, SceneLights, RoomWalls, TargetPool } from "./SceneSetup";

interface SceneCanvasProps {
  className?: string;
  onCreated?: (state: RootState) => void;
  children?: ReactNode;
  sceneProvider: (props: { children: ReactNode }) => ReactNode;
  gameState?: string;
}

export function SceneCanvas({ className, onCreated, children, sceneProvider: SceneProvider, gameState }: SceneCanvasProps) {
  return (
    <Canvas
      shadows
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
        state.gl.shadowMap.type = THREE.PCFShadowMap;
        onCreated?.(state);
      }}
      className={className}
      style={{ touchAction: "none" }}
    >
      <SceneProvider>
        <SceneBridge />
        <CameraController />
        <SceneLights />
        <RoomWalls />
        <TargetPool gameState={gameState ?? "idle"} />
        {children}
      </SceneProvider>
    </Canvas>
  );
}
