import { cn } from "@/lib/utils";

/**
 * The product's whole thesis, drawn: FIND → QUALIFY → TAKE THE SHOT → TRACK →
 * FOLLOW UP → MEASURE, and back around. It appears on the sign-in screen, the
 * dashboard and the pipeline so the loop is never out of sight.
 */

export const LOOP_STEPS = [
  { id: "find", label: "Find", href: "/import" },
  { id: "qualify", label: "Qualify", href: "/finder" },
  { id: "shoot", label: "Take the shot", href: "/today" },
  { id: "track", label: "Track", href: "/pipeline" },
  { id: "followup", label: "Follow up", href: "/today" },
  { id: "measure", label: "Measure", href: "/analytics" },
] as const;

export type LoopStep = (typeof LOOP_STEPS)[number]["id"];

export function CoreLoop({
  active,
  className,
  size = "md",
}: {
  active?: LoopStep;
  className?: string;
  size?: "sm" | "md";
}) {
  const text = size === "sm" ? "text-[9px]" : "text-[10px]";

  return (
    <div className={cn("select-none", className)}>
      <div className="flex items-center gap-1 flex-wrap">
        {LOOP_STEPS.map((step, index) => (
          <div key={step.id} className="flex items-center gap-1">
            <span
              className={cn(
                "uppercase tracking-[0.1em] font-semibold px-1.5 py-1 rounded-[4px] border whitespace-nowrap transition-colors",
                text,
                active === step.id
                  ? "text-accent border-accent/45 bg-accent/10"
                  : "text-ink-faint border-line",
              )}
            >
              {step.label}
            </span>
            {index < LOOP_STEPS.length - 1 ? (
              <span className="text-ink-faint/50 text-[10px]">→</span>
            ) : null}
          </div>
        ))}
      </div>

      {/* The return rail — what makes it a loop rather than a checklist. */}
      <div className="relative h-3.5 mt-1">
        <div className="absolute inset-x-4 top-0 h-3.5 border-x border-b border-line rounded-b-[7px]" />
        <span
          className={cn(
            "absolute left-1/2 -translate-x-1/2 top-[7px] bg-canvas px-1.5 uppercase tracking-[0.14em] font-semibold text-ink-faint",
            size === "sm" ? "text-[8.5px]" : "text-[9px]",
          )}
        >
          ↻ Repeat
        </span>
      </div>
    </div>
  );
}
