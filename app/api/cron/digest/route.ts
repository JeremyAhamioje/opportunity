import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sendDigestToAll } from "@/lib/email/send-digest";

/**
 * The scheduled trigger for the reminder digest.
 *
 * This is not a workflow-automation platform and does not depend on one — it is
 * one endpoint in this app that any scheduler can call: Vercel Cron, a systemd
 * timer, Windows Task Scheduler, `curl` in a loop.
 *
 *   curl -X POST http://localhost:3000/api/cron/digest \
 *        -H "Authorization: Bearer $CRON_SECRET"
 *
 * Authorization is a bearer token, not a session: no browser is involved. An
 * unauthenticated endpoint that sends mail is an open relay and a way to burn
 * someone's Resend quota, so a missing or wrong secret is refused — including
 * when `CRON_SECRET` is unset, which fails closed rather than open.
 *
 * Sending is idempotent per day (`lastDigestSentAt`), so a scheduler that
 * double-fires, or a retry after a network blip, cannot produce two digests.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  const denial = authorize(request);
  if (denial) return denial;

  try {
    const result = await sendDigestToAll();
    return NextResponse.json({
      ok: true,
      sent: result.sent,
      skipped: result.skipped,
      failed: result.failed,
      details: result.details,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Digest run failed." },
      { status: 500 },
    );
  }
}

/** Some schedulers can only issue GETs. Same guard, same work. */
export async function GET(request: Request): Promise<NextResponse> {
  return POST(request);
}

function authorize(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET is not set, so this endpoint is disabled." },
      { status: 503 },
    );
  }

  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!provided || !matches(provided, secret)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  return null;
}

/** Constant-time, and length-safe: timingSafeEqual throws on a length mismatch. */
function matches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
