import { isValidDay, toDay } from "@/lib/domain/dates";
import type { Category, WorkMode } from "@/lib/domain/types";

/**
 * Turns pasted Deep Research output into draft opportunity records.
 *
 * Entirely deterministic — no API key, no network. Research tools emit one of
 * three shapes in practice (JSON, a markdown table, or headed prose blocks) and
 * all three are handled here. Everything it produces is a *draft* that the
 * import screen lets you edit before anything is written.
 */

export type ParsedOpportunity = {
  category: Category;
  companyName: string;
  title?: string;
  website?: string;
  applicationUrl?: string;
  industry?: string;
  companySize?: string;
  location?: string;
  salary?: string;
  workMode?: WorkMode;
  deadline?: string;
  notes?: string;
  problemObserved?: string;
  proposedSolution?: string;
  buyerRole?: string;
  whyInterested?: string;
  contribution?: string;
  country?: string;
  degreeLevel?: string;
  fundingAmount?: string;
  eligibility?: string;
  requirements?: string;
  /** Checklist items, from "X Required?" columns or a comma-separated cell. */
  documents?: string[];
  skills?: string[];
  contactName?: string;
  contactEmail?: string;
  confidence: "high" | "medium" | "low";
};

export type ParseReport = {
  items: ParsedOpportunity[];
  shape: "json" | "table" | "blocks" | "lines" | "empty";
  note: string;
};

/* -------------------------------------------------------------------------- */
/*  Field aliases                                                             */
/* -------------------------------------------------------------------------- */

type FieldKey = keyof Omit<ParsedOpportunity, "confidence" | "category"> | "category";

const ALIASES: Record<string, FieldKey> = {};
function alias(field: FieldKey, ...keys: string[]) {
  for (const key of keys) ALIASES[key] = field;
}

alias("companyName", "company", "companyname", "company name", "organisation", "organization", "org", "employer", "institution", "provider", "business", "startup", "firm", "name");
alias("title", "title", "role", "job title", "jobtitle", "position", "opportunity", "scholarship", "scholarship name", "programme", "program", "vacancy", "headline");
alias("website", "website", "site", "web", "homepage", "company website", "url", "company url", "domain");
alias("applicationUrl", "link", "application link", "apply", "apply link", "application url", "job link", "joblink", "job url", "posting", "listing", "source", "source url", "application");
alias("industry", "industry", "sector", "vertical", "niche", "field");
alias("companySize", "size", "company size", "headcount", "employees", "team size", "staff");
alias("location", "location", "based", "hq", "city", "region", "where");
alias("salary", "salary", "rate", "pay", "compensation", "comp", "budget", "day rate");
alias("workMode", "work mode", "remote", "arrangement", "workplace", "onsite", "hybrid");
alias("deadline", "deadline", "closes", "closing date", "close date", "apply by", "due", "due date", "application deadline", "expires");
alias("notes", "notes", "note", "summary", "description", "details", "context", "overview", "comment");
alias("problemObserved", "problem", "pain", "pain point", "inefficiency", "workflow", "manual process", "observed", "issue", "bottleneck", "current process", "evidence");
alias("proposedSolution", "solution", "proposed solution", "proposal", "fix", "idea", "pitch", "angle", "outreach angle", "approach");
alias("buyerRole", "buyer", "decision maker", "decisionmaker", "who benefits", "budget owner", "stakeholder");
alias("whyInterested", "why", "why interested", "reason", "interest", "why this company", "rationale");
alias("contribution", "contribution", "what i could do", "value", "my value", "what i can offer", "offer");
alias("country", "country", "nationality", "eligible countries");
alias("degreeLevel", "degree", "level", "degree level", "study level", "qualification");
alias("fundingAmount", "funding", "amount", "award", "value of award", "stipend", "grant", "coverage", "funding amount");
alias("eligibility", "eligibility", "eligible", "who can apply", "criteria", "requirements");
alias("skills", "skills", "stack", "tech", "technologies", "skills required", "tools");
alias("contactName", "contact", "contact name", "person", "founder", "ceo", "reach out to");
alias("contactEmail", "email", "contact email", "e-mail", "mail");
alias("category", "category", "type", "kind", "bucket");

