import * as Sentry from "@sentry/nextjs";
import { Resend } from "resend";
import {
  FeedbackProviderError,
  parseFeedbackRequest,
  processFeedback,
  type FeedbackErrorCode,
  type FeedbackResponse,
} from "@/lib/feedback";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 16 * 1_024;

interface FeedbackConfig {
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
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    FEEDBACK_FROM_EMAIL: process.env.FEEDBACK_FROM_EMAIL,
    FEEDBACK_TO_EMAIL: process.env.FEEDBACK_TO_EMAIL,
  };
  const missing = Object.entries(values)
    .filter(([, value]) => !value?.trim())
    .map(([name]) => name);
  if (missing.length > 0) return { ok: false, missing };

  return {
    ok: true,
    config: {
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

function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return errorResponse("invalid_input", 403);
  }

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
        from: config.from,
        to: config.to,
        environment: config.environment,
        release: config.release,
        userAgent: request.headers.get("user-agent") ?? "unknown",
        now: new Date(),
      },
      {
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

    return jsonResponse(result, 200);
  } catch (error) {
    captureSafeError(error);
    return error instanceof FeedbackProviderError &&
      error.provider === "resend"
      ? errorResponse("send_failed", 502)
      : errorResponse("service_unavailable", 503);
  }
}
