import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DealRatingBadge } from "./DealRatingBadge";
import {
  Plane, Calendar, Clock, Users, ArrowRight,
  ChevronRight, MapPin, Armchair,
} from "lucide-react";
import { format, parseISO } from "date-fns";

interface SegmentDetail {
  flightNumber: string;
  carrierCode: string;
  aircraft: string;
  departureAirport: string;
  departureTime: string;
  arrivalAirport: string;
  arrivalTime: string;
  duration: string;
  cabinClass: string;
  numberOfStops: number;
}

interface DealDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  destination: {
    name: string;
    iataCode: string;
    region: string;
    country: string;
  };
  scan: {
    price: number;
    currency: string;
    airline: string;
    airlineCode: string;
    stops: number;
    outboundDuration: string;
    returnDuration: string;
    departureDate: string;
    returnDate: string;
    seatsAvailable: number | null;
    cabinClass: string | null;
    outboundSegments: SegmentDetail[] | null;
    returnSegments: SegmentDetail[] | null;
    dealRating: "Hot Deal" | "Good Price" | "Standard";
    aiSummary: string | null;
    aiTravelTip: string | null;
    percentVsAvg: number | null;
    thirtyDayAvg: number | null;
    scannedAt: Date;
  };
}

const CABIN_LABEL: Record<string, string> = {
  ECONOMY: "Economy",
  PREMIUM_ECONOMY: "Premium Economy",
  BUSINESS: "Business",
  FIRST: "First Class",
};

const REGION_EMOJI: Record<string, string> = {
  "SE Asia": "🌴", "NE Asia": "⛩️", "Europe": "🏛️",
  "N America": "🗽", "Pacific": "🌊", "Middle East": "🕌",
  "Mexico": "🌮", "South Asia": "🕍", "Africa": "🦁",
};

function formatDateTime(iso: string) {
  try {
    const d = parseISO(iso);
    return {
      date: format(d, "EEE d MMM"),
      time: format(d, "HH:mm"),
    };
  } catch {
    return { date: iso, time: "" };
  }
}

