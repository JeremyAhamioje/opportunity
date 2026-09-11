import { readFileSync } from "node:fs";

/**
 * Loads `.env.local` then `.env` into `process.env` for standalone scripts.
 *
 * `next dev` does this itself, so nothing in the app needs it — but a script run
 * through `tsx` gets no such treatment, and the failure mode is confusing: the
 * key is plainly there in the file and the code insists it is not set.
 *
 * A real value already in the environment always wins, so
 * `GEMINI_API_KEY=… npm run ingest` overrides the file.
 */
export function loadEnv(files = [".env.local", ".env"]): void {
  for (const file of files) {
    let contents: string;
    try {
      contents = readFileSync(file, "utf8");
    } catch {
      continue; // absent is normal — every value here is optional
    }

    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match) continue; // comment, blank, or something we do not understand

      const [, key, rawValue] = match;
      if (process.env[key] !== undefined) continue;

      let value = rawValue.trim();
      // Strip one matching pair of surrounding quotes, if present.
      if (
        (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
        (value.startsWith("'") && value.endsWith("'") && value.length > 1)
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}
