"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Copy, FileText, Search, Sparkles, Upload, Wand2, X } from "lucide-react";
import { analyzePaste, importOpportunities, type AnalyzeResult } from "@/lib/actions/import";
import { discoverCompanies } from "@/lib/actions/discover";
import { CATEGORIES, CATEGORY_META, type Category } from "@/lib/domain/types";
import { Badge, Button, Input, Panel, PanelHeader, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import { cn } from "@/lib/utils";
import type { ParsedOpportunity } from "@/lib/parse/research";

export const RESEARCH_PROMPT = `Find 15 companies that match this profile: [describe the companies, roles, or scholarships you want].

For each one, output a markdown table row with exactly these columns:

| Company | Category | Title | Link | Industry | Location | Problem | Deadline | Contact | Notes |

Rules:
- Category must be one of: workflow, speculative, job, scholarship.
- Problem: for workflow rows, the specific manual or repetitive process you found evidence of, and where you saw the evidence.
- Deadline: YYYY-MM-DD, or leave blank.
- Only include companies you found real evidence for. No guesses.`;

type Draft = ParsedOpportunity & { _selected: boolean };

/** Which source produced the drafts currently under review. */
const ENGINE_LABEL: Record<NonNullable<AnalyzeResult["engine"]>, string> = {
  parser: "Built-in parser",
  ai: "Gemini",
  search: "Search",
};

const ENGINE_TONE: Record<NonNullable<AnalyzeResult["engine"]>, "neutral" | "accent" | "job"> = {
  parser: "neutral",
  ai: "accent",
  search: "job",
};

/** Drops the UI-only selection flag before the drafts go to the server. */
function strip(draft: Draft): ParsedOpportunity {
  const copy: Partial<Draft> = { ...draft };
  delete copy._selected;
  return copy as ParsedOpportunity;
}

/**
 * Research Import (brief §5). Deep Research runs in Claude; this turns what it
 * produced into records. The built-in parser needs no key and no network —
 * Claude extraction is an accelerator, never a dependency.
 */
/** Text formats worth accepting from disk. Anything else is a paste job. */
// `.tsv` because a table copied out of a spreadsheet or a rendered page is
// tab-separated. `.xlsx` is deliberately absent: it is a binary zip, and this
// upload reads files as text — save the sheet as CSV/TSV first.
const ACCEPTED =
  ".md,.markdown,.txt,.json,.csv,.tsv,text/markdown,text/plain,text/tab-separated-values,application/json";
const MAX_FILE_BYTES = 2_000_000;

export function ResearchImport({
  aiConfigured,
  discoverEnabled,
}: {
  aiConfigured: boolean;
  discoverEnabled: boolean;
}) {
  const [lastSource, setLastSource] = useState<"paste" | "search">("paste");
  const [mode, setMode] = useState<"companies" | "jobs">("companies");
  const router = useRouter();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [copied, setCopied] = useState(false);

  // The textarea is controlled so a dropped or picked file can fill it, and so
  // you can still edit what arrived before analysing it.
  const [raw, setRaw] = useState("");
  const [loadedFile, setLoadedFile] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const loadFile = async (file: File | undefined | null) => {
    if (!file) return;
    setFileError(null);

    if (file.size > MAX_FILE_BYTES) {
      setFileError(`${file.name} is ${(file.size / 1_000_000).toFixed(1)}MB — too large to read.`);
      return;
    }

    try {
      const text = await file.text();
      if (!text.trim()) {
        setFileError(`${file.name} is empty.`);
        return;
      }
      setRaw(text);
      setLoadedFile(`${file.name} · ${(file.size / 1024).toFixed(0)} KB`);
    } catch {
      setFileError(`Could not read ${file.name}.`);
    }
  };

  const [analysis, analyze] = useActionState<AnalyzeResult | null, FormData>(analyzePaste, null);
  const [discovery, runDiscover] = useActionState<AnalyzeResult | null, FormData>(
    discoverCompanies,
    null,
  );
  const [importState, runImport] = useActionState<
    { ok: boolean; created?: number; error?: string } | null,
    FormData
  >(importOpportunities, null);

  /*
   * The drafts start as whatever the analysis returned but stay editable, so
   * they are real state seeded from an action result — reconciled during
   * render rather than in an effect, which would cost an extra pass and make
   * the table flash the old rows first.
   *
   * Paste and search are two sources feeding one review table. Whichever
   * produced a result most recently owns the drafts, so running a search does
   * not silently append to a paste you were still reviewing.
   */
  const [seenAnalysis, setSeenAnalysis] = useState(analysis);
  if (analysis !== seenAnalysis) {
    setSeenAnalysis(analysis);
    setDrafts(analysis?.items?.map((item) => ({ ...item, _selected: true })) ?? []);
    setLastSource("paste");
  }

  const [seenDiscovery, setSeenDiscovery] = useState(discovery);
  if (discovery !== seenDiscovery) {
    setSeenDiscovery(discovery);
    setDrafts(discovery?.items?.map((item) => ({ ...item, _selected: true })) ?? []);
    setLastSource("search");
  }

  const result = lastSource === "search" ? discovery : analysis;

  const [seenImport, setSeenImport] = useState(importState);
  if (importState !== seenImport) {
    setSeenImport(importState);
    if (importState?.ok) setDrafts([]);
  }

  // Refreshing the router is external work, so it belongs in an effect.
  useEffect(() => {
    if (importState?.ok) router.refresh();
  }, [importState, router]);

  const selected = drafts.filter((draft) => draft._selected);

  const update = (index: number, patch: Partial<Draft>) =>
    setDrafts((current) =>
      current.map((draft, i) => (i === index ? { ...draft, ...patch } : draft)),
    );

  return (
    <div className="flex flex-col gap-4">
      {discoverEnabled ? (
        <Panel>
          <PanelHeader
            title="Discover"
            subtitle="Run a search and turn the results into draft companies. Same review step as a paste — nothing is written until you import."
          />
          <form action={runDiscover} className="px-4 py-3.5 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <Select
                name="mode"
                value={mode}
                onChange={(event) => setMode(event.target.value as typeof mode)}
                aria-label="What to search for"
                className="sm:w-[132px]"
              >
                <option value="companies">Companies</option>
                <option value="jobs">Open roles</option>
              </Select>
              <Input
                name="query"
                required
                autoComplete="off"
                placeholder={
                  mode === "jobs" ? "junior software engineer" : "property management companies Atlanta"
                }
                className="flex-1"
                aria-label="Search"
              />
              <SubmitButton pendingLabel="Searching…">
                <Search size={13} />
                Search
              </SubmitButton>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              {mode === "companies" ? (
                <>
                  <Select
                    name="category"
                    defaultValue="speculative"
                    aria-label="Category for discovered rows"
                    className="sm:w-[150px]"
                  >
                    {CATEGORIES.filter((value) => value !== "build").map((value) => (
                      <option key={value} value={value}>
                        {CATEGORY_META[value].short}
                      </option>
                    ))}
                  </Select>
                  <Input
                    name="country"
                    defaultValue="us"
                    maxLength={2}
                    aria-label="Search from country code"
                    title="Two-letter country code the search runs from — results differ by region"
                    className="sm:w-[72px] text-center uppercase"
                  />
                </>
              ) : (
                <>
                  <Input
                    name="location"
                    placeholder="Location — Nigeria, Remote, London…"
                    autoComplete="off"
                    aria-label="Location"
                    className="sm:w-[260px]"
                  />
                  <label className="inline-flex items-center gap-2 text-[12px] text-ink-muted select-none">
                    <input type="checkbox" name="remoteOnly" className="accent-accent" />
                    Only roles flagged remote
                  </label>
                </>
              )}
            </div>

            <p className="text-[11.5px] text-ink-faint leading-relaxed">
              {mode === "jobs" ? (
                <>
                  Reposting sites and postings with no real application link are dropped, and the
                  apply link prefers the employer&rsquo;s own board over an aggregator. Setting a
                  location matters more than putting &ldquo;remote&rdquo; in the query — and
                  &ldquo;only remote&rdquo; is strict, since Google flags far fewer roles that way
                  than describe themselves as remote.
                </>
              ) : (
                <>
                  Directories, job boards and social pages are filtered out, and anything already in
                  your pipeline is skipped. You get the company and its site — the qualifying is
                  still yours.
                </>
              )}
            </p>
          </form>
        </Panel>
      ) : null}

      <Panel>
        <PanelHeader
          title="Paste or upload Deep Research findings"
          subtitle="Paste the answer, drop a .md file onto the box, or pick one. Markdown tables, JSON and plain headed notes all work — nothing is saved until you review it."
          action={
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(RESEARCH_PROMPT);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 2000);
              }}
              className="text-[11.5px] text-ink-faint hover:text-ink transition-colors inline-flex items-center gap-1.5"
            >
              {copied ? <Check size={11} className="text-good" /> : <Copy size={11} />}
              {copied ? "Copied" : "Copy research prompt"}
            </button>
          }
        />
        <form action={analyze} className="px-4 py-3.5 flex flex-col gap-3">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              if (!dragging) setDragging(true);
            }}
            onDragLeave={(event) => {
              if (event.currentTarget.contains(event.relatedTarget as Node)) return;
              setDragging(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              void loadFile(event.dataTransfer.files?.[0]);
            }}
            className={cn(
              "relative rounded-md transition-colors",
              dragging && "ring-2 ring-accent ring-offset-2 ring-offset-surface",
            )}
          >
            <Textarea
              name="raw"
              rows={12}
              required
              placeholder={PLACEHOLDER}
              className="font-mono text-[11.5px] leading-relaxed"
              value={raw}
              onChange={(event) => {
                setRaw(event.target.value);
                if (loadedFile) setLoadedFile(null);
              }}
            />
            {dragging ? (
              <div className="absolute inset-0 grid place-items-center rounded-md bg-canvas/85 pointer-events-none">
                <span className="text-[12.5px] text-accent-hot flex items-center gap-2">
                  <Upload size={14} /> Drop the file to load it
                </span>
              </div>
            ) : null}
          </div>

          <input
            ref={fileInput}
            type="file"
            accept={ACCEPTED}
            className="sr-only"
            onChange={(event) => {
              void loadFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />

          {loadedFile ? (
            <p className="flex items-center gap-2 text-[11.5px] text-ink-muted">
              <FileText size={12} className="text-accent shrink-0" />
              Loaded <span className="text-ink">{loadedFile}</span>
              <button
                type="button"
                onClick={() => {
                  setRaw("");
                  setLoadedFile(null);
                }}
                className="text-ink-faint hover:text-ink transition-colors inline-flex items-center gap-1"
              >
                <X size={11} /> clear
              </button>
            </p>
          ) : null}

          {fileError ? (
            <p className="flex items-start gap-2 text-[12px] text-bad">
              <AlertCircle size={13} className="mt-px shrink-0" />
              {fileError}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => fileInput.current?.click()}>
              <Upload size={12} /> Upload file
            </Button>

            <SubmitButton name="engine" value="parser" pendingLabel="Reading…">
              <Wand2 size={12} /> Analyse & extract
            </SubmitButton>

            {aiConfigured ? (
              <SubmitButton
                name="engine"
                value="ai"
                variant="secondary"
                pendingLabel="Asking Gemini…"
              >
                <Sparkles size={12} /> Extract with Gemini
              </SubmitButton>
            ) : (
              <span className="text-[11.5px] text-ink-faint">
                Set <code className="text-ink-muted">GEMINI_API_KEY</code> to also offer AI
                extraction. The parser above needs nothing.
              </span>
            )}
          </div>

          {result && !result.ok ? (
            <p className="flex items-start gap-2 text-[12px] text-duesoon">
              <AlertCircle size={13} className="mt-px shrink-0" />
              {result.note}
            </p>
          ) : null}

          {/* A model outage must be visible, not silently swallowed by the
              fallback — otherwise the parser looks like it "just got worse". */}
          {result?.error ? (
            <p className="flex items-start gap-2 text-[11.5px] text-ink-faint">
              <AlertCircle size={12} className="mt-px shrink-0" />
              {result.error}
            </p>
          ) : null}
        </form>
      </Panel>

      {drafts.length > 0 ? (
        <Panel>
          <PanelHeader
            title="Review before importing"
            subtitle={`${result?.note ?? ""} Fix anything wrong here — these are drafts.`}
            action={
              <div className="flex items-center gap-2">
                <Badge tone={ENGINE_TONE[result?.engine ?? "parser"]}>
                  {ENGINE_LABEL[result?.engine ?? "parser"]}
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() =>
                    setDrafts((current) => {
                      const allOn = current.every((draft) => draft._selected);
                      return current.map((draft) => ({ ...draft, _selected: !allOn }));
                    })
                  }
                >
                  Toggle all
                </Button>
              </div>
            }
          />

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[760px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.11em] text-ink-faint bg-canvas/40">
                  <th className="font-semibold px-3 py-2 border-b border-line w-8"></th>
                  <th className="font-semibold px-3 py-2 border-b border-line">Company</th>
                  <th className="font-semibold px-3 py-2 border-b border-line">Title</th>
                  <th className="font-semibold px-3 py-2 border-b border-line w-[150px]">Category</th>
                  <th className="font-semibold px-3 py-2 border-b border-line">Detail</th>
                  <th className="font-semibold px-3 py-2 border-b border-line w-[70px]">Read</th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((draft, index) => (
                  <tr
                    key={index}
                    className={cn(
                      "border-b border-line/50 last:border-0 align-top",
                      !draft._selected && "opacity-40",
                    )}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={draft._selected}
                        onChange={(event) => update(index, { _selected: event.target.checked })}
                        aria-label={`Import ${draft.companyName}`}
                        className="size-[14px] accent-[var(--color-accent)] mt-1"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        value={draft.companyName}
                        onChange={(event) => update(index, { companyName: event.target.value })}
                        className="h-[26px] py-0 text-[12px]"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        value={draft.title ?? ""}
                        placeholder="Generated if blank"
                        onChange={(event) => update(index, { title: event.target.value })}
                        className="h-[26px] py-0 text-[12px]"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Select
                        value={draft.category}
                        onChange={(event) =>
                          update(index, { category: event.target.value as Category })
                        }
                        className="h-[26px] py-0 text-[12px]"
                      >
                        {CATEGORIES.map((value) => (
                          <option key={value} value={value}>
                            {CATEGORY_META[value].icon} {CATEGORY_META[value].short}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-3 py-2 max-w-[300px]">
                      <p className="text-[11.5px] text-ink-muted line-clamp-2 leading-snug">
                        {draft.problemObserved ?? draft.notes ?? draft.whyInterested ?? "—"}
                      </p>
                      <p className="text-[10.5px] text-ink-faint mt-1 truncate">
                        {[
                          draft.applicationUrl ?? draft.website,
                          draft.location,
                          draft.deadline,
                          draft.contactEmail,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "No links found"}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        tone={
                          draft.confidence === "high"
                            ? "good"
                            : draft.confidence === "medium"
                              ? "warn"
                              : "neutral"
                        }
                      >
                        {draft.confidence}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <form
            action={runImport}
            className="px-4 py-3 border-t border-line flex items-center justify-end gap-3 bg-canvas/40"
          >
            <input type="hidden" name="payload" value={JSON.stringify(selected.map(strip))} />
            {importState?.error ? (
              <span className="mr-auto text-[11.5px] text-bad">{importState.error}</span>
            ) : (
              <span className="mr-auto text-[11.5px] text-ink-faint">
                {selected.length} of {drafts.length} selected · imported to the Sourced column
              </span>
            )}
            <SubmitButton disabled={selected.length === 0} pendingLabel="Importing…">
              Import {selected.length || ""} {selected.length === 1 ? "opportunity" : "opportunities"}
            </SubmitButton>
          </form>
        </Panel>
      ) : null}

      {importState?.ok ? (
        <p className="flex items-center gap-2 text-[12.5px] text-good bg-[#0f2a20] border border-[#1b4534] rounded-md px-3 py-2.5">
          <Check size={14} />
          Imported {importState.created}{" "}
          {importState.created === 1 ? "opportunity" : "opportunities"}. They are in the Sourced
          stage, waiting to be qualified.
        </p>
      ) : null}
    </div>
  );
}

const PLACEHOLDER = `Paste anything. All three of these are understood:

| Company | Category | Title | Link | Problem |
|---|---|---|---|---|
| Acme Logistics | workflow | Invoice intake | acme.com | Re-keys ~400 invoices/month from email into Sage |

### Northwind Freight
Category: workflow
Problem: Dispatchers copy job details between two portals all day
Contact: ops@northwind.example

- Baker & Co — https://bakerco.example — small studio, might need automation help`;
