export interface BlizzardGustTimeline {
  attackDuration: number;
  peakDuration: number;
  releaseDuration: number;
  totalDuration: number;
}

const ATTACK_DURATION = 2.5;
const RELEASE_DURATION = 2.0;
const MIN_PEAK_DURATION = 1.0;
const PEAK_DURATION_RANGE = 2.0;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(value: number) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

export function createBlizzardGustTimeline(
  random: () => number = Math.random,
): BlizzardGustTimeline {
  const peakDuration =
    MIN_PEAK_DURATION + clamp01(random()) * PEAK_DURATION_RANGE;

  return {
    attackDuration: ATTACK_DURATION,
    peakDuration,
    releaseDuration: RELEASE_DURATION,
    totalDuration: ATTACK_DURATION + peakDuration + RELEASE_DURATION,
  };
}

export function getBlizzardGustProgress(
  elapsed: number,
  timeline: BlizzardGustTimeline,
) {
  if (elapsed <= 0 || elapsed >= timeline.totalDuration) return 0;

  if (elapsed < timeline.attackDuration) {
    return smoothstep(elapsed / timeline.attackDuration);
  }

  const releaseStart = timeline.attackDuration + timeline.peakDuration;
  if (elapsed < releaseStart) return 1;

  return smoothstep(
    (timeline.totalDuration - elapsed) / timeline.releaseDuration,
  );
}
