# Opportunity Command Center

A personal opportunity CRM. Not a job tracker — a pipeline for **workflow
automation pitches, speculative shots, live roles and scholarships**, built
around one idea:

> Shoot as many high-quality shots as humanly possible, and never lose one to a
> forgotten follow-up.

Every screen answers **"what should I do next?"** rather than merely storing
what you typed.

```
FIND → QUALIFY → TAKE THE SHOT → TRACK → FOLLOW UP → MEASURE → REPEAT
```

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

The first visit lands on `/setup` to create the single owner account. Nothing
else is required — no database to install, no keys, no accounts.

To fill it with a realistic pipeline so the screens can be judged with data in
them:

```bash
# stop the dev server first — see "One writer at a time" below
npm run seed             # adds ~16 companies and opportunities
npm run seed -- --reset  # wipes this account's data first
```

Retire the demo data one niche at a time as real research replaces it:

```bash
npm run clear -- workflow            # just that category
npm run clear -- job scholarship     # several
npm run clear -- all                 # everything
npm run clear -- workflow --keep-companies
```

Companies left with no opportunities are removed too, unless you keep them.

Seeded rows carry an `is_mock` flag and show a dashed **MOCK** badge wherever
they appear, so demo data and real leads can share a screen without ever being
confused. `npm run clear -- mock` drops only the seeded rows and leaves real
ones untouched; add a category to narrow it further:

```bash
npm run clear -- workflow mock   # mock workflow rows only; real leads survive
```

## What's in it

| Screen | What it's for |
|---|---|
| **Dashboard** | Summary tiles, the follow-up desk, pipeline snapshot, and a single **Do this next** instruction chosen by what it would cost most to ignore. |
| **Today's Shots** | The daily execution screen. Follow-ups due 🔴, applications to submit 🟠, research to finish 🟡, new opportunities 🟢, plus configurable daily targets. |
| **Pipeline** | Ten-stage kanban. Drag to move, or use the stage menu on any card — drag is the fast path, never the only one. |
| **Opportunities** | Filterable table. Every filter lives in the URL, so any view is bookmarkable. |
| **Opportunity detail** | Outreach tracking, responses, actions, links, contacts, the 0–100 score, the SOP checklist, and a full activity timeline. |
| **Companies** | One record per organisation. A company can hold a workflow pitch, a speculative shot and an open role at once. |
| **Builds** | Brain-dump box, seven-column lane, and the check-in desk. Things you make, rather than shots you take. |
| **Ideas** | Everything recovered from your own AI conversations — filterable, with recurring and forgotten views. |
| **You said you would** | Explicit commitments, with the words that made them one. |
| **Conversations** | The raw captured record. Paste, upload, or send from the browser extension. |
| **Research Import** | Paste Deep Research output, review the drafts, import. |
| **Workflow Finder** | The editable SOP for spotting a company whose manual work you could delete. |
| **Analytics** | Which category of shot actually lands, measured against shots sent. |
| **Settings** | Daily goals, score weights, follow-up cadence, account. |

**Keyboard:** `⌘K` command palette · `N` add opportunity · `G` then
`D`/`T`/`P`/`O`/`C`/`B`/`E`/`Y`/`V`/`I`/`F`/`A` to jump · `Esc` closes.

## Two things worth understanding

### The database

`DATABASE_URL` unset → **PGlite**: real PostgreSQL compiled to WebAssembly,
running inside the Node process, storing ordinary Postgres data files in
`./.pglite/`. Not a toy and not "in code" — it is the same storage engine a
hosted Postgres runs, just embedded instead of served over a network.

`DATABASE_URL` set → **node-postgres** against a real server (Supabase, Neon,
RDS). Same schema, same queries, same migrations. Moving between them is one
environment variable; migrations apply themselves on the first request.

Back up the embedded database by copying the `.pglite` folder.

#### Moving to hosted Postgres

```bash
npm run migrate:postgres -- --dry-run   # counts every table, writes nothing
npm run migrate:postgres                # copies, then verifies counts match
```

One-way and additive: it reads `.pglite` and writes to `DATABASE_URL`, never the
reverse, and never touches the local copy — if the move goes wrong, unset
`DATABASE_URL` and everything is where it was. Re-running resumes rather than
duplicating.

