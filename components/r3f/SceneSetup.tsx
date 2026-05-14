"use client";

import { useEffect, useMemo } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { varToHex } from "@/lib/color";
import { type TargetState, hideAllTargets } from "@/lib/grid";
import { useR3FScene } from "@/hooks/useR3FBridge";

// ---- SceneBridge: populates sceneRef/cameraRef from R3F internals ----

export function SceneBridge() {
  const { scene, camera } = useThree();
  const { sceneRef, cameraRef } = useR3FScene();

  useEffect(() => { // eslint-disable-line react-hooks/immutability
    sceneRef.current = scene;
    cameraRef.current = camera as THREE.PerspectiveCamera;
    camera.rotation.order = "YXZ"; // eslint-disable-line react-hooks/immutability

    const cs = getComputedStyle(document.documentElement);
    scene.background = new THREE.Color(varToHex(cs, "--background")); // eslint-disable-line react-hooks/immutability
  }, [scene, camera, sceneRef, cameraRef]);

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

// ---- SceneLights: 4 lights matching original setup ----

export function SceneLights() {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[3, 8, 4]}
        intensity={1.0}
        castShadow
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
      />
      <directionalLight position={[-4, 6, -3]} intensity={0.6} color={0x88aacc} />
      <directionalLight position={[0, 10, -6]} intensity={0.4} color={0x88aacc} />
    </>
  );
}

// ---- RoomWalls: 6 walls + GridHelper overlays ----

interface WallDef {
  size: [number, number];
  pos: [number, number, number];
  rot: [number, number, number];
  gridPos: [number, number, number];
  gridRot: [number, number, number];
}

const WALLS: WallDef[] = [
  // 地板
  { size: [50, 50], pos: [0, -0.5, 12.5], rot: [-Math.PI / 2, 0, 0], gridPos: [0, -0.49, 12.5], gridRot: [0, 0, 0] },
  // 天花板
  { size: [50, 50], pos: [0, 13.5, 12.5], rot: [Math.PI / 2, 0, 0], gridPos: [0, 13.49, 12.5], gridRot: [0, 0, 0] },
  // 后墙
  { size: [50, 14], pos: [0, 6.5, -5], rot: [0, 0, 0], gridPos: [0, 6.5, -4.99], gridRot: [Math.PI / 2, 0, 0] },
  // 前墙
  { size: [50, 14], pos: [0, 6.5, 30], rot: [0, Math.PI, 0], gridPos: [0, 6.5, 29.99], gridRot: [Math.PI / 2, 0, 0] },
  // 左墙
  { size: [50, 14], pos: [-25, 6.5, 12.5], rot: [0, Math.PI / 2, 0], gridPos: [-24.99, 6.5, 12.5], gridRot: [0, 0, Math.PI / 2] },
  // 右墙
  { size: [50, 14], pos: [25, 6.5, 12.5], rot: [0, -Math.PI / 2, 0], gridPos: [24.99, 6.5, 12.5], gridRot: [0, 0, Math.PI / 2] },
];

const GRID_COLOR = 0x2a2a2e;

export function RoomWalls() {
  const wallColor = useMemo(() => {
    const cs = getComputedStyle(document.documentElement);
    return varToHex(cs, "--card");
  }, []);

  return (
    <group>
      {WALLS.map((w, i) => (
        <group key={i}>
          <mesh
            position={w.pos}
            rotation={w.rot}
            receiveShadow
          >
            <planeGeometry args={w.size} />
            <meshStandardMaterial color={wallColor} roughness={0.9} metalness={0.1} />
          </mesh>
          <gridHelper
            args={[50, 50, GRID_COLOR, GRID_COLOR]}
            position={w.gridPos}
            rotation={w.gridRot}
          />
        </group>
      ))}
    </group>
  );
}

// ---- TargetPool: 10 sphere meshes (R3F-managed via JSX, ref callback) ----

const SPHERE_COLOR = 0x9ca3af;
const MAX_TARGETS = 10;

export function TargetPool({ gameState }: { gameState: string }) {
  const { targetsRef } = useR3FScene();

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
        <TargetSphere key={i} index={i} targetsRef={targetsRef} />
      ))}
    </group>
  );
}

function TargetSphere({
  index,
  targetsRef,
}: {
  index: number;
  targetsRef: React.MutableRefObject<TargetState[]>;
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
        color={SPHERE_COLOR}
        emissive={SPHERE_COLOR}
        emissiveIntensity={0.3}
        roughness={0.2}
        metalness={0.3}
      />
    </mesh>
  );
}
