import { Button } from "@/components/ui/button";
import { Home, RotateCcw } from "lucide-react";

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
      <div className="absolute top-4 left-4 flex gap-2">
        <Button
          variant="ghost"
          size="icon-lg"
          className="cursor-pointer"
          onClick={onHome}
        >
          <Home className="size-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-lg"
          className="cursor-pointer"
          onClick={onRestart}
        >
          <RotateCcw className="size-5" />
        </Button>
      </div>
      <Button
        variant="outline"
        size="lg"
        className="cursor-pointer border-foreground/10 text-base"
        onClick={onResume}
      >
        点击此处继续
      </Button>
    </div>
  );
}
