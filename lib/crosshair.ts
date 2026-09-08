export interface CrosshairSettings {
  color: string;
  length: number;
  thickness: number;
  gap: number;
  opacity: number;
  centerDot: boolean;
  outline: boolean;
}

export const CROSSHAIR_LIMITS = {
  length: { min: 0, max: 20, step: 0.5 },
  thickness: { min: 0, max: 6, step: 0.5 },
  gap: { min: 0, max: 12, step: 0.5 },
  opacity: { min: 0, max: 100, step: 5 },
} as const;

export const DEFAULT_CROSSHAIR_SETTINGS: CrosshairSettings = {
  color: "#ffffff",
  length: 8,
  thickness: 2,
  gap: 0,
  opacity: 100,
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
  limits: {
    readonly min: number;
    readonly max: number;
    readonly step: number;
  },
  fallback: number,
) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const clamped = Math.min(limits.max, Math.max(limits.min, value));
  return Math.round(clamped / limits.step) * limits.step;
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
    opacity: normalizeNumber(
      settings?.opacity,
      CROSSHAIR_LIMITS.opacity,
      DEFAULT_CROSSHAIR_SETTINGS.opacity,
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
