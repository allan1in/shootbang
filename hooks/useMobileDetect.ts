"use client";

import { useState, useEffect } from "react";

export function useMobileDetect() {
  const [isMobile, setIsMobile] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const check = () => {
      const hasTouch =
        "ontouchstart" in window || navigator.maxTouchPoints > 0;
      const isSmall = window.innerWidth < 768;
      setIsMobile(hasTouch || isSmall);
    };
    check();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(true);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return { isMobile, ready };
}
