"use client";

import { useEffect } from "react";
import { useThemeStore, type Theme } from "@/stores/gameStore";

export type { Theme };

export function useTheme() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "thunderstorm") {
      root.classList.add("thunderstorm");
      root.classList.remove("blizzard");
    } else if (theme === "blizzard") {
      root.classList.add("blizzard");
      root.classList.remove("thunderstorm");
    } else {
      root.classList.remove("thunderstorm", "blizzard");
    }
  }, [theme]);

  return { theme, setTheme };
}