function SegmentRow({ seg, index, total }: { seg: SegmentDetail; index: number; total: number }) {
  const dep = formatDateTime(seg.departureTime);
  const arr = formatDateTime(seg.arrivalTime);

  return (
    <div className="relative">
      {/* Connector line */}
      {index < total - 1 && (
        <div className="absolute left-[19px] top-full w-0.5 h-4 bg-border" />
      )}
      <div className="flex items-start gap-3 py-3">
        {/* Timeline dot */}
        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 text-xs font-bold text-muted-foreground">
          {seg.carrierCode}
        </div>
        <div className="flex-1 min-w-0">
          {/* Flight number + cabin */}
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-sm font-semibold text-foreground">{seg.flightNumber}</span>
            <div className="flex items-center gap-1.5">
              {seg.aircraft && (
                <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                  {seg.aircraft}
                </span>
              )}
              <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                {CABIN_LABEL[seg.cabinClass] ?? seg.cabinClass}
              </span>
            </div>
          </div>
          {/* Route */}
          <div className="flex items-center gap-2 text-sm">
            <div className="text-center">
              <p className="font-bold text-foreground text-base leading-tight">{dep.time}</p>
              <p className="text-xs text-muted-foreground">{seg.departureAirport}</p>
              <p className="text-xs text-muted-foreground">{dep.date}</p>
            </div>
            <div className="flex-1 flex flex-col items-center gap-0.5 px-2">
              <p className="text-xs text-muted-foreground">{seg.duration}</p>
              <div className="w-full flex items-center gap-1">
                <div className="flex-1 h-px bg-border" />
                <Plane className="w-3 h-3 text-muted-foreground" />
                <div className="flex-1 h-px bg-border" />
              </div>
              {seg.numberOfStops > 0 && (
                <p className="text-xs text-orange-400">{seg.numberOfStops} stop</p>
              )}
            </div>
            <div className="text-center">
              <p className="font-bold text-foreground text-base leading-tight">{arr.time}</p>
              <p className="text-xs text-muted-foreground">{seg.arrivalAirport}</p>
              <p className="text-xs text-muted-foreground">{arr.date}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ItinerarySection({ title, segments, duration }: {
  title: string;
  segments: SegmentDetail[];
  duration: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Plane className="w-3.5 h-3.5 text-primary" />
          {title}
        </h4>
        <span className="text-xs text-muted-foreground">{duration} total</span>
      </div>
      <div>
        {segments.map((seg, i) => (
          <SegmentRow key={`${seg.flightNumber}-${i}`} seg={seg} index={i} total={segments.length} />
        ))}
      </div>
    </div>
  );
}

export function DealDetailDrawer({ open, onClose, destination, scan }: DealDetailDrawerProps) {
  const emoji = REGION_EMOJI[destination.region] ?? "✈️";
  const tripDays = Math.round(
    (new Date(scan.returnDate).getTime() - new Date(scan.departureDate).getTime()) /
      (1000 * 60 * 60 * 24)
  );

  const outboundSegs: SegmentDetail[] = Array.isArray(scan.outboundSegments)
    ? (scan.outboundSegments as SegmentDetail[])
    : [];
  const returnSegs: SegmentDetail[] = Array.isArray(scan.returnSegments)
    ? (scan.returnSegments as SegmentDetail[])
    : [];

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg overflow-y-auto"
        style={{ background: "oklch(0.12 0.01 260)", borderLeft: "1px solid oklch(0.22 0.01 260)" }}
      >
        <SheetHeader className="pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center text-2xl flex-shrink-0">
              {emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <SheetTitle className="text-xl font-bold text-foreground">
                  {destination.name}
                </SheetTitle>
                <DealRatingBadge rating={scan.dealRating} size="md" />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {destination.iataCode} · {destination.country} · {destination.region}
              </p>
            </div>
          </div>
        </SheetHeader>

        <div className="py-5 space-y-4">
          {/* Price hero */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Return fare per person</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold gold-text">
                    ${Math.round(scan.price).toLocaleString("en-AU")}
                  </span>
                  <span className="text-sm text-muted-foreground">{scan.currency}</span>
                </div>
                {scan.percentVsAvg !== null && (
                  <p className={`text-xs mt-1 ${scan.percentVsAvg <= -10 ? "text-orange-400" : scan.percentVsAvg <= -5 ? "text-emerald-400" : "text-muted-foreground"}`}>
                    {Math.abs(scan.percentVsAvg).toFixed(1)}% {scan.percentVsAvg < 0 ? "below" : "above"} 30-day avg
                    {scan.thirtyDayAvg ? ` ($${Math.round(scan.thirtyDayAvg).toLocaleString("en-AU")})` : ""}
                  </p>
                )}
              </div>
              {scan.seatsAvailable !== null && (
                <div className="text-right">
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold ${
                    scan.seatsAvailable <= 3
                      ? "bg-red-500/15 text-red-400"
                      : scan.seatsAvailable <= 7
                      ? "bg-orange-500/15 text-orange-400"
                      : "bg-emerald-500/15 text-emerald-400"
                  }`}>
                    <Armchair className="w-3.5 h-3.5" />
                    {scan.seatsAvailable} seat{scan.seatsAvailable !== 1 ? "s" : ""} left
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Trip summary */}
          <div className="grid grid-cols-2 gap-3">
            <InfoTile icon={<Calendar className="w-3.5 h-3.5" />} label="Departs">
              {format(parseISO(scan.departureDate), "EEE d MMM yyyy")}
            </InfoTile>
            <InfoTile icon={<Calendar className="w-3.5 h-3.5" />} label="Returns">
              {format(parseISO(scan.returnDate), "EEE d MMM yyyy")}
            </InfoTile>
            <InfoTile icon={<Clock className="w-3.5 h-3.5" />} label="Trip duration">
              {tripDays} nights
            </InfoTile>
            <InfoTile icon={<Armchair className="w-3.5 h-3.5" />} label="Cabin class">
              {CABIN_LABEL[scan.cabinClass ?? "ECONOMY"] ?? scan.cabinClass ?? "Economy"}
            </InfoTile>
          </div>

          {/* Outbound itinerary */}
          {outboundSegs.length > 0 ? (
            <ItinerarySection
              title={`Sydney → ${destination.name}`}
              segments={outboundSegs}
              duration={scan.outboundDuration}
            />
          ) : (
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                <Plane className="w-3.5 h-3.5 text-primary" />
                Sydney → {destination.name}
              </p>
              <p className="text-sm text-foreground">{scan.airline} · {scan.outboundDuration} · {scan.stops === 0 ? "Direct" : `${scan.stops} stop${scan.stops > 1 ? "s" : ""}`}</p>
            </div>
          )}

          {/* Return itinerary */}
          {returnSegs.length > 0 ? (
            <ItinerarySection
              title={`${destination.name} → Sydney`}
              segments={returnSegs}
              duration={scan.returnDuration}
            />
          ) : (
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
                <Plane className="w-3.5 h-3.5 rotate-180 text-primary" style={{ transform: "scaleX(-1)" }} />
                {destination.name} → Sydney
              </p>
              <p className="text-sm text-foreground">{scan.airline} · {scan.returnDuration}</p>
            </div>
          )}

          {/* AI Summary + Tip */}
          {(scan.aiSummary || scan.aiTravelTip) && (
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              {scan.aiSummary && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">AI Deal Summary</p>
                  <p className="text-sm text-foreground leading-relaxed">{scan.aiSummary}</p>
                </div>
              )}
              {scan.aiTravelTip && (
                <div className="border-t border-border pt-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Travel Tip</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{scan.aiTravelTip}</p>
                </div>
              )}
            </div>
          )}

          {/* Discovery timestamp */}
          <p className="text-xs text-muted-foreground text-center">
            Deal discovered {format(new Date(scan.scannedAt), "d MMM yyyy 'at' h:mm a")}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function InfoTile({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
        <span className="text-muted-foreground">{icon}</span>
        {label}
      </p>
      <p className="text-sm font-medium text-foreground">{children}</p>
    </div>
  );
}
