import React from "react";
import { Home, MessageSquareText, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GameStats } from "@/hooks/useGameLogic";
import { ResultStats } from "./ResultStats";

interface FinishedOverlayProps {
  stats: GameStats;
  onRestart: () => void;
  onHome: () => void;
  onOpenFeedback: () => void;
}

export const FinishedOverlay = React.memo(function FinishedOverlay({
  stats,
  onRestart,
  onHome,
  onOpenFeedback,
}: FinishedOverlayProps) {
  return (
    <div className="absolute inset-0 z-20 flex cursor-default items-center justify-center bg-background/50">
      <div className="flex flex-col items-center">
        <ResultStats stats={stats} />
        <div className="flex flex-wrap items-center justify-center gap-3 px-4">
          <Button variant="outline" className="cursor-pointer border-foreground/10" onClick={onRestart}>
            <RotateCcw data-icon="inline-start" className="size-4" />
            重新开始
          </Button>
          <Button variant="outline" className="cursor-pointer border-foreground/10" onClick={onHome}>
            <Home data-icon="inline-start" className="size-4" />
            回到首页
          </Button>
          <Button variant="outline" className="cursor-pointer border-foreground/10" onClick={onOpenFeedback}>
            <MessageSquareText data-icon="inline-start" className="size-4" />
            反馈
          </Button>
        </div>
      </div>
    </div>
  );
});
