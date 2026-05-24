import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { PriceTrendChart } from "@/components/PriceTrendChart";
import { DealRatingBadge } from "@/components/DealRatingBadge";
import {
  ArrowLeft,
  Plane,
  Clock,
  Calendar,
  TrendingDown,
  TrendingUp,
  Minus,
  MapPin,
  Sparkles,
} from "lucide-react";
import { format, parseISO } from "date-fns";

const REGION_EMOJI: Record<string, string> = {
  "SE Asia": "🌴",
  "NE Asia": "⛩️",
  "Europe": "🏛️",
  "N America": "🗽",
  "Pacific": "🌊",
  "Middle East": "🕌",
  "Mexico": "🌮",
};

export default function DestinationDetail() {
  const params = useParams<{ id: string }>();
  const destinationId = parseInt(params.id ?? "0", 10);

  const { data: destination, isLoading: destLoading } = trpc.destinations.getById.useQuery(
    { id: destinationId },
    { enabled: !!destinationId }
  );

  const { data: priceHistory, isLoading: historyLoading } = trpc.scans.priceHistory.useQuery(
    { destinationId },
    { enabled: !!destinationId }
  );

  const { data: latestScan, isLoading: scanLoading } = trpc.scans.latestForDestination.useQuery(
    { destinationId },
    { enabled: !!destinationId }
  );

  const isLoading = destLoading || historyLoading || scanLoading;

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="h-8 w-48 skeleton-shimmer rounded mb-8" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-80 skeleton-shimmer rounded-xl" />
          <div className="h-80 skeleton-shimmer rounded-xl" />
        </div>
      </div>
    );
  }

  if (!destination) {
    return (
      <div className="p-6 lg:p-8 text-center py-24">
        <p className="text-muted-foreground">Destination not found.</p>
        <Link href="/">
          <span className="text-primary text-sm mt-2 inline-block cursor-pointer">← Back to dashboard</span>
        </Link>
      </div>
    );
  }

  const emoji = REGION_EMOJI[destination.region] ?? "✈️";
  const price = latestScan ? parseFloat(String(latestScan.price)) : null;
  const thirtyDayAvg = latestScan?.thirtyDayAvg ? parseFloat(String(latestScan.thirtyDayAvg)) : null;
  const percentVsAvg = latestScan?.percentVsAvg ? parseFloat(String(latestScan.percentVsAvg)) : null;
  const tripDays = latestScan
    ? Math.round(
        (new Date(latestScan.returnDate).getTime() - new Date(latestScan.departureDate).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : destination.defaultTripDays;

  const PctIcon =
    percentVsAvg === null ? null :
    percentVsAvg <= -5 ? TrendingDown :
    percentVsAvg >= 5 ? TrendingUp : Minus;

  const pctColor =
    percentVsAvg === null ? "" :
    percentVsAvg <= -10 ? "text-orange-400" :
    percentVsAvg <= -5 ? "text-emerald-400" :
    percentVsAvg >= 5 ? "text-red-400" : "text-muted-foreground";

  return (
    <div className="p-6 lg:p-8">
      {/* Back nav */}
      <Link href="/">
        <div className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to dashboard
        </div>
      </Link>

      {/* Destination header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center text-3xl flex-shrink-0">
          {emoji}
        </div>
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold text-foreground">{destination.name}</h1>
            {latestScan && <DealRatingBadge rating={latestScan.dealRating} size="md" />}
          </div>
          <p className="text-muted-foreground text-sm mt-0.5 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            {destination.iataCode} · {destination.region} · {destination.defaultTripDays}-day leisure trip
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Price trend + AI tip */}
        <div className="lg:col-span-2 space-y-6">
          {/* Price trend chart */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-foreground">30-Day Price Trend</h2>
              {thirtyDayAvg && (
                <span className="text-xs text-muted-foreground">
                  Avg: <span className="text-foreground font-medium">${Math.round(thirtyDayAvg).toLocaleString("en-AU")} AUD</span>
                </span>
              )}
            </div>
            <PriceTrendChart data={priceHistory ?? []} height={240} />
          </div>

          {/* AI Travel Tip */}
          {latestScan?.aiTravelTip && (
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4" style={{ color: "oklch(0.78 0.15 75)" }} />
                <h2 className="text-base font-semibold text-foreground">AI Travel Tip</h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{latestScan.aiTravelTip}</p>
            </div>
          )}
        </div>

        {/* Right: Current fare breakdown */}
        <div className="space-y-4">
          {latestScan && price ? (
            <>
              {/* Price card */}
              <div className="bg-card border border-border rounded-xl p-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Current Best Fare</p>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-4xl font-bold gold-text">
                    ${Math.round(price).toLocaleString("en-AU")}
                  </span>
                  <span className="text-sm text-muted-foreground">{latestScan.currency} return</span>
                </div>
                {percentVsAvg !== null && PctIcon && (
                  <div className={`flex items-center gap-1.5 text-xs ${pctColor}`}>
                    <PctIcon className="w-3.5 h-3.5" />
                    {Math.abs(percentVsAvg).toFixed(1)}% {percentVsAvg < 0 ? "below" : "above"} 30-day average
                  </div>
                )}
              </div>

              {/* Flight details */}
              <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Flight Details</p>

                <div className="space-y-3">
                  <DetailRow
                    icon={<Calendar className="w-3.5 h-3.5" />}
                    label="Departure"
                    value={format(parseISO(latestScan.departureDate), "EEEE, d MMMM yyyy")}
                  />
                  <DetailRow
                    icon={<Calendar className="w-3.5 h-3.5" />}
                    label="Return"
                    value={format(parseISO(latestScan.returnDate), "EEEE, d MMMM yyyy")}
                  />
                  <DetailRow
                    icon={<Clock className="w-3.5 h-3.5" />}
                    label="Trip duration"
                    value={`${tripDays} nights`}
                  />
                  <DetailRow
                    icon={<Plane className="w-3.5 h-3.5" />}
                    label="Airline"
                    value={latestScan.airline ?? latestScan.airlineCode ?? "Unknown"}
                  />
                  <DetailRow
                    icon={<Clock className="w-3.5 h-3.5" />}
                    label="Outbound"
                    value={`${latestScan.outboundDuration ?? "—"} · ${latestScan.stops === 0 ? "Direct" : `${latestScan.stops} stop${latestScan.stops > 1 ? "s" : ""}`}`}
                  />
                  <DetailRow
                    icon={<Clock className="w-3.5 h-3.5" />}
                    label="Return leg"
                    value={latestScan.returnDuration ?? "—"}
                  />
                </div>
              </div>

              {/* Booking window info */}
              <div className="bg-card border border-border rounded-xl p-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Scan Configuration</p>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Booking window</span>
                    <span className="text-foreground font-medium">{destination.bookingWindowDays} days ahead</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Default trip</span>
                    <span className="text-foreground font-medium">{destination.defaultTripDays} days</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Last scanned</span>
                    <span className="text-foreground font-medium">
                      {format(new Date(latestScan.scannedAt), "d MMM, h:mm a")}
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-card border border-border rounded-xl p-5 text-center py-12">
              <p className="text-muted-foreground text-sm">No scan data available yet for this destination.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="text-muted-foreground mt-0.5 flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground font-medium">{value}</p>
      </div>
    </div>
  );
}
