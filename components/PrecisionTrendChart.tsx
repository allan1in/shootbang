"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { type PrecisionPoint } from "@/lib/analysis";

interface PrecisionTrendChartProps {
  data: PrecisionPoint[];
}

export function PrecisionTrendChart({ data }: PrecisionTrendChartProps) {
  if (data.length < 3) {
    return (
      <Card className="border-foreground/10">
        <CardContent className="p-4">
          <div className="text-sm text-muted-foreground mb-2">精度趋势</div>
          <div className="text-center text-muted-foreground py-8">数据不足</div>
        </CardContent>
      </Card>
    );
  }

  const avgPrecision = Math.round(data.reduce((s, d) => s + d.precision, 0) / data.length);

  return (
    <Card className="border-foreground/10">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm text-muted-foreground">精度趋势</div>
          <div className="text-xs text-muted-foreground">
            均值 <span className="text-foreground font-medium">{avgPrecision}</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="index"
              tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "rgba(0,0,0,0.8)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "rgba(255,255,255,0.6)" }}
              formatter={(value, name) => [
                value,
                name === "precision" ? "精度分" : "移动平均",
              ]}
            />
            <ReferenceLine
              y={avgPrecision}
              stroke="rgba(255,255,255,0.15)"
              strokeDasharray="4 4"
            />
            <Area
              type="monotone"
              dataKey="precision"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.1}
              strokeWidth={1}
              dot={false}
              name="precision"
            />
            <Area
              type="monotone"
              dataKey="avg"
              stroke="#22c55e"
              fill="none"
              strokeWidth={2}
              dot={false}
              name="avg"
            />
          </AreaChart>
        </ResponsiveContainer>
        <div className="flex gap-3 mt-2 text-[10px] text-muted-foreground justify-center">
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-blue-500 rounded" /> 精度分
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-green-500 rounded" /> 移动平均(窗口5)
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
