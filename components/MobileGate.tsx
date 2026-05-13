"use client";

import { useMobileDetect } from "@/hooks/useMobileDetect";
import { MobilePrompt } from "@/components/MobilePrompt";
import GameBoard from "@/components/GameBoard";

export function MobileGate() {
  const { isMobile, ready } = useMobileDetect();

  if (!ready) return null;
  if (isMobile) return <MobilePrompt />;
  return <GameBoard />;
}
