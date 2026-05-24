import { Plane, Clock, ArrowRight, TrendingDown, TrendingUp, Minus, Armchair } from "lucide-react";
import { DealRatingBadge } from "./DealRatingBadge";
import { format, parseISO } from "date-fns";

interface DealCardProps {
  destinationId: number;
  destinationName: string;
  iataCode: string;
  region: string;
  country?: string;
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
  destinationName, iataCode, region, country,
  price, currency, airline, stops,
  departureDate, returnDate, outboundDuration,
  dealRating, aiSummary, percentVsAvg,
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
            <p className="text-xs text-muted-foreground mt-0.5">{iataCode} · {country ?? region}</p>
          </div>
        </div>
        <DealRatingBadge rating={dealRating} />
      </div>

      {/* Price */}
      <div className="mb-4">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold gold-text">
            ${Math.round(price).toLocaleString("en-AU")}
          </span>
          <span className="text-sm text-muted-foreground">{currency}</span>
        </div>
        {percentVsAvg !== null && PctIcon && (
          <div className={`flex items-center gap-1 mt-1 text-xs ${pctColor}`}>
            <PctIcon className="w-3 h-3" />
            <span>{Math.abs(percentVsAvg).toFixed(1)}% {percentVsAvg < 0 ? "below" : "above"} 30-day avg</span>
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
            <span>{seatsAvailable} seat{seatsAvailable !== 1 ? "s" : ""} available</span>
          </div>
        )}
      </div>

      {/* AI Summary */}
      {aiSummary && (
        <p className="text-xs text-muted-foreground border-t border-border pt-3 leading-relaxed line-clamp-2">
          {aiSummary}
        </p>
      )}

      {/* CTA */}
      <div className="flex items-center justify-end mt-3">
        <span className="text-xs text-primary flex items-center gap-1 font-medium">
          View details <ArrowRight className="w-3 h-3" />
        </span>
      </div>
    </div>
  );
}
