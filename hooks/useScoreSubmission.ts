"use client";

import { useState, useEffect } from "react";
import { useSyncRef } from "@/hooks/useSyncRef";

type GameState = "idle" | "playing" | "finished";

interface AuthUser {
  id: number;
  email: string;
}

interface UseScoreSubmissionDeps {
  gameState: GameState;
  score: number;
  hits: number;
  totalClicks: number;
  hitRate: number;
  reactionAvg: number | null;
  gridSize: number;
  targetCount: number;
  duration: number;
  user: AuthUser | null;
}

export function useScoreSubmission(deps: UseScoreSubmissionDeps) {
  const {
    gameState,
    score,
    hits,
    totalClicks,
    hitRate,
    reactionAvg,
    gridSize,
    targetCount,
    duration,
    user,
  } = deps;

  const [isNewBest, setIsNewBest] = useState(false);

  // 用 ref 包装所有值，避免闭包过期问题
  const scoreRef = useSyncRef(score);
  const hitsRef = useSyncRef(hits);
  const totalClicksRef = useSyncRef(totalClicks);
  const hitRateRef = useSyncRef(hitRate);
  const reactionAvgRef = useSyncRef(reactionAvg);
  const gridSizeRef = useSyncRef(gridSize);
  const targetCountRef = useSyncRef(targetCount);
  const durationRef = useSyncRef(duration);
  const userRef = useSyncRef(user);

  useEffect(() => {
    if (gameState !== "finished") return;
    const u = userRef.current;
    if (!u) return;

    fetch("/api/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        score: scoreRef.current,
        hits: hitsRef.current,
        totalClicks: totalClicksRef.current,
        hitRate: hitRateRef.current,
        reactionAvg: reactionAvgRef.current,
        gridSize: gridSizeRef.current,
        targetCount: targetCountRef.current,
        duration: durationRef.current,
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.isNewBest) setIsNewBest(true);
      })
      .catch(() => {});
  }, [gameState]);

  return { isNewBest, setIsNewBest };
}
