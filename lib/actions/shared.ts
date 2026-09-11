import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { activities } from "@/lib/db/schema";
import { isValidDay, type DayString } from "@/lib/domain/dates";
import type { ActivityKind } from "@/lib/domain/types";

export type ActionResult = { ok: boolean; error?: string; id?: string };

export const OK: ActionResult = { ok: true };
export const fail = (error: string): ActionResult => ({ ok: false, error });

/* -------------------------------------------------------------------------- */
/*  FormData readers — everything arrives as a string, so normalise once       */
/* -------------------------------------------------------------------------- */

export function str(form: FormData, key: string): string | null {
  const value = form.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function reqStr(form: FormData, key: string): string {
  return str(form, key) ?? "";
}

export function num(form: FormData, key: string, min = 0, max = 10): number | null {
  const raw = str(form, key);
  if (raw === null) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

export function day(form: FormData, key: string): DayString | null {
  const raw = str(form, key);
  return raw && isValidDay(raw) ? raw : null;
}

export function bool(form: FormData, key: string): boolean {
  const raw = form.get(key);
  return raw === "on" || raw === "true" || raw === "1";
}

export function triBool(form: FormData, key: string): boolean | null {
  const raw = str(form, key);
  if (raw === "yes") return true;
  if (raw === "no") return false;
  return null;
}

/** Comma or newline separated free text -> deduplicated list. */
export function list(form: FormData, key: string): string[] {
  const raw = str(form, key);
  if (!raw) return [];
  const seen = new Set<string>();
  for (const part of raw.split(/[,\n]/)) {
    const value = part.trim();
    if (value) seen.add(value);
  }
  return [...seen];
}

export function enumValue<T extends string>(
  form: FormData,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const raw = str(form, key);
  return allowed.includes(raw as T) ? (raw as T) : fallback;
}

export function optionalEnum<T extends string>(
  form: FormData,
  key: string,
  allowed: readonly T[],
): T | null {
  const raw = str(form, key);
  return allowed.includes(raw as T) ? (raw as T) : null;
}

/* -------------------------------------------------------------------------- */
/*  Activity log                                                              */
/* -------------------------------------------------------------------------- */

export async function logActivity(input: {
  userId: string;
  opportunityId?: string | null;
  companyId?: string | null;
  kind: ActivityKind;
  message: string;
}): Promise<void> {
  const db = await getDb();
  await db.insert(activities).values({
    userId: input.userId,
    opportunityId: input.opportunityId ?? null,
    companyId: input.companyId ?? null,
    kind: input.kind,
    message: input.message,
  });
}

/**
 * Every screen in this app is a different view over the same handful of rows,
 * so a mutation anywhere can invalidate a count anywhere. Revalidating the
 * whole layout keeps the numbers honest, and the dataset is single-user small.
 */
export function refreshAll(): void {
  revalidatePath("/", "layout");
}
