import Link from "next/link";
import { Lightbulb, Layers } from "lucide-react";
import { requireViewer } from "@/lib/auth/guard";
import { nowMs } from "@/lib/domain/dates";
import {
  getArchaeologySummary,
  getForgotten,
  getRecurring,
  listInsights,
  type InsightRow,
} from "@/lib/queries/insights";
import {
  INSIGHT_KINDS,
  STANCES,
  type InsightKind,
  type Stance,
} from "@/lib/domain/archaeology";
import { Badge, EmptyState, Panel, PanelHeader } from "@/components/ui";
import { PageHeader, StatTile } from "@/components/opportunity/bits";
import { IdeaFilters, type IdeaSearch, type IdeaView } from "@/components/insight/filter-bar";
import {
  ConfidenceHint,
  KindBadge,
  MentionCount,
  QuietFor,
  SeenRange,
  StanceBadge,
} from "@/components/insight/bits";

export const dynamic = "force-dynamic";

const VIEWS: IdeaView[] = ["all", "recurring", "forgotten", "promoted", "archived"];

export default async function IdeasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { user } = await requireViewer();

  const search: IdeaSearch = {
    view: pick(params.view, VIEWS) ?? "all",
    kind: pick(params.kind, INSIGHT_KINDS),
    stance: pick(params.stance, STANCES),
    q: one(params.q),
    sort: one(params.sort),
  };

  const [rows, summary] = await Promise.all([
    load(user.id, search),
    getArchaeologySummary(user.id),
  ]);
  // One instant for the whole page, so two rows never disagree about "today".
  const now = nowMs();

  return (
    <div className="p-5 lg:p-6 max-w-[1180px]">
      <PageHeader
        title="Ideas"
        subtitle="Everything recovered from your own conversations. Nothing here is work until you promote it."
        action={
          summary.duplicates ? (
            <Link
              href="/ideas/duplicates"
              className="inline-flex items-center gap-1.5 h-[30px] px-3 rounded-[6px] border border-duesoon/40 bg-duesoon/10 text-[12px] text-duesoon hover:bg-duesoon/15 transition-colors"
            >
              <Layers size={13} />
              {summary.duplicates} possible duplicate{summary.duplicates === 1 ? "" : "s"}
            </Link>
          ) : null
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-5">
        <StatTile label="Recovered" value={summary.insights} sub="across all conversations" />
        <StatTile
          label="You said you would"
          value={summary.commitments}
          tone={summary.overdueCommitments > 0 ? "urgent" : "neutral"}
          sub={
            summary.overdueCommitments
              ? `${summary.overdueCommitments} past their date`
              : "explicit promises"
          }
          href="/commitments"
        />
        <StatTile
          label="Forgotten"
          value={summary.forgotten}
          sub="quiet, never dropped"
          href="/ideas?view=forgotten"
        />
        <StatTile
          label="Recurring"
          value={summary.recurring}
          sub="mentioned 3+ times"
          href="/ideas?view=recurring"
        />
      </div>

      <IdeaFilters search={search} />

      <Panel>
        <PanelHeader
          title={title(search.view)}
          subtitle={subtitle(search.view)}
          action={
            <span className="num text-[11.5px] text-ink-faint">
              {rows.length} result{rows.length === 1 ? "" : "s"}
            </span>
          }
        />

        {rows.length === 0 ? (
          <EmptyState
            icon={<Lightbulb size={22} />}
            title={summary.conversations ? "Nothing matches" : "No conversations captured yet"}
            description={
              summary.conversations
                ? "Try a wider filter, or capture more conversations."
                : "Capture a conversation and the ideas, commitments and decisions inside it will land here."
            }
            action={
              summary.conversations ? null : (
                <Link
                  href="/conversations"
                  className="text-[12px] text-accent hover:text-accent-hot hover:underline underline-offset-2"
                >
                  Capture a conversation
                </Link>
              )
            }
          />
        ) : (
          <ul className="divide-y divide-line/70">
            {rows.map((row) => (
              <InsightRowItem key={row.id} row={row} now={now} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function InsightRowItem({ row, now }: { row: InsightRow; now: number }) {
  return (
    <li className="row-link">
      <Link href={`/ideas/${row.id}`} className="block px-4 py-3 group">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <KindBadge kind={row.kind} />
          <StanceBadge stance={row.stance} />
          {row.status === "promoted" ? <Badge tone="good">Promoted</Badge> : null}
          {row.status === "archived" ? <Badge tone="neutral">Archived</Badge> : null}
          {row.pinned ? <Badge tone="accent">Pinned</Badge> : null}
          <ConfidenceHint confidence={row.confidence} />
        </div>

        <p className="text-[13px] text-ink group-hover:text-accent-hot transition-colors leading-snug">
          {row.title}
        </p>

        {row.summary ? (
          <p className="text-[12px] text-ink-faint leading-relaxed mt-1 line-clamp-2">
            {row.summary}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
          <MentionCount count={row.mentionCount} />
          <SeenRange first={row.firstSeenAt} last={row.lastSeenAt} />
          <QuietFor since={row.lastSeenAt} now={now} />
          {row.dueDate ? (
            <span className="num text-[11px] text-duetoday">said: {row.dueDate}</span>
          ) : null}
        </div>
      </Link>
    </li>
  );
}

async function load(userId: string, search: IdeaSearch): Promise<InsightRow[]> {
  if (search.view === "recurring") return getRecurring(userId, 60);
  if (search.view === "forgotten") return getForgotten(userId, 60);

  return listInsights(userId, {
    kind: (search.kind as InsightKind) ?? null,
    stance: (search.stance as Stance) ?? null,
    status:
      search.view === "promoted" ? "promoted" : search.view === "archived" ? "archived" : null,
    search: search.q,
    sort: (search.sort as "recent" | "mentions" | "oldest" | "title") ?? "recent",
  });
}

function title(view: IdeaView): string {
  return {
    all: "Everything recovered",
    recurring: "Recurring",
    forgotten: "Forgotten",
    promoted: "Promoted into work",
    archived: "Archived",
  }[view];
}

function subtitle(view: IdeaView): string | undefined {
  return {
    all: undefined,
    recurring:
      "Mentioned three or more times. Frequency shows what holds your attention — it is not evidence that something is worth doing.",
    forgotten:
      "Developed enough to matter, never explicitly dropped, and untouched for a month. Anything you decided against is excluded.",
    promoted: "These became builds. They live on the pipeline now.",
    archived: "Set aside by you. Kept, because the evidence is still worth having.",
  }[view];
}

function one(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() ? raw.trim() : null;
}

function pick<T extends string>(
  value: string | string[] | undefined,
  allowed: readonly T[],
): T | null {
  const raw = one(value);
  return raw && (allowed as readonly string[]).includes(raw) ? (raw as T) : null;
}
