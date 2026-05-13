import { useEffect, useRef } from "react";

interface TimerBarProps {
  timeLeftRef: React.MutableRefObject<number>;
  duration: number;
}

export function TimerBar({ timeLeftRef, duration }: TimerBarProps) {
  const indicatorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let rafId: number;
    const tick = () => {
      if (indicatorRef.current) {
        const pct = ((duration - timeLeftRef.current) / duration) * 100;
        indicatorRef.current.style.width = `${Math.min(100, Math.max(0, pct))}%`;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [duration, timeLeftRef]);

  return (
    <div className="absolute top-3 left-3 right-3 z-50" data-slot="progress">
      <div
        data-slot="progress-track"
        className="block h-1 w-full overflow-hidden rounded-full bg-primary/20"
      >
        <div
          ref={indicatorRef}
          data-slot="progress-indicator"
          className="block h-full bg-primary"
        />
      </div>
    </div>
  );
}
