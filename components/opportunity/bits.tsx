import Link from "next/link";
import { ExternalLink as ExternalIcon } from "lucide-react";
import {
  CATEGORY_META,
  stageLabel,
  type Category,
  type Stage,
} from "@/lib/domain/types";
import { BAND_META, type ScoreResult } from "@/lib/domain/scoring";
import { formatDay, relativeDay, urgencyOf, type DayString } from "@/lib/domain/dates";
import { countryOf, isRemote } from "@/lib/domain/imagery";
import { Badge, UrgencyDot, URGENCY_TEXT, type BadgeTone } from "@/components/ui";
import { cn, hostOf, isPlaceholderUrl, normalizeUrl } from "@/lib/utils";

/**
 * Marks seeded demo data. Deliberately loud: the moment real leads and demo
 * rows share a screen, "is this real?" has to be answerable at a glance.
 */
export function MockBadge({ className }: { className?: string }) {
  return (
    <span
      title="Seeded demo data — not a real opportunity. Clear it with: npm run clear -- mock"
      className={cn(
        "inline-flex items-center h-[17px] px-1.5 rounded-[4px] text-[9.5px] font-semibold uppercase tracking-[0.09em] whitespace-nowrap",
        "border border-dashed border-ink-faint/50 text-ink-faint bg-white/[0.03]",
        className,
      )}
    >
      Mock
    </span>
  );
}

/** Country flag + a clickable domain — the identity strip under a title. */
export function OriginStrip({
  location,
  country,
  website,
  className,
}: {
  location?: string | null;
  country?: string | null;
  website?: string | null;
  className?: string;
}) {
  const hint = countryOf(country, location);
  const remote = !hint && isRemote(location);
  const host = hostOf(website);

  if (!hint && !remote && !host) return null;

  return (
    <span className={cn("inline-flex items-center gap-2 flex-wrap", className)}>
      {hint ? (
        <span className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-muted">
          {/* An image, not the emoji: Windows renders 🇳🇬 as the letters "NG". */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={hint.imageUrl}
            alt=""
            width={16}
            height={12}
            loading="lazy"
            decoding="async"
            className="rounded-[2px] shrink-0 ring-1 ring-white/15"
          />
          {location ?? hint.name}
        </span>
      ) : remote ? (
        <span className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-muted">
          <span aria-hidden className="text-[13px] leading-none">
            🌍
          </span>
          {location}
        </span>
      ) : null}

      {host && isPlaceholderUrl(website) ? (
        <span
          title="Placeholder domain from demo data — this address does not exist"
          className="text-[11.5px] text-ink-faint"
        >
          {host}
        </span>
      ) : host ? (
        <a
          href={normalizeUrl(website)!}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11.5px] text-accent hover:text-accent-hot hover:underline underline-offset-2"
        >
          {host}
          <ExternalIcon size={10} className="shrink-0" />
        </a>
      ) : null}
    </span>
  );
}

/** Decorative header image. Fails silently — nothing depends on it loading. */
export function OpportunityImage({
  src,
  alt,
  className,
  height = 104,
}: {
  src: string | null;
  alt: string;
  className?: string;
  height?: number;
}) {
  if (!src) return null;
  return (
    <div
      className={cn("relative overflow-hidden bg-raised", className)}
      style={{ height }}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover opacity-[0.55]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/45 to-transparent" />
    </div>
  );
}

const THUMB_RING: Record<Category, string> = {
  workflow: "ring-cat-workflow/40",
  speculative: "ring-cat-speculative/40",
  job: "ring-cat-job/40",
  scholarship: "ring-cat-scholarship/40",
  build: "ring-cat-build/40",
};

/**
 * The row avatar. At 30px a photograph of the work says more than the same four
 * glyphs repeated down the column — but category must survive the swap, so the
 * ring takes its hue and every caller keeps the category spelled out in the
 * row's own text. Colour is never the only carrier.
 */
export function OpportunityThumb({
  category,
  src,
  size = 30,
}: {
  category: Category;
  src: string | null;
  size?: number;
}) {
  return (
    <span
      title={CATEGORY_META[category].label}
      style={{ width: size, height: size }}
      className={cn(
        "shrink-0 block rounded-[6px] overflow-hidden bg-raised ring-1",
        THUMB_RING[category],
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover opacity-90"
        />
      ) : (
        <span aria-hidden className="w-full h-full grid place-items-center text-[13px]">
          {CATEGORY_META[category].icon}
        </span>
      )}
    </span>
  );
}

export function CategoryBadge({
  category,
  withLabel = true,
}: {
  category: Category;
  withLabel?: boolean;
}) {
  const meta = CATEGORY_META[category];
  return (
    <Badge tone={category as BadgeTone} title={meta.label}>
      <span aria-hidden>{meta.icon}</span>
      {withLabel ? meta.short : null}
    </Badge>
  );
}

