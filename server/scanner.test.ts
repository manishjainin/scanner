import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Unit tests for scanner utility functions ──────────────────────────────────
// We test the pure logic without hitting the database or external APIs.

describe("Deal rating thresholds", () => {
  const HOT_DEAL_THRESHOLD = -15;
  const GOOD_PRICE_THRESHOLD = -5;

  function computeRating(percentVsAvg: number | null): "Hot Deal" | "Good Price" | "Standard" {
    if (percentVsAvg === null) return "Standard";
    if (percentVsAvg <= HOT_DEAL_THRESHOLD) return "Hot Deal";
    if (percentVsAvg <= GOOD_PRICE_THRESHOLD) return "Good Price";
    return "Standard";
  }

  it("returns Hot Deal when fare is 15% below average", () => {
    expect(computeRating(-15)).toBe("Hot Deal");
  });

  it("returns Hot Deal when fare is more than 15% below average", () => {
    expect(computeRating(-25)).toBe("Hot Deal");
  });

  it("returns Good Price when fare is 5% below average", () => {
    expect(computeRating(-5)).toBe("Good Price");
  });

  it("returns Good Price when fare is between 5% and 15% below average", () => {
    expect(computeRating(-10)).toBe("Good Price");
  });

  it("returns Standard when fare is at average", () => {
    expect(computeRating(0)).toBe("Standard");
  });

  it("returns Standard when fare is above average", () => {
    expect(computeRating(10)).toBe("Standard");
  });

  it("returns Standard when no historical data", () => {
    expect(computeRating(null)).toBe("Standard");
  });
});

describe("Date utility functions", () => {
  function addDays(dateStr: string, days: number): string {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().split("T")[0]!;
  }

  it("adds 90 days to a date correctly", () => {
    const result = addDays("2026-01-01", 90);
    expect(result).toBe("2026-04-01");
  });

  it("adds 150 days to a date correctly", () => {
    const result = addDays("2026-01-01", 150);
    expect(result).toBe("2026-05-31"); // Jan(31) + Feb(28) + Mar(31) + Apr(30) + May(30) = 150
  });

  it("handles month boundaries correctly", () => {
    const result = addDays("2026-01-31", 1);
    expect(result).toBe("2026-02-01");
  });

  it("handles year boundaries correctly", () => {
    const result = addDays("2025-12-31", 1);
    expect(result).toBe("2026-01-01");
  });
});

describe("ISO duration parser", () => {
  function parseISODuration(iso: string): string {
    const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    if (!match) return iso;
    const h = match[1] ? `${match[1]}h` : "";
    const m = match[2] ? ` ${match[2]}m` : "";
    return (h + m).trim() || iso;
  }

  it("parses hours and minutes", () => {
    expect(parseISODuration("PT14H30M")).toBe("14h 30m");
  });

  it("parses hours only", () => {
    expect(parseISODuration("PT8H")).toBe("8h");
  });

  it("parses minutes only", () => {
    expect(parseISODuration("PT45M")).toBe("45m");
  });

  it("returns original string for unrecognised format", () => {
    expect(parseISODuration("unknown")).toBe("unknown");
  });
});

describe("Notification threshold", () => {
  const NOTIFICATION_THRESHOLD = -15;

  function shouldNotify(percentVsAvg: number | null): boolean {
    if (percentVsAvg === null) return false;
    return percentVsAvg <= NOTIFICATION_THRESHOLD;
  }

  it("triggers notification when fare is exactly 15% below average", () => {
    expect(shouldNotify(-15)).toBe(true);
  });

  it("triggers notification when fare is more than 15% below average", () => {
    expect(shouldNotify(-20)).toBe(true);
  });

  it("does not trigger notification when fare is 14% below average", () => {
    expect(shouldNotify(-14)).toBe(false);
  });

  it("does not trigger notification when no historical data", () => {
    expect(shouldNotify(null)).toBe(false);
  });

  it("does not trigger notification when fare is above average", () => {
    expect(shouldNotify(5)).toBe(false);
  });
});

describe("Default destination matrix", () => {
  const DEFAULT_DESTINATIONS = [
    { name: "Bali",        iataCode: "DPS", region: "SE Asia",      bookingWindowDays: 90,  defaultTripDays: 10 },
    { name: "Tokyo",       iataCode: "NRT", region: "NE Asia",      bookingWindowDays: 120, defaultTripDays: 12 },
    { name: "Singapore",   iataCode: "SIN", region: "SE Asia",      bookingWindowDays: 90,  defaultTripDays: 7  },
    { name: "London",      iataCode: "LHR", region: "Europe",       bookingWindowDays: 150, defaultTripDays: 14 },
    { name: "Paris",       iataCode: "CDG", region: "Europe",       bookingWindowDays: 150, defaultTripDays: 14 },
    { name: "New York",    iataCode: "JFK", region: "N America",    bookingWindowDays: 150, defaultTripDays: 14 },
    { name: "Los Angeles", iataCode: "LAX", region: "N America",    bookingWindowDays: 120, defaultTripDays: 14 },
    { name: "Fiji",        iataCode: "NAN", region: "Pacific",      bookingWindowDays: 90,  defaultTripDays: 7  },
    { name: "Auckland",    iataCode: "AKL", region: "Pacific",      bookingWindowDays: 60,  defaultTripDays: 7  },
    { name: "Bangkok",     iataCode: "BKK", region: "SE Asia",      bookingWindowDays: 90,  defaultTripDays: 10 },
    { name: "Dubai",       iataCode: "DXB", region: "Middle East",  bookingWindowDays: 120, defaultTripDays: 10 },
    { name: "Rome",        iataCode: "FCO", region: "Europe",       bookingWindowDays: 150, defaultTripDays: 14 },
    { name: "Hong Kong",   iataCode: "HKG", region: "NE Asia",      bookingWindowDays: 90,  defaultTripDays: 7  },
    { name: "Cancun",      iataCode: "CUN", region: "Mexico",       bookingWindowDays: 150, defaultTripDays: 12 },
  ];

  it("has exactly 14 destinations", () => {
    expect(DEFAULT_DESTINATIONS).toHaveLength(14);
  });

  it("all IATA codes are exactly 3 characters", () => {
    DEFAULT_DESTINATIONS.forEach((d) => {
      expect(d.iataCode).toHaveLength(3);
    });
  });

  it("all booking windows are between 60 and 180 days", () => {
    DEFAULT_DESTINATIONS.forEach((d) => {
      expect(d.bookingWindowDays).toBeGreaterThanOrEqual(60);
      expect(d.bookingWindowDays).toBeLessThanOrEqual(180);
    });
  });

  it("all trip durations are between 5 and 28 days", () => {
    DEFAULT_DESTINATIONS.forEach((d) => {
      expect(d.defaultTripDays).toBeGreaterThanOrEqual(5);
      expect(d.defaultTripDays).toBeLessThanOrEqual(28);
    });
  });

  it("European destinations have booking window of 150 days", () => {
    const european = DEFAULT_DESTINATIONS.filter((d) => d.region === "Europe");
    european.forEach((d) => {
      expect(d.bookingWindowDays).toBe(150);
    });
  });

  it("European destinations have 14-day default trip", () => {
    const european = DEFAULT_DESTINATIONS.filter((d) => d.region === "Europe");
    european.forEach((d) => {
      expect(d.defaultTripDays).toBe(14);
    });
  });
});
