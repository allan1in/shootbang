import React from "react";
import { Home, MessageSquareText, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PauseOverlayProps {
  onHome: () => void;
  onRestart: () => void;
  onResume: () => void;
  onOpenFeedback: () => void;
}

export const PauseOverlay = React.memo(function PauseOverlay({
  onHome,
  onRestart,
  onResume,
  onOpenFeedback,
}: PauseOverlayProps) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/50">
      <div className="flex flex-wrap items-center justify-center gap-3 px-4">
        <Button variant="outline" className="cursor-pointer border-foreground/10" onClick={onResume}>
          <Play data-icon="inline-start" className="size-4" />
          继续
        </Button>
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
  );
});
