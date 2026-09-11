# Discovery prompts

Six deep-research prompts, one per discovery motion. Each is written to be
pasted into **Claude Deep Research** (claude.ai — not Claude Code), and each
returns a markdown table that **Research Import** in this app parses directly.

| File | Motion | Lands as |
|---|---|---|
| [`01-workflow-inefficiency.md`](01-workflow-inefficiency.md) | Companies visibly paying humans to do machine work | `workflow` |
| [`02-speculative-outreach.md`](02-speculative-outreach.md) | Companies not hiring that you'd contact anyway | `speculative` |
| [`03-active-jobs-technical.md`](03-active-jobs-technical.md) | Open engineering / web / automation / AI roles | `job` |
| [`04-active-jobs-entry-support.md`](04-active-jobs-entry-support.md) | Data entry, support, research, ops coordination | `job` |
| [`05-freelance-contracts.md`](05-freelance-contracts.md) | Contract, freelance and short-engagement work | `job` |
| [`06-scholarships.md`](06-scholarships.md) | Scholarships, fellowships, funded study | `scholarship` |

Four categories exist in the app; six motions map onto them because *how you
find* a contract gig has nothing in common with how you find a scholarship, even
though both end up as records you chase.

## How to use one

1. **Fill in the `<profile>` block once.** It is identical in all six files —
   fill it in one, then copy it into the others. Everything else is tuned per
   motion and should not need editing.
2. Paste the whole prompt into Claude with Deep Research (or extended search)
   turned on.
3. Copy Claude's **entire** answer. Don't tidy it — preamble and trailing
   commentary are stripped automatically.
4. In this app: **Research Import** → paste → **Analyse & extract**.
5. Review every row, untick the weak ones, **Import**. Rows land in `Sourced`.
6. Work them from **Today's Shots**. Workflow rows go through the
   **Workflow Finder** checklist and get scored before you write anything.

`Extract with Gemini` is there for answers that come back as prose instead of a
table. The built-in parser needs no key and handles the table format below.

## The format contract

Every prompt ends by demanding one markdown table. The column headers are not
decorative — the parser maps them onto real fields, so **renaming a column
silently drops that data**.

Rules baked into each prompt, repeated here so you can spot a bad answer:

- One row per opportunity. No merged cells, no nested tables.
- **No `|` characters inside a cell** — it breaks the row.
- Empty cell for unknown. Never "N/A", never a guess.
- Every row carries a real URL that was actually opened.
- `Category` is a literal value: `workflow`, `speculative`, `job`, or
  `scholarship`. Because it is explicit, you can paste several answers into one
  import if you want.

If a prompt returns fewer rows than you asked for, that is the prompt working as
intended — each one forbids padding the list to hit a number.

## Tuning

- **Too few results?** Widen `TARGET MARKETS` or drop a hard constraint in the
  profile, not the evidence bar. A longer list of unqualified companies is worth
  less than five real ones.
- **Results too generic?** The brief-level lesson from the evidence engine
  applies: untargeted queries return vendor SEO. Add named sources — specific
  job boards, specific subreddits, specific ATS hosts — to the search-surface
  section of the prompt.
- **Rows keep arriving unscored?** That is correct. Scoring is yours; the
  research only supplies the evidence you score against.
