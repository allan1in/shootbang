"use client";

import { useEffect } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";

export type Theme = "default" | "thunderstorm";

export function useTheme() {
  const [theme, setTheme] = useLocalStorage<Theme>(
    "shootbang-theme",
    "default",
    (s) => (s === "thunderstorm" ? "thunderstorm" : "default"),
  );

  // Sync class on mount and when theme changes
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "thunderstorm") {
      root.classList.add("thunderstorm");
    } else {
      root.classList.remove("thunderstorm");
    }
  }, [theme]);

  return { theme, setTheme };
}