/*
 * Scholarship trackers are their own dialect: the awarding body sits in a
 * "University" column, the award name in "Scholarship Name", and the links are
 * split between the scheme and the host institution. Without these a perfectly
 * good spreadsheet parses to nothing.
 */
alias("companyName", "university", "school", "college", "host institution", "awarding body", "funder", "sponsor", "host university");
alias("applicationUrl", "official scholarship link", "scholarship link", "official link", "apply here");
alias("website", "official university link", "university link", "institution link");
alias("fundingAmount", "funding type", "award type", "value");
alias("eligibility", "engineering fields eligible", "fields eligible", "eligible fields", "minimum gpa requirement", "gpa", "age limit", "english requirement", "language requirement", "work experience required?");
alias("requirements", "requirements", "what you need", "application requirements", "conditions");
alias("notes", "my notes", "scholarship competitiveness", "competitiveness", "application fee", "can fee be waived?");
alias("deadline", "application deadline");
alias("documents", "documents", "documents required", "required documents", "supporting documents");

const MULTI_VALUE: FieldKey[] = ["skills"];

/**
 * Fields that legitimately gather several columns. Joined WITH their column
 * label, because "TOEFL min 90 IBT, English, 3.0, None stated" is unreadable
 * while "English requirement: TOEFL min 90 IBT · Age limit: None stated" is a
 * usable summary.
 */
const LABELLED_MULTI: FieldKey[] = ["eligibility", "requirements", "notes", "fundingAmount"];

/**
 * Column names that already say what the field is, so labelling them would just
 * produce "Notes: …". Anything else gets its column name kept, including the
 * first value — otherwise a merged field opens with a bare, context-free value
 * ("None · Competitiveness: Extremely High") and the first column is the one
 * nobody can interpret.
 */
const CANONICAL_COLUMNS = new Set([
  "notes",
  "note",
  "eligibility",
  "requirements",
  "funding",
  "funding amount",
  "summary",
  "description",
]);

/* -------------------------------------------------------------------------- */
/*  Entry point                                                               */
/* -------------------------------------------------------------------------- */

export function parseResearch(input: string): ParseReport {
  const text = input.trim();
  if (!text) return { items: [], shape: "empty", note: "Nothing pasted yet." };

  const fromJson = tryJson(text);
  if (fromJson) {
    return {
      items: dedupe(fromJson),
      shape: "json",
      note: `Read ${fromJson.length} structured ${fromJson.length === 1 ? "record" : "records"} from JSON.`,
    };
  }

  /*
   * Real research output is rarely one clean shape — a table of the obvious
   * candidates is usually followed by prose sections for the ones that needed
   * explaining. So tables are extracted first, then whatever text they did not
   * consume is parsed as blocks, and the two are merged.
   */
  const { items: pipeItems, rest: afterPipes } = extractTables(text);
  const { items: tsvItems, rest: afterTables } = extractTsvTables(afterPipes);
  const tableItems = [...pipeItems, ...tsvItems];
  const { items: bulletItems, rest } = extractBulletEntries(afterTables);

  if (tableItems.length) {
    const extra = [...bulletItems, ...(rest.trim() ? tryBlocks(rest) : [])];
    const items = dedupe([...tableItems, ...extra]);
    return {
      items,
      shape: "table",
      note: extra.length
        ? `Read ${tableItems.length} table rows plus ${extra.length} more from the surrounding notes.`
        : `Read ${tableItems.length} rows from a ${tsvItems.length && !pipeItems.length ? "pasted" : "markdown"} table.`,
    };
  }

  const fromBlocks = dedupe([...bulletItems, ...tryBlocks(rest)]);
  if (fromBlocks.length) {
    return {
      items: fromBlocks,
      shape: "blocks",
      note: `Found ${fromBlocks.length} ${fromBlocks.length === 1 ? "entry" : "entries"} in the pasted notes. Check each one before importing.`,
    };
  }

  const fromLines = tryLines(text);
  return {
    items: dedupe(fromLines),
    shape: "lines",
    note: fromLines.length
      ? `Read ${fromLines.length} loose ${fromLines.length === 1 ? "line" : "lines"}. These are rough — edit before importing.`
      : "Could not find anything that looks like an opportunity. Try one entry per paragraph, or a markdown table.",
  };
}

