import Link from "next/link";
import { Clock, Hammer } from "lucide-react";
import { requireViewer } from "@/lib/auth/guard";
import { getBuilds } from "@/lib/queries/builds";
import { logBuildCheckIn } from "@/lib/actions/builds";
import { isAiConfigured } from "@/lib/parse/ai-config";
import { formatDay, relativeDay } from "@/lib/domain/dates";
import { Panel, PanelHeader, UrgencyDot, URGENCY_TEXT, buttonClass } from "@/components/ui";
import { PageHeader, StatTile } from "@/components/opportunity/bits";
import { BrainDump } from "@/components/build/brain-dump";
import { BuildLane } from "@/components/build/build-lane";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function BuildsPage() {
  const { user } = await requireViewer();
  const view = await getBuilds(user.id);

  return (
    <div className="p-5 lg:p-6 max-w-[1400px]">
      <PageHeader
        title="Builds"
        subtitle="Things to make, not shots to take. Dump the idea while you have it — the follow-up desk brings it back."
        eyebrow={
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.11em] text-cat-build mb-1.5">
            <Hammer size={11} className="inline mb-px mr-1" />
            Brain dump
          </p>
        }
      />

      <div className="grid sm:grid-cols-3 gap-2.5 mb-4 max-w-[560px]">
        <StatTile label="Live" value={view.live} sub="Not shipped or dropped" />
        <StatTile
          label="Due a check-in"
          value={view.dueCheckIns.length}
          tone={view.dueCheckIns.length > 0 ? "urgent" : "neutral"}
          sub={view.dueCheckIns.length > 0 ? "You said you'd look" : "Nothing overdue"}
        />
        <StatTile label="Shipped" value={view.shipped} tone="good" sub="Finished and out" />
      </div>

      <div className="mb-5">
        <BrainDump aiEnabled={isAiConfigured()} />
      </div>

      {view.dueCheckIns.length > 0 ? (
        <Panel className="mb-5">
          <PanelHeader
            title="Builds waiting on you"
            subtitle="Captured, then left alone. Log where each one actually got to, or push it out."
          />
          <ul className="divide-y divide-line/60">
            {view.dueCheckIns.map((row) => (
              <li key={row.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/opportunities/${row.id}`}
                    className="block text-[12.5px] truncate hover:text-accent-hot transition-colors"
                  >
                    {row.title}
                  </Link>
                  <span className="flex items-center gap-1.5 text-[10.5px] mt-0.5">
                    <UrgencyDot urgency={row.urgency} />
                    <span className={cn("num", URGENCY_TEXT[row.urgency])}>
                      {formatDay(row.nextFollowUpAt!)}
                    </span>
                    <span className="text-ink-faint">
                      · {relativeDay(row.nextFollowUpAt!)}
                      {row.firstStep ? ` · ${row.firstStep}` : ""}
                    </span>
                  </span>
                </div>

                <form action={logBuildCheckIn} className="flex items-center gap-1.5 shrink-0">
                  <input type="hidden" name="id" value={row.id} />
                  <input
                    name="progress"
                    placeholder="What happened?"
                    aria-label="Progress note"
                    className="field h-[26px] py-0 text-[11.5px] w-[150px] hidden sm:block"
                  />
                  <input type="hidden" name="checkInDays" value="7" />
                  <button type="submit" className={buttonClass("secondary", "xs")}>
                    <Clock size={11} /> Log &amp; snooze 7d
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <BuildLane lanes={view.lanes} />
    </div>
  );
}
