/**
 * Amadeus API client
 * Handles OAuth token acquisition and flight offer searches.
 * Credentials are read from appSettings (DB) first, falling back to env vars.
 * Both test and production credential sets are supported.
 */

import { getSetting } from "./db";

// ─── Active config resolution ─────────────────────────────────────────────────

export async function getAmadeusActiveEnv(): Promise<"test" | "production"> {
  const dbEnv = await getSetting("amadeus.activeEnv");
  if (dbEnv === "test" || dbEnv === "production") return dbEnv;
  return process.env.AMADEUS_ENV === "production" ? "production" : "test";
}

async function resolveCredentials(): Promise<{ baseUrl: string; clientId: string; clientSecret: string; env: string }> {
  const env = await getAmadeusActiveEnv();
  const isProd = env === "production";

  const [dbId, dbSecret] = await Promise.all([
    getSetting(isProd ? "amadeus.prod.clientId" : "amadeus.test.clientId"),
    getSetting(isProd ? "amadeus.prod.clientSecret" : "amadeus.test.clientSecret"),
  ]);

  const clientId     = dbId     || process.env.AMADEUS_CLIENT_ID     || "";
  const clientSecret = dbSecret || process.env.AMADEUS_CLIENT_SECRET || "";

  const baseUrl = isProd
    ? "https://api.amadeus.com"
    : "https://test.api.amadeus.com";

  return { baseUrl, clientId, clientSecret, env };
}

// ─── Token cache ──────────────────────────────────────────────────────────────

let cachedToken: { token: string; expiresAt: number; configKey: string } | null = null;

export function invalidateAmadeusToken(): void {
  cachedToken = null;
}

