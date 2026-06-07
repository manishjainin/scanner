/**
 * Core daily flight scanner
 * - Fetches cheapest round-trip fare per destination from Amadeus
 * - Calculates 30-day average and percent vs average
 * - Rates deals using OpenAI (GPT-5 by default): "Hot Deal" | "Good Price" | "Standard"
 * - Triggers owner push notification when fare is >15% below 30-day average
 */

import { and, avg, desc, eq, gte, asc, min } from "drizzle-orm";
import { getDb, getSetting } from "./db";
import { destinations, flightScans, scanRuns, type Destination } from "../drizzle/schema";
import { searchFlights } from "./amadeus";
import { notifyOwner } from "./_core/notification";
import { stateForOrigin, getUpcomingHolidayWindows, seedTermHolidays } from "./holidays";
import { refreshBestSeasons } from "./seasons";
import { OPENAI_MODEL, OPENAI_REASONING_EFFORT } from "./openaiModel";

const DEFAULT_ORIGIN = "SYD";
const HOT_DEAL_THRESHOLD = -15; // % below average (default, overridden by appSettings)
const GOOD_PRICE_THRESHOLD = -5; // % below average

async function getConfiguredOrigins(): Promise<string[]> {
  const val = await getSetting("scan.origins");
  if (!val) return [DEFAULT_ORIGIN];
  return val.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
}

async function getHotDealThreshold(): Promise<number> {
  const val = await getSetting("notification.hotDealThreshold");
  return val ? parseFloat(val) : HOT_DEAL_THRESHOLD;
}

async function areNotificationsEnabled(): Promise<boolean> {
  const val = await getSetting("notification.enabled");
  return val !== "false";
}

async function getMaxSearchesPerRun(): Promise<number> {
  const val = await getSetting("scan.maxSearchesPerRun");
  const n = val ? parseInt(val, 10) : 80;
  return Number.isFinite(n) && n > 0 ? n : 80;
}

async function getMaxWindowsPerRoute(): Promise<number> {
  const val = await getSetting("scan.maxWindowsPerRoute");
  const n = val ? parseInt(val, 10) : 2;
  return Number.isFinite(n) && n >= 1 ? n : 2;
}

function monthOf(dateStr: string): number {
  return parseInt(dateStr.slice(5, 7), 10);
}

function daysUntil(dateStr: string, from: Date): number {
  return Math.round((new Date(dateStr).getTime() - from.getTime()) / 86_400_000);
}

// ─── Candidate (one origin → dest → holiday window search target) ──────────────
interface ScanCandidate {
  origin: string;
  dest: Destination;
  departureDate: string;
  returnDate: string;
  holidayLabel: string | null;
  holidayState: string | null;
  inBestSeason: boolean;
  score: number; // higher = scanned first within the cap
}

/**
 * Build the prioritised list of search candidates.
 * - Each origin maps to a state → upcoming term-holiday windows.
 * - Per route: always the single best window, plus any *additional in-season*
 *   windows up to maxWindowsPerRoute (so e.g. Bali surfaces both Apr + Sep breaks).
 * - Origins/states without holiday data fall back to legacy bookingWindowDays.
 */
