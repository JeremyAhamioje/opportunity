import {
  DEFAULT_SCORING_WEIGHTS,
  SCORE_FACTORS,
  type ScoreFactor,
  type ScoringWeights,
} from "./types";

export type ScoreInput = Partial<Record<ScoreFactor, number | null>>;

export type ScoreResult = {
  /** 0-100, weighted. Null when nothing has been scored yet. */
  total: number | null;
  band: ScoreBand;
  factors: { factor: ScoreFactor; value: number | null; weight: number }[];
  scoredCount: number;
};

export type ScoreBand = "high" | "strong" | "medium" | "low" | "unscored";

export const BAND_META: Record<ScoreBand, { label: string; icon: string }> = {
  high: { label: "High priority", icon: "🔥" },
  strong: { label: "Strong", icon: "▲" },
  medium: { label: "Medium", icon: "◆" },
  low: { label: "Low", icon: "▽" },
  unscored: { label: "Unscored", icon: "—" },
};

export function bandFor(total: number | null): ScoreBand {
  if (total === null) return "unscored";
  if (total >= 80) return "high";
  if (total >= 60) return "strong";
  if (total >= 40) return "medium";
  return "low";
}

/**
 * Weighted average of the 0-10 factors, rescaled to 0-100.
 * Only factors that have actually been scored contribute, so a half-filled
 * scorecard is not silently punished for the blanks.
 */
export function computeScore(
  input: ScoreInput,
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS,
): ScoreResult {
  let weightedSum = 0;
  let weightTotal = 0;
  let scoredCount = 0;

  const factors = SCORE_FACTORS.map((factor) => {
    const raw = input[factor];
    const value = typeof raw === "number" && Number.isFinite(raw) ? clamp(raw) : null;
    const weight = Math.max(0, weights[factor] ?? 0);
    if (value !== null && weight > 0) {
      weightedSum += value * weight;
      weightTotal += 10 * weight;
      scoredCount += 1;
    }
    return { factor, value, weight };
  });

  const total = weightTotal > 0 ? Math.round((weightedSum / weightTotal) * 100) : null;
  return { total, band: bandFor(total), factors, scoredCount };
}

/** Reads the score straight off an opportunity row. */
export function scoreOf(
  row: {
    scoreRepetition: number | null;
    scoreFrequency: number | null;
    scorePain: number | null;
    scoreAutomability: number | null;
    scoreFinancialValue: number | null;
    scoreDecisionMaker: number | null;
    scoreCapability: number | null;
  },
  weights?: ScoringWeights,
): ScoreResult {
  return computeScore(
    {
      repetition: row.scoreRepetition,
      frequency: row.scoreFrequency,
      pain: row.scorePain,
      automability: row.scoreAutomability,
      financialValue: row.scoreFinancialValue,
      decisionMaker: row.scoreDecisionMaker,
      capability: row.scoreCapability,
    },
    weights,
  );
}

function clamp(value: number) {
  return Math.min(10, Math.max(0, Math.round(value)));
}
