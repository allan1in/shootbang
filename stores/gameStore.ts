import { create } from "zustand";
import { persist } from "zustand/middleware";
import { generateGridPositions } from "@/lib/grid";
import {
  DEFAULT_SENSITIVITIES,
  isSensitivityMode,
  normalizeSensitivityForMode,
  type SensitivityMode,
  type SensitivityValues,
} from "@/lib/sensitivity";

const TARGET_COUNT = 3;

// ============ Settings ============

interface SettingsState {
  sensitivityMode: SensitivityMode;
  sensitivities: SensitivityValues;
  gridSize: number;
  duration: number;
  targetSize: string;
  targetCount: number;
  gridPositions: [number, number][];
  volume: number;
  volumePreview: number | null;
  muted: boolean;
  setSensitivitySettings: (
    mode: SensitivityMode,
    sensitivities: SensitivityValues,
  ) => void;
  setGridSize: (v: number) => void;
  setDuration: (v: number) => void;
  setTargetSize: (v: string) => void;
  setVolume: (volume: number) => void;
  setVolumePreview: (volume: number) => void;
  clearVolumePreview: () => void;
}

interface PersistedSettingsState {
  sensitivityMode?: unknown;
  sensitivities?: unknown;
  sensitivity?: unknown;
  gridSize?: number;
  duration?: number;
  targetSize?: string;
  volume?: number;
  muted?: boolean;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function resolveSensitivities(persistedState: unknown): SensitivityValues {
  const persisted = asRecord(persistedState);
  const newSensitivities = asRecord(persisted?.sensitivities);
  const newCs2 = normalizeSensitivityForMode("cs2", newSensitivities?.cs2);
  const legacyCs2 = normalizeSensitivityForMode("cs2", persisted?.sensitivity);
  const valorant = normalizeSensitivityForMode(
    "valorant",
    newSensitivities?.valorant,
  );
  const delta = normalizeSensitivityForMode("delta", newSensitivities?.delta);

  return {
    cs2: newCs2 ?? legacyCs2 ?? DEFAULT_SENSITIVITIES.cs2,
    valorant: valorant ?? DEFAULT_SENSITIVITIES.valorant,
    delta: delta ?? DEFAULT_SENSITIVITIES.delta,
  };
}

export const useSettingsStore = create<SettingsState>()(
  persist<SettingsState, [], [], PersistedSettingsState>(
    (set) => ({
      sensitivityMode: "cs2",
      sensitivities: {
        ...DEFAULT_SENSITIVITIES,
      },
      gridSize: 3,
      duration: 30,
      targetSize: "default",
      targetCount: TARGET_COUNT,
      gridPositions: generateGridPositions(3),
      volume: 100,
      volumePreview: null,
      muted: false,
      setSensitivitySettings: (sensitivityMode, sensitivities) =>
        set({ sensitivityMode, sensitivities: { ...sensitivities } }),
      setGridSize: (v) => set({ gridSize: v, gridPositions: generateGridPositions(v) }),
      setDuration: (v) => set({ duration: v }),
      setTargetSize: (v) => set({ targetSize: v }),
      setVolume: (volume: number) => {
        const nextVolume = Math.round(Math.min(100, Math.max(0, volume)));
        set({ volume: nextVolume, volumePreview: null, muted: nextVolume === 0 });
      },
      setVolumePreview: (volume: number) => set({
        volumePreview: Math.round(Math.min(100, Math.max(0, volume))),
      }),
      clearVolumePreview: () => set({ volumePreview: null }),
    }),
    {
      name: "shootbang-settings",
      version: 1,
      migrate: (persistedState) => persistedState as PersistedSettingsState,
      merge: (persistedState, currentState) => {
        const persisted = asRecord(persistedState);
        const gridSize = typeof persisted?.gridSize === "number"
          ? persisted.gridSize
          : currentState.gridSize;
        const storedVolume = typeof persisted?.volume === "number"
          ? persisted.volume
          : persisted?.muted ? 0 : currentState.volume;
        const volume = Math.round(Math.min(100, Math.max(0, storedVolume)));

        return {
          ...currentState,
          sensitivityMode: isSensitivityMode(persisted?.sensitivityMode)
            ? persisted.sensitivityMode
            : "cs2",
          sensitivities: resolveSensitivities(persistedState),
          gridSize,
          duration: typeof persisted?.duration === "number"
            ? persisted.duration
            : currentState.duration,
          targetSize: typeof persisted?.targetSize === "string"
            ? persisted.targetSize
            : currentState.targetSize,
          gridPositions: generateGridPositions(gridSize),
          volume,
          volumePreview: null,
          muted: volume === 0,
        };
      },
      partialize: (state) => ({
        sensitivityMode: state.sensitivityMode,
        sensitivities: { ...state.sensitivities },
        gridSize: state.gridSize,
        duration: state.duration,
        targetSize: state.targetSize,
        volume: state.volume,
        muted: state.muted,
      }),
    },
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