Two traps on Supabase specifically, both of which fail in ways that look like a
wrong password:

- **Encode `$` in the password as `%24`.** Next's env loader expands `$VAR`, so a
  literal `$CBL` in the connection string silently resolves to nothing.
- **Port 5432 is the session pooler; 6543 is the transaction pooler.** Migrations
  need prepared statements and DDL, so they must run through 5432. Transaction
  mode is the better choice for serverless request traffic, but only once the
  schema is already in place.

**You must move to hosted Postgres before deploying.** Serverless hosts have no
persistent local disk, so PGlite cannot survive there.

#### One writer at a time

PGlite allows a **single process** to hold the data directory. Running
`npm run seed` while the dev server is up means the seed writes into a second
copy that is silently discarded — so the seed script refuses to run when it
detects the app on port 3000. Stop the server, seed, start it again. This
restriction disappears entirely once `DATABASE_URL` points at a real server.

The same buffering has a second edge: **force-killing the dev server can lose
writes it had not flushed yet**, so a setting you changed seconds before a
`taskkill /F` may be gone when it comes back. Scripts here call `closeDb()` for
exactly this reason. Read-only scripts (`preview:digest`) are safe to run
alongside the server; writing ones are not.

### Research Import is deliberately not "integrated"

Deep Research runs in the Claude apps. This dashboard does not pretend
otherwise, because pretending is how data gets lost.

The **built-in parser needs no key and no network.** It reads markdown tables,
JSON, and headed prose blocks — including all three mixed together in one paste,
which is what research output actually looks like — and skips the assistant's
own narration.

