import React from "react";
import type { GameStats } from "@/hooks/useGameLogic";

interface ResultStatsProps {
  stats: GameStats;
}

export const ResultStats = React.memo(function ResultStats({
  stats,
}: ResultStatsProps) {
  return (
    <div className="flex gap-6 mb-3 text-center">
      <div>
        <div className="text-3xl font-bold tabular-nums">{stats.accuracy}%</div>
        <div className="text-sm text-muted-foreground">命中率</div>
      </div>
      <div>
        <div className="text-3xl font-bold tabular-nums">{stats.hits}</div>
        <div className="text-sm text-muted-foreground">命中</div>
      </div>
      <div>
        <div className="text-3xl font-bold tabular-nums">
          {stats.avgReactionTime}ms
        </div>
        <div className="text-sm text-muted-foreground">平均反应时间</div>
      </div>
    </div>
  );
});
