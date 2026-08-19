import { expect, test } from "@playwright/test";
import {
  getDegreesPerCount,
  getRadiansPerCount,
  isValidSensitivity,
  normalizeSensitivity,
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

  test("只接受 0.01 到 10 的有限数值并保留三位小数", () => {
    expect(isValidSensitivity(0.01)).toBe(true);
    expect(isValidSensitivity(10)).toBe(true);
    expect(isValidSensitivity(0)).toBe(false);
    expect(isValidSensitivity(10.001)).toBe(false);
    expect(isValidSensitivity(Number.NaN)).toBe(false);
    expect(normalizeSensitivity(0.3144)).toBe(0.314);
    expect(normalizeSensitivity(0.3145)).toBe(0.315);
    expect(normalizeSensitivity("0.314")).toBeNull();
  });
});
