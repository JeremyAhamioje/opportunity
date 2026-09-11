"use client";

import { useActionState, useMemo, useState } from "react";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import {
  changePassword,
  resetDailyGoals,
  updateDailyGoals,
  updateFollowUpDefault,
  updateProfile,
  updateScoringWeights,
} from "@/lib/actions/settings";
import {
  GOAL_METRICS,
  GOAL_METRIC_META,
  SCORE_FACTORS,
  SCORE_FACTOR_META,
  type DailyGoal,
  type ScoringWeights,
} from "@/lib/domain/types";
import { computeScore } from "@/lib/domain/scoring";
import { Field, Input, Select } from "@/components/ui";
import { ConfirmSubmit, SubmitButton } from "@/components/ui/client";
import type { ActionResult } from "@/lib/actions/shared";
import type { User } from "@/lib/db/schema";

function Status({ state, okLabel = "Saved." }: { state: ActionResult | null; okLabel?: string }) {
  if (state?.error) return <span className="mr-auto text-[11.5px] text-bad">{state.error}</span>;
  if (state?.ok) return <span className="mr-auto text-[11.5px] text-good">{okLabel}</span>;
  return null;
}

function Footer({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-2.5 border-t border-line flex items-center justify-end gap-2 bg-canvas/40">
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Daily goals                                                               */
/* -------------------------------------------------------------------------- */

export function GoalsForm({ goals }: { goals: DailyGoal[] }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(updateDailyGoals, null);

  return (
    <form action={formAction}>
      <ul className="divide-y divide-line/70">
        {goals.map((goal) => (
          <li key={goal.id} className="px-4 py-2.5 flex items-center gap-2">
            <input
              type="checkbox"
              id={`goal-rm-${goal.id}`}
              name={`goal_remove_${goal.id}`}
              className="peer sr-only"
            />
            <Input
              name={`goal_label_${goal.id}`}
              defaultValue={goal.label}
              className="h-[28px] py-0 text-[12.5px] flex-1 peer-checked:line-through peer-checked:opacity-45"
            />
            <Input
              name={`goal_target_${goal.id}`}
              type="number"
              min={0}
              max={999}
              defaultValue={goal.target}
              aria-label="Target"
              className="h-[28px] py-0 w-[62px] num text-center"
            />
            <span
              className="text-[10.5px] text-ink-faint w-[150px] shrink-0 leading-tight"
              title={GOAL_METRIC_META[goal.metric].counts}
            >
              {GOAL_METRIC_META[goal.metric].label}
            </span>
            <label
              htmlFor={`goal-rm-${goal.id}`}
              title="Mark for removal"
              className="text-ink-faint hover:text-bad peer-checked:text-bad cursor-pointer p-1 transition-colors"
            >
              <Trash2 size={12} />
            </label>
          </li>
        ))}
      </ul>

      <div className="px-4 py-3 border-t border-line flex items-end gap-2">
        <Field label="New goal" htmlFor="new_goal_label" className="flex-1">
          <Input id="new_goal_label" name="new_goal_label" placeholder="Send 2 workflow pitches" />
        </Field>
        <Field label="Target" htmlFor="new_goal_target" className="w-[74px]">
          <Input
            id="new_goal_target"
            name="new_goal_target"
            type="number"
            min={0}
            max={999}
            defaultValue={1}
            className="num text-center"
          />
        </Field>
        <Field label="Counts" htmlFor="new_goal_metric" className="w-[190px]">
          <Select id="new_goal_metric" name="new_goal_metric" defaultValue="outreach">
            {GOAL_METRICS.map((metric) => (
              <option key={metric} value={metric}>
                {GOAL_METRIC_META[metric].label}
              </option>
            ))}
          </Select>
        </Field>
        <span className="mb-1.5 text-ink-faint">
          <Plus size={14} />
        </span>
      </div>

      <Footer>
        <Status state={state} okLabel="Goals saved." />
        <SubmitButton>Save goals</SubmitButton>
      </Footer>
    </form>
  );
}

export function GoalsReset() {
  return (
    <form action={resetDailyGoals}>
      <ConfirmSubmit variant="ghost" size="xs" confirmLabel="Click again to reset">
        <span className="inline-flex items-center gap-1.5">
          <RotateCcw size={11} /> Reset
        </span>
      </ConfirmSubmit>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/*  Scoring weights                                                           */
/* -------------------------------------------------------------------------- */

export function WeightsForm({ weights }: { weights: ScoringWeights }) {
  const [values, setValues] = useState<ScoringWeights>(weights);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    updateScoringWeights,
    null,
  );

  // A worked example makes the abstract weights concrete as you change them.
  const example = useMemo(
    () =>
      computeScore(
        {
          repetition: 9,
          frequency: 10,
          pain: 8,
          automability: 9,
          financialValue: 7,
          decisionMaker: 8,
          capability: 10,
        },
        values,
      ),
    [values],
  );

  return (
    <form action={formAction}>
      <ul className="px-4 py-3 flex flex-col gap-2.5">
        {SCORE_FACTORS.map((factor) => (
          <li key={factor} className="grid grid-cols-[136px_1fr_auto] items-center gap-3">
            <label htmlFor={`weight-${factor}`} className="text-[12px] truncate">
              {SCORE_FACTOR_META[factor].label}
            </label>
            <input
              id={`weight-${factor}`}
              name={`weight_${factor}`}
              type="range"
              min={0}
              max={5}
              step={1}
              value={values[factor]}
              onChange={(event) =>
                setValues((current) => ({ ...current, [factor]: Number(event.target.value) }))
              }
              className="w-full h-1.5 cursor-pointer"
            />
            <span
              className={`num text-[12px] w-[30px] text-right ${
                values[factor] === 0 ? "text-ink-faint" : "text-ink"
              }`}
            >
              ×{values[factor]}
            </span>
          </li>
        ))}
      </ul>

      <div className="px-4 py-2.5 border-t border-line/70 flex items-center gap-3">
        <span className="text-[11.5px] text-ink-faint flex-1 leading-snug">
          A 9/10/8/9/7/8/10 opportunity would score
        </span>
        <span className="num text-[19px] font-semibold">{example.total ?? "—"}</span>
        <span className="text-[11px] text-ink-faint">/100</span>
      </div>

      <Footer>
        <Status state={state} okLabel="Weights saved." />
        <SubmitButton>Save weights</SubmitButton>
      </Footer>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/*  Follow-up cadence                                                         */
/* -------------------------------------------------------------------------- */

export function FollowUpForm({ days }: { days: number }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    updateFollowUpDefault,
    null,
  );

  return (
    <form action={formAction}>
      <div className="px-4 py-3.5 flex items-end gap-3">
        <Field
          label="Days after sending"
          htmlFor="followUpDefaultDays"
          className="w-[150px]"
          hint="Used whenever you mark something sent."
        >
          <Input
            id="followUpDefaultDays"
            name="followUpDefaultDays"
            type="number"
            min={0}
            max={365}
            defaultValue={days}
            className="num"
          />
        </Field>
        <p className="text-[11.5px] text-ink-faint mb-[22px] leading-relaxed flex-1">
          Five days is the default: long enough not to nag, short enough that the thread is still
          warm. Set 0 to stop scheduling follow-ups automatically.
        </p>
      </div>
      <Footer>
        <Status state={state} okLabel="Cadence saved." />
        <SubmitButton>Save</SubmitButton>
      </Footer>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/*  Account                                                                   */
/* -------------------------------------------------------------------------- */

export function ProfileForm({ user }: { user: User }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(updateProfile, null);

  return (
    <form action={formAction}>
      <div className="px-4 py-3.5 grid sm:grid-cols-2 gap-3">
        <Field label="Name" htmlFor="name">
          <Input id="name" name="name" defaultValue={user.name ?? ""} />
        </Field>
        <Field label="Email" htmlFor="email" required>
          <Input id="email" name="email" type="email" defaultValue={user.email} required />
        </Field>
      </div>
      <Footer>
        <Status state={state} />
        <SubmitButton>Save profile</SubmitButton>
      </Footer>
    </form>
  );
}

export function PasswordForm() {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(changePassword, null);

  return (
    <form action={formAction}>
      <div className="px-4 py-3.5 grid sm:grid-cols-2 gap-3">
        <Field label="Current password" htmlFor="currentPassword" required>
          <Input
            id="currentPassword"
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>
        <Field
          label="New password"
          htmlFor="newPassword"
          required
          hint="At least 10 characters, with a number or symbol."
        >
          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
          />
        </Field>
      </div>
      <Footer>
        <Status state={state} okLabel="Password changed." />
        <SubmitButton>Change password</SubmitButton>
      </Footer>
    </form>
  );
}
