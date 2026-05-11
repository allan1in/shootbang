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
}

export function useSettings() {
  const [sensitivity, setSensitivity] = useLocalStorage(
    "shootbang-sensitivity",
    2.5,
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

  const gridPositions = useMemo(
    () => generateGridPositions(gridSize),
    [gridSize],
  );

  // 用于回调中读取最新值的 ref
  const sensitivityRef = useSyncRef(sensitivity);
  const gridPositionsRef = useSyncRef(gridPositions);
  const targetCountRef = useSyncRef(targetCount);
  const durationRef = useSyncRef(duration);

  // 临时设置状态（设置面板编辑中）
  const [showSettings, setShowSettings] = useState(false);
  const [tempSensitivity, setTempSensitivity] = useState(sensitivity);
  const [tempGridSize, setTempGridSize] = useState(gridSize);
  const [tempTargetCount, setTempTargetCount] = useState(targetCount);
  const [tempDuration, setTempDuration] = useState(duration);

  const openSettings = useCallback(() => {
    setTempSensitivity(sensitivity);
    setTempGridSize(gridSize);
    setTempTargetCount(targetCount);
    setTempDuration(duration);
    setShowSettings(true);
  }, [sensitivity, gridSize, targetCount, duration]);

  const cancelSettings = useCallback(() => {
    setShowSettings(false);
  }, []);

  const saveSettings = useCallback(
    (user: { id: number; email: string } | null) => {
      setSensitivity(tempSensitivity);
      setGridSize(tempGridSize);
      setTargetCount(tempTargetCount);
      setDuration(tempDuration);
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
          }),
        }).catch(() => {});
      }
    },
    [
      tempSensitivity,
      tempGridSize,
      tempTargetCount,
      tempDuration,
      setSensitivity,
      setGridSize,
      setTargetCount,
      setDuration,
    ],
  );

  const applySettingsFromServer = useCallback(
    (data: SettingsState) => {
      setSensitivity(data.sensitivity);
      setDuration(data.duration);
      setGridSize(data.gridSize);
      setTargetCount(data.targetCount);
    },
    [setSensitivity, setDuration, setGridSize, setTargetCount],
  );

  return {
    // 持久化设置值
    sensitivity,
    gridSize,
    targetCount,
    duration,
    // ref（用于回调中读取最新值）
    sensitivityRef,
    gridPositions,
    gridPositionsRef,
    targetCountRef,
    durationRef,
    // 设置面板状态
    showSettings,
    tempSensitivity,
    tempGridSize,
    tempTargetCount,
    tempDuration,
    setTempSensitivity,
    setTempGridSize,
    setTempTargetCount,
    setTempDuration,
    // 操作
    openSettings,
    cancelSettings,
    saveSettings,
    applySettingsFromServer,
  };
}
