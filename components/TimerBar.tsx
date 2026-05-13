import React from "react";
import { Progress } from "@/components/ui/progress";

interface TimerBarProps {
  timeLeft: number;
  duration: number;
}

export const TimerBar = React.memo(function TimerBar({
  timeLeft,
  duration,
}: TimerBarProps) {
  const value = ((duration - timeLeft) / duration) * 100;

  return (
    <div className="absolute top-3 left-3 right-3 z-50">
      <Progress value={value} />
    </div>
  );
});
