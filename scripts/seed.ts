/**
 * Fills the command center with a realistic working pipeline so every screen
 * can be judged with data in it.
 *
 *   npm run seed          # add demo data to the existing account
 *   npm run seed -- --reset   # wipe this account's data first
 *
 * Requires an account: start the app, create one at /setup, then run this.
 */
import { eq } from "drizzle-orm";
import { closeDb, getDb } from "../lib/db";
import { assertNotRunning } from "./guard";
import {
  actions,
  activities,
  companies,
  contacts,
  opportunities,
  responses,
  users,
} from "../lib/db/schema";
import { addDays, today, toDay } from "../lib/domain/dates";
import { imageForOpportunity } from "../lib/domain/imagery";
import type { Category, Stage } from "../lib/domain/types";

type Seed = {
  company: {
    name: string;
    website?: string;
    industry?: string;
    size?: string;
    location?: string;
  };
  contact?: { name: string; role: string; email: string };
  opportunity: {
    category: Category;
    title: string;
    stage: Stage;
    notes?: string;
    applicationUrl?: string;
    problemObserved?: string;
    evidence?: string;
    currentProcess?: string;
    proposedSolution?: string;
    expectedValue?: string;
    outreachAngle?: string;
    buyerRole?: string;
    whyInterested?: string;
    contribution?: string;
    salary?: string;
    location?: string;
    workMode?: "remote" | "hybrid" | "onsite";
    skills?: string[];
    country?: string;
    degreeLevel?: string;
    fundingAmount?: string;
    eligibility?: string;
    documents?: { name: string; done: boolean }[];
    scores?: [number, number, number, number, number, number, number];
    /** Days ago the outreach went out. */
    sentDaysAgo?: number;
    followUpInDays?: number;
    deadlineInDays?: number;
    response?: { sentiment: "positive" | "neutral" | "negative"; summary: string; daysAgo: number };
    actions?: { type: string; title: string; dueInDays: number; done?: boolean }[];
  };
};

