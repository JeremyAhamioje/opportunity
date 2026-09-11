import { CATEGORIES, WORK_MODES, type Category, type WorkMode } from "@/lib/domain/types";
import { parseLooseDate, type ParsedOpportunity } from "./research";

/**
 * Optional accelerator, backed by Gemini. The Research Import screen works
 * fully without this — `parseResearch()` is the guaranteed path, needing no key
 * and no network. This only earns its place on messy prose that no regex
 * reasonably could structure.
 *
 * Raw REST rather than an SDK: one request shape, no dependency, and the model
 * id stays a one-line env change (see GEMINI_MODEL_ID in .env.example).
 */

export { isAiConfigured } from "./ai-config";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-2.5-flash";

/** Bounded so a stalled request fails with a message instead of a dead loader. */
const TIMEOUT_MS = 30_000;

const STRING = { type: "STRING" } as const;

// Every field is a plain string and "" means unknown. Nullable/enum support has
// varied between Gemini model versions; strings are understood by all of them,
// and the values are validated here anyway.
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    opportunities: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          category: STRING,
          companyName: STRING,
          title: STRING,
          website: STRING,
          applicationUrl: STRING,
          industry: STRING,
          companySize: STRING,
          location: STRING,
          salary: STRING,
          workMode: STRING,
          deadline: STRING,
          notes: STRING,
          problemObserved: STRING,
          proposedSolution: STRING,
          buyerRole: STRING,
          whyInterested: STRING,
          contribution: STRING,
          country: STRING,
          degreeLevel: STRING,
          fundingAmount: STRING,
          eligibility: STRING,
          skills: { type: "ARRAY", items: STRING },
          contactName: STRING,
          contactEmail: STRING,
        },
        required: ["companyName", "category"],
      },
    },
  },
  required: ["opportunities"],
} as const;

const SYSTEM = `You convert research notes into structured opportunity records for a personal opportunity CRM.

Categories:
- workflow: a company with a manual, repetitive or inefficient process that software, automation or AI could fix. Use this whenever a specific painful process is described.
- job: a role that is currently open and can be applied to.
- speculative: an interesting company that is not advertising a role, contacted on spec.
- scholarship: scholarships, fellowships, grants and other funded study.

Rules:
- One record per distinct company or opportunity. Never invent companies.
- Copy facts from the source. Do not embellish, estimate, or fill gaps with plausible guesses. Use an empty string for anything the notes do not state.
- companyName is the employer, organisation or scholarship provider — never a person's name.
- For workflow records, problemObserved must quote or closely paraphrase the evidence of manual work in the notes.
- deadline must be YYYY-MM-DD, or an empty string if no date is stated.
- Preserve every URL exactly as written.
- Ignore the assistant's own narration ("here are the companies I found", "let me know if..."). Those are not opportunities.`;

type RawItem = Record<string, unknown>;

export async function extractWithGemini(text: string): Promise<ParsedOpportunity[]> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("GEMINI_API_KEY is not set.");

  const model = process.env.GEMINI_MODEL_ID?.trim() || DEFAULT_MODEL;

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
            { text: `Extract every opportunity from these research notes.\n\n<notes>\n${text}\n</notes>` },
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
    throw new Error(`Gemini (${model}) returned ${response.status}. ${summarise(detail)}`.trim());
  }

  const payload = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
  };

  if (payload.promptFeedback?.blockReason) {
    throw new Error(`Gemini blocked the request (${payload.promptFeedback.blockReason}).`);
  }

  const body = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  if (!body.trim()) throw new Error("Gemini returned an empty response.");

  let parsed: { opportunities?: RawItem[] };
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error("Gemini returned output that was not valid JSON.");
  }

  const rows = Array.isArray(parsed.opportunities) ? parsed.opportunities : [];

  return rows
    .map(toOpportunity)
    .filter((item): item is ParsedOpportunity => item !== null);
}

function toOpportunity(row: RawItem): ParsedOpportunity | null {
  const companyName = str(row.companyName);
  if (!companyName) return null;

  const rawCategory = str(row.category)?.toLowerCase() ?? "";
  const category = (CATEGORIES as readonly string[]).includes(rawCategory)
    ? (rawCategory as Category)
    : "speculative";

  const rawMode = str(row.workMode)?.toLowerCase() ?? "";
  const workMode = (WORK_MODES as readonly string[]).includes(rawMode)
    ? (rawMode as WorkMode)
    : undefined;

  const skills = Array.isArray(row.skills)
    ? row.skills.map((skill) => str(skill)).filter((skill): skill is string => Boolean(skill))
    : [];

  return {
    category,
    companyName: companyName.slice(0, 120),
    title: str(row.title),
    website: str(row.website),
    applicationUrl: str(row.applicationUrl),
    industry: str(row.industry),
    companySize: str(row.companySize),
    location: str(row.location),
    salary: str(row.salary),
    workMode,
    deadline: parseLooseDate(str(row.deadline)),
    notes: str(row.notes),
    problemObserved: str(row.problemObserved),
    proposedSolution: str(row.proposedSolution),
    buyerRole: str(row.buyerRole),
    whyInterested: str(row.whyInterested),
    contribution: str(row.contribution),
    country: str(row.country),
    degreeLevel: str(row.degreeLevel),
    fundingAmount: str(row.fundingAmount),
    eligibility: str(row.eligibility),
    skills: skills.length ? skills : undefined,
    contactName: str(row.contactName),
    contactEmail: str(row.contactEmail),
    confidence: "high",
  };
}

function str(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "-" || trimmed.toLowerCase() === "n/a") return undefined;
  return trimmed;
}

/** Google's error bodies are verbose; keep the human-readable part. */
function summarise(body: string): string {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string; status?: string } };
    const message = parsed.error?.message;
    if (message) return message.length > 240 ? `${message.slice(0, 237)}…` : message;
  } catch {
    /* not JSON — fall through */
  }
  return body.slice(0, 200);
}
