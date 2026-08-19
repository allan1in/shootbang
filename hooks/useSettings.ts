"use client";

import { useState, useCallback } from "react";
import {
  useSettingsStore,
  TARGET_COUNT_CONST,
} from "@/stores/gameStore";
import type { SensitivityMode, SensitivityValues } from "@/lib/sensitivity";

export function useSettings() {
  const sensitivityMode = useSettingsStore((s) => s.sensitivityMode);
  const sensitivities = useSettingsStore((s) => s.sensitivities);
  const gridSize = useSettingsStore((s) => s.gridSize);
  const duration = useSettingsStore((s) => s.duration);
  const targetSize = useSettingsStore((s) => s.targetSize);
  const gridPositions = useSettingsStore((s) => s.gridPositions);
  const setSensitivitySettings = useSettingsStore((s) => s.setSensitivitySettings);
  const setGridSize = useSettingsStore((s) => s.setGridSize);
  const setDuration = useSettingsStore((s) => s.setDuration);
  const setTargetSize = useSettingsStore((s) => s.setTargetSize);

  // 临时设置状态（设置面板编辑中）
  const [showSettings, setShowSettings] = useState(false);
  const [tempSensitivityMode, setTempSensitivityMode] = useState(sensitivityMode);
  const [tempSensitivities, setTempSensitivities] = useState<SensitivityValues>({
    ...sensitivities,
  });
  const [tempGridSize, setTempGridSize] = useState(gridSize);
  const [tempDuration, setTempDuration] = useState(duration);
  const [tempTargetSize, setTempTargetSize] = useState(targetSize);

  const openSettings = useCallback(() => {
    const s = useSettingsStore.getState();
    setTempSensitivityMode(s.sensitivityMode);
    setTempSensitivities({ ...s.sensitivities });
    setTempGridSize(s.gridSize);
    setTempDuration(s.duration);
    setTempTargetSize(s.targetSize);
    setShowSettings(true);
  }, []);

  const cancelSettings = useCallback(() => {
    setShowSettings(false);
  }, []);

  const setTempSensitivity = useCallback(
    (mode: SensitivityMode, value: number) => {
      setTempSensitivities((current) => ({ ...current, [mode]: value }));
    },
    [],
  );

  const saveSettings = useCallback(() => {
    setSensitivitySettings(tempSensitivityMode, tempSensitivities);
    setGridSize(tempGridSize);
    setDuration(tempDuration);
    setTargetSize(tempTargetSize);
    setShowSettings(false);
  }, [
    tempSensitivityMode,
    tempSensitivities,
    tempGridSize,
    tempDuration,
    tempTargetSize,
    setSensitivitySettings,
    setGridSize,
    setDuration,
    setTargetSize,
  ]);

  return {
    sensitivityMode,
    sensitivities,
    gridSize,
    targetCount: TARGET_COUNT_CONST,
    duration,
    targetSize,
    gridPositions,
    showSettings,
    tempSensitivityMode,
    tempSensitivities,
    tempGridSize,
    tempDuration,
    tempTargetSize,
    setTempSensitivity,
    setTempSensitivityMode,
    setTempGridSize,
    setTempDuration,
    setTempTargetSize,
    openSettings,
    cancelSettings,
    saveSettings,
  };
}