async function buildCandidates(
  origins: string[],
  dests: Destination[],
  maxWindowsPerRoute: number,
): Promise<ScanCandidate[]> {
  const now = new Date();
  const today = todayStr();
  const candidates: ScanCandidate[] = [];

  // Cache holiday windows per state
  const windowsByState = new Map<string, Awaited<ReturnType<typeof getUpcomingHolidayWindows>>>();

  for (const origin of origins) {
    const state = stateForOrigin(origin);
    if (state && !windowsByState.has(state)) {
      windowsByState.set(state, await getUpcomingHolidayWindows(state, now));
    }
    const windows = state ? windowsByState.get(state) ?? [] : [];

    for (const dest of dests) {
      if (dest.iataCode === origin) continue;
      const stay = dest.defaultTripDays;
      const best = dest.bestMonths ?? [];

      if (windows.length === 0) {
        // Fallback: no holiday calendar for this state — legacy booking-window search
        const departureDate = addDays(today, dest.bookingWindowDays);
        const inSeason = best.length > 0 && best.includes(monthOf(departureDate));
        candidates.push({
          origin, dest, departureDate,
          returnDate: addDays(departureDate, stay),
          holidayLabel: null, holidayState: state,
          inBestSeason: inSeason,
          score: (inSeason ? 1000 : 0) - dest.bookingWindowDays,
        });
        continue;
      }

      // Score each upcoming window for this destination
      const scored = windows.map((w) => {
        const inSeason = best.length > 0 && best.includes(monthOf(w.startDate));
        return { w, inSeason, days: daysUntil(w.startDate, now) };
      });
      // Sort: in-season first, then soonest
      scored.sort((a, b) => (Number(b.inSeason) - Number(a.inSeason)) || (a.days - b.days));

      // Always take the top window; add further windows only if in-season
      const chosen = [scored[0]!];
      for (const s of scored.slice(1)) {
        if (chosen.length >= maxWindowsPerRoute) break;
        if (s.inSeason) chosen.push(s);
      }

      for (const c of chosen) {
        candidates.push({
          origin, dest,
          departureDate: c.w.startDate,
          returnDate: addDays(c.w.startDate, stay),
          holidayLabel: state ? `${state} ${c.w.label}` : c.w.label,
          holidayState: state,
          inBestSeason: c.inSeason,
          score: (c.inSeason ? 1000 : 0) - c.days,
        });
      }
    }
  }

  // Prioritise: in-season first, then soonest departure
  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

// ─── Seed default destinations ────────────────────────────────────────────────
const DEFAULT_DESTINATIONS = [
  // ── Asia Pacific ──────────────────────────────────────────────────────────
  { name: "Bali",          iataCode: "DPS", country: "Indonesia",    continent: "Asia",    region: "SE Asia",     bookingWindowDays: 90,  defaultTripDays: 10 },
  { name: "Tokyo",         iataCode: "NRT", country: "Japan",        continent: "Asia",    region: "NE Asia",     bookingWindowDays: 120, defaultTripDays: 12 },
  { name: "Singapore",     iataCode: "SIN", country: "Singapore",    continent: "Asia",    region: "SE Asia",     bookingWindowDays: 90,  defaultTripDays: 7  },
  { name: "Bangkok",       iataCode: "BKK", country: "Thailand",     continent: "Asia",    region: "SE Asia",     bookingWindowDays: 90,  defaultTripDays: 10 },
  { name: "Hong Kong",     iataCode: "HKG", country: "Hong Kong",    continent: "Asia",    region: "NE Asia",     bookingWindowDays: 90,  defaultTripDays: 7  },
  { name: "Kuala Lumpur",  iataCode: "KUL", country: "Malaysia",     continent: "Asia",    region: "SE Asia",     bookingWindowDays: 90,  defaultTripDays: 7  },
  { name: "Ho Chi Minh",   iataCode: "SGN", country: "Vietnam",      continent: "Asia",    region: "SE Asia",     bookingWindowDays: 90,  defaultTripDays: 10 },
  { name: "Hanoi",         iataCode: "HAN", country: "Vietnam",      continent: "Asia",    region: "SE Asia",     bookingWindowDays: 90,  defaultTripDays: 10 },
  { name: "Mumbai",        iataCode: "BOM", country: "India",        continent: "Asia",    region: "South Asia",  bookingWindowDays: 120, defaultTripDays: 14 },
  { name: "Delhi",         iataCode: "DEL", country: "India",        continent: "Asia",    region: "South Asia",  bookingWindowDays: 120, defaultTripDays: 14 },
  { name: "Chennai",       iataCode: "MAA", country: "India",        continent: "Asia",    region: "South Asia",  bookingWindowDays: 120, defaultTripDays: 14 },
  { name: "Bangalore",     iataCode: "BLR", country: "India",        continent: "Asia",    region: "South Asia",  bookingWindowDays: 120, defaultTripDays: 14 },
  { name: "Seoul",         iataCode: "ICN", country: "South Korea",  continent: "Asia",    region: "NE Asia",     bookingWindowDays: 120, defaultTripDays: 10 },
  // ── Pacific ───────────────────────────────────────────────────────────────
  { name: "Auckland",      iataCode: "AKL", country: "New Zealand",  continent: "Pacific", region: "Pacific",     bookingWindowDays: 60,  defaultTripDays: 7  },
  { name: "Fiji",          iataCode: "NAN", country: "Fiji",         continent: "Pacific", region: "Pacific",     bookingWindowDays: 90,  defaultTripDays: 7  },
  // ── Middle East ───────────────────────────────────────────────────────────
  { name: "Dubai",         iataCode: "DXB", country: "UAE",          continent: "Middle East", region: "Middle East", bookingWindowDays: 120, defaultTripDays: 10 },
  { name: "Abu Dhabi",     iataCode: "AUH", country: "UAE",          continent: "Middle East", region: "Middle East", bookingWindowDays: 120, defaultTripDays: 10 },
  // ── Europe ────────────────────────────────────────────────────────────────
  { name: "London",        iataCode: "LHR", country: "UK",           continent: "Europe",  region: "Europe",      bookingWindowDays: 150, defaultTripDays: 14 },
  { name: "Paris",         iataCode: "CDG", country: "France",       continent: "Europe",  region: "Europe",      bookingWindowDays: 150, defaultTripDays: 14 },
  { name: "Rome",          iataCode: "FCO", country: "Italy",        continent: "Europe",  region: "Europe",      bookingWindowDays: 150, defaultTripDays: 14 },
  { name: "Barcelona",     iataCode: "BCN", country: "Spain",        continent: "Europe",  region: "Europe",      bookingWindowDays: 150, defaultTripDays: 14 },
  { name: "Amsterdam",     iataCode: "AMS", country: "Netherlands",  continent: "Europe",  region: "Europe",      bookingWindowDays: 150, defaultTripDays: 14 },
  { name: "Frankfurt",     iataCode: "FRA", country: "Germany",      continent: "Europe",  region: "Europe",      bookingWindowDays: 150, defaultTripDays: 14 },
  { name: "Zurich",        iataCode: "ZRH", country: "Switzerland",  continent: "Europe",  region: "Europe",      bookingWindowDays: 150, defaultTripDays: 14 },
  // ── Americas ──────────────────────────────────────────────────────────────
  { name: "New York",      iataCode: "JFK", country: "USA",          continent: "Americas", region: "N America",  bookingWindowDays: 150, defaultTripDays: 14 },
  { name: "Los Angeles",   iataCode: "LAX", country: "USA",          continent: "Americas", region: "N America",  bookingWindowDays: 120, defaultTripDays: 14 },
  { name: "Cancun",        iataCode: "CUN", country: "Mexico",       continent: "Americas", region: "N America",  bookingWindowDays: 150, defaultTripDays: 12 },
  // ── Africa ────────────────────────────────────────────────────────────────
  { name: "Johannesburg",  iataCode: "JNB", country: "South Africa", continent: "Africa",  region: "Africa",      bookingWindowDays: 150, defaultTripDays: 14 },
  { name: "Cape Town",     iataCode: "CPT", country: "South Africa", continent: "Africa",  region: "Africa",      bookingWindowDays: 150, defaultTripDays: 14 },
];

export async function seedDestinations(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const existing = await db.select().from(destinations);
  if (existing.length > 0) return; // already seeded

  await db.insert(destinations).values(DEFAULT_DESTINATIONS);
  console.log("[Scanner] Seeded default destinations");
}

// ─── Add departure date ───────────────────────────────────────────────────────
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0]!;
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0]!;
}

