"use client";

import { useEffect, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { startWind, stopWind, setWindWhiteout, muteWind } from "@/lib/blizzardAudio";
import {
  getBlizzardGustProgress,
  type BlizzardGustTimeline,
} from "@/lib/blizzardTimeline";
import { useSettingsStore } from "@/stores/gameStore";

// ---- Whiteout helper ----

function applyWhiteout(
  t: number,
  fog: THREE.Fog,
  scene: THREE.Scene,
  ambient: THREE.AmbientLight,
  whiteBg: THREE.Color,
  whiteFog: THREE.Color,
  originalNear: number,
  originalFogColor: THREE.Color,
  originalBg: THREE.Color,
) {
  fog.near = THREE.MathUtils.lerp(originalNear, 0.5, t);
  fog.far = THREE.MathUtils.lerp(80, 30, t);
  fog.color.lerpColors(originalFogColor, whiteFog, t);
  if (scene.background instanceof THREE.Color) {
    scene.background.lerpColors(originalBg, whiteBg, t);
  }
  ambient.intensity = t * 0.6;
}

// ---- Snow: InstancedMesh + small PlaneGeometry flakes ----

const PARTICLE_COUNT = 4000;
const BASE_PARTICLE_COUNT = 2000;
const WHITEOUT_MAX_INTENSITY = 0.7;
const ROOM_X = 25;
const ROOM_Y_MIN = -30;
const ROOM_Y_MAX = 60;
const ROOM_Z_MIN = -5;
const ROOM_Z_MAX = 30;

const snowPositions: [number, number, number][] = [];
const snowVelocities: [number, number, number][] = [];
const snowWindResponses: number[] = [];
for (let i = 0; i < PARTICLE_COUNT; i++) {
  snowPositions.push([
    (Math.random() - 0.5) * ROOM_X * 3,
    Math.random() * (ROOM_Y_MAX - ROOM_Y_MIN) + ROOM_Y_MIN,
    Math.random() * (ROOM_Z_MAX - ROOM_Z_MIN) + ROOM_Z_MIN,
  ]);
  snowVelocities.push([
    (Math.random() - 0.5) * 1.5,
    -(2 + Math.random() * 2),
    (Math.random() - 0.5) * 0.8,
  ]);
  // Keep a coherent gust direction while varying each flake's response slightly.
  snowWindResponses.push(0.7 + Math.random() * 0.6);
}

function Snow({ whiteoutRef }: { whiteoutRef: RefObject<number> }) {
  const { scene, camera } = useThree();
  const meshRef = useRef<THREE.InstancedMesh | null>(null);
  const matRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const dummyRef = useRef(new THREE.Object3D());

  useEffect(() => {
    const geo = new THREE.PlaneGeometry(0.08, 0.08);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });

    const mesh = new THREE.InstancedMesh(geo, mat, PARTICLE_COUNT);
    mesh.renderOrder = 999;
    scene.add(mesh);
    meshRef.current = mesh;
    matRef.current = mat;

    return () => {
      scene.remove(mesh);
      geo.dispose();
      mat.dispose();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const dt = Math.min(delta, 0.05);
    const w = whiteoutRef.current;
    const gustProgress = Math.min(1, w / WHITEOUT_MAX_INTENSITY);
    const speedMul = 1 + gustProgress * 1.5;
    const gustDrift = gustProgress * 5.5 * dt;

    if (matRef.current) matRef.current.opacity = 0.7 + gustProgress * 0.25;
    mesh.count = Math.floor(
      BASE_PARTICLE_COUNT + gustProgress * (PARTICLE_COUNT - BASE_PARTICLE_COUNT),
    );

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = snowPositions[i];
      const v = snowVelocities[i];
      p[0] += v[0] * dt * speedMul + gustDrift * snowWindResponses[i];
      p[1] += v[1] * dt * (1 + gustProgress * 0.5);
      p[2] += v[2] * dt * speedMul;
      if (p[1] < ROOM_Y_MIN) {
        // Left-biased reset to refill the left side during sustained wind
        p[0] = (Math.random() - 0.65) * ROOM_X * 3;
        p[1] = ROOM_Y_MAX;
        p[2] = Math.random() * (ROOM_Z_MAX - ROOM_Z_MIN) + ROOM_Z_MIN;
      }

      const dummy = dummyRef.current;
      dummy.position.set(p[0], p[1], p[2]);
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

// ---- OvercastSkyBlizzard: procedural noise clouds ----

const cloudVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const cloudFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uWhiteout;
  varying vec2 vUv;

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
    n = n * 0.5 + 0.5;
    n = smoothstep(0.3, 0.75, n);

    vec3 darkCloud = vec3(0.03, 0.03, 0.04);
    vec3 lightCloud = vec3(0.12, 0.13, 0.16);
    vec3 color = mix(darkCloud, lightCloud, n);
    float alpha = 0.6 + n * 0.4;

    float edgeDist = length(vUv - 0.5) * 2.0;
    float edgeFade = 1.0 - smoothstep(0.5, 1.0, edgeDist);
    alpha *= edgeFade;

    color = mix(color, vec3(0.68, 0.70, 0.74), uWhiteout * 0.85);
    alpha *= 1.0 + uWhiteout * 0.5;

    gl_FragColor = vec4(color, alpha);
  }
`;

function OvercastSkyBlizzard({ whiteoutRef }: { whiteoutRef: RefObject<number> }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  useFrame(({ clock }) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = clock.elapsedTime;
      matRef.current.uniforms.uWhiteout.value = whiteoutRef.current;
    }
  });

  return (
    <mesh position={[0, 13.6, 12.5]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[50, 50]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={cloudVertexShader}
        fragmentShader={cloudFragmentShader}
        uniforms={{ uTime: { value: 0 }, uWhiteout: { value: 0 } }}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

// ---- WhiteoutGust: blizzard visibility event ----

function WhiteoutGust({ whiteoutRef }: { whiteoutRef: RefObject<number> }) {
  const { scene } = useThree();
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const pendingGustRef = useRef<BlizzardGustTimeline | null>(null);
  const muted = useSettingsStore(
    (s) => (s.volumePreview ?? s.volume) === 0,
  );

  // Wind audio lifecycle
  useEffect(() => {
    const onGust = (timeline: BlizzardGustTimeline) => {
      pendingGustRef.current = timeline;
    };
    startWind(onGust);
    return () => stopWind(true);
  }, []);

  // Mute toggle: fade volume without destroying the audio graph
  useEffect(() => {
    muteWind(muted);
  }, [muted]);

  // Whiteout state machine
  useEffect(() => {
    const ambient = ambientRef.current;
    if (!ambient) return;

    let activeGust: {
      timeline: BlizzardGustTimeline;
      elapsed: number;
    } | null = null;
    let lastTime = performance.now();

    const fog = scene.fog as THREE.Fog;
    const originalNear = fog.near;
    const originalFogColor = fog.color.clone();
    const originalBg = (scene.background as THREE.Color).clone();

    const whiteBg = new THREE.Color(0x969da7);
    const whiteFog = new THREE.Color(0x8c939d);

    let rafId: number;
    const tick = () => {
      rafId = requestAnimationFrame(tick);
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      if (!activeGust && pendingGustRef.current) {
        activeGust = {
          timeline: pendingGustRef.current,
          elapsed: 0,
        };
        pendingGustRef.current = null;
      }

      let progress = 0;
      if (activeGust) {
        activeGust.elapsed = Math.min(
          activeGust.timeline.totalDuration,
          activeGust.elapsed + dt,
        );
        progress = getBlizzardGustProgress(
          activeGust.elapsed,
          activeGust.timeline,
        );

        if (activeGust.elapsed >= activeGust.timeline.totalDuration) {
          activeGust = null;
        }
      }

      const t = progress * WHITEOUT_MAX_INTENSITY;
      applyWhiteout(
        t,
        fog,
        scene,
        ambient,
        whiteBg,
        whiteFog,
        originalNear,
        originalFogColor,
        originalBg,
      );
      whiteoutRef.current = t;
      document.documentElement.style.setProperty("--whiteout", String(whiteoutRef.current));
      setWindWhiteout(progress);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      ambient.intensity = 0;
      whiteoutRef.current = 0;
      fog.near = originalNear;
      fog.far = 80;
      fog.color.copy(originalFogColor);
      if (scene.background instanceof THREE.Color) scene.background.copy(originalBg);
      document.documentElement.style.removeProperty("--whiteout");
    };
  }, [whiteoutRef, scene]);

  return <ambientLight ref={ambientRef} intensity={0} />;
}

// ---- Blizzard: composed export ----

export function Blizzard() {
  const whiteoutRef = useRef(0);

  return (
    <>
      <OvercastSkyBlizzard whiteoutRef={whiteoutRef} />
      <Snow whiteoutRef={whiteoutRef} />
      <WhiteoutGust whiteoutRef={whiteoutRef} />
    </>
  );
}
