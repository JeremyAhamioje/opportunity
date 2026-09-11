import {
  INSIGHT_KINDS,
  LINK_KINDS,
  MOVEMENTS,
  STANCES,
  type InsightKind,
  type LinkKind,
  type Movement,
  type Stance,
} from "@/lib/domain/archaeology";
import { isValidDay } from "@/lib/domain/dates";
import {
  AIUnavailableError,
  type AIProvider,
  type ExtractInput,
  type ExtractResult,
  type ExtractedEntity,
  type ExtractedRelationship,
} from "./provider";

/**
 * Gemini behind the `AIProvider` seam. Raw REST, no SDK — same reasoning as
 * `lib/parse/ai.ts`: one request shape, no dependency, and the model id stays a
 * one-line env change.
 */

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-2.5-flash";

/**
 * Tried in order after the configured model, when the failure is capacity
 * rather than correctness.
 *
 * Flash models return 503 "high demand" unpredictably — 2.5 and 3.7 have each
 * been unavailable for stretches — and a single-model extractor simply stops
 * when that happens. Since these are all doing the same structured-extraction
 * job, falling through is strictly better than failing, and the raw
 * conversation is safely stored either way.
 */
const FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-3.5-flash"];

/** Capacity and transient server faults — worth another model. Not 4xx. */
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

/**
 * Extraction reasons over far more text than the import parser, and the
 * fallback models are markedly slower than the primary — a long conversation
 * through a slow model genuinely takes minutes, so a tight ceiling turns a
 * working run into a failure.
 */
const TIMEOUT_MS = 180_000;

const STRING = { type: "STRING" } as const;

/*
 * Every field is a plain string, and "" means unknown. Nullable and enum
 * support has varied between Gemini versions; strings are understood by all of
 * them, and each value is validated here anyway — the model is never trusted to
 * have honoured the schema.
 */
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    entities: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          kind: STRING,
          title: STRING,
          summary: STRING,
          detail: STRING,
          stance: STRING,
          confidence: STRING,
          evidence: STRING,
          movement: STRING,
          dueDate: STRING,
        },
        required: ["kind", "title", "stance", "confidence", "evidence"],
      },
    },
    relationships: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          from: STRING,
          to: STRING,
          kind: STRING,
          reason: STRING,
        },
        required: ["from", "to", "kind"],
      },
    },
  },
  required: ["entities"],
} as const;

