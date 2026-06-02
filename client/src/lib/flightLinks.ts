export function googleFlightsUrl(
  origin: string,
  destination: string,
  departure: string,
  returnDate: string,
): string {
  // Round-trip search URL using Google Flights hash format
  return `https://www.google.com/flights#flt=${origin}.${destination}.${departure}*${destination}.${origin}.${returnDate};c:AUD;e:1;sc:b;sd:1;t:r`;
}
