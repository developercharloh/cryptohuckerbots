import { logger } from "./logger";

const RESEND_EMAILS_URL = "https://api.resend.com/emails";
const EMAIL_TIMEOUT_MS = 10_000;

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

function getEmailBaseUrl(): string {
  const raw = (
    process.env.AUTH_EMAIL_BASE_URL ??
    process.env.PASSWORD_RESET_BASE_URL ??
    "https://vixus.trade"
  ).trim().replace(/\/+$/, "");

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("AUTH_EMAIL_BASE_URL is not a valid URL");
  }

  if (
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.pathname !== "/" ||
    (process.env.NODE_ENV === "production" && parsed.protocol !== "https:")
  ) {
    throw new Error("AUTH_EMAIL_BASE_URL must be a clean HTTPS origin in production");
  }

  return parsed.origin;
}

export function getAuthEmailBaseUrl(): string {
  return getEmailBaseUrl();
}

export async function sendTransactionalEmail(input: SendEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();

  // Tests must never send real messages. Production intentionally fails
  // explicitly when the provider is not configured.
  if (process.env.NODE_ENV === "test" && !apiKey) return;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const from = (
    process.env.AUTH_EMAIL_FROM ??
    "VIXUS AI <no-reply@vixus.trade>"
  ).trim();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EMAIL_TIMEOUT_MS);

  try {
    const response = await fetch(RESEND_EMAILS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      logger.error({ status: response.status }, "Transactional email provider rejected message");
      throw new Error(`Transactional email provider returned ${response.status}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}