"use client";

import { useEffect } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { type TargetState, hideAllTargets } from "@/lib/grid";
import { GAME_BACKGROUND_COLOR, TARGET_COLOR } from "@/lib/sceneColors";
import { useR3FScene } from "@/hooks/useR3FBridge";

// ---- SceneBridge: populates sceneRef/cameraRef from R3F internals ----

export function SceneBridge({ theme }: { theme?: string }) {
  const { scene, camera } = useThree();
  const { sceneRef, cameraRef } = useR3FScene();

  useEffect(() => { // eslint-disable-line react-hooks/immutability
    sceneRef.current = scene;
    cameraRef.current = camera as THREE.PerspectiveCamera;
    camera.rotation.order = "YXZ"; // eslint-disable-line react-hooks/immutability

    const bgColor = GAME_BACKGROUND_COLOR;
    scene.background = new THREE.Color(bgColor); // eslint-disable-line react-hooks/immutability
    scene.fog = theme === "blizzard"
      ? new THREE.Fog(bgColor, 3, 80)
      : new THREE.Fog(bgColor, 15, 80);
  }, [scene, camera, sceneRef, cameraRef, theme]);

  return null;
}

// ---- CameraController: useFrame updates camera rotation from mouseAccum ----

export function CameraController() {
  const { camera } = useThree();
  const { mouseAccum } = useR3FScene();

  useEffect(() => {
    camera.rotation.order = "YXZ"; // eslint-disable-line react-hooks/immutability
  }, [camera]);

  useFrame(() => {
    camera.rotation.y = mouseAccum.current.x; // eslint-disable-line react-hooks/immutability
    camera.rotation.x = Math.max(
      -Math.PI / 2,
      Math.min(Math.PI / 2, mouseAccum.current.y),
    );
  });

  return null;
}

// ---- SceneLights: realistic room lighting ----

export function SceneLights() {
  return (
    <>
      {/* 天空/地面梯度：天花板偏亮偏冷，地板方向偏暗偏暖 */}
      <hemisphereLight args={[0x8899bb, 0x443322, 0.5]} />
      {/* 主光：右上前方，负责照亮目标球 + 投射阴影 */}
      <directionalLight
        position={[3, 8, 4]}
        intensity={0.9}
        castShadow
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
      />
      {/* 补光：左后方冷色，模拟窗户/天空反射 */}
      <directionalLight position={[-4, 6, -3]} intensity={0.4} color={0x88aacc} />
      {/* 补光：正上方偏后 */}
      <directionalLight position={[0, 10, -6]} intensity={0.3} color={0x99bbdd} />
      {/* 地面反射：从下方向上微弱暖光，模拟地板弹射光 */}
      <directionalLight position={[0, -2, 8]} intensity={0.15} color={0x554433} />
    </>
  );
}

// ---- TargetPool: 10 sphere meshes (R3F-managed via JSX, ref callback) ----

const SPHERE_COLORS: Record<string, string> = {
  default: TARGET_COLOR,
  thunderstorm: TARGET_COLOR,
  blizzard: TARGET_COLOR,
};
const MAX_TARGETS = 10;

export function TargetPool({ gameState, theme }: { gameState: string; theme?: string }) {
  const { targetsRef } = useR3FScene();
  const sphereColor = SPHERE_COLORS[theme ?? "default"] ?? SPHERE_COLORS.default;

  // When game is not playing, ensure targets are hidden
  // (handles mesh recreation after R3F re-render)
  useEffect(() => {
    if (gameState !== "playing") {
      hideAllTargets(targetsRef.current);
    }
  }, [gameState, targetsRef]);

  return (
    <group>
      {Array.from({ length: MAX_TARGETS }, (_, i) => (
        <TargetSphere key={i} index={i} targetsRef={targetsRef} color={sphereColor} transparent={theme === "blizzard"} />
      ))}
    </group>
  );
}

function TargetSphere({
  index,
  targetsRef,
  color,
  transparent,
}: {
  index: number;
  targetsRef: React.MutableRefObject<TargetState[]>;
  color: string;
  transparent?: boolean;
}) {
  return (
    <mesh
      ref={(mesh) => {
        if (!mesh) return;
        mesh.castShadow = true;
        const existing = targetsRef.current[index];
        if (existing) {
          // R3F recreated the mesh — restore spawn state
          mesh.visible = existing.mesh.visible;
          mesh.position.copy(existing.mesh.position);
          mesh.scale.copy(existing.mesh.scale);
          existing.mesh = mesh;
        } else {
          mesh.visible = false;
          targetsRef.current[index] = { mesh, gridIndex: -1, spawnTime: 0 };
        }
      }}
    >
      <sphereGeometry args={[0.4, 32, 32]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.3}
        roughness={0.2}
        metalness={0.3}
        transparent={transparent}
        opacity={transparent ? 0.7 : 1}
      />
    </mesh>
  );
}
