"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface HistoryComparisonProps {
  currentScore: number;
  currentHitRate: number;
  currentHits: number;
  currentReactionAvg: number | null;
  gridSize: number;
  targetCount: number;
  duration: number;
  targetSize: string;
}

interface HistoryStats {
  avgScore: number;
  avgHitRate: number;
  avgHits: number;
  avgReaction: number | null;
  bestScore: number;
  gamesPlayed: number;
}

export function HistoryComparison({
  currentScore,
  currentHitRate,
  currentHits,
  currentReactionAvg,
  gridSize,
  targetCount,
  duration,
  targetSize,
}: HistoryComparisonProps) {
  const [stats, setStats] = useState<HistoryStats | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({
      gridSize: String(gridSize),
      targetCount: String(targetCount),
      duration: String(duration),
      targetSize,
    });
    fetch(`/api/history?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.scores?.length) return;
        const scores = data.scores;
        const validReactions = scores.filter(
          (s: { reactionAvg: number | null }) => s.reactionAvg != null,
        );
        setStats({
          avgScore: Math.round(
            scores.reduce((s: number, x: { score: number }) => s + x.score, 0) / scores.length,
          ),
          avgHitRate: Math.round(
            scores.reduce((s: number, x: { hitRate: number }) => s + x.hitRate, 0) / scores.length,
          ),
          avgHits: Math.round(
            scores.reduce((s: number, x: { hits: number }) => s + x.hits, 0) / scores.length,
          ),
          avgReaction:
            validReactions.length > 0
              ? Math.round(
                  validReactions.reduce(
                    (s: number, x: { reactionAvg: number }) => s + (x.reactionAvg ?? 0),
                    0,
                  ) / validReactions.length,
                )
              : null,
          bestScore: data.best?.score ?? Math.max(...scores.map((s: { score: number }) => s.score)),
          gamesPlayed: scores.length,
        });
      })
      .catch(() => {});
  }, [gridSize, targetCount, duration, targetSize]);

  if (!stats || stats.gamesPlayed === 0) {
    return (
      <Card className="border-foreground/10">
        <CardContent className="p-4">
          <div className="text-sm text-muted-foreground mb-2">历史对比</div>
          <div className="text-center text-muted-foreground py-4">
            暂无历史数据，多玩几局后这里会展示你的进步趋势
          </div>
        </CardContent>
      </Card>
    );
  }

  const rows = [
    {
      label: "总分",
      current: currentScore as number | null,
      avg: stats.avgScore,
      format: (v: number) => String(v),
      higher: true,
    },
    {
      label: "准确率",
      current: currentHitRate as number | null,
      avg: stats.avgHitRate,
      format: (v: number) => `${v}%`,
      higher: true,
    },
    {
      label: "命中数",
      current: currentHits as number | null,
      avg: stats.avgHits,
      format: (v: number) => String(v),
      higher: true,
    },
    {
      label: "反应时间",
      current: currentReactionAvg,
      avg: stats.avgReaction,
      format: (v: number) => `${v}ms`,
      higher: false,
    },
  ];

  return (
    <Card className="border-foreground/10">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-muted-foreground">历史对比</div>
          <div className="text-xs text-muted-foreground">
            共 <span className="text-foreground">{stats.gamesPlayed}</span> 局同配置记录
          </div>
        </div>
        <div className="space-y-2">
          {rows.map((row) => {
            if (row.current == null || row.avg == null) return null;
            const diff = row.current - row.avg;
            const isBetter = row.higher ? diff > 0 : diff < 0;
            const isWorse = row.higher ? diff < 0 : diff > 0;
            return (
              <div
                key={row.label}
                className="flex items-center justify-between text-sm py-1.5 border-b border-foreground/5 last:border-0"
              >
                <span className="text-muted-foreground w-16">{row.label}</span>
                <span className="font-bold w-20 text-right">{row.format(row.current)}</span>
                <span className="text-muted-foreground w-20 text-right text-xs">
                  均 {row.format(row.avg)}
                </span>
                <span
                  className={`w-16 text-right text-xs font-medium ${
                    isBetter ? "text-green-500" : isWorse ? "text-red-500" : "text-muted-foreground"
                  }`}
                >
                  {diff === 0 ? "持平" : `${diff > 0 ? "+" : ""}${row.format(diff)}`}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
