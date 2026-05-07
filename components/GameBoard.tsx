"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import * as THREE from "three";

function getGridSpacing(n: number): number {
  const wallW = 50, wallH = 14, margin = 2;
  return Math.min(1.5, (wallW - margin * 2) / (n - 1 || 1), (wallH - margin * 2) / (n - 1 || 1));
}

function generateGridPositions(n: number): [number, number][] {
  const spacing = getGridSpacing(n);
  const span = spacing * (n - 1);
  const startX = -span / 2, startY = 6.5 + span / 2;
  const pos: [number, number][] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      pos.push([startX + c * spacing, startY - r * spacing]);
    }
  }
  return pos;
}

type GameState = "idle" | "playing" | "finished";
const BASE_SENSITIVITY = 0.0016;

interface TargetState { mesh: THREE.Mesh; gridIndex: number }

export default function GameBoard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const targetsRef = useRef<TargetState[]>([]);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  const mouseAccum = useRef({ x: 0, y: 0 });
  const handleClickRef = useRef<() => void>(() => {});

  const [gameState, setGameState] = useState<GameState>("idle");
  const [gridSize, setGridSize] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("shootbang-gridsize");
      if (saved) return parseInt(saved);
    }
    return 3;
  });
  const gridPositionsRef = useRef<[number, number][]>(generateGridPositions(3));
  const [sensitivity, setSensitivity] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("shootbang-sensitivity");
      if (saved) return parseFloat(saved);
    }
    return 1.25;
  });
  const sensitivityRef = useRef(sensitivity);
  const [targetSize, setTargetSize] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("shootbang-targetsize");
      if (saved) return parseFloat(saved);
    }
    return 0.4;
  });
  const targetSizeRef = useRef(targetSize);
  const [targetCount, setTargetCount] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("shootbang-targetcount");
      if (saved) return parseInt(saved);
    }
    return 3;
  });
  const targetCountRef = useRef(targetCount);
  const [timeLeft, setTimeLeft] = useState(30);
  const [hits, setHits] = useState(0);
  const [totalClicks, setTotalClicks] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const gameStateRef = useRef<GameState>("idle");

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    sensitivityRef.current = sensitivity;
    localStorage.setItem("shootbang-sensitivity", sensitivity.toString());
  }, [sensitivity]);

  useEffect(() => {
    gridPositionsRef.current = generateGridPositions(gridSize);
    localStorage.setItem("shootbang-gridsize", gridSize.toString());
  }, [gridSize]);

  useEffect(() => {
    targetSizeRef.current = targetSize;
    localStorage.setItem("shootbang-targetsize", targetSize.toString());
  }, [targetSize]);

  useEffect(() => {
    targetCountRef.current = targetCount;
    localStorage.setItem("shootbang-targetcount", targetCount.toString());
  }, [targetCount]);

  // 初始化 Three.js 场景
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a1a);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
    camera.position.set(0, 6.5, 12.5);
    camera.rotation.order = "YXZ";
    cameraRef.current = camera;

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
    mainLight.shadow.mapSize.width = 512;
    mainLight.shadow.mapSize.height = 512;
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0x6688cc, 0.3);
    fillLight.position.set(-4, 6, -3);
    scene.add(fillLight);

    // 立方体围壁
    const wallColor = 0x0d0d1a;
    const gridColor = 0x222244;
    const S = 50;
    const WH = 14;
    const gridDiv = 50;

    const addWall = (
      w: number, h: number,
      pos: [number, number, number],
      rot: [number, number, number],
      gridPos: [number, number, number],
      gridRot: [number, number, number],
    ) => {
      const geo = new THREE.PlaneGeometry(w, h);
      const mat = new THREE.MeshStandardMaterial({
        color: wallColor, roughness: 0.9, metalness: 0.1,
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

    // 地板 y=-0.5, 面朝上
    addWall(S, S, [0, -0.5, 12.5], [-Math.PI / 2, 0, 0], [0, -0.49, 12.5], [0, 0, 0]);
    // 天花板, 面朝下
    addWall(S, S, [0, 13.5, 12.5], [Math.PI / 2, 0, 0], [0, 13.49, 12.5], [0, 0, 0]);
    // 后墙 z=-5, 面朝+z
    addWall(S, WH, [0, 6.5, -5], [0, 0, 0], [0, 6.5, -4.99], [Math.PI / 2, 0, 0]);
    // 前墙 z=30, 面朝-z
    addWall(S, WH, [0, 6.5, 30], [0, Math.PI, 0], [0, 6.5, 29.99], [Math.PI / 2, 0, 0]);
    // 左墙 x=-25, 面朝+x
    addWall(S, WH, [-25, 6.5, 12.5], [0, Math.PI / 2, 0], [-24.99, 6.5, 12.5], [0, 0, Math.PI / 2]);
    // 右墙 x=25, 面朝-x
    addWall(S, WH, [25, 6.5, 12.5], [0, -Math.PI / 2, 0], [24.99, 6.5, 12.5], [0, 0, Math.PI / 2]);

    // 目标球体池
    const MAX_TARGETS = 80;
    const sphereGeometry = new THREE.SphereGeometry(0.4, 32, 32);
    const sphereMaterial = new THREE.MeshStandardMaterial({
      color: 0x0066ff,
      emissive: 0x0066ff,
      emissiveIntensity: 1.5,
      roughness: 0.2,
      metalness: 0.3,
    });
    const targets: { mesh: THREE.Mesh; gridIndex: number }[] = [];
    for (let i = 0; i < MAX_TARGETS; i++) {
      const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
      sphere.castShadow = true;
      sphere.visible = false;
      scene.add(sphere);
      targets.push({ mesh: sphere, gridIndex: -1 });
    }
    targetsRef.current = targets;

    // WebGL context 丢失处理
    const canvas = renderer.domElement;
    const handleContextLost = (e: Event) => {
      e.preventDefault();
    };
    const handleContextRestored = () => {
      // context 恢复后需要重新初始化，这里简单提示用户刷新
      alert("WebGL context 已恢复，如画面异常请刷新页面");
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
        if (obj instanceof THREE.Mesh) {
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

  // 动画循环 - 仅在 playing 状态运行
  useEffect(() => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const scene = sceneRef.current;
    if (!renderer || !camera || !scene) return;

    if (gameState !== "playing") {
      renderer.setAnimationLoop(null);
      return;
    }

    renderer.setAnimationLoop(() => {
      camera.rotation.y = mouseAccum.current.x;
      camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, mouseAccum.current.y));

      const s = targetSizeRef.current / 0.4;
      for (const t of targetsRef.current) {
        t.mesh.scale.setScalar(s);
      }

      renderer.render(scene, camera);
    });

    return () => {
      renderer.setAnimationLoop(null);
    };
  }, [gameState]);

  // 鼠标移动 + 指针锁定事件
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement) {
        const s = BASE_SENSITIVITY * sensitivityRef.current;
        mouseAccum.current.x -= e.movementX * s;
        mouseAccum.current.y = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, mouseAccum.current.y - e.movementY * s));
      }
    };

    const handlePointerLockChange = () => {
      const locked = !!document.pointerLockElement;
      setIsLocked(locked);
      if (locked && gameStateRef.current === "playing") {
        setIsPaused(false);
      } else if (!locked && gameStateRef.current === "playing") {
        setIsPaused(true);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("pointerlockchange", handlePointerLockChange);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("pointerlockchange", handlePointerLockChange);
    };
  }, []);

  // 在随机空位生成一个目标
  function spawnTarget(target: TargetState) {
    if (!target) return;
    const active = targetsRef.current.slice(0, targetCountRef.current);
    const occupied = new Set(active.filter(t => t.mesh.visible).map(t => t.gridIndex));
    const positions = gridPositionsRef.current;
    const available = positions.map((_, i) => i).filter(i => !occupied.has(i));
    if (available.length === 0) return;
    const idx = available[Math.floor(Math.random() * available.length)];
    const [x, y] = positions[idx];
    target.gridIndex = idx;
    target.mesh.position.set(x, y, -5);
    target.mesh.visible = true;
  }

  // 开始游戏
  const startGame = useCallback(() => {
    setGameState("playing");
    setTimeLeft(30);
    setHits(0);
    setTotalClicks(0);
    setIsPaused(false);

    /* eslint-disable react-hooks/immutability */
    for (const t of targetsRef.current) {
      t.mesh.visible = false;
      t.gridIndex = -1;
    }
    const count = Math.min(targetCountRef.current, targetsRef.current.length);
    for (let i = 0; i < count; i++) {
      spawnTarget(targetsRef.current[i]);
    }
    /* eslint-enable react-hooks/immutability */

    setTimeout(() => {
      containerRef.current?.requestPointerLock().catch(() => {});
    }, 100);
  }, []);

  // 点击处理
  const handleClick = useCallback(() => {
    if (gameStateRef.current !== "playing") return;
    if (!cameraRef.current) return;

    mouseRef.current.set(0, 0);
    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);

    const active = targetsRef.current.slice(0, targetCountRef.current);
    let hitTarget: { mesh: THREE.Mesh; gridIndex: number } | null = null;
    let minDist = Infinity;
    for (const t of active) {
      if (!t.mesh.visible) continue;
      t.mesh.updateMatrixWorld();
      const intersects = raycasterRef.current.intersectObject(t.mesh, true);
      if (intersects.length > 0 && intersects[0].distance < minDist) {
        minDist = intersects[0].distance;
        hitTarget = t;
      }
    }

    if (hitTarget) {
      setHits((prev) => prev + 1);
      setTotalClicks((prev) => prev + 1);
      hitTarget.mesh.visible = false;
      hitTarget.gridIndex = -1;
      spawnTarget(hitTarget);
    } else {
      setTotalClicks((prev) => prev + 1);
    }
  }, []);

  useEffect(() => {
    handleClickRef.current = handleClick;
  }, [handleClick]);

  // 鼠标点击事件
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (gameStateRef.current !== "playing") return;
      if (!document.pointerLockElement && e.button === 0) {
        containerRef.current?.requestPointerLock().catch(() => {});
      } else if (document.pointerLockElement && e.button === 0) {
        handleClickRef.current();
      }
    };
    window.addEventListener("mousedown", handleMouseDown);
    return () => window.removeEventListener("mousedown", handleMouseDown);
  }, []);

  // 倒计时
  useEffect(() => {
    if (gameState !== "playing" || isPaused) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setGameState("finished");
          for (const t of targetsRef.current) t.mesh.visible = false;
          document.exitPointerLock();
          setIsLocked(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState, isPaused]);

  const hitRate =
    totalClicks > 0 ? Math.round((hits / totalClicks) * 100) : 0;

  return (
    <div className="relative w-full h-screen bg-gray-950">
      {/* 准星 */}
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
          <h1 className="text-6xl font-bold text-white mb-4 tracking-wider">
            SHOOT GRID
          </h1>
          <p className="text-xl text-gray-400 mb-8">射击网格练习</p>
          <div className="mb-4 flex items-center gap-4">
            <label className="text-gray-400 text-sm">网格大小</label>
            <select
              value={gridSize}
              onChange={(e) => {
                const g = parseInt(e.target.value);
                setGridSize(g);
                const max = g * g - 1;
                if (targetCount > max) setTargetCount(max);
              }}
              className="bg-gray-800 text-white rounded px-3 py-1 border border-gray-600 focus:border-blue-500 focus:outline-none"
            >
              {Array.from({ length: 8 }, (_, i) => i + 2).map((n) => (
                <option key={n} value={n}>{n}x{n}</option>
              ))}
            </select>
          </div>
          <div className="mb-4 flex items-center gap-4">
            {(() => {
              const maxCount = gridSize * gridSize - 1;
              return (
                <>
                  <label className="text-gray-400 text-sm">目标数量</label>
                  <input
                    type="range"
                    min="1"
                    max={maxCount}
                    step="1"
                    value={Math.min(targetCount, maxCount)}
                    onChange={(e) => setTargetCount(parseInt(e.target.value))}
                    className="w-48 accent-blue-600"
                  />
                  <input
                    type="number"
                    min="1"
                    max={maxCount}
                    step="1"
                    value={targetCount}
                    onChange={(e) => setTargetCount(Math.max(1, Math.min(maxCount, parseInt(e.target.value) || 1)))}
                    className="w-20 bg-gray-800 text-white text-center rounded px-2 py-1 border border-gray-600 focus:border-blue-500 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </>
              );
            })()}
          </div>
          <div className="mb-4 flex items-center gap-4">
            {(() => {
              const maxTarget = Math.round(getGridSpacing(gridSize) / 2 * 100) / 100;
              return (
                <>
                  <label className="text-gray-400 text-sm">目标大小</label>
                  <input
                    type="range"
                    min="0.01"
                    max={maxTarget}
                    step="0.01"
                    value={Math.min(targetSize, maxTarget)}
                    onChange={(e) => setTargetSize(parseFloat(e.target.value))}
                    className="w-48 accent-blue-600"
                  />
                  <input
                    type="number"
                    min="0.01"
                    max={maxTarget}
                    step="0.01"
                    value={targetSize}
                    onChange={(e) => setTargetSize(Math.max(0.01, Math.min(maxTarget, parseFloat(e.target.value) || 0.01)))}
                    className="w-20 bg-gray-800 text-white text-center rounded px-2 py-1 border border-gray-600 focus:border-blue-500 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </>
              );
            })()}
          </div>
          <div className="mb-8 flex items-center gap-4">
            <label className="text-gray-400 text-sm">灵敏度</label>
            <input
              type="range"
              min="0.01"
              max="9.99"
              step="0.01"
              value={sensitivity}
              onChange={(e) => setSensitivity(parseFloat(e.target.value))}
              className="w-48 accent-blue-600"
            />
            <input
              type="number"
              min="0.01"
              max="9.99"
              step="0.01"
              value={sensitivity}
              onChange={(e) => setSensitivity(Math.max(0.01, Math.min(9.99, parseFloat(e.target.value) || 0.01)))}
              className="w-20 bg-gray-800 text-white text-center rounded px-2 py-1 border border-gray-600 focus:border-blue-500 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          <button
            onClick={startGame}
            className="px-12 py-4 bg-blue-600 hover:bg-blue-700 text-white text-xl font-semibold rounded-lg transition-colors duration-200 transform hover:scale-105"
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
              <div className="text-6xl font-bold text-blue-400">
                {hitRate}%
              </div>
              <div className="text-gray-400 mt-2">命中率</div>
            </div>
          </div>
          <div className="flex gap-4">
            <button
              onClick={startGame}
              className="px-8 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors duration-200"
            >
              再来一局
            </button>
            <button
              onClick={() => setGameState("idle")}
              className="px-8 py-3 bg-blue-900 hover:bg-blue-800 text-white font-semibold rounded-lg transition-colors duration-200"
            >
              返回首页
            </button>
          </div>
        </div>
      )}

      {/* 3D 场景 */}
      <div
        ref={containerRef}
        className={`w-full h-full ${isLocked ? "cursor-none" : "cursor-default"}`}
      />
    </div>
  );
}
