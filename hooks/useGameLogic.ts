"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import * as THREE from "three";
import { toast } from "sonner";
import {
  useGameStore,
  useSettingsStore,
  type GameState,
  type GameStats,
} from "@/stores/gameStore";
export type { GameStats } from "@/stores/gameStore";
import { playHitSound, playMissSound, playCountdownSound } from "@/lib/sounds";
import { type TargetState, spawnTarget, hideAllTargets } from "@/lib/grid";

const BASE_SENSITIVITY = 0.022 * (Math.PI / 180);
const CENTER_SCREEN = new THREE.Vector2(0, 0);
const TARGET_SIZE_MAP: Record<string, number> = { tiny: 0.135, small: 0.27, default: 0.405, large: 0.54, huge: 0.675 };
const DEFAULT_TARGET_SIZE = 0.405;
type PointerInputMode = "none" | "raw" | "standard";

interface UseGameLogicDeps {
  targetsRef: React.MutableRefObject<TargetState[]>;
  cameraRef: React.MutableRefObject<THREE.PerspectiveCamera | null>;
  raycasterRef: React.MutableRefObject<THREE.Raycaster>;
  mouseAccum: React.MutableRefObject<{ x: number; y: number }>;
  containerRef: React.RefObject<HTMLCanvasElement | null>;
}

