export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/** Percentage, guarding the divide-by-zero that would otherwise render "NaN%". */
export function pct(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return n === 1 ? one : many;
}

/** Accepts "acme.com" as readily as "https://acme.com". */
export function normalizeUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[\w-]+(\.[\w-]+)+/.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

/**
 * Reserved domains that can never resolve (RFC 2606/6761) — which is exactly
 * what the seeded demo data uses. Rendering one as a live link produces a
 * browser error and a moment of "is this data real?", so they are shown but not
 * offered as somewhere to click.
 */
export function isPlaceholderUrl(url: string | null | undefined): boolean {
  const host = hostOf(url);
  if (!host) return false;
  return /(^|\.)(example|invalid|test|localhost)$/i.test(host) ||
    /^example\.(com|org|net)$/i.test(host);
}

export function hostOf(url: string | null | undefined): string | null {
  const normalized = normalizeUrl(url);
  if (!normalized) return null;
  try {
    return new URL(normalized).host.replace(/^www\./, "");
  } catch {
    return normalized;
  }
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

export function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
