/**
 * Applies pending migrations, once, deliberately.
 *
 *   npm run db:migrate
 *
 * Production sets SKIP_MIGRATIONS=1 so no serverless instance does this on a
 * cold start — that spends the connection budget on work that only needs doing
 * once per deploy, and pooled databases have very few connections to spare.
 */
import path from "node:path";
import { loadEnv } from "./env";

loadEnv();

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim();
  const folder = path.join(process.cwd(), "drizzle");

  if (!url) {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const client = new PGlite(process.env.PGLITE_PATH ?? path.join(process.cwd(), ".pglite"));
    await migrate(drizzle(client), { migrationsFolder: folder });
    await client.close();
    console.log("Local PGlite database is up to date.");
    return;
  }

  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");

  // Session mode (port 5432) is required: transaction pooling cannot run DDL.
  const pool = new Pool({
    connectionString: url,
    ssl: url.includes("sslmode=disable") ? false : { rejectUnauthorized: false },
    max: 1,
  });
  await migrate(drizzle(pool), { migrationsFolder: folder });
  await pool.end();
  console.log(`${new URL(url).host} is up to date.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
