"use client";

import { useState, useCallback } from "react";
import {
  useSettingsStore,
  TARGET_COUNT_CONST,
} from "@/stores/gameStore";

export function useSettings() {
  const sensitivity = useSettingsStore((s) => s.sensitivity);
  const gridSize = useSettingsStore((s) => s.gridSize);
  const duration = useSettingsStore((s) => s.duration);
  const targetSize = useSettingsStore((s) => s.targetSize);
  const gridPositions = useSettingsStore((s) => s.gridPositions);
  const setSensitivity = useSettingsStore((s) => s.setSensitivity);
  const setGridSize = useSettingsStore((s) => s.setGridSize);
  const setDuration = useSettingsStore((s) => s.setDuration);
  const setTargetSize = useSettingsStore((s) => s.setTargetSize);

  // 临时设置状态（设置面板编辑中）
  const [showSettings, setShowSettings] = useState(false);
  const [tempSensitivity, setTempSensitivity] = useState(sensitivity);
  const [tempGridSize, setTempGridSize] = useState(gridSize);
  const [tempDuration, setTempDuration] = useState(duration);
  const [tempTargetSize, setTempTargetSize] = useState(targetSize);

  const openSettings = useCallback(() => {
    const s = useSettingsStore.getState();
    setTempSensitivity(s.sensitivity);
    setTempGridSize(s.gridSize);
    setTempDuration(s.duration);
    setTempTargetSize(s.targetSize);
    setShowSettings(true);
  }, []);

  const cancelSettings = useCallback(() => {
    setShowSettings(false);
  }, []);

  const saveSettings = useCallback(() => {
    setSensitivity(tempSensitivity);
    setGridSize(tempGridSize);
    setDuration(tempDuration);
    setTargetSize(tempTargetSize);
    setShowSettings(false);
  }, [
    tempSensitivity,
    tempGridSize,
    tempDuration,
    tempTargetSize,
    setSensitivity,
    setGridSize,
    setDuration,
    setTargetSize,
  ]);

  return {
    sensitivity,
    gridSize,
    targetCount: TARGET_COUNT_CONST,
    duration,
    targetSize,
    gridPositions,
    showSettings,
    tempSensitivity,
    tempGridSize,
    tempDuration,
    tempTargetSize,
    setTempSensitivity,
    setTempGridSize,
    setTempDuration,
    setTempTargetSize,
    openSettings,
    cancelSettings,
    saveSettings,
  };
}
