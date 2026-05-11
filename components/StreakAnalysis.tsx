"use client";

import { Card, CardContent } from "@/components/ui/card";
import { type StreakData } from "@/lib/analysis";

interface StreakAnalysisProps {
  data: StreakData;
}

export function StreakAnalysis({ data }: StreakAnalysisProps) {
  if (data.timeline.length === 0) {
    return (
      <Card className="border-foreground/10">
        <CardContent className="p-4">
          <div className="text-sm text-muted-foreground mb-2">连击分析</div>
          <div className="text-center text-muted-foreground py-8">暂无数据</div>
        </CardContent>
      </Card>
    );
  }

  const { timeline } = data;
  const total = timeline.length;

  // 将时间轴分段，每段最多 maxPerRow 个
  const maxPerRow = 60;
  const rows: typeof timeline[] = [];
  for (let i = 0; i < total; i += maxPerRow) {
    rows.push(timeline.slice(i, i + maxPerRow));
  }

  return (
    <Card className="border-foreground/10">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-muted-foreground">连击分析</div>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>
              最高 <span className="text-primary font-bold text-sm">{data.max}</span> 连
            </span>
            <span>
              平均 <span className="text-foreground font-medium">{data.avg}</span> 连
            </span>
            <span>
              共 <span className="text-foreground font-medium">{data.totalStreaks}</span> 段
            </span>
          </div>
        </div>

        {/* 时间轴 */}
        <div className="mb-3">
          <div className="text-[11px] text-muted-foreground mb-1.5">
            命中/未命中时间轴 (共 {total} 发)
          </div>
          <div className="space-y-0.5">
            {rows.map((row, rowIdx) => (
              <div key={rowIdx} className="flex gap-px">
                {row.map((shot, i) => {
                  const globalIdx = rowIdx * maxPerRow + i;
                  // 判断是否属于长连击段 (>=5)
                  const isLongStreak = shot.hit && shot.streakLen >= 5;
                  // 找到这个连击段的起点（向后查找直到 streakLen=1 或 miss）
                  const isStreakStart = shot.hit && shot.streakLen === 1;
                  const isStreakEnd = shot.hit && (globalIdx + 1 >= total || !timeline[globalIdx + 1]?.hit || timeline[globalIdx + 1]?.streakLen === 1);

                  return (
                    <div
                      key={globalIdx}
                      className={`flex-1 h-4 rounded-sm transition-colors ${
                        !shot.hit
                          ? "bg-red-500/30"
                          : isLongStreak
                            ? "bg-yellow-500/70"
                            : "bg-green-500/50"
                      } ${isStreakStart ? "rounded-l" : ""} ${isStreakEnd ? "rounded-r" : ""}`}
                      title={
                        !shot.hit
                          ? `第${globalIdx + 1}发: 未命中`
                          : `第${globalIdx + 1}发: 命中 (连击${shot.streakLen})`
                      }
                    />
                  );
                })}
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-green-500/50" /> 命中
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-red-500/30" /> 未命中
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm bg-yellow-500/70" /> 连击≥5
            </span>
          </div>
        </div>

        {/* 统计摘要 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border border-foreground/10 bg-foreground/5 p-2.5 text-center">
            <div className="text-lg font-bold text-primary">{data.max}</div>
            <div className="text-[11px] text-muted-foreground">最高连击</div>
          </div>
          <div className="rounded-lg border border-foreground/10 bg-foreground/5 p-2.5 text-center">
            <div className="text-lg font-bold">{data.avg}</div>
            <div className="text-[11px] text-muted-foreground">平均连击</div>
          </div>
          <div className="rounded-lg border border-foreground/10 bg-foreground/5 p-2.5 text-center">
            <div className="text-lg font-bold">{data.totalStreaks}</div>
            <div className="text-[11px] text-muted-foreground">连击段数</div>
          </div>
          <div className="rounded-lg border border-foreground/10 bg-foreground/5 p-2.5 text-center">
            <div className="text-lg font-bold">{data.longestGap}</div>
            <div className="text-[11px] text-muted-foreground">最长断连</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
