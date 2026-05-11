"use client";

import { useRef, useEffect } from "react";

interface HitHeatmapProps {
  shotHits: { offsetX: number; offsetY: number }[];
}

export function HitHeatmap({ shotHits }: HitHeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || shotHits.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = canvas.width;
    const center = size / 2;
    const scale = size / 3; // +/-1.5 units mapped to canvas

    ctx.clearRect(0, 0, size, size);

    // Background
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.beginPath();
    ctx.arc(center, center, center - 4, 0, Math.PI * 2);
    ctx.fill();

    // Target circle
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(center, center, center * 0.6, 0, Math.PI * 2);
    ctx.stroke();

    // Crosshair lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.beginPath();
    ctx.moveTo(center, 4);
    ctx.lineTo(center, size - 4);
    ctx.moveTo(4, center);
    ctx.lineTo(size - 4, center);
    ctx.stroke();

    // Plot hits
    for (const hit of shotHits) {
      const x = center + hit.offsetX * scale;
      const y = center - hit.offsetY * scale; // flip Y for screen coords

      ctx.fillStyle = "rgba(59, 130, 246, 0.6)";
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Average offset indicator
    const avgX = shotHits.reduce((sum, h) => sum + h.offsetX, 0) / shotHits.length;
    const avgY = shotHits.reduce((sum, h) => sum + h.offsetY, 0) / shotHits.length;
    const ax = center + avgX * scale;
    const ay = center - avgY * scale;

    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ax, ay, 5, 0, Math.PI * 2);
    ctx.stroke();
  }, [shotHits]);

  if (shotHits.length === 0) return null;

  const avgX = shotHits.reduce((sum, h) => sum + h.offsetX, 0) / shotHits.length;
  const avgY = shotHits.reduce((sum, h) => sum + h.offsetY, 0) / shotHits.length;

  const biasX = avgX > 0.05 ? "偏右" : avgX < -0.05 ? "偏左" : "居中";
  const biasY = avgY > 0.05 ? "偏上" : avgY < -0.05 ? "偏下" : "居中";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-sm text-muted-foreground">命中分布</div>
      <canvas
        ref={canvasRef}
        width={160}
        height={160}
        className="rounded-full"
      />
      <div className="text-xs text-muted-foreground">
        水平: {biasX} | 垂直: {biasY}
      </div>
    </div>
  );
}
