"use client";

import { Canvas } from "@react-three/fiber";
import Target from "./Target";

interface SceneProps {
  targetPosition: [number, number, number];
  onTargetHit: () => void;
  isPlaying: boolean;
}

export default function Scene({
  targetPosition,
  onTargetHit,
  isPlaying,
}: SceneProps) {
  return (
    <Canvas
      camera={{ position: [0, 4, 6], fov: 50 }}
      style={{ background: "#0a0a1a" }}
    >
      {/* 灯光 */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 5]} intensity={0.8} />
      <pointLight position={[-3, 5, -3]} intensity={0.4} color="#4488ff" />

      {/* 网格地板 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]}>
        <planeGeometry args={[12, 12]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>

      {/* 网格线 */}
      <gridHelper args={[12, 12, "#333366", "#222244"]} position={[0, -0.49, 0]} />

      {/* 目标 */}
      {isPlaying && (
        <Target
          position={targetPosition}
          onHit={onTargetHit}
          isActive={true}
        />
      )}
    </Canvas>
  );
}