// ─── Historical lows for a destination ───────────────────────────────────────
async function getHistoricalLows(
  destinationId: number,
  origin = DEFAULT_ORIGIN,
): Promise<{ low7d: number | null; low30d: number | null; low90d: number | null }> {
  const db = await getDb();
  if (!db) return { low7d: null, low30d: null, low90d: null };

  const now = new Date();
  const cut7  = new Date(now); cut7.setDate(now.getDate() - 7);
  const cut30 = new Date(now); cut30.setDate(now.getDate() - 30);
  const cut90 = new Date(now); cut90.setDate(now.getDate() - 90);

  const [r7, r30, r90] = await Promise.all([
    db.select({ v: min(flightScans.price) }).from(flightScans)
      .where(and(eq(flightScans.destinationId, destinationId), eq(flightScans.origin, origin), gte(flightScans.scannedAt, cut7))),
    db.select({ v: min(flightScans.price) }).from(flightScans)
      .where(and(eq(flightScans.destinationId, destinationId), eq(flightScans.origin, origin), gte(flightScans.scannedAt, cut30))),
    db.select({ v: min(flightScans.price) }).from(flightScans)
      .where(and(eq(flightScans.destinationId, destinationId), eq(flightScans.origin, origin), gte(flightScans.scannedAt, cut90))),
  ]);

  const parse = (v: string | null | undefined) => (v ? parseFloat(String(v)) : null);
  return {
    low7d:  parse(r7[0]?.v),
    low30d: parse(r30[0]?.v),
    low90d: parse(r90[0]?.v),
  };
}

