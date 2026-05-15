import { create } from "zustand";
import { persist } from "zustand/middleware";
import { generateGridPositions } from "@/lib/grid";

const TARGET_COUNT = 3;

// ============ Settings ============

interface SettingsState {
  sensitivity: number;
  gridSize: number;
  duration: number;
  targetSize: string;
  targetCount: number;
  gridPositions: [number, number][];
  muted: boolean;
  setSensitivity: (v: number) => void;
  setGridSize: (v: number) => void;
  setDuration: (v: number) => void;
  setTargetSize: (v: string) => void;
  toggleMute: () => void;
  setMuted: (muted: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      sensitivity: 1.0,
      gridSize: 3,
      duration: 30,
      targetSize: "default",
      targetCount: TARGET_COUNT,
      gridPositions: generateGridPositions(3),
      muted: false,
      setSensitivity: (v) => set({ sensitivity: v }),
      setGridSize: (v) => set({ gridSize: v, gridPositions: generateGridPositions(v) }),
      setDuration: (v) => set({ duration: v }),
      setTargetSize: (v) => set({ targetSize: v }),
      toggleMute: () => set((s) => ({ muted: !s.muted })),
      setMuted: (muted: boolean) => set({ muted }),
    }),
    { name: "shootbang-settings" },
  ),
);

// ============ Game State ============

export type GameState = "idle" | "playing" | "finished";

export interface GameStats {
  hits: number;
  totalShots: number;
  accuracy: number;
  avgReactionTime: number;
}

interface GameStateStore {
  gameState: GameState;
  isPaused: boolean;
  isLocked: boolean;
  gameStats: GameStats;
  countdown: number | null;
  setGameState: (s: GameState) => void;
  setIsPaused: (v: boolean) => void;
  setIsLocked: (v: boolean) => void;
  setGameStats: (s: GameStats) => void;
  setCountdown: (v: number | null) => void;
}

export const useGameStore = create<GameStateStore>()((set) => ({
  gameState: "idle",
  isPaused: false,
  isLocked: false,
  gameStats: { hits: 0, totalShots: 0, accuracy: 0, avgReactionTime: 0 },
  countdown: null,
  setGameState: (s) => set({ gameState: s }),
  setIsPaused: (v) => set({ isPaused: v }),
  setIsLocked: (v) => set({ isLocked: v }),
  setGameStats: (s) => set({ gameStats: s }),
  setCountdown: (v) => set({ countdown: v }),
}));

// ============ Theme ============

export type Theme = "default" | "thunderstorm" | "blizzard";

interface ThemeState {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "default" as Theme,
      setTheme: (t) => set({ theme: t }),
    }),
    { name: "shootbang-theme" },
  ),
);

// 常量，供外部同步读取
export const TARGET_COUNT_CONST = TARGET_COUNT;