const SEEDS: Seed[] = [
  {
    company: {
      name: "Meridian Freight",
      website: "https://meridianfreight.example",
      industry: "Logistics",
      size: "51-200",
      location: "Manchester, UK",
    },
    contact: { name: "Priya Raman", role: "Head of Finance", email: "p.raman@meridianfreight.example" },
    opportunity: {
      category: "workflow",
      title: "Invoice intake automation",
      stage: "followup",
      problemObserved:
        "Finance re-keys roughly 400 supplier invoices a month from PDF email attachments into Sage, then chases mismatches by hand.",
      evidence:
        "Two open 'Accounts Payable Assistant (data entry)' ads on their careers page, plus a Glassdoor review describing 'endless invoice typing'.",
      currentProcess:
        "Invoice arrives by email → printed → keyed into Sage → filed in a shared drive → mismatches emailed back to the supplier.",
      proposedSolution:
        "Email intake → extraction to structured line items → three-way match against the PO → exceptions only in a review queue.",
      expectedValue: "~60 hrs/month of AP time, and fewer late-payment penalties",
      outreachAngle:
        "You are hiring a second AP assistant for a job that is 90% typing. Here is what that job looks like automated.",
      buyerRole: "Head of Finance",
      scores: [9, 10, 8, 9, 7, 8, 10],
      sentDaysAgo: 12,
      followUpInDays: -3,
      actions: [
        { type: "demo", title: "Build a 2-minute extraction demo on their public invoice format", dueInDays: -1 },
        { type: "research", title: "Confirm they run Sage 50 not Sage Intacct", dueInDays: -4, done: true },
      ],
    },
  },
  {
    company: {
      name: "Halcyon Property Group",
      website: "https://halcyonpg.example",
      industry: "Property management",
      size: "11-50",
      location: "Leeds, UK",
    },
    contact: { name: "Tom Whitfield", role: "Operations Manager", email: "tom@halcyonpg.example" },
    opportunity: {
      category: "workflow",
      title: "Maintenance work-order routing",
      stage: "sent",
      problemObserved:
        "Tenant maintenance requests arrive by phone, email and a web form, then get copied by hand into a spreadsheet and forwarded to contractors one at a time.",
      evidence: "Three tenant reviews complaining about week-long response times on simple repairs.",
      proposedSolution:
        "One intake queue, auto-triage by issue type and property, contractor dispatch with SLA timers.",
      expectedValue: "Turnaround from ~6 days to under 48 hours",
      buyerRole: "Operations Manager",
      scores: [8, 9, 9, 7, 6, 9, 9],
      sentDaysAgo: 4,
      followUpInDays: 1,
    },
  },
  {
    company: {
      name: "Verity Legal",
      website: "https://veritylegal.example",
      industry: "Legal services",
      size: "11-50",
      location: "Birmingham, UK",
    },
    opportunity: {
      category: "workflow",
      title: "Client onboarding document chase",
      stage: "qualified",
      problemObserved:
        "Paralegals email clients individually for ID documents and chase each one manually until the file is complete.",
      proposedSolution: "Self-serve upload portal with automated reminder cadence and a completeness checklist.",
      buyerRole: "Founder / CEO",
      scores: [7, 8, 7, 8, 5, 6, 9],
    },
  },
  {
    company: {
      name: "Northgate Dental",
      industry: "Healthcare",
      size: "11-50",
      location: "Sheffield, UK",
    },
    opportunity: {
      category: "workflow",
      title: "Appointment reminder + recall automation",
      stage: "researching",
      problemObserved:
        "Reception rings every patient the day before, and recalls are tracked on a paper diary.",
      buyerRole: "Office Manager",
      scores: [8, 10, 6, 8, 4, 7, 10],
    },
  },
  {
    company: {
      name: "Ambergris Studio",
      website: "https://ambergris.example",
      industry: "Design agency",
      size: "1-10",
      location: "Remote",
    },
    contact: { name: "Sofia Lindqvist", role: "Founder", email: "sofia@ambergris.example" },
    opportunity: {
      category: "speculative",
      title: "Front-end + automation help",
      stage: "response",
      whyInterested:
        "Small studio shipping genuinely good work, but their case-study pages are hand-built each time.",
      contribution:
        "A templated case-study builder so a new project page takes an hour instead of two days.",
      sentDaysAgo: 9,
      response: {
        sentiment: "positive",
        summary:
          "Sofia replied — interested, asked what a first project would cost and whether I could start in the new quarter.",
        daysAgo: 2,
      },
      actions: [{ type: "email", title: "Send scoped proposal with two pricing options", dueInDays: 0 }],
    },
  },
  {
    company: {
      name: "Kestrel Analytics",
      website: "https://kestrelanalytics.example",
      industry: "Data / SaaS",
      size: "11-50",
      location: "London, UK",
    },
    opportunity: {
      category: "speculative",
      title: "Speculative outreach — data pipeline help",
      stage: "sent",
      whyInterested: "Their public changelog shows a lot of manual data-loading work.",
      contribution: "Scraper + normalisation pipeline experience from the parking-arbitrage work.",
      sentDaysAgo: 6,
      followUpInDays: -1,
    },
  },
  {
    company: {
      name: "Tidewater Software",
      website: "https://tidewater.example",
      industry: "Software",
      size: "51-200",
      location: "Bristol, UK",
    },
    opportunity: {
      category: "job",
      title: "Junior Software Engineer",
      stage: "interview",
      applicationUrl: "https://tidewater.example/careers/junior-software-engineer",
      salary: "£38,000 – £46,000",
      location: "Bristol",
      workMode: "hybrid",
      skills: ["TypeScript", "React", "PostgreSQL", "AWS"],
      sentDaysAgo: 16,
      response: {
        sentiment: "positive",
        summary: "Recruiter screen booked for Thursday. Asked me to bring one project I built end to end.",
        daysAgo: 3,
      },
      actions: [{ type: "portfolio", title: "Write up the evidence-engine project as a one-pager", dueInDays: 1 }],
    },
  },
  {
    company: {
      name: "Bluepeak Systems",
      website: "https://bluepeak.example",
      industry: "Software",
      size: "201-500",
      location: "Remote (UK)",
    },
    opportunity: {
      category: "job",
      title: "Automation Engineer",
      stage: "sent",
      applicationUrl: "https://bluepeak.example/jobs/automation-engineer",
      salary: "£45,000 – £55,000",
      workMode: "remote",
      skills: ["Python", "Airflow", "SQL"],
      sentDaysAgo: 7,
      followUpInDays: 0,
    },
  },
  {
    company: {
      name: "Orchard Labs",
      industry: "Software",
      size: "1-10",
      location: "Remote",
    },
    opportunity: {
      category: "job",
      title: "Contract — internal tools build",
      stage: "ready",
      applicationUrl: "https://orchardlabs.example/contract-role",
      salary: "£350/day",
      workMode: "remote",
      skills: ["Next.js", "Internal tools"],
      deadlineInDays: 2,
    },
  },
  {
    company: {
      name: "Fenwick Retail",
      industry: "Retail",
      size: "201-500",
      location: "Nottingham, UK",
    },
    opportunity: {
      category: "job",
      title: "Data Entry Specialist",
      stage: "lost",
      applicationUrl: "https://fenwick.example/careers/data-entry",
      workMode: "onsite",
      sentDaysAgo: 24,
      response: {
        sentiment: "negative",
        summary: "Standard rejection — role filled internally.",
        daysAgo: 11,
      },
    },
  },
  {
    company: {
      name: "Chevening",
      website: "https://chevening.example",
      industry: "Government scholarship",
      location: "United Kingdom",
    },
    opportunity: {
      category: "scholarship",
      title: "Chevening Scholarship 2027",
      stage: "ready",
      applicationUrl: "https://chevening.example/apply",
      country: "United Kingdom",
      degreeLevel: "Master's",
      fundingAmount: "Full tuition, stipend and flights",
      eligibility: "Two years' work experience, an undergraduate degree, and a return commitment.",
      documents: [
        { name: "Two academic references", done: false },
        { name: "Degree transcript", done: true },
        { name: "Leadership essay", done: true },
        { name: "Networking essay", done: false },
      ],
      deadlineInDays: 9,
      actions: [{ type: "documents", title: "Chase second academic reference", dueInDays: 0 }],
    },
  },
  {
    company: {
      name: "Commonwealth Scholarship Commission",
      website: "https://cscuk.example",
      industry: "Scholarship",
      location: "United Kingdom",
    },
    opportunity: {
      category: "scholarship",
      title: "Commonwealth Master's Scholarship",
      stage: "researching",
      applicationUrl: "https://cscuk.example/apply",
      country: "United Kingdom",
      degreeLevel: "Master's",
      fundingAmount: "Full tuition + living allowance",
      deadlineInDays: 34,
    },
  },
  {
    company: { name: "Solaris Manufacturing", industry: "Manufacturing", size: "201-500", location: "Coventry, UK" },
    opportunity: {
      category: "workflow",
      title: "Production reporting automation",
      stage: "sourced",
      problemObserved:
        "Shift supervisors compile a daily output report in Excel by hand from three machine logs.",
      scores: [9, 10, 7, 8, 6, 5, 9],
    },
  },
  {
    company: { name: "Hartley & Vine", industry: "Recruitment", size: "11-50", location: "London, UK" },
    opportunity: {
      category: "workflow",
      title: "CV parsing and candidate matching",
      stage: "sourced",
      problemObserved: "Recruiters read and tag every inbound CV manually before it reaches the ATS.",
    },
  },
  {
    company: { name: "Camber Bikes", website: "https://camberbikes.example", industry: "E-commerce", size: "11-50" },
    opportunity: {
      category: "speculative",
      title: "Speculative outreach — storefront performance",
      stage: "sourced",
      whyInterested: "Great product, but the storefront takes nine seconds to load on mobile.",
    },
  },
  {
    company: { name: "Lattice Energy", industry: "Energy", size: "51-200", location: "Aberdeen, UK" },
    opportunity: {
      category: "workflow",
      title: "Compliance evidence collection",
      stage: "won",
      problemObserved: "Compliance team screenshots dashboards monthly into a Word document.",
      proposedSolution: "Scheduled evidence capture into a versioned audit pack.",
      buyerRole: "COO",
      scores: [8, 7, 9, 9, 8, 9, 9],
      sentDaysAgo: 40,
      response: {
        sentiment: "positive",
        summary: "Signed a scoped pilot for the audit-pack generator.",
        daysAgo: 20,
      },
    },
  },
];

