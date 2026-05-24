/**
 * Amadeus API client
 * Handles OAuth token acquisition and flight offer searches.
 * Extracts: price, seats available, full segment details, cabin class.
 */

// Use test endpoint by default; set AMADEUS_ENV=production to switch to live fares
const AMADEUS_BASE =
  process.env.AMADEUS_ENV === "production"
    ? "https://api.amadeus.com"
    : "https://test.api.amadeus.com";

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getAmadeusToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token;
  }

  const clientId = process.env.AMADEUS_CLIENT_ID;
  const clientSecret = process.env.AMADEUS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("AMADEUS_CLIENT_ID or AMADEUS_CLIENT_SECRET is not configured");
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(`${AMADEUS_BASE}/v1/security/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Amadeus token error ${res.status}: ${text}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };
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
  const token = await getAmadeusToken();

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
    `${AMADEUS_BASE}/v2/shopping/flight-offers?${query.toString()}`,
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
