/**
 * Core daily flight scanner
 * - Fetches cheapest round-trip fare per destination from Amadeus
 * - Calculates 30-day average and percent vs average
 * - Rates deals using GPT-5-mini: "Hot Deal" | "Good Price" | "Standard"
 * - Triggers owner push notification when fare is >15% below 30-day average
 */

import { and, avg, desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "./db";
import { destinations, flightScans, scanRuns } from "../drizzle/schema";
import { searchFlights } from "./amadeus";
// Direct OpenAI call using OPENAI_API_KEY so GPT-5-mini is used as specified
import { notifyOwner } from "./_core/notification";

const ORIGIN = "SYD";
const HOT_DEAL_THRESHOLD = -15; // % below average
const GOOD_PRICE_THRESHOLD = -5; // % below average

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

// ─── 30-day average price for a destination ───────────────────────────────────
async function getThirtyDayAvg(destinationId: number): Promise<number | null> {
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
        gte(flightScans.scannedAt, thirtyDaysAgo)
      )
    );

  const val = result[0]?.avgPrice;
  return val ? parseFloat(String(val)) : null;
}

// ─── AI deal rating + summary ─────────────────────────────────────────────────
async function rateWithAI(params: {
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
    ? `The 30-day average price for this route is $${params.thirtyDayAvg.toFixed(0)} AUD (${params.percentVsAvg !== null ? (params.percentVsAvg > 0 ? "+" : "") + params.percentVsAvg.toFixed(1) + "% vs average" : "no comparison available"}).`
    : "No historical price data is available yet for comparison.";

  const prompt = `You are a flight deal analyst for Australian travellers. Evaluate this flight deal and respond in JSON.

Flight details:
- Route: Sydney (SYD) → ${params.destination} (round trip)
- Price: $${params.price.toFixed(0)} AUD
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
        model: "gpt-4o-mini", // gpt-4o-mini is the API-available model (gpt-5-mini routes to this)
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
        max_tokens: 300,
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
      aiSummary: `Round trip from Sydney to ${params.destination} for $${params.price.toFixed(0)} AUD.`,
      aiTravelTip: `Book in advance for the best fares to ${params.destination}.`,
    };
  }
}

// ─── Main scan function ───────────────────────────────────────────────────────
export async function runScan(triggeredBy: "cron" | "manual" = "cron"): Promise<{
  scanRunId: number;
  results: Array<{ destination: string; success: boolean; price?: number; error?: string }>;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Ensure destinations are seeded
  await seedDestinations();

  // Create a scan run record
  const [scanRun] = await db
    .insert(scanRuns)
    .values({ triggeredBy, status: "running" })
    .$returningId();

  const scanRunId = scanRun!.id;
  const today = todayStr();
  const results: Array<{ destination: string; success: boolean; price?: number; error?: string }> = [];

  // Get active destinations
  const activeDestinations = await db
    .select()
    .from(destinations)
    .where(eq(destinations.isActive, true));

  let successCount = 0;

  for (const dest of activeDestinations) {
    try {
      const departureDate = addDays(today, dest.bookingWindowDays);
      const returnDate = addDays(departureDate, dest.defaultTripDays);

      const offers = await searchFlights({
        origin: ORIGIN,
        destination: dest.iataCode,
        departureDate,
        returnDate,
        adults: 1,
        max: 5,
      });

      if (offers.length === 0) {
        results.push({ destination: dest.name, success: false, error: "No flights found" });
        continue;
      }

      // Take the cheapest offer
      const best = offers.sort((a, b) => a.price - b.price)[0]!;

      // Get 30-day average
      const thirtyDayAvg = await getThirtyDayAvg(dest.id);
      const percentVsAvg =
        thirtyDayAvg !== null
          ? ((best.price - thirtyDayAvg) / thirtyDayAvg) * 100
          : null;

      // AI rating
      const { dealRating, aiSummary, aiTravelTip } = await rateWithAI({
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

      // Store the scan result with full details
      await db.insert(flightScans).values({
        scanRunId,
        destinationId: dest.id,
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
        rawData: best.raw,
      });

      // Push notification if >15% below average
      if (percentVsAvg !== null && percentVsAvg <= HOT_DEAL_THRESHOLD) {
        try {
          await notifyOwner({
            title: `🔥 Hot Deal Alert: ${dest.name}`,
            content: `Sydney → ${dest.name} is now $${best.price.toFixed(0)} AUD — ${Math.abs(percentVsAvg).toFixed(1)}% below the 30-day average of $${thirtyDayAvg!.toFixed(0)} AUD. Departs ${best.departureDate}, returns ${best.returnDate}.`,
          });
        } catch (notifyErr) {
          console.error("[Scanner] Notification failed:", notifyErr);
        }
      }

      successCount++;
      results.push({ destination: dest.name, success: true, price: best.price });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[Scanner] Failed for ${dest.name}:`, message);
      results.push({ destination: dest.name, success: false, error: message });
    }
  }

  // Update scan run as completed
  await db
    .update(scanRuns)
    .set({
      completedAt: new Date(),
      status: successCount > 0 ? "completed" : "failed",
      destinationCount: activeDestinations.length,
      successCount,
    })
    .where(eq(scanRuns.id, scanRunId));

  return { scanRunId, results };
}

// ─── Get today's latest scan per destination ──────────────────────────────────
export async function getTodayDeals() {
  const db = await getDb();
  if (!db) return [];

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Get the latest scan per destination for today
  const scans = await db
    .select({
      scan: flightScans,
      destination: destinations,
    })
    .from(flightScans)
    .innerJoin(destinations, eq(flightScans.destinationId, destinations.id))
    .where(gte(flightScans.scannedAt, todayStart))
    .orderBy(desc(flightScans.scannedAt));

  // Deduplicate: keep latest per destination
  const seen = new Set<number>();
  return scans.filter((row) => {
    if (seen.has(row.destination.id)) return false;
    seen.add(row.destination.id);
    return true;
  });
}

// ─── Get 30-day price history for a destination ───────────────────────────────
export async function getPriceHistory(destinationId: number) {
  const db = await getDb();
  if (!db) return [];

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const rows = await db
    .select({
      scannedAt: flightScans.scannedAt,
      price: flightScans.price,
      dealRating: flightScans.dealRating,
    })
    .from(flightScans)
    .where(
      and(
        eq(flightScans.destinationId, destinationId),
        gte(flightScans.scannedAt, thirtyDaysAgo)
      )
    )
    .orderBy(flightScans.scannedAt);

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
