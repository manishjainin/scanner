/**
 * Startup schema migrations — runs on every server boot, before requests.
 *
 * IMPORTANT: standard MySQL 8.0 does NOT support `ALTER TABLE ... ADD COLUMN
 * IF NOT EXISTS` (that is MariaDB/TiDB syntax). So we introspect
 * information_schema to find which columns already exist and only run a plain
 * `ADD COLUMN` for the missing ones. This is safe and idempotent on all
 * MySQL-compatible engines.
 */

import { getDb } from "./db";
import { sql } from "drizzle-orm";

// ── Columns that must exist (added across feature work) ────────────────────────
interface ColumnMigration { table: string; column: string; definition: string; }

const COLUMN_MIGRATIONS: ColumnMigration[] = [
  // destinations
  { table: "destinations", column: "country",          definition: "VARCHAR(60) NOT NULL DEFAULT ''" },
  { table: "destinations", column: "continent",        definition: "VARCHAR(30) NOT NULL DEFAULT ''" },
  { table: "destinations", column: "bestMonths",       definition: "JSON" },
  { table: "destinations", column: "bestMonthsSource", definition: "VARCHAR(10) NOT NULL DEFAULT 'ai'" },
  // flightScans
  { table: "flightScans", column: "origin",         definition: "VARCHAR(3) NOT NULL DEFAULT 'SYD'" },
  { table: "flightScans", column: "lowestIn7Days",  definition: "DECIMAL(10,2)" },
  { table: "flightScans", column: "lowestIn30Days", definition: "DECIMAL(10,2)" },
  { table: "flightScans", column: "lowestIn90Days", definition: "DECIMAL(10,2)" },
  { table: "flightScans", column: "holidayLabel",   definition: "VARCHAR(100)" },
  { table: "flightScans", column: "holidayState",   definition: "VARCHAR(3)" },
  { table: "flightScans", column: "inBestSeason",   definition: "BOOLEAN NOT NULL DEFAULT FALSE" },
  // users
  { table: "users", column: "passwordHash", definition: "VARCHAR(255)" },
];

// ── Tables to ensure exist (CREATE TABLE IF NOT EXISTS *is* valid MySQL) ────────
const TABLE_MIGRATIONS: { name: string; ddl: string }[] = [
  {
    name: "termHolidays",
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

/** mysql2 .execute() returns [rows, fields]; normalize to a plain rows array. */
function normalizeRows(res: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(res)) {
    if (res.length > 0 && Array.isArray(res[0])) return res[0] as Array<Record<string, unknown>>;
    return res as Array<Record<string, unknown>>;
  }
  if (res && typeof res === "object" && Array.isArray((res as { rows?: unknown[] }).rows)) {
    return (res as { rows: Array<Record<string, unknown>> }).rows;
  }
  return [];
}

async function getExistingColumns(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  table: string,
): Promise<Set<string>> {
  const res = await db.execute(sql`
    SELECT COLUMN_NAME AS c
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ${table}
  `);
  const rows = normalizeRows(res);
  return new Set(rows.map((r) => String(r.c ?? r.COLUMN_NAME ?? "")));
}

export async function runMigrations(): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Migrate] Database not available — skipping migrations");
    return;
  }

  // 1) Ensure new tables exist first
  for (const { name, ddl } of TABLE_MIGRATIONS) {
    try {
      await db.execute(sql.raw(ddl));
    } catch (err) {
      console.error(`[Migrate] Table ${name} failed:`, err instanceof Error ? err.message : err);
    }
  }

  // 2) Add any missing columns (introspect first, then plain ADD COLUMN)
  const tables = Array.from(new Set(COLUMN_MIGRATIONS.map((m) => m.table)));
  let added = 0;
  let skipped = 0;

  for (const table of tables) {
    let existing: Set<string>;
    try {
      existing = await getExistingColumns(db, table);
    } catch (err) {
      console.error(`[Migrate] Could not introspect ${table}:`, err instanceof Error ? err.message : err);
      continue;
    }
    if (existing.size === 0) {
      console.warn(`[Migrate] Table ${table} not found — skipping its column migrations`);
      continue;
    }

    for (const m of COLUMN_MIGRATIONS.filter((c) => c.table === table)) {
      if (existing.has(m.column)) { skipped++; continue; }
      try {
        await db.execute(sql.raw(`ALTER TABLE \`${m.table}\` ADD COLUMN \`${m.column}\` ${m.definition}`));
        console.log(`[Migrate] Added ${m.table}.${m.column}`);
        added++;
      } catch (err) {
        // Duplicate column (race / already added) is fine; anything else is logged
        const msg = err instanceof Error ? err.message : String(err);
        if (/duplicate column/i.test(msg)) { skipped++; }
        else console.error(`[Migrate] Failed ${m.table}.${m.column}:`, msg);
      }
    }
  }

  console.log(`[Migrate] Done — ${added} column(s) added, ${skipped} already present`);
}
