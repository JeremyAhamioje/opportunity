import { isEmbedded } from "../lib/db";

/**
 * PGlite allows exactly one process to hold the data directory. A script that
 * writes while `next dev` is up opens a *second* instance whose writes are
 * silently discarded — it reports success and the app shows nothing. Refusing
 * loudly is the only safe behaviour.
 *
 * Hosted Postgres has no such restriction, so the check is skipped there.
 */
export async function assertNotRunning(verb = "this write"): Promise<void> {
  if (!isEmbedded()) return;

  const port = process.env.PORT ?? "3000";
  try {
    await fetch(`http://localhost:${port}/login`, { signal: AbortSignal.timeout(1200) });
  } catch {
    return; // nothing listening — safe to proceed
  }

  console.error(
    `The app is running on port ${port}. The embedded PGlite database allows one writer,\n` +
      `so ${verb} would be thrown away. Stop the dev server, run this, then start it again.`,
  );
  process.exit(1);
}
