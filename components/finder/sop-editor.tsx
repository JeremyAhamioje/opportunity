"use client";

import { useActionState } from "react";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { resetSop, updateSop } from "@/lib/actions/settings";
import { Input } from "@/components/ui";
import { ConfirmSubmit, SubmitButton } from "@/components/ui/client";
import type { ActionResult } from "@/lib/actions/shared";
import type { SopChecklist } from "@/lib/domain/types";

/**
 * Edits the SOP template itself. Ticking happens per opportunity (see
 * SopRunner) — this is where the questions you ask get sharpened as you learn
 * which ones actually predicted a deal.
 */
export function SopEditor({ checklist }: { checklist: SopChecklist }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(updateSop, null);

  return (
    <form action={formAction}>
      <div className="divide-y divide-line">
        {checklist.steps.map((step, index) => (
          <section key={step.id} className="px-4 py-3.5">
            <div className="flex items-center gap-2.5 mb-2">
              <span className="num text-[10.5px] text-ink-faint shrink-0">
                Step {index + 1}
              </span>
              <input
                name={`step_title_${step.id}`}
                defaultValue={step.title}
                className="flex-1 bg-transparent border-b border-transparent hover:border-line focus:border-accent outline-none text-[13px] font-medium py-0.5 transition-colors"
              />
            </div>

            <input
              name={`step_hint_${step.id}`}
              defaultValue={step.hint ?? ""}
              placeholder="What to look for…"
              className="w-full bg-transparent border-b border-transparent hover:border-line focus:border-accent outline-none text-[11.5px] text-ink-faint py-0.5 mb-2.5 transition-colors"
            />

            <ul className="flex flex-col gap-1.5">
              {step.items.map((item) => (
                <li key={item.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`rm-${item.id}`}
                    name={`item_remove_${item.id}`}
                    className="peer sr-only"
                  />
                  <span className="size-[13px] rounded-[3px] border border-line-strong shrink-0" />
                  <input
                    name={`item_label_${item.id}`}
                    defaultValue={item.label}
                    className="field h-[26px] py-0 text-[12px] peer-checked:line-through peer-checked:opacity-45 flex-1"
                  />
                  <label
                    htmlFor={`rm-${item.id}`}
                    title="Mark for removal — takes effect when you save"
                    className="text-ink-faint hover:text-bad peer-checked:text-bad cursor-pointer p-1 transition-colors"
                  >
                    <Trash2 size={12} />
                  </label>
                </li>
              ))}

              <li className="flex items-center gap-2 pl-[21px]">
                <Plus size={12} className="text-ink-faint shrink-0" />
                <Input
                  name={`item_new_${step.id}`}
                  placeholder="Add a check to this step…"
                  className="h-[26px] py-0 text-[12px]"
                />
              </li>
            </ul>
          </section>
        ))}
      </div>

      <div className="px-4 py-3 border-t border-line flex items-center justify-end gap-2 bg-canvas/40">
        {state?.ok ? <span className="mr-auto text-[11.5px] text-good">Checklist saved.</span> : null}
        {state?.error ? <span className="mr-auto text-[11.5px] text-bad">{state.error}</span> : null}
        <SubmitButton>Save checklist</SubmitButton>
      </div>
    </form>
  );
}

export function SopReset() {
  return (
    <form action={resetSop}>
      <ConfirmSubmit variant="ghost" size="xs" confirmLabel="Click again to reset">
        <span className="inline-flex items-center gap-1.5">
          <RotateCcw size={11} /> Reset to default
        </span>
      </ConfirmSubmit>
    </form>
  );
}
