import { getCommitments } from "@/lib/queries/insights";
import { getBuilds } from "@/lib/queries/builds";
import { getFollowUps, getSummary, getUpcomingDeadlines } from "@/lib/queries/opportunities";
import { daysBetween, formatDay, formatLongDay, today } from "@/lib/domain/dates";
import { nextAction } from "@/lib/domain/next-action";
import { getStageCounts } from "@/lib/queries/opportunities";
import { CATEGORY_META, type ScoringWeights } from "@/lib/domain/types";
import { plural } from "@/lib/utils";

/**
 * The daily reminder digest.
 *
 * Built from the same queries the dashboard uses, so the mail can never
 * disagree with the app — the counts are stored rows either way. It carries the
 * one instruction from `nextAction()` at the top for the same reason the
 * dashboard does: a list of everything answers nothing.
 */

export type Digest = {
  subject: string;
  html: string;
  text: string;
  /** Nothing is due. Callers may choose not to send at all. */
  empty: boolean;
  counts: {
    overdue: number;
    dueToday: number;
    deadlines: number;
    builds: number;
    commitments: number;
  };
};

type Item = { title: string; meta: string; urgent: boolean };

export async function buildDigest(
  userId: string,
  weights: ScoringWeights,
  baseUrl: string,
): Promise<Digest> {
  const now = today();

  const [summary, followUps, deadlines, builds, stageCounts, commitments] = await Promise.all([
    getSummary(userId),
    getFollowUps(userId, weights, 0), // overdue and due today only
    getUpcomingDeadlines(userId, weights, 7),
    getBuilds(userId),
    getStageCounts(userId),
    getCommitments(userId),
  ]);

  /*
   * Only commitments whose stated date has arrived. A promise you made for next
   * month is not today's business, and putting it in today's mail is how the
   * mail stops being read.
   */
  const commitmentsDue = commitments.filter(
    (row) => row.dueDate !== null && row.dueDate <= now,
  );

  const overdue = followUps.filter((row) => row.urgency === "overdue");
  const dueToday = followUps.filter((row) => row.urgency === "today");
  const buildsDue = builds.dueCheckIns;

  const directive = nextAction({
    overdue: summary.overdue,
    dueToday: summary.followUpsDue - summary.overdue,
    nearestDeadline: deadlines[0]
      ? {
          id: deadlines[0].id,
          title: deadlines[0].title,
          company: deadlines[0].companyName,
          date: deadlines[0].deadline!,
        }
      : null,
    stageCounts,
    active: summary.active,
    sent: summary.sent,
    buildsDue: buildsDue.length
      ? {
          count: buildsDue.length,
          title: buildsDue[0].title,
          firstStep: buildsDue[0].firstStep,
          id: buildsDue[0].id,
        }
      : null,
  });

  const counts = {
    overdue: overdue.length,
    dueToday: dueToday.length,
    deadlines: deadlines.length,
    builds: buildsDue.length,
    commitments: commitmentsDue.length,
  };
  const empty =
    counts.overdue === 0 &&
    counts.dueToday === 0 &&
    counts.deadlines === 0 &&
    counts.builds === 0 &&
    counts.commitments === 0;

  const sections: { heading: string; items: Item[] }[] = [];

  if (overdue.length) {
    sections.push({
      heading: `${overdue.length} overdue ${plural(overdue.length, "follow-up")}`,
      items: overdue.map((row) => ({
        title: row.title,
        meta: `${row.companyName ?? "No company"} · due ${formatDay(row.nextFollowUpAt!)}`,
        urgent: true,
      })),
    });
  }

  if (dueToday.length) {
    sections.push({
      heading: `${dueToday.length} due today`,
      items: dueToday.map((row) => ({
        title: row.title,
        meta: row.companyName ?? "No company",
        urgent: false,
      })),
    });
  }

  if (deadlines.length) {
    sections.push({
      heading: `${deadlines.length} ${plural(deadlines.length, "deadline")} inside a week`,
      items: deadlines.map((row) => {
        const left = daysBetween(now, row.deadline!);
        return {
          title: row.title,
          meta: `${row.companyName ?? "No company"} · ${
            left <= 0 ? "closes today" : `${left} ${plural(left, "day")} left`
          }`,
          urgent: left <= 2,
        };
      }),
    });
  }

  if (buildsDue.length) {
    sections.push({
      heading: `${buildsDue.length} ${plural(buildsDue.length, "build")} waiting on you`,
      items: buildsDue.map((row) => ({
        title: `${CATEGORY_META.build.icon} ${row.title}`,
        meta: row.firstStep ?? `Last looked at ${formatDay(row.nextFollowUpAt!)}`,
        urgent: false,
      })),
    });
  }

  if (commitmentsDue.length) {
    sections.push({
      heading: `${commitmentsDue.length} you said you would`,
      items: commitmentsDue.map((row) => ({
        title: row.title,
        // Phrased as a reminder of their own words, never as an accusation.
        meta: `you said ${formatDay(row.dueDate!)}${
          row.mentionCount > 1 ? ` · came up ${row.mentionCount}×` : ""
        }`,
        urgent: false,
      })),
    });
  }

  const subject = empty
    ? "Nothing due today"
    : counts.overdue > 0
      ? `${counts.overdue} overdue · ${directive.headline}`
      : directive.headline;

  return {
    subject,
    empty,
    counts,
    html: renderHtml(directive, sections, baseUrl, empty),
    text: renderText(directive, sections, baseUrl, empty),
  };
}

