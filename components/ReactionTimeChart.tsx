"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";
import { Card, CardContent } from "@/components/ui/card";

interface ReactionTimeChartProps {
  data: { index: number; value: number }[];
}

export function ReactionTimeChart({ data }: ReactionTimeChartProps) {
  if (data.length === 0) {
    return (
      <Card className="border-foreground/10">
        <CardContent className="p-4">
          <div className="text-sm text-muted-foreground mb-2">反应时间趋势</div>
          <div className="text-center text-muted-foreground py-8">暂无数据</div>
        </CardContent>
      </Card>
    );
  }

  const avg = Math.round(data.reduce((s, d) => s + d.value, 0) / data.length);
  const min = Math.min(...data.map((d) => d.value));
  const max = Math.max(...data.map((d) => d.value));

  return (
    <Card className="border-foreground/10">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm text-muted-foreground">反应时间趋势</div>
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span>最快 <span className="text-green-500 font-medium">{min}ms</span></span>
            <span>最慢 <span className="text-red-500 font-medium">{max}ms</span></span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="index"
              tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              tickLine={false}
              unit="ms"
            />
            <Tooltip
              contentStyle={{
                background: "rgba(0,0,0,0.8)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "rgba(255,255,255,0.6)" }}
              formatter={(value) => [`${value}ms`, "反应时间"]}
            />
            <ReferenceLine
              y={avg}
              stroke="rgba(239,68,68,0.5)"
              strokeDasharray="4 4"
              label={{
                value: `平均 ${avg}ms`,
                position: "right",
                fill: "rgba(239,68,68,0.7)",
                fontSize: 10,
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 2, fill: "#3b82f6" }}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
