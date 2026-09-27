import * as Sentry from "@sentry/nextjs";
import { initializeAnalytics } from "@/lib/analytics";

// SDK loading is asynchronous and must not hold up hydration or renderer startup.
try { initializeAnalytics(); } catch { /* Analytics is optional. */ }

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  enabled: process.env.NODE_ENV === "production" && Boolean(dsn),
  environment:
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
  sendDefaultPii: false,
  tracesSampleRate: 0,
  enableLogs: true,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
