"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { updateScores } from "@/lib/actions/opportunities";
import {
  SCORE_FACTORS,
  SCORE_FACTOR_META,
  type ScoreFactor,
  type ScoringWeights,
} from "@/lib/domain/types";
import { BAND_META, computeScore } from "@/lib/domain/scoring";
import { Select } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/lib/actions/shared";

type Values = Partial<Record<ScoreFactor, number | null>>;

/**
 * The 0-100 opportunity score (brief §7). The total recomputes as you drag, so
 * the tradeoff between factors is visible while you are making it rather than
 * after saving.
 */
export function ScoreEditor({
  id,
  initial,
  weights,
  dataAccessible,
}: {
  id: string;
  initial: Values;
  weights: ScoringWeights;
  dataAccessible: boolean | null;
}) {
  const [values, setValues] = useState<Values>(initial);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(updateScores, null);
  const result = useMemo(() => computeScore(values, weights), [values, weights]);

  const bandColor =
    result.band === "high"
      ? "text-overdue"
      : result.band === "strong"
        ? "text-duetoday"
        : result.band === "medium"
          ? "text-duesoon"
          : "text-ink-muted";

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />

      <div className="px-4 py-3.5 flex items-center gap-4 border-b border-line">
        <div className="shrink-0">
          <p className={cn("num text-[34px] font-semibold leading-none", bandColor)}>
            {result.total ?? "—"}
            <span className="text-[14px] text-ink-faint font-normal">/100</span>
          </p>
          <p className={cn("text-[11.5px] mt-1 font-medium", bandColor)}>
            {BAND_META[result.band].icon} {BAND_META[result.band].label}
          </p>
        </div>
        <p className="text-[11.5px] text-ink-faint leading-relaxed flex-1">
          {result.scoredCount}/7 factors scored, weighted by your settings.{" "}
          <Link href="/settings#weights" className="text-accent hover:underline">
            Edit weights
          </Link>
          .
        </p>
      </div>

      <div className="px-4 py-3 flex flex-col gap-2.5">
        {SCORE_FACTORS.map((factor) => {
          const value = values[factor];
          const weight = weights[factor] ?? 1;
          return (
            <div key={factor} className="grid grid-cols-[136px_1fr_auto] items-center gap-3">
              <label htmlFor={`score-${factor}`} className="min-w-0" title={SCORE_FACTOR_META[factor].hint}>
                <span className="block text-[12px] truncate">
                  {SCORE_FACTOR_META[factor].label}
                </span>
                {weight !== 1 ? (
                  <span className="block text-[10px] text-accent num">×{weight}</span>
                ) : null}
              </label>

              <input
                id={`score-${factor}`}
                name={factor}
                type="range"
                min={0}
                max={10}
                step={1}
                value={value ?? 0}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [factor]: Number(event.target.value) }))
                }
                className="w-full h-1.5 cursor-pointer"
                disabled={weight === 0}
              />

              <span
                className={cn(
                  "num text-[12px] w-[36px] text-right",
                  value === null || value === undefined ? "text-ink-faint" : "text-ink",
                )}
              >
                {value ?? 0}/10
              </span>
            </div>
          );
        })}

        <div className="grid grid-cols-[136px_1fr] items-center gap-3 pt-1 border-t border-line/70 mt-1">
          <label htmlFor="dataAccessible" className="text-[12px]">
            Data accessible?
          </label>
          <Select
            id="dataAccessible"
            name="dataAccessible"
            defaultValue={dataAccessible === null ? "" : dataAccessible ? "yes" : "no"}
            className="h-[28px] py-0 w-auto"
          >
            <option value="">Unknown</option>
            <option value="yes">Yes — software can reach it</option>
            <option value="no">No — locked away</option>
          </Select>
        </div>
      </div>

      <div className="px-4 py-2.5 border-t border-line flex items-center justify-end gap-2 bg-canvas/40">
        {state?.ok ? <span className="mr-auto text-[11.5px] text-good">Score saved.</span> : null}
        {state?.error ? <span className="mr-auto text-[11.5px] text-bad">{state.error}</span> : null}
        <SubmitButton size="sm">Save score</SubmitButton>
      </div>
    </form>
  );
}
