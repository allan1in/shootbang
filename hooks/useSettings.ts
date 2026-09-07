"use client";

import { useState, useCallback } from "react";
import {
  useSettingsStore,
  TARGET_COUNT_CONST,
} from "@/stores/gameStore";
import type { SensitivityMode, SensitivityValues } from "@/lib/sensitivity";
import type { CrosshairSettings } from "@/lib/crosshair";

export function useSettings() {
  const sensitivityMode = useSettingsStore((s) => s.sensitivityMode);
  const sensitivities = useSettingsStore((s) => s.sensitivities);
  const gridSize = useSettingsStore((s) => s.gridSize);
  const duration = useSettingsStore((s) => s.duration);
  const targetSize = useSettingsStore((s) => s.targetSize);
  const gridPositions = useSettingsStore((s) => s.gridPositions);
  const crosshair = useSettingsStore((s) => s.crosshair);
  const setSensitivitySettings = useSettingsStore((s) => s.setSensitivitySettings);
  const setGridSize = useSettingsStore((s) => s.setGridSize);
  const setDuration = useSettingsStore((s) => s.setDuration);
  const setTargetSize = useSettingsStore((s) => s.setTargetSize);
  const setCrosshair = useSettingsStore((s) => s.setCrosshair);

  // 临时设置状态（设置面板编辑中）
  const [showSettings, setShowSettings] = useState(false);
  const [tempSensitivityMode, setTempSensitivityMode] = useState(sensitivityMode);
  const [tempSensitivities, setTempSensitivities] = useState<SensitivityValues>({
    ...sensitivities,
  });
  const [tempGridSize, setTempGridSize] = useState(gridSize);
  const [tempDuration, setTempDuration] = useState(duration);
  const [tempTargetSize, setTempTargetSize] = useState(targetSize);
  const [tempCrosshair, setTempCrosshair] = useState<CrosshairSettings>({
    ...crosshair,
  });

  const openSettings = useCallback(() => {
    const s = useSettingsStore.getState();
    setTempSensitivityMode(s.sensitivityMode);
    setTempSensitivities({ ...s.sensitivities });
    setTempGridSize(s.gridSize);
    setTempDuration(s.duration);
    setTempTargetSize(s.targetSize);
    setTempCrosshair({ ...s.crosshair });
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
    setCrosshair(tempCrosshair);
    setShowSettings(false);
  }, [
    tempSensitivityMode,
    tempSensitivities,
    tempGridSize,
    tempDuration,
    tempTargetSize,
    tempCrosshair,
    setSensitivitySettings,
    setGridSize,
    setDuration,
    setTargetSize,
    setCrosshair,
  ]);

  return {
    sensitivityMode,
    sensitivities,
    gridSize,
    targetCount: TARGET_COUNT_CONST,
    duration,
    targetSize,
    gridPositions,
    crosshair,
    showSettings,
    tempSensitivityMode,
    tempSensitivities,
    tempGridSize,
    tempDuration,
    tempTargetSize,
    tempCrosshair,
    setTempSensitivity,
    setTempSensitivityMode,
    setTempGridSize,
    setTempDuration,
    setTempTargetSize,
    setTempCrosshair,
    openSettings,
    cancelSettings,
    saveSettings,
  };
}
