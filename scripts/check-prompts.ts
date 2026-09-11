/**
 * Feeds the example row from each discovery prompt through the real parser and
 * reports which fields survived.
 *
 *   npm run check:prompts
 *
 * The prompts in research-prompts/ are a format contract: their column headers
 * are mapped onto fields by lib/parse/research.ts. Rename a column in either
 * place and the data silently stops arriving — which is exactly the kind of
 * breakage nobody notices until a real research run is already wasted.
 */
import fs from "node:fs";
import path from "node:path";
import { parseResearch } from "../lib/parse/research";

const DIR = path.join(process.cwd(), "research-prompts");

/** Fields each prompt promises to deliver, beyond company name and category. */
const EXPECTED: Record<string, string[]> = {
  "01": ["title", "website", "industry", "companySize", "location", "problemObserved", "proposedSolution", "buyerRole", "contactEmail"],
  "02": ["title", "website", "industry", "companySize", "location", "whyInterested", "contribution", "contactName", "contactEmail"],
  "03": ["title", "applicationUrl", "industry", "location", "workMode", "salary", "skills", "notes"],
  "04": ["title", "applicationUrl", "industry", "location", "workMode", "salary", "skills", "deadline", "notes"],
  "05": ["title", "applicationUrl", "industry", "location", "workMode", "salary", "skills", "deadline", "notes"],
  "06": ["title", "applicationUrl", "country", "degreeLevel", "fundingAmount", "eligibility", "deadline", "notes"],
};

let failures = 0;

// Only the numbered prompts — 00-README is an index, and its table is a file
// listing rather than an output-format example.
const prompts = fs
  .readdirSync(DIR)
  .filter((name) => EXPECTED[name.slice(0, 2)] !== undefined)
  .sort();

for (const file of prompts) {
  const text = fs.readFileSync(path.join(DIR, file), "utf8");
  const lines = text.split("\n");

  // The output-format example is the last markdown table in the file.
  const start = lines.findLastIndex(
    (line, i) => line.trim().startsWith("|") && /^\|[\s:|-]+\|/.test(lines[i + 1]?.trim() ?? ""),
  );
  if (start === -1) {
    console.error(`✗ ${file}: no example table found`);
    failures += 1;
    continue;
  }

  let end = start + 2;
  while (end < lines.length && lines[end].trim().startsWith("|")) end++;

  const report = parseResearch(lines.slice(start, end).join("\n"));
  const item = report.items[0];
  const key = file.slice(0, 2);

  if (report.shape !== "table" || !item) {
    console.error(`✗ ${file}: parsed as "${report.shape}" with ${report.items.length} rows`);
    failures += 1;
    continue;
  }

  const missing = (EXPECTED[key] ?? []).filter((field) => {
    const value = (item as unknown as Record<string, unknown>)[field];
    return value === undefined || value === "" || (Array.isArray(value) && !value.length);
  });

  if (missing.length) {
    console.error(`✗ ${file}: column not mapped -> ${missing.join(", ")}`);
    failures += 1;
  } else {
    console.log(`✓ ${file}: ${item.category} · ${(EXPECTED[key] ?? []).length + 2} fields mapped`);
  }
}

if (failures) {
  console.error(`\n${failures} prompt(s) out of sync with the parser.`);
  process.exit(1);
}
console.log("\nAll discovery prompts round-trip cleanly.");
