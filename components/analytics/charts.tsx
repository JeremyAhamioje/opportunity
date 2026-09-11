import { CATEGORY_META, type Category } from "@/lib/domain/types";
import { cn, pct } from "@/lib/utils";
import type { CategoryStats, Funnel, WeeklyPoint } from "@/lib/queries/analytics";

/**
 * Charts are built from divs, not a charting library: three small forms, a
 * validated palette, CSS-only hover, and no runtime dependency.
 *
 * Palette note — chart fills use the --color-chart-* tokens, which are the
 * dark-mode-validated steps of the category hues. Every mark is also directly
 * labelled, so identity never rests on colour alone.
 */

const CATEGORY_FILL: Record<Category, string> = {
  workflow: "bg-chart-workflow",
  speculative: "bg-chart-speculative",
  job: "bg-chart-job",
  scholarship: "bg-chart-scholarship",
  build: "bg-chart-build",
};

/* -------------------------------------------------------------------------- */
/*  Which shots actually land — response rate by category                     */
/* -------------------------------------------------------------------------- */

export function CategoryComparison({ stats }: { stats: CategoryStats[] }) {
  const active = stats.filter((row) => row.total > 0);

  if (!active.length) {
    return (
      <p className="px-4 py-8 text-center text-[12.5px] text-ink-faint">
        Take some shots and the comparison appears here.
      </p>
    );
  }

  return (
    <div className="px-4 py-3.5 flex flex-col gap-3.5">
      {active.map((row) => {
        const meta = CATEGORY_META[row.category];
        return (
          <div key={row.category}>
            <div className="flex items-baseline gap-2 mb-1.5">
              <span aria-hidden className="text-[12px]">
                {meta.icon}
              </span>
              <span className="text-[12.5px] font-medium">{meta.short}</span>
              <span className="text-[11px] text-ink-faint">
                {row.sent} sent · {row.responses} replied · {row.positive} positive
              </span>
              <span
                className={cn(
                  "num text-[13px] font-semibold ml-auto",
                  row.responseRate >= 20
                    ? "text-good"
                    : row.responseRate > 0
                      ? "text-ink"
                      : "text-ink-faint",
                )}
              >
                {row.sent > 0 ? `${row.responseRate}%` : "—"}
              </span>
            </div>

            {/* Response rate, with the positive share nested inside it. */}
            <div className="group relative">
              <div className="relative h-[9px] rounded-[4px] bg-chart-track overflow-hidden">
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-[4px]",
                    CATEGORY_FILL[row.category],
                  )}
                  style={{ width: `${row.sent > 0 ? row.responseRate : 0}%` }}
                />
                <div
                  className="absolute inset-y-0 left-0 rounded-[4px] bg-white/35"
                  style={{ width: `${row.sent > 0 ? row.positiveRate : 0}%` }}
                />
              </div>
              <Tooltip>
                {meta.short}: {row.responses}/{row.sent} replied ({row.responseRate}%), {row.positive}{" "}
                positive ({row.positiveRate}%)
              </Tooltip>
            </div>

            <div className="flex items-center gap-3 mt-1.5 text-[10.5px] text-ink-faint">
              <span>
                <span className="num">{row.total}</span> total in pipeline
              </span>
              <span>
                <span className="num">{row.interviews}</span> reached interview
              </span>
              <span>
                <span className="num">{row.won}</span> won
              </span>
              <span className="ml-auto">
                {row.positiveRate}% positive of sent
              </span>
            </div>
          </div>
        );
      })}

      <p className="text-[10.5px] text-ink-faint pt-1 border-t border-line/70 leading-relaxed">
        Bars show response rate as a share of shots actually sent. The lighter inner bar is the
        positive share of the same total.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Funnel — one series, so no legend; every stage is directly labelled        */
/* -------------------------------------------------------------------------- */

