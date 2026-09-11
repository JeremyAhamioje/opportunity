import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn, isPlaceholderUrl, normalizeUrl } from "@/lib/utils";
import { URGENCY_META, type Urgency } from "@/lib/domain/dates";

/* -------------------------------------------------------------------------- */
/*  Button                                                                    */
/* -------------------------------------------------------------------------- */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
export type ButtonSize = "xs" | "sm" | "md";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-white hover:bg-accent-hot border border-transparent shadow-[0_1px_0_rgba(255,255,255,0.08)_inset]",
  secondary:
    "bg-raised text-ink border border-line-strong hover:bg-hover hover:border-[#3a3a45]",
  ghost: "bg-transparent text-ink-muted hover:text-ink hover:bg-raised border border-transparent",
  outline: "bg-transparent text-ink border border-line-strong hover:bg-raised",
  danger: "bg-transparent text-bad border border-[#43222a] hover:bg-[#2a1419]",
};

const SIZES: Record<ButtonSize, string> = {
  xs: "h-6 px-2 text-[11px] gap-1 rounded-[4px]",
  sm: "h-7 px-2.5 text-[12.5px] gap-1.5 rounded-[5px]",
  md: "h-8 px-3 text-[13px] gap-1.5 rounded-md",
};

const BUTTON_BASE =
  "inline-flex items-center justify-center font-medium whitespace-nowrap transition-colors disabled:opacity-45 disabled:pointer-events-none select-none";

export function buttonClass(
  variant: ButtonVariant = "secondary",
  size: ButtonSize = "sm",
  extra?: string,
) {
  return cn(BUTTON_BASE, VARIANTS[variant], SIZES[size], extra);
}

export function Button({
  variant = "secondary",
  size = "sm",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = "secondary",
  size = "sm",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

/* -------------------------------------------------------------------------- */
/*  Surfaces                                                                  */
/* -------------------------------------------------------------------------- */

export function Panel({
  className,
  children,
  ...props
}: ComponentProps<"section">) {
  return (
    <section
      className={cn("bg-surface border border-line rounded-[10px]", className)}
      {...props}
    >
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  subtitle,
  icon,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex items-start justify-between gap-3 px-4 py-3 border-b border-line",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="text-[13px] font-semibold tracking-tight text-ink flex items-center gap-2">
          {icon}
          {title}
        </h2>
        {subtitle ? (
          <p className="text-[11.5px] text-ink-faint mt-0.5 leading-snug">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0 flex items-center gap-1.5">{action}</div> : null}
    </header>
  );
}

export function SectionTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h3
      className={cn(
        "text-[10.5px] font-semibold uppercase tracking-[0.11em] text-ink-faint",
        className,
      )}
    >
      {children}
    </h3>
  );
}

/* -------------------------------------------------------------------------- */
/*  Badges & status                                                           */
/* -------------------------------------------------------------------------- */

export type BadgeTone =
  | "neutral"
  | "accent"
  | "good"
  | "warn"
  | "bad"
  | "orange"
  | "workflow"
  | "speculative"
  | "job"
  | "scholarship"
  | "build";

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "bg-raised text-ink-muted border-line-strong",
  accent: "bg-[#221d45] text-[#a99cff] border-[#332c63]",
  good: "bg-[#0f2a20] text-good border-[#1b4534]",
  warn: "bg-[#2c2413] text-warn border-[#463a1c]",
  bad: "bg-[#2a1319] text-bad border-[#4a2029]",
  orange: "bg-[#2d1d10] text-duetoday border-[#4a3018]",
  workflow: "bg-[#1e1a3d] text-cat-workflow border-[#2e2857]",
  speculative: "bg-[#2c2110] text-cat-speculative border-[#48371a]",
  job: "bg-[#122335] text-cat-job border-[#1c3a55]",
  scholarship: "bg-[#0f2a20] text-cat-scholarship border-[#1b4534]",
  build: "bg-[#2e1622] text-cat-build border-[#4d2739]",
};

export function Badge({
  tone = "neutral",
  className,
  children,
  title,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 border rounded-[4px] px-1.5 h-[19px] text-[11px] font-medium leading-none whitespace-nowrap",
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const URGENCY_COLOR: Record<Urgency, string> = {
  overdue: "bg-overdue",
  today: "bg-duetoday",
  soon: "bg-duesoon",
  scheduled: "bg-scheduled",
  none: "bg-[#3a3a45]",
};

export function UrgencyDot({
  urgency,
  className,
}: {
  urgency: Urgency;
  className?: string;
}) {
  return (
    <span
      aria-label={URGENCY_META[urgency].label}
      title={URGENCY_META[urgency].label}
      className={cn(
        "inline-block size-[7px] rounded-full shrink-0",
        URGENCY_COLOR[urgency],
        urgency === "overdue" && "pulse-urgent",
        className,
      )}
    />
  );
}

export const URGENCY_TEXT: Record<Urgency, string> = {
  overdue: "text-overdue",
  today: "text-duetoday",
  soon: "text-duesoon",
  scheduled: "text-scheduled",
  none: "text-ink-faint",
};

/* -------------------------------------------------------------------------- */
/*  Form controls                                                             */
/* -------------------------------------------------------------------------- */

export function Field({
  label,
  hint,
  required,
  children,
  className,
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="text-[11.5px] font-medium text-ink-muted flex items-center gap-1"
      >
        {label}
        {required ? <span className="text-accent">*</span> : null}
      </label>
      {children}
      {hint ? <p className="text-[11px] text-ink-faint leading-snug">{hint}</p> : null}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn("field", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn("field resize-y min-h-[76px]", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn("field appearance-none pr-7 cursor-pointer", className)} {...props}>
      {children}
    </select>
  );
}

/* -------------------------------------------------------------------------- */
/*  Feedback                                                                  */
/* -------------------------------------------------------------------------- */

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center px-6 py-10 gap-2",
        className,
      )}
    >
      {icon ? <div className="text-ink-faint mb-1">{icon}</div> : null}
      <p className="text-[13px] font-medium text-ink-muted">{title}</p>
      {description ? (
        <p className="text-[12px] text-ink-faint max-w-sm leading-relaxed">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function ProgressBar({
  value,
  max,
  tone = "accent",
  className,
}: {
  value: number;
  max: number;
  tone?: "accent" | "good" | "warn" | "bad";
  className?: string;
}) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const fill = {
    accent: "bg-accent",
    good: "bg-good",
    warn: "bg-warn",
    bad: "bg-bad",
  }[tone];
  return (
    <div
      className={cn("h-1.5 w-full rounded-full bg-[#1c1c23] overflow-hidden", className)}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-200", fill)}
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  );
}

export function KeyHint({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex items-center h-[17px] min-w-[17px] justify-center px-1 rounded-[3px] border border-line-strong bg-raised text-[10px] font-medium text-ink-faint font-sans">
      {children}
    </kbd>
  );
}

export function ExternalLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  // Demo rows carry reserved domains that cannot resolve. Show them, but do not
  // dress them as somewhere to go.
  if (isPlaceholderUrl(href)) {
    return (
      <span
        title="Placeholder domain from demo data — this address does not exist"
        className={cn("text-ink-faint break-all", className)}
      >
        {children}
      </span>
    );
  }

  return (
    <a
      href={normalizeUrl(href) ?? href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "text-accent hover:text-accent-hot hover:underline underline-offset-2 break-all",
        className,
      )}
    >
      {children}
    </a>
  );
}
