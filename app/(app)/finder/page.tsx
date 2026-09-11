import Link from "next/link";
import { requireViewer } from "@/lib/auth/guard";
import { listOpportunities } from "@/lib/queries/opportunities";
import { SCORE_FACTORS, SCORE_FACTOR_META } from "@/lib/domain/types";
import {
  ButtonLink,
  EmptyState,
  Panel,
  PanelHeader,
  ProgressBar,
  SectionTitle,
} from "@/components/ui";
import { PageHeader, ScorePill, StageBadge } from "@/components/opportunity/bits";
import { SopEditor, SopReset } from "@/components/finder/sop-editor";
import { CoreLoop } from "@/components/brand/core-loop";

export const dynamic = "force-dynamic";

export default async function FinderPage() {
  const { user, settings } = await requireViewer();

  const workflows = await listOpportunities(user.id, settings.scoringWeights, {
    category: "workflow",
    status: "open",
    sort: "score",
    limit: 60,
  });

  const totalChecks = settings.sopChecklist.steps.reduce(
    (sum, step) => sum + step.items.length,
    0,
  );

  return (
    <div className="p-5 lg:p-6 max-w-[1300px]">
      <PageHeader
        title="🔍 Workflow Opportunity Finder"
        subtitle="The repeatable procedure for spotting a company whose manual work you could delete. Edit it as you learn what actually predicts a deal."
        action={<CoreLoop active="qualify" className="hidden xl:block" size="sm" />}
      />

      <div className="grid xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)] gap-4 items-start">
        <Panel>
          <PanelHeader
            title="The SOP"
            subtitle={`${settings.sopChecklist.steps.length} steps · ${totalChecks} checks. Editing here changes the checklist on every opportunity.`}
            action={<SopReset />}
          />
          <SopEditor checklist={settings.sopChecklist} />
        </Panel>

        <div className="flex flex-col gap-4 min-w-0">
          <Panel>
            <PanelHeader
              title="Run it against"
              subtitle="Open workflow opportunities and how far through the checklist each one is"
              action={
                <ButtonLink href="/opportunities?category=workflow" variant="ghost" size="xs">
                  All
                </ButtonLink>
              }
            />
            {workflows.length ? (
              <ul className="divide-y divide-line/60">
                {workflows.slice(0, 12).map((row) => {
                  const done = row.sopProgress.length;
                  return (
                    <li key={row.id}>
                      <Link
                        href={`/opportunities/${row.id}`}
                        className="row-link block px-4 py-2.5"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="min-w-0 flex-1">
                            <span className="block text-[12.5px] truncate">
                              {row.companyName ?? "Unassigned"}
                            </span>
                            <span className="block text-[10.5px] text-ink-faint truncate">
                              {row.title}
                            </span>
                          </span>
                          <StageBadge stage={row.stage} short />
                          <ScorePill score={row.score} />
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <ProgressBar
                            value={done}
                            max={Math.max(1, totalChecks)}
                            tone={done >= totalChecks ? "good" : "accent"}
                            className="flex-1"
                          />
                          <span className="num text-[10px] text-ink-faint shrink-0">
                            {done}/{totalChecks}
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                title="No open workflow opportunities"
                description="Add one with N, or import research findings — then work each through this checklist."
                action={
                  <ButtonLink href="/import" size="sm">
                    Import research
                  </ButtonLink>
                }
              />
            )}
          </Panel>

          <Panel className="px-4 py-3.5">
            <SectionTitle className="mb-2.5">How the score works</SectionTitle>
            <p className="text-[12px] text-ink-muted leading-relaxed mb-3">
              Step 4 of the SOP feeds the 0–100 opportunity score. Each factor is rated 0–10 and
              weighted by your settings, so the score reflects what you actually care about rather
              than a fixed formula.
            </p>
            <ul className="flex flex-col gap-2">
              {SCORE_FACTORS.map((factor) => (
                <li key={factor} className="flex items-baseline gap-2">
                  <span className="text-[11.5px] text-ink w-[104px] shrink-0">
                    {SCORE_FACTOR_META[factor].label}
                  </span>
                  <span className="text-[11px] text-ink-faint leading-snug flex-1">
                    {SCORE_FACTOR_META[factor].hint}
                  </span>
                  {settings.scoringWeights[factor] !== 1 ? (
                    <span className="num text-[10.5px] text-accent shrink-0">
                      ×{settings.scoringWeights[factor]}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
            <div className="mt-3.5 pt-3 border-t border-line/70 flex items-center justify-between gap-2">
              <span className="text-[11px] text-ink-faint">
                80+ is high priority. Below 40, spend the hour elsewhere.
              </span>
              <ButtonLink href="/settings#weights" variant="ghost" size="xs">
                Edit weights
              </ButtonLink>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
