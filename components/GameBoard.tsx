"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, Home, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useSyncRef } from "@/hooks/useSyncRef";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";

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
// 对齐 CS2: m_yaw(0.022°) × sensitivity(2.5) = 0.055°/count ≈ 0.00096 rad/count
const BASE_SENSITIVITY = 0.022 * (Math.PI / 180);
const CENTER_SCREEN = new THREE.Vector2(0, 0);
const GRID_SIZE = 3;
const TARGET_COUNT = 3;
const TARGET_SIZE = 0.6;
const GRID_POSITIONS = generateGridPositions(GRID_SIZE);

interface TargetState { mesh: THREE.Mesh; gridIndex: number }

export default function GameBoard() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const targetsRef = useRef<TargetState[]>([]);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseAccum = useRef({ x: 0, y: 0 });
  const handleClickRef = useRef<() => void>(() => {});

  const [gameState, setGameState] = useState<GameState>("idle");
  const [sensitivity, setSensitivity] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("shootbang-sensitivity");
      if (saved) return parseFloat(saved) || 2.5;
    }
    return 2.5;
  });
  const [timeLeft, setTimeLeft] = useState(30);
  const [score, setScore] = useState(0);
  const [hits, setHits] = useState(0);
  const [totalClicks, setTotalClicks] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [tempSensitivity, setTempSensitivity] = useState(sensitivity);
  const gameStateRef = useSyncRef(gameState);
  const isPausedRef = useSyncRef(isPaused);
  const countdownRef = useSyncRef(countdown);
  const sensitivityRef = useSyncRef(sensitivity);

  useEffect(() => {
    localStorage.setItem("shootbang-sensitivity", sensitivity.toString());
  }, [sensitivity]);

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
    const MAX_TARGETS = 10;
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

  // 动画循环 - 仅在 playing 状态运行
  useEffect(() => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const scene = sceneRef.current;
    if (!renderer || !camera || !scene) return;

    if (gameState !== "playing") {
      renderer.setAnimationLoop(null);
      for (const t of targetsRef.current) t.mesh.visible = false;
      renderer.render(scene, camera);
      return;
    }

    renderer.setAnimationLoop(() => {
      camera.rotation.y = mouseAccum.current.x;
      camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, mouseAccum.current.y));

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
        // 暂停时清除倒计时
        if (countdownTimer.current) {
          clearTimeout(countdownTimer.current);
          setCountdown(null);
        }
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
    const active = targetsRef.current.slice(0, TARGET_COUNT);
    const occupied = new Set(active.filter(t => t.mesh.visible).map(t => t.gridIndex));
    // 排除目标自身的旧位置，防止被击中后原地重生
    occupied.add(target.gridIndex);
    const positions = GRID_POSITIONS;
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
    setScore(0);
    setHits(0);
    setTotalClicks(0);
    setIsPaused(false);

    /* eslint-disable react-hooks/immutability */
    for (const t of targetsRef.current) {
      t.mesh.visible = false;
      t.gridIndex = -1;
    }
    const count = Math.min(TARGET_COUNT, targetsRef.current.length);
    const s = TARGET_SIZE / 0.4;
    for (let i = 0; i < count; i++) {
      targetsRef.current[i].mesh.scale.setScalar(s);
      spawnTarget(targetsRef.current[i]);
    }
    /* eslint-enable react-hooks/immutability */
  }, []);

  // 倒计时：递归 setTimeout，结束后清除状态
  const startCountdown = useCallback(() => {
    if (countdownTimer.current) clearTimeout(countdownTimer.current);
    setCountdown(3);
    const tick = (n: number) => {
      countdownTimer.current = setTimeout(() => {
        if (n > 1) {
          setCountdown(n - 1);
          tick(n - 1);
        } else {
          setCountdown(null);
        }
      }, 1000);
    };
    tick(3);
  }, []);

  const triggerStart = useCallback(() => {
    containerRef.current?.requestPointerLock().then(() => {
      startGame();
      startCountdown();
      toast.dismiss();
      toast.info("按 Esc 退出瞄准模式");
    }).catch(() => {});
  }, [startGame, startCountdown]);

  const triggerResume = useCallback(() => {
    containerRef.current?.requestPointerLock().then(() => {
      setIsPaused(false);
      startCountdown();
      toast.dismiss();
      toast.info("按 Esc 退出瞄准模式");
    }).catch(() => {});
  }, [startCountdown]);

  // 组件卸载时清除倒计时
  useEffect(() => {
    return () => {
      if (countdownTimer.current) clearTimeout(countdownTimer.current);
    };
  }, []);

  // 点击处理
  const handleClick = useCallback(() => {
    if (gameStateRef.current !== "playing") return;
    if (countdownRef.current !== null) return; // 倒计时期间不计分
    if (!cameraRef.current) return;

    raycasterRef.current.setFromCamera(CENTER_SCREEN, cameraRef.current);

    const active = targetsRef.current.slice(0, TARGET_COUNT);
    const activeMeshes = active.filter(t => t.mesh.visible).map(t => t.mesh);
    const allIntersects = raycasterRef.current.intersectObjects(activeMeshes, false);

    if (allIntersects.length > 0) {
      const intersection = allIntersects[0];
      const hitMesh = intersection.object as THREE.Mesh;
      const hitTarget = targetsRef.current.find(t => t.mesh === hitMesh);
      if (hitTarget) {
        // 精准计分：命中点离目标中心越近分越高
        const hitPoint = intersection.point;
        const center = hitTarget.mesh.position;
        const distance = hitPoint.distanceTo(center);
        const precision = Math.max(0, 1 - distance / TARGET_SIZE);
        const points = Math.round(50 + 50 * precision);

        setScore((prev) => prev + points);
        setHits((prev) => prev + 1);
        setTotalClicks((prev) => prev + 1);
        hitTarget.mesh.visible = false;
        spawnTarget(hitTarget);
      }
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
      if (e.button !== 0) return;

      if (!document.pointerLockElement) {
        // pointer lock 丢失 — 仅标记暂停，不自动请求锁定
        if (!isPausedRef.current) setIsPaused(true);
      } else if (!isPausedRef.current) {
        // 锁定且未暂停 — 正常射击
        handleClickRef.current();
      }
    };
    window.addEventListener("mousedown", handleMouseDown);
    return () => window.removeEventListener("mousedown", handleMouseDown);
  }, []);

  // 游戏计时（倒计时期间和暂停时不计时）
  useEffect(() => {
    if (gameState !== "playing" || isPaused || countdown !== null) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          gameStateRef.current = "finished";
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
  }, [gameState, isPaused, countdown]);

  const hitRate =
    totalClicks > 0 ? Math.round((hits / totalClicks) * 100) : 0;

  return (
    <div className="relative w-full h-screen bg-background">
      {/* 准星 */}
      {gameState === "playing" && isLocked && (
        <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center">
          <div className="relative">
            <div className="absolute w-6 h-0.5 bg-foreground/70 -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2" />
            <div className="absolute h-6 w-0.5 bg-foreground/70 -translate-x-1/2 -translate-y-1/2 left-1/2 top-1/2" />
          </div>
        </div>
      )}

      {/* HUD */}
      {gameState === "playing" && (
        <div className="absolute top-4 left-0 right-0 z-10 flex justify-center gap-4 pointer-events-none">
          <Card className="w-36 text-center">
            <span className="text-muted-foreground text-sm">分数</span>
            <div className="text-3xl font-bold text-foreground">{score}</div>
          </Card>
          <Card className="w-36 text-center">
            <span className="text-muted-foreground text-sm">时间</span>
            <div className="text-3xl font-bold text-foreground">{timeLeft}s</div>
          </Card>
          <Card className="w-36 text-center">
            <span className="text-muted-foreground text-sm">准确率</span>
            <div className="text-3xl font-bold text-primary">
              {hitRate}%
            </div>
          </Card>
        </div>
      )}

      {/* 暂停提示 */}
      {gameState === "playing" && isPaused && (
        <div className="absolute inset-0 z-25 flex items-center justify-center bg-background/50">
          <div className="absolute top-4 left-4 flex gap-2">
            <Button
              variant="ghost"
              size="icon-lg"
              className="cursor-pointer"
              onClick={() => {
                document.exitPointerLock();
                setGameState("idle");
                setIsLocked(false);
                setIsPaused(false);
              }}
            >
              <Home className="size-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-lg"
              className="cursor-pointer"
              onClick={() => {
                document.exitPointerLock();
                setIsLocked(false);
                triggerStart();
              }}
            >
              <RotateCcw className="size-5" />
            </Button>
          </div>
          <Button
            variant="outline"
            size="lg"
            className="cursor-pointer border-foreground/10 text-base"
            onClick={triggerResume}
          >
            点击此处继续
          </Button>
        </div>
      )}

      {/* 开始页面 */}
      {gameState === "idle" && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 cursor-default">
          {/* 设置按钮 - 仅在非设置页面显示 */}
          {!showSettings && (
            <Button
              variant="ghost"
              size="icon-lg"
              className="absolute top-4 left-4 z-10 cursor-pointer"
              onClick={() => {
                setTempSensitivity(sensitivity);
                setShowSettings(true);
              }}
            >
              <Settings className="size-5" />
            </Button>
          )}

          {/* 开始测试按钮 - 仅在非设置页面显示 */}
          {!showSettings && (
            <Button
              variant="outline"
              size="lg"
              className="cursor-pointer border-foreground/10 text-base"
              onClick={triggerStart}
            >
              开始测试
            </Button>
          )}

          {/* 设置面板 */}
          {showSettings && (
            <Card className="w-80">
              <CardHeader>
                <CardTitle>设置</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Label className="text-sm">灵敏度</Label>
                <Input
                  type="number"
                  min={0.01}
                  max={10}
                  step={0.01}
                  value={tempSensitivity}
                  onChange={(e) => setTempSensitivity(Math.max(0.01, Math.min(10, parseFloat(e.target.value) || 0.01)))}
                  className="h-9 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </CardContent>
              <CardFooter className="gap-2">
                <Button
                  variant="outline"
                  className="flex-1 cursor-pointer border-foreground/10"
                  onClick={() => setShowSettings(false)}
                >
                  取消
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 cursor-pointer border-foreground/10"
                  onClick={() => {
                    setSensitivity(tempSensitivity);
                    setShowSettings(false);
                  }}
                >
                  保存
                </Button>
              </CardFooter>
            </Card>
          )}
        </div>
      )}

      {/* 结算页面 */}
      {gameState === "finished" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/80 cursor-default">
          <Card className="w-80">
            <CardContent className="space-y-6">
              <div className="text-center">
                <div className="text-5xl font-bold text-primary">{score}</div>
                <div className="text-sm text-muted-foreground mt-1">总分</div>
              </div>
              <div className="grid grid-cols-2 gap-6 text-center">
                <div>
                  <div className="text-3xl font-bold text-foreground">{hits}</div>
                  <div className="text-sm text-muted-foreground mt-1">命中数</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-foreground">{hitRate}%</div>
                  <div className="text-sm text-muted-foreground mt-1">准确率</div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="gap-2">
              <Button variant="outline" className="flex-1 cursor-pointer border-foreground/10" onClick={triggerStart}>
                再来一局
              </Button>
              <Button variant="outline" className="flex-1 cursor-pointer border-foreground/10" onClick={() => setGameState("idle")}>
                返回首页
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* 倒计时 */}
      {countdown !== null && (
        <div className="absolute inset-0 z-40 flex items-start justify-center pointer-events-none pt-[25vh]">
          <div className="text-9xl font-bold text-foreground/80 tabular-nums">
            {countdown}
          </div>
        </div>
      )}

      {/* 3D 场景 */}
      <div
        ref={containerRef}
        tabIndex={-1}
        className={`w-full h-full ${isLocked ? "cursor-none" : "cursor-default"}`}
      />
    </div>
  );
}
