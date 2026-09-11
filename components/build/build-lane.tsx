import Link from "next/link";
import { Clock, Hammer } from "lucide-react";
import { setStageFromForm } from "@/lib/actions/opportunities";
import { logBuildCheckIn } from "@/lib/actions/builds";
import { formatDay, relativeDay } from "@/lib/domain/dates";
import { BUILD_LANES, BUILD_STAGE_META, buildLaneOf } from "@/lib/domain/types";
import { EmptyState, UrgencyDot, URGENCY_TEXT, buttonClass } from "@/components/ui";
import { AutoSubmitSelect } from "@/components/ui/client";
import { MockBadge, OpportunityThumb } from "@/components/opportunity/bits";
import { cn } from "@/lib/utils";
import type { BuildLane as Lane } from "@/lib/queries/builds";

/**
 * Seven columns instead of the pipeline's ten, because a build has no outreach
 * to track. Each card carries its first step — the thing that restarts it —
 * rather than a description, which you already know.
 */
export function BuildLane({ lanes }: { lanes: Lane[] }) {
  if (lanes.every((lane) => lane.rows.length === 0)) {
    return (
      <EmptyState
        title="No builds yet"
        description="Dump an idea above. It does not have to be good, or finished, or even a full sentence."
        icon={<Hammer size={20} />}
      />
    );
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-2.5 min-w-max">
        {lanes.map((lane) => (
          <section key={lane.stage} className="w-[248px] shrink-0">
            <header className="flex items-center justify-between gap-2 px-1 pb-1.5">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-ink-faint">
                {BUILD_STAGE_META[lane.stage].label}
              </h2>
              <span className="num text-[11px] text-ink-faint">{lane.rows.length}</span>
            </header>

            <div className="flex flex-col gap-1.5">
              {lane.rows.map((row) => (
                <article
                  key={row.id}
                  className={cn(
                    "bg-surface border rounded-[8px] p-2.5 flex flex-col gap-2",
                    row.urgency === "overdue" && row.stage !== "won" && row.stage !== "lost"
                      ? "border-overdue/40"
                      : "border-line",
                  )}
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <OpportunityThumb category="build" src={row.image} size={26} />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/opportunities/${row.id}`}
                        className="block text-[12.5px] leading-snug hover:text-accent-hot transition-colors"
                      >
                        {row.title}
                      </Link>
                      {row.scopeEstimate ? (
                        <span className="block text-[10.5px] text-ink-faint mt-0.5">
                          {row.scopeEstimate}
                        </span>
                      ) : null}
                    </div>
                    {row.isMock ? <MockBadge /> : null}
                  </div>

                  {row.firstStep && row.stage !== "won" && row.stage !== "lost" ? (
                    <p className="text-[11px] text-ink-muted leading-snug border-l-2 border-cat-build/50 pl-2">
                      {row.firstStep}
                    </p>
                  ) : null}

                  {row.nextFollowUpAt && row.stage !== "won" && row.stage !== "lost" ? (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 text-[10.5px]",
                        URGENCY_TEXT[row.urgency],
                      )}
                    >
                      <UrgencyDot urgency={row.urgency} />
                      <span className="num">{formatDay(row.nextFollowUpAt)}</span>
                      <span className="text-ink-faint">· {relativeDay(row.nextFollowUpAt)}</span>
                    </span>
                  ) : null}

                  <div className="flex items-center gap-1.5">
                    <form action={setStageFromForm} className="flex-1 min-w-0">
                      <input type="hidden" name="id" value={row.id} />
                      <AutoSubmitSelect
                        name="stage"
                        defaultValue={buildLaneOf(row.stage)}
                        aria-label="Build stage"
                        className="h-[26px] py-0 text-[11px]"
                      >
                        {/* The seven lane stages only. Offering all ten would
                            show "Building" four times over. */}
                        {BUILD_LANES.map((stage) => (
                          <option key={stage} value={stage}>
                            {BUILD_STAGE_META[stage].label}
                          </option>
                        ))}
                      </AutoSubmitSelect>
                    </form>

                    {row.stage !== "won" && row.stage !== "lost" ? (
                      <form action={logBuildCheckIn}>
                        <input type="hidden" name="id" value={row.id} />
                        <input type="hidden" name="checkInDays" value="7" />
                        <button
                          type="submit"
                          title="Looked at it — push the next nudge out a week"
                          className={buttonClass("ghost", "xs")}
                        >
                          <Clock size={11} /> +7d
                        </button>
                      </form>
                    ) : null}
                  </div>
                </article>
              ))}

              {lane.rows.length === 0 ? (
                <p className="text-[11px] text-ink-faint px-1 py-3">—</p>
              ) : null}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
