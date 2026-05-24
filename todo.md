# Sydney Flight Deals Scanner — TODO

## Phase 2: Database Schema & Secrets
- [x] Define destinations table (id, name, iataCode, region, bookingWindowDays, defaultTripDays, isActive)
- [x] Define flightScans table (id, destinationId, scannedAt, departureDate, returnDate, price, currency, airline, stops, outboundDuration, returnDuration, dealRating, aiSummary, rawData)
- [x] Define scanRuns table (id, startedAt, completedAt, status, destinationCount, errorMessage, triggeredBy)
- [x] Define appSettings table (id, key, value) for storing cron task uid and other config
- [x] Generate and apply migration SQL
- [x] Request AMADEUS_CLIENT_ID, AMADEUS_CLIENT_SECRET, OPENAI_API_KEY secrets

## Phase 3: Backend
- [x] Create server/amadeus.ts — Amadeus API client (token auth + flight search)
- [x] Create server/scanner.ts — core scan logic: per-destination search, AI rating, deal detection
- [x] Create server/routers/destinations.ts (merged into routers.ts) — CRUD for destinations (admin only)
- [x] Create server/routers/scans.ts (merged into routers.ts) — scan results, price history, trigger scan
- [x] Create server/routers/settings.ts (merged into routers.ts) — app settings read/write
- [x] Register /api/scheduled/daily-scan heartbeat handler in server/_core/index.ts
- [x] Create heartbeat cron job (daily 9am UTC = 7pm AEST) — created after deploy
- [x] Seed default 14 destinations on first run

## Phase 4: Frontend — Dashboard & Detail
- [x] Design system: dark premium theme, gold/amber accents, clean typography
- [x] Update index.css with premium dark theme tokens
- [x] Build AppLayout with sidebar nav (Dashboard, Settings) (Dashboard, Destinations, Settings)
- [x] Build Home.tsx — deal cards grid with today's scans, deal rating badges, price
- [x] Build DestinationDetail.tsx — 30-day price trend chart, fare breakdown, AI tip
- [x] Build PriceTrendChart component using recharts
- [x] Build DealCard component with Hot Deal / Good Price / Standard badge

## Phase 5: Admin & Notifications
- [x] Build Settings.tsx — admin-only page: destination management, API status indicators
- [x] Build DestinationManager component (inline in Settings.tsx) — add/edit/remove destinations
- [x] Add "Scan Now" button on dashboard (admin only)
- [x] Implement push notification when fare is >15% below 30-day average
- [x] API connection status indicators (Amadeus + OpenAI) on settings page

## Phase 6: Polish & Tests
- [x] Write vitest tests for scanner logic and deal rating (27 tests passing)
- [x] Write vitest tests for tRPC procedures (auth.logout test)
- [x] Responsive design review
- [x] Save checkpoint and deliver

## Destination Expansion & Filter UI
- [ ] Expand seed list to ~30 destinations covering all major regions (add India, SE Asia, Europe, Americas, Middle East, Pacific)
- [ ] Add `continent` column to destinations table and schema
- [ ] Add continent/country filter bar to dashboard (All, Asia, Europe, Americas, Middle East, Pacific)
- [ ] Filter deal cards by selected continent/country without re-scanning
- [ ] Update Settings destinations table to show continent column
- [ ] Re-seed destinations with new expanded list (clear old seed, insert new)

## Seats, Full Offer Details & Expanded Destinations
- [x] Add seatsAvailable, numberOfBookableSeats, outboundSegments (JSON), returnSegments (JSON) columns to flightScans
- [x] Update Amadeus client to extract numberOfBookableSeats per offer
- [x] Update scanner to store full segment details (flight numbers, departure/arrival times, aircraft, cabin class)
- [x] Expand seed list to 30 destinations with country and continent fields
- [ ] Add continent/country filter bar to dashboard
- [x] Build DealDetailDrawer component showing full itinerary, airline, dates, seats, cabin class
- [x] Update DealCard to show seats available badge
