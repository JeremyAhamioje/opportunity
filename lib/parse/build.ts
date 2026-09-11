import { aiModelId, isAiConfigured } from "./ai-config";

/**
 * Turns a messy brain dump into a build record.
 *
 * The contract that matters: **a dump is never lost.** Gemini is an
 * accelerator, exactly as it is on Research Import — if there is no key, or the
 * model is down, slow, or returns nonsense, `structureBrainDump` still returns a
 * usable draft built by `fallbackDraft()` from the raw text. The idea gets
 * saved either way; the only thing at stake is how much of the form is
 * pre-filled.
 */

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/** Shorter than the research extractor's: this runs while you watch a spinner. */
const TIMEOUT_MS = 20_000;

const STRING = { type: "STRING" } as const;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: STRING,
    summary: STRING,
    problem: STRING,
    solution: STRING,
    whatItProves: STRING,
    firstStep: STRING,
    scopeEstimate: STRING,
    stack: { type: "ARRAY", items: STRING },
    openQuestions: { type: "ARRAY", items: STRING },
  },
  required: ["title"],
} as const;

const SYSTEM = `You turn a developer's messy, half-formed brain dump into one structured build record.

A "build" is something the person intends to make themselves: a demo to support a job application, a side project, a product, a proof of concept.

Rules:
- Exactly one record. A dump is one idea, however rambling.
- Structure what is there. Never invent features, deadlines, tech choices or motivations the dump does not contain. Empty string is the correct answer for anything unstated.
- title: 3-8 words, the thing itself. No filler like "a project to". Sentence case.
- summary: one or two sentences a stranger could understand.
- problem: what is broken or missing that this addresses, in the writer's own terms.
- solution: what actually gets built.
- whatItProves: why it is worth the time — the skill it demonstrates, the application it supports, the bet it tests. Only if the dump implies one.
- firstStep: the smallest concrete action that starts it, phrased as an instruction ("Sketch the onboarding questionnaire"). This is the field that rescues a stalled build, so make it physical and small.
- scopeEstimate: the writer's own sizing if stated ("a weekend", "2 weeks"). Do not guess.
- stack: named languages, frameworks, services, APIs. Only ones actually mentioned.
- openQuestions: genuine unknowns the dump raises and does not answer. Prefer the writer's own doubts over ones you thought of. At most four, and an empty list is a fine answer.
- Keep the writer's vocabulary. Do not corporate-ify it.`;

export type BuildDraft = {
  title: string;
  summary?: string;
  problem?: string;
  solution?: string;
  whatItProves?: string;
  firstStep?: string;
  scopeEstimate?: string;
  stack: string[];
  openQuestions: string[];
  /** How the draft was produced, so the UI can be honest about it. */
  source: "gemini" | "fallback";
  /** Why the model was not used, when it was not. Shown, never swallowed. */
  error?: string;
};

export async function structureBrainDump(text: string): Promise<BuildDraft> {
  const dump = text.trim();
  if (!dump) throw new Error("Nothing to structure — the dump is empty.");

  if (!isAiConfigured()) {
    return fallbackDraft(dump);
  }

  try {
    return await callGemini(dump);
  } catch (error) {
    // A model failure must never cost the user their idea.
    return {
      ...fallbackDraft(dump),
      error: error instanceof Error ? error.message : "Gemini could not be reached.",
    };
  }
}

async function callGemini(dump: string): Promise<BuildDraft> {
  const key = process.env.GEMINI_API_KEY!.trim();
  const model = aiModelId();

  const response = await fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [
        {
          role: "user",
          parts: [{ text: `Structure this brain dump.\n\n<dump>\n${dump}\n</dump>` }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Gemini (${model}) returned ${response.status}. ${summarise(detail)}`.trim());
  }

  const payload = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    promptFeedback?: { blockReason?: string };
  };

  if (payload.promptFeedback?.blockReason) {
    throw new Error(`Gemini blocked the request (${payload.promptFeedback.blockReason}).`);
  }

  const body =
    payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  if (!body.trim()) throw new Error("Gemini returned an empty response.");

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error("Gemini returned output that was not valid JSON.");
  }

  const title = str(parsed.title);
  if (!title) throw new Error("Gemini did not name the build.");

  return {
    title: title.slice(0, 140),
    summary: str(parsed.summary),
    problem: str(parsed.problem),
    solution: str(parsed.solution),
    whatItProves: str(parsed.whatItProves),
    firstStep: str(parsed.firstStep),
    scopeEstimate: str(parsed.scopeEstimate),
    stack: strList(parsed.stack).slice(0, 12),
    openQuestions: strList(parsed.openQuestions).slice(0, 4),
    source: "gemini",
  };
}

/**
 * No key, or the model failed. Takes the one structural guess that is always
 * safe — the first sentence is usually the idea — and leaves every interpreted
 * field empty rather than inventing one.
 */
export function fallbackDraft(dump: string): BuildDraft {
  const firstLine =
    dump
      .split(/\n+/)
      .map((line) => line.replace(/^[#\-*>\s]+/, "").trim())
      .find(Boolean) ?? "Untitled build";

  const sentence = firstLine.split(/(?<=[.!?])\s/)[0] ?? firstLine;
  const title = sentence.length > 80 ? `${sentence.slice(0, 77).trimEnd()}…` : sentence;

  return { title, stack: [], openQuestions: [], source: "fallback" };
}

function str(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "-" || trimmed.toLowerCase() === "n/a") return undefined;
  return trimmed;
}

function strList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => str(item))
    .filter((item): item is string => Boolean(item));
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
