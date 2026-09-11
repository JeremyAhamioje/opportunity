# Discovery prompt — Active technical roles

Paste everything below into Claude with Deep Research enabled.

---

You are finding **currently open** technical roles I can apply to this week. A
dead link or a filled role costs me more than a missing one, so freshness and
verification matter more than volume.

<profile>
NAME: Jeremy
BASED IN: [city, country]
WORK ELIGIBILITY: [e.g. "UK citizen" / "needs sponsorship" / "remote contractor only"]
CAN BUILD: Next.js/React/TypeScript web apps, Python scrapers and data pipelines,
  workflow automation, LLM integrations (Gemini/Claude API), Postgres/Supabase,
  internal tools and dashboards, Figma-to-code
EXPERIENCE LEVEL: [e.g. "self-taught, 2 years of shipped personal projects, no commercial role yet"]
PROOF I CAN POINT TO: [2–3 links — portfolio, GitHub, a live project]
TARGET MARKETS: [e.g. "UK + remote EU" / "Nigeria + remote US"]
SALARY FLOOR: [e.g. "£30k" / "$2k/month" / "no floor, prioritising first role"]
HARD CONSTRAINTS: [e.g. "remote only", "no on-site outside London"]
</profile>

## Roles in scope

Junior to mid, in any of: software engineering, web development, frontend,
full-stack, automation engineering, AI/LLM engineering, data engineering,
integrations, internal tools, solutions engineering, technical implementation.

Titles vary wildly for the same job. Search the **requirements**, not the title —
a "Business Systems Analyst" asking for Python and API work is my role, and a
"Software Engineer" requiring 8 years of Kubernetes is not.

## Where to search — go to the source

Aggregators are full of expired and duplicated listings. Prefer the **applicant
tracking systems**, where the posting is the company's own live record:

- `boards.greenhouse.io`, `jobs.lever.co`, `jobs.ashbyhq.com`,
  `apply.workable.com`, `*.recruitee.com`, `*.teamtailor.com`,
  `careers.smartrecruiters.com`, `*.bamboohr.com/careers`
- Company careers pages directly
- Remote-first boards where listings are curated rather than scraped
- Local/national boards specific to my target market
- Hiring threads in relevant communities (e.g. monthly "who is hiring" posts)

For every role, **open the actual posting** and confirm it is live. If it 404s,
redirects to a generic careers index, or says "no longer accepting
applications", drop it.

## Freshness and filtering

- **Posted within the last 30 days.** Prefer under 14. Note the posting date if
  it is shown.
- Must be compatible with my work eligibility and location constraints. A role
  requiring on-site presence somewhere I cannot be is not a lead.
- Skip anything demanding a specific degree if I do not hold one **and** the ad
  makes it a hard requirement rather than a preference.
- Skip senior/staff/principal/lead roles, and anything asking for 5+ years.
- Skip listings with no named company ("Confidential client").

## Junior-friendly signals worth noticing

Flag these in `Notes` when present — they change how I prioritise:

- "no degree required", "we hire on portfolio", "bootcamp graduates welcome"
- a take-home or work-sample stage instead of a leetcode screen
- a small team (an ad written by the person you'd work for reads differently)
- explicit mention of mentorship, pairing, or a structured onboarding
- salary published (a company that publishes the number wastes less of my time)

Equally, flag warnings: unpaid "trial projects", equity-only compensation,
vague "competitive salary" with a 6-stage interview loop.

## Explicitly exclude

- Recruitment agency listings that do not name the employer.
- Roles reposted continuously for months — that is a pipeline, not a vacancy.
- "Unpaid internship" and "commission only".
- Anything where the application requires paying a fee. That is a scam without
  exception.

## Output format — follow exactly

Return **one markdown table**. A sentence before it is fine; nothing else.

Rules:
- One row per role. **No `|` characters inside any cell.**
- Leave a cell empty if unknown. Never "N/A", never a guess.
- `Category` is always the literal word `job`.
- `Job link` must be the **direct posting URL you opened**, not a search page.
- `Work mode` is one of `remote`, `hybrid`, `onsite`.
- `Deadline` is `YYYY-MM-DD` if the ad states a closing date, otherwise empty.
  Do not invent one.
- `Skills` is a short comma-separated list from the ad itself.

| Company | Category | Job title | Job link | Industry | Location | Work mode | Salary | Skills | Deadline | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| Tidewater Software | job | Junior Software Engineer | boards.greenhouse.io/tidewater/jobs/4821 | Software | Bristol UK | hybrid | £38,000 - £46,000 | TypeScript, React, PostgreSQL, AWS | | Posted 6 days ago. Explicitly says portfolio over degree, take-home instead of live coding. Team of 9. |

Aim for **15–20 rows**, ordered by fit and freshness. Return fewer rather than
padding with roles I am not eligible for.

After the table, add a short section titled `Checked and rejected` naming any
role that looked right but failed verification, with the reason — expired,
agency-listed, ineligible. It stops me re-finding the same dead ends next week.
