import { Plane, Clock, ArrowRight, TrendingDown, TrendingUp, Minus, Armchair, ExternalLink, CalendarDays, Sun } from "lucide-react";
import { DealRatingBadge } from "./DealRatingBadge";
import { googleFlightsUrl } from "@/lib/flightLinks";
import { format, parseISO } from "date-fns";

interface DealCardProps {
  destinationId: number;
  destinationName: string;
  iataCode: string;
  region: string;
  country?: string;
  origin?: string;
  price: number;
  currency: string;
  airline: string;
  airlineCode: string;
  stops: number;
  departureDate: string;
  returnDate: string;
  outboundDuration: string;
  returnDuration: string;
  dealRating: "Hot Deal" | "Good Price" | "Standard";
  aiSummary: string | null;
  percentVsAvg: number | null;
  lowestIn7Days?: number | null;
  lowestIn30Days?: number | null;
  lowestIn90Days?: number | null;
  holidayLabel?: string | null;
  inBestSeason?: boolean;
  seatsAvailable: number | null;
  animationDelay?: number;
  onClick?: () => void;
}

const REGION_EMOJI: Record<string, string> = {
  "SE Asia": "🌴", "NE Asia": "⛩️", "Europe": "🏛️",
  "N America": "🗽", "Pacific": "🌊", "Middle East": "🕌",
  "Mexico": "🌮", "South Asia": "🕍", "Africa": "🦁",
};

export function DealCard({
  destinationName, iataCode, region, country, origin = "SYD",
  price, currency, airline, stops,
  departureDate, returnDate, outboundDuration,
  dealRating, aiSummary, percentVsAvg,
  lowestIn7Days, lowestIn30Days, lowestIn90Days,
  holidayLabel, inBestSeason,
  seatsAvailable, animationDelay = 0, onClick,
}: DealCardProps) {
  const emoji = REGION_EMOJI[region] ?? "✈️";
  const tripDays = Math.round(
    (new Date(returnDate).getTime() - new Date(departureDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  const PctIcon =
    percentVsAvg === null ? null :
    percentVsAvg <= -5 ? TrendingDown :
    percentVsAvg >= 5 ? TrendingUp : Minus;

  const pctColor =
    percentVsAvg === null ? "" :
    percentVsAvg <= -10 ? "text-orange-400" :
    percentVsAvg <= -5 ? "text-emerald-400" :
    percentVsAvg >= 5 ? "text-red-400" : "text-muted-foreground";

  const seatsColor =
    seatsAvailable === null ? "" :
    seatsAvailable <= 3 ? "text-red-400" :
    seatsAvailable <= 7 ? "text-orange-400" : "text-emerald-400";

  // Determine best historical-low window this price qualifies for
  const historicalLowLabel =
    lowestIn7Days  != null && price <= lowestIn7Days  ? { label: "7-day low",  style: "bg-orange-500/15 text-orange-400" } :
    lowestIn30Days != null && price <= lowestIn30Days ? { label: "30-day low", style: "bg-amber-500/15 text-amber-400" } :
    lowestIn90Days != null && price <= lowestIn90Days ? { label: "90-day low", style: "bg-secondary text-muted-foreground" } :
    null;

  const flightsUrl = googleFlightsUrl(origin, iataCode, departureDate, returnDate);

  return (
    <div
      className="deal-card bg-card border border-border rounded-xl p-5 cursor-pointer fade-in-up"
      style={{ animationDelay: `${animationDelay}ms` }}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-xl flex-shrink-0">
            {emoji}
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-base leading-tight">{destinationName}</h3>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
              <span>{iataCode} · {country ?? region}</span>
              {origin !== "SYD" && (
                <span className="bg-secondary px-1.5 py-0.5 rounded text-xs font-mono">{origin}</span>
              )}
            </p>
          </div>
        </div>
        <DealRatingBadge rating={dealRating} />
      </div>

      {/* Holiday window + season */}
      {(holidayLabel || inBestSeason) && (
        <div className="flex items-center gap-1.5 flex-wrap mb-3 -mt-1">
          {holidayLabel && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
              <CalendarDays className="w-3 h-3" />
              {holidayLabel}
            </span>
          )}
          {inBestSeason && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium">
              <Sun className="w-3 h-3" />
              Best season
            </span>
          )}
        </div>
      )}

      {/* Price */}
      <div className="mb-4">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold gold-text">
            ${Math.round(price).toLocaleString("en-AU")}
          </span>
          <span className="text-sm text-muted-foreground">{currency}</span>
          {historicalLowLabel && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${historicalLowLabel.style}`}>
              {historicalLowLabel.label}
            </span>
          )}
        </div>
        {percentVsAvg !== null && PctIcon && (
          <div className={`flex items-center gap-1 mt-1 text-xs ${pctColor}`}>
            <PctIcon className="w-3 h-3" />
            <span>{Math.abs(percentVsAvg).toFixed(1)}% {percentVsAvg < 0 ? "below" : "above"} 30-day avg</span>
          </div>
        )}
        {!historicalLowLabel && (lowestIn30Days != null || lowestIn90Days != null) && (
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            {lowestIn30Days != null && (
              <span>30d low: <span className="text-foreground">${Math.round(lowestIn30Days).toLocaleString("en-AU")}</span></span>
            )}
            {lowestIn90Days != null && (
              <span>90d low: <span className="text-foreground">${Math.round(lowestIn90Days).toLocaleString("en-AU")}</span></span>
            )}
          </div>
        )}
      </div>

      {/* Trip details */}
      <div className="space-y-2 mb-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Plane className="w-3 h-3 flex-shrink-0" />
          <span>{format(parseISO(departureDate), "d MMM")} → {format(parseISO(returnDate), "d MMM yyyy")}</span>
          <span className="text-border">·</span>
          <span>{tripDays} nights</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="w-3 h-3 flex-shrink-0" />
          <span>{outboundDuration}</span>
          <span className="text-border">·</span>
          <span>{stops === 0 ? "Direct" : `${stops} stop${stops > 1 ? "s" : ""}`}</span>
          <span className="text-border">·</span>
          <span>{airline}</span>
        </div>
        {seatsAvailable !== null && (
          <div className={`flex items-center gap-1.5 text-xs ${seatsColor}`}>
            <Armchair className="w-3 h-3 flex-shrink-0" />
            <span>{seatsAvailable} seat{seatsAvailable !== 1 ? "s" : ""} left</span>
          </div>
        )}
      </div>

      {/* AI Summary */}
      {aiSummary && (
        <p className="text-xs text-muted-foreground border-t border-border pt-3 leading-relaxed line-clamp-2">
          {aiSummary}
        </p>
      )}

      {/* Footer CTAs */}
      <div className="flex items-center justify-between mt-3">
        <a
          href={flightsUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          Google Flights
        </a>
        <span className="text-xs text-primary flex items-center gap-1 font-medium">
          View details <ArrowRight className="w-3 h-3" />
        </span>
      </div>
    </div>
  );
}
