import { NextResponse } from "next/server";
import { isNotNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { IngestError, normalizeConversation } from "@/lib/ingest/normalize";
import { storeConversation } from "@/lib/ingest/pipeline";

/**
 * Where the browser extension delivers a conversation.
 *
 * Authentication is a device token, not the session cookie: the extension posts
 * from the AI platform's own origin, so relying on cookies would mean opening
 * this route to cross-origin credentialed requests — and any page you happened
 * to be visiting could then write to your corpus. A bearer token is sent
 * deliberately or not at all.
 *
 * This route stores and returns. Extraction is a separate, slower pass, so a
 * model outage can never cost you a conversation you can no longer re-capture.
 */

export const dynamic = "force-dynamic";

/*
 * The extension runs on the AI platform's origin, so its `fetch` is
 * cross-origin and preflighted. `*` is correct here precisely because the token
 * is the credential: no cookie rides along, so a hostile page that echoes this
 * header still has nothing to send.
 */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Max-Age": "86400",
} as const;

const MAX_BODY_BYTES = 8_000_000;

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(request: Request): Promise<Response> {
  const token = bearer(request);
  if (!token) {
    return json({ error: "Missing bearer token. Generate one in Settings → Browser capture." }, 401);
  }

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) {
    return json({ error: "Conversation is too large." }, 413);
  }

  const userId = await userForToken(token);
  if (!userId) return json({ error: "That token is not valid. Generate a new one in Settings." }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Body must be JSON." }, 400);
  }

  try {
    const normalized = normalizeConversation(body);
    const stored = await storeConversation(userId, normalized);

    return json(
      {
        ok: true,
        conversationId: stored.conversationId,
        created: stored.created,
        messages: stored.messageCount,
        // The extension shows this, so "saved" never implies "already read".
        status: "queued for extraction",
      },
      stored.created ? 201 : 200,
    );
  } catch (error) {
    if (error instanceof IngestError) return json({ error: error.message }, 400);
    return json({ error: "Could not store that conversation." }, 500);
  }
}

function bearer(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * Tokens are stored as scrypt hashes, so they cannot be looked up directly —
 * every candidate is verified in turn. That is fine at this scale (one row on a
 * personal install) and it keeps a database leak from yielding usable tokens.
 */
async function userForToken(token: string): Promise<string | null> {
  if (!token.startsWith("oc_")) return null;

  const db = await getDb();
  const rows = await db
    .select({ userId: settings.userId, hash: settings.ingestTokenHash })
    .from(settings)
    .where(isNotNull(settings.ingestTokenHash))
    .limit(50);

  for (const row of rows) {
    if (row.hash && (await verifyPassword(token, row.hash))) return row.userId;
  }
  return null;
}

function json(body: unknown, status: number): Response {
  return NextResponse.json(body, { status, headers: CORS });
}
