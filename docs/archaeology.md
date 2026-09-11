# Idea Archaeology — architecture

Recovers ideas, commitments and decisions buried in AI conversations and turns
them into things that actually get executed. It is a layer **inside** the
Opportunity Command Center, not a second app.

## Why it is a layer and not a new product

Roughly half of the brief's P0 already exists here: authentication, a dashboard
whose whole job is answering "what should I do next?", a task layer, a
follow-up/reminder engine, emailed digests via Resend, Gemini structured
extraction with strict schemas, and the Linear/Notion UI. Rebuilding those
alongside would give two systems that disagree about what you should do today.

So the archaeology layer **feeds the existing spine** rather than duplicating it.

## The two halves

```
   RAW                                DERIVED
   conversations ── messages          insights ── mentions ── links
        │                                 │
        │  never rewritten                │  AI-proposed, user-owned
        │                                 │
        └────────── provenance ───────────┘
                          │
                    PROMOTION
                          ↓
              the existing spine
        opportunities (build) · actions
```

**Raw is never rewritten.** `conversations` and `messages` are what you actually
said. Everything the model concludes lives in `insights`, and every insight
points back at the message it came from. That is what makes "why does the system
think I wanted this?" answerable (§26), and it is why re-running extraction can
never corrupt the source.

**Promotion is the only bridge.** An idea does not become work until you say so.
Promoting writes a `build` opportunity into the existing table, and from that
moment the pipeline, follow-up desk, Today view, digest and analytics treat it
like anything else — no parallel machinery. 482 recovered ideas therefore cannot
flood the pipeline or distort a single existing count.

## Entity model

One `insights` table with a `kind` discriminator, not eight tables. This matches
how `opportunities` already holds four very different categories, and means
every view — recurring, forgotten, commitments, decisions — is a filter rather
than a new subsystem.

| Brief's type | Where it lives |
|---|---|
| Idea, Goal, Decision, Problem, Commitment | `insights` (by `kind`) |
| Project | promoted → `opportunities`, category `build` |
| Task | promoted → `actions` |
| Job / lead / scholarship | promoted → `opportunities` |

### Tables

- **`conversations`** — one per captured chat. `(userId, source, sourceConversationId)`
  is unique, so re-syncing the same chat updates it instead of duplicating.
- **`messages`** — raw turns, ordered. Kept separate from derived data (§28).
- **`insights`** — the recovered thing. Carries `stance`, `confidence`,
  `status`, `mentionCount`, `firstSeenAt`/`lastSeenAt`.
- **`insight_mentions`** — provenance. One row per time an insight appeared,
  with the excerpt and a `movement` (introduced / developed / decided /
  reversed / abandoned / revived). Mention count and the evolution timeline are
  both derived from these rows, never estimated.
- **`insight_links`** — `relates_to`, `evolves_into`, `depends_on`, `part_of`,
  `duplicate_of`. Suggested links stay `suggested` until confirmed.

### Stance is not confidence

Two different things, and collapsing them is how a brainstorm becomes a to-do
list (§10):

- **`confidence`** — how sure the extractor is that it read the text correctly.
- **`stance`** — how firmly *you* expressed it: `explicit` ("I'm going to build
  this"), `proposed` ("maybe I should"), `discussed` ("could this work?"),
  `abandoned` ("not pursuing this").

Only `explicit` commitments reach "You said you would". A high-confidence
reading of an idle musing is still an idle musing.

## Ingestion pipeline

```
POST /api/ingest  (device token)          Paste / upload
        └───────────────┬───────────────────────┘
                        ↓
                   normalize          → one Conversation shape, whatever the source
                        ↓
              store raw + messages     → returns immediately
                        ↓
                   [ queued ]          → status: pending
                        ↓
                    chunk              → long chats split on message boundaries
                        ↓
              extract (AIProvider)     → strict JSON schema, per chunk
                        ↓
                   resolve             → exact key match → same insight
                        ↓
                  deduplicate          → near match → suggested duplicate_of link
                        ↓
              mentions + links         → provenance written
                        ↓
                   status: done
```

Extraction never happens inside the request that receives the conversation. The
POST stores and returns; a separate call drains the queue. On this single-user
deployment "the queue" is a table scan of `status = 'pending'` — a real job
runner is a swap of one function, not a redesign.

**Failure is recorded, not swallowed.** A conversation whose extraction fails
keeps its raw messages and gets `status = 'failed'` plus the error, so it can be
retried. Raw capture succeeding is independent of the model behaving.

## Deduplication

The same idea appears dozens of times under different names (§11).

1. **Normalized key** — lowercased, stop-worded, sorted title. An exact match is
   the same insight: a new mention, not a new row.
2. **Near match** — token overlap above a threshold creates a `duplicate_of`
   link with status `suggested`.
3. **Never silently merge.** Suggestions surface in a review queue offering
   Merge / Keep separate / Ignore. Merging moves every mention onto the survivor,
   so the count stays honest and nothing loses its provenance.

Semantic (embedding) similarity is the obvious upgrade and slots in at step 2.
Token overlap is used first because it needs no vector store and no API call.

## Capture

**Browser companion, user-initiated.** Manifest V3, TypeScript, adapter per
source. It reads the conversation already rendered in the page you are signed
into and sends it when you click Save.

It never asks for a password, never reads cookies, never touches MFA, and never
bypasses authentication (§29). Authentication to *this* app is a device token
you generate in Settings and paste into the extension — not a session cookie, so
nothing is riding on cross-origin credentials.

`ConversationSource` is an interface with `detect()` and `extract()`. ChatGPT is
the only adapter in V1; Claude and Gemini are new files, and an official
API/OAuth integration replaces the adapter without touching the backend.

**Paste/upload exists too**, and is not a fallback — it is how the pipeline is
testable with no browser involved, and how a ChatGPT data export gets in.

## AI provider

`AIProvider` is an interface. Gemini is the only implementation, because a key
is already configured and it already backs Research Import and build
structuring. A second provider is a new file behind the same interface.

Extraction degrades the same way everything else here does: with no key, capture
and provenance still work in full and nothing is extracted, rather than the
feature disappearing.

## What V1 does not do

Deliberately, per §36: no billing, teams, multi-tenancy, mobile app, marketplace,
or compliance apparatus. Deliberately deferred from P1/P2: semantic/vector
search, the natural-language query interface, the literal graph view, the
cross-project analytics suite, and push channels beyond the existing email
digest.
