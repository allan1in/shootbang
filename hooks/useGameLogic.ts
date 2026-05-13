"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import * as THREE from "three";
import { toast } from "sonner";
import { useSyncRef } from "@/hooks/useSyncRef";
import { playHitSound, playMissSound, playCountdownSound } from "@/lib/sounds";
import { type TargetState, spawnTarget, hideAllTargets } from "@/lib/grid";

type GameState = "idle" | "playing" | "finished";

export interface GameStats {
  hits: number;
  totalShots: number;
  accuracy: number;
  avgReactionTime: number;
}

const BASE_SENSITIVITY = 0.022 * (Math.PI / 180);
const CENTER_SCREEN = new THREE.Vector2(0, 0);
const TARGET_SIZE_MAP: Record<string, number> = { tiny: 0.135, small: 0.27, default: 0.405, large: 0.54, huge: 0.675 };
const DEFAULT_TARGET_SIZE = 0.405;

interface UseGameLogicDeps {
  targetsRef: React.MutableRefObject<TargetState[]>;
  cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>;
  raycasterRef: React.MutableRefObject<THREE.Raycaster>;
  mouseAccum: React.MutableRefObject<{ x: number; y: number }>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  gridPositionsRef: React.MutableRefObject<[number, number][]>;
  targetCountRef: React.MutableRefObject<number>;
  durationRef: React.MutableRefObject<number>;
  sensitivityRef: React.MutableRefObject<number>;
  targetSizeRef: React.MutableRefObject<string>;
}

