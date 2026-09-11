/**
 * Day-granular date handling.
 *
 * Every user-facing date in this app (deadlines, follow-ups, "sent on") is a
 * calendar day, stored as a Postgres `date` and carried through the app as a
 * plain `YYYY-MM-DD` string. No timezone arithmetic, so no off-by-one-day bugs.
 */

export type DayString = string;

export function today(): DayString {
  return toDay(new Date());
}

/**
 * The current instant, read once and passed down.
 *
 * Lives here beside `today()` for the same reason: a page that needs "how long
 * ago was this?" should resolve one timestamp per render and hand it to every
 * row, so two rows on the same screen can never disagree about now.
 */
export function nowMs(): number {
  return Date.now();
}

export function toDay(value: Date): DayString {
  const y = value.getFullYear();
  const m = `${value.getMonth() + 1}`.padStart(2, "0");
  const d = `${value.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(day: DayString, days: number): DayString {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return toDay(date);
}

export function daysBetween(from: DayString, to: DayString): number {
  const a = parseDay(from);
  const b = parseDay(to);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function parseDay(day: DayString): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function isValidDay(value: unknown): value is DayString {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "Aug 29" or "Aug 29, 2025" when the year differs from today's. */
export function formatDay(day: DayString | null | undefined): string {
  if (!day || !isValidDay(day)) return "—";
  const date = parseDay(day);
  const stamp = `${MONTHS[date.getMonth()]} ${date.getDate()}`;
  const thisYear = new Date().getFullYear();
  return date.getFullYear() === thisYear ? stamp : `${stamp}, ${date.getFullYear()}`;
}

export function formatLongDay(day: DayString | null | undefined): string {
  if (!day || !isValidDay(day)) return "—";
  const date = parseDay(day);
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/** "today", "in 3 days", "5 days ago" — the phrasing the follow-up desk uses. */
export function relativeDay(day: DayString, from: DayString = today()): string {
  const delta = daysBetween(from, day);
  if (delta === 0) return "today";
  if (delta === 1) return "tomorrow";
  if (delta === -1) return "yesterday";
  if (delta > 0) return `in ${delta} days`;
  return `${Math.abs(delta)} days ago`;
}

export type Urgency = "overdue" | "today" | "soon" | "scheduled" | "none";

export const URGENCY_META: Record<Urgency, { dot: string; label: string }> = {
  overdue: { dot: "🔴", label: "Overdue" },
  today: { dot: "🟠", label: "Due today" },
  soon: { dot: "🟡", label: "Due soon" },
  scheduled: { dot: "🟢", label: "Scheduled" },
  none: { dot: "", label: "Not scheduled" },
};

const URGENCY_RANK: Record<Urgency, number> = {
  overdue: 0,
  today: 1,
  soon: 2,
  scheduled: 3,
  none: 4,
};

export function urgencyOf(
  day: DayString | null | undefined,
  from: DayString = today(),
): Urgency {
  if (!day || !isValidDay(day)) return "none";
  const delta = daysBetween(from, day);
  if (delta < 0) return "overdue";
  if (delta === 0) return "today";
  if (delta <= 3) return "soon";
  return "scheduled";
}

/** Sorts the most-burning thing to the top, ties broken by date. */
export function byUrgency<T>(get: (item: T) => DayString | null | undefined) {
  return (a: T, b: T) => {
    const da = get(a);
    const db = get(b);
    const rank = URGENCY_RANK[urgencyOf(da)] - URGENCY_RANK[urgencyOf(db)];
    if (rank !== 0) return rank;
    if (!da) return db ? 1 : 0;
    if (!db) return -1;
    return da.localeCompare(db);
  };
}

export function formatTimestamp(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const day = formatDay(toDay(date));
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day} · ${time}`;
}
