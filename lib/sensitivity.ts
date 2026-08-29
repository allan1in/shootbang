export type SensitivityMode = "cs2" | "valorant" | "delta";

export interface SensitivityValues {
  cs2: number;
  valorant: number;
  delta: number;
}

export const DEFAULT_SENSITIVITIES: SensitivityValues = {
  cs2: 1.25,
  valorant: 1,
  delta: 3,
};

export const SENSITIVITY_RANGES = {
  cs2: { min: 0.1, max: 8 },
  valorant: { min: 0.01, max: 10 },
  delta: { min: 0.1, max: 50 },
} as const satisfies Record<
  SensitivityMode,
  { min: number; max: number }
>;

export const DEGREES_PER_COUNT = {
  cs2: 0.022,
  valorant: 0.07,
  delta: 0.022,
} as const satisfies Record<SensitivityMode, number>;

export function isSensitivityMode(value: unknown): value is SensitivityMode {
  return value === "cs2" || value === "valorant" || value === "delta";
}

export function getSensitivityRange(mode: SensitivityMode) {
  return SENSITIVITY_RANGES[mode];
}

export function isValidSensitivityForMode(
  mode: SensitivityMode,
  value: unknown,
): value is number {
  const { min, max } = getSensitivityRange(mode);
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
  );
}

export function normalizeSensitivityForMode(
  mode: SensitivityMode,
  value: unknown,
): number | null {
  if (!isValidSensitivityForMode(mode, value)) return null;
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
