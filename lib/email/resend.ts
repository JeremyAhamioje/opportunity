/**
 * Resend, over raw fetch — same choice as the Gemini client: one request shape,
 * no dependency, and the key stays a one-line env change.
 *
 * Email is strictly additive. Every reminder in this app is computed from stored
 * rows and shown in the UI whether or not a key is set; this only carries the
 * same information out of the building. `isEmailConfigured()` gates the feature
 * so nothing breaks when the key is absent.
 */

const ENDPOINT = "https://api.resend.com/emails";
const TIMEOUT_MS = 15_000;

/**
 * Resend's shared sender. It works with no domain verification at all, but it
 * can only deliver to the Resend account owner's own address — anything else
 * comes back 403. That is the single most confusing failure in this
 * integration, so `sendEmail` translates it rather than passing it through.
 */
const SHARED_SENDER = "onboarding@resend.dev";
const DEFAULT_FROM = `Opportunity <${SHARED_SENDER}>`;

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export function emailFrom(): string {
  return process.env.EMAIL_FROM?.trim() || DEFAULT_FROM;
}

/** True while still on the shared sender, which restricts who can be emailed. */
export function usingSharedSender(): boolean {
  return emailFrom().includes(SHARED_SENDER);
}

export type SendResult = { ok: true; id: string } | { ok: false; error: string };

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return { ok: false, error: "RESEND_API_KEY is not set." };

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        from: emailFrom(),
        to: [input.to],
        subject: input.subject,
        html: input.html,
        // Always paired. A text part is what keeps the mail out of spam filters
        // and readable in clients that refuse HTML.
        text: input.text,
      }),
    });
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error && error.name === "TimeoutError"
          ? "Resend did not respond within 15s."
          : "Could not reach Resend.",
    };
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return { ok: false, error: explain(response.status, detail, input.to) };
  }

  const payload = (await response.json().catch(() => ({}))) as { id?: string };
  return { ok: true, id: payload.id ?? "sent" };
}

/** Resend's errors are terse; the common ones deserve the actual fix. */
function explain(status: number, body: string, to: string): string {
  const message = extract(body);

  if (status === 403 && usingSharedSender()) {
    return (
      `Resend refused to send to ${to}. The shared sender (${SHARED_SENDER}) can only ` +
      `deliver to the address that owns the Resend account. Verify a domain in the ` +
      `Resend dashboard and set EMAIL_FROM to an address on it.`
    );
  }
  if (status === 401 || status === 403) {
    return `Resend rejected the API key (${status}). ${message}`.trim();
  }
  if (status === 422) {
    return `Resend rejected the message (422). ${message}`.trim();
  }
  if (status === 429) {
    return "Resend rate limit reached. Try again shortly.";
  }
  return `Resend returned ${status}. ${message}`.trim();
}

function extract(body: string): string {
  try {
    const parsed = JSON.parse(body) as { message?: string; error?: string };
    const message = parsed.message ?? parsed.error;
    if (message) return message.length > 240 ? `${message.slice(0, 237)}…` : message;
  } catch {
    /* not JSON — fall through */
  }
  return body.slice(0, 200);
}
