import { and, asc, eq, sql } from "drizzle-orm";
import { getDb, type Database } from "@/lib/db";
import { conversations, insightLinks, insightMentions, insights, messages } from "@/lib/db/schema";
import { geminiProvider } from "@/lib/ai/gemini";
import { AIUnavailableError, type AIProvider, type ExtractedEntity } from "@/lib/ai/provider";
import type { NormalizedConversation } from "./normalize";
import { recountInsights, resolveEntity } from "./resolve";

/**
 * Capture and extraction are separate on purpose.
 *
 * `storeConversation` writes the raw chat and returns. `extractConversation`
 * reads it back and does the slow, failable, model-dependent work. So a model
 * outage, a bad key or a 90-second call can never cost you the conversation —
 * the thing you cannot re-capture once the tab is closed.
 */

export type StoreResult = {
  conversationId: string;
  created: boolean;
  messageCount: number;
};

export async function storeConversation(
  userId: string,
  input: NormalizedConversation,
): Promise<StoreResult> {
  const db = await getDb();

  const existing = input.sourceConversationId
    ? await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(
          and(
            eq(conversations.userId, userId),
            eq(conversations.source, input.source),
            eq(conversations.sourceConversationId, input.sourceConversationId),
          ),
        )
        .limit(1)
        .then((rows) => rows[0] ?? null)
    : null;

  const row = {
    title: input.title,
    url: input.url,
    startedAt: input.startedAt,
    capturedAt: input.capturedAt,
    messageCount: input.messages.length,
    charCount: input.charCount,
    status: "pending" as const,
    error: null,
  };

  /*
   * Re-syncing a conversation that has grown replaces its messages wholesale.
   * Appending would double every turn that was already there, and diffing
   * scraped text is not reliable enough to bet the corpus on.
   */
  const conversationId = existing
    ? await (async () => {
        await db.update(conversations).set(row).where(eq(conversations.id, existing.id));
        await db.delete(messages).where(eq(messages.conversationId, existing.id));
        return existing.id;
      })()
    : await db
        .insert(conversations)
        .values({
          userId,
          source: input.source,
          sourceConversationId: input.sourceConversationId,
          ...row,
        })
        .returning({ id: conversations.id })
        .then((rows) => rows[0].id);

  await db.insert(messages).values(
    input.messages.map((message) => ({
      userId,
      conversationId,
      role: message.role,
      content: message.content,
      position: message.position,
      occurredAt: message.occurredAt,
    })),
  );

  return { conversationId, created: !existing, messageCount: input.messages.length };
}

/* -------------------------------------------------------------------------- */
/*  Extraction                                                                */
/* -------------------------------------------------------------------------- */

/** Chunks are generous — context is what lets the model see an idea evolve. */
const CHUNK_CHARS = 24_000;

export type ExtractionResult = {
  conversationId: string;
  insightsFound: number;
  created: number;
  duplicatesSuggested: number;
  error?: string;
};

export async function extractConversation(
  userId: string,
  conversationId: string,
  provider?: AIProvider,
): Promise<ExtractionResult> {
  const db = await getDb();

  const [conversation] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .limit(1);

  if (!conversation) {
    return { conversationId, insightsFound: 0, created: 0, duplicatesSuggested: 0, error: "Not found." };
  }

  let ai: AIProvider;
  try {
    ai = provider ?? geminiProvider();
  } catch (error) {
    const message = error instanceof AIUnavailableError ? error.message : String(error);
    await markFailed(db, conversationId, message);
    return { conversationId, insightsFound: 0, created: 0, duplicatesSuggested: 0, error: message };
  }

  await db
    .update(conversations)
    .set({ status: "extracting", error: null })
    .where(eq(conversations.id, conversationId));

  try {
    const rows = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.position));

    // The conversation's own date, so "tomorrow" resolves to when it was said.
    const occurredAt = conversation.startedAt ?? conversation.capturedAt;
    const touched = new Set<string>();
    const byTitle = new Map<string, string>();
    let created = 0;
    let duplicates = 0;
    let found = 0;

    for (const chunk of chunkMessages(rows)) {
      const result = await ai.extract({
        title: conversation.title,
        transcript: chunk.text,
        userTranscript: chunk.userText,
        occurredAt,
      });

      for (const entity of result.entities) {
        found += 1;
        const resolved = await resolveEntity(db, userId, entity);
        touched.add(resolved.insightId);
        byTitle.set(entity.title, resolved.insightId);
        if (resolved.created) created += 1;
        if (resolved.duplicateOf) duplicates += 1;

        await writeMention(db, {
          userId,
          insightId: resolved.insightId,
          conversationId,
          entity,
          messageId: chunk.findMessageId(entity.evidence),
          occurredAt,
        });
      }

      for (const link of result.relationships) {
        const fromId = byTitle.get(link.from);
        const toId = byTitle.get(link.to);
        if (!fromId || !toId || fromId === toId) continue;
        await db
          .insert(insightLinks)
          .values({
            userId,
            fromId,
            toId,
            kind: link.kind,
            status: "suggested",
            reason: link.reason,
          })
          .onConflictDoNothing();
      }
    }

    await recountInsights(db, userId, [...touched]);

    await db
      .update(conversations)
      .set({
        status: "done",
        error: null,
        extractedAt: new Date(),
        insightCount: touched.size,
      })
      .where(eq(conversations.id, conversationId));

    return {
      conversationId,
      insightsFound: found,
      created,
      duplicatesSuggested: duplicates,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markFailed(db, conversationId, message);
    return { conversationId, insightsFound: 0, created: 0, duplicatesSuggested: 0, error: message };
  }
}

