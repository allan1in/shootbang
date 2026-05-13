import React from "react";

interface CountdownOverlayProps {
  countdown: number | null;
}

export const CountdownOverlay = React.memo(function CountdownOverlay({
  countdown,
}: CountdownOverlayProps) {
  if (countdown === null) return null;

  return (
    <div className="absolute inset-0 z-40 flex items-start justify-center pointer-events-none pt-[25vh]">
      <div className="text-9xl font-bold text-foreground/80 tabular-nums">
        {countdown}
      </div>
    </div>
  );
});
