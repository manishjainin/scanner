/**
 * Australian school-term holiday calendar.
 *
 * Each origin city maps to its state; the scanner targets that state's
 * upcoming term-holiday windows for departure dates.
 *
 * Seed dates below are BEST-EFFORT and must be verified against official
 * state education department calendars. They are fully admin-editable in
 * Settings → Term Holidays.
 */

import { and, asc, eq, gte } from "drizzle-orm";
import { getDb } from "./db";
import { termHolidays, type TermHoliday } from "../drizzle/schema";

// ─── Origin IATA → Australian state ────────────────────────────────────────────
export const ORIGIN_STATE: Record<string, string> = {
  SYD: "NSW", // Sydney
  MEL: "VIC", // Melbourne
  AVV: "VIC", // Avalon
  BNE: "QLD", // Brisbane
  OOL: "QLD", // Gold Coast
  CNS: "QLD", // Cairns
  PER: "WA",  // Perth
  ADL: "SA",  // Adelaide
  CBR: "ACT", // Canberra
  HBA: "TAS", // Hobart
  LST: "TAS", // Launceston
  DRW: "NT",  // Darwin
};

export const STATE_NAMES: Record<string, string> = {
  NSW: "New South Wales", VIC: "Victoria", QLD: "Queensland", WA: "Western Australia",
  SA: "South Australia", ACT: "Aust. Capital Territory", TAS: "Tasmania", NT: "Northern Territory",
};

export function stateForOrigin(iata: string): string | null {
  return ORIGIN_STATE[iata.toUpperCase()] ?? null;
}

// ─── Best-effort seed data (VERIFY against official sources) ────────────────────
// Format: [state, label, startDate, endDate]
const SEED_HOLIDAYS: Array<[string, string, string, string]> = [
  // ── Winter break (after Term 2) — July 2026 ──
  ["NSW", "Term 2 Holidays 2026", "2026-07-06", "2026-07-17"],
  ["VIC", "Term 2 Holidays 2026", "2026-06-29", "2026-07-10"],
  ["QLD", "Term 2 Holidays 2026", "2026-06-29", "2026-07-10"],
  ["WA",  "Term 2 Holidays 2026", "2026-07-04", "2026-07-19"],
  ["SA",  "Term 2 Holidays 2026", "2026-07-06", "2026-07-17"],
  ["ACT", "Term 2 Holidays 2026", "2026-07-06", "2026-07-17"],
  ["TAS", "Term 2 Holidays 2026", "2026-07-06", "2026-07-17"],
  ["NT",  "Term 2 Holidays 2026", "2026-06-27", "2026-07-20"],

  // ── Spring break (after Term 3) — Sep/Oct 2026 ──
  ["NSW", "Term 3 Holidays 2026", "2026-09-28", "2026-10-09"],
  ["VIC", "Term 3 Holidays 2026", "2026-09-19", "2026-10-04"],
  ["QLD", "Term 3 Holidays 2026", "2026-09-19", "2026-10-04"],
  ["WA",  "Term 3 Holidays 2026", "2026-09-26", "2026-10-11"],
  ["SA",  "Term 3 Holidays 2026", "2026-09-28", "2026-10-09"],
  ["ACT", "Term 3 Holidays 2026", "2026-09-28", "2026-10-09"],
  ["TAS", "Term 3 Holidays 2026", "2026-09-28", "2026-10-09"],
  ["NT",  "Term 3 Holidays 2026", "2026-09-26", "2026-10-11"],

  // ── Summer break (after Term 4) — Dec 2026 – Jan 2027 ──
  ["NSW", "Summer Holidays 2026/27", "2026-12-19", "2027-01-27"],
  ["VIC", "Summer Holidays 2026/27", "2026-12-19", "2027-01-28"],
  ["QLD", "Summer Holidays 2026/27", "2026-12-12", "2027-01-26"],
  ["WA",  "Summer Holidays 2026/27", "2026-12-18", "2027-01-31"],
  ["SA",  "Summer Holidays 2026/27", "2026-12-12", "2027-01-26"],
  ["ACT", "Summer Holidays 2026/27", "2026-12-19", "2027-01-31"],
  ["TAS", "Summer Holidays 2026/27", "2026-12-18", "2027-02-09"],
  ["NT",  "Summer Holidays 2026/27", "2026-12-12", "2027-01-27"],

  // ── Autumn break (after Term 1) — April 2027 ──
  ["NSW", "Term 1 Holidays 2027", "2027-04-10", "2027-04-26"],
  ["VIC", "Term 1 Holidays 2027", "2027-04-02", "2027-04-18"],
  ["QLD", "Term 1 Holidays 2027", "2027-04-03", "2027-04-18"],
  ["WA",  "Term 1 Holidays 2027", "2027-04-09", "2027-04-25"],
  ["SA",  "Term 1 Holidays 2027", "2027-04-10", "2027-04-26"],
  ["ACT", "Term 1 Holidays 2027", "2027-04-10", "2027-04-26"],
  ["TAS", "Term 1 Holidays 2027", "2027-04-10", "2027-04-26"],
  ["NT",  "Term 1 Holidays 2027", "2027-04-10", "2027-04-26"],
];

export async function seedTermHolidays(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const existing = await db.select().from(termHolidays).limit(1);
  if (existing.length > 0) return; // already seeded

  await db.insert(termHolidays).values(
    SEED_HOLIDAYS.map(([state, label, startDate, endDate]) => ({ state, label, startDate, endDate })),
  );
  console.log("[Holidays] Seeded best-effort term holiday calendar (verify in Settings)");
}

// ─── Queries ───────────────────────────────────────────────────────────────────
export async function getAllTermHolidays(): Promise<TermHoliday[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(termHolidays).orderBy(asc(termHolidays.startDate));
}

export async function createTermHoliday(data: { state: string; label: string; startDate: string; endDate: string }): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [r] = await db.insert(termHolidays).values({
    state: data.state.toUpperCase(),
    label: data.label,
    startDate: data.startDate,
    endDate: data.endDate,
  }).$returningId();
  return r!.id;
}

export async function updateTermHoliday(id: number, data: Partial<{ state: string; label: string; startDate: string; endDate: string }>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const patch = { ...data };
  if (patch.state) patch.state = patch.state.toUpperCase();
  await db.update(termHolidays).set(patch).where(eq(termHolidays.id, id));
}

export async function deleteTermHoliday(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(termHolidays).where(eq(termHolidays.id, id));
}

/** Upcoming (future end-date) holiday windows for a state, soonest first. */
export async function getUpcomingHolidayWindows(state: string, fromDate = new Date()): Promise<TermHoliday[]> {
  const db = await getDb();
  if (!db) return [];
  const fromStr = fromDate.toISOString().split("T")[0]!;
  return db
    .select()
    .from(termHolidays)
    .where(and(eq(termHolidays.state, state), gte(termHolidays.endDate, fromStr)))
    .orderBy(asc(termHolidays.startDate));
}