/* -------------------------------------------------------------------------- */
/*  Rendering                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Inline styles only, no external CSS and no images: mail clients strip
 * stylesheets and block remote content by default. Colours are chosen to stay
 * legible on both a white and a dark client background, which is why the body
 * sets its own light ground rather than inheriting one.
 */
function renderHtml(
  directive: { headline: string; detail: string; cta: string; href: string },
  sections: { heading: string; items: Item[] }[],
  baseUrl: string,
  empty: boolean,
): string {
  const link = (path: string) => `${baseUrl}${path}`;

  const body = sections
    .map(
      (section) => `
      <h2 style="margin:26px 0 10px;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#6e6e6e;">
        ${escape(section.heading)}
      </h2>
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
        ${section.items
          .map(
            (item) => `
          <tr>
            <td style="padding:9px 0;border-bottom:1px solid #ececec;">
              <div style="font-size:15px;color:${item.urgent ? "#c2372c" : "#1a1a1a"};line-height:1.35;">
                ${escape(item.title)}
              </div>
              <div style="font-size:13px;color:#767676;margin-top:3px;line-height:1.35;">
                ${escape(item.meta)}
              </div>
            </td>
          </tr>`,
          )
          .join("")}
      </table>`,
    )
    .join("");

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f6f6f5;">
  <div style="max-width:560px;margin:0 auto;padding:28px 22px 36px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1a1a1a;background:#ffffff;">

    <p style="margin:0 0 20px;font-size:12px;letter-spacing:.09em;text-transform:uppercase;color:#9b9b9b;">
      Opportunity Command Center · ${escape(formatLongDay(today()))}
    </p>

    <div style="border:1px solid #e4e4e4;border-radius:10px;padding:16px 18px;background:#fafafa;">
      <p style="margin:0 0 6px;font-size:11px;letter-spacing:.11em;text-transform:uppercase;color:#9b9b9b;">
        Do this next
      </p>
      <p style="margin:0;font-size:17px;font-weight:600;line-height:1.3;">
        ${escape(directive.headline)}
      </p>
      <p style="margin:8px 0 14px;font-size:14px;color:#5c5c5c;line-height:1.5;">
        ${escape(directive.detail)}
      </p>
      <a href="${link(directive.href)}"
         style="display:inline-block;background:#2383e2;color:#ffffff;text-decoration:none;font-size:14px;font-weight:500;padding:9px 16px;border-radius:6px;">
        ${escape(directive.cta)}
      </a>
    </div>

    ${empty ? `<p style="margin:26px 0 0;font-size:14px;color:#5c5c5c;line-height:1.5;">Nothing is overdue, nothing is due today, and no deadline falls inside the week. The best use of today is widening the funnel.</p>` : body}

    <p style="margin:32px 0 0;padding-top:16px;border-top:1px solid #ececec;font-size:12px;color:#9b9b9b;line-height:1.6;">
      Every number here is counted from your own rows, not estimated.<br>
      <a href="${link("/settings#notifications")}" style="color:#767676;">Change or turn off these emails</a>
    </p>
  </div>
</body></html>`;
}

function renderText(
  directive: { headline: string; detail: string; cta: string; href: string },
  sections: { heading: string; items: Item[] }[],
  baseUrl: string,
  empty: boolean,
): string {
  const lines = [
    `OPPORTUNITY COMMAND CENTER — ${formatLongDay(today())}`,
    "",
    "DO THIS NEXT",
    directive.headline,
    directive.detail,
    `${directive.cta}: ${baseUrl}${directive.href}`,
  ];

  if (empty) {
    lines.push(
      "",
      "Nothing is overdue, nothing is due today, and no deadline falls inside",
      "the week. The best use of today is widening the funnel.",
    );
  } else {
    for (const section of sections) {
      lines.push("", section.heading.toUpperCase());
      for (const item of section.items) {
        lines.push(`  - ${item.title}`, `    ${item.meta}`);
      }
    }
  }

  lines.push(
    "",
    "—",
    "Every number here is counted from your own rows, not estimated.",
    `Change or turn off these emails: ${baseUrl}/settings#notifications`,
  );

  return lines.join("\n");
}

function escape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
