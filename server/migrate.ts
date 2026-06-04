/**
 * Startup schema migrations — runs on every server boot.
 * Uses ADD COLUMN IF NOT EXISTS so each statement is fully idempotent.
 * This guarantees the schema is always up-to-date regardless of whether
 * the docker-entrypoint db:push ran successfully.
 */

import { getDb } from "./db";
import { sql } from "drizzle-orm";

const MIGRATIONS: { name: string; ddl: string }[] = [
  // ── destinations ────────────────────────────────────────────────────────────
  {
    name: "destinations.country",
    ddl: "ALTER TABLE destinations ADD COLUMN IF NOT EXISTS country VARCHAR(60) NOT NULL DEFAULT ''",
  },
  {
    name: "destinations.continent",
    ddl: "ALTER TABLE destinations ADD COLUMN IF NOT EXISTS continent VARCHAR(30) NOT NULL DEFAULT ''",
  },

  // ── flightScans ──────────────────────────────────────────────────────────────
  {
    name: "flightScans.origin",
    ddl: "ALTER TABLE flightScans ADD COLUMN IF NOT EXISTS origin VARCHAR(3) NOT NULL DEFAULT 'SYD'",
  },
  {
    name: "flightScans.lowestIn7Days",
    ddl: "ALTER TABLE flightScans ADD COLUMN IF NOT EXISTS lowestIn7Days DECIMAL(10,2)",
  },
  {
    name: "flightScans.lowestIn30Days",
    ddl: "ALTER TABLE flightScans ADD COLUMN IF NOT EXISTS lowestIn30Days DECIMAL(10,2)",
  },
  {
    name: "flightScans.lowestIn90Days",
    ddl: "ALTER TABLE flightScans ADD COLUMN IF NOT EXISTS lowestIn90Days DECIMAL(10,2)",
  },

  // ── users ────────────────────────────────────────────────────────────────────
  {
    name: "users.passwordHash",
    ddl: "ALTER TABLE users ADD COLUMN IF NOT EXISTS passwordHash VARCHAR(255)",
  },
];

export async function runMigrations(): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Migrate] Database not available — skipping migrations");
    return;
  }

  let applied = 0;
  let failed = 0;

  for (const { name, ddl } of MIGRATIONS) {
    try {
      await db.execute(sql.raw(ddl));
      applied++;
    } catch (err) {
      failed++;
      console.error(`[Migrate] Failed: ${name}`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`[Migrate] Done — ${applied} statements applied, ${failed} failed`);
}
