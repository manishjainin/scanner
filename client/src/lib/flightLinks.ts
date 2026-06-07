/**
 * Build a Google Flights deep link that prefills origin, destination and dates.
 *
 * The legacy `#flt=` hash format was deprecated by Google and no longer parses
 * (opens a blank search). The current reliable approach is the natural-language
 * query against /travel/flights, which Google parses into a populated round-trip
 * search (resolves IATA codes and ISO dates).
 *
 * @param origin       Origin IATA code, e.g. "SYD"
 * @param destination  Destination IATA code, e.g. "DPS"
 * @param departure    Departure date, YYYY-MM-DD
 * @param returnDate   Return date, YYYY-MM-DD
 */
export function googleFlightsUrl(
  origin: string,
  destination: string,
  departure: string,
  returnDate: string,
): string {
  const query = `Flights from ${origin} to ${destination} on ${departure} through ${returnDate}`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(query)}`;
}