/* -------------------------------------------------------------------------- */
/*  JSON                                                                      */
/* -------------------------------------------------------------------------- */

function tryJson(text: string): ParsedOpportunity[] | null {
  const start = text.search(/[[{]/);
  if (start === -1) return null;

  // Deep Research often wraps JSON in prose or a code fence; take the widest
  // bracketed span and try that.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates = [fenced?.[1], text.slice(start), text].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      const value = JSON.parse(candidate.trim());
      const rows = Array.isArray(value)
        ? value
        : Array.isArray((value as Record<string, unknown>)?.opportunities)
          ? ((value as Record<string, unknown>).opportunities as unknown[])
          : [value];

      const items = rows
        .filter((row): row is Record<string, unknown> => !!row && typeof row === "object")
        .map((row) => {
          const draft = blank();
          for (const [key, raw] of Object.entries(row)) {
            assign(draft, key, stringify(raw));
          }
          return finish(draft, "high");
        })
        .filter((item): item is ParsedOpportunity => item !== null);

      if (items.length) return items;
    } catch {
      /* fall through to the next strategy */
    }
  }
  return null;
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(stringify).filter(Boolean).join(", ");
  if (typeof value === "object") return Object.values(value as object).map(stringify).join(" ");
  return String(value);
}

/* -------------------------------------------------------------------------- */
/*  Markdown tables                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Pulls every markdown table out of the text, returning both the rows and the
 * text with those tables removed so the remainder can be parsed separately.
 */
function extractTables(text: string): { items: ParsedOpportunity[]; rest: string } {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const items: ParsedOpportunity[] = [];
  const consumed = new Set<number>();

  for (let i = 0; i < lines.length; i++) {
    const header = lines[i].trim();
    if (!header.includes("|") || countPipes(header) < 2) continue;
    if (!isSeparator(lines[i + 1]?.trim() ?? "")) continue;

    const headers = splitRow(header);
    consumed.add(i);
    consumed.add(i + 1);

    let row = i + 2;
    for (; row < lines.length; row++) {
      const line = lines[row].trim();
      if (!line.includes("|")) break;
      consumed.add(row);
      if (isSeparator(line)) continue;

      const cells = splitRow(line);
      if (cells.every((cell) => !cell)) continue;

      const draft = blank();
      headers.forEach((name, index) => assign(draft, name, cells[index] ?? ""));
      const item = finish(draft, "high");
      if (item) items.push(item);
    }
    i = row - 1;
  }

  const rest = lines.filter((_, index) => !consumed.has(index)).join("\n");
  return { items, rest };
}

/* -------------------------------------------------------------------------- */
/*  Tab-separated tables                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Copying a table out of a rendered page — a Claude answer, a Google Doc, a
 * spreadsheet — yields tabs, not pipes, and no `|---|` separator row. That is an
 * entirely ordinary way to paste research, and without this it falls through to
 * the loose-line parser and produces nonsense from perfectly good data.
 *
 * Guarded by the header: at least three columns must map to real fields, and
 * one of them must be the company. Prose containing a stray tab cannot pass.
 */
