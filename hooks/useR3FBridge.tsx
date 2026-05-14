"use client";

import { createContext, useContext, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { type TargetState } from "@/lib/grid";

export interface R3FSceneContextValue {
  cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>;
  sceneRef: React.MutableRefObject<THREE.Scene | null>;
  targetsRef: React.MutableRefObject<TargetState[]>;
  raycasterRef: React.MutableRefObject<THREE.Raycaster>;
  mouseAccum: React.MutableRefObject<{ x: number; y: number }>;
  canvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
}

const R3FSceneContext = createContext<R3FSceneContextValue | null>(null);

export function useR3FScene(): R3FSceneContextValue {
  const ctx = useContext(R3FSceneContext);
  if (!ctx) throw new Error("useR3FScene must be used inside SceneProvider");
  return ctx;
}

export function useR3FBridge() {
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const targetsRef = useRef<TargetState[]>([]);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseAccum = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  function SceneProvider({ children }: { children: ReactNode }) {
    return (
      <R3FSceneContext.Provider
        value={{
          cameraRef,
          sceneRef,
          targetsRef,
          raycasterRef,
          mouseAccum,
          canvasRef,
        }}
      >
        {children}
      </R3FSceneContext.Provider>
    );
  }

  return {
    cameraRef,
    sceneRef,
    targetsRef,
    raycasterRef,
    mouseAccum,
    canvasRef,
    SceneProvider,
  };
}
