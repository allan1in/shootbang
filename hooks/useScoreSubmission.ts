"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useSyncRef } from "@/hooks/useSyncRef";
import { type ShotLogEntry } from "@/lib/analysis";

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
  targetSize: string;
  user: AuthUser | null;
  shotLogRef: React.MutableRefObject<ShotLogEntry[]>;
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
    targetSize,
    user,
    shotLogRef,
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
  const targetSizeRef = useSyncRef(targetSize);
  const userRef = useSyncRef(user);

  useEffect(() => {
    if (gameState !== "finished") return;
    const u = userRef.current;
    if (!u) return;

    // 合并 shotLog 到 shotHits，新增字段写入 ShotHit 表
    const shotLog = shotLogRef.current;

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
        targetSize: targetSizeRef.current,
        shotHits: shotLog,
      }),
    })
      .then((res) => {
        if (!res.ok) {
          toast.error("成绩保存失败，请重新登录");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.isNewBest) setIsNewBest(true);
      })
      .catch(() => {
        toast.error("成绩保存失败");
      });
  }, [gameState]);

  return { isNewBest, setIsNewBest };
}
