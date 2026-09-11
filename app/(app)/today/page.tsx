import Link from "next/link";
import { CheckCircle2, Circle, Send, Target } from "lucide-react";
import { requireViewer } from "@/lib/auth/guard";
import { getTodayView } from "@/lib/queries/today";
import { markAsSent, setStageFromForm } from "@/lib/actions/opportunities";
import { toggleAction } from "@/lib/actions/tasks";
import { formatDay, formatLongDay, today, urgencyOf } from "@/lib/domain/dates";
import { ACTION_TYPE_META, GOAL_METRIC_META } from "@/lib/domain/types";
import {
  ButtonLink,
  EmptyState,
  Panel,
  PanelHeader,
  ProgressBar,
  buttonClass,
  URGENCY_TEXT,
} from "@/components/ui";
import { CategoryBadge, DeadlineCell, PageHeader, ScorePill } from "@/components/opportunity/bits";
import { FollowUpTable } from "@/components/opportunity/follow-up-table";
import { CoreLoop } from "@/components/brand/core-loop";
import { cn } from "@/lib/utils";
import type { OpportunityRow } from "@/lib/queries/opportunities";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const { user, settings } = await requireViewer();
  const view = await getTodayView(user.id, settings.scoringWeights, settings.dailyGoals);

  const totalTargets = view.goals.reduce((sum, goal) => sum + goal.target, 0);
  const totalDone = view.goals.reduce((sum, goal) => sum + Math.min(goal.done, goal.target), 0);

  return (
    <div className="p-5 lg:p-6 max-w-[1200px]">
      <PageHeader
        eyebrow={
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-accent mb-1.5">
            Daily execution mode
          </p>
        }
        title="Today's Shots"
        subtitle={`${formatLongDay(today())} · Today's goal: take action.`}
        action={<CoreLoop active="shoot" className="hidden xl:block" size="sm" />}
      />

      {/* ---- Goals, scored from real rows rather than self-reported ticks ---- */}
      <Panel className="mb-4">
        <PanelHeader
          icon={<Target size={13} className="text-accent" />}
          title="Today's targets"
          subtitle={
            totalTargets > 0
              ? `${totalDone} of ${totalTargets} counted · ${view.goalsComplete} of ${view.goals.length} goals met`
              : "No goals set"
          }
          action={
            <ButtonLink href="/settings#goals" variant="ghost" size="xs">
              Edit goals
            </ButtonLink>
          }
        />
        {view.goals.length ? (
          <ul className="grid sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-line">
            {view.goals.map((goal) => (
              <li key={goal.id} className="px-3.5 py-3">
                <div className="flex items-start gap-2">
                  {goal.complete ? (
                    <CheckCircle2 size={14} className="text-good mt-px shrink-0" />
                  ) : (
                    <Circle size={14} className="text-ink-faint mt-px shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-[12.5px] leading-snug",
                        goal.complete ? "text-ink-muted line-through decoration-line-strong" : "text-ink",
                      )}
                    >
                      {goal.label}
                    </p>
                    <p className="num text-[11px] text-ink-faint mt-1">
                      {goal.done} / {goal.target}
                    </p>
                    <ProgressBar
                      value={goal.done}
                      max={goal.target}
                      tone={goal.complete ? "good" : "accent"}
                      className="mt-1.5"
                    />
                    <p className="text-[10px] text-ink-faint mt-1.5 leading-snug">
                      {GOAL_METRIC_META[goal.metric].counts}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No daily goals configured"
            description="Set targets so the day has a finish line."
            action={
              <ButtonLink href="/settings#goals" size="sm">
                Set goals
              </ButtonLink>
            }
          />
        )}
      </Panel>

      <div className="flex flex-col gap-4">
        {/* 🔴 ---------------------------------------------------------------- */}
        <Panel className="border-overdue/25">
          <PanelHeader
            icon={<span aria-hidden>🔴</span>}
            title="Follow-ups due"
            subtitle="Overdue and due today. Send, then log it."
          />
          <FollowUpTable
            rows={view.followUps}
            emptyTitle="No follow-ups due today"
            emptyDescription="Everything you promised yourself is either sent or scheduled for later."
          />
        </Panel>

        {/* 🟠 ---------------------------------------------------------------- */}
        <Panel className="border-duetoday/20">
          <PanelHeader
            icon={<span aria-hidden>🟠</span>}
            title="Applications to submit"
            subtitle="Ready to act, plus anything with a deadline inside a week."
          />
          <ShotList
            rows={view.toSubmit}
            empty="Nothing is queued for sending. Move an opportunity to Ready to Act once the angle is written."
            renderAction={(row) => (
              <div className="flex items-center gap-1.5">
                <form action={markAsSent}>
                  <input type="hidden" name="id" value={row.id} />
                  <button
                    type="submit"
                    className={buttonClass("primary", "xs")}
                    title={`Records today's date and schedules a follow-up in ${settings.followUpDefaultDays} days`}
                  >
                    <Send size={11} /> Mark sent
                  </button>
                </form>
                <Link href={`/opportunities/${row.id}`} className={buttonClass("ghost", "xs")}>
                  Open
                </Link>
              </div>
            )}
          />
        </Panel>

        {/* 🟡 ---------------------------------------------------------------- */}
        <Panel className="border-duesoon/20">
          <PanelHeader
            icon={<span aria-hidden>🟡</span>}
            title="Research to complete"
            subtitle="Qualify or drop. Dropping is a result too."
          />
          <ShotList
            rows={view.toResearch}
            empty="No open research. Pull something out of Sourced and start digging."
            renderAction={(row) => (
              <div className="flex items-center gap-1.5">
                <form action={setStageFromForm}>
                  <input type="hidden" name="id" value={row.id} />
                  <input type="hidden" name="stage" value="qualified" />
                  <button type="submit" className={buttonClass("secondary", "xs")}>
                    Qualify
                  </button>
                </form>
                <form action={setStageFromForm}>
                  <input type="hidden" name="id" value={row.id} />
                  <input type="hidden" name="stage" value="lost" />
                  <button type="submit" className={buttonClass("ghost", "xs")}>
                    Drop
                  </button>
                </form>
                <Link href={`/opportunities/${row.id}`} className={buttonClass("ghost", "xs")}>
                  Open
                </Link>
              </div>
            )}
          />
        </Panel>

        {/* 🟢 ---------------------------------------------------------------- */}
        <Panel className="border-scheduled/20">
          <PanelHeader
            icon={<span aria-hidden>🟢</span>}
            title="New opportunities"
            subtitle="Sourced but untouched — decide whether they are worth a shot."
            action={
              <ButtonLink href="/import" variant="ghost" size="xs">
                Import more
              </ButtonLink>
            }
          />
          <ShotList
            rows={view.fresh}
            empty="Nothing new waiting. Paste research findings into the import screen to refill the top of the funnel."
            renderAction={(row) => (
              <div className="flex items-center gap-1.5">
                <form action={setStageFromForm}>
                  <input type="hidden" name="id" value={row.id} />
                  <input type="hidden" name="stage" value="researching" />
                  <button type="submit" className={buttonClass("secondary", "xs")}>
                    Start research
                  </button>
                </form>
                <Link href={`/opportunities/${row.id}`} className={buttonClass("ghost", "xs")}>
                  Open
                </Link>
              </div>
            )}
          />
        </Panel>

        {/* ---- Loose tasks ---- */}
        {view.dueTasks.length ? (
          <Panel>
            <PanelHeader
              title="Tasks due"
              subtitle="Actions you created on individual opportunities"
            />
            <ul className="divide-y divide-line/60">
              {view.dueTasks.map((task) => {
                const urgency = urgencyOf(task.dueDate);
                return (
                  <li key={task.id} className="flex items-center gap-3 px-4 py-2.5">
                    <form action={toggleAction} className="flex">
                      <input type="hidden" name="id" value={task.id} />
                      <button
                        type="submit"
                        title="Mark done"
                        className="text-ink-faint hover:text-good transition-colors"
                      >
                        <Circle size={14} />
                      </button>
                    </form>
                    <span className="text-[12.5px] flex-1 min-w-0 truncate">
                      <span className="text-ink-faint mr-1.5" aria-hidden>
                        {ACTION_TYPE_META[task.type].icon}
                      </span>
                      {task.title}
                    </span>
                    <Link
                      href={`/opportunities/${task.opportunityId}`}
                      className="text-[11.5px] text-ink-faint hover:text-ink transition-colors truncate max-w-[200px]"
                    >
                      {task.companyName ?? task.opportunityTitle}
                    </Link>
                    <span className={cn("num text-[11px] shrink-0", URGENCY_TEXT[urgency])}>
                      {formatDay(task.dueDate)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}

function ShotList({
  rows,
  empty,
  renderAction,
}: {
  rows: OpportunityRow[];
  empty: string;
  renderAction: (row: OpportunityRow) => React.ReactNode;
}) {
  if (!rows.length) return <EmptyState title="Clear" description={empty} />;

  return (
    <ul className="divide-y divide-line/60">
      {rows.map((row) => (
        <li key={row.id} className="row-link flex items-center gap-3 px-4 py-2.5">
          <CategoryBadge category={row.category} withLabel={false} />
          <div className="min-w-0 flex-1">
            <Link
              href={`/opportunities/${row.id}`}
              className="text-[12.5px] hover:text-accent-hot transition-colors block truncate"
            >
              {row.title}
            </Link>
            <p className="text-[10.5px] text-ink-faint truncate">
              {row.companyName ?? "Unassigned"}
              {row.location ? ` · ${row.location}` : ""}
            </p>
          </div>
          {row.deadline ? (
            <div className="hidden sm:block shrink-0">
              <DeadlineCell date={row.deadline} />
            </div>
          ) : null}
          <div className="hidden md:block shrink-0 w-8 text-right">
            <ScorePill score={row.score} />
          </div>
          <div className="shrink-0">{renderAction(row)}</div>
        </li>
      ))}
    </ul>
  );
}
