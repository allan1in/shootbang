"use client";

import { useEffect, useRef, useState } from "react";

export function FpsCounter() {
  const [fps, setFps] = useState(0);
  const frameRef = useRef(0);
  const lastRef = useRef(0);

  useEffect(() => {
    lastRef.current = performance.now();
    let raf: number;
    const tick = () => {
      frameRef.current++;
      const now = performance.now();
      if (now - lastRef.current >= 1000) {
        setFps(frameRef.current);
        frameRef.current = 0;
        lastRef.current = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="absolute bottom-3 right-3 z-30 text-xs font-mono text-muted-foreground bg-background/60 px-2 py-1 rounded">
      {fps} FPS
    </div>
  );
}
