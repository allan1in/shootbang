export const FEEDBACK_ACTION = "feedback_submit";
export const MAX_FEEDBACK_LENGTH = 2_000;
export const MAX_TURNSTILE_TOKEN_LENGTH = 2_048;
export const MAX_FEEDBACK_PAGE_LENGTH = 200;

const TURNSTILE_TEST_SITE_KEYS = new Set([
  "1x00000000000000000000AA",
  "2x00000000000000000000AB",
  "1x00000000000000000000BB",
  "2x00000000000000000000BB",
  "3x00000000000000000000FF",
]);

export function isTurnstileTestSiteKey(value: string | undefined) {
  return value ? TURNSTILE_TEST_SITE_KEYS.has(value) : false;
}

export interface FeedbackRequest {
  content: string;
  turnstileToken: string;
  submissionId: string;
  page: string;
}

export type FeedbackErrorCode =
  | "invalid_input"
  | "verification_failed"
  | "service_unavailable"
  | "send_failed";

export type FeedbackResponse =
  | { ok: true }
  | { ok: false; code: FeedbackErrorCode };

export interface TurnstileVerification {
  success: boolean;
  action?: string;
  hostname?: string;
  errorCodes?: string[];
}

export interface FeedbackEmail {
  from: string;
  to: string;
  subject: string;
  text: string;
  idempotencyKey: string;
}

export interface FeedbackContext {
  allowedHostnames: ReadonlySet<string>;
  from: string;
  to: string;
  environment: string;
  release: string;
  userAgent: string;
  now: Date;
}

export interface FeedbackDependencies {
  verifyTurnstile: (token: string) => Promise<TurnstileVerification>;
  sendEmail: (email: FeedbackEmail) => Promise<void>;
}

export type FeedbackProvider = "turnstile" | "resend";

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

  const { content, turnstileToken, submissionId, page } = value;
  if (
    typeof content !== "string" ||
    typeof turnstileToken !== "string" ||
    typeof submissionId !== "string" ||
    typeof page !== "string"
  ) {
    return null;
  }

  const normalizedContent = content.trim();
  if (
    normalizedContent.length < 1 ||
    normalizedContent.length > MAX_FEEDBACK_LENGTH ||
    turnstileToken.length < 1 ||
    turnstileToken.length > MAX_TURNSTILE_TOKEN_LENGTH ||
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
    turnstileToken,
    submissionId,
    page,
  };
}

export function parseAllowedHostnames(value: string): Set<string> {
  return new Set(
    value
      .split(",")
      .map((hostname) => hostname.trim().toLowerCase())
      .filter(Boolean),
  );
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
  let verification: TurnstileVerification;
  try {
    verification = await dependencies.verifyTurnstile(
      request.turnstileToken,
    );
  } catch (error) {
    throw new FeedbackProviderError("turnstile", error);
  }

  const hostname = verification.hostname?.toLowerCase();
  if (
    !verification.success ||
    verification.action !== FEEDBACK_ACTION ||
    !hostname ||
    !context.allowedHostnames.has(hostname)
  ) {
    return { ok: false, code: "verification_failed" };
  }

  const email = createFeedbackEmail(request, context);
  try {
    await dependencies.sendEmail(email);
  } catch (error) {
    throw new FeedbackProviderError("resend", error);
  }

  return { ok: true };
}
