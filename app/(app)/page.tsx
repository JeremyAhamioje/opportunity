import Link from "next/link";
import { ArrowRight, CalendarClock, Flame, Handshake, History } from "lucide-react";
import { requireViewer } from "@/lib/auth/guard";
import {
  getCategoryCounts,
  getFollowUps,
  getRecentActivity,
  getStageCounts,
  getSummary,
  getUpcomingDeadlines,
  listOpportunities,
} from "@/lib/queries/opportunities";
import { getBuilds } from "@/lib/queries/builds";
import { getCommitments, getForgotten } from "@/lib/queries/insights";
import type { ScoringWeights } from "@/lib/domain/types";
import { nextAction } from "@/lib/domain/next-action";
import { formatDay, formatTimestamp, relativeDay } from "@/lib/domain/dates";
import { CATEGORY_META, STAGES, STAGE_META } from "@/lib/domain/types";
import { ButtonLink, EmptyState, Panel, PanelHeader } from "@/components/ui";
import { CoreLoop } from "@/components/brand/core-loop";
import {
  CategoryBadge,
  DeadlineCell,
  PageHeader,
  ScorePill,
  StatTile,
} from "@/components/opportunity/bits";
import { FollowUpTable } from "@/components/opportunity/follow-up-table";
import { WelcomeTour } from "@/components/shell/welcome-tour";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { user, settings } = await requireViewer();

  const [
    summary,
    followUps,
    stageCounts,
    categoryCounts,
    deadlines,
    activity,
    builds,
    commitments,
    forgotten,
  ] = await Promise.all([
    getSummary(user.id),
    getFollowUps(user.id, settings.scoringWeights, 3),
    getStageCounts(user.id),
    getCategoryCounts(user.id),
    getUpcomingDeadlines(user.id, settings.scoringWeights, 30),
    getRecentActivity(user.id, 10),
    getBuilds(user.id),
    getCommitments(user.id, 4),
    getForgotten(user.id, 3),
  ]);

  const dueNow = followUps.filter(
    (row) => row.urgency === "overdue" || row.urgency === "today",
  );

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
    buildsDue: builds.dueCheckIns.length
      ? {
          count: builds.dueCheckIns.length,
          title: builds.dueCheckIns[0].title,
          firstStep: builds.dueCheckIns[0].firstStep,
          id: builds.dueCheckIns[0].id,
        }
      : null,
  });

  const toneStyles = {
    urgent: "border-overdue/40 bg-[#170e11]",
    warn: "border-duetoday/35 bg-[#17110c]",
    accent: "border-accent/30 bg-[#100e1d]",
    calm: "border-line bg-surface",
  }[directive.tone];

  return (
    <div className="p-5 lg:p-6 max-w-[1400px]">
      {/* Only for an account with nothing in it, so it never interrupts work. */}
      <WelcomeTour isNew={summary.active === 0 && summary.sent === 0} />

      <PageHeader
        title="Opportunity Command Center"
        subtitle="Find opportunities. Take the shot. Follow up. Repeat."
        action={<CoreLoop className="hidden xl:block" size="sm" />}
      />

      {/* ---- The single instruction. Everything else on this page is context. ---- */}
      <section className={cn("border rounded-[10px] px-4 py-3.5 mb-5 flex items-center gap-4", toneStyles)}>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-ink-faint mb-1.5">
            Do this next
          </p>
          <h2 className="text-[16px] font-semibold tracking-tight leading-snug">
            {directive.headline}
          </h2>
          <p className="text-[12.5px] text-ink-muted mt-1 leading-relaxed max-w-2xl">
            {directive.detail}
          </p>
        </div>
        <ButtonLink href={directive.href} variant="primary" size="md" className="shrink-0">
          {directive.cta}
          <ArrowRight size={13} />
        </ButtonLink>
      </section>

      {/* ---- Summary tiles ---- */}
      <section className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 mb-5">
        <StatTile
          label="Active opportunities"
          value={summary.active}
          sub="Currently being pursued"
          href="/opportunities?status=open"
        />
        <StatTile
          label="Applications sent"
          value={summary.sent}
          sub="Total shots taken"
          href="/analytics"
        />
        <StatTile
          label="Follow-ups due"
          value={summary.followUpsDue}
          sub={summary.overdue > 0 ? `${summary.overdue} overdue` : "Nothing overdue"}
          tone={summary.followUpsDue > 0 ? "urgent" : "neutral"}
          emphasis
          href="/today"
        />
        <StatTile
          label="Positive responses"
          value={summary.positiveResponses}
          sub={`${summary.responses} total ${summary.responses === 1 ? "reply" : "replies"}`}
          tone={summary.positiveResponses > 0 ? "good" : "neutral"}
          href="/analytics"
        />
        <StatTile
          label="This week"
          value={summary.addedThisWeek}
          sub="New opportunities added"
          tone="accent"
          href="/opportunities?added=7"
        />
      </section>

      <div className="grid xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,1fr)] gap-4 items-start">
        <div className="flex flex-col gap-4 min-w-0">
          {/* ---- Follow-up command center ---- */}
          <Panel>
            <PanelHeader
              icon={<span aria-hidden>🔴</span>}
              title="Follow-ups requiring action"
              subtitle={
                dueNow.length
                  ? `${dueNow.length} need sending now · ${followUps.length - dueNow.length} coming up`
                  : "Overdue, due today, and the next three days"
              }
              action={
                <ButtonLink href="/today" variant="ghost" size="xs">
                  Today&apos;s Shots
                </ButtonLink>
              }
            />
            <FollowUpTable rows={followUps} compact />
          </Panel>

          {/* ---- Pipeline snapshot ---- */}
          <Panel>
            <PanelHeader
              title="Pipeline"
              subtitle="Where every opportunity currently sits"
              action={
                <ButtonLink href="/pipeline" variant="ghost" size="xs">
                  Open board
                </ButtonLink>
              }
            />
            <div className="p-3 grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              {STAGES.map((stage) => {
                const count = stageCounts[stage] ?? 0;
                const closed = stage === "won" || stage === "lost";
                return (
                  <Link
                    key={stage}
                    href={`/opportunities?stage=${stage}`}
                    className={cn(
                      "rounded-md border px-2.5 py-2 transition-colors",
                      count > 0
                        ? "border-line-strong bg-canvas hover:bg-raised"
                        : "border-line/70 bg-transparent hover:bg-raised/40",
                    )}
                  >
                    <p
                      className={cn(
                        "num text-[17px] font-semibold leading-none",
                        count === 0
                          ? "text-ink-faint"
                          : stage === "won"
                            ? "text-good"
                            : stage === "lost"
                              ? "text-ink-muted"
                              : "text-ink",
                      )}
                    >
                      {count}
                    </p>
                    <p
                      className={cn(
                        "text-[10.5px] mt-1 leading-tight",
                        closed ? "text-ink-faint" : "text-ink-muted",
                      )}
                    >
                      {STAGE_META[stage].short}
                    </p>
                  </Link>
                );
              })}
            </div>

            <div className="border-t border-line px-3 py-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
              {(Object.keys(categoryCounts) as (keyof typeof categoryCounts)[]).map((category) => (
                <Link
                  key={category}
                  href={`/opportunities?category=${category}`}
                  className="flex items-center gap-1.5 text-[11.5px] text-ink-muted hover:text-ink transition-colors"
                >
                  <span aria-hidden>{CATEGORY_META[category].icon}</span>
                  <span className="num font-semibold text-ink">{categoryCounts[category]}</span>
                  {CATEGORY_META[category].short}
                </Link>
              ))}
              <span className="text-[11px] text-ink-faint ml-auto">active only</span>
            </div>
          </Panel>
        </div>

        <div className="flex flex-col gap-4 min-w-0">
          {/* ---- Deadlines ---- */}
          <Panel>
            <PanelHeader
              icon={<CalendarClock size={13} className="text-duesoon" />}
              title="Upcoming deadlines"
              subtitle="Next 30 days"
            />
            {deadlines.length ? (
              <ul className="divide-y divide-line/60">
                {deadlines.slice(0, 7).map((row) => (
                  <li key={row.id}>
                    <Link
                      href={`/opportunities/${row.id}`}
                      className="row-link flex items-center gap-2.5 px-3.5 py-2.5"
                    >
                      <CategoryBadge category={row.category} withLabel={false} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12px] truncate">{row.title}</span>
                        <span className="block text-[10.5px] text-ink-faint truncate">
                          {row.companyName ?? "Unassigned"} · {relativeDay(row.deadline!)}
                        </span>
                      </span>
                      <DeadlineCell date={row.deadline} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="No deadlines in the next month"
                description="Jobs and scholarships with closing dates will appear here."
              />
            )}
          </Panel>

          {/* ---- Highest scoring ---- */}
          <Panel>
            <PanelHeader
              icon={<Flame size={13} className="text-overdue" />}
              title="Highest scoring"
              subtitle="Best odds per hour spent"
              action={
                <ButtonLink href="/opportunities?sort=score" variant="ghost" size="xs">
                  All
                </ButtonLink>
              }
            />
            <TopScored userId={user.id} weights={settings.scoringWeights} />
          </Panel>

          {/* ---- Recovered from your own conversations ---- */}
          {commitments.length || forgotten.length ? (
            <Panel>
              <PanelHeader
                icon={<Handshake size={13} className="text-duetoday" />}
                title="From your conversations"
                subtitle="Recovered from things you already said"
                action={
                  <ButtonLink href="/ideas" variant="ghost" size="xs">
                    All
                  </ButtonLink>
                }
              />
              <div className="px-3.5 py-3 flex flex-col gap-3">
                {commitments.length ? (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-ink-faint mb-1.5">
                      You said you would
                    </p>
                    <ul className="flex flex-col gap-1.5">
                      {commitments.map((row) => (
                        <li key={row.id}>
                          <Link
                            href={`/ideas/${row.id}`}
                            className="group flex items-baseline gap-2 min-w-0"
                          >
                            <span className="text-[12px] text-ink-muted group-hover:text-accent-hot transition-colors truncate">
                              {row.title}
                            </span>
                            {row.dueDate ? (
                              <span className="num text-[10.5px] text-ink-faint shrink-0">
                                {formatDay(row.dueDate)}
                              </span>
                            ) : null}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {forgotten.length ? (
                  <div className={commitments.length ? "pt-2.5 border-t border-line/70" : ""}>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-ink-faint mb-1.5">
                      Gone quiet
                    </p>
                    <ul className="flex flex-col gap-1.5">
                      {forgotten.map((row) => (
                        <li key={row.id}>
                          <Link
                            href={`/ideas/${row.id}`}
                            className="group flex items-baseline gap-2 min-w-0"
                          >
                            <span className="text-[12px] text-ink-muted group-hover:text-accent-hot transition-colors truncate">
                              {row.title}
                            </span>
                            <span className="num text-[10.5px] text-ink-faint shrink-0">
                              {row.mentionCount}×
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </Panel>
          ) : null}

          {/* ---- Activity ---- */}
          <Panel>
            <PanelHeader
              icon={<History size={13} className="text-ink-faint" />}
              title="Recent activity"
              subtitle="Everything you have done, newest first"
            />
            {activity.length ? (
              <ul className="px-3.5 py-3 flex flex-col gap-2.5">
                {activity.map((entry) => (
                  <li key={entry.activity.id} className="flex gap-2.5">
                    <span className="mt-[5px] size-[5px] rounded-full bg-line-strong shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[12px] text-ink-muted leading-snug">
                        {entry.activity.message}
                      </p>
                      <p className="text-[10.5px] text-ink-faint mt-0.5 truncate">
                        {entry.companyName ? `${entry.companyName} · ` : ""}
                        {formatTimestamp(entry.activity.occurredAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="No activity yet"
                description="Actions you take get logged here so you always know what has already been tried."
              />
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

async function TopScored({
  userId,
  weights,
}: {
  userId: string;
  weights: ScoringWeights;
}) {
  const rows = (
    await listOpportunities(userId, weights, { status: "open", sort: "score", limit: 100 })
  )
    .filter((row) => row.score.total !== null)
    .slice(0, 6);

  if (!rows.length) {
    return (
      <EmptyState
        title="Nothing scored yet"
        description="Score a workflow opportunity and the strongest ones surface here."
      />
    );
  }

  return (
    <ul className="divide-y divide-line/60">
      {rows.map((row) => (
        <li key={row.id}>
          <Link
            href={`/opportunities/${row.id}`}
            className="row-link flex items-center gap-2.5 px-3.5 py-2.5"
          >
            <CategoryBadge category={row.category} withLabel={false} />
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] truncate">{row.title}</span>
              <span className="block text-[10.5px] text-ink-faint truncate">
                {row.companyName ?? "Unassigned"}
              </span>
            </span>
            <ScorePill score={row.score} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
