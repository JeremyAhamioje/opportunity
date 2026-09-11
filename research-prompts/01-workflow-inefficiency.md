# Discovery prompt — Workflow inefficiency

Paste everything below into Claude with Deep Research enabled.

---

You are a research analyst finding companies that are visibly paying humans to
do work a machine could do. I will contact these companies directly with a
specific, evidenced pitch, so a vague lead is worse than no lead.

<profile>
NAME: Jeremy
BASED IN: [city, country]
WORK ELIGIBILITY: [e.g. "UK citizen" / "needs sponsorship" / "remote contractor only"]
CAN BUILD: Next.js/React/TypeScript web apps, Python scrapers and data pipelines,
  workflow automation, LLM integrations (Gemini/Claude API), Postgres/Supabase,
  internal tools and dashboards, document/invoice extraction
PROOF I CAN POINT TO: [2–3 links — portfolio, GitHub, a live project]
TIME AVAILABLE: [e.g. "20 hrs/week" / "full-time"]
TARGET MARKETS: [e.g. "UK + remote EU" / "Nigeria + remote US"]
HARD CONSTRAINTS: [e.g. "remote only", "no enterprise procurement cycles"]
</profile>

## What I am looking for

A company where a **named, repetitive, high-frequency process** is being done by
hand, and where I can point to **public evidence** that it is happening. Not
"they could probably use AI" — an actual observable process.

Target company size: **10–200 employees**. Below 10 there is no budget and no
volume; above 200 you are selling into procurement, not to a person.

## Where the evidence actually lives

Search these surfaces in roughly this order. The first is worth more than all
the rest combined.

**1. Job ads are the strongest signal.** A company advertising for manual work
is telling you, in writing and under its own name, that it is paying a salary
for something repetitive. Look for openings like:

- "Data Entry Clerk", "Accounts Payable Assistant", "Order Processing Administrator"
- "Operations Coordinator" where the duties are copying between systems
- "Billing Administrator", "Claims Handler", "Bookings Administrator"
- "Research Assistant" where the task is compiling lists
- Any ad whose responsibilities include phrases like *"re-key"*, *"transfer data
  between"*, *"manually update"*, *"maintain the spreadsheet"*, *"chase by
  email"*, *"download reports and compile"*

Read the **responsibilities section**, not the title. The title is marketing;
the responsibilities are the process description.

Extra signal: the same manual role advertised **more than once in 12 months**,
or **two or more** of them open simultaneously. That is a company scaling a
problem by adding people.

**2. Review and complaint sites.** Trustpilot, Google reviews, G2, Capterra,
Glassdoor. Look for customers describing slow turnarounds, and employees
describing the tooling. Glassdoor reviews mentioning "outdated systems",
"everything is on spreadsheets", "we use three different systems" are direct
process intelligence.

**3. The company's own words.** About/process/how-it-works pages, service-level
promises ("we respond within 5 working days" is a queue), careers pages, case
studies, and any blog post describing how they operate.

**4. Public forums.** Industry subreddits, trade association forums, LinkedIn
posts by people at the company. Employees describe their day honestly in places
their marketing team does not read.

**5. Sector patterns worth mining.** Property management, logistics and freight,
insurance broking, recruitment agencies, accountancy and bookkeeping practices,
dental and veterinary groups, wholesale distribution, legal services,
construction subcontractors, NHS/public-sector suppliers, event and venue
management. These are spreadsheet-heavy, deadline-driven and under-tooled.

## The bar a company must clear

Include a company **only if all four are true**:

1. You can name the process in one sentence, in operational terms.
2. You have a **URL you actually opened** that evidences it.
3. You can estimate frequency (per day / per week / per month), even roughly, and
   say what the estimate is based on.
4. A person at the company plausibly owns the budget for fixing it, and you can
   name their role.

If you cannot meet the bar, leave the company out. **Twelve well-evidenced
companies beat forty guesses.** If only six qualify, return six.

## Explicitly exclude

- Enterprises over ~500 staff, and anything with a formal RFP process.
- Companies already selling automation or AI services — they build in-house.
- Anywhere the "inefficiency" is inferred purely from the industry rather than
  from a specific source.
- Any company where your only evidence is a vendor's marketing blog post about
  that industry.

## Before you write the table

For each company, satisfy yourself on these, and let the answers shape the
Problem cell:

- What is the input, what is the output, and what is the human doing between them?
- How many times does that happen?
- What does it cost them when it is slow or wrong?
- Is the data machine-reachable (email, portal, file) or trapped (phone, paper)?
- Who feels the pain financially — founder, COO, ops manager, head of finance?

## Output format — follow exactly

Return **one markdown table**. A sentence before it is fine; nothing else.

Rules:
- One row per company. **No `|` characters inside any cell.**
- Leave a cell empty if you do not know. Never write "N/A" and never guess.
- `Category` is always the literal word `workflow`.
- `Problem` must contain the process **and** the evidence for it, including
  where you saw it. This single cell is the whole pitch — write it properly.
- `Website` is the company's own domain. Put the URL that evidenced the problem
  inside the `Problem` cell.

| Company | Category | Title | Website | Industry | Size | Location | Problem | Solution | Decision maker | Contact email |
|---|---|---|---|---|---|---|---|---|---|---|
| Meridian Freight | workflow | Invoice intake automation | meridianfreight.co.uk | Logistics | 51-200 | Manchester UK | Finance re-keys roughly 400 supplier invoices a month from PDF email attachments into Sage, then chases mismatches by hand. Evidence: two open "Accounts Payable Assistant (data entry)" ads on their careers page since March, plus a Glassdoor review describing "endless invoice typing". | Email intake, extraction to structured line items, three-way match against the PO, exceptions only in a review queue | Head of Finance | ap@meridianfreight.co.uk |

Aim for **10–15 rows**, ordered strongest evidence first. Return fewer rather
than padding.

After the table, add a short section titled `Weakest links` listing any row you
are least confident about and exactly what you could not verify. I would rather
know than find out after sending the email.
