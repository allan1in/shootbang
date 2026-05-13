import React from "react";

interface CountdownOverlayProps {
  countdown: number | null;
}

export const CountdownOverlay = React.memo(function CountdownOverlay({
  countdown,
}: CountdownOverlayProps) {
  if (countdown === null) return null;

  return (
    <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none">
      <div className="text-9xl font-bold text-foreground/80 tabular-nums">
        {countdown}
      </div>
    </div>
  );
});
