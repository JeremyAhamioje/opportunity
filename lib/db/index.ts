import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

/**
 * One schema, two drivers.
 *
 *   DATABASE_URL set   -> node-postgres against a real server (Supabase, Neon, RDS…)
 *   DATABASE_URL unset -> PGlite, actual Postgres compiled to WASM, stored in ./.pglite
 *
 * Both speak the same SQL, so nothing above this file knows or cares which is
 * running. Migrations are applied once at first access.
 */

export type Database = PgDatabase<PgQueryResultHKT, typeof schema> & { $client: unknown };

const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

// Dev hot-reload re-evaluates modules; without a global cache we would open a
// second PGlite handle on the same directory and deadlock.
const globalForDb = globalThis as unknown as { __opportunityDb?: Promise<Database> };

async function createPglite(): Promise<Database> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");

  const client = new PGlite(process.env.PGLITE_PATH ?? path.join(process.cwd(), ".pglite"));
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db as unknown as Database;
}

async function createNodePostgres(url: string): Promise<Database> {
  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");

  /*
   * Small on purpose. Supabase's session pooler allows 15 clients in total, and
   * every serverless instance opens its own pool — so a generous `max` means
   * three or four warm lambdas exhaust the database for everyone and the site
   * starts failing under exactly the concurrency a demo produces.
   *
   * `idleTimeoutMillis` matters as much as `max` here: a frozen serverless
   * function holds its sockets open indefinitely otherwise, so connections are
   * never returned by instances that have stopped serving traffic.
   *
   * The long-term fix is the transaction pooler on port 6543, which is built
   * for this — but migrations need session mode, so that swap only makes sense
   * once the schema stops changing and migrations move out of the request path.
   */
  const pool = new Pool({
    connectionString: url,
    ssl: url.includes("sslmode=disable") ? false : { rejectUnauthorized: false },
    max: Number(process.env.DATABASE_POOL_MAX ?? 3),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
  });
  const db = drizzle(pool, { schema });

  /*
   * Migrating on every cold start is fine against an embedded database and
   * wrong against a pooled one: each instance runs `CREATE SCHEMA` and holds a
   * connection to do it, so a burst of traffic spends the connection budget on
   * work that only needed doing once.
   *
   * Set SKIP_MIGRATIONS=1 in production and run `npm run db:migrate` as part of
   * deploying instead.
   */
  if (process.env.SKIP_MIGRATIONS !== "1") {
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  }
  return db as unknown as Database;
}

export function getDb(): Promise<Database> {
  if (!globalForDb.__opportunityDb) {
    const url = process.env.DATABASE_URL?.trim();
    globalForDb.__opportunityDb = (url ? createNodePostgres(url) : createPglite()).catch(
      (error) => {
        // Never cache a failed connection — the next request should retry.
        globalForDb.__opportunityDb = undefined;
        throw error;
      },
    );
  }
  return globalForDb.__opportunityDb;
}

export function databaseLabel(): string {
  return process.env.DATABASE_URL?.trim() ? "PostgreSQL" : "PGlite (local)";
}

export function isEmbedded(): boolean {
  return !process.env.DATABASE_URL?.trim();
}

/**
 * Flushes and releases the handle. Scripts MUST await this before exiting —
 * PGlite buffers writes, and `process.exit()` without it silently discards
 * whatever has not been synced.
 */
export async function closeDb(): Promise<void> {
  const pending = globalForDb.__opportunityDb;
  if (!pending) return;
  globalForDb.__opportunityDb = undefined;

  const db = await pending;
  const client = db.$client as { close?: () => Promise<void>; end?: () => Promise<void> };
  await client?.close?.();
  await client?.end?.();
}

export { schema };