function extractTsvTables(text: string): { items: ParsedOpportunity[]; rest: string } {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const items: ParsedOpportunity[] = [];
  const consumed = new Set<number>();

  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes("\t")) continue;

    const headers = lines[i].split("\t").map((cell) => clean(cell));
    const mapped = headers.filter((name) => ALIASES[normaliseKey(name)]);
    const namesCompany = headers.some(
      (name) => ALIASES[normaliseKey(name)] === "companyName",
    );
    if (mapped.length < 3 || !namesCompany) continue;

    consumed.add(i);

    /*
     * Cells routinely contain newlines. Copying a table out of a page with
     * inline citations drops the source name onto its own line mid-sentence, so
     * a single logical row arrives as three or four physical lines and a
     * line-per-row reader misaligns every column after it.
     *
     * So a row is accumulated until it has as many cells as the header, with
     * each continuation joined onto the cell it was split out of.
     */
    const emit = (cells: string[]) => {
      if (cells.every((cell) => !clean(cell))) return;
      const draft = blank();
      headers.forEach((name, index) => assign(draft, name, clean(cells[index] ?? "")));
      const item = finish(draft, "high");
      if (item) items.push(item);
    };

    let pending: string[] = [];
    let row = i + 1;

    for (; row < lines.length; row++) {
      const line = lines[row];

      if (!line.trim()) {
        // A blank line closes an unfinished row rather than swallowing the rest
        // of the document into it.
        if (pending.length) {
          emit(pending);
          pending = [];
        }
        consumed.add(row);
        continue;
      }

      // Outside a row, a line with no tabs is the end of the table.
      if (!line.includes("\t") && !pending.length) break;

      consumed.add(row);
      const cells = line.split("\t");

      if (pending.length) {
        pending[pending.length - 1] += ` ${cells[0]}`;
        pending.push(...cells.slice(1));
      } else {
        pending = cells;
      }

      if (pending.length >= headers.length) {
        emit(pending);
        pending = [];
        continue;
      }

      /*
       * Short of a full row — but that has two very different causes, and
       * guessing wrong merges two records into one:
       *
       *   - trailing columns were empty, so the copy has no trailing tabs
       *     (a row ending in a blank "Contact email" is one cell short);
       *   - a cell contains a newline, so the row continues on the next line.
       *
       * The next line settles it. A new record carries most of the table's
       * tabs; a continuation fragment carries almost none.
       */
      const next = lines[row + 1] ?? "";
      const looksLikeNewRow =
        (next.match(/\t/g)?.length ?? 0) >= Math.max(2, Math.floor(headers.length / 2));

      if (looksLikeNewRow || !next.trim()) {
        emit(pending);
        pending = [];
      }
    }

    if (pending.length) emit(pending);
    i = row - 1;
  }

  const rest = lines.filter((_, index) => !consumed.has(index)).join("\n");
  return { items, rest };
}

function countPipes(line: string) {
  return (line.match(/\|/g) ?? []).length;
}

function isSeparator(line: string) {
  return /^\|?[\s:|-]+\|[\s:|-]*$/.test(line) && line.includes("-");
}