export async function getAmadeusToken(): Promise<string> {
  const { baseUrl, clientId, clientSecret, env } = await resolveCredentials();
  const configKey = `${env}:${clientId}`;
  const now = Date.now();

  if (cachedToken && cachedToken.expiresAt > now + 60_000 && cachedToken.configKey === configKey) {
    return cachedToken.token;
  }

  if (!clientId || !clientSecret) {
    throw new Error(`Amadeus ${env} credentials are not configured`);
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(`${baseUrl}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Amadeus token error ${res.status}: ${text}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, expiresAt: now + data.expires_in * 1000, configKey };
  return cachedToken.token;
}

// ─── Segment detail (stored in DB) ───────────────────────────────────────────
export interface SegmentDetail {
  flightNumber: string;      // e.g. "QF 001"
  carrierCode: string;       // e.g. "QF"
  aircraft: string;          // e.g. "789"
  departureAirport: string;  // IATA
  departureTime: string;     // ISO datetime
  arrivalAirport: string;    // IATA
  arrivalTime: string;       // ISO datetime
  duration: string;          // e.g. "9h 30m"
  cabinClass: string;        // ECONOMY / BUSINESS / FIRST
  numberOfStops: number;
}

export interface FlightOffer {
  price: number;
  currency: string;
  airline: string;           // carrier name or code
  airlineCode: string;
  stops: number;
  outboundDuration: string;
  returnDuration: string;
  departureDate: string;
  returnDate: string;
  seatsAvailable: number | null;
  cabinClass: string;
  outboundSegments: SegmentDetail[];
  returnSegments: SegmentDetail[];
  raw: unknown;
}

function parseISODuration(iso: string): string {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return iso;
  const h = match[1] ? `${match[1]}h` : "";
  const m = match[2] ? ` ${match[2]}m` : "";
  return (h + m).trim() || iso;
}

function extractSegments(
  itinerary: AmadeusItinerary,
  travelerPricings: AmadeusTravelerPricing[]
): SegmentDetail[] {
  return itinerary.segments.map((seg) => {
    // Find cabin class from travelerPricings
    let cabinClass = "ECONOMY";
    for (const tp of travelerPricings) {
      for (const fd of tp.fareDetailsBySegment ?? []) {
        if (fd.segmentId === seg.id) {
          cabinClass = fd.cabin ?? "ECONOMY";
          break;
        }
      }
    }

    return {
      flightNumber: `${seg.carrierCode} ${seg.number}`,
      carrierCode: seg.carrierCode,
      aircraft: seg.aircraft?.code ?? "",
      departureAirport: seg.departure.iataCode,
      departureTime: seg.departure.at,
      arrivalAirport: seg.arrival.iataCode,
      arrivalTime: seg.arrival.at,
      duration: parseISODuration(seg.duration ?? ""),
      cabinClass,
      numberOfStops: seg.numberOfStops ?? 0,
    };
  });
}

export async function searchFlights(params: {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  adults?: number;
  max?: number;
}): Promise<FlightOffer[]> {
  const [token, { baseUrl }] = await Promise.all([getAmadeusToken(), resolveCredentials()]);

  const query = new URLSearchParams({
    originLocationCode: params.origin,
    destinationLocationCode: params.destination,
    departureDate: params.departureDate,
    returnDate: params.returnDate,
    adults: String(params.adults ?? 1),
    max: String(params.max ?? 5),
    currencyCode: "AUD",
  });

  const res = await fetch(
    `${baseUrl}/v2/shopping/flight-offers?${query.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Amadeus flight search error ${res.status}: ${text}`);
  }

  const data = await res.json() as { data: AmadeusFlightOffer[] };
  if (!data.data || data.data.length === 0) return [];

  return data.data.map((offer) => {
    const price = parseFloat(offer.price.grandTotal);
    const currency = offer.price.currency;

    const outbound = offer.itineraries[0];
    const ret = offer.itineraries[1];

    const outboundSegments = outbound ? extractSegments(outbound, offer.travelerPricings ?? []) : [];
    const returnSegments = ret ? extractSegments(ret, offer.travelerPricings ?? []) : [];

    const stops = Math.max(
      (outbound?.segments?.length ?? 1) - 1,
      (ret?.segments?.length ?? 1) - 1
    );

    const airlineCode =
      outbound?.segments?.[0]?.carrierCode ??
      offer.validatingAirlineCodes?.[0] ??
      "";

    // Determine primary cabin class from first outbound segment
    const cabinClass = outboundSegments[0]?.cabinClass ?? "ECONOMY";

    // numberOfBookableSeats is at the offer level
    const seatsAvailable = offer.numberOfBookableSeats ?? null;

    return {
      price,
      currency,
      airline: airlineCode,
      airlineCode,
      stops,
      outboundDuration: parseISODuration(outbound?.duration ?? ""),
      returnDuration: parseISODuration(ret?.duration ?? ""),
      departureDate: params.departureDate,
      returnDate: params.returnDate,
      seatsAvailable,
      cabinClass,
      outboundSegments,
      returnSegments,
      raw: offer,
    };
  });
}

export async function checkAmadeusConnection(): Promise<boolean> {
  try {
    await getAmadeusToken();
    return true;
  } catch {
    return false;
  }
}

// ─── Config summary (for Settings UI) ────────────────────────────────────────

function maskSecret(s: string | null): string | null {
  if (!s) return null;
  if (s.length <= 8) return "••••••••";
  return s.slice(0, 4) + "••••••••" + s.slice(-4);
}

export async function getAmadeusConfigSummary() {
  const [activeEnv, testId, testSecret, prodId, prodSecret, challenge] = await Promise.all([
    getSetting("amadeus.activeEnv"),
    getSetting("amadeus.test.clientId"),
    getSetting("amadeus.test.clientSecret"),
    getSetting("amadeus.prod.clientId"),
    getSetting("amadeus.prod.clientSecret"),
    getSetting("amadeus.challenge"),
  ]);

  const resolvedEnv = activeEnv === "production" ? "production" : "test";

  return {
    activeEnv: resolvedEnv as "test" | "production",
    challengeSet: !!challenge,
    test: {
      clientId: testId ?? process.env.AMADEUS_CLIENT_ID ?? null,
      clientSecretMasked: maskSecret(testSecret) ?? (process.env.AMADEUS_CLIENT_SECRET ? "from env ••••••••" : null),
      configured: !!(testId || process.env.AMADEUS_CLIENT_ID),
      fromEnv: !testId && !!process.env.AMADEUS_CLIENT_ID,
    },
    production: {
      clientId: prodId ?? null,
      clientSecretMasked: maskSecret(prodSecret),
      configured: !!prodId,
      fromEnv: false,
    },
  };
}

// ─── Amadeus response types ───────────────────────────────────────────────────
interface AmadeusSegment {
  id?: string;
  carrierCode: string;
  number: string;
  aircraft?: { code: string };
  departure: { iataCode: string; at: string };
  arrival: { iataCode: string; at: string };
  duration?: string;
  numberOfStops?: number;
}

interface AmadeusItinerary {
  duration: string;
  segments: AmadeusSegment[];
}

interface AmadeusFareDetail {
  segmentId?: string;
  cabin?: string;
}

interface AmadeusTravelerPricing {
  fareDetailsBySegment?: AmadeusFareDetail[];
}

interface AmadeusFlightOffer {
  numberOfBookableSeats?: number;
  price: { grandTotal: string; currency: string };
  itineraries: AmadeusItinerary[];
  travelerPricings?: AmadeusTravelerPricing[];
  validatingAirlineCodes?: string[];
}
