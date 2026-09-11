import Link from "next/link";
import { ArrowLeft, CheckCheck } from "lucide-react";
import { requireViewer } from "@/lib/auth/guard";
import { getDuplicateSuggestions, type DuplicatePair } from "@/lib/queries/insights";
import { mergeInsights, rejectLink } from "@/lib/actions/insights";
import { Button, EmptyState, Panel } from "@/components/ui";
import { PageHeader } from "@/components/opportunity/bits";
import { KindBadge, MentionCount, SeenRange } from "@/components/insight/bits";
import type { InsightKind } from "@/lib/domain/archaeology";

export const dynamic = "force-dynamic";

/**
 * The review queue. Nothing on this screen has been applied — every pair is a
 * suggestion, because silently collapsing two ideas that only looked alike
 * destroys information the user cannot get back, while an unreviewed suggestion
 * costs one click.
 */
export default async function DuplicatesPage() {
  const { user } = await requireViewer();
  const pairs = await getDuplicateSuggestions(user.id);

  return (
    <div className="p-5 lg:p-6 max-w-[900px]">
      <Link
        href="/ideas"
        className="inline-flex items-center gap-1.5 text-[12px] text-ink-faint hover:text-ink mb-3"
      >
        <ArrowLeft size={13} /> Ideas
      </Link>

      <PageHeader
        title="Possible duplicates"
        subtitle="The same idea often comes back under a different name. These pairs looked alike — you decide whether they are the same thing."
      />

      {pairs.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<CheckCheck size={22} />}
            title="Nothing to review"
            description="Every suggested duplicate has been resolved."
          />
        </Panel>
      ) : (
        <div className="grid gap-3">
          {pairs.map((pair) => (
            <PairCard key={pair.linkId} pair={pair} />
          ))}
        </div>
      )}
    </div>
  );
}

function PairCard({ pair }: { pair: DuplicatePair }) {
  // The one with more evidence behind it is the better survivor, so it is
  // offered first — but both directions are available, because the better
  // *name* is not always on the row with more mentions.
  const [primary, secondary] =
    pair.left.mentionCount >= pair.right.mentionCount
      ? [pair.left, pair.right]
      : [pair.right, pair.left];

  return (
    <Panel className="overflow-hidden">
      <div className="px-4 py-2.5 border-b border-line flex items-center gap-2">
        <span className="text-[11.5px] text-ink-muted">{pair.reason}</span>
        {pair.confidence !== null ? (
          <span className="num text-[11px] text-ink-faint ml-auto">{pair.confidence}% overlap</span>
        ) : null}
      </div>

      <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-line/70">
        <Side insight={primary} />
        <Side insight={secondary} />
      </div>

      <div className="px-4 py-3 border-t border-line bg-canvas/40 flex flex-wrap items-center gap-2">
        <form action={mergeInsights}>
          <input type="hidden" name="keepId" value={primary.id} />
          <input type="hidden" name="dropId" value={secondary.id} />
          <Button type="submit" size="xs">
            Merge into “{truncate(primary.title)}”
          </Button>
        </form>

        <form action={mergeInsights}>
          <input type="hidden" name="keepId" value={secondary.id} />
          <input type="hidden" name="dropId" value={primary.id} />
          <Button type="submit" variant="secondary" size="xs">
            Merge into “{truncate(secondary.title)}”
          </Button>
        </form>

        <form action={rejectLink} className="ml-auto">
          <input type="hidden" name="linkId" value={pair.linkId} />
          <Button type="submit" variant="ghost" size="xs">
            Keep separate
          </Button>
        </form>
      </div>

      <p className="px-4 pb-3 text-[11px] text-ink-faint">
        Merging moves every mention onto the survivor — no evidence is lost, and the count stays
        honest.
      </p>
    </Panel>
  );
}

function Side({ insight }: { insight: DuplicatePair["left"] }) {
  return (
    <div className="px-4 py-3 min-w-0">
      <div className="flex items-center gap-2 mb-1.5">
        <KindBadge kind={insight.kind as InsightKind} />
        <MentionCount count={insight.mentionCount} />
      </div>
      <Link
        href={`/ideas/${insight.id}`}
        className="block text-[13px] text-ink hover:text-accent-hot transition-colors leading-snug"
      >
        {insight.title}
      </Link>
      {insight.summary ? (
        <p className="text-[11.5px] text-ink-faint leading-relaxed mt-1 line-clamp-3">
          {insight.summary}
        </p>
      ) : null}
      <div className="mt-1.5">
        <SeenRange first={null} last={insight.lastSeenAt} />
      </div>
    </div>
  );
}

function truncate(value: string): string {
  return value.length > 28 ? `${value.slice(0, 26)}…` : value;
}
