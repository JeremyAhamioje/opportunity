import { requireViewer } from "@/lib/auth/guard";
import { getCategoryStats, getFunnel, getWeeklyActivity } from "@/lib/queries/analytics";
import { getSummary } from "@/lib/queries/opportunities";
import { CATEGORY_META } from "@/lib/domain/types";
import { EmptyState, Panel, PanelHeader } from "@/components/ui";
import { PageHeader, StatTile } from "@/components/opportunity/bits";
import { CategoryComparison, FunnelChart, WeeklyChart } from "@/components/analytics/charts";
import { CoreLoop } from "@/components/brand/core-loop";
import { pct } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const { user } = await requireViewer();
  const [stats, weekly, funnel, summary] = await Promise.all([
    getCategoryStats(user.id),
    getWeeklyActivity(user.id, 8),
    getFunnel(user.id),
    getSummary(user.id),
  ]);

  const sent = stats.reduce((sum, row) => sum + row.sent, 0);
  const replied = stats.reduce((sum, row) => sum + row.responses, 0);
  const positive = stats.reduce((sum, row) => sum + row.positive, 0);
  const won = stats.reduce((sum, row) => sum + row.won, 0);

  // The whole point of this page: which category repays the effort?
  const ranked = stats.filter((row) => row.sent >= 3).sort((a, b) => b.responseRate - a.responseRate);
  const best = ranked[0];
  const worst = ranked.length > 1 ? ranked[ranked.length - 1] : null;

  return (
    <div className="p-5 lg:p-6 max-w-[1240px]">
      <PageHeader
        title="Analytics"
        subtitle="Which shots actually work — so effort goes where the results are, not where it feels productive."
        action={<CoreLoop active="measure" className="hidden xl:block" size="sm" />}
      />

      <section className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 mb-4">
        <StatTile label="Shots taken" value={sent} sub="Applications & outreach sent" />
        <StatTile label="Responses" value={replied} sub={`${pct(replied, sent)}% of shots`} />
        <StatTile
          label="Positive"
          value={positive}
          sub={`${pct(positive, sent)}% of shots`}
          tone={positive > 0 ? "good" : "neutral"}
        />
        <StatTile
          label="Interviews"
          value={stats.reduce((sum, row) => sum + row.interviews, 0)}
          sub="Reached discussion"
        />
        <StatTile label="Won" value={won} sub={won > 0 ? "Landed" : "Not yet"} tone={won > 0 ? "good" : "neutral"} />
      </section>

      {best ? (
        <section className="border border-line rounded-[10px] bg-surface px-4 py-3.5 mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-ink-faint mb-1.5">
            What the numbers say
          </p>
          <p className="text-[14px] leading-snug">
            <span aria-hidden>{CATEGORY_META[best.category].icon}</span>{" "}
            <span className="font-semibold">{CATEGORY_META[best.category].label}s</span> are your
            best-performing shot at{" "}
            <span className="num font-semibold text-good">{best.responseRate}%</span> response rate
            across {best.sent} sent.
            {worst && worst.category !== best.category ? (
              <>
                {" "}
                {CATEGORY_META[worst.category].short} sits at{" "}
                <span className="num">{worst.responseRate}%</span> across {worst.sent} — worth
                asking whether those hours would return more spent on{" "}
                {CATEGORY_META[best.category].short.toLowerCase()}.
              </>
            ) : null}
          </p>
          <p className="text-[11px] text-ink-faint mt-1.5">
            Only categories with at least 3 shots sent are ranked — below that the rate is noise.
          </p>
        </section>
      ) : null}

      <div className="grid xl:grid-cols-2 gap-4 items-start">
        <Panel>
          <PanelHeader
            title="Response rate by category"
            subtitle="Measured against shots actually sent, not the size of the pipeline"
          />
          <CategoryComparison stats={stats} />
        </Panel>

        <Panel>
          <PanelHeader
            title="Conversion funnel"
            subtitle="Where opportunities stop moving"
          />
          {summary.active + summary.sent > 0 ? (
            <FunnelChart stages={funnel} />
          ) : (
            <EmptyState
              title="Nothing in the funnel yet"
              description="Add opportunities and the drop-off between stages appears here."
            />
          )}
        </Panel>

        <Panel className="xl:col-span-2">
          <PanelHeader
            title="Last 8 weeks"
            subtitle="Shots taken against opportunities added — the only two numbers that compound"
          />
          <WeeklyChart points={weekly} />
        </Panel>

        <Panel className="xl:col-span-2 overflow-hidden">
          <PanelHeader title="Breakdown" subtitle="Every number on this page, per category" />
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.11em] text-ink-faint bg-canvas/40">
                  <th className="font-semibold px-4 py-2.5 border-b border-line">Category</th>
                  <th className="font-semibold px-3 py-2.5 border-b border-line text-right">In pipeline</th>
                  <th className="font-semibold px-3 py-2.5 border-b border-line text-right">Sent</th>
                  <th className="font-semibold px-3 py-2.5 border-b border-line text-right">Replies</th>
                  <th className="font-semibold px-3 py-2.5 border-b border-line text-right">Positive</th>
                  <th className="font-semibold px-3 py-2.5 border-b border-line text-right">Interviews</th>
                  <th className="font-semibold px-3 py-2.5 border-b border-line text-right">Won</th>
                  <th className="font-semibold px-3 py-2.5 border-b border-line text-right">Lost</th>
                  <th className="font-semibold px-3 py-2.5 border-b border-line text-right">Response rate</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((row) => (
                  <tr key={row.category} className="border-b border-line/50 last:border-0">
                    <td className="px-4 py-2.5 text-[12.5px]">
                      <span aria-hidden className="mr-1.5">
                        {CATEGORY_META[row.category].icon}
                      </span>
                      {CATEGORY_META[row.category].short}
                    </td>
                    <td className="num px-3 py-2.5 text-[12px] text-right text-ink-muted">{row.total}</td>
                    <td className="num px-3 py-2.5 text-[12px] text-right">{row.sent}</td>
                    <td className="num px-3 py-2.5 text-[12px] text-right">{row.responses}</td>
                    <td className="num px-3 py-2.5 text-[12px] text-right text-good">{row.positive}</td>
                    <td className="num px-3 py-2.5 text-[12px] text-right">{row.interviews}</td>
                    <td className="num px-3 py-2.5 text-[12px] text-right text-good">{row.won}</td>
                    <td className="num px-3 py-2.5 text-[12px] text-right text-ink-faint">{row.lost}</td>
                    <td className="num px-3 py-2.5 text-[12.5px] text-right font-semibold">
                      {row.sent > 0 ? `${row.responseRate}%` : "—"}
                    </td>
                  </tr>
                ))}
                <tr className="bg-canvas/40">
                  <td className="px-4 py-2.5 text-[12.5px] font-semibold">All</td>
                  <td className="num px-3 py-2.5 text-[12px] text-right text-ink-muted">
                    {stats.reduce((sum, row) => sum + row.total, 0)}
                  </td>
                  <td className="num px-3 py-2.5 text-[12px] text-right">{sent}</td>
                  <td className="num px-3 py-2.5 text-[12px] text-right">{replied}</td>
                  <td className="num px-3 py-2.5 text-[12px] text-right text-good">{positive}</td>
                  <td className="num px-3 py-2.5 text-[12px] text-right">
                    {stats.reduce((sum, row) => sum + row.interviews, 0)}
                  </td>
                  <td className="num px-3 py-2.5 text-[12px] text-right text-good">{won}</td>
                  <td className="num px-3 py-2.5 text-[12px] text-right text-ink-faint">
                    {stats.reduce((sum, row) => sum + row.lost, 0)}
                  </td>
                  <td className="num px-3 py-2.5 text-[12.5px] text-right font-semibold">
                    {sent > 0 ? `${pct(replied, sent)}%` : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
