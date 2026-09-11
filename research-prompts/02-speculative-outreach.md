# Discovery prompt — Speculative outreach

Paste everything below into Claude with Deep Research enabled.

---

You are helping me build a list of companies that are **not advertising a role**
but are worth contacting anyway. The output is a cold approach from one person
to another, so every row has to survive the question *"why are you writing to
me?"* with a specific answer.

<profile>
NAME: Jeremy
BASED IN: [city, country]
WORK ELIGIBILITY: [e.g. "UK citizen" / "needs sponsorship" / "remote contractor only"]
CAN BUILD: Next.js/React/TypeScript web apps, Python scrapers and data pipelines,
  workflow automation, LLM integrations (Gemini/Claude API), Postgres/Supabase,
  internal tools and dashboards, Figma-to-code
PROOF I CAN POINT TO: [2–3 links — portfolio, GitHub, a live project]
TIME AVAILABLE: [e.g. "20 hrs/week" / "full-time"]
TARGET MARKETS: [e.g. "UK + remote EU" / "Nigeria + remote US"]
INTERESTS / DOMAINS I ACTUALLY CARE ABOUT: [e.g. "logistics, events, fintech, dev tools"]
HARD CONSTRAINTS: [e.g. "remote only", "no agencies"]
</profile>

## What makes a good speculative target

Three things have to line up. Miss one and the email will not land.

**1. Reachability.** A named human whose decision it is, with a public route to
them. At 1–50 people that is usually the founder or a lead. Above ~150 the email
goes to a recruiting inbox and dies — cap the size accordingly.

**2. A specific opening.** Something I can point at in the first two sentences:
a slow site, a manual signup flow, a recently announced product they now have to
build, a job they posted then pulled, a public roadmap item.

**3. Plausible spend.** Recent funding, visible growth, paying customers, or an
obviously commercial product. Passion projects cannot hire.

## Where to look

- **Recently funded small companies** — pre-seed to Series A, funded in the last
  9 months. They have money and a deadline and almost never have enough hands.
  Sources: funding announcements, accelerator and incubator cohort pages
  (YC, Techstars, Entrepreneur First, local equivalents in my target market).
- **Product launch surfaces** — Product Hunt, Show HN, Indie Hackers, relevant
  subreddit "I built this" posts. A shipped product with a rough edge is an
  opening.
- **Companies that recently withdrew or paused a technical job ad.** They wanted
  the help and decided not to hire full-time. That is a contractor conversation.
- **Small agencies and studios** that are visibly at capacity — case studies
  stacking up, "currently booking for [next quarter]" on the site.
- **Companies in my stated interest domains** whose product I could speak about
  credibly.
- **Local business with disproportionate digital presence** — a company whose
  operations clearly outgrew its tooling.

## The specific-opening test

For every company, finish this sentence with something concrete and checkable:

> *"I noticed that ____, and I think I could ____."*

If the blank is "you're doing interesting work" or "you might need a developer",
the row does not qualify. It has to be an observation only someone who actually
looked would make. Examples that pass:

- "your signup flow emails a PDF that customers have to print and return"
- "your pricing page has been 'coming soon' since the Series A announcement"
- "your product listing pages take 9 seconds to load on mobile"
- "you launched the API in March but there's no documentation site yet"

Verify the observation is **currently true**. Do not report a problem from a
cached page or an old review.

## Explicitly exclude

- Companies actively advertising the role I would be pitching — those belong in
  the active-jobs list, not here.
- Anyone over ~150 employees.
- Companies whose only interesting quality is that they are well known.
- Dev-shop and outsourcing agencies who resell exactly what I do.
- Anywhere I cannot find a named human.

## Output format — follow exactly

Return **one markdown table**. A sentence before it is fine; nothing else.

Rules:
- One row per company. **No `|` characters inside any cell.**
- Leave a cell empty if unknown. Never "N/A", never a guess.
- `Category` is always the literal word `speculative`.
- `Why` is the specific opening — the observation, with what made it visible.
  Not adjectives about the company.
- `Contribution` is what I would actually do first, scoped small enough to be
  a real first engagement.
- `Contact` is a named person and their role. If you genuinely cannot find one,
  leave it empty rather than writing "the team".

| Company | Category | Title | Website | Industry | Size | Location | Why | Contribution | Contact | Contact email |
|---|---|---|---|---|---|---|---|---|---|---|
| Ambergris Studio | speculative | Case-study builder | ambergris.studio | Design agency | 1-10 | Remote | Every case study on their site is a hand-built one-off page and the newest is 7 months old, while their Dribbble shows work shipped in the last month. The bottleneck is publishing, not work. | A templated case-study builder so a new project page takes an hour instead of two days | Sofia Lindqvist, Founder | sofia@ambergris.studio |

Aim for **10–15 rows**, ordered by how strong the specific opening is. Return
fewer rather than padding.

After the table, add a short section titled `Openings I could not verify` for
any company you liked but where the observation could not be confirmed as
currently true.
