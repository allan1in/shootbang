export interface CrosshairSettings {
  color: string;
  length: number;
  thickness: number;
  gap: number;
  centerDot: boolean;
  outline: boolean;
}

export const CROSSHAIR_LIMITS = {
  length: { min: 0, max: 20 },
  thickness: { min: 0, max: 6 },
  gap: { min: 0, max: 12 },
} as const;

const CROSSHAIR_STEP = 0.5;

export const DEFAULT_CROSSHAIR_SETTINGS: CrosshairSettings = {
  color: "#ffffff",
  length: 8,
  thickness: 2,
  gap: 0,
  centerDot: false,
  outline: false,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeNumber(
  value: unknown,
  limits: { readonly min: number; readonly max: number },
  fallback: number,
) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const clamped = Math.min(limits.max, Math.max(limits.min, value));
  return Math.round(clamped / CROSSHAIR_STEP) * CROSSHAIR_STEP;
}

export function normalizeCrosshairSettings(value: unknown): CrosshairSettings {
  const settings = asRecord(value);
  const color =
    typeof settings?.color === "string" &&
    /^#[0-9a-f]{6}$/i.test(settings.color)
      ? settings.color.toLowerCase()
      : DEFAULT_CROSSHAIR_SETTINGS.color;

  return {
    color,
    length: normalizeNumber(
      settings?.length,
      CROSSHAIR_LIMITS.length,
      DEFAULT_CROSSHAIR_SETTINGS.length,
    ),
    thickness: normalizeNumber(
      settings?.thickness,
      CROSSHAIR_LIMITS.thickness,
      DEFAULT_CROSSHAIR_SETTINGS.thickness,
    ),
    gap: normalizeNumber(
      settings?.gap,
      CROSSHAIR_LIMITS.gap,
      DEFAULT_CROSSHAIR_SETTINGS.gap,
    ),
    centerDot:
      typeof settings?.centerDot === "boolean"
        ? settings.centerDot
        : DEFAULT_CROSSHAIR_SETTINGS.centerDot,
    outline:
      typeof settings?.outline === "boolean"
        ? settings.outline
        : DEFAULT_CROSSHAIR_SETTINGS.outline,
  };
}