function splitRow(line: string): string[] {
  return line
    .replace(/^\s*\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((cell) => clean(cell));
}

/**
 * "- Thistle Accounting — https://… — 12-person firm" is a complete entry on
 * one line, and it is usually mixed in among headed blocks. Pull those out
 * first or they get swallowed as prose by whichever block precedes them.
 *
 * Deliberately narrow: a name, then a dash separator, then a description. A
 * `Key: value` line is not a match, so field lines inside a block are safe.
 */
const BULLET_ENTRY = /^\s*[-*•]\s+(?!https?:)([^:\n|]{2,60}?)\s+[—–]\s+(.+)$/;

function extractBulletEntries(text: string): { items: ParsedOpportunity[]; rest: string } {
  const lines = text.split("\n");
  const items: ParsedOpportunity[] = [];
  const kept: string[] = [];

  for (const line of lines) {
    const match = line.match(BULLET_ENTRY);
    if (!match) {
      kept.push(line);
      continue;
    }

    const draft = blank();
    draft.companyName = clean(match[1]);
    draft.notes = clean(match[2].replace(/https?:\/\/[^\s)<>"']+/g, "").replace(/\s*[—–]\s*/g, " — ").trim());
    harvestLoose(draft, match[2]);

    const item = finish(draft, "medium");
    if (item) items.push(item);
    else kept.push(line);
  }

  return { items, rest: kept.join("\n") };
}

/* -------------------------------------------------------------------------- */
/*  Prose blocks — "### Acme Inc" followed by "Field: value" lines            */
/* -------------------------------------------------------------------------- */

function tryBlocks(text: string): ParsedOpportunity[] {
  const blocks = splitIntoBlocks(text);
  const items: ParsedOpportunity[] = [];

  for (const block of blocks) {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    if (!lines.length) continue;

    const draft = blank();
    const loose: string[] = [];
    let heading: string | null = null;
    let keyed = 0;

    for (const [index, line] of lines.entries()) {
      const headingMatch = line.match(/^#{1,6}\s+(.*)$/);
      if (headingMatch) {
        heading ??= clean(headingMatch[1]);
        continue;
      }

      const stripped = line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "");
      const pair = stripped.match(/^\*{0,2}([A-Za-z][A-Za-z \-/&']{1,34})\*{0,2}\s*[:：]\s*(.+)$/);

      if (pair && ALIASES[normaliseKey(pair[1])]) {
        assign(draft, pair[1], pair[2]);
        keyed += 1;
        continue;
      }

      if (index === 0 && !heading) {
        heading = clean(stripped.replace(/\s*[–—-]\s*.*$/, ""));
        const remainder = stripped.slice(heading.length).replace(/^\s*[–—-]\s*/, "");
        if (remainder) loose.push(clean(remainder));
        continue;
      }

      loose.push(clean(stripped));
    }

    if (heading && !draft.companyName) draft.companyName = heading;

    const description = loose.filter((line) => !isNarration(line));
    if (description.length) {
      const prose = description.join(" ");
      draft.notes = draft.notes ? `${draft.notes}\n${prose}` : prose;
      harvestLoose(draft, prose);
    }

    const item = finish(draft, keyed >= 2 ? "high" : keyed === 1 ? "medium" : "low");
    if (item) items.push(item);
  }

  return items;
}

function splitIntoBlocks(text: string): string[] {
  const normalised = text.replace(/\r\n/g, "\n");

  // Headings win: research output is usually one heading per company.
  if (/^#{1,6}\s+\S/m.test(normalised)) {
    return normalised
      .split(/\n(?=#{1,6}\s+\S)/)
      .map((block) => block.trim())
      .filter(Boolean);
  }

  // Then numbered entries: "1. Acme Inc".
  if (/^\s*\d+[.)]\s+\S/m.test(normalised)) {
    return normalised
      .split(/\n(?=\s*\d+[.)]\s+\S)/)
      .map((block) => block.trim())
      .filter(Boolean);
  }

  return normalised
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);
}

/* -------------------------------------------------------------------------- */
/*  Loose lines — last resort                                                 */
/* -------------------------------------------------------------------------- */

function tryLines(text: string): ParsedOpportunity[] {
  return text
    .split("\n")
    .map((line) => clean(line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "")))
    .filter((line) => line.length > 2)
    .map((line) => {
      const draft = blank();
      const parts = line.split(/\s+[–—|]\s+|\s+-\s+/).map(clean).filter(Boolean);
      draft.companyName = parts[0] ?? line;
      if (parts.length > 1) draft.notes = parts.slice(1).join(" — ");
      harvestLoose(draft, line);
      return finish(draft, "low");
    })
    .filter((item): item is ParsedOpportunity => item !== null);
}

/** Pulls URLs and emails out of free text that had no explicit field for them. */
function harvestLoose(draft: Draft, text: string) {
  const url = text.match(/https?:\/\/[^\s)<>"']+/);
  if (url) {
    const value = url[0].replace(/[.,;]$/, "");
    if (isApplicationLink(value)) draft.applicationUrl ??= value;
    else draft.website ??= value;
  }
  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  if (email) draft.contactEmail ??= email[0];
}

function isApplicationLink(url: string) {
  return /(job|career|apply|vacanc|position|greenhouse|lever\.co|workable|ashby|smartrecruiters|scholarship|grant|fund)/i.test(
    url,
  );
}

/* -------------------------------------------------------------------------- */
/*  Draft assembly                                                            */
/* -------------------------------------------------------------------------- */

type Draft = Partial<Record<Exclude<FieldKey, "documents">, string>> & {
  skills?: string;
  documents?: string[];
};

function blank(): Draft {
  return {};
}

function normaliseKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/^[*_\s]+|[*_\s:]+$/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * "Transcript Required?", "CV Required?", "Recommendation Letters Required" —
 * a whole column per document is how every scholarship tracker is laid out, and
 * the app already has a per-opportunity document checklist to receive them.
 */
const REQUIRED_COLUMN = /^(.*?)\s*required\??$/i;

/** A cell that means "yes, you need this" rather than "no" or "not applicable". */
function isAffirmative(value: string): boolean {
  return /^y(es)?\b/i.test(value.trim());
}

function assign(draft: Draft, rawKey: string, rawValue: string) {
  const value = clean(rawValue);
  if (!value || value === "-" || value.toLowerCase() === "n/a") return;

  const key = normaliseKey(rawKey);
  const field = ALIASES[key];

  /*
   * Document columns are matched by shape, not by an alias list, because the
   * exact wording differs in every tracker. Checked before the alias lookup so
   * "Work experience required?" becomes a checklist item rather than being
   * swallowed into eligibility.
   */
  const required = rawKey.match(REQUIRED_COLUMN);
  if (required && required[1].trim() && !ALIASES[normaliseKey(required[1])]) {
    if (!isAffirmative(value)) return;
    const label = clean(required[1]);
    // "Yes - 3" / "Yes (finalists)" carries a detail worth keeping on the item.
    const detail = value
      .replace(/^y(es)?\b[\s\-–—:,]*/i, "")
      .replace(/^\((.*)\)$/, "$1")
      .trim();
    draft.documents = [...(draft.documents ?? []), detail ? `${label} — ${detail}` : label];
    return;
  }

  if (!field) return;

  if (field === "documents") {
    const items = value.split(/[,;]/).map((part) => part.trim()).filter(Boolean);
    draft.documents = [...(draft.documents ?? []), ...items];
    return;
  }

  const existing = draft[field];

  if (LABELLED_MULTI.includes(field)) {
    // Keep the column name, or several merged columns read as noise.
    const label = CANONICAL_COLUMNS.has(key) ? null : clean(rawKey).replace(/\?$/, "");
    const piece = label ? `${label}: ${value}` : value;
    draft[field] = existing ? `${existing} · ${piece}` : piece;
    return;
  }

  if (!existing) {
    draft[field] = value;
  } else if (MULTI_VALUE.includes(field)) {
    draft[field] = `${existing}, ${value}`;
  }
}

function clean(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1 $2") // keep both halves of a markdown link
    .replace(/[*_`]/g, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Research output opens and closes with narration — "Here are the companies I
 * found…", "Let me know if you want more detail." Those are sentences, not
 * companies, and a name that reads like one is rejected rather than imported.
 */
/**
 * Headings that introduce commentary rather than an opportunity. Research
 * answers almost always close with a section like this — every discovery prompt
 * in research-prompts/ explicitly asks for one — and without this the heading
 * itself arrives as a company called "Weakest links".
 *
 * Applied only to weakly-structured guesses; an explicit table cell is trusted.
 */
const SECTION_HEADINGS = new Set([
  "weakest links", "notes", "note", "summary", "overview", "caveats", "caveat",
  "sources", "methodology", "method", "next steps", "recommendations", "recommendation",
  "excluded", "exclusions", "excluded near-misses", "near misses", "rejected",
  "checked and rejected", "rejected as unsafe", "rejected on budget",
  "could not verify", "openings i could not verify", "eligibility uncertain",
  "timing", "conclusion", "disclaimer", "assumptions", "limitations",
  "how i searched", "search notes", "further reading", "appendix", "key findings",
  "results", "opportunities", "companies", "leads", "table", "legend", "key",
]);

/**
 * The assistant's own voice, as opposed to a description of the company. Kept
 * to explicit openers so a real description ("Small publisher I admire…")
 * survives.
 */
function isNarration(line: string): boolean {
  return /^(here (are|is)|these are|below|let me know|hope (this|that)|i (can|could|will|'ll|'ve|have)|if you (want|would|'d)|note that|in summary|to summari[sz]e|would you like|shall i)\b/i.test(
    line.trim(),
  );
}

function looksLikeProse(name: string): boolean {
  if (/[.?!:;]$/.test(name)) return true;
  if (name.split(/\s+/).length > 5) return true;
  return /^(here|these|below|above|i |i'|the following|note|summary|overview|in summary|let me|hope|based on)\b/i.test(
    name,
  );
}

function finish(draft: Draft, confidence: ParsedOpportunity["confidence"]): ParsedOpportunity | null {
  const companyName = draft.companyName?.replace(/^[#\s]+/, "").trim();
  if (!companyName || companyName.length < 2) return null;
  if (/^(company|organisation|organization|name|title)$/i.test(companyName)) return null;

  // Only applied to weakly-structured guesses: an explicit `Company:` field or
  // a table cell is trusted even when it reads oddly.
  if (confidence !== "high") {
    if (SECTION_HEADINGS.has(companyName.toLowerCase().replace(/[:?]+$/, ""))) return null;
    if (looksLikeProse(companyName)) return null;

    /*
     * A guessed entry needs one piece of hard evidence — a link, an email, or a
     * real structured field. Free prose in `notes` does not count, because that
     * is exactly what a mis-split heading produces: the document's own title
     * "Speculative Cold-Outreach Targets for Jeremy" breaks on the hyphen into a
     * company called "Speculative Cold" with the remainder as notes, and gets
     * imported as a company that does not exist.
     *
     * Table cells are exempt (confidence "high"): a row someone deliberately
     * wrote is trusted even when sparse.
     */
    const CORROBORATING = [
      "website",
      "applicationUrl",
      "contactEmail",
      "contactName",
      "industry",
      "location",
      "companySize",
      "title",
      "salary",
      "deadline",
      "problemObserved",
      "proposedSolution",
      "whyInterested",
      "contribution",
      "buyerRole",
      "country",
      "degreeLevel",
      "fundingAmount",
      "eligibility",
    ] as const;

    if (!CORROBORATING.some((field) => Boolean(draft[field]))) return null;
  }

  const category = detectCategory(draft);

  // A URL sitting in `website` that is clearly a posting belongs in the
  // application link, and vice versa.
  let website = draft.website;
  let applicationUrl = draft.applicationUrl;
  if (website && !applicationUrl && isApplicationLink(website)) {
    applicationUrl = website;
    website = undefined;
  }

  return {
    category,
    companyName: companyName.slice(0, 120),
    title: draft.title,
    website,
    applicationUrl,
    industry: draft.industry,
    companySize: draft.companySize,
    location: draft.location,
    salary: draft.salary,
    workMode: detectWorkMode(draft),
    deadline: parseLooseDate(draft.deadline),
    notes: draft.notes,
    problemObserved: draft.problemObserved,
    proposedSolution: draft.proposedSolution,
    buyerRole: draft.buyerRole,
    whyInterested: draft.whyInterested,
    contribution: draft.contribution,
    country: draft.country,
    degreeLevel: draft.degreeLevel,
    fundingAmount: draft.fundingAmount,
    eligibility: draft.eligibility,
    requirements: draft.requirements,
    documents: draft.documents?.length ? draft.documents : undefined,
    skills: draft.skills
      ? draft.skills.split(/[,;/]/).map((s) => s.trim()).filter(Boolean)
      : undefined,
    contactName: draft.contactName,
    contactEmail: draft.contactEmail,
    confidence,
  };
}

function detectCategory(draft: Draft): Category {
  const explicit = draft.category?.toLowerCase() ?? "";
  if (/scholar|grant|fellow|bursar|funding|phd|masters/.test(explicit)) return "scholarship";
  if (/job|role|vacan|hiring|position|employ/.test(explicit)) return "job";
  if (/workflow|automat|ineffic|process|ops/.test(explicit)) return "workflow";
  if (/spec|cold|shot|outreach/.test(explicit)) return "speculative";

  const haystack = [
    draft.title,
    draft.notes,
    draft.problemObserved,
    draft.fundingAmount,
    draft.degreeLevel,
    draft.eligibility,
    draft.salary,
    draft.applicationUrl,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (draft.fundingAmount || draft.degreeLevel || /scholarship|fellowship|bursary|tuition|stipend|grant/.test(haystack))
    return "scholarship";
  if (draft.problemObserved || draft.proposedSolution || draft.buyerRole) return "workflow";
  if (draft.salary || /hiring|apply now|open role|vacancy|job description|full-?time|part-?time|contract role/.test(haystack))
    return "job";
  if (/manual|spreadsheet|invoice|repetitive|copy.?past|data entry|by hand|paper|legacy|disconnected/.test(haystack))
    return "workflow";

  return "speculative";
}

function detectWorkMode(draft: Draft): WorkMode | undefined {
  const haystack = `${draft.workMode ?? ""} ${draft.location ?? ""} ${draft.title ?? ""} ${draft.notes ?? ""}`.toLowerCase();
  if (/\bhybrid\b/.test(haystack)) return "hybrid";
  if (/\bremote\b|work from home|wfh|distributed/.test(haystack)) return "remote";
  if (/\bon-?site\b|\bin-?office\b/.test(haystack)) return "onsite";
  return undefined;
}

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/** Accepts ISO, "30 September 2026", "Sept 30, 2026" and "30/09/2026". */
export function parseLooseDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const text = value.trim().toLowerCase().replace(/(\d+)(st|nd|rd|th)/g, "$1");

  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso && isValidDay(iso[0])) return iso[0];

  const monthIndex = (name: string) =>
    MONTH_NAMES.findIndex((month) => month.startsWith(name.slice(0, 3)));

  const dmy = text.match(/(\d{1,2})\s+([a-z]{3,9})\.?,?\s+(\d{4})/);
  if (dmy) {
    const month = monthIndex(dmy[2]);
    if (month >= 0) return toDay(new Date(Number(dmy[3]), month, Number(dmy[1])));
  }

  const mdy = text.match(/([a-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})/);
  if (mdy) {
    const month = monthIndex(mdy[1]);
    if (month >= 0) return toDay(new Date(Number(mdy[3]), month, Number(mdy[2])));
  }

  // Ambiguous slash dates: assume day-first, the majority convention outside the US.
  const slash = text.match(/(\d{1,2})[/.](\d{1,2})[/.](\d{4})/);
  if (slash) {
    const day = Number(slash[1]);
    const month = Number(slash[2]);
    if (day <= 31 && month <= 12) return toDay(new Date(Number(slash[3]), month - 1, day));
  }

  return undefined;
}

function dedupe(items: ParsedOpportunity[]): ParsedOpportunity[] {
  const seen = new Map<string, ParsedOpportunity>();
  for (const item of items) {
    const key = `${item.companyName.toLowerCase()}::${(item.title ?? "").toLowerCase()}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, item);
      continue;
    }
    // Keep whichever draft carries more information.
    if (filled(item) > filled(existing)) seen.set(key, item);
  }
  return [...seen.values()].slice(0, 200);
}

function filled(item: ParsedOpportunity): number {
  return Object.values(item).filter((value) => value !== undefined && value !== "").length;
}
