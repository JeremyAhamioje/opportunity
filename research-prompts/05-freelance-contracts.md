# Discovery prompt — Freelance and contract work

Paste everything below into Claude with Deep Research enabled.

---

You are finding **paid contract, freelance and short-engagement work** I can
pitch for now. The failure mode in this market is not scarcity — it is drowning
in underpriced, oversubscribed listings. Filter hard for real budget and low
competition.

<profile>
NAME: Jeremy
BASED IN: [city, country]
WORK ELIGIBILITY: [e.g. "UK citizen" / "can invoice as a sole trader" / "remote contractor only"]
CAN BUILD: Next.js/React/TypeScript web apps, Python scrapers and data pipelines,
  workflow automation, LLM integrations (Gemini/Claude API), Postgres/Supabase,
  internal tools and dashboards, Figma-to-code, API integrations
PROOF I CAN POINT TO: [2–3 links — portfolio, GitHub, a live project]
CAPACITY: [e.g. "20 hrs/week, can start in 2 weeks"]
RATE TARGET: [e.g. "£250-350/day" / "$25-40/hour" / "£1.5-4k per project"]
TARGET MARKETS: [e.g. "UK + remote EU" / "remote US, USD preferred"]
HARD CONSTRAINTS: [e.g. "remote only", "no equity-only", "no agency subcontracting below rate"]
</profile>

## Engagement shapes I want

Ordered by preference:

1. **Scoped project work** — build this thing, here is the budget. Clean start
   and end, priced on outcome.
2. **Fixed-term contract** — 1–6 months, day rate, a specific deliverable.
3. **Retained maintenance** — ongoing hours on an existing system.
4. **Overflow work from agencies and studios** at capacity, if the rate holds.

Sweet spots given what I build: internal tools, dashboards, scraping and data
pipelines, workflow automation, LLM feature integration, marketing sites that
need real engineering, API integrations between systems that do not talk.

## Where to look

**Direct sources beat marketplaces.** A listing seen by 400 freelancers is worth
less than one seen by 4.

- Contract-specific boards and remote contract boards for my market
- Company careers pages filtered to contract/fixed-term
- Agency and studio "we're hiring freelancers / join our network" pages
- Community channels: relevant Slack and Discord workspaces, Indie Hackers,
  subreddit hiring threads, local tech community job channels
- Funded startups whose announcement mentions building something specific — a
  contract conversation before they have hired the team
- Companies that recently posted a permanent technical role in a market where
  they will struggle to fill it
- Public-sector and charity digital frameworks in my market, if open to small
  suppliers

## Budget qualification — the hard filter

Include a listing **only if** at least one is true:

- A budget or day rate is stated.
- The client type makes budget obvious (funded company, established business,
  agency subcontract, public body).
- There is a named commercial project with an evident deadline.

**Exclude** on sight:

- "Equity only", "revenue share", "profit share for now".
- "Great portfolio piece", "exposure", "ongoing work if this goes well" used in
  place of payment.
- Anything requiring free spec work or an unpaid trial build.
- Race-to-the-bottom marketplace listings — 50+ proposals, budget below my floor,
  or a brief that is three lines long.
- Contest and competition platforms where you build first and might get paid.
- Any listing requiring payment to bid or to access the client.

## Competition signals worth recording

Note these in `Notes` where visible — they drive whether it is worth the hour it
takes to write a proposal:

- number of applicants or proposals already submitted
- how long the listing has been open
- whether the client has hired before and what they paid
- whether the brief is specific (a real spec) or vague (a wish)
- whether you would be talking to the decision maker or a gatekeeper

## Output format — follow exactly

Return **one markdown table**. A sentence before it is fine; nothing else.

Rules:
- One row per opportunity. **No `|` characters inside any cell.**
- Leave a cell empty if unknown. Never "N/A", never a guess.
- `Category` is always the literal word `job`.
- `Job link` must be the **direct listing or contact URL you opened**.
- `Work mode` is one of `remote`, `hybrid`, `onsite`.
- `Rate` is the stated budget or rate, in the currency given. Leave empty if not
  stated — do not estimate.
- `Deadline` is `YYYY-MM-DD` for the application or bid deadline if stated.

| Company | Category | Job title | Job link | Industry | Location | Work mode | Rate | Skills | Deadline | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| Orchard Labs | job | Contract - internal tools build | orchardlabs.io/contract-role | Software | Remote | remote | £350/day | Next.js, PostgreSQL, internal tools | 2026-09-12 | 3-month initial term. Posted 4 days ago on their own site, not a marketplace. Spec is detailed - they know what they want. Contact is the CTO directly. |

Aim for **12–18 rows**, ordered by budget confidence and lowest competition
first. Return fewer rather than padding.

After the table, add a short section titled `Rejected on budget` listing
anything that matched the work but failed the budget filter, with the reason.
Seeing what the floor excludes tells me whether my rate target is realistic in
this market right now.
