import { daysBetween, today, type DayString } from "./dates";
import { plural } from "@/lib/utils";
import type { Stage } from "./types";

export type NextAction = {
  headline: string;
  detail: string;
  href: string;
  cta: string;
  tone: "urgent" | "warn" | "accent" | "calm";
};

type Inputs = {
  overdue: number;
  dueToday: number;
  nearestDeadline: { title: string; company: string | null; date: DayString; id: string } | null;
  stageCounts: Record<Stage, number>;
  active: number;
  sent: number;
  /** Builds whose check-in date has arrived, with the oldest one's first step. */
  buildsDue?: { count: number; title: string; firstStep: string | null; id: string } | null;
};

/**
 * "What should I do next?" — answered with exactly one instruction, chosen by
 * what it would cost most to ignore. A dashboard that lists everything answers
 * nothing, so the ordering here is the product's opinion:
 *
 *   missed a promise > about to miss a deadline > ready but unsent >
 *   qualified but not prepared > researched but not qualified > pipeline empty
 */
export function nextAction(input: Inputs): NextAction {
  const { overdue, dueToday, nearestDeadline, stageCounts, active, sent, buildsDue } = input;

  if (overdue > 0) {
    return {
      headline: `Chase ${overdue} overdue ${plural(overdue, "follow-up")}`,
      detail:
        "These were promised to yourself and have slipped. Clearing them is the highest-value thing you can do today.",
      href: "/today",
      cta: "Work the queue",
      tone: "urgent",
    };
  }

  if (nearestDeadline) {
    const daysLeft = daysBetween(today(), nearestDeadline.date);
    if (daysLeft <= 3) {
      return {
        headline:
          daysLeft <= 0
            ? `${nearestDeadline.title} closes today`
            : `${nearestDeadline.title} closes in ${daysLeft} ${plural(daysLeft, "day")}`,
        detail: `${nearestDeadline.company ?? "This opportunity"} has a hard deadline. Submit it before anything else on the list.`,
        href: `/opportunities/${nearestDeadline.id}`,
        cta: "Open it",
        tone: "warn",
      };
    }
  }

  if (dueToday > 0) {
    return {
      headline: `${dueToday} ${plural(dueToday, "follow-up")} due today`,
      detail: "Send them now while the thread is still warm, then log each one.",
      href: "/today",
      cta: "Work the queue",
      tone: "warn",
    };
  }

  // Above "ready to send" because a build you promised yourself you'd look at
  // is a promise too — and it is the one nothing else in the app will chase.
  if (buildsDue && buildsDue.count > 0) {
    return {
      headline:
        buildsDue.count === 1
          ? `Pick "${buildsDue.title}" back up`
          : `${buildsDue.count} builds are waiting on you`,
      detail:
        buildsDue.firstStep ??
        "You said you would come back to this. Log where it actually got to, or drop it — both are answers.",
      href: "/builds",
      cta: "Open builds",
      tone: "accent",
    };
  }

  if (stageCounts.ready > 0) {
    return {
      headline: `${stageCounts.ready} ${plural(stageCounts.ready, "opportunity", "opportunities")} ready to send`,
      detail:
        "Research is done and the angle is written. The only thing left is taking the shot.",
      href: "/pipeline",
      cta: "Take the shots",
      tone: "accent",
    };
  }

  if (stageCounts.qualified > 0) {
    return {
      headline: `Prepare ${stageCounts.qualified} qualified ${plural(stageCounts.qualified, "opportunity", "opportunities")}`,
      detail:
        "These passed qualification. Write the outreach angle and move them to Ready to Act.",
      href: "/pipeline",
      cta: "Open pipeline",
      tone: "accent",
    };
  }

  if (stageCounts.researching > 0) {
    return {
      headline: `Finish research on ${stageCounts.researching}`,
      detail:
        "Run each through the Workflow Finder and score it, then qualify or drop it. Dropping is a result too.",
      href: "/finder",
      cta: "Open the finder",
      tone: "accent",
    };
  }

  if (stageCounts.sourced > 0) {
    return {
      headline: `Qualify ${stageCounts.sourced} sourced ${plural(stageCounts.sourced, "opportunity", "opportunities")}`,
      detail: "They are in the door but untouched. Work out which are worth a shot.",
      href: "/opportunities?stage=sourced",
      cta: "Start qualifying",
      tone: "accent",
    };
  }

  if (active === 0) {
    return {
      headline: sent > 0 ? "The pipeline is empty" : "Add your first opportunity",
      detail:
        "Nothing is in flight. Paste research findings into the import screen, or add one by hand — press N anywhere.",
      href: "/import",
      cta: "Find opportunities",
      tone: "accent",
    };
  }

  return {
    headline: "Everything scheduled is handled",
    detail:
      "No overdue follow-ups and no near deadlines. The best use of today is widening the funnel — more shots, not more polish.",
    href: "/import",
    cta: "Find more",
    tone: "calm",
  };
}