export function FunnelChart({ stages }: { stages: Funnel[] }) {
  const max = Math.max(1, ...stages.map((stage) => stage.count));

  return (
    <div className="px-4 py-3.5 flex flex-col gap-2">
      {stages.map((stage, index) => {
        const previous = index > 0 ? stages[index - 1].count : null;
        const conversion = previous ? pct(stage.count, previous) : null;

        return (
          <div key={stage.stage} className="grid grid-cols-[92px_1fr_66px] items-center gap-2.5">
            <span className="text-[11.5px] text-ink-muted truncate">{stage.label}</span>
            <div className="group relative">
              <div className="relative h-[16px] rounded-[4px] bg-chart-track overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-[4px] bg-chart-primary"
                  style={{
                    width: `${Math.max(stage.count > 0 ? 2 : 0, (stage.count / max) * 100)}%`,
                  }}
                />
              </div>
              <Tooltip>
                {stage.count} at {stage.label.toLowerCase()}
                {conversion !== null ? ` · ${conversion}% of the previous stage` : ""}
              </Tooltip>
            </div>
            <span className="num text-[12px] text-right">
              {stage.count}
              {conversion !== null ? (
                <span className="text-[10px] text-ink-faint ml-1">{conversion}%</span>
              ) : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Eight weeks of activity — two series, so a legend is mandatory             */
/* -------------------------------------------------------------------------- */

export function WeeklyChart({ points }: { points: WeeklyPoint[] }) {
  const max = Math.max(1, ...points.flatMap((point) => [point.sent, point.added]));
  const totalSent = points.reduce((sum, point) => sum + point.sent, 0);
  const totalAdded = points.reduce((sum, point) => sum + point.added, 0);

  return (
    <div className="px-4 py-3.5">
      <div className="flex items-center gap-4 mb-3">
        <LegendKey color="bg-chart-primary" label="Shots taken" value={totalSent} />
        <LegendKey color="bg-chart-secondary" label="Opportunities added" value={totalAdded} />
        <span className="num text-[10.5px] text-ink-faint ml-auto">peak {max}/week</span>
      </div>

      <div className="flex items-end gap-1.5 h-[104px]">
        {points.map((point) => (
          <div key={point.week} className="flex-1 flex flex-col justify-end items-center gap-1.5 h-full">
            <div className="group relative w-full flex items-end justify-center gap-[2px] h-full">
              <Bar value={point.sent} max={max} fill="bg-chart-primary" />
              <Bar value={point.added} max={max} fill="bg-chart-secondary" />
              <Tooltip>
                Week of {point.label} — {point.sent} sent, {point.added} added
              </Tooltip>
            </div>
            <span className="num text-[9.5px] text-ink-faint">{point.label}</span>
          </div>
        ))}
      </div>
      <div className="border-t border-line mt-0.5 pt-2">
        <p className="text-[10.5px] text-ink-faint leading-relaxed">
          Weeks run Monday to Sunday. A gap between the two series means the funnel is filling
          faster than it is emptying — or the other way round.
        </p>
      </div>
    </div>
  );
}

function Bar({ value, max, fill }: { value: number; max: number; fill: string }) {
  const height = value > 0 ? Math.max(3, (value / max) * 100) : 0;
  return (
    <div
      className={cn("w-1/2 max-w-[14px] rounded-t-[4px] transition-[height]", fill)}
      style={{ height: `${height}%` }}
    />
  );
}

function LegendKey({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-ink-muted">
      <span className={cn("size-[8px] rounded-[2px] shrink-0", color)} />
      {label}
      <span className="num text-ink-faint">{value}</span>
    </span>
  );
}

function Tooltip({ children }: { children: React.ReactNode }) {
  return (
    <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-[calc(100%+6px)] z-20 whitespace-nowrap rounded-md border border-line-strong bg-raised px-2 py-1 text-[10.5px] text-ink opacity-0 shadow-lg shadow-black/50 transition-opacity group-hover:opacity-100">
      {children}
    </span>
  );
}
