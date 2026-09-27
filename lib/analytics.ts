import type { PostHogConfig } from "posthog-js";

export interface TrainingProperties {
  duration: number;
  theme: string;
  sensitivity_mode: string;
  grid_size: number;
  target_size: string;
  crosshair_customized: boolean;
  sound_enabled: boolean;
}

interface RunProperties extends TrainingProperties {
  run_id: string;
  pointer_input_mode: string;
}

export interface AnalyticsEvents {
  $pageview: Record<string, never>;
  "mobile prompt shown": Record<string, never>;
  "desktop visit eligible": Record<string, never>;
  "renderer ready": { elapsed_ms: number };
  "renderer slow": { stage: string };
  "renderer failed": { stage: string };
  "training start requested": { source: string };
  "training start failed": { source: string; reason: "pointer_lock" };
  "training started": RunProperties;
  "training completed": RunProperties & {
    hits: number;
    total_shots: number;
    accuracy: number;
    average_reaction_ms: number;
  };
  "training abandoned": RunProperties & {
    reason: "home" | "restart";
    active_seconds: number;
  };
  "settings opened": Record<string, never>;
  "settings tab viewed": { tab: string };
  "settings saved": TrainingProperties & { changed_fields: string[] };
  "settings dismissed": Record<string, never>;
  "feedback opened": { source: string };
  "feedback submitted": { attempt_id: string };
  "feedback sent": { attempt_id: string; elapsed_ms: number };
  "feedback failed": { attempt_id: string; elapsed_ms: number; reason: string };
}

const trainingFields = ["duration", "theme", "sensitivity_mode", "grid_size", "target_size", "crosshair_customized", "sound_enabled"];
const runFields = [...trainingFields, "run_id", "pointer_input_mode"];
const eventFields: Record<keyof AnalyticsEvents, readonly string[]> = {
  $pageview: [],
  "mobile prompt shown": [],
  "desktop visit eligible": [],
  "renderer ready": ["elapsed_ms"],
  "renderer slow": ["stage"],
  "renderer failed": ["stage"],
  "training start requested": ["source"],
  "training start failed": ["source", "reason"],
  "training started": runFields,
  "training completed": [...runFields, "hits", "total_shots", "accuracy", "average_reaction_ms"],
  "training abandoned": [...runFields, "reason", "active_seconds"],
  "settings opened": [],
  "settings tab viewed": ["tab"],
  "settings saved": [...trainingFields, "changed_fields"],
  "settings dismissed": [],
  "feedback opened": ["source"],
  "feedback submitted": ["attempt_id"],
  "feedback sent": ["attempt_id", "elapsed_ms"],
  "feedback failed": ["attempt_id", "elapsed_ms", "reason"],
};

// Retain anonymous/session identity and basic device context, never arbitrary SDK properties.
const commonFields = [
  "distinct_id", "$device_id", "$session_id", "$window_id", "$is_identified", "$process_person_profile",
  "token", "$lib", "$lib_version", "$browser", "$browser_version", "$os", "$os_version",
  "$device_type", "$screen_height", "$screen_width", "$viewport_height", "$viewport_width",
  "$current_url", "$pathname", "$host", "environment", "release", "schema_version",
  "page_id", "referrer_host", "utm_source", "utm_medium", "utm_campaign",
];

export function sanitizeAnalyticsEvent<T extends { event: string; properties: Record<string, unknown> }>(event: T): T | null {
  if (!Object.hasOwn(eventFields, event.event)) return null;
  const allowed = [...commonFields, ...eventFields[event.event as keyof AnalyticsEvents]];
  const properties = Object.fromEntries(
    Object.entries(event.properties).filter(([key]) => allowed.includes(key)),
  );
  properties.$process_person_profile = false;
  properties.$geoip_disable = true;
  if (typeof properties.$current_url === "string") {
    try {
      const url = new URL(properties.$current_url);
      properties.$current_url = url.origin + url.pathname;
    } catch {
      delete properties.$current_url;
    }
  }
  const result: T & { $set?: unknown; $set_once?: unknown } = { ...event, properties };
  delete result.$set;
  delete result.$set_once;
  return result;
}