export function useGameLogic(deps: UseGameLogicDeps) {
  const { targetsRef, cameraRef, raycasterRef, mouseAccum, containerRef } = deps;

  // 订阅 store 以触发 re-render
  const gameState = useGameStore((s) => s.gameState);
  const isPaused = useGameStore((s) => s.isPaused);
  const isLocked = useGameStore((s) => s.isLocked);
  const countdown = useGameStore((s) => s.countdown);
  const gameStats = useGameStore((s) => s.gameStats);
  const setIsLocked = useGameStore((s) => s.setIsLocked);
  const setCountdown = useGameStore((s) => s.setCountdown);

  const [timeLeft, setTimeLeft] = useState(30);
  const [gameSessionId, setGameSessionId] = useState(0);
  const timeLeftRef = useRef(30);
  const countdownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleClickRef = useRef<() => void>(() => {});
  const pointerInputModeRef = useRef<PointerInputMode>("none");

  const hitsRef = useRef(0);
  const shotsRef = useRef(0);
  const lastHitActiveTimeRef = useRef(0);
  const hitIntervalsRef = useRef<number[]>([]);

  const recordHitTiming = useCallback(() => {
    const durationMs = useSettingsStore.getState().duration * 1000;
    const activeTime = Math.max(0, durationMs - timeLeftRef.current * 1000);
    hitIntervalsRef.current.push(activeTime - lastHitActiveTimeRef.current);
    lastHitActiveTimeRef.current = activeTime;
  }, []);

  const getAverageReactionTime = useCallback(() => {
    if (hitIntervalsRef.current.length === 0) return 0;
    return Math.round(
      hitIntervalsRef.current.reduce((sum, interval) => sum + interval, 0) /
        hitIntervalsRef.current.length,
    );
  }, []);

  // 鼠标移动 + 指针锁定事件
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement) {
        const s = BASE_SENSITIVITY * useSettingsStore.getState().sensitivity;
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
      if (locked && useGameStore.getState().gameState === "playing") {
        useGameStore.getState().setIsPaused(false);
      } else if (!locked && useGameStore.getState().gameState === "playing") {
        pointerInputModeRef.current = "none";
        useGameStore.getState().setIsPaused(true);
        if (countdownTimer.current) {
          clearTimeout(countdownTimer.current);
          setCountdown(null);
        }
      } else if (!locked) {
        pointerInputModeRef.current = "none";
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("pointerlockchange", handlePointerLockChange);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("pointerlockchange", handlePointerLockChange);
    };
  }, [setIsLocked, setCountdown, mouseAccum]);

  // 开始游戏
  const startGame = useCallback(() => {
    const s = useSettingsStore.getState();
    setGameSessionId((sessionId) => sessionId + 1);
    useGameStore.getState().setGameState("playing");
    timeLeftRef.current = s.duration;
    setTimeLeft(s.duration);
    useGameStore.getState().setIsPaused(false);
    hitsRef.current = 0;
    shotsRef.current = 0;
    lastHitActiveTimeRef.current = 0;
    hitIntervalsRef.current = [];

    /* eslint-disable react-hooks/immutability */
    hideAllTargets(targetsRef.current);
    for (const t of targetsRef.current) t.gridIndex = -1;
    const count = Math.min(s.targetCount, targetsRef.current.length);
    const targetSize = TARGET_SIZE_MAP[s.targetSize] ?? DEFAULT_TARGET_SIZE;
    const scale = targetSize / 0.4;
    for (let i = 0; i < count; i++) {
      targetsRef.current[i].mesh.scale.setScalar(scale);
      spawnTarget(
        targetsRef.current[i],
        targetsRef.current,
        s.gridPositions,
        s.targetCount,
      );
    }
    /* eslint-enable react-hooks/immutability */
  }, [targetsRef]);

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
  }, [setCountdown]);

  const requestLockAndResume = useCallback(
    (onLocked: () => void) => {
      const container = containerRef.current;
      if (!container) return;

      pointerInputModeRef.current = "none";
      const completeLock = (inputMode: Exclude<PointerInputMode, "none">) => {
        pointerInputModeRef.current = inputMode;
        onLocked();
        startCountdown();
        toast.dismiss();
        toast.info("按 Esc 退出瞄准模式");
      };

      container
        .requestPointerLock({ unadjustedMovement: true })
        .then(() => completeLock("raw"))
        .catch(() => {
          container
            .requestPointerLock()
            .then(() => completeLock("standard"))
            .catch(() => {});
        });
    },
    [startCountdown, containerRef],
  );

  const triggerStart = useCallback(() => {
    requestLockAndResume(startGame);
  }, [requestLockAndResume, startGame]);

  const triggerResume = useCallback(() => {
    requestLockAndResume(() => useGameStore.getState().setIsPaused(false));
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
      setGameState: (s: GameState) => useGameStore.getState().setGameState(s),
      getGameState: () => useGameStore.getState().gameState,
      getTargetsInfo: () => {
        const active = targetsRef.current.slice(0, useSettingsStore.getState().targetCount);
        return active.map((t) => ({
          visible: t.mesh.visible,
          x: t.mesh.position.x,
          y: t.mesh.position.y,
          z: t.mesh.position.z,
        }));
      },
      getTimeLeft: () => timeLeftRef.current,
      getDuration: () => useSettingsStore.getState().duration,
      getPointerInputMode: () => pointerInputModeRef.current,
      setPaused: (paused: boolean) => useGameStore.getState().setIsPaused(paused),
      recordHitTiming: () => recordHitTiming(),
      getHitIntervals: () => [...hitIntervalsRef.current],
      getAverageReactionTime: () => getAverageReactionTime(),
      getGameStats: () => useGameStore.getState().gameStats,
      setGameStats: (stats: Partial<GameStats>) => {
        const prev = useGameStore.getState().gameStats;
        useGameStore.getState().setGameStats({ ...prev, ...stats });
      },
    };
    return () => {
      delete w.__shootbang_test;
    };
  }, [targetsRef, recordHitTiming, getAverageReactionTime]);

  // 组件卸载时清除倒计时
  useEffect(() => {
    return () => {
      if (countdownTimer.current) clearTimeout(countdownTimer.current);
    };
  }, []);

  // 点击处理
  const handleClick = useCallback(() => {
    if (useGameStore.getState().gameState !== "playing") return;
    if (countdownTimer.current !== null) return;
    if (!cameraRef.current) return;

    const s = useSettingsStore.getState();
    shotsRef.current++;
    raycasterRef.current.setFromCamera(CENTER_SCREEN, cameraRef.current);

    const active = targetsRef.current.slice(0, s.targetCount);
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
        recordHitTiming();
        spawnTarget(
          hitTarget,
          targetsRef.current,
          s.gridPositions,
          s.targetCount,
        );
      }
    } else {
      playMissSound();
    }
  }, [targetsRef, cameraRef, raycasterRef, recordHitTiming]);

  useEffect(() => {
    handleClickRef.current = handleClick;
  }, [handleClick]);

  // 鼠标点击事件
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (useGameStore.getState().gameState !== "playing") return;
      if (e.button !== 0) return;

      if (!document.pointerLockElement) {
        if (!useGameStore.getState().isPaused) useGameStore.getState().setIsPaused(true);
      } else if (!useGameStore.getState().isPaused) {
        handleClickRef.current();
      }
    };
    window.addEventListener("mousedown", handleMouseDown);
    return () => window.removeEventListener("mousedown", handleMouseDown);
  }, []);

  // 游戏计时
  useEffect(() => {
    if (gameState !== "playing" || isPaused || countdown !== null) return;

    const segmentStartTime = Date.now();
    const segmentStartRemaining = timeLeftRef.current;
    let tick = 0;
    const timer = setInterval(() => {
      const elapsed = (Date.now() - segmentStartTime) / 1000;
      timeLeftRef.current = Math.max(0, segmentStartRemaining - elapsed);
      if (++tick % 10 === 0) setTimeLeft(timeLeftRef.current);
      if (timeLeftRef.current <= 0) {
        setTimeLeft(0);
        useGameStore.getState().setGameState("finished");
        const totalShots = shotsRef.current;
        const hits = hitsRef.current;
        const accuracy = totalShots > 0 ? Math.round((hits / totalShots) * 100) : 0;
        const avgReactionTime = getAverageReactionTime();
        useGameStore.getState().setGameStats({ hits, totalShots, accuracy, avgReactionTime });
        hideAllTargets(targetsRef.current);
        document.exitPointerLock();
        useGameStore.getState().setIsLocked(false);
        clearInterval(timer);
      }
    }, 10);

    return () => clearInterval(timer);
  }, [gameState, isPaused, countdown, targetsRef, getAverageReactionTime]);

  return {
    gameState,
    isLocked,
    isPaused,
    countdown,
    timeLeft,
    timeLeftRef,
    gameSessionId,
    triggerStart,
    triggerResume,
    startGame,
    startCountdown,
    gameStats,
  };
}
