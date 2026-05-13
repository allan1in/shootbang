import { Button } from "@/components/ui/button";
import { Home, Play, RotateCcw } from "lucide-react";

interface PauseOverlayProps {
  onHome: () => void;
  onRestart: () => void;
  onResume: () => void;
}

export function PauseOverlay({
  onHome,
  onRestart,
  onResume,
}: PauseOverlayProps) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/50">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon-lg"
          className="cursor-pointer border-foreground/10"
          aria-label="返回首页"
          onClick={onHome}
        >
          <Home className="size-5" />
        </Button>
        <Button
          variant="outline"
          size="icon-lg"
          className="cursor-pointer border-foreground/10"
          aria-label="继续"
          onClick={onResume}
        >
          <Play className="size-5" />
        </Button>
        <Button
          variant="outline"
          size="icon-lg"
          className="cursor-pointer border-foreground/10"
          aria-label="重新开始"
          onClick={onRestart}
        >
          <RotateCcw className="size-5" />
        </Button>
      </div>
    </div>
  );
}
