import {
  CONVERSATION_SOURCES,
  type ConversationSource,
} from "@/lib/domain/archaeology";

/**
 * The one shape the backend accepts, whatever produced it — the ChatGPT
 * adapter, a future Claude/Gemini adapter, a pasted transcript, or a platform
 * data export. Everything downstream of `normalizeConversation` is written
 * against this and knows nothing about any platform's DOM.
 *
 * Keeping this contract narrow is the whole reason a second source is a new
 * adapter file rather than a change to the pipeline.
 */
export type RawMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  /** ISO 8601. Absent on most scraped sources — the conversation date is used. */
  timestamp?: string | null;
};

export type RawConversation = {
  source: ConversationSource;
  sourceConversationId?: string | null;
  title: string;
  url?: string | null;
  messages: RawMessage[];
  capturedAt?: string | null;
};

export type NormalizedConversation = {
  source: ConversationSource;
  sourceConversationId: string | null;
  title: string;
  url: string | null;
  startedAt: Date | null;
  capturedAt: Date;
  messages: { role: RawMessage["role"]; content: string; position: number; occurredAt: Date | null }[];
  charCount: number;
};

export class IngestError extends Error {}

/** Hard ceilings. A runaway payload should be refused, not stored and retried. */
const LIMITS = {
  messages: 2000,
  messageChars: 200_000,
  totalChars: 4_000_000,
  title: 300,
} as const;

/**
 * Validates and normalises whatever arrived. Deliberately strict: this is the
 * trust boundary between a browser extension running on someone else's page
 * and this database.
 */
export function normalizeConversation(input: unknown): NormalizedConversation {
  if (!input || typeof input !== "object") {
    throw new IngestError("Expected a conversation object.");
  }
  const raw = input as Record<string, unknown>;

  const source = str(raw.source)?.toLowerCase() ?? "";
  if (!(CONVERSATION_SOURCES as readonly string[]).includes(source)) {
    throw new IngestError(
      `Unknown source "${source}". Expected one of: ${CONVERSATION_SOURCES.join(", ")}.`,
    );
  }

  const rawMessages = Array.isArray(raw.messages) ? raw.messages : null;
  if (!rawMessages) throw new IngestError("`messages` must be an array.");
  if (!rawMessages.length) throw new IngestError("The conversation has no messages.");
  if (rawMessages.length > LIMITS.messages) {
    throw new IngestError(
      `Too many messages (${rawMessages.length}); the ceiling is ${LIMITS.messages}.`,
    );
  }

  let charCount = 0;
  const messages: NormalizedConversation["messages"] = [];

  for (const entry of rawMessages) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;

    const content = str(item.content);
    if (!content) continue; // Empty turns carry nothing; drop rather than store.

    const roleRaw = str(item.role)?.toLowerCase();
    const role =
      roleRaw === "user" || roleRaw === "assistant" || roleRaw === "system"
        ? roleRaw
        : "user";

    const trimmed =
      content.length > LIMITS.messageChars ? content.slice(0, LIMITS.messageChars) : content;

    charCount += trimmed.length;
    if (charCount > LIMITS.totalChars) {
      throw new IngestError("Conversation exceeds the size ceiling.");
    }

    messages.push({
      role,
      content: trimmed,
      position: messages.length,
      occurredAt: parseDate(item.timestamp),
    });
  }

  if (!messages.length) throw new IngestError("Every message was empty.");

  const capturedAt = parseDate(raw.capturedAt) ?? new Date();

  // The conversation's own date is the earliest timestamp its messages carry.
  // Falling back to capture time would date a two-year-old chat to today and
  // quietly break every "when did I first say this?" answer in the product.
  const stamps = messages
    .map((message) => message.occurredAt)
    .filter((date): date is Date => date !== null);
  const startedAt = stamps.length
    ? new Date(Math.min(...stamps.map((date) => date.getTime())))
    : null;

  return {
    source: source as ConversationSource,
    sourceConversationId: str(raw.sourceConversationId) ?? null,
    title: (str(raw.title) ?? deriveTitle(messages[0].content)).slice(0, LIMITS.title),
    url: normalizeHttpUrl(str(raw.url)),
    startedAt,
    capturedAt,
    messages,
    charCount,
  };
}

/** An untitled capture still needs a handle; the opening line is the best one. */
function deriveTitle(firstMessage: string): string {
  const line = firstMessage.split("\n").find((part) => part.trim().length) ?? "Untitled";
  const clean = line.trim().replace(/^#+\s*/, "");
  return clean.length > 80 ? `${clean.slice(0, 77)}…` : clean;
}

function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function parseDate(value: unknown): Date | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    // Both seconds and milliseconds appear in the wild; disambiguate by size.
    const ms = value > 1e11 ? value : value * 1000;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const raw = str(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Only http(s) survives — a stored `javascript:` URL becomes a link we render. */
function normalizeHttpUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*  Pasted transcripts                                                        */
/* -------------------------------------------------------------------------- */

const SPEAKER = /^\s{0,3}(?:\*\*)?(you|me|user|human|chatgpt|claude|gemini|assistant|ai)(?:\*\*)?\s*[:：]\s*/i;
const USER_SPEAKERS = new Set(["you", "me", "user", "human"]);

/**
 * Turns a pasted transcript into messages. Recognises "You:" / "ChatGPT:" style
 * speaker labels, and otherwise treats the whole paste as a single turn — which
 * is still perfectly useful, because extraction reads content, not structure.
 *
 * This path is not a fallback for the extension. It is how the pipeline stays
 * testable with no browser involved, and how a platform data export gets in.
 */
export function parseTranscript(text: string, title?: string | null): RawConversation {
  const lines = text.split(/\r?\n/);
  const messages: RawMessage[] = [];
  let role: RawMessage["role"] = "user";
  let buffer: string[] = [];

  const flush = () => {
    const content = buffer.join("\n").trim();
    if (content) messages.push({ role, content });
    buffer = [];
  };

  for (const line of lines) {
    const match = line.match(SPEAKER);
    if (match) {
      flush();
      role = USER_SPEAKERS.has(match[1].toLowerCase()) ? "user" : "assistant";
      buffer.push(line.slice(match[0].length));
    } else {
      buffer.push(line);
    }
  }
  flush();

  if (!messages.length && text.trim()) {
    messages.push({ role: "user", content: text.trim() });
  }

  return { source: "manual", title: title?.trim() || "Pasted transcript", messages };
}
