import { DEFAULT_CROSSHAIR_SETTINGS, type CrosshairSettings } from "@/lib/crosshair";
import { useSettingsStore, useThemeStore } from "@/stores/gameStore";
import type { TrainingProperties } from "@/lib/analytics";

export function isCrosshairCustomized(crosshair: CrosshairSettings) {
  return (Object.keys(DEFAULT_CROSSHAIR_SETTINGS) as (keyof CrosshairSettings)[])
    .some((key) => crosshair[key] !== DEFAULT_CROSSHAIR_SETTINGS[key]);
}

export function getTrainingProperties(): TrainingProperties {
  const settings = useSettingsStore.getState();
  return {
    duration: settings.duration,
    theme: useThemeStore.getState().theme,
    sensitivity_mode: settings.sensitivityMode,
    grid_size: settings.gridSize,
    target_size: settings.targetSize,
    crosshair_customized: isCrosshairCustomized(settings.crosshair),
    sound_enabled: settings.volume > 0,
  };
}
