"use client";

import dynamic from "next/dynamic";
import { useMobileDetect } from "@/hooks/useMobileDetect";
import { LoadingScreen } from "@/components/LoadingScreen";
import { MobilePrompt } from "@/components/MobilePrompt";

// 动态导入：移动端只渲染提示语，不下载 three.js/tone.js 等游戏依赖
const GameBoard = dynamic(() => import("@/components/GameBoard"), {
  ssr: false,
  loading: LoadingScreen,
});

export function MobileGate() {
  const { isMobile, ready } = useMobileDetect();

  if (!ready) return <LoadingScreen />;
  if (isMobile) return <MobilePrompt />;
  return <GameBoard />;
}