/**
 * The embedded database is single-writer. If the dev server is up it already
 * holds the directory, and a second process would write into a copy that is
 * silently discarded — so refuse loudly instead.
 */
async function main() {
  const reset = process.argv.includes("--reset");
  await assertNotRunning("seeding now");
  const db = await getDb();

  const [owner] = await db.select().from(users).limit(1);
  if (!owner) {
    console.error(
      "No account found. Start the app (npm run dev), create your account at /setup, then run this again.",
    );
    process.exit(1);
  }

  if (reset) {
    // Foreign keys cascade from opportunities and companies, but be explicit.
    await db.delete(activities).where(eq(activities.userId, owner.id));
    await db.delete(responses).where(eq(responses.userId, owner.id));
    await db.delete(actions).where(eq(actions.userId, owner.id));
    await db.delete(contacts).where(eq(contacts.userId, owner.id));
    await db.delete(opportunities).where(eq(opportunities.userId, owner.id));
    await db.delete(companies).where(eq(companies.userId, owner.id));
    console.log("Cleared existing data for", owner.email);
  }

  const now = today();
  let created = 0;

  for (const seed of SEEDS) {
    const [company] = await db
      .insert(companies)
      .values({ userId: owner.id, ...seed.company, isMock: true })
      .returning({ id: companies.id });

    const o = seed.opportunity;
    const sentAt = o.sentDaysAgo !== undefined ? addDays(now, -o.sentDaysAgo) : null;

    const [row] = await db
      .insert(opportunities)
      .values({
        userId: owner.id,
        companyId: company.id,
        category: o.category,
        title: o.title,
        stage: o.stage,
        notes: o.notes ?? null,
        isMock: true,
        imageUrl: imageForOpportunity({
          category: o.category,
          title: o.title,
          industry: seed.company.industry,
          problem: o.problemObserved,
          skills: o.skills,
          notes: o.notes,
        }),
        applicationUrl: o.applicationUrl ?? null,
        problemObserved: o.problemObserved ?? null,
        evidence: o.evidence ?? null,
        currentProcess: o.currentProcess ?? null,
        proposedSolution: o.proposedSolution ?? null,
        expectedValue: o.expectedValue ?? null,
        outreachAngle: o.outreachAngle ?? null,
        buyerRole: o.buyerRole ?? null,
        whyInterested: o.whyInterested ?? null,
        contribution: o.contribution ?? null,
        salary: o.salary ?? null,
        location: o.location ?? null,
        workMode: o.workMode ?? null,
        skills: o.skills ?? [],
        country: o.country ?? null,
        degreeLevel: o.degreeLevel ?? null,
        fundingAmount: o.fundingAmount ?? null,
        eligibility: o.eligibility ?? null,
        documents: o.documents ?? [],
        deadline: o.deadlineInDays !== undefined ? addDays(now, o.deadlineInDays) : null,
        sentAt,
        appliedAt: o.category === "job" ? sentAt : null,
        emailStatus: sentAt ? (o.response ? "replied" : "sent") : "none",
        lastActionAt: sentAt,
        lastActionLabel: sentAt ? (o.category === "job" ? "Application submitted" : "Outreach sent") : null,
        nextFollowUpAt:
          o.followUpInDays !== undefined && !o.response ? addDays(now, o.followUpInDays) : null,
        followUpCount: o.followUpInDays !== undefined && o.followUpInDays < -2 ? 1 : 0,
        closedAt: o.stage === "won" || o.stage === "lost" ? addDays(now, -5) : null,
        scoreRepetition: o.scores?.[0] ?? null,
        scoreFrequency: o.scores?.[1] ?? null,
        scorePain: o.scores?.[2] ?? null,
        scoreAutomability: o.scores?.[3] ?? null,
        scoreFinancialValue: o.scores?.[4] ?? null,
        scoreDecisionMaker: o.scores?.[5] ?? null,
        scoreCapability: o.scores?.[6] ?? null,
        dataAccessible: o.scores ? true : null,
      })
      .returning({ id: opportunities.id });

    if (seed.contact) {
      await db.insert(contacts).values({
        userId: owner.id,
        companyId: company.id,
        opportunityId: row.id,
        ...seed.contact,
      });
    }

    for (const action of o.actions ?? []) {
      await db.insert(actions).values({
        userId: owner.id,
        opportunityId: row.id,
        type: action.type as never,
        title: action.title,
        status: action.done ? "done" : "todo",
        dueDate: addDays(now, action.dueInDays),
        completedDate: action.done ? addDays(now, action.dueInDays) : null,
      });
    }

    if (o.response) {
      await db.insert(responses).values({
        userId: owner.id,
        opportunityId: row.id,
        receivedAt: addDays(now, -o.response.daysAgo),
        sentiment: o.response.sentiment,
        channel: "Email",
        summary: o.response.summary,
      });
    }

    const timeline: { kind: string; message: string; daysAgo: number }[] = [
      { kind: "created", message: `Opportunity discovered — ${seed.company.name}`, daysAgo: (o.sentDaysAgo ?? 3) + 6 },
    ];
    if (o.scores) {
      timeline.push({ kind: "note", message: "Scored against the workflow finder", daysAgo: (o.sentDaysAgo ?? 3) + 3 });
    }
    if (sentAt) {
      timeline.push({
        kind: "outreach",
        message: o.category === "job" ? "Application submitted" : "Outreach sent",
        daysAgo: o.sentDaysAgo!,
      });
    }
    if (o.response) {
      timeline.push({
        kind: "response",
        message: `${o.response.sentiment === "positive" ? "Positive" : o.response.sentiment === "negative" ? "Negative" : "Neutral"} response received`,
        daysAgo: o.response.daysAgo,
      });
    }

    for (const entry of timeline) {
      const occurred = new Date();
      occurred.setDate(occurred.getDate() - entry.daysAgo);
      await db.insert(activities).values({
        userId: owner.id,
        opportunityId: row.id,
        companyId: company.id,
        kind: entry.kind as never,
        message: entry.message,
        occurredAt: occurred,
      });
    }

    created += 1;
  }

  console.log(`Seeded ${created} opportunities across ${SEEDS.length} companies for ${owner.email}.`);
  console.log(`Today is ${toDay(new Date())} — follow-ups and deadlines are relative to it.`);

  // Without this the buffered writes never reach disk.
  await closeDb();
  process.exit(0);
}

main().catch(async (error) => {
  console.error(error);
  await closeDb().catch(() => {});
  process.exit(1);
});
