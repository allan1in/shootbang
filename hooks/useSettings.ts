"use client";

import { useState, useCallback, useMemo } from "react";
import { useSyncRef } from "@/hooks/useSyncRef";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { generateGridPositions } from "@/lib/grid";

const TARGET_COUNT = 3;

export function useSettings() {
  const [sensitivity, setSensitivity] = useLocalStorage(
    "shootbang-sensitivity",
    1.0,
    parseFloat,
  );
  const [gridSize, setGridSize] = useLocalStorage(
    "shootbang-gridSize",
    3,
    (s) => parseInt(s, 10),
  );
  const [duration, setDuration] = useLocalStorage(
    "shootbang-duration",
    30,
    (s) => parseInt(s, 10),
  );
  const [targetSize, setTargetSize] = useLocalStorage(
    "shootbang-targetSize",
    "default",
    (s) => s,
  );

  const gridPositions = useMemo(
    () => generateGridPositions(gridSize),
    [gridSize],
  );

  const sensitivityRef = useSyncRef(sensitivity);
  const gridPositionsRef = useSyncRef(gridPositions);
  const targetCountRef = useSyncRef(TARGET_COUNT);
  const durationRef = useSyncRef(duration);
  const targetSizeRef = useSyncRef(targetSize);

  // 临时设置状态（设置面板编辑中）
  const [showSettings, setShowSettings] = useState(false);
  const [tempSensitivity, setTempSensitivity] = useState(sensitivity);
  const [tempGridSize, setTempGridSize] = useState(gridSize);
  const [tempDuration, setTempDuration] = useState(duration);
  const [tempTargetSize, setTempTargetSize] = useState(targetSize);

  const openSettings = useCallback(() => {
    setTempSensitivity(sensitivity);
    setTempGridSize(gridSize);
    setTempDuration(duration);
    setTempTargetSize(targetSize);
    setShowSettings(true);
  }, [sensitivity, gridSize, duration, targetSize]);

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
    targetCount: TARGET_COUNT,
    duration,
    targetSize,
    sensitivityRef,
    gridPositions,
    gridPositionsRef,
    targetCountRef,
    durationRef,
    targetSizeRef,
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
