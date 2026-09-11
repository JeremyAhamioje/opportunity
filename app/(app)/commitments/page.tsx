import Link from "next/link";
import { Handshake } from "lucide-react";
import { requireViewer } from "@/lib/auth/guard";
import { getCommitments, type InsightRow } from "@/lib/queries/insights";
import { setInsightStatus } from "@/lib/actions/insights";
import { nowMs, today, urgencyOf } from "@/lib/domain/dates";
import { Button, EmptyState, Panel, PanelHeader, UrgencyDot, URGENCY_TEXT } from "@/components/ui";
import { PageHeader } from "@/components/opportunity/bits";
import { Excerpt, MentionCount, QuietFor } from "@/components/insight/bits";
import { PromoteButton } from "@/components/insight/insight-forms";
import { getDb } from "@/lib/db";
import { conversations, insightMentions } from "@/lib/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * "You said you would."
 *
 * This screen exists to compensate for memory decay, not to produce guilt — so
 * it lists only *explicit* promises, shows the exact words that made it one, and
 * offers a way out (drop it) that is exactly as prominent as the way in.
 */
export default async function CommitmentsPage() {
  const { user } = await requireViewer();
  const rows = await getCommitments(user.id);
  const evidence = await latestExcerpts(
    user.id,
    rows.map((row) => row.id),
  );

  const now = today();
  // One instant for the whole page, so two rows never disagree about "today".
  const stamp = nowMs();
  const overdue = rows.filter((row) => row.dueDate && row.dueDate < now);
  const rest = rows.filter((row) => !overdue.includes(row));

  return (
    <div className="p-5 lg:p-6 max-w-[900px]">
      <PageHeader
        title="You said you would"
        subtitle="Things you explicitly committed to in your own conversations. Anything you only floated as an idea stays out of this list."
      />

      {rows.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<Handshake size={22} />}
            title="No open commitments"
            description="Nothing you said you'd do is outstanding. Capture more conversations and explicit promises will surface here."
            action={
              <Link
                href="/conversations"
                className="text-[12px] text-accent hover:text-accent-hot hover:underline underline-offset-2"
              >
                Capture a conversation
              </Link>
            }
          />
        </Panel>
      ) : (
        <div className="grid gap-4">
          {overdue.length ? (
            <Panel>
              <PanelHeader
                title="Past the date you gave"
                subtitle="You named a day and it has gone by. Rescheduling is a perfectly good answer."
              />
              <ul className="divide-y divide-line/70">
                {overdue.map((row) => (
                  <Row key={row.id} row={row} excerpt={evidence.get(row.id)} now={stamp} />
                ))}
              </ul>
            </Panel>
          ) : null}

          <Panel>
            <PanelHeader
              title={overdue.length ? "Everything else" : "Open commitments"}
              subtitle="Dated promises first."
            />
            <ul className="divide-y divide-line/70">
              {rest.map((row) => (
                <Row key={row.id} row={row} excerpt={evidence.get(row.id)} now={stamp} />
              ))}
            </ul>
          </Panel>
        </div>
      )}
    </div>
  );
}

function Row({
  row,
  excerpt,
  now,
}: {
  row: InsightRow;
  excerpt?: { excerpt: string; conversationId: string; title: string };
  now: number;
}) {
  const urgency = urgencyOf(row.dueDate);

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <Link
            href={`/ideas/${row.id}`}
            className="text-[13px] text-ink hover:text-accent-hot transition-colors leading-snug"
          >
            {row.title}
          </Link>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
            {row.dueDate ? (
              <span
                className={cn("inline-flex items-center gap-1.5 text-[11.5px]", URGENCY_TEXT[urgency])}
              >
                <UrgencyDot urgency={urgency} />
                <span className="num">you said {row.dueDate}</span>
              </span>
            ) : (
              <span className="text-[11.5px] text-ink-faint">no date given</span>
            )}
            <MentionCount count={row.mentionCount} />
            <QuietFor since={row.lastSeenAt} now={now} />
          </div>

          {excerpt ? (
            <div className="mt-2">
              <Excerpt>“{excerpt.excerpt}”</Excerpt>
              <Link
                href={`/conversations/${excerpt.conversationId}`}
                className="inline-block mt-1 text-[11px] text-ink-faint hover:text-ink"
              >
                {excerpt.title}
              </Link>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <PromoteButton insight={row} />
          <form action={setInsightStatus}>
            <input type="hidden" name="id" value={row.id} />
            <input type="hidden" name="status" value="done" />
            <Button type="submit" variant="ghost" size="xs">
              Done
            </Button>
          </form>
          <form action={setInsightStatus}>
            <input type="hidden" name="id" value={row.id} />
            <input type="hidden" name="status" value="dropped" />
            <Button
              type="submit"
              variant="ghost"
              size="xs"
              title="Deciding not to do it is a real outcome, not a failure."
            >
              Not doing it
            </Button>
          </form>
        </div>
      </div>
    </li>
  );
}

/**
 * The words that made each of these a commitment. Shown inline because
 * "you said you would" is only fair if it can immediately show *where*.
 */
async function latestExcerpts(userId: string, insightIds: string[]) {
  const map = new Map<string, { excerpt: string; conversationId: string; title: string }>();
  if (!insightIds.length) return map;

  const db = await getDb();
  const rows = await db
    .select({
      insightId: insightMentions.insightId,
      excerpt: insightMentions.excerpt,
      conversationId: insightMentions.conversationId,
      title: conversations.title,
      occurredAt: insightMentions.occurredAt,
    })
    .from(insightMentions)
    .innerJoin(conversations, eq(insightMentions.conversationId, conversations.id))
    .where(
      and(eq(insightMentions.userId, userId), inArray(insightMentions.insightId, insightIds)),
    )
    .orderBy(desc(insightMentions.occurredAt));

  for (const row of rows) {
    if (!map.has(row.insightId)) {
      map.set(row.insightId, {
        excerpt: row.excerpt,
        conversationId: row.conversationId,
        title: row.title,
      });
    }
  }
  return map;
}
