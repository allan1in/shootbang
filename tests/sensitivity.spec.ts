import { expect, test } from "@playwright/test";
import {
  DEFAULT_SENSITIVITIES,
  getDegreesPerCount,
  getRadiansPerCount,
  getSensitivityRange,
  isValidSensitivityForMode,
  normalizeSensitivityForMode,
} from "../lib/sensitivity";

test.describe("灵敏度计算", () => {
  test("CS2 灵敏度 1 每个计数旋转 0.022 度", () => {
    expect(getDegreesPerCount("cs2")).toBe(0.022);
    expect(getRadiansPerCount("cs2", 1) * (180 / Math.PI)).toBeCloseTo(
      0.022,
      12,
    );
  });

  test("无畏契约灵敏度 1 每个计数旋转 0.07 度", () => {
    expect(getDegreesPerCount("valorant")).toBe(0.07);
    expect(getRadiansPerCount("valorant", 1) * (180 / Math.PI)).toBeCloseTo(
      0.07,
      12,
    );
  });

  test("无畏契约灵敏度 0.35 的 100 个计数旋转 2.45 度", () => {
    const degrees = getRadiansPerCount("valorant", 0.35) * 100 * (180 / Math.PI);
    expect(degrees).toBeCloseTo(2.45, 12);
  });

  test("三角洲行动灵敏度 3 使用 0.022 系数", () => {
    expect(getDegreesPerCount("delta")).toBe(0.022);
    expect(getRadiansPerCount("delta", 3) * (180 / Math.PI)).toBeCloseTo(
      0.066,
      12,
    );
  });

  test("三种模式采用各自游戏内的默认值和设置范围", () => {
    expect(DEFAULT_SENSITIVITIES).toEqual({
      cs2: 1.25,
      valorant: 1,
      delta: 3,
    });
    expect(getSensitivityRange("cs2")).toEqual({ min: 0.1, max: 8 });
    expect(getSensitivityRange("valorant")).toEqual({ min: 0.01, max: 10 });
    expect(getSensitivityRange("delta")).toEqual({ min: 0.1, max: 50 });

    expect(isValidSensitivityForMode("cs2", 0.1)).toBe(true);
    expect(isValidSensitivityForMode("cs2", 8)).toBe(true);
    expect(isValidSensitivityForMode("cs2", 0.099)).toBe(false);
    expect(isValidSensitivityForMode("cs2", 8.001)).toBe(false);
    expect(isValidSensitivityForMode("valorant", 0.01)).toBe(true);
    expect(isValidSensitivityForMode("valorant", 10)).toBe(true);
    expect(isValidSensitivityForMode("valorant", Number.NaN)).toBe(false);

    expect(normalizeSensitivityForMode("valorant", 0.3144)).toBe(0.314);
    expect(normalizeSensitivityForMode("valorant", 0.3145)).toBe(0.315);
    expect(normalizeSensitivityForMode("valorant", "0.314")).toBeNull();
    expect(normalizeSensitivityForMode("delta", 0.1)).toBe(0.1);
    expect(normalizeSensitivityForMode("delta", 50)).toBe(50);
    expect(normalizeSensitivityForMode("delta", 50.001)).toBeNull();
  });
});
