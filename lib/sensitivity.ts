export type SensitivityMode = "cs2" | "valorant";

export interface SensitivityValues {
  cs2: number;
  valorant: number;
}

export const DEFAULT_SENSITIVITY = 1;
export const MIN_SENSITIVITY = 0.01;
export const MAX_SENSITIVITY = 10;

export const DEGREES_PER_COUNT = {
  cs2: 0.022,
  valorant: 0.07,
} as const satisfies Record<SensitivityMode, number>;

export function isSensitivityMode(value: unknown): value is SensitivityMode {
  return value === "cs2" || value === "valorant";
}

export function isValidSensitivity(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= MIN_SENSITIVITY &&
    value <= MAX_SENSITIVITY
  );
}

export function normalizeSensitivity(value: unknown): number | null {
  if (!isValidSensitivity(value)) return null;
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

export function getDegreesPerCount(mode: SensitivityMode): number {
  return DEGREES_PER_COUNT[mode];
}

export function getRadiansPerCount(
  mode: SensitivityMode,
  sensitivity: number,
): number {
  return sensitivity * getDegreesPerCount(mode) * (Math.PI / 180);
}