const SYSTEM = `You read a person's own AI conversations and recover the things worth remembering: ideas, projects, goals, commitments, decisions, problems, opportunities and tasks.

You are building an external memory for one person. Everything you output will be shown back to them attributed to their own words, so accuracy matters far more than volume.

ENTITY KINDS
- idea: something they thought might be worth making or doing.
- project: something they said they intend to build, or are building.
- goal: an outcome they want.
- commitment: something they said THEY would do. "Tomorrow I'll…", "this week I'm going to…", "I need to…".
- decision: a conclusion they reached that CLOSES OFF an option, so they never have to re-argue it. See the section below — this is the kind most often missed.
- problem: a recurring problem they want solved.
- opportunity: a job, lead, client, partnership or opening.
- task: a specific, concrete action.

DECISIONS — extract these aggressively; they are the highest-value thing here and the easiest to miss.
A decision is a conclusion that rules something out or settles a direction. Cues: "I've decided", "I'm not going to", "don't X, do Y instead", "actually", "on reflection", "that won't work", "so the plan is", "my thesis now is". Also count a conclusion reached after investigating something: "I looked at them and they already solve this" is a decision, not a note.
Name the decision by what was SETTLED, not by the topic — "Don't rebuild the PMS; target workflow gaps around it", not "Property management software".
A passage can yield BOTH a decision and the idea it settles. Emit both, and link them.

IDEA EVOLUTION — the same thing changing over time must not become several unrelated entities.
When a later passage supersedes, narrows, redirects or replaces an earlier position in this transcript, emit an "evolves_into" relationship from the earlier entity to the later one, and set the later entity's movement to "reversed" (if it changed direction) or "developed" (if it sharpened). Use "depends_on" ONLY for a genuine prerequisite — one thing that cannot start until another finishes — never for "this came after that".
When someone abandons an earlier plan in favour of a new one, the earlier entity's stance stays as they originally expressed it; the abandonment is carried by the new decision and the evolves_into link, not by rewriting history.

STANCE — how firmly THEY expressed it. This is the most important field you produce.
- explicit: they committed. "I'm going to build this", "I've decided", "I'll do it tomorrow".
- proposed: they floated it as a real option. "Maybe I should", "I could".
- discussed: it came up, they explored it, they did not adopt it. "Could something like this work?", or the assistant suggested it and they did not agree.
- abandoned: they explicitly ruled it out. "I'm not pursuing this", "scrap that", "that won't work".

CONFIDENCE (0-100) is a DIFFERENT thing: how sure you are that you read the text correctly. A crystal-clear idle musing is confidence 95, stance "discussed". Never raise confidence because the idea sounds good, and never lower it because they were tentative — tentativeness is stance.

RULES
- Only extract what the PERSON said or agreed with. The assistant's suggestions are not the person's ideas unless they adopted them. This single rule matters more than any other: an assistant brainstorming twelve product names does not mean the person had twelve ideas.
- evidence must be a short VERBATIM quote from one of the PERSON's OWN messages, copied exactly. Never quote the assistant. This is enforced: an entity whose evidence comes from an assistant turn is discarded, however good the idea was. If the assistant proposed something and the person adopted it, quote the person adopting it — and if they never visibly did, do not extract it at all.
- Do not emit two entities from the same sentence unless they are genuinely different things. One sentence usually describes one thing.
- title is a short, stable, human name for the thing — "Property management workflow automation", not "the user's idea about property management". It will be matched against titles from other conversations, so name the SAME thing the SAME way every time. Do not include dates, hedges, or "idea to".
- Be conservative. Most sentences are not entities. A conversation that explores one topic usually yields between one and five entities, not thirty. Merge closely-related statements into one entity rather than emitting near-duplicates.
- movement describes what this passage did to the thing, when that is clear: introduced, developed, decided, reversed, abandoned, revived. Leave it empty if it is just a mention.
- dueDate: only for commitments with a stated timeframe. Resolve relative dates against the conversation date given in the prompt — "tomorrow" in a conversation dated 2026-03-04 is 2026-03-05. Format YYYY-MM-DD. Empty if no timeframe was stated. Never invent one.
- relationships: link entities you emitted, by their exact titles. evolves_into (an earlier position became a later one), depends_on, part_of, relates_to. Use evolves_into when they changed their mind about the same thing rather than emitting two unrelated entities.
- Personal life is IN SCOPE. Money, health, living situation, family, study, career and relationships are where most real goals, decisions and commitments actually live, and this is a private system built for one person to remember their own life. Treat "I need to cover rent by the 30th", "I'm going to see a doctor about this", "I've decided to move back home" exactly like any other commitment or decision — same evidence rule, same stance rule.
- The bar is still intention, not emotion. Venting, worrying and thinking out loud are not entities; something they resolved to DO is. "I'm stressed about money" is a feeling — extract nothing. "I'm cutting my spending to ₦50k a week" is a decision — extract it.
- The conversation title is a WEAK hint and is often wrong: these platforms name a chat after its opening exchange and never update it, so a long conversation that drifted may carry a title about something else entirely. Trust the transcript, never the title. If they disagree, the title is the one that is wrong.
- The transcript may begin mid-conversation, with an assistant turn and no preceding context. Work only with what is present. Do not infer what came before, and do not treat an assistant message with no visible reply as something the person agreed to.
- Output nothing rather than something plausible. An empty array is a correct answer for small talk, debugging help, or a conversation where they were only asking questions.`;

type RawItem = Record<string, unknown>;

export function geminiProvider(): AIProvider {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    throw new AIUnavailableError(
      "GEMINI_API_KEY is not set — capture still works, but nothing can be extracted.",
    );
  }
  const model = process.env.GEMINI_MODEL_ID?.trim() || DEFAULT_MODEL;

  return {
    id: "gemini",
    model,
    extract: (input) => extract(key, model, input),
  };
}

/**
 * Walks the model list until one answers. Only capacity failures fall through;
 * a 400 means the request itself is wrong and every model would reject it, so
 * retrying elsewhere would just turn one clear error into three slow ones.
 */
async function extract(
  key: string,
  model: string,
  input: ExtractInput,
): Promise<ExtractResult> {
  const candidates = [model, ...FALLBACK_MODELS.filter((id) => id !== model)];
  let lastError: Error | null = null;

  for (const candidate of candidates) {
    try {
      return await callModel(key, candidate, input);
    } catch (error) {
      // A timeout is about this model being slow, not about the request being
      // wrong, so the next candidate deserves its own attempt.
      const timedOut =
        error instanceof DOMException && error.name === "TimeoutError";

      if (error instanceof RetryableModelError || timedOut) {
        lastError =
          error instanceof Error ? error : new Error(String(error));
        continue;
      }
      throw error;
    }
  }

  throw lastError ?? new Error("No model was reachable.");
}

class RetryableModelError extends Error {}

