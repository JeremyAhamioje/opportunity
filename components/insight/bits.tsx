import Link from "next/link";
import {
  INSIGHT_KIND_META,
  MOVEMENT_META,
  SOURCE_META,
  STANCE_META,
  type ConversationSource,
  type InsightKind,
  type Movement,
  type Stance,
} from "@/lib/domain/archaeology";
import { Badge, type BadgeTone } from "@/components/ui";
import { cn } from "@/lib/utils";

const KIND_TONE: Record<InsightKind, BadgeTone> = {
  idea: "accent",
  project: "build",
  goal: "scholarship",
  commitment: "orange",
  decision: "workflow",
  problem: "bad",
  opportunity: "job",
  task: "neutral",
};

export function KindBadge({ kind, short }: { kind: InsightKind; short?: boolean }) {
  const meta = INSIGHT_KIND_META[kind];
  return (
    <Badge tone={KIND_TONE[kind]} title={meta.blurb}>
      <span aria-hidden>{meta.icon}</span>
      {short ? null : meta.label}
    </Badge>
  );
}

/**
 * How firmly it was said. Rendered as words rather than a colour alone, because
 * the difference between "I'm going to build this" and "could this work?" is
 * the single thing a reader must not misread.
 */
export function StanceBadge({ stance }: { stance: Stance }) {
  const meta = STANCE_META[stance];
  const tone: BadgeTone =
    stance === "explicit"
      ? "good"
      : stance === "proposed"
        ? "warn"
        : stance === "abandoned"
          ? "bad"
          : "neutral";
  return (
    <Badge tone={tone} title={`You said it like this: ${meta.hint}`}>
      {meta.label}
    </Badge>
  );
}

export function SourceBadge({ source }: { source: string }) {
  const meta = SOURCE_META[source as ConversationSource] ?? { label: source, icon: "•" };
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-faint">
      <span aria-hidden>{meta.icon}</span>
      {meta.label}
    </span>
  );
}

/**
 * Mention count. Deliberately captioned as a frequency, never as a
 * recommendation — how often you mentioned something is a signal of interest,
 * not evidence that it is worth doing, and the label has to say so.
 */
export function MentionCount({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      title={`Appeared in ${count} conversation${count === 1 ? "" : "s"}. Frequency is a signal of interest, not of value.`}
      className={cn("num text-[11px] text-ink-faint whitespace-nowrap", className)}
    >
      {count}× mentioned
    </span>
  );
}

/**
 * How sure the extractor is it read the text correctly — distinct from stance,
 * and shown only when it is low enough to be worth doubting.
 */
export function ConfidenceHint({ confidence }: { confidence: number | null }) {
  if (confidence === null || confidence >= 70) return null;
  return (
    <span
      title="How confident the extractor is that it read this correctly. Low confidence means check the quote."
      className="num text-[10.5px] text-duesoon"
    >
      {confidence}% sure
    </span>
  );
}

export function MovementMark({ movement }: { movement: Movement | string | null }) {
  if (!movement) return null;
  const meta = MOVEMENT_META[movement as Movement];
  if (!meta) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-muted">
      <span aria-hidden className="text-accent">
        {meta.icon}
      </span>
      {meta.label}
    </span>
  );
}

/**
 * A quoted excerpt. Always visually marked as a quotation, and never restyled
 * into prose — everything in here is the user's own words, and the moment it
 * looks like the app's words the provenance guarantee is worthless.
 */
export function Excerpt({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <blockquote
      className={cn(
        "border-l-2 border-line-strong pl-3 py-0.5 text-[12.5px] text-ink-muted leading-relaxed italic",
        className,
      )}
    >
      {children}
    </blockquote>
  );
}

export function InsightLink({
  id,
  title,
  kind,
  className,
}: {
  id: string;
  title: string;
  kind?: InsightKind;
  className?: string;
}) {
  return (
    <Link
      href={`/ideas/${id}`}
      className={cn("group inline-flex items-center gap-2 min-w-0", className)}
    >
      {kind ? <span aria-hidden>{INSIGHT_KIND_META[kind].icon}</span> : null}
      <span className="text-[12.5px] text-ink group-hover:text-accent-hot transition-colors truncate">
        {title}
      </span>
    </Link>
  );
}

/** "First seen June, last seen August" in one line. */
export function SeenRange({
  first,
  last,
  className,
}: {
  first: Date | null;
  last: Date | null;
  className?: string;
}) {
  if (!first && !last) return null;
  const fmt = (date: Date) =>
    date.toLocaleDateString("en-GB", { month: "short", year: "numeric" });

  const sameMonth =
    first && last && first.getFullYear() === last.getFullYear() && first.getMonth() === last.getMonth();

  return (
    <span className={cn("text-[11px] text-ink-faint whitespace-nowrap", className)}>
      {sameMonth || !first || !last
        ? fmt(last ?? first!)
        : `${fmt(first)} → ${fmt(last)}`}
    </span>
  );
}

/**
 * Days since it was last mentioned, phrased as an observation, never a nag.
 *
 * `now` is passed in rather than read here so every row on a page measures
 * against the same instant — and so this stays a pure render.
 */
export function QuietFor({ since, now }: { since: Date | null; now: number }) {
  if (!since) return null;
  const days = Math.floor((now - since.getTime()) / 86_400_000);
  if (days < 14) return null;
  const label =
    days >= 365
      ? `${Math.floor(days / 365)}y`
      : days >= 60
        ? `${Math.round(days / 30)} months`
        : `${days} days`;
  return <span className="text-[11px] text-ink-faint">quiet for {label}</span>;
}
