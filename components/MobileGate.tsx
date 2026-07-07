"use client";

import dynamic from "next/dynamic";
import { useMobileDetect } from "@/hooks/useMobileDetect";
import { MobilePrompt } from "@/components/MobilePrompt";

// 动态导入：移动端只渲染提示语，不下载 three.js/tone.js 等游戏依赖
const GameBoard = dynamic(() => import("@/components/GameBoard"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen bg-background">
      <p className="text-muted-foreground">加载中…</p>
    </div>
  ),
});

export function MobileGate() {
  const { isMobile, ready } = useMobileDetect();

  if (!ready) return null;
  if (isMobile) return <MobilePrompt />;
  return <GameBoard />;
}
