"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HitHeatmap } from "@/components/HitHeatmap";
import { ReactionTimeChart } from "@/components/ReactionTimeChart";
import { StreakAnalysis } from "@/components/StreakAnalysis";
import { PrecisionTrendChart } from "@/components/PrecisionTrendChart";
import { HistoryComparison } from "@/components/HistoryComparison";
import { analyzePerformance, type ShotLogEntry, type ScoreBreakdown } from "@/lib/analysis";

interface FinishedScreenProps {
  score: number;
  hits: number;
  totalClicks: number;
  hitRate: number;
  reactionAvg: number | null;
  isNewBest: boolean;
  shotLog: ShotLogEntry[];
  shotHits: { offsetX: number; offsetY: number }[];
  scoreBreakdown: ScoreBreakdown;
  gridSize: number;
  targetCount: number;
  duration: number;
  targetSize: string;
  onRestart: () => void;
  onGoHome: () => void;
}

export function FinishedScreen({
  score,
  hits,
  totalClicks,
  hitRate,
  reactionAvg,
  isNewBest,
  shotLog,
  shotHits,
  scoreBreakdown,
  gridSize,
  targetCount,
  duration,
  targetSize,
  onRestart,
  onGoHome,
}: FinishedScreenProps) {
  const analysis = useMemo(() => analyzePerformance(shotLog), [shotLog]);

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center bg-background/90 backdrop-blur-sm cursor-default overflow-y-auto">
      <div className="w-full max-w-3xl px-4 py-8 space-y-4">
        {/* 核心数据 */}
        <Card className="border-foreground/10">
          <CardContent className="p-6">
            <div className="text-center mb-4">
              <div className="text-5xl font-bold text-primary">{score}</div>
              <div className="text-sm text-muted-foreground mt-1">总分</div>
              {isNewBest && (
                <div className="text-sm text-yellow-500 font-semibold mt-1">新纪录!</div>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">{hits}</div>
                <div className="text-xs text-muted-foreground">命中</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{totalClicks}</div>
                <div className="text-xs text-muted-foreground">总射击</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{hitRate}%</div>
                <div className="text-xs text-muted-foreground">准确率</div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {reactionAvg != null ? `${reactionAvg}ms` : "-"}
                </div>
                <div className="text-xs text-muted-foreground">反应时间</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{analysis.streakData.max}</div>
                <div className="text-xs text-muted-foreground">最高连击</div>
              </div>
            </div>

            {/* 得分拆解 */}
            {score > 0 && (
              <div className="mt-6 pt-4 border-t border-foreground/10">
                <div className="text-xs text-muted-foreground mb-2">得分来源</div>
                <div className="space-y-1.5">
                  {[
                    { label: "精度分", value: scoreBreakdown.precisionTotal, color: "bg-blue-500" },
                    { label: "反应分", value: scoreBreakdown.reactionTotal, color: "bg-green-500" },
                    { label: "连击加成", value: scoreBreakdown.streakBonus, color: "bg-yellow-500" },
                    { label: "难度加成", value: scoreBreakdown.difficultyBonus, color: "bg-purple-500" },
                  ].map((item) => {
                    const pct = score > 0 ? Math.round((item.value / score) * 100) : 0;
                    return (
                      <div key={item.label} className="flex items-center gap-2 text-xs">
                        <span className="w-14 text-muted-foreground">{item.label}</span>
                        <div className="flex-1 h-2 bg-foreground/5 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${item.color} rounded-full transition-all`}
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                        <span className="w-12 text-right font-medium">{item.value}</span>
                        <span className="w-8 text-right text-muted-foreground">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 热力图 + 反应时间 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <HitHeatmap shotHits={shotHits} targetSize={targetSize} />
          <ReactionTimeChart data={analysis.reactionTrend} />
        </div>

        {/* 精度趋势 */}
        <PrecisionTrendChart data={analysis.precisionTrend} />

        {/* 连击分析 */}
        <StreakAnalysis data={analysis.streakData} />

        {/* 训练建议 */}
        <Card className="border-foreground/10">
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground mb-3">训练建议</div>
            <div className="space-y-2">
              {analysis.suggestions.map((s, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 text-sm"
                >
                  <span className="text-primary mt-0.5">•</span>
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 历史对比 */}
        <HistoryComparison
          currentScore={score}
          currentHitRate={hitRate}
          currentHits={hits}
          currentReactionAvg={reactionAvg}
          gridSize={gridSize}
          targetCount={targetCount}
          duration={duration}
          targetSize={targetSize}
        />

        {/* 操作按钮 */}
        <div className="flex gap-3 pb-8">
          <Button
            className="flex-1 cursor-pointer"
            onClick={onRestart}
          >
            再来一局
          </Button>
          <Button
            variant="outline"
            className="flex-1 cursor-pointer border-foreground/10"
            onClick={onGoHome}
          >
            返回首页
          </Button>
        </div>
      </div>
    </div>
  );
}
