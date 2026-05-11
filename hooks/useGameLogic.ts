"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import * as THREE from "three";
import { toast } from "sonner";
import { useSyncRef } from "@/hooks/useSyncRef";
import { playHitSound, playMissSound, playCountdownSound } from "@/lib/sounds";
import { type TargetState, spawnTarget } from "@/lib/grid";

type GameState = "idle" | "playing" | "finished";

const BASE_SENSITIVITY = 0.022 * (Math.PI / 180);
const CENTER_SCREEN = new THREE.Vector2(0, 0);
const TARGET_SIZE = 0.6;

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
  } = deps;

  const [gameState, setGameState] = useState<GameState>("idle");
  const [timeLeft, setTimeLeft] = useState(30);
  const [score, setScore] = useState(0);
  const [hits, setHits] = useState(0);
  const [totalClicks, setTotalClicks] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const [isNewBest, setIsNewBest] = useState(false);
  const countdownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleClickRef = useRef<() => void>(() => {});

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
    setTimeLeft(durationRef.current);
    setScore(0);
    setHits(0);
    setTotalClicks(0);
    setIsPaused(false);
    setIsNewBest(false);
    setReactionTimes([]);

    /* eslint-disable react-hooks/immutability */
    for (const t of targetsRef.current) {
      t.mesh.visible = false;
      t.gridIndex = -1;
    }
    const count = Math.min(targetCountRef.current, targetsRef.current.length);
    const s = TARGET_SIZE / 0.4;
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

  const triggerStart = useCallback(() => {
    containerRef.current
      ?.requestPointerLock()
      .then(() => {
        startGame();
        startCountdown();
        toast.dismiss();
        toast.info("按 Esc 退出瞄准模式");
      })
      .catch(() => {});
  }, [startGame, startCountdown]);

  const triggerResume = useCallback(() => {
    containerRef.current
      ?.requestPointerLock()
      .then(() => {
        setIsPaused(false);
        startCountdown();
        toast.dismiss();
        toast.info("按 Esc 退出瞄准模式");
      })
      .catch(() => {});
  }, [startCountdown]);

  // 测试辅助：暴露游戏控制函数到 window（仅注册一次）
  const startGameRef = useRef(startGame);
  const startCountdownRef = useRef(startCountdown);

  useEffect(() => {
    startGameRef.current = startGame;
    startCountdownRef.current = startCountdown;
  }, [startGame, startCountdown]);

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__shootbang_test = {
      startGame: () => startGameRef.current(),
      startCountdown: () => startCountdownRef.current(),
      setGameState: (s: GameState) => setGameState(s),
      getGameState: () => gameStateRef.current,
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
        const hitPoint = intersection.point;
        const center = hitTarget.mesh.position;
        const distance = hitPoint.distanceTo(center);
        const precision = Math.max(0, 1 - distance / TARGET_SIZE);
        const points = Math.round(50 + 50 * precision);

        playHitSound();
        setScore((prev) => prev + points);
        setHits((prev) => prev + 1);
        setTotalClicks((prev) => prev + 1);
        const rt = Date.now() - hitTarget.spawnTime;
        if (rt > 0 && rt < 10000) {
          setReactionTimes((prev) => [...prev, rt]);
        }
        hitTarget.mesh.visible = false;
        spawnTarget(
          hitTarget,
          targetsRef.current,
          gridPositionsRef.current,
          targetCountRef.current,
        );
      }
    } else {
      playMissSound();
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

  const reactionAvg =
    reactionTimes.length > 0
      ? Math.round(
          reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length,
        )
      : null;

  return {
    gameState,
    gameStateRef,
    setGameState,
    timeLeft,
    score,
    hits,
    totalClicks,
    hitRate,
    isLocked,
    isPaused,
    countdown,
    reactionTimes,
    reactionAvg,
    isNewBest,
    setIsNewBest,
    triggerStart,
    triggerResume,
    startGame,
    startCountdown,
  };
}