const STAGE_TONE: Record<Stage, BadgeTone> = {
  sourced: "neutral",
  researching: "neutral",
  qualified: "accent",
  ready: "accent",
  sent: "job",
  followup: "orange",
  response: "good",
  interview: "good",
  won: "good",
  lost: "bad",
};

export function StageBadge({
  stage,
  short,
  category,
}: {
  stage: Stage;
  short?: boolean;
  /** Builds run the same stages under different names — pass it and they read right. */
  category?: Category;
}) {
  const label = stageLabel(stage, category ?? "workflow", short);
  return (
    <Badge tone={STAGE_TONE[stage]} title={stageLabel(stage, category ?? "workflow")}>
      {label}
    </Badge>
  );
}

/** The 0-100 number, banded. Muted when nothing has been scored yet. */
export function ScorePill({
  score,
  size = "sm",
}: {
  score: ScoreResult;
  size?: "sm" | "lg";
}) {
  if (score.total === null) {
    return (
      <span className={cn("num text-ink-faint", size === "lg" ? "text-[15px]" : "text-[11.5px]")}>
        —
      </span>
    );
  }

  const tone =
    score.band === "high"
      ? "text-overdue"
      : score.band === "strong"
        ? "text-duetoday"
        : score.band === "medium"
          ? "text-duesoon"
          : "text-ink-muted";

  return (
    <span
      title={`${BAND_META[score.band].label} — ${score.scoredCount}/7 factors scored`}
      className={cn(
        "num font-semibold inline-flex items-baseline gap-1",
        tone,
        size === "lg" ? "text-[19px]" : "text-[12px]",
      )}
    >
      {score.total}
      {score.band === "high" ? <span aria-hidden className="text-[11px]">🔥</span> : null}
    </span>
  );
}

/** Follow-up date with its urgency colour — the app's most repeated signal. */
export function FollowUpCell({
  date,
  emptyLabel = "Not scheduled",
  showRelative = true,
}: {
  date: DayString | null;
  emptyLabel?: string;
  /** Off where an urgency label already sits directly beneath the date. */
  showRelative?: boolean;
}) {
  const urgency = urgencyOf(date);
  if (!date) {
    return <span className="text-[11.5px] text-ink-faint">{emptyLabel}</span>;
  }
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11.5px]", URGENCY_TEXT[urgency])}>
      <UrgencyDot urgency={urgency} />
      <span className="num">{formatDay(date)}</span>
      {showRelative ? <span className="text-ink-faint">· {relativeDay(date)}</span> : null}
    </span>
  );
}

export function DeadlineCell({ date }: { date: DayString | null }) {
  if (!date) return <span className="text-[11.5px] text-ink-faint">—</span>;
  const urgency = urgencyOf(date);
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11.5px]", URGENCY_TEXT[urgency])}>
      <span className="num">{formatDay(date)}</span>
      {urgency === "overdue" ? <span className="text-[10px]">passed</span> : null}
    </span>
  );
}

export function OpportunityLink({
  id,
  title,
  company,
  className,
}: {
  id: string;
  title: string;
  company?: string | null;
  className?: string;
}) {
  return (
    <Link href={`/opportunities/${id}`} className={cn("group block min-w-0", className)}>
      <span className="block text-[12.5px] text-ink group-hover:text-accent-hot transition-colors truncate">
        {title}
      </span>
      {company ? (
        <span className="block text-[11px] text-ink-faint truncate">{company}</span>
      ) : null}
    </Link>
  );
}

export function StatTile({
  label,
  value,
  sub,
  tone = "neutral",
  href,
  emphasis,
}: {
  label: string;
  value: number | string;
  sub?: string;
  tone?: "neutral" | "urgent" | "good" | "accent";
  href?: string;
  emphasis?: boolean;
}) {
  const toneClass = {
    neutral: "text-ink",
    urgent: "text-overdue",
    good: "text-good",
    accent: "text-accent-hot",
  }[tone];

  const body = (
    <>
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.11em] text-ink-faint">
        {label}
      </p>
      <p className={cn("num font-semibold mt-1.5 leading-none", toneClass, emphasis ? "text-[30px]" : "text-[25px]")}>
        {value}
      </p>
      {sub ? <p className="text-[11px] text-ink-faint mt-1.5 leading-snug">{sub}</p> : null}
    </>
  );

  const shell = cn(
    "bg-surface border rounded-[10px] px-3.5 py-3 min-w-0 transition-colors",
    emphasis && tone === "urgent"
      ? "border-overdue/35 bg-[#1a0f13]"
      : "border-line",
    href && "hover:border-line-strong",
  );

  return href ? (
    <Link href={href} className={cn(shell, "block")}>
      {body}
    </Link>
  ) : (
    <div className={shell}>{body}</div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  eyebrow?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div className="min-w-0">
        {eyebrow}
        <h1 className="text-[21px] font-semibold tracking-[-0.02em] leading-tight">{title}</h1>
        {subtitle ? (
          <p className="text-[12.5px] text-ink-muted mt-1 leading-relaxed">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="flex items-center gap-2 shrink-0">{action}</div> : null}
    </header>
  );
}