async function callModel(
  key: string,
  model: string,
  input: ExtractInput,
): Promise<ExtractResult> {
  const conversationDate = input.occurredAt.toISOString().slice(0, 10);

  const response = await fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                `Conversation title: ${input.title}\n` +
                `Conversation date: ${conversationDate}\n\n` +
                `<transcript>\n${input.transcript}\n</transcript>`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    const message = `Gemini (${model}) returned ${response.status}. ${summarise(detail)}`.trim();
    throw RETRYABLE.has(response.status)
      ? new RetryableModelError(message)
      : new Error(message);
  }

  const payload = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
  };

  if (payload.promptFeedback?.blockReason) {
    throw new Error(`Gemini blocked the request (${payload.promptFeedback.blockReason}).`);
  }

  const body =
    payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  if (!body.trim()) throw new Error("Gemini returned an empty response.");

  let parsed: { entities?: RawItem[]; relationships?: RawItem[] };
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error("Gemini returned output that was not valid JSON.");
  }

  const entities = (Array.isArray(parsed.entities) ? parsed.entities : [])
    .map((row) => toEntity(row, input.userTranscript))
    .filter((row): row is ExtractedEntity => row !== null);

  const names = new Set(entities.map((entity) => entity.title));
  const relationships = (Array.isArray(parsed.relationships) ? parsed.relationships : [])
    .map(toRelationship)
    .filter((row): row is ExtractedRelationship => row !== null)
    // A link to an entity that was not emitted is noise, not a relationship.
    .filter((row) => names.has(row.from) && names.has(row.to) && row.from !== row.to);

  return { entities, relationships };
}

function toEntity(row: RawItem, userTranscript: string): ExtractedEntity | null {
  const title = str(row.title);
  const evidence = str(row.evidence);
  if (!title || !evidence) return null;

  const kind = pick<InsightKind>(row.kind, INSIGHT_KINDS);
  if (!kind) return null;

  /*
   * The quote must appear verbatim in something the PERSON said. Two failures
   * are caught by this one check:
   *
   *   - hallucination: an excerpt that appears nowhere in the source, which
   *     would be stored as provenance and shown back as "your own words";
   *   - misattribution: an excerpt lifted from an assistant turn, which is how
   *     the model's own suggestions end up recorded as the user's ideas and
   *     later resurface as things they said they would do.
   *
   * Verifying against the user's turns alone makes both mechanically
   * impossible rather than a matter of the model following instructions.
   * Whitespace is normalised first because the model reflows line breaks.
   */
  if (!contains(userTranscript, evidence)) return null;

  return {
    kind,
    title: title.slice(0, 200),
    summary: str(row.summary)?.slice(0, 600) ?? null,
    detail: str(row.detail)?.slice(0, 4000) ?? null,
    stance: pick<Stance>(row.stance, STANCES) ?? "discussed",
    confidence: clampConfidence(row.confidence),
    evidence: evidence.slice(0, 1200),
    movement: pick<Movement>(row.movement, MOVEMENTS),
    dueDate: validDay(row.dueDate),
  };
}

function toRelationship(row: RawItem): ExtractedRelationship | null {
  const from = str(row.from);
  const to = str(row.to);
  const kind = pick<LinkKind>(row.kind, LINK_KINDS);
  if (!from || !to || !kind) return null;
  // duplicate_of is decided by the resolver against the whole corpus, never by
  // a model that has only seen one chunk.
  if (kind === "duplicate_of") return null;
  return { from, to, kind, reason: str(row.reason)?.slice(0, 300) ?? null };
}

const squash = (value: string) => value.replace(/\s+/g, " ").trim().toLowerCase();

function contains(haystack: string, needle: string): boolean {
  const flat = squash(needle);
  if (flat.length < 8) return false; // Too short to verify meaningfully.
  return squash(haystack).includes(flat);
}

function pick<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  const raw = str(value)?.toLowerCase();
  return raw && (allowed as readonly string[]).includes(raw) ? (raw as T) : null;
}

function clampConfidence(value: unknown): number {
  const raw = typeof value === "number" ? value : Number(str(value) ?? "");
  if (!Number.isFinite(raw)) return 50;
  // Models return both 0-1 and 0-100 despite the instruction; accept either.
  const scaled = raw > 0 && raw <= 1 ? raw * 100 : raw;
  return Math.min(100, Math.max(0, Math.round(scaled)));
}

function validDay(value: unknown): string | null {
  const raw = str(value);
  return raw && isValidDay(raw) ? raw : null;
}

function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "-" || trimmed.toLowerCase() === "n/a") return null;
  return trimmed;
}

function summarise(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    const message = parsed.error?.message;
    if (message) return message.length > 240 ? `${message.slice(0, 237)}…` : message;
  } catch {
    /* not JSON — fall through */
  }
  return body.slice(0, 200);
}
