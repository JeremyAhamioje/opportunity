/**
 * Deliberately tiny and dependency-free: pages and actions need to know whether
 * the optional AI extraction path exists without pulling anything heavier into
 * their bundle.
 */
export function isAiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

/** Shown in settings so it is obvious which model a run would actually use. */
export function aiModelId(): string {
  return process.env.GEMINI_MODEL_ID?.trim() || "gemini-2.5-flash";
}