// ─── 30-day average price for a destination ───────────────────────────────────
async function getThirtyDayAvg(destinationId: number, origin = DEFAULT_ORIGIN): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const result = await db
    .select({ avgPrice: avg(flightScans.price) })
    .from(flightScans)
    .where(
      and(
        eq(flightScans.destinationId, destinationId),
        eq(flightScans.origin, origin),
        gte(flightScans.scannedAt, thirtyDaysAgo)
      )
    );

  const val = result[0]?.avgPrice;
  return val ? parseFloat(String(val)) : null;
}

// ─── AI deal rating + summary ─────────────────────────────────────────────────
async function rateWithAI(params: {
  origin: string;
  destination: string;
  price: number;
  currency: string;
  airline: string;
  stops: number;
  departureDate: string;
  returnDate: string;
  outboundDuration: string;
  returnDuration: string;
  thirtyDayAvg: number | null;
  percentVsAvg: number | null;
}): Promise<{ dealRating: "Hot Deal" | "Good Price" | "Standard"; aiSummary: string; aiTravelTip: string }> {
  const avgText = params.thirtyDayAvg
    ? `The 30-day average price for this route is $${params.thirtyDayAvg.toFixed(0)} ${params.currency} (${params.percentVsAvg !== null ? (params.percentVsAvg > 0 ? "+" : "") + params.percentVsAvg.toFixed(1) + "% vs average" : "no comparison available"}).`
    : "No historical price data is available yet for comparison.";

  const prompt = `You are a flight deal analyst for Australian travellers. Evaluate this flight deal and respond in JSON.

Flight details:
- Route: ${params.origin} → ${params.destination} (round trip)
- Price: $${params.price.toFixed(0)} ${params.currency}
- Airline: ${params.airline}
- Stops: ${params.stops === 0 ? "Direct" : params.stops + " stop(s)"}
- Departure: ${params.departureDate}, Return: ${params.returnDate}
- Outbound flight time: ${params.outboundDuration}
- Return flight time: ${params.returnDuration}
- ${avgText}

Rate this deal as exactly one of: "Hot Deal", "Good Price", or "Standard".
- "Hot Deal": price is significantly below average (>10% cheaper) or an exceptional fare for the route
- "Good Price": price is slightly below average (3–10% cheaper) or competitive for the route  
- "Standard": price is at or above average, or no clear advantage

Respond with JSON only:
{
  "dealRating": "Hot Deal" | "Good Price" | "Standard",
  "aiSummary": "One sentence (max 20 words) describing this deal for the dashboard card",
  "aiTravelTip": "One practical travel tip for this destination (max 30 words)"
}`;

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        reasoning_effort: OPENAI_REASONING_EFFORT,
        messages: [{ role: "user", content: prompt }],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "deal_rating",
            strict: true,
            schema: {
              type: "object",
              properties: {
                dealRating: { type: "string", enum: ["Hot Deal", "Good Price", "Standard"] },
                aiSummary: { type: "string" },
                aiTravelTip: { type: "string" },
              },
              required: ["dealRating", "aiSummary", "aiTravelTip"],
              additionalProperties: false,
            },
          },
        },
        max_completion_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${errText}`);
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> };
    const content = data.choices[0]?.message?.content;
    if (!content) throw new Error("Empty AI response");
    const parsed = JSON.parse(content) as { dealRating: "Hot Deal" | "Good Price" | "Standard"; aiSummary: string; aiTravelTip: string };
    return parsed;
  } catch (err) {
    console.error("[Scanner] AI rating failed:", err);
    // Fallback to rule-based rating
    let dealRating: "Hot Deal" | "Good Price" | "Standard" = "Standard";
    if (params.percentVsAvg !== null) {
      if (params.percentVsAvg <= HOT_DEAL_THRESHOLD) dealRating = "Hot Deal";
      else if (params.percentVsAvg <= GOOD_PRICE_THRESHOLD) dealRating = "Good Price";
    }
    return {
      dealRating,
      aiSummary: `Round trip from ${params.origin} to ${params.destination} for $${params.price.toFixed(0)} ${params.currency}.`,
      aiTravelTip: `Book in advance for the best fares to ${params.destination}.`,
    };
  }
}

// ─── Main scan function ───────────────────────────────────────────────────────
export async function runScan(triggeredBy: "cron" | "manual" = "cron"): Promise<{
  scanRunId: number;
  results: Array<{ destination: string; origin: string; success: boolean; price?: number; error?: string }>;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await seedDestinations();
  await seedTermHolidays();
  // Fill in any missing best-season data (no-op for destinations already set)
  await refreshBestSeasons(false).catch((e) => console.error("[Scanner] Season refresh failed:", e));

  const [scanRun] = await db
    .insert(scanRuns)
    .values({ triggeredBy, status: "running" })
    .$returningId();

  const scanRunId = scanRun!.id;
  const results: Array<{ destination: string; origin: string; holiday?: string | null; success: boolean; price?: number; error?: string }> = [];

  const activeDestinations = await db
    .select()
    .from(destinations)
    .where(eq(destinations.isActive, true));

  const origins = await getConfiguredOrigins();
  const [hotDealThreshold, notificationsEnabled, maxSearches, maxWindowsPerRoute] = await Promise.all([
    getHotDealThreshold(),
    areNotificationsEnabled(),
    getMaxSearchesPerRun(),
    getMaxWindowsPerRoute(),
  ]);

  // Build prioritised candidate list, then cap to the per-run budget
  const allCandidates = await buildCandidates(origins, activeDestinations, maxWindowsPerRoute);
  const candidates = allCandidates.slice(0, maxSearches);
  console.log(`[Scanner] ${allCandidates.length} candidates, scanning top ${candidates.length} (cap ${maxSearches})`);

  let successCount = 0;

  for (const cand of candidates) {
    const { origin, dest } = cand;
    try {
      const offers = await searchFlights({
        origin,
        destination: dest.iataCode,
        departureDate: cand.departureDate,
        returnDate: cand.returnDate,
        adults: 1,
        max: 5,
      });

      if (offers.length === 0) {
        results.push({ destination: dest.name, origin, holiday: cand.holidayLabel, success: false, error: "No flights found" });
        continue;
      }

      const best = offers.sort((a, b) => a.price - b.price)[0]!;

      const [thirtyDayAvg, historicalLows] = await Promise.all([
        getThirtyDayAvg(dest.id, origin),
        getHistoricalLows(dest.id, origin),
      ]);
      const percentVsAvg =
        thirtyDayAvg !== null ? ((best.price - thirtyDayAvg) / thirtyDayAvg) * 100 : null;

      const lowestIn7Days  = historicalLows.low7d  !== null ? Math.min(historicalLows.low7d,  best.price) : best.price;
      const lowestIn30Days = historicalLows.low30d !== null ? Math.min(historicalLows.low30d, best.price) : best.price;
      const lowestIn90Days = historicalLows.low90d !== null ? Math.min(historicalLows.low90d, best.price) : best.price;

      const { dealRating, aiSummary, aiTravelTip } = await rateWithAI({
        origin,
        destination: dest.name,
        price: best.price,
        currency: best.currency,
        airline: best.airlineCode,
        stops: best.stops,
        departureDate: best.departureDate,
        returnDate: best.returnDate,
        outboundDuration: best.outboundDuration,
        returnDuration: best.returnDuration,
        thirtyDayAvg,
        percentVsAvg,
      });

      await db.insert(flightScans).values({
        scanRunId,
        destinationId: dest.id,
        origin,
        departureDate: best.departureDate,
        returnDate: best.returnDate,
        price: String(best.price),
        currency: best.currency,
        airline: best.airline,
        airlineCode: best.airlineCode,
        stops: best.stops,
        outboundDuration: best.outboundDuration,
        returnDuration: best.returnDuration,
        seatsAvailable: best.seatsAvailable,
        cabinClass: best.cabinClass,
        outboundSegments: best.outboundSegments,
        returnSegments: best.returnSegments,
        dealRating,
        aiSummary,
        aiTravelTip,
        thirtyDayAvg: thirtyDayAvg !== null ? String(thirtyDayAvg.toFixed(2)) : null,
        percentVsAvg: percentVsAvg !== null ? String(percentVsAvg.toFixed(2)) : null,
        lowestIn7Days:  String(lowestIn7Days.toFixed(2)),
        lowestIn30Days: String(lowestIn30Days.toFixed(2)),
        lowestIn90Days: String(lowestIn90Days.toFixed(2)),
        holidayLabel: cand.holidayLabel,
        holidayState: cand.holidayState,
        inBestSeason: cand.inBestSeason,
        rawData: best.raw,
      });

      if (notificationsEnabled && percentVsAvg !== null && percentVsAvg <= hotDealThreshold) {
        try {
          const when = cand.holidayLabel ? ` for ${cand.holidayLabel}` : "";
          await notifyOwner({
            title: `🔥 Hot Deal Alert: ${dest.name}`,
            content: `${origin} → ${dest.name}${when} is now $${best.price.toFixed(0)} ${best.currency} — ${Math.abs(percentVsAvg).toFixed(1)}% below the 30-day average of $${thirtyDayAvg!.toFixed(0)}. Departs ${best.departureDate}, returns ${best.returnDate}.`,
          });
        } catch (notifyErr) {
          console.error("[Scanner] Notification failed:", notifyErr);
        }
      }

      successCount++;
      results.push({ destination: dest.name, origin, holiday: cand.holidayLabel, success: true, price: best.price });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[Scanner] Failed for ${dest.name} from ${origin}:`, message);
      results.push({ destination: dest.name, origin, holiday: cand.holidayLabel, success: false, error: message });
    }
  }

  await db
    .update(scanRuns)
    .set({
      completedAt: new Date(),
      status: successCount > 0 ? "completed" : "failed",
      destinationCount: candidates.length,
      successCount,
    })
    .where(eq(scanRuns.id, scanRunId));

  return { scanRunId, results };
}

