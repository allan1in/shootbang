import React from "react";
import { Home, Play, RotateCcw } from "lucide-react";
import { IconButton } from "@/components/IconButton";

interface PauseOverlayProps {
  onHome: () => void;
  onRestart: () => void;
  onResume: () => void;
}

export const PauseOverlay = React.memo(function PauseOverlay({
  onHome,
  onRestart,
  onResume,
}: PauseOverlayProps) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/50">
      <div className="flex items-center gap-3">
        <IconButton icon={Home} label="返回首页" onClick={onHome} />
        <IconButton icon={Play} label="继续" onClick={onResume} />
        <IconButton icon={RotateCcw} label="重新开始" onClick={onRestart} />
      </div>
    </div>
  );
});
