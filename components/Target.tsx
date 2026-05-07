"use client";

import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface TargetProps {
  position: [number, number, number];
  onHit: () => void;
  isActive: boolean;
}

export default function Target({ position, onHit, isActive }: TargetProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [isHovered, setIsHovered] = useState(false);
  const startTime = useRef(Date.now());

  useFrame(() => {
    if (meshRef.current && isActive) {
      const elapsed = (Date.now() - startTime.current) / 1000;
      meshRef.current.position.y =
        position[1] + Math.sin(elapsed * 2) * 0.08;
      meshRef.current.scale.setScalar(isHovered ? 1.15 : 1);
    }
  });

  const handleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (isActive) {
      onHit();
    }
  };

  if (!isActive) return null;

  return (
    <mesh
      ref={meshRef}
      position={position}
      onClick={handleClick}
      onPointerOver={() => setIsHovered(true)}
      onPointerOut={() => setIsHovered(false)}
    >
      <sphereGeometry args={[0.35, 32, 32]} />
      <meshStandardMaterial
        color={isHovered ? "#ff6666" : "#ff2222"}
        emissive={isHovered ? "#ff4444" : "#cc0000"}
        emissiveIntensity={0.6}
        roughness={0.3}
        metalness={0.5}
      />
    </mesh>
  );
}
