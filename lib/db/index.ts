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

  const pool = new Pool({
    connectionString: url,
    ssl: url.includes("sslmode=disable") ? false : { rejectUnauthorized: false },
    max: 5,
  });
  const db = drizzle(pool, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
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