Setting `GEMINI_API_KEY` adds an **Extract with Gemini** button for prose too
unstructured for a parser ("their practice managers still ring round every
client the day before an appointment…"). It is an accelerator, never a
dependency: if the model is down, the error is shown and the built-in parser
runs anyway.

Nothing is written to the database until you review the drafts and press import.

**Discover turns a search into drafts.** With `SERPAPI_KEY` set, Research Import
gains a search box: it runs one Google query through SerpApi, keeps one row per
registrable domain, drops directories, job boards and social pages, and skips
anything already in the pipeline. What arrives is a company and a website —
never a contact, a size or a score, because search results do not contain those
and inventing them fills a pipeline with plausible fiction.

**Open roles** is the second mode, on Google Jobs. It drops reposting farms
(company names like "remote zest jobs", apply links on free hosting subdomains)
and any posting whose only link is a Google *search* rather than an application.
The apply link is ranked — the employer's own domain first, then a known ATS,
then an aggregator — because Google's `apply_options` sometimes attach an
unrelated listing, which is worse than an aggregator link since it looks
correct. Setting a location matters far more than putting "remote" in the query.

Both are *sources*, not subsystems: each returns the same `ParsedOpportunity[]`
the parser returns, so the review table, the dedupe, the company resolution and
the import writer are untouched. The second connector was almost entirely the
mapping from one API's shape to that contract. Each run spends one search
credit, so the result ceilings are low on purpose.

**Six deep-research prompts live in [`research-prompts/`](research-prompts/)** —
one per discovery motion (workflow inefficiency, speculative outreach, technical
roles, entry/support roles, freelance contracts, scholarships). Each returns a
table this parser reads directly. `npm run check:prompts` verifies every
prompt's columns still map onto real fields, so renaming one cannot silently
break a research run.

### Builds are a fifth category, not a second app

A **build** is something you make — a demo to carry an application, a side
project, a product. It is a category on the same table as everything else,
deliberately: the follow-up engine, search, analytics and the activity timeline
all worked for builds the day the category existed, with no parallel machinery
to keep in step.

Two things do differ, because a build has no counterparty:

- **The ten stages are relabelled**, not replaced — Idea, Scoping, Worth
  building, Ready to build, Building, Shipped, Dropped. The three outreach-only
  stages fold into Building, so a build can never land somewhere its lane cannot
  show it. Builds are excluded from the sales pipeline board and from the
  "which shots land?" analytics, where a permanently-zero `sent` count would
  drag every rate down.
- **Follow-up means "I looked at it"**, not "I chased them". The same button and
  the same dates; it just does not advance the stage or claim an email was sent.

**Capture is two steps: dump, then review.** The dump box asks for nothing — no
title, no fields — because anything it asks for is a reason not to write the
idea down at all. Gemini structures it afterwards into an editable form, never
straight into the database, so a bad reading costs one correction rather than a
wrong row you find a month later. With no key, or with Gemini down, the review
step still opens with the title taken from the first line and the dump preserved
verbatim; the idea is never the thing that gets lost. The raw dump is stored
alongside the structured fields and the edit form cannot rewrite it.

```bash
npm run add:build    # adds the opportunity.co build with its context
```

### Email reminders

The app can tell you what is overdue only while it is open. Setting
`RESEND_API_KEY` adds a daily digest that carries the same information out —
overdue follow-ups, anything due today, deadlines inside a week, and builds
waiting on you, led by the same **do this next** the dashboard computes. Every
number in it is counted from stored rows, so the mail cannot disagree with the
app. With the key unset nothing changes: reminders still work everywhere in the
UI, they just do not leave the building.

Turn it on in **Settings → Email reminders**, which also has a **Send now**
button that sends the real digest rather than a sample. `npm run preview:digest`
writes it to an HTML file and prints the text part, sending nothing.

**Scheduling is one endpoint, not an automation platform.** Point any scheduler
at it — Vercel Cron, a systemd timer, Windows Task Scheduler, `curl` in a loop:

```bash
curl -X POST https://your-app/api/cron/digest \
     -H "Authorization: Bearer $CRON_SECRET"
```

Authorization is a bearer token, because no browser is involved — and the route
is excluded from `proxy.ts` for the same reason. **It fails closed:** if
`CRON_SECRET` is unset the endpoint refuses everything, since an
unauthenticated route that sends mail is an open relay and a way to burn your
Resend quota. Sending is idempotent per day, so a scheduler that double-fires
cannot produce two digests, and `notifyOnlyWhenDue` (on by default) suppresses
the mail entirely on days with nothing due — a digest that always arrives is one
you stop opening.

**The sender is the thing that will trip you up.** Until a domain is verified in
the Resend dashboard, `onboarding@resend.dev` is the only usable sender *and it
can only deliver to the address that owns the Resend account* — anything else
comes back 403. Settings says so while that is the case, and the 403 is
translated rather than passed through. Verify a domain and set `EMAIL_FROM` to
send anywhere else.


### Idea archaeology: conversations in, work out

Hundreds of ideas, decisions and half-made promises are buried in old AI
conversations. This recovers them, and it is a **layer inside this app** rather
than a second product — the dashboard, follow-up engine, digest and pipeline
already existed, and two systems disagreeing about what you should do today
would be worse than none.

```
capture → store raw → extract → resolve → deduplicate → review → PROMOTE
                                                                    ↓
                                                        a build on the pipeline
```

**Raw is never rewritten.** `conversations` and `messages` are what you actually
said; everything the model concludes lives in `insights` and quotes the line it
came from. So "why does the system think I wanted this?" always has an answer,
and re-running extraction cannot corrupt the source.

**Promotion is the only bridge.** A recovered idea is not work until you press a
button, at which point it becomes a `build` and the existing machinery takes
over. That is why several hundred recovered ideas cannot flood the pipeline or
move a single existing count.

**Stance is not confidence.** `confidence` is how sure the extractor is that it
read the text correctly; `stance` is how firmly *you* said it — explicit,
proposed, discussed, or abandoned. Only explicit commitments reach *You said you
would*, because a high-confidence reading of an idle musing is still an idle
musing, and listing it as a promise is how this feature would turn into a
machine for feeling behind.

**Nothing merges silently.** An exact title match is the same insight; a near
match becomes a *suggested duplicate* you resolve with Merge / Keep separate.
Merging moves every mention across, so counts stay honest and no evidence is
lost.

Capture three ways — all the same pipeline:

```bash
npm run ingest -- chat.md --extract   # a file, extracted immediately
npm run ingest -- --extract-pending   # read everything queued
```

…the **Conversations** screen (paste or drop a file, including a platform
export), and the [browser extension](extension/) (Manifest V3, no build step —
`chrome://extensions` → Load unpacked). The extension reads only the
conversation rendered on a page you are already signed into, only when you click
Save. It never touches passwords, cookies or MFA, and authenticates to this app
with a revocable device token from **Settings → Browser capture** — not a
session cookie, so no page you happen to be visiting can write to your corpus.

Extraction is separate from capture on purpose: a model outage cannot cost you a
conversation you can no longer re-capture. Without `GEMINI_API_KEY` capture and
search still work in full; nothing is extracted.

[`docs/archaeology.md`](docs/archaeology.md) covers the schema and pipeline.

## Configuration

Everything is optional. Copy `.env.example` to `.env.local`.

| Variable | Effect |
|---|---|
| `DATABASE_URL` | Use a hosted Postgres instead of the embedded one. |
| `AUTH_SECRET` | Session signing key. Required in production; generated into `.auth-secret` locally. |
| `GEMINI_API_KEY` | Enables the optional AI extraction button on Research Import. |
| `GEMINI_MODEL_ID` | Which model that button uses. Defaults to `gemini-2.5-flash`. |
| `SERPAPI_KEY` | Adds **Discover** to Research Import: a search becomes draft companies. |
| `RESEND_API_KEY` | Enables the emailed reminder digest. Unset, the app is unchanged. |
| `EMAIL_FROM` | Sender address. Defaults to Resend's shared `onboarding@resend.dev`. |
| `CRON_SECRET` | Bearer token for `POST /api/cron/digest`. Unset means the route refuses everything. |
| `APP_URL` | Absolute base for links inside the email. Defaults to `http://localhost:3000`. |

## Stack

Next.js 16 (App Router, Server Actions) · React 19 · TypeScript · Tailwind v4 ·
PostgreSQL via Drizzle ORM · scrypt password hashing + JWT session cookies
(`jose`).

Authorization runs in `requireViewer()`, which every page, query and server
action funnels through — server actions are reachable by direct POST, so
checking in the layout alone would not be enough. `proxy.ts` is an optimistic
cookie check only.

```
app/(app)/          screens
components/         ui primitives, opportunity widgets, shell (palette, quick add)
lib/db/             drizzle schema + the two-driver client
lib/domain/         scoring, dates & urgency, the next-action rule, vocabulary
lib/queries/        every read
lib/actions/        every write (all re-check auth)
lib/parse/          research parser (no key) + Gemini extractor (optional)
lib/ingest/         conversation normalize → store → extract → resolve pipeline
lib/ai/             AIProvider seam; Gemini is the one implementation
extension/          Manifest V3 browser capture (no build step)
drizzle/            generated SQL migrations
```

```bash
npm run typecheck
npm run build
npm run db:generate   # after editing lib/db/schema.ts
npm run db:studio
npm run ingest -- <file> [--extract]   # capture a conversation from the CLI
```

## Design notes

Dark-only by intent, modelled on Notion's dark theme: `#191919` ground,
hairline dividers, text at 81%/44% white rather than flat grey, Inter, and one
blue for action. Colour is otherwise reserved for urgency so that red always
means *act now*: 🔴 overdue · 🟠 due today · 🟡 due soon · 🟢 scheduled.

**Two shells, one app.** At `lg` and up, the sidebar — nine destinations with
labels and badges permanently visible. Below `lg`, no sidebar: a pill nav where
only the active section is labelled, and a floating bottom bar carrying search
and add, the two things you do constantly.

Every opportunity gets a contextual Unsplash header image chosen from its own
text (a freight lead gets a truck, a React role gets code) and a country flag
beside its clickable domain. Purely decorative — but flags are served as images
rather than emoji, because Windows has no glyphs for them and renders 🇳🇬 as
the letters "NG".

Chart fills use a separate palette from the category badges, validated for the
dark surface (lightness band, chroma floor, colour-vision separation, contrast).
Every chart mark is also directly labelled, so identity never rests on colour
alone.

Daily goals are counted from real rows — outreach marked sent, follow-ups
logged, opportunities created — so a goal cannot be ticked without doing the
work.
