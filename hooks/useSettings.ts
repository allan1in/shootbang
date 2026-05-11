"use client";

import { useState, useCallback, useMemo } from "react";
import { useSyncRef } from "@/hooks/useSyncRef";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { generateGridPositions } from "@/lib/grid";

export interface SettingsState {
  sensitivity: number;
  gridSize: number;
  targetCount: number;
  duration: number;
  crosshairSize: number;
  crosshairStyle: string;
  targetSize: string;
}

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
  const [targetCount, setTargetCount] = useLocalStorage(
    "shootbang-targetCount",
    3,
    (s) => parseInt(s, 10),
  );
  const [duration, setDuration] = useLocalStorage(
    "shootbang-duration",
    30,
    (s) => parseInt(s, 10),
  );
  const [crosshairSize, setCrosshairSize] = useLocalStorage(
    "shootbang-crosshairSize",
    24,
    (s) => parseInt(s, 10),
  );
  const [crosshairStyle, setCrosshairStyle] = useLocalStorage(
    "shootbang-crosshairStyle",
    "cross",
    (s) => s,
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

  // 用于回调中读取最新值的 ref
  const sensitivityRef = useSyncRef(sensitivity);
  const gridPositionsRef = useSyncRef(gridPositions);
  const targetCountRef = useSyncRef(targetCount);
  const durationRef = useSyncRef(duration);
  const crosshairSizeRef = useSyncRef(crosshairSize);
  const crosshairStyleRef = useSyncRef(crosshairStyle);
  const targetSizeRef = useSyncRef(targetSize);

  // 临时设置状态（设置面板编辑中）
  const [showSettings, setShowSettings] = useState(false);
  const [tempSensitivity, setTempSensitivity] = useState(sensitivity);
  const [tempGridSize, setTempGridSize] = useState(gridSize);
  const [tempTargetCount, setTempTargetCount] = useState(targetCount);
  const [tempDuration, setTempDuration] = useState(duration);
  const [tempCrosshairSize, setTempCrosshairSize] = useState(crosshairSize);
  const [tempCrosshairStyle, setTempCrosshairStyle] = useState(crosshairStyle);
  const [tempTargetSize, setTempTargetSize] = useState(targetSize);

  const openSettings = useCallback(() => {
    setTempSensitivity(sensitivity);
    setTempGridSize(gridSize);
    setTempTargetCount(targetCount);
    setTempDuration(duration);
    setTempCrosshairSize(crosshairSize);
    setTempCrosshairStyle(crosshairStyle);
    setTempTargetSize(targetSize);
    setShowSettings(true);
  }, [sensitivity, gridSize, targetCount, duration, crosshairSize, crosshairStyle, targetSize]);

  const cancelSettings = useCallback(() => {
    setShowSettings(false);
  }, []);

  const saveSettings = useCallback(
    (user: { id: number; email: string } | null) => {
      setSensitivity(tempSensitivity);
      setGridSize(tempGridSize);
      setTargetCount(tempTargetCount);
      setDuration(tempDuration);
      setCrosshairSize(tempCrosshairSize);
      setCrosshairStyle(tempCrosshairStyle);
      setTargetSize(tempTargetSize);
      setShowSettings(false);
      // 同步到后端（已登录时）
      if (user) {
        fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sensitivity: tempSensitivity,
            duration: tempDuration,
            gridSize: tempGridSize,
            targetCount: tempTargetCount,
            crosshairSize: tempCrosshairSize,
            crosshairStyle: tempCrosshairStyle,
            targetSize: tempTargetSize,
          }),
        }).catch(() => {});
      }
    },
    [
      tempSensitivity,
      tempGridSize,
      tempTargetCount,
      tempDuration,
      tempCrosshairSize,
      tempCrosshairStyle,
      tempTargetSize,
      setSensitivity,
      setGridSize,
      setTargetCount,
      setDuration,
      setCrosshairSize,
      setCrosshairStyle,
      setTargetSize,
    ],
  );

  const applySettingsFromServer = useCallback(
    (data: SettingsState) => {
      setSensitivity(data.sensitivity);
      setDuration(data.duration);
      setGridSize(data.gridSize);
      setTargetCount(data.targetCount);
      if (data.crosshairSize) setCrosshairSize(data.crosshairSize);
      if (data.crosshairStyle) setCrosshairStyle(data.crosshairStyle);
      if (data.targetSize) setTargetSize(data.targetSize);
    },
    [setSensitivity, setDuration, setGridSize, setTargetCount, setCrosshairSize, setCrosshairStyle, setTargetSize],
  );

  return {
    // 持久化设置值
    sensitivity,
    gridSize,
    targetCount,
    duration,
    crosshairSize,
    crosshairStyle,
    targetSize,
    // ref（用于回调中读取最新值）
    sensitivityRef,
    gridPositions,
    gridPositionsRef,
    targetCountRef,
    durationRef,
    crosshairSizeRef,
    crosshairStyleRef,
    targetSizeRef,
    // 设置面板状态
    showSettings,
    tempSensitivity,
    tempGridSize,
    tempTargetCount,
    tempDuration,
    tempCrosshairSize,
    tempCrosshairStyle,
    tempTargetSize,
    setTempSensitivity,
    setTempGridSize,
    setTempTargetCount,
    setTempDuration,
    setTempCrosshairSize,
    setTempCrosshairStyle,
    setTempTargetSize,
    // 操作
    openSettings,
    cancelSettings,
    saveSettings,
    applySettingsFromServer,
  };
}