/**
 * Drains pending conversations. On a single-user deployment "the queue" is a
 * scan of `status = 'pending'`; a real job runner replaces this function and
 * nothing else.
 */
export async function extractPending(userId: string, limit = 5): Promise<ExtractionResult[]> {
  const db = await getDb();
  const rows = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.userId, userId), eq(conversations.status, "pending")))
    .orderBy(asc(conversations.capturedAt))
    .limit(limit);

  const results: ExtractionResult[] = [];
  for (const row of rows) {
    results.push(await extractConversation(userId, row.id));
  }
  return results;
}

export async function countPending(userId: string): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(conversations)
    .where(and(eq(conversations.userId, userId), eq(conversations.status, "pending")));
  return row?.n ?? 0;
}

async function markFailed(db: Database, conversationId: string, error: string): Promise<void> {
  await db
    .update(conversations)
    .set({ status: "failed", error: error.slice(0, 500) })
    .where(eq(conversations.id, conversationId));
}

async function writeMention(
  db: Database,
  input: {
    userId: string;
    insightId: string;
    conversationId: string;
    entity: ExtractedEntity;
    messageId: string | null;
    occurredAt: Date;
  },
): Promise<void> {
  /*
   * One mention per insight per conversation. Without this, a long chat that
   * discusses one idea across three chunks would report it as three separate
   * sightings and inflate the recurrence signal the whole feature rests on.
   */
  const [existing] = await db
    .select({ id: insightMentions.id })
    .from(insightMentions)
    .where(
      and(
        eq(insightMentions.insightId, input.insightId),
        eq(insightMentions.conversationId, input.conversationId),
      ),
    )
    .limit(1);
  if (existing) return;

  await db.insert(insightMentions).values({
    userId: input.userId,
    insightId: input.insightId,
    conversationId: input.conversationId,
    messageId: input.messageId,
    excerpt: input.entity.evidence,
    movement: input.entity.movement,
    occurredAt: input.occurredAt,
  });
}

/* -------------------------------------------------------------------------- */
/*  Chunking                                                                  */
/* -------------------------------------------------------------------------- */

type Chunk = {
  text: string;
  /** The person's own turns only — what evidence is verified against. */
  userText: string;
  /** Maps an evidence quote back to the message it came from, for provenance. */
  findMessageId: (evidence: string) => string | null;
};

/**
 * Splits on message boundaries, never mid-message. A quote cut in half is a
 * quote that fails the verbatim check and silently loses the entity.
 */
function chunkMessages(rows: { id: string; role: string; content: string }[]): Chunk[] {
  const chunks: Chunk[] = [];
  let batch: typeof rows = [];
  let size = 0;

  const flush = () => {
    if (!batch.length) return;
    const current = batch;
    chunks.push({
      text: current.map((row) => `${row.role}: ${row.content}`).join("\n\n"),
      userText: current
        .filter((row) => row.role === "user")
        .map((row) => row.content)
        .join("\n\n"),
      findMessageId: (evidence) => {
        const needle = evidence.replace(/\s+/g, " ").trim().toLowerCase();
        // Only the person's turns: evidence is theirs by construction, and
        // matching an assistant turn here would file the wrong provenance.
        const hit = current.find(
          (row) =>
            row.role === "user" &&
            row.content.replace(/\s+/g, " ").toLowerCase().includes(needle),
        );
        return hit?.id ?? null;
      },
    });
    batch = [];
    size = 0;
  };

  for (const row of rows) {
    if (size + row.content.length > CHUNK_CHARS) flush();
    batch.push(row);
    size += row.content.length;
  }
  flush();

  return chunks;
}

/* -------------------------------------------------------------------------- */
/*  Deletion                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Deleting a conversation removes its messages and mentions by cascade, then
 * recounts every insight that cited it — so an insight can never keep claiming
 * eleven mentions once three of them are gone. Insights left with no evidence
 * at all are removed: an insight without provenance is exactly the
 * unattributable AI-generated fact this design exists to prevent.
 */
export async function deleteConversation(userId: string, conversationId: string): Promise<void> {
  const db = await getDb();

  const cited = await db
    .select({ insightId: insightMentions.insightId })
    .from(insightMentions)
    .where(
      and(
        eq(insightMentions.userId, userId),
        eq(insightMentions.conversationId, conversationId),
      ),
    );

  await db
    .delete(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)));

  const ids = [...new Set(cited.map((row) => row.insightId))];
  await recountInsights(db, userId, ids);

  for (const id of ids) {
    const [row] = await db
      .select({ count: insights.mentionCount, edited: insights.edited, status: insights.status })
      .from(insights)
      .where(eq(insights.id, id))
      .limit(1);
    // Anything the user has touched or promoted is theirs now, and survives.
    if (row && row.count === 0 && !row.edited && row.status === "open") {
      await db.delete(insights).where(eq(insights.id, id));
    }
  }
}
