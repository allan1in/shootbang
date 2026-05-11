"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { ScoreTable } from "@/components/ScoreTable";

interface LeaderboardEntry {
  score: number;
  hits: number;
  hitRate: number;
  reactionAvg: number | null;
  createdAt: string;
  user: { email: string };
}

const DURATIONS = [15, 30, 60, 120];
const GRIDS = [3, 4, 5, 6];
const TARGET_SIZES = [
  { value: "tiny", label: "极小" },
  { value: "small", label: "小" },
  { value: "default", label: "默认" },
  { value: "large", label: "大" },
  { value: "huge", label: "极大" },
];

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [duration, setDuration] = useState(30);
  const [gridSize, setGridSize] = useState(3);
  const [targetCount, setTargetCount] = useState(3);
  const [targetSize, setTargetSize] = useState("default");
  const [loading, setLoading] = useState(true);
  const fetchIdRef = useRef(0);

  useEffect(() => {
    const id = ++fetchIdRef.current;
    const params = new URLSearchParams({
      gridSize: String(gridSize),
      targetCount: String(targetCount),
      duration: String(duration),
      targetSize,
    });

    fetch(`/api/leaderboard?${params}`)
      .then((res) => {
        if (id !== fetchIdRef.current) return null;
        if (!res.ok) throw new Error("加载失败");
        return res.json();
      })
      .then((data) => {
        if (id !== fetchIdRef.current || !data) return;
        setEntries(data.entries);
        setLoading(false);
      })
      .catch(() => {});
  }, [gridSize, targetCount, duration, targetSize]);

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon-lg"
            className="cursor-pointer"
            onClick={() => (window.location.href = "/")}
          >
            <ArrowLeft className="size-5" />
          </Button>
          <h1 className="text-2xl font-bold">排行榜</h1>
        </div>

        <Card>
          <CardContent className="py-4 space-y-3">
            <div className="flex gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground py-1">时长:</span>
              {DURATIONS.map((d) => (
                <Button
                  key={d}
                  variant={duration === d ? "default" : "outline"}
                  size="sm"
                  className="cursor-pointer"
                  onClick={() => setDuration(d)}
                >
                  {d}s
                </Button>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground py-1">网格:</span>
              {GRIDS.map((g) => (
                <Button
                  key={g}
                  variant={gridSize === g ? "default" : "outline"}
                  size="sm"
                  className="cursor-pointer"
                  onClick={() => {
                    setGridSize(g);
                    const maxTargets = Math.min(g * g - 1, 6);
                    if (targetCount > maxTargets) setTargetCount(maxTargets);
                  }}
                >
                  {g}x{g}
                </Button>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground py-1">目标数:</span>
              {Array.from(
                { length: Math.min(gridSize * gridSize - 1, 6) },
                (_, i) => i + 1,
              ).map((t) => (
                <Button
                  key={t}
                  variant={targetCount === t ? "default" : "outline"}
                  size="sm"
                  className="cursor-pointer"
                  onClick={() => setTargetCount(t)}
                >
                  {t}
                </Button>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground py-1">目标大小:</span>
              {TARGET_SIZES.map((s) => (
                <Button
                  key={s.value}
                  variant={targetSize === s.value ? "default" : "outline"}
                  size="sm"
                  className="cursor-pointer"
                  onClick={() => setTargetSize(s.value)}
                >
                  {s.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="text-center text-muted-foreground py-8">加载中...</div>
        ) : (
          <ScoreTable entries={entries} showRank showUser />
        )}
      </div>
    </div>
  );
}
