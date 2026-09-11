"use client";

import { useOptimistic, useTransition } from "react";
import { Check } from "lucide-react";
import { toggleSopItem } from "@/lib/actions/settings";
import { ProgressBar } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { SopChecklist } from "@/lib/domain/types";

/**
 * Runs the Workflow Opportunity Finder SOP against one opportunity. The
 * checklist template is shared and editable in settings; the ticks belong to
 * this opportunity, so the SOP is a working instrument rather than a poster.
 */
export function SopRunner({
  opportunityId,
  checklist,
  progress,
}: {
  opportunityId: string;
  checklist: SopChecklist;
  progress: string[];
}) {
  const [, startTransition] = useTransition();
  const [ticked, toggle] = useOptimistic(progress, (state: string[], itemId: string) =>
    state.includes(itemId) ? state.filter((id) => id !== itemId) : [...state, itemId],
  );

  const allItems = checklist.steps.flatMap((step) => step.items);
  const done = allItems.filter((item) => ticked.includes(item.id)).length;

  const onToggle = (itemId: string) => {
    startTransition(async () => {
      toggle(itemId);
      await toggleSopItem(opportunityId, itemId);
    });
  };

  return (
    <div>
      <div className="px-4 py-3 border-b border-line">
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="text-[11.5px] text-ink-muted">
            {done} of {allItems.length} checks confirmed
          </span>
          <span className="num text-[11.5px] text-ink-faint">
            {Math.round((done / Math.max(1, allItems.length)) * 100)}%
          </span>
        </div>
        <ProgressBar value={done} max={allItems.length} tone={done === allItems.length ? "good" : "accent"} />
      </div>

      <div className="divide-y divide-line/70">
        {checklist.steps.map((step, index) => {
          const stepDone = step.items.filter((item) => ticked.includes(item.id)).length;
          return (
            <section key={step.id} className="px-4 py-3">
              <header className="flex items-baseline gap-2 mb-2">
                <span className="num text-[10.5px] text-ink-faint shrink-0">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="text-[12.5px] font-medium flex-1">{step.title}</h3>
                <span
                  className={cn(
                    "num text-[10.5px]",
                    stepDone === step.items.length ? "text-good" : "text-ink-faint",
                  )}
                >
                  {stepDone}/{step.items.length}
                </span>
              </header>
              {step.hint ? (
                <p className="text-[11px] text-ink-faint mb-2 leading-relaxed pl-[26px]">
                  {step.hint}
                </p>
              ) : null}
              <ul className="flex flex-col gap-px pl-[26px]">
                {step.items.map((item) => {
                  const checked = ticked.includes(item.id);
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => onToggle(item.id)}
                        className="w-full flex items-start gap-2 text-left py-1 group"
                      >
                        <span
                          className={cn(
                            "mt-[1px] size-[14px] rounded-[3px] border grid place-items-center shrink-0 transition-colors",
                            checked
                              ? "bg-good/20 border-good/60 text-good"
                              : "border-line-strong group-hover:border-[#44444f]",
                          )}
                        >
                          {checked ? <Check size={10} strokeWidth={3} /> : null}
                        </span>
                        <span
                          className={cn(
                            "text-[12px] leading-snug transition-colors",
                            checked ? "text-ink-faint line-through decoration-line-strong" : "text-ink-muted group-hover:text-ink",
                          )}
                        >
                          {item.label}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
