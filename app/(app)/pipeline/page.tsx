import { requireViewer } from "@/lib/auth/guard";
import { listOpportunities } from "@/lib/queries/opportunities";
import {
  CATEGORIES,
  CATEGORY_META,
  OUTREACH_CATEGORIES,
  type Category,
} from "@/lib/domain/types";
import { ButtonLink, EmptyState, Panel } from "@/components/ui";
import { PageHeader } from "@/components/opportunity/bits";
import { PipelineBoard, type BoardCard } from "@/components/opportunity/pipeline-board";
import { CoreLoop } from "@/components/brand/core-loop";
import { cn } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { user, settings } = await requireViewer();
  const params = await searchParams;
  const category = CATEGORIES.includes(params.category as Category)
    ? (params.category as Category)
    : undefined;

  const all = await listOpportunities(user.id, settings.scoringWeights, {
    category: category ?? "all",
    sort: "score",
    limit: 400,
  });

  // Builds have no outreach, so they would sit permanently in the first three
  // columns of a board whose later columns are about someone replying. They get
  // their own seven-column lane at /builds instead.
  const rows = all.filter((row) => row.category !== "build");

  const cards: BoardCard[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    company: row.companyName,
    category: row.category,
    stage: row.stage,
    score: row.score.total,
    nextFollowUpAt: row.nextFollowUpAt,
    deadline: row.deadline,
    isMock: row.isMock,
  }));

  return (
    <div className="p-5 lg:p-6">
      <PageHeader
        title="Pipeline"
        subtitle="Drag a card to move it, or use the stage menu on any card. Changes save immediately."
        action={<CoreLoop active="track" className="hidden xl:block" size="sm" />}
      />

      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        <FilterChip href="/pipeline" active={!category} label="All" count={rows.length} />
        {OUTREACH_CATEGORIES.map((value) => (
          <FilterChip
            key={value}
            href={`/pipeline?category=${value}`}
            active={category === value}
            label={`${CATEGORY_META[value].icon} ${CATEGORY_META[value].short}`}
          />
        ))}
        <Link
          href="/builds"
          className="h-[26px] px-2.5 inline-flex items-center gap-1.5 rounded-[5px] border border-line text-[12px] text-ink-muted hover:text-ink hover:border-line-strong transition-colors ml-auto"
        >
          🔨 Builds →
        </Link>
      </div>

      {cards.length ? (
        <PipelineBoard cards={cards} />
      ) : (
        <Panel>
          <EmptyState
            title="The board is empty"
            description="Add an opportunity with N, or paste research findings into the import screen to fill the first column."
            action={
              <ButtonLink href="/import" size="sm">
                Import research
              </ButtonLink>
            }
          />
        </Panel>
      )}
    </div>
  );
}

function FilterChip({
  href,
  label,
  active,
  count,
}: {
  href: string;
  label: string;
  active: boolean;
  count?: number;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "h-[26px] px-2.5 inline-flex items-center gap-1.5 rounded-[5px] border text-[12px] transition-colors",
        active
          ? "border-accent/45 bg-accent/10 text-accent-hot"
          : "border-line text-ink-muted hover:text-ink hover:border-line-strong",
      )}
    >
      {label}
      {typeof count === "number" ? (
        <span className="num text-[10.5px] text-ink-faint">{count}</span>
      ) : null}
    </Link>
  );
}