// ─── Get today's latest scan per destination ──────────────────────────────────
export async function getTodayDeals(origin?: string) {
  const db = await getDb();
  if (!db) return [];

  const whereClause = origin
    ? eq(flightScans.origin, origin)
    : undefined;

  const scans = await db
    .select({
      scan: flightScans,
      destination: destinations,
    })
    .from(flightScans)
    .innerJoin(destinations, eq(flightScans.destinationId, destinations.id))
    .where(whereClause)
    .orderBy(desc(flightScans.scannedAt));

  // Keep only the latest scan per (destination, origin, holiday window).
  // Different holiday windows for the same route surface as separate cards.
  const seen = new Set<string>();
  return scans.filter((row) => {
    const key = `${row.destination.id}:${row.scan.origin}:${row.scan.holidayLabel ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Get price history for a destination (days=0 means all-time) ─────────────
export async function getPriceHistory(destinationId: number, days = 30, origin = DEFAULT_ORIGIN) {
  const db = await getDb();
  if (!db) return [];

  const cutoff = new Date();
  if (days > 0) cutoff.setDate(cutoff.getDate() - days);

  const whereClause = days > 0
    ? and(eq(flightScans.destinationId, destinationId), eq(flightScans.origin, origin), gte(flightScans.scannedAt, cutoff))
    : and(eq(flightScans.destinationId, destinationId), eq(flightScans.origin, origin));

  const rows = await db
    .select({
      scannedAt: flightScans.scannedAt,
      price: flightScans.price,
      dealRating: flightScans.dealRating,
    })
    .from(flightScans)
    .where(whereClause)
    .orderBy(asc(flightScans.scannedAt));

  // One data point per day (latest scan of the day)
  const byDay = new Map<string, typeof rows[0]>();
  for (const row of rows) {
    const day = row.scannedAt.toISOString().split("T")[0]!;
    byDay.set(day, row);
  }

  return Array.from(byDay.entries()).map(([date, row]) => ({
    date,
    price: parseFloat(String(row.price)),
    dealRating: row.dealRating,
  }));
}

// ─── Get full scan table for a destination ────────────────────────────────────
export async function getFullScanHistory(destinationId: number, origin = DEFAULT_ORIGIN) {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select({
      id: flightScans.id,
      scannedAt: flightScans.scannedAt,
      price: flightScans.price,
      currency: flightScans.currency,
      airline: flightScans.airline,
      stops: flightScans.stops,
      departureDate: flightScans.departureDate,
      returnDate: flightScans.returnDate,
      dealRating: flightScans.dealRating,
      percentVsAvg: flightScans.percentVsAvg,
      origin: flightScans.origin,
    })
    .from(flightScans)
    .where(and(eq(flightScans.destinationId, destinationId), eq(flightScans.origin, origin)))
    .orderBy(desc(flightScans.scannedAt))
    .limit(90);

  return rows.map((r) => ({
    ...r,
    price: parseFloat(String(r.price)),
    percentVsAvg: r.percentVsAvg ? parseFloat(String(r.percentVsAvg)) : null,
  }));
}

// ─── Get latest scan for a specific destination ───────────────────────────────
export async function getLatestScanForDestination(destinationId: number) {
  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select()
    .from(flightScans)
    .where(eq(flightScans.destinationId, destinationId))
    .orderBy(desc(flightScans.scannedAt))
    .limit(1);

  return rows[0] ?? null;
}

// ─── Get available origins from settings ─────────────────────────────────────
export async function getAvailableOrigins(): Promise<string[]> {
  return getConfiguredOrigins();
}

// ─── Get recent scan runs ─────────────────────────────────────────────────────
export async function getRecentScanRuns(limit = 10) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(scanRuns)
    .orderBy(desc(scanRuns.startedAt))
    .limit(limit);
}
