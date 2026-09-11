import Link from "next/link";
import { ExternalLink as ExternalIcon } from "lucide-react";
import { requireViewer } from "@/lib/auth/guard";
import { getFilterOptions, listOpportunities } from "@/lib/queries/opportunities";
import {
  CATEGORIES,
  CATEGORY_META,
  EMAIL_STATUS_META,
  STAGES,
  type Category,
  type Stage,
} from "@/lib/domain/types";
import { ButtonLink, EmptyState, Panel } from "@/components/ui";
import {
  DeadlineCell,
  FollowUpCell,
  MockBadge,
  OpportunityThumb,
  PageHeader,
  ScorePill,
  StageBadge,
} from "@/components/opportunity/bits";
import { isPlaceholderUrl, normalizeUrl } from "@/lib/utils";
import { FilterBar } from "@/components/opportunity/filter-bar";

export const dynamic = "force-dynamic";

type Params = {
  q?: string;
  category?: string;
  stage?: string;
  status?: string;
  industry?: string;
  size?: string;
  minScore?: string;
  added?: string;
  sort?: string;
};

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const { user, settings } = await requireViewer();
  const params = await searchParams;

  const [rows, options] = await Promise.all([
    listOpportunities(user.id, settings.scoringWeights, {
      q: params.q,
      category: CATEGORIES.includes(params.category as Category)
        ? (params.category as Category)
        : "all",
      stage: STAGES.includes(params.stage as Stage) ? (params.stage as Stage) : "all",
      status:
        params.status === "open" || params.status === "closed" ? params.status : "all",
      industry: params.industry,
      companySize: params.size,
      minScore: params.minScore ? Number(params.minScore) : undefined,
      addedWithinDays: params.added ? Number(params.added) : undefined,
      sort: (params.sort as "recent" | "score" | "followup" | "deadline" | "company") ?? "recent",
    }),
    getFilterOptions(user.id),
  ]);

  return (
    <div className="p-5 lg:p-6">
      <PageHeader
        title="Opportunities"
        subtitle="Every shot, taken or waiting. Filters are stored in the URL, so any view can be bookmarked."
        action={
          <ButtonLink href="/import" variant="secondary" size="sm">
            Import research
          </ButtonLink>
        }
      />

      <FilterBar industries={options.industries} sizes={options.sizes} total={rows.length} />

      <Panel className="overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            title="No opportunities match"
            description="Loosen the filters, or add a new opportunity by pressing N anywhere in the app."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[980px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.11em] text-ink-faint bg-canvas/40">
                  <th className="font-semibold px-4 py-2.5 border-b border-line">Company</th>
                  <th className="font-semibold px-3 py-2.5 border-b border-line">Opportunity</th>
                  <th className="font-semibold px-3 py-2.5 border-b border-line">Stage</th>
                  <th className="font-semibold px-3 py-2.5 border-b border-line">Email</th>
                  <th className="font-semibold px-3 py-2.5 border-b border-line text-right">Score</th>
                  <th className="font-semibold px-3 py-2.5 border-b border-line">Follow-up</th>
                  <th className="font-semibold px-3 py-2.5 border-b border-line">Deadline</th>
                  <th className="font-semibold px-3 py-2.5 border-b border-line">Links</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="row-link border-b border-line/50 last:border-0">
                    <td className="px-4 py-2.5 max-w-[210px]">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <OpportunityThumb category={row.category} src={row.image} />
                        <div className="min-w-0">
                          {row.companyId ? (
                            <Link
                              href={`/companies/${row.companyId}`}
                              className="block text-[12.5px] font-medium truncate hover:text-accent-hot transition-colors"
                            >
                              {row.companyName ?? "Unassigned"}
                            </Link>
                          ) : (
                            <span className="block text-[12.5px] text-ink-faint truncate">
                              Unassigned
                            </span>
                          )}
                          {row.companyIndustry ? (
                            <p className="text-[10.5px] text-ink-faint truncate mt-0.5">
                              {row.companyIndustry}
                              {row.companySize ? ` · ${row.companySize}` : ""}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </td>

                    <td className="px-3 py-2.5 max-w-[280px]">
                      <span className="flex items-center gap-2 min-w-0">
                        <Link
                          href={`/opportunities/${row.id}`}
                          className="text-[12.5px] hover:text-accent-hot transition-colors truncate"
                        >
                          {row.title}
                        </Link>
                        {row.isMock ? <MockBadge /> : null}
                      </span>
                      {/* The thumbnail replaced the category glyph, so the
                          category is spelled out here rather than lost. */}
                      <p className="text-[10.5px] text-ink-faint truncate mt-0.5">
                        {[
                          CATEGORY_META[row.category].short,
                          row.location,
                          row.workMode,
                          row.salary,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </td>

                    <td className="px-3 py-2.5">
                      <StageBadge stage={row.stage} short category={row.category} />
                    </td>

                    <td className="px-3 py-2.5">
                      <span className="text-[11.5px] text-ink-muted whitespace-nowrap">
                        {EMAIL_STATUS_META[row.emailStatus]}
                      </span>
                    </td>

                    <td className="px-3 py-2.5 text-right">
                      <ScorePill score={row.score} />
                    </td>

                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <FollowUpCell date={row.nextFollowUpAt} emptyLabel="—" />
                    </td>

                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <DeadlineCell date={row.deadline} />
                    </td>

                    <td className="px-3 py-2.5">
                      {/* Demo rows carry reserved domains that cannot resolve —
                          shown, but never dressed up as somewhere to go. */}
                      <div className="flex items-center gap-2">
                        {row.applicationUrl && !isPlaceholderUrl(row.applicationUrl) ? (
                          <a
                            href={normalizeUrl(row.applicationUrl)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Application link"
                            className="text-ink-faint hover:text-accent transition-colors"
                          >
                            <ExternalIcon size={12} />
                          </a>
                        ) : null}
                        {row.companyWebsite && !isPlaceholderUrl(row.companyWebsite) ? (
                          <a
                            href={normalizeUrl(row.companyWebsite)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Company website"
                            className="text-[11px] text-ink-faint hover:text-accent transition-colors"
                          >
                            www
                          </a>
                        ) : null}
                        {isPlaceholderUrl(row.applicationUrl) ||
                        isPlaceholderUrl(row.companyWebsite) ? (
                          <span
                            title="Placeholder domain from demo data — this address does not exist"
                            className="text-[11px] text-ink-faint/70"
                          >
                            demo
                          </span>
                        ) : null}
                        {!row.applicationUrl && !row.companyWebsite ? (
                          <span className="text-[11px] text-ink-faint">—</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
