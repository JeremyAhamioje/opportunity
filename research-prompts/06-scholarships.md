# Discovery prompt — Scholarships and funded study

Paste everything below into Claude with Deep Research enabled.

---

You are finding **scholarships, fellowships and funded study opportunities I am
actually eligible for**, with deadlines I can still meet. Scholarship listings
age badly and aggregator sites are full of dead and fabricated entries, so
verification against the provider's own site is the whole job here.

<profile>
NAME: Jeremy
NATIONALITY / CITIZENSHIP: [required — eligibility turns on this]
CURRENTLY BASED IN: [city, country]
CURRENT LEVEL: [e.g. "final-year undergraduate", "completed bachelor's 2025", "self-taught, no degree"]
ACADEMIC RECORD: [e.g. "2:1 equivalent, GPA 3.4", "WAEC/JAMB results", "n/a"]
WANT TO STUDY: [e.g. "MSc Computer Science / Data Science / AI"]
TARGET COUNTRIES: [e.g. "UK, Netherlands, Germany, Canada" — or "anywhere, fully funded only"]
INTAKE: [e.g. "September 2027 entry"]
FUNDING NEEDED: [e.g. "fully funded only — tuition + living" / "tuition only is fine"]
WORK EXPERIENCE: [e.g. "2 years freelance software development"]
LANGUAGES: English [+ any others, with level]
CONSTRAINTS: [e.g. "cannot fund IELTS retakes", "must allow part-time work", "no bonded return requirement"]
</profile>

## What qualifies

Include an award **only if all four hold**:

1. **I am eligible.** Check nationality, degree level, discipline, age limits and
   any "must be resident in" or "must return home" conditions against the profile
   above. If eligibility is genuinely unclear, say so rather than assuming.
2. **The deadline has not passed**, and there is enough time to assemble the
   documents. Treat anything under 3 weeks away as urgent and mark it.
3. **The funding meets my stated need.** If I said fully funded only, a £2,000
   tuition discount does not qualify.
4. **It is verified on the provider's own website** — the university,
   government, foundation or trust. Not an aggregator, not a listicle, not a
   YouTube description.

## Where to look — and what to distrust

**Trust:** university scholarship and funding pages, government scheme sites
(e.g. national exchange and development scholarships), foundation and trust
sites, research council pages, embassy and cultural-institute pages, official
programme portals.

**Distrust and never cite as the source:** scholarship aggregator sites, "top 50
scholarships" blog posts, Telegram and WhatsApp forwards, YouTube video
descriptions, sites plastered in ads. These are useful only as a *lead* to then
verify on the provider's own domain. **The URL in the table must be the
provider's.**

Cover all of these routes, not just the famous ones:

- Government-funded international scholarships in each target country
- University-specific awards, including departmental and faculty-level ones,
  which are far less contested than the headline national schemes
- Funding tied to a specific research group or supervisor
- Foundations and private trusts, including ones tied to nationality, region,
  or field of study
- Employer, industry and professional-body sponsorship
- Scholarships specifically for applicants from my nationality or region — these
  usually have the best odds and the least competition

## Deadline discipline

- Dates as `YYYY-MM-DD`. If a provider gives a vague window ("applications open
  in autumn"), leave the deadline cell **empty** and put the wording in `Notes`.
  Never convert a vague statement into a specific date.
- If the current cycle has closed but the award recurs annually, you may include
  it **only** if you say so plainly in `Notes` and leave the deadline empty. A
  known future target is useful; a fabricated date is not.
- Note the date you verified the page, so I know how stale the row is.

## Also capture

Document requirements drive the actual work, so record them: references,
transcripts, personal statement, proposal, language test, proof of admission.
Note especially whether **an offer of admission is required first**, because
that changes the whole timeline.

## Explicitly exclude

- Awards I am plainly ineligible for on nationality or level.
- Anything charging an application fee to apply for funding.
- "Scholarships" that are loans, or discounts contingent on paying a deposit.
- Programmes whose provider site cannot be found at all.

## Output format — follow exactly

Return **one markdown table**. A sentence before it is fine; nothing else.

Rules:
- One row per award. **No `|` characters inside any cell.**
- Leave a cell empty if unknown. Never "N/A", never a guess.
- `Category` is always the literal word `scholarship`.
- `Organisation` is the awarding body.
- `Link` must be the **provider's own page that you opened**.
- `Deadline` is `YYYY-MM-DD` or empty. Never approximate.
- `Eligibility` states the conditions that matter for me specifically, not the
  full generic list.

| Organisation | Category | Title | Link | Country | Degree | Funding | Eligibility | Deadline | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Chevening | scholarship | Chevening Scholarship 2027 | chevening.org/apply | United Kingdom | Master's | Full tuition, monthly stipend, flights | Open to my nationality. Needs 2 years work experience and an undergraduate degree. Requires return to home country for 2 years after. | 2026-11-03 | Verified on chevening.org 2026-08-29. Admission offer not required at application. Documents: 2 references, transcript, 4 essays. Return requirement conflicts with staying on after study - check this matters. |

Aim for **12–18 rows**, ordered by a combination of how well I fit and how
winnable it looks — put less-contested departmental and nationality-specific
awards above the famous national schemes.

After the table, add two short sections:

- `Eligibility uncertain` — awards worth chasing where I need to confirm one
  specific condition, naming exactly what to check.
- `Timing` — a one-paragraph read on whether my stated intake is realistic given
  the deadlines found, and which applications would need to start first.
