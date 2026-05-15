"use client";

import { useEffect, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { playThunder, startRain, stopRain } from "@/lib/thunderAudio";
import { useSettingsStore } from "@/stores/gameStore";

// ---- Rain: InstancedMesh + PlaneGeometry streaks ----

const PARTICLE_COUNT = 2000;
const ROOM_X = 25;
const ROOM_Y_MIN = -30;
const ROOM_Y_MAX = 60;
const ROOM_Z_MIN = -5;
const ROOM_Z_MAX = 30;

// Initialize particle data at module scope to satisfy React compiler
const rainPositions: [number, number, number][] = [];
const rainVelocities: [number, number, number][] = [];
for (let i = 0; i < PARTICLE_COUNT; i++) {
  rainPositions.push([
    (Math.random() - 0.5) * ROOM_X * 2,
    Math.random() * (ROOM_Y_MAX - ROOM_Y_MIN) + ROOM_Y_MIN,
    Math.random() * (ROOM_Z_MAX - ROOM_Z_MIN) + ROOM_Z_MIN,
  ]);
  rainVelocities.push([
    (Math.random() - 0.5) * 0.5,
    -(15 + Math.random() * 10),
    -(0.5 + Math.random()),
  ]);
}

function Rain() {
  const { scene, camera } = useThree();
  const meshRef = useRef<THREE.InstancedMesh | null>(null);
  const dummyRef = useRef(new THREE.Object3D());

  useEffect(() => {
    // Thin vertical plane — streak from the side, dot from below
    const geo = new THREE.PlaneGeometry(0.015, 0.5);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xaabbdd,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });

    const mesh = new THREE.InstancedMesh(geo, mat, PARTICLE_COUNT);
    mesh.renderOrder = 999;
    scene.add(mesh);
    meshRef.current = mesh;

    return () => {
      scene.remove(mesh);
      geo.dispose();
      mat.dispose();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    // 标签页恢复时 delta 可能很大，限制上限防止雨滴瞬移
    const dt = Math.min(delta, 0.05);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = rainPositions[i];
      const v = rainVelocities[i];
      p[0] += v[0] * dt;
      p[1] += v[1] * dt;
      p[2] += v[2] * dt;
      if (p[1] < ROOM_Y_MIN) {
        p[0] = (Math.random() - 0.5) * ROOM_X * 2;
        p[1] = ROOM_Y_MAX;
        p[2] = Math.random() * (ROOM_Z_MAX - ROOM_Z_MIN) + ROOM_Z_MIN;
      }

      const dummy = dummyRef.current;
      dummy.position.set(p[0], p[1], p[2]);
      // Face camera horizontally only — streak from side, dot from below
      const dx = camera.position.x - p[0];
      const dz = camera.position.z - p[2];
      dummy.rotation.set(0, Math.atan2(dx, dz), 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return null;
}

// ---- LightningFlash: ambient light + background modulation ----

type Phase = "idle" | "flash" | "fade";

function randomInterval() {
  return 3 + Math.random() * 5; // 3-8 seconds
}

function LightningFlash({ flashRef }: { flashRef: RefObject<number> }) {
  const { scene } = useThree();
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const dirRef = useRef<THREE.DirectionalLight>(null);

  useEffect(() => {
    const ambient = ambientRef.current;
    const dir = dirRef.current;
    if (!ambient || !dir) return;

    let phase: Phase = "idle";
    let timer = randomInterval();
    let flashTimer = 0;
    let fadeTimer = 0;
    let subFlashes = 0;
    let lastTime = performance.now();

    let originalBg: THREE.Color | null = null;
    if (scene.background && scene.background instanceof THREE.Color) {
      originalBg = scene.background.clone();
    }

    let rafId: number;
    const tick = () => {
      rafId = requestAnimationFrame(tick);
      const now = performance.now();
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      switch (phase) {
        case "idle": {
          flashRef.current = 0;
          timer -= delta;
          if (timer <= 0) {
            phase = "flash";
            flashTimer = 0.1 + Math.random() * 0.05;
            subFlashes = Math.random() < 0.3 ? 1 + Math.floor(Math.random() * 2) : 0;
          }
          break;
        }
        case "flash": {
          const intensity = 3.5 + Math.random() * 0.5;
          ambient.intensity = intensity;
          dir.intensity = intensity * 0.8;
          flashRef.current = intensity / 4.0;
          if (originalBg && scene.background instanceof THREE.Color) {
            scene.background.set(0xddeeff);
          }
          flashTimer -= delta;
          if (flashTimer <= 0) {
            phase = "fade";
            fadeTimer = 0.3 + Math.random() * 0.2;
            playThunder(0.3 + Math.random() * 1.2);
          }
          break;
        }
        case "fade": {
          fadeTimer -= delta;
          const t = Math.max(0, fadeTimer / 0.4);
          ambient.intensity = THREE.MathUtils.lerp(0, 3.5, t);
          dir.intensity = THREE.MathUtils.lerp(0, 2.8, t);
          flashRef.current = THREE.MathUtils.lerp(0, 0.9, t);
          if (originalBg && scene.background instanceof THREE.Color) {
            scene.background.lerpColors(originalBg, new THREE.Color(0xddeeff), t);
          }
          if (fadeTimer <= 0) {
            ambient.intensity = 0;
            flashRef.current = 0;
            if (originalBg && scene.background instanceof THREE.Color) {
              scene.background.copy(originalBg);
            }
            if (subFlashes > 0) {
              subFlashes--;
              phase = "flash";
              flashTimer = 0.08 + Math.random() * 0.04;
            } else {
              phase = "idle";
              timer = randomInterval();
            }
          }
          break;
        }
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      ambient.intensity = 0;
      dir.intensity = 0;
      flashRef.current = 0;
      if (originalBg && scene.background instanceof THREE.Color) {
        scene.background.copy(originalBg);
      }
    };
  }, [flashRef]);

  return (
    <>
      <ambientLight ref={ambientRef} intensity={0} />
      <directionalLight
        ref={dirRef}
        position={[0, 30, 0]}
        intensity={0}
        color={0xeef4ff}
      />
    </>
  );
}

// ---- OvercastSky: procedural noise clouds ----

const cloudVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const cloudFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uFlash;
  varying vec2 vUv;

  // Simplex-style noise helpers
  vec3 mod289(vec3 x) { return x - floor(x / 289.0) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x / 289.0) * 289.0; }
  vec3 permute(vec3 x) { return mod289((x * 34.0 + 1.0) * x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865, 0.366025403, -0.577350269, 0.024390243);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    for (int i = 0; i < 5; i++) {
      value += amplitude * snoise(p * frequency);
      amplitude *= 0.5;
      frequency *= 2.0;
    }
    return value;
  }

  void main() {
    vec2 uv = vUv * 3.0;
    float drift = uTime * 0.015;
    float n = fbm(uv + vec2(drift, drift * 0.3));
    n = n * 0.5 + 0.5; // remap to 0..1
    n = smoothstep(0.3, 0.75, n); // contrast

    vec3 darkCloud = vec3(0.03, 0.03, 0.04);
    vec3 lightCloud = vec3(0.12, 0.13, 0.16);
    vec3 color = mix(darkCloud, lightCloud, n);
    // Lightning flash: brighten clouds in sync with scene background
    color += vec3(uFlash * 0.85, uFlash * 0.88, uFlash * 0.95);
    float alpha = 0.6 + n * 0.4;

    // Edge fade: distance from center (0.5, 0.5) in UV space
    float edgeDist = length(vUv - 0.5) * 2.0; // 0 at center, 1 at edges
    float edgeFade = 1.0 - smoothstep(0.5, 1.0, edgeDist);
    alpha *= edgeFade;

    gl_FragColor = vec4(color, alpha);
  }
`;

function OvercastSky({ flashRef }: { flashRef: RefObject<number> }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  useFrame(({ clock }) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = clock.elapsedTime;
      matRef.current.uniforms.uFlash.value = flashRef.current;
    }
  });

  return (
    <mesh position={[0, 13.6, 12.5]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[50, 50]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={cloudVertexShader}
        fragmentShader={cloudFragmentShader}
        uniforms={{ uTime: { value: 0 }, uFlash: { value: 0 } }}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

// ---- Thunderstorm: composed export ----

export function Thunderstorm() {
  const flashRef = useRef(0);
  const muted = useSettingsStore((s) => s.muted);

  useEffect(() => {
    startRain();
    return stopRain;
  }, []);

  useEffect(() => {
    if (muted) {
      stopRain();
    } else {
      startRain();
    }
  }, [muted]);

  return (
    <>
      <OvercastSky flashRef={flashRef} />
      <Rain />
      <LightningFlash flashRef={flashRef} />
    </>
  );
}
