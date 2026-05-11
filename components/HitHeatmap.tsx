"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";

const TARGET_RADIUS_MAP: Record<string, number> = {
  tiny: 0.135,
  small: 0.27,
  default: 0.405,
  large: 0.54,
  huge: 0.675,
};

interface HitHeatmapProps {
  shotHits: { offsetX: number; offsetY: number }[];
  targetSize: string;
}

export function HitHeatmap({ shotHits, targetSize }: HitHeatmapProps) {
  const targetRadius = TARGET_RADIUS_MAP[targetSize] ?? 0.405;

  const stats = useMemo(() => {
    if (shotHits.length === 0) return null;

    // 归一化到目标半径
    const nx = shotHits.map((h) => h.offsetX / targetRadius);
    const ny = shotHits.map((h) => h.offsetY / targetRadius);

    const avgX = nx.reduce((s, v) => s + v, 0) / nx.length;
    const avgY = ny.reduce((s, v) => s + v, 0) / ny.length;
    const stdX = Math.sqrt(nx.reduce((s, v) => s + (v - avgX) ** 2, 0) / nx.length);
    const stdY = Math.sqrt(ny.reduce((s, v) => s + (v - avgY) ** 2, 0) / ny.length);

    const biasX = avgX > 0.1 ? "偏右" : avgX < -0.1 ? "偏左" : "居中";
    const biasY = avgY > 0.1 ? "偏上" : avgY < -0.1 ? "偏下" : "居中";

    return { avgX, avgY, stdX, stdY, biasX, biasY, nx, ny };
  }, [shotHits, targetRadius]);

  if (!stats || shotHits.length === 0) {
    return (
      <Card className="border-foreground/10">
        <CardContent className="p-4">
          <div className="text-sm text-muted-foreground mb-2">命中热力图</div>
          <div className="text-center text-muted-foreground py-8">暂无命中数据</div>
        </CardContent>
      </Card>
    );
  }

  const size = 220;
  const center = size / 2;
  const scale = (center - 10) * 0.9; // 归一化后 1.0 = 靶圈边缘

  return (
    <Card className="border-foreground/10">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-muted-foreground">命中热力图</div>
          <div className="text-[11px] text-muted-foreground">
            目标: {targetSize} (r={targetRadius})
          </div>
        </div>
        <div className="flex flex-col items-center">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {/* 背景靶 */}
            <circle
              cx={center}
              cy={center}
              r={center - 4}
              fill="rgba(0,0,0,0.3)"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth={1}
            />

            {/* 靶环 (归一化后的同心圆) */}
            {[0.25, 0.5, 0.75, 1.0].map((r) => (
              <circle
                key={r}
                cx={center}
                cy={center}
                r={scale * r}
                fill="none"
                stroke={r === 1.0 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.06)"}
                strokeWidth={r === 1.0 ? 1.5 : 1}
                strokeDasharray={r === 1.0 ? "none" : "4 2"}
              />
            ))}

            {/* 十字线 */}
            <line
              x1={center}
              y1={4}
              x2={center}
              y2={size - 4}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={1}
            />
            <line
              x1={4}
              y1={center}
              x2={size - 4}
              y2={center}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={1}
            />

            {/* 四象限底色 */}
            <rect x={center} y={4} width={center - 4} height={center - 4} fill="rgba(59,130,246,0.03)" />
            <rect x={4} y={4} width={center - 4} height={center - 4} fill="rgba(34,197,94,0.03)" />
            <rect x={4} y={center} width={center - 4} height={center - 4} fill="rgba(234,179,8,0.03)" />
            <rect x={center} y={center} width={center - 4} height={center - 4} fill="rgba(239,68,68,0.03)" />

            {/* 置信椭圆 (1σ) */}
            {stats.stdX > 0.05 && stats.stdY > 0.05 && (
              <ellipse
                cx={center + stats.avgX * scale}
                cy={center - stats.avgY * scale}
                rx={stats.stdX * scale * 2}
                ry={stats.stdY * scale * 2}
                fill="rgba(59,130,246,0.08)"
                stroke="rgba(59,130,246,0.2)"
                strokeWidth={1}
                strokeDasharray="4 2"
              />
            )}

            {/* 命中点 */}
            {stats.nx.map((x, i) => (
              <circle
                key={i}
                cx={center + x * scale}
                cy={center - stats.ny[i] * scale}
                r={3}
                fill="rgba(59,130,246,0.6)"
              />
            ))}

            {/* 平均偏移指示器 */}
            <circle
              cx={center + stats.avgX * scale}
              cy={center - stats.avgY * scale}
              r={6}
              fill="none"
              stroke="#ef4444"
              strokeWidth={2}
            />
            <circle
              cx={center + stats.avgX * scale}
              cy={center - stats.avgY * scale}
              r={2}
              fill="#ef4444"
            />

            {/* 中心点 */}
            <circle cx={center} cy={center} r={2} fill="rgba(255,255,255,0.3)" />
          </svg>

          <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
            <span>
              水平:{" "}
              <span className={stats.biasX === "居中" ? "text-green-500" : "text-yellow-500"}>
                {stats.biasX}
              </span>
            </span>
            <span>
              垂直:{" "}
              <span className={stats.biasY === "居中" ? "text-green-500" : "text-yellow-500"}>
                {stats.biasY}
              </span>
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            标准差: σx={stats.stdX.toFixed(3)} σy={stats.stdY.toFixed(3)} (归一化)
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
