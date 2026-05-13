"use client";

import { useState, useEffect } from "react";

/**
 * 通用 localStorage 持久化 hook
 * 读取时带 try/catch，写入时自动同步
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  parse: (raw: string) => T,
): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) return parse(saved);
    } catch {
      console.warn(`[useLocalStorage] 读取 "${key}" 失败`);
    }
    return defaultValue;
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, String(value));
    } catch {
      console.warn(`[useLocalStorage] 写入 "${key}" 失败`);
    }
  }, [key, value]);

  return [value, setValue];
}
