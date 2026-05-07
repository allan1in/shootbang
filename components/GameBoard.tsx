"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import * as THREE from "three";

// 3x3 网格位置 (x, y) - 在墙面上
const GRID_POSITIONS: [number, number][] = [
  [-1.5, 5],
  [0, 5],
  [1.5, 5],
  [-1.5, 3.5],
  [0, 3.5],
  [1.5, 3.5],
  [-1.5, 2],
  [0, 2],
  [1.5, 2],
];

type GameState = "idle" | "playing" | "finished";

export default function GameBoard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const targetRef = useRef<THREE.Mesh | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const mouseAccum = useRef({ x: 0, y: 0 });
  const glowRef = useRef<THREE.Mesh | null>(null);
  const sphereLightRef = useRef<THREE.PointLight | null>(null);
  const handleClickRef = useRef<() => void>(() => {});

  const [gameState, setGameState] = useState<GameState>("idle");
  const [timeLeft, setTimeLeft] = useState(30);
  const [hits, setHits] = useState(0);
  const [totalClicks, setTotalClicks] = useState(0);
  const [targetIndex, setTargetIndex] = useState<number | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const gameStateRef = useRef<GameState>("idle");

  // 同步 gameState 到 ref
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // 初始化 Three.js 场景
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 场景
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a1a);

    // 相机
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
    camera.position.set(0, 0, 20);
    cameraRef.current = camera;

    // 渲染器
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 灯光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.0);
    mainLight.position.set(3, 8, 4);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 1024;
    mainLight.shadow.mapSize.height = 1024;
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0x6688cc, 0.3);
    fillLight.position.set(-4, 6, -3);
    scene.add(fillLight);

    // 地板
    const floorGeometry = new THREE.PlaneGeometry(50, 50);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x111122,
      roughness: 0.95,
      metalness: 0.05,
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.5;
    floor.receiveShadow = true;
    scene.add(floor);

    // 地板网格
    const gridHelper = new THREE.GridHelper(50, 50, 0x333366, 0x222244);
    gridHelper.position.y = -0.49;
    scene.add(gridHelper);

    // 墙面
    const wallGeometry = new THREE.PlaneGeometry(50, 20);
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x0d0d1a,
      roughness: 0.9,
      metalness: 0.1,
    });
    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    wall.position.set(0, 9.5, -5);
    wall.receiveShadow = true;
    scene.add(wall);

    // 墙面网格
    const wallGrid = new THREE.GridHelper(50, 50, 0x333366, 0x222244);
    wallGrid.rotation.x = Math.PI / 2;
    wallGrid.position.set(0, 9.5, -4.99);
    scene.add(wallGrid);

    // 目标球体
    const sphereGeometry = new THREE.SphereGeometry(0.4, 64, 64);
    const sphereMaterial = new THREE.MeshStandardMaterial({
      color: 0xff2200,
      emissive: 0xff2200,
      emissiveIntensity: 1.5,
      roughness: 0.2,
      metalness: 0.3,
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere.castShadow = true;
    sphere.visible = false;
    scene.add(sphere);
    targetRef.current = sphere;

    // 球体发光光晕
    const glowGeometry = new THREE.SphereGeometry(0.55, 32, 32);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xff4400,
      transparent: true,
      opacity: 0.3,
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.visible = false;
    scene.add(glow);
    glowRef.current = glow;

    // 球体位置光源
    const sphereLight = new THREE.PointLight(0xff4400, 2, 5);
    sphereLight.visible = false;
    scene.add(sphereLight);
    sphereLightRef.current = sphereLight;

    // 动画循环
    const animate = () => {
      requestAnimationFrame(animate);

      // FPS 风格：鼠标控制视角旋转
      camera.rotation.order = 'YXZ';
      camera.rotation.y = mouseAccum.current.x;
      camera.rotation.x = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 3, mouseAccum.current.y));

      // 同步光晕和光源到球体位置
      if (targetRef.current && targetRef.current.visible) {
        const pos = targetRef.current.position;
        if (glowRef.current) {
          glowRef.current.position.copy(pos);
          glowRef.current.visible = true;
        }
        if (sphereLightRef.current) {
          sphereLightRef.current.position.set(pos.x, pos.y + 0.5, pos.z);
          sphereLightRef.current.visible = true;
        }
      } else {
        if (glowRef.current) glowRef.current.visible = false;
        if (sphereLightRef.current) sphereLightRef.current.visible = false;
      }

      renderer.render(scene, camera);
    };
    animate();

    // 鼠标移动跟踪 - 使用 Pointer Lock 的 movementX/Y
    const handleMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement) {
        const sensitivity = 0.002;
        mouseAccum.current.x -= e.movementX * sensitivity;
        mouseAccum.current.y -= e.movementY * sensitivity;
      }
    };
    window.addEventListener("mousemove", handleMouseMove);

    // ESC 退出指针锁定
    const handlePointerLockChange = () => {
      const locked = !!document.pointerLockElement;
      setIsLocked(locked);
      if (locked && gameStateRef.current === "playing") {
        setIsPaused(false);
      } else if (!locked && gameStateRef.current === "playing") {
        setIsPaused(true);
      }
    };
    document.addEventListener("pointerlockchange", handlePointerLockChange);

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
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("pointerlockchange", handlePointerLockChange);
      window.removeEventListener("resize", handleResize);
      container.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

  // 生成新目标
  const generateNewTarget = useCallback(() => {
    let newIndex: number;
    do {
      newIndex = Math.floor(Math.random() * 9);
    } while (newIndex === targetIndex);

    setTargetIndex(newIndex);

    if (targetRef.current) {
      const [x, y] = GRID_POSITIONS[newIndex];
      targetRef.current.position.set(x, y, -5);
      targetRef.current.visible = true;
    }
  }, [targetIndex]);

  // 开始游戏
  const startGame = useCallback(() => {
    setGameState("playing");
    setTimeLeft(30);
    setHits(0);
    setTotalClicks(0);
    setIsPaused(false);
    // 直接生成目标
    const newIndex = Math.floor(Math.random() * 9);
    setTargetIndex(newIndex);
    if (targetRef.current) {
      const [x, y] = GRID_POSITIONS[newIndex];
      targetRef.current.position.set(x, y, -5);
      targetRef.current.visible = true;
    }
    // 延迟请求锁定，避免干扰
    setTimeout(() => {
      containerRef.current?.requestPointerLock().catch(() => {});
    }, 100);
  }, []);

  // 命中目标
  const handleTargetHit = useCallback(() => {
    setHits((prev) => prev + 1);
    setTotalClicks((prev) => prev + 1);
    generateNewTarget();
  }, [generateNewTarget]);

  // 点击处理 - 指针锁定时从屏幕中心发射射线
  const handleClick = useCallback(
    () => {
      if (gameState !== "playing") return;
      if (!cameraRef.current || !targetRef.current) return;

      mouseRef.current.set(0, 0);
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      targetRef.current.updateMatrixWorld();
      const intersects = raycasterRef.current.intersectObject(targetRef.current, true);

      if (intersects.length > 0) {
        handleTargetHit();
      } else {
        setTotalClicks((prev) => prev + 1);
      }
    },
    [gameState, handleTargetHit]
  );

  // 同步到 ref
  useEffect(() => {
    handleClickRef.current = handleClick;
  }, [handleClick]);

  // 鼠标点击事件
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (gameState !== "playing") return;
      if (!document.pointerLockElement && e.button === 0) {
        containerRef.current?.requestPointerLock().catch(() => {});
      } else if (document.pointerLockElement && e.button === 0) {
        handleClickRef.current();
      }
    };
    window.addEventListener("mousedown", handleMouseDown);
    return () => window.removeEventListener("mousedown", handleMouseDown);
  }, [gameState]);

  // 倒计时
  useEffect(() => {
    if (gameState !== "playing" || isPaused) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setGameState("finished");
          if (targetRef.current) targetRef.current.visible = false;
          if (glowRef.current) glowRef.current.visible = false;
          if (sphereLightRef.current) sphereLightRef.current.visible = false;
          document.exitPointerLock();
          setIsLocked(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState, isPaused]);

  const hitRate = totalClicks > 0 ? Math.round((hits / totalClicks) * 100) : 0;

  return (
    <div className="relative w-full h-screen bg-gray-950">
      {/* 准星 - 仅游戏中且锁定时显示 */}
      {gameState === "playing" && isLocked && (
        <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center">
          <div className="relative">
            <div className="absolute w-6 h-0.5 bg-white/70 -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2" />
            <div className="absolute h-6 w-0.5 bg-white/70 -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2" />
          </div>
        </div>
      )}

      {/* HUD */}
      {gameState === "playing" && (
        <div className="absolute top-4 left-0 right-0 z-10 flex justify-between px-8 pointer-events-none">
          <div className="bg-black/70 px-6 py-3 rounded-lg">
            <span className="text-gray-400 text-sm">时间</span>
            <div className="text-3xl font-bold text-white">{timeLeft}s</div>
          </div>
          <div className="bg-black/70 px-6 py-3 rounded-lg">
            <span className="text-gray-400 text-sm">命中</span>
            <div className="text-3xl font-bold text-green-400">{hits}</div>
          </div>
        </div>
      )}

      {/* 暂停提示 */}
      {gameState === "playing" && isPaused && (
        <div className="absolute inset-0 z-25 flex items-center justify-center bg-black/50 cursor-default pointer-events-none">
          <div className="bg-black/70 px-8 py-4 rounded-lg text-white text-xl">
            点击画面继续
          </div>
        </div>
      )}

      {/* 开始页面 */}
      {gameState === "idle" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 cursor-default">
          <h1 className="text-6xl font-bold text-white mb-4 tracking-wider">SHOOT GRID</h1>
          <p className="text-xl text-gray-400 mb-12">3x3 射击网格练习</p>
          <button
            onClick={startGame}
            className="px-12 py-4 bg-red-600 hover:bg-red-700 text-white text-xl font-semibold rounded-lg transition-colors duration-200 transform hover:scale-105"
          >
            开始游戏
          </button>
        </div>
      )}

      {/* 结算页面 */}
      {gameState === "finished" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 cursor-default">
          <h2 className="text-5xl font-bold text-white mb-8">游戏结束</h2>
          <div className="grid grid-cols-2 gap-8 mb-12">
            <div className="text-center">
              <div className="text-6xl font-bold text-green-400">{hits}</div>
              <div className="text-gray-400 mt-2">命中数</div>
            </div>
            <div className="text-center">
              <div className="text-6xl font-bold text-blue-400">{hitRate}%</div>
              <div className="text-gray-400 mt-2">命中率</div>
            </div>
          </div>
          <div className="flex gap-4">
            <button onClick={startGame} className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors duration-200">
              再来一局
            </button>
            <button onClick={() => setGameState("idle")} className="px-8 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors duration-200">
              返回首页
            </button>
          </div>
        </div>
      )}

      {/* 3D 场景 */}
      <div ref={containerRef} className={`w-full h-full ${isLocked ? 'cursor-none' : 'cursor-default'}`} />
    </div>
  );
}