export const POSTHOG_CONFIG: Partial<PostHogConfig> = {
  persistence: "localStorage",
  person_profiles: "never",
  autocapture: false,
  capture_pageview: false,
  capture_pageleave: false,
  capture_dead_clicks: false,
  rageclick: false,
  capture_heatmaps: false,
  capture_performance: false,
  capture_exceptions: false,
  disable_session_recording: true,
  disable_surveys: true,
  disable_conversations: true,
  disable_product_tours: true,
  disableDeviceModel: true,
  save_campaign_params: false,
  save_referrer: false,
  advanced_disable_flags: true,
  disable_external_dependency_loading: true,
  before_send: (event) => event ? sanitizeAnalyticsEvent(event) : null,
};

type Envelope = { event: string; properties: Record<string, unknown>; timestamp: Date };
type Sink = (event: Envelope) => void;

// A bounded, in-memory queue preserves early funnel events while the SDK chunk loads.
export function createAnalyticsBuffer() {
  let sink: Sink | null = null;
  let stopped = false;
  const pending: Envelope[] = [];
  const onceKeys = new Set<string>();
  const deliver = (event: Envelope) => {
    try { sink?.(event); } catch { /* Analytics must not interrupt the game. */ }
  };
  return {
    capture(event: Envelope, onceKey?: string) {
      if (stopped || (onceKey && onceKeys.has(onceKey))) return;
      if (onceKey) onceKeys.add(onceKey);
      if (sink) deliver(event);
      else if (pending.length < 100) pending.push(event);
    },
    connect(nextSink: Sink) {
      if (stopped) return;
      sink = nextSink;
      pending.splice(0).forEach(deliver);
    },
    stop() { stopped = true; pending.length = 0; sink = null; },
  };
}

const buffer = createAnalyticsBuffer();
let initialized = false;
let pageProperties: Record<string, unknown> = {};

declare global {
  interface Window {
    __shootbang_analytics_test?: Envelope[];
  }
}

export function captureAnalytics<E extends keyof AnalyticsEvents>(event: E, properties: AnalyticsEvents[E], onceKey?: string) {
  if (typeof window === "undefined") return;
  buffer.capture({ event, properties: { ...pageProperties, ...properties }, timestamp: new Date() }, onceKey);
}

export function initializeAnalytics() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  const testEvents = process.env.NODE_ENV !== "production" ? window.__shootbang_analytics_test : undefined;
  if (!testEvents && (!token || !host)) { buffer.stop(); return; }

  pageProperties = {
    schema_version: 1,
    page_id: crypto.randomUUID(),
    environment: process.env.NEXT_PUBLIC_APP_ENVIRONMENT ?? "development",
    release: process.env.NEXT_PUBLIC_APP_RELEASE ?? "local",
    $current_url: location.origin + location.pathname,
    $pathname: location.pathname,
    $host: location.hostname,
  };
  try { pageProperties.referrer_host = new URL(document.referrer).hostname; } catch { /* Direct visit. */ }
  const params = new URLSearchParams(location.search);
  for (const key of ["utm_source", "utm_medium", "utm_campaign"]) {
    const value = params.get(key);
    if (value && /^[a-zA-Z0-9_-]{1,80}$/.test(value)) pageProperties[key] = value;
  }
  captureAnalytics("$pageview", {}, "pageview");
  if (testEvents) { buffer.connect((event) => { testEvents.push(event); }); return; }

  void import("posthog-js").then(({ default: posthog }) => {
    posthog.init(token!, {
      ...POSTHOG_CONFIG,
      api_host: host!,
      loaded: (client) => {
        buffer.connect(({ event, properties, timestamp }) => {
          client.capture(event, properties, { timestamp, _batchKey: "product-analytics" });
        });
      },
    });
  }).catch(() => buffer.stop());
}
