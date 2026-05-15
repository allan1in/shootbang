import React from "react";
import { Home, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PauseOverlayProps {
  onHome: () => void;
  onRestart: () => void;
  onResume: () => void;
  muted: boolean;
  onToggleMute: () => void;
}

export const PauseOverlay = React.memo(function PauseOverlay({
  onHome,
  onRestart,
  onResume,
  muted,
  onToggleMute,
}: PauseOverlayProps) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/50">
      <div className="flex items-center gap-3">
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
        <Button variant="outline" className="cursor-pointer border-foreground/10" onClick={onToggleMute}>
          {muted ? <VolumeX data-icon="inline-start" className="size-4" /> : <Volume2 data-icon="inline-start" className="size-4" />}
          {muted ? "取消静音" : "静音"}
        </Button>
      </div>
    </div>
  );
});
