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

  // ── destinations: best season ─────────────────────────────────────────────────
  {
    name: "destinations.bestMonths",
    ddl: "ALTER TABLE destinations ADD COLUMN IF NOT EXISTS bestMonths JSON",
  },
  {
    name: "destinations.bestMonthsSource",
    ddl: "ALTER TABLE destinations ADD COLUMN IF NOT EXISTS bestMonthsSource ENUM('ai','manual') NOT NULL DEFAULT 'ai'",
  },

  // ── flightScans: holiday context ───────────────────────────────────────────────
  {
    name: "flightScans.holidayLabel",
    ddl: "ALTER TABLE flightScans ADD COLUMN IF NOT EXISTS holidayLabel VARCHAR(100)",
  },
  {
    name: "flightScans.holidayState",
    ddl: "ALTER TABLE flightScans ADD COLUMN IF NOT EXISTS holidayState VARCHAR(3)",
  },
  {
    name: "flightScans.inBestSeason",
    ddl: "ALTER TABLE flightScans ADD COLUMN IF NOT EXISTS inBestSeason BOOLEAN NOT NULL DEFAULT FALSE",
  },

  // ── termHolidays table ─────────────────────────────────────────────────────────
  {
    name: "termHolidays table",
    ddl: `CREATE TABLE IF NOT EXISTS termHolidays (
      id INT AUTO_INCREMENT PRIMARY KEY,
      state VARCHAR(3) NOT NULL,
      label VARCHAR(100) NOT NULL,
      startDate VARCHAR(10) NOT NULL,
      endDate VARCHAR(10) NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
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