export function useGameLogic(deps: UseGameLogicDeps) {
  const {
    targetsRef,
    cameraRef,
    raycasterRef,
    mouseAccum,
    containerRef,
    gridPositionsRef,
    targetCountRef,
    durationRef,
    sensitivityRef,
    targetSizeRef,
  } = deps;

  const [gameState, setGameState] = useState<GameState>("idle");
  const [isLocked, setIsLocked] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const timeLeftRef = useRef(30);
  const countdownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleClickRef = useRef<() => void>(() => {});

  const hitsRef = useRef(0);
  const shotsRef = useRef(0);
  const reactionTimesRef = useRef<number[]>([]);
  const [gameStats, setGameStats] = useState<GameStats>({
    hits: 0, totalShots: 0, accuracy: 0, avgReactionTime: 0,
  });
  const gameStatsRef = useSyncRef(gameStats);

  const gameStateRef = useSyncRef(gameState);
  const isPausedRef = useSyncRef(isPaused);

  // 鼠标移动 + 指针锁定事件
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement) {
        const s = BASE_SENSITIVITY * sensitivityRef.current;
        mouseAccum.current.x -= e.movementX * s;
        mouseAccum.current.y = Math.max(
          -Math.PI / 2,
          Math.min(Math.PI / 2, mouseAccum.current.y - e.movementY * s),
        );
      }
    };

    const handlePointerLockChange = () => {
      const locked = !!document.pointerLockElement;
      setIsLocked(locked);
      if (locked && gameStateRef.current === "playing") {
        setIsPaused(false);
      } else if (!locked && gameStateRef.current === "playing") {
        setIsPaused(true);
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

  // 开始游戏
  const startGame = useCallback(() => {
    setGameState("playing");
    timeLeftRef.current = durationRef.current;
    setTimeLeft(durationRef.current);
    setIsPaused(false);
    hitsRef.current = 0;
    shotsRef.current = 0;
    reactionTimesRef.current = [];

    /* eslint-disable react-hooks/immutability */
    hideAllTargets(targetsRef.current);
    for (const t of targetsRef.current) t.gridIndex = -1;
    const count = Math.min(targetCountRef.current, targetsRef.current.length);
    const targetSize = TARGET_SIZE_MAP[targetSizeRef.current] ?? DEFAULT_TARGET_SIZE;
    const s = targetSize / 0.4;
    for (let i = 0; i < count; i++) {
      targetsRef.current[i].mesh.scale.setScalar(s);
      spawnTarget(
        targetsRef.current[i],
        targetsRef.current,
        gridPositionsRef.current,
        targetCountRef.current,
      );
    }
    /* eslint-enable react-hooks/immutability */
  }, []);

  // 倒计时
  const startCountdown = useCallback(() => {
    if (countdownTimer.current) clearTimeout(countdownTimer.current);
    setCountdown(3);
    const tick = (n: number) => {
      playCountdownSound();
      countdownTimer.current = setTimeout(() => {
        if (n > 1) {
          setCountdown(n - 1);
          tick(n - 1);
        } else {
          countdownTimer.current = null;
          setCountdown(null);
        }
      }, 1000);
    };
    tick(3);
  }, []);

  const requestLockAndResume = useCallback(
    (onLocked: () => void) => {
      containerRef.current
        ?.requestPointerLock()
        .then(() => {
          onLocked();
          startCountdown();
          toast.dismiss();
          toast.info("按 Esc 退出瞄准模式");
        })
        .catch(() => {});
    },
    [startCountdown],
  );

  const triggerStart = useCallback(() => {
    requestLockAndResume(startGame);
  }, [requestLockAndResume, startGame]);

  const triggerResume = useCallback(() => {
    requestLockAndResume(() => setIsPaused(false));
  }, [requestLockAndResume]);

  // 测试辅助：暴露游戏控制函数到 window（仅注册一次）
  const startGameRef = useRef(startGame);
  const startCountdownRef = useRef(startCountdown);

  useEffect(() => {
    startGameRef.current = startGame;
    startCountdownRef.current = startCountdown;
  }, [startGame, startCountdown]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const w = window as unknown as Record<string, unknown>;
    w.__shootbang_test = {
      startGame: () => startGameRef.current(),
      startCountdown: () => startCountdownRef.current(),
      setGameState: (s: GameState) => setGameState(s),
      getGameState: () => gameStateRef.current,
      getTargetsInfo: () => {
        const active = targetsRef.current.slice(0, targetCountRef.current);
        return active.map((t) => ({
          visible: t.mesh.visible,
          x: t.mesh.position.x,
          y: t.mesh.position.y,
          z: t.mesh.position.z,
        }));
      },
      getTimeLeft: () => timeLeftRef.current,
      getDuration: () => durationRef.current,
      getGameStats: () => gameStatsRef.current,
      setGameStats: (stats: Partial<GameStats>) => setGameStats((prev) => ({ ...prev, ...stats })),
    };
    return () => {
      delete w.__shootbang_test;
    };
  }, []);

  // 组件卸载时清除倒计时
  useEffect(() => {
    return () => {
      if (countdownTimer.current) clearTimeout(countdownTimer.current);
    };
  }, []);

  // 点击处理
  const handleClick = useCallback(() => {
    if (gameStateRef.current !== "playing") return;
    if (countdownTimer.current !== null) return;
    if (!cameraRef.current) return;

    shotsRef.current++;
    raycasterRef.current.setFromCamera(CENTER_SCREEN, cameraRef.current);

    const active = targetsRef.current.slice(0, targetCountRef.current);
    const activeMeshes = active
      .filter((t) => t.mesh.visible)
      .map((t) => t.mesh);
    const allIntersects = raycasterRef.current.intersectObjects(
      activeMeshes,
      false,
    );

    if (allIntersects.length > 0) {
      const intersection = allIntersects[0];
      const hitMesh = intersection.object as THREE.Mesh;
      const hitTarget = targetsRef.current.find((t) => t.mesh === hitMesh);
      if (hitTarget) {
        playHitSound();
        hitTarget.mesh.visible = false;
        hitsRef.current++;
        reactionTimesRef.current.push(Date.now() - hitTarget.spawnTime);
        spawnTarget(
          hitTarget,
          targetsRef.current,
          gridPositionsRef.current,
          targetCountRef.current,
        );
      }
    } else {
      playMissSound();
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
        if (!isPausedRef.current) setIsPaused(true);
      } else if (!isPausedRef.current) {
        handleClickRef.current();
      }
    };
    window.addEventListener("mousedown", handleMouseDown);
    return () => window.removeEventListener("mousedown", handleMouseDown);
  }, []);

  // 游戏计时
  useEffect(() => {
    if (gameState !== "playing" || isPaused || countdown !== null) return;

    let tick = 0;
    const timer = setInterval(() => {
      timeLeftRef.current = Math.round((timeLeftRef.current - 0.01) * 100) / 100;
      if (++tick % 10 === 0) setTimeLeft(timeLeftRef.current);
      if (timeLeftRef.current <= 0) {
        setTimeLeft(0);
        gameStateRef.current = "finished";
        setGameState("finished");
        const totalShots = shotsRef.current;
        const hits = hitsRef.current;
        const accuracy = totalShots > 0 ? Math.round((hits / totalShots) * 100) : 0;
        const avgReactionTime = reactionTimesRef.current.length > 0
          ? Math.round(reactionTimesRef.current.reduce((a, b) => a + b, 0) / reactionTimesRef.current.length)
          : 0;
        setGameStats({ hits, totalShots, accuracy, avgReactionTime });
        hideAllTargets(targetsRef.current);
        document.exitPointerLock();
        setIsLocked(false);
        clearInterval(timer);
      }
    }, 10);

    return () => clearInterval(timer);
  }, [gameState, isPaused, countdown]);

  return {
    gameState,
    gameStateRef,
    setGameState,
    isLocked,
    isPaused,
    countdown,
    timeLeft,
    timeLeftRef,
    triggerStart,
    triggerResume,
    startGame,
    startCountdown,
    gameStats,
  };
}
