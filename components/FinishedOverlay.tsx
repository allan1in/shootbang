import React from "react";
import { Home, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GameStats } from "@/hooks/useGameLogic";
import { ResultStats } from "./ResultStats";

interface FinishedOverlayProps {
  stats: GameStats;
  onRestart: () => void;
  onHome: () => void;
  muted: boolean;
  onToggleMute: () => void;
}

export const FinishedOverlay = React.memo(function FinishedOverlay({
  stats,
  onRestart,
  onHome,
  muted,
  onToggleMute,
}: FinishedOverlayProps) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/50 cursor-default">
      <div className="flex flex-col items-center">
        <ResultStats stats={stats} />
        <div className="flex items-center gap-3">
          <Button variant="outline" className="cursor-pointer border-foreground/10" onClick={onRestart}>
            <RotateCcw data-icon="inline-start" className="size-4" />
            重新开始
          </Button>
          <Button variant="outline" className="cursor-pointer border-foreground/10" onClick={onHome}>
            <Home data-icon="inline-start" className="size-4" />
            回到首页
          </Button>
          <Button variant="outline" className="cursor-pointer border-foreground/10" onClick={onToggleMute}>
            {muted ? <VolumeX data-icon="inline-start" className="size-4" /> : <Volume2 data-icon="inline-start" className="size-4" />}
            {muted ? "取消静音" : "静音"}
          </Button>
        </div>
      </div>
    </div>
  );
});
