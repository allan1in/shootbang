"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { toast } from "sonner";
import { varToHex } from "@/lib/color";
import { type TargetState } from "@/lib/grid";

export function useThreeScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const targetsRef = useRef<TargetState[]>([]);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseAccum = useRef({ x: 0, y: 0 });

  // 初始化 Three.js 场景
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const cs = getComputedStyle(document.documentElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(varToHex(cs, "--background"));
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
    camera.position.set(0, 6.5, 12.5);
    camera.rotation.order = "YXZ";
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 灯光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.0);
    mainLight.position.set(3, 8, 4);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 512;
    mainLight.shadow.mapSize.height = 512;
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0x88aacc, 0.6);
    fillLight.position.set(-4, 6, -3);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x88aacc, 0.4);
    rimLight.position.set(0, 10, -6);
    scene.add(rimLight);

    // 立方体围壁
    const wallColor = varToHex(cs, "--card");
    const gridColor = 0x2a2a2e;
    const S = 50;
    const WH = 14;
    const gridDiv = 50;

    const addWall = (
      w: number,
      h: number,
      pos: [number, number, number],
      rot: [number, number, number],
      gridPos: [number, number, number],
      gridRot: [number, number, number],
    ) => {
      const geo = new THREE.PlaneGeometry(w, h);
      const mat = new THREE.MeshStandardMaterial({
        color: wallColor,
        roughness: 0.9,
        metalness: 0.1,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(...pos);
      mesh.rotation.set(...rot);
      mesh.receiveShadow = true;
      scene.add(mesh);

      const grid = new THREE.GridHelper(S, gridDiv, gridColor, gridColor);
      grid.position.set(...gridPos);
      grid.rotation.set(...gridRot);
      scene.add(grid);
    };

    // 地板
    addWall(S, S, [0, -0.5, 12.5], [-Math.PI / 2, 0, 0], [0, -0.49, 12.5], [0, 0, 0]);
    // 天花板
    addWall(S, S, [0, 13.5, 12.5], [Math.PI / 2, 0, 0], [0, 13.49, 12.5], [0, 0, 0]);
    // 后墙
    addWall(S, WH, [0, 6.5, -5], [0, 0, 0], [0, 6.5, -4.99], [Math.PI / 2, 0, 0]);
    // 前墙
    addWall(S, WH, [0, 6.5, 30], [0, Math.PI, 0], [0, 6.5, 29.99], [Math.PI / 2, 0, 0]);
    // 左墙
    addWall(S, WH, [-25, 6.5, 12.5], [0, Math.PI / 2, 0], [-24.99, 6.5, 12.5], [0, 0, Math.PI / 2]);
    // 右墙
    addWall(S, WH, [25, 6.5, 12.5], [0, -Math.PI / 2, 0], [24.99, 6.5, 12.5], [0, 0, Math.PI / 2]);

    // 目标球体池
    const MAX_TARGETS = 10;
    const sphereGeometry = new THREE.SphereGeometry(0.4, 32, 32);
    const sphereColor = 0x9ca3af;
    const sphereMaterial = new THREE.MeshStandardMaterial({
      color: sphereColor,
      emissive: sphereColor,
      emissiveIntensity: 0.3,
      roughness: 0.2,
      metalness: 0.3,
    });
    const targets: TargetState[] = [];
    for (let i = 0; i < MAX_TARGETS; i++) {
      const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
      sphere.castShadow = true;
      sphere.visible = false;
      scene.add(sphere);
      targets.push({ mesh: sphere, gridIndex: -1, spawnTime: 0 });
    }
    targetsRef.current = targets;

    // WebGL context 丢失处理
    const canvas = renderer.domElement;
    const handleContextLost = (e: Event) => {
      e.preventDefault();
    };
    const handleContextRestored = () => {
      toast.error("WebGL context 已恢复，如画面异常请刷新页面");
    };
    canvas.addEventListener("webglcontextlost", handleContextLost);
    canvas.addEventListener("webglcontextrestored", handleContextRestored);

    // 初始渲染一帧
    renderer.render(scene, camera);

    // 窗口大小调整
    const handleResize = () => {
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", handleContextRestored);

      renderer.setAnimationLoop(null);

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
          obj.geometry.dispose();
          const mat = obj.material;
          if (Array.isArray(mat)) {
            mat.forEach((m) => m.dispose());
          } else {
            mat.dispose();
          }
        }
      });

      container.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  return {
    containerRef,
    targetsRef,
    cameraRef,
    raycasterRef,
    mouseAccum,
    rendererRef,
    sceneRef,
  };
}
