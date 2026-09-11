# Discovery prompt — Entry-level, support and research roles

Paste everything below into Claude with Deep Research enabled.

---

You are finding **currently open** entry-level, operations, support and research
roles I can apply to this week. This is a different market from engineering
roles: the listings are more scattered, the competition is higher, and the
category is heavily targeted by scams. Screening matters more than reach.

<profile>
NAME: Jeremy
BASED IN: [city, country]
WORK ELIGIBILITY: [e.g. "UK citizen" / "needs sponsorship" / "remote contractor only"]
CAN DO: data entry and cleaning, spreadsheet and Excel work, technical support,
  desk research and list building, QA and testing, content and CMS updates,
  customer operations, plus real technical skills (Python, SQL, web development)
  that most applicants for these roles will not have
PROOF I CAN POINT TO: [2–3 links — portfolio, GitHub, a live project]
TARGET MARKETS: [e.g. "UK + remote EU" / "Nigeria + remote US"]
PAY FLOOR: [e.g. "£12/hour" / "$800/month" / "no floor"]
HARD CONSTRAINTS: [e.g. "remote only", "part-time hours"]
</profile>

## Roles in scope

Data entry, data cleaning, data annotation, research assistant, list building,
operations assistant, operations coordinator, back-office administrator,
technical support (tier 1/2), IT helpdesk, customer support with a technical
product, QA tester, content/CMS assistant, virtual assistant with a technical
lean, order processing, claims handling, bookings administration.

**Prioritise roles where my technical skills are a genuine edge.** A data-entry
job at a company drowning in spreadsheets is a role I can do faster than the
other applicants, and it is also a foot in the door somewhere with an automation
problem. Flag those explicitly — they may be worth applying to *and* pitching.

## Where to search

- Company careers pages and ATS hosts (`workable`, `greenhouse`, `recruitee`,
  `teamtailor`, `bamboohr`) — the honest, live source
- National and local job boards for my target market
- Support-specific and remote-work boards
- University and research-institution vacancy pages for research-assistant work
- Council, NHS, charity and public-sector job portals — heavy on administrative
  roles, and they publish honest salary bands
- BPO and shared-service-centre careers pages for support roles

Open every posting and confirm it is live before including it.

## Scam screening — apply this to every single row

This category attracts fraudulent listings. **Exclude a listing outright** if
any of the following are true. Do not include it with a warning; just drop it.

- Any request for payment: training fees, equipment deposits, background-check
  fees, "starter kit".
- Asks for bank details, ID documents or National Insurance / SSN **before** a
  signed offer.
- Pay wildly above market for unskilled remote work (e.g. "$40/hour, data entry,
  no experience").
- Interview conducted only over Telegram, WhatsApp or Signal.
- A free email domain for a company that claims to be established.
- No verifiable company: no registered entity, no address, no LinkedIn presence,
  no traceable history.
- "Cheque processing", "payment forwarding", "package reshipping" — these are
  money-laundering and reshipping fraud, not jobs.

If a listing looks legitimate but you could not verify the company exists, leave
it out and mention it in the rejected section.

## Quality filtering

- **Posted within the last 30 days.**
- Real employer named. No blind agency listings.
- Compatible with my eligibility, location and hours constraints.
- Skip anything requiring a specific degree as a hard requirement if I do not
  hold one.
- Skip commission-only and "unpaid to start".
- Note whether pay is stated. An ad that hides the number for an entry-level
  role usually pays badly.

## Output format — follow exactly

Return **one markdown table**. A sentence before it is fine; nothing else.

Rules:
- One row per role. **No `|` characters inside any cell.**
- Leave a cell empty if unknown. Never "N/A", never a guess.
- `Category` is always the literal word `job`.
- `Job link` must be the **direct posting URL you opened**.
- `Work mode` is one of `remote`, `hybrid`, `onsite`.
- `Deadline` is `YYYY-MM-DD` if stated, otherwise empty.
- In `Notes`, state how the company was verified, and flag any row where my
  technical skills are an unusual edge or where the employer looks like a
  workflow-automation target too.

| Company | Category | Job title | Job link | Industry | Location | Work mode | Salary | Skills | Deadline | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| Fenwick Retail | job | Data Entry Specialist | fenwickretail.com/careers/data-entry-2026 | Retail | Nottingham UK | onsite | £23,500 | Excel, order processing, attention to detail | 2026-09-30 | Verified: Companies House registered, 340 staff on LinkedIn, careers page on own domain. Ad describes re-keying supplier orders from email into their ERP - also a workflow-pitch target. |

Aim for **15–20 rows**, ordered by fit. Return fewer rather than padding.

After the table, add two short sections:

- `Rejected as unsafe` — listings dropped by the scam screen, with which rule
  they broke. I want to recognise the pattern myself next time.
- `Could not verify` — listings that looked fine but where the employer could
  not be confirmed.
