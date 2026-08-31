export const MAX_FEEDBACK_LENGTH = 2_000;
export const MAX_FEEDBACK_PAGE_LENGTH = 200;

export interface FeedbackRequest {
  content: string;
  submissionId: string;
  page: string;
}

export type FeedbackErrorCode =
  | "invalid_input"
  | "rate_limited"
  | "service_unavailable"
  | "send_failed";

export type FeedbackResponse =
  | { ok: true }
  | { ok: false; code: FeedbackErrorCode };

export interface FeedbackEmail {
  from: string;
  to: string;
  subject: string;
  text: string;
  idempotencyKey: string;
}

export interface FeedbackContext {
  from: string;
  to: string;
  environment: string;
  release: string;
  userAgent: string;
  now: Date;
}

export interface FeedbackDependencies {
  sendEmail: (email: FeedbackEmail) => Promise<void>;
}

export type FeedbackProvider = "resend";

export class FeedbackProviderError extends Error {
  readonly provider: FeedbackProvider;

  constructor(provider: FeedbackProvider, cause: unknown) {
    super(`${provider} provider failed`, { cause });
    this.name = "FeedbackProviderError";
    this.provider = provider;
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseFeedbackRequest(value: unknown): FeedbackRequest | null {
  if (!isRecord(value)) return null;

  const { content, submissionId, page } = value;
  if (
    typeof content !== "string" ||
    typeof submissionId !== "string" ||
    typeof page !== "string"
  ) {
    return null;
  }

  const normalizedContent = content.trim();
  if (
    normalizedContent.length < 1 ||
    normalizedContent.length > MAX_FEEDBACK_LENGTH ||
    !UUID_PATTERN.test(submissionId) ||
    page.length < 1 ||
    page.length > MAX_FEEDBACK_PAGE_LENGTH ||
    !page.startsWith("/") ||
    /[\r\n]/.test(page)
  ) {
    return null;
  }

  return {
    content: normalizedContent,
    submissionId,
    page,
  };
}

function safeDiagnosticValue(value: string, maxLength: number) {
  const normalized = value.replace(/[\r\n]+/g, " ").trim();
  return normalized.slice(0, maxLength) || "unknown";
}

export function createFeedbackEmail(
  request: FeedbackRequest,
  context: FeedbackContext,
): FeedbackEmail {
  const environment = safeDiagnosticValue(context.environment, 50);
  const release = safeDiagnosticValue(context.release, 200);
  const userAgent = safeDiagnosticValue(context.userAgent, 500);

  return {
    from: context.from,
    to: context.to,
    subject: `Shootbang User Feedback [${environment}]`,
    idempotencyKey: `feedback/${request.submissionId}`,
    text: [
      request.content,
      "",
      "----------------------------------------",
      `Submitted at: ${context.now.toISOString()}`,
      `Page: ${request.page}`,
      `Browser: ${userAgent}`,
      `Release: ${release}`,
      `Environment: ${environment}`,
    ].join("\n"),
  };
}

export async function processFeedback(
  request: FeedbackRequest,
  context: FeedbackContext,
  dependencies: FeedbackDependencies,
): Promise<FeedbackResponse> {
  const email = createFeedbackEmail(request, context);
  try {
    await dependencies.sendEmail(email);
  } catch (error) {
    throw new FeedbackProviderError("resend", error);
  }

  return { ok: true };
}
