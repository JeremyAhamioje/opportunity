import { Check, Clock, Send } from "lucide-react";
import {
  logFollowUpSent,
  markAsSent,
  setEmailStatus,
  setFollowUpDate,
  snoozeFollowUp,
} from "@/lib/actions/opportunities";
import { EMAIL_STATUSES, EMAIL_STATUS_META } from "@/lib/domain/types";
import { formatLongDay, today, urgencyOf, URGENCY_META } from "@/lib/domain/dates";
import { Badge, Field, Input, Select, buttonClass, URGENCY_TEXT } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { OpportunityRow } from "@/lib/queries/opportunities";

/**
 * Manual outreach tracking (brief §10). No automation, no mail integration —
 * you send from wherever you send, then tell the system what happened and it
 * takes care of remembering when to chase.
 */
export function OutreachPanel({
  row,
  defaultFollowUpDays,
}: {
  row: OpportunityRow;
  defaultFollowUpDays: number;
}) {
  const sent = Boolean(row.sentAt);
  const urgency = urgencyOf(row.nextFollowUpAt);

  return (
    <div className="divide-y divide-line">
      {/* --- Status line --- */}
      <div className="px-4 py-3 flex flex-wrap items-center gap-3">
        <form action={setEmailStatus} className="flex items-center gap-2">
          <input type="hidden" name="id" value={row.id} />
          <label htmlFor="emailStatus" className="text-[11.5px] text-ink-muted">
            Email status
          </label>
          <Select
            id="emailStatus"
            name="emailStatus"
            defaultValue={row.emailStatus}
            className="h-[28px] py-0 w-auto"
          >
            {EMAIL_STATUSES.map((status) => (
              <option key={status} value={status}>
                {EMAIL_STATUS_META[status]}
              </option>
            ))}
          </Select>
          <button type="submit" className={buttonClass("ghost", "xs")}>
            Set
          </button>
        </form>

        {sent ? (
          <Badge tone="good" className="ml-auto">
            <Check size={10} /> Sent {formatLongDay(row.sentAt)}
          </Badge>
        ) : (
          <Badge tone="neutral" className="ml-auto">
            Not sent yet
          </Badge>
        )}
      </div>

      {/* --- Mark as sent --- */}
      {!sent ? (
        <form action={markAsSent} className="px-4 py-3.5">
          <p className="text-[12px] text-ink-muted mb-3 leading-relaxed">
            Send the email or submit the application wherever you normally do, then record it
            here. A follow-up gets scheduled automatically.
          </p>
          <input type="hidden" name="id" value={row.id} />
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Date sent" htmlFor="sentAt" className="w-[150px]">
              <Input id="sentAt" name="sentAt" type="date" defaultValue={today()} />
            </Field>
            <Field
              label="Follow up in"
              htmlFor="followUpDays"
              className="w-[130px]"
              hint="Days. 0 = none."
            >
              <Input
                id="followUpDays"
                name="followUpDays"
                type="number"
                min={0}
                max={365}
                defaultValue={defaultFollowUpDays}
              />
            </Field>
            <button type="submit" className={buttonClass("primary", "md", "mb-[22px]")}>
              <Check size={13} /> Mark as sent
            </button>
          </div>
        </form>
      ) : (
        <div className="px-4 py-3.5 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0">
              <p className="text-[10.5px] uppercase tracking-[0.11em] text-ink-faint font-semibold">
                Next follow-up
              </p>
              <p className={cn("text-[13px] mt-1 flex items-center gap-2", URGENCY_TEXT[urgency])}>
                {row.nextFollowUpAt ? (
                  <>
                    <span className="num">{formatLongDay(row.nextFollowUpAt)}</span>
                    <span className="text-[11px]">{URGENCY_META[urgency].label}</span>
                  </>
                ) : (
                  <span className="text-ink-faint text-[12.5px]">Not scheduled</span>
                )}
              </p>
              {row.followUpCount > 0 ? (
                <p className="text-[11px] text-ink-faint mt-1">
                  {row.followUpCount} follow-up{row.followUpCount === 1 ? "" : "s"} sent so far
                </p>
              ) : null}
            </div>

            <div className="flex items-center gap-1.5 ml-auto flex-wrap">
              <form action={logFollowUpSent}>
                <input type="hidden" name="id" value={row.id} />
                <input type="hidden" name="followUpDays" value={defaultFollowUpDays} />
                <button type="submit" className={buttonClass("primary", "sm")}>
                  <Send size={12} /> Log follow-up sent
                </button>
              </form>
              {[3, 7, 14].map((days) => (
                <form action={snoozeFollowUp} key={days}>
                  <input type="hidden" name="id" value={row.id} />
                  <input type="hidden" name="days" value={days} />
                  <button
                    type="submit"
                    className={buttonClass("ghost", "sm")}
                    title={`Push the follow-up back ${days} days`}
                  >
                    <Clock size={11} /> +{days}d
                  </button>
                </form>
              ))}
            </div>
          </div>

          <form action={setFollowUpDate} className="flex items-end gap-2 pt-2 border-t border-line/70">
            <input type="hidden" name="id" value={row.id} />
            <Field label="Set a specific date" htmlFor="nextFollowUpAt" className="w-[170px]">
              <Input
                id="nextFollowUpAt"
                name="nextFollowUpAt"
                type="date"
                defaultValue={row.nextFollowUpAt ?? ""}
              />
            </Field>
            <button type="submit" className={buttonClass("secondary", "sm", "mb-[1px]")}>
              Save
            </button>
            <span className="text-[11px] text-ink-faint mb-1.5">
              Leave empty and save to stop chasing this one.
            </span>
          </form>
        </div>
      )}
    </div>
  );
}
