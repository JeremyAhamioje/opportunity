import Link from "next/link";
import { Check, Clock } from "lucide-react";
import { logFollowUpSent, snoozeFollowUp } from "@/lib/actions/opportunities";
import { formatDay, relativeDay, URGENCY_META } from "@/lib/domain/dates";
import { EmptyState, buttonClass } from "@/components/ui";
import { cn } from "@/lib/utils";
import { CategoryBadge, FollowUpCell } from "./bits";
import type { FollowUpRow } from "@/lib/queries/opportunities";

/**
 * The follow-up desk. Every row can be resolved without leaving the page —
 * that is the difference between a list you read and a list you clear.
 */
export function FollowUpTable({
  rows,
  compact = false,
  emptyTitle = "Nothing to chase right now",
  emptyDescription = "Follow-ups appear here the moment one comes due. Send outreach and a date gets scheduled automatically.",
}: {
  rows: FollowUpRow[];
  /** Drops the "last action" column so the buttons still fit in a narrow column. */
  compact?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (!rows.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} icon={<Check size={20} />} />;
  }

  return (
    <div className="overflow-x-auto">
      <table
        className={cn(
          "w-full text-left border-collapse",
          compact ? "min-w-[540px]" : "min-w-[720px]",
        )}
      >
        <thead>
          <tr className="text-[10px] uppercase tracking-[0.11em] text-ink-faint">
            <th className="font-semibold px-4 py-2 border-b border-line">Company</th>
            <th className="font-semibold px-3 py-2 border-b border-line">Opportunity</th>
            {!compact ? (
              <th className="font-semibold px-3 py-2 border-b border-line">Last action</th>
            ) : null}
            <th className="font-semibold px-3 py-2 border-b border-line">Follow-up due</th>
            <th className="font-semibold px-3 py-2 border-b border-line text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="row-link border-b border-line/60 last:border-0 align-middle">
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <CategoryBadge category={row.category} withLabel={false} />
                  {row.companyId ? (
                    <Link
                      href={`/companies/${row.companyId}`}
                      className="text-[12.5px] font-medium truncate hover:text-accent-hot transition-colors"
                    >
                      {row.companyName ?? "Unassigned"}
                    </Link>
                  ) : (
                    // A build has no counterparty, so "Unassigned" would be
                    // reporting a gap that does not exist.
                    <span
                      className={cn(
                        "text-[12.5px] truncate",
                        row.category === "build" ? "text-ink-faint" : "font-medium",
                      )}
                    >
                      {row.companyName ?? (row.category === "build" ? "Yours" : "Unassigned")}
                    </span>
                  )}
                </div>
              </td>

              <td className="px-3 py-2.5 max-w-[260px]">
                <Link
                  href={`/opportunities/${row.id}`}
                  className="text-[12.5px] text-ink-muted hover:text-accent-hot transition-colors block truncate"
                >
                  {row.title}
                </Link>
                {compact && row.lastActionLabel ? (
                  <span className="block text-[10.5px] text-ink-faint truncate">
                    {row.lastActionLabel}
                    {row.lastActionAt ? ` · ${formatDay(row.lastActionAt)}` : ""}
                  </span>
                ) : null}
              </td>

              {!compact ? (
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <span className="text-[11.5px] text-ink-muted">
                    {row.lastActionLabel ?? "—"}
                  </span>
                  {row.lastActionAt ? (
                    <span className="block text-[10.5px] text-ink-faint num">
                      {formatDay(row.lastActionAt)}
                    </span>
                  ) : null}
                </td>
              ) : null}

              <td className="px-3 py-2.5 whitespace-nowrap">
                <FollowUpCell date={row.nextFollowUpAt} showRelative={!compact} />
                <span className="block text-[10.5px] text-ink-faint mt-0.5">
                  {compact ? relativeDay(row.nextFollowUpAt!) : URGENCY_META[row.urgency].label}
                  {row.followUpCount > 0 ? ` · ${row.followUpCount} sent` : ""}
                </span>
              </td>

              <td className="px-3 py-2.5">
                <div className="flex items-center justify-end gap-1.5">
                  {/* Same action either way — it logs the touch and schedules
                      the next. Only the word is different, because for a build
                      nothing was sent to anyone. */}
                  <form action={logFollowUpSent}>
                    <input type="hidden" name="id" value={row.id} />
                    <button
                      type="submit"
                      title={
                        row.category === "build"
                          ? "I looked at it — log the check and schedule the next"
                          : "I sent the follow-up — log it and schedule the next one"
                      }
                      className={buttonClass("secondary", "xs")}
                    >
                      <Check size={11} /> {row.category === "build" ? "Checked" : "Sent"}
                    </button>
                  </form>

                  <form action={snoozeFollowUp}>
                    <input type="hidden" name="id" value={row.id} />
                    <input type="hidden" name="days" value="3" />
                    <button
                      type="submit"
                      title="Push this follow-up back 3 days"
                      className={buttonClass("ghost", "xs")}
                    >
                      <Clock size={11} /> +3d
                    </button>
                  </form>

                  {/* In compact mode the title itself is the link — the button
                      would push the two that actually resolve a follow-up off
                      the edge of the panel. */}
                  {!compact ? (
                    <Link href={`/opportunities/${row.id}`} className={buttonClass("ghost", "xs")}>
                      View
                    </Link>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
