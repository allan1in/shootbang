import * as Sentry from "@sentry/nextjs";
import { Resend } from "resend";
import {
  FeedbackProviderError,
  parseAllowedHostnames,
  parseFeedbackRequest,
  processFeedback,
  type FeedbackErrorCode,
  type FeedbackResponse,
  type TurnstileVerification,
} from "@/lib/feedback";

export const runtime = "nodejs";

const TURNSTILE_SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const MAX_REQUEST_BYTES = 16 * 1_024;
const PROVIDER_TIMEOUT_MS = 5_000;
const TURNSTILE_TEST_SECRET_KEYS = new Set([
  "1x0000000000000000000000000000000AA",
  "2x0000000000000000000000000000000AA",
  "3x0000000000000000000000000000000AA",
]);

interface FeedbackConfig {
  turnstileSecretKey: string;
  allowedHostnames: Set<string>;
  resendApiKey: string;
  from: string;
  to: string;
  environment: string;
  release: string;
}

function jsonResponse(result: FeedbackResponse, status: number) {
  return Response.json(result, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function errorResponse(code: FeedbackErrorCode, status: number) {
  return jsonResponse({ ok: false, code }, status);
}

function readConfig():
  | { ok: true; config: FeedbackConfig }
  | { ok: false; missing: string[] } {
  const values = {
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
    FEEDBACK_ALLOWED_HOSTNAMES: process.env.FEEDBACK_ALLOWED_HOSTNAMES,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    FEEDBACK_FROM_EMAIL: process.env.FEEDBACK_FROM_EMAIL,
    FEEDBACK_TO_EMAIL: process.env.FEEDBACK_TO_EMAIL,
  };
  const missing = Object.entries(values)
    .filter(([, value]) => !value?.trim())
    .map(([name]) => name);
  if (missing.length > 0) return { ok: false, missing };

  const allowedHostnames = parseAllowedHostnames(
    values.FEEDBACK_ALLOWED_HOSTNAMES!,
  );
  if (allowedHostnames.size === 0) {
    return { ok: false, missing: ["FEEDBACK_ALLOWED_HOSTNAMES"] };
  }
  if (
    process.env.NODE_ENV === "production" &&
    TURNSTILE_TEST_SECRET_KEYS.has(values.TURNSTILE_SECRET_KEY!)
  ) {
    return { ok: false, missing: ["TURNSTILE_SECRET_KEY (test key)"] };
  }

  return {
    ok: true,
    config: {
      turnstileSecretKey: values.TURNSTILE_SECRET_KEY!,
      allowedHostnames,
      resendApiKey: values.RESEND_API_KEY!,
      from: values.FEEDBACK_FROM_EMAIL!,
      to: values.FEEDBACK_TO_EMAIL!,
      environment:
        process.env.SENTRY_ENVIRONMENT ??
        process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ??
        process.env.VERCEL_ENV ??
        process.env.NODE_ENV ??
        "unknown",
      release:
        process.env.SENTRY_RELEASE ??
        process.env.NEXT_PUBLIC_SENTRY_RELEASE ??
        process.env.VERCEL_GIT_COMMIT_SHA ??
        "unknown",
    },
  };
}

async function verifyTurnstile(
  token: string,
  secretKey: string,
): Promise<TurnstileVerification> {
  const body = new URLSearchParams({ secret: secretKey, response: token });
  const response = await fetch(TURNSTILE_SITEVERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Turnstile Siteverify returned ${response.status}`);
  }

  const result = (await response.json()) as {
    success?: boolean;
    action?: string;
    hostname?: string;
    "error-codes"?: string[];
  };
  return {
    success: result.success === true,
    action: result.action,
    hostname: result.hostname,
    errorCodes: result["error-codes"],
  };
}

function captureSafeError(error: unknown, details?: Record<string, unknown>) {
  Sentry.captureException(error, {
    tags: {
      component: "feedback-api",
      provider:
        error instanceof FeedbackProviderError
          ? error.provider
          : "configuration",
    },
    extra: details,
  });
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (
    !contentType.toLowerCase().includes("application/json") ||
    (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES)
  ) {
    return errorResponse("invalid_input", 400);
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
      return errorResponse("invalid_input", 400);
    }
    body = JSON.parse(rawBody) as unknown;
  } catch {
    return errorResponse("invalid_input", 400);
  }

  const feedbackRequest = parseFeedbackRequest(body);
  if (!feedbackRequest) return errorResponse("invalid_input", 400);

  const configResult = readConfig();
  if (!configResult.ok) {
    captureSafeError(new Error("Feedback service configuration is incomplete"), {
      missing: configResult.missing,
    });
    return errorResponse("service_unavailable", 503);
  }

  const { config } = configResult;
  try {
    const result = await processFeedback(
      feedbackRequest,
      {
        allowedHostnames: config.allowedHostnames,
        from: config.from,
        to: config.to,
        environment: config.environment,
        release: config.release,
        userAgent: request.headers.get("user-agent") ?? "unknown",
        now: new Date(),
      },
      {
        verifyTurnstile: (token) =>
          verifyTurnstile(token, config.turnstileSecretKey),
        sendEmail: async (email) => {
          const resend = new Resend(config.resendApiKey);
          const { error } = await resend.emails.send(
            {
              from: email.from,
              to: email.to,
              subject: email.subject,
              text: email.text,
            },
            { idempotencyKey: email.idempotencyKey },
          );
          if (error) throw error;
        },
      },
    );

    return result.ok
      ? jsonResponse(result, 200)
      : errorResponse("verification_failed", 403);
  } catch (error) {
    captureSafeError(error);
    return error instanceof FeedbackProviderError &&
      error.provider === "resend"
      ? errorResponse("send_failed", 502)
      : errorResponse("service_unavailable", 503);
  }
}
