import { expect, test } from "@playwright/test";
import {
  createBlizzardGustTimeline,
  getBlizzardGustProgress,
} from "../lib/blizzardTimeline";

test.describe("暴雪阵风时间轴", () => {
  test("音频与视觉共享完整的渐强、峰值和渐弱时长", () => {
    const timeline = createBlizzardGustTimeline(() => 0.5);

    expect(timeline).toEqual({
      attackDuration: 2.5,
      peakDuration: 2,
      releaseDuration: 2,
      totalDuration: 6.5,
    });
  });

  test("强度从零平滑增强、保持峰值并在结束时归零", () => {
    const timeline = createBlizzardGustTimeline(() => 0.5);

    expect(getBlizzardGustProgress(0, timeline)).toBe(0);
    expect(getBlizzardGustProgress(1.25, timeline)).toBeCloseTo(0.5, 10);
    expect(getBlizzardGustProgress(2.5, timeline)).toBe(1);
    expect(getBlizzardGustProgress(4.5, timeline)).toBe(1);
    expect(getBlizzardGustProgress(5.5, timeline)).toBeCloseTo(0.5, 10);
    expect(getBlizzardGustProgress(6.5, timeline)).toBe(0);
  });

  test("峰值随机变化时总时长始终使用同一时间轴", () => {
    expect(createBlizzardGustTimeline(() => 0).totalDuration).toBe(5.5);
    expect(createBlizzardGustTimeline(() => 1).totalDuration).toBe(7.5);
  });
});
