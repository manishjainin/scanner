import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { DealCard } from "@/components/DealCard";
import { DealDetailDrawer } from "@/components/DealDetailDrawer";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  RefreshCw, Flame, TrendingDown, Minus, Clock,
  CheckCircle2, AlertCircle, Loader2, Globe, PlaneTakeoff,
} from "lucide-react";
import { format, formatDistanceToNow, isToday } from "date-fns";

const CONTINENTS = ["All", "Asia", "Pacific", "Middle East", "Europe", "Americas", "Africa"] as const;
type ContinentFilter = (typeof CONTINENTS)[number];

const DEAL_FILTERS = [
  { label: "All Deals", value: "all", icon: null },
  { label: "Hot Deals", value: "Hot Deal", icon: Flame },
  { label: "Good Price", value: "Good Price", icon: TrendingDown },
  { label: "Standard", value: "Standard", icon: Minus },
] as const;
type DealFilter = (typeof DEAL_FILTERS)[number]["value"];

const ORIGIN_CITIES: Record<string, string> = {
  SYD: "Sydney", MEL: "Melbourne", BNE: "Brisbane",
  PER: "Perth", ADL: "Adelaide", CBR: "Canberra",
};

type DealRow = {
  scan: {
    id: number;
    price: string | number;
    currency: string;
    airline: string | null;
    airlineCode: string | null;
    stops: number;
    departureDate: string;
    returnDate: string;
    outboundDuration: string | null;
    returnDuration: string | null;
    dealRating: "Hot Deal" | "Good Price" | "Standard";
    aiSummary: string | null;
    aiTravelTip: string | null;
    percentVsAvg: string | number | null;
    thirtyDayAvg: string | number | null;
    seatsAvailable: number | null;
    cabinClass: string | null;
    outboundSegments: unknown;
    returnSegments: unknown;
    scannedAt: Date;
  };
  destination: {
    id: number;
    name: string;
    iataCode: string;
    region: string;
    country: string;
    continent: string;
  };
};

export default function Home() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [dealFilter, setDealFilter] = useState<DealFilter>("all");
  const [continentFilter, setContinentFilter] = useState<ContinentFilter>("All");
  const [originFilter, setOriginFilter] = useState<string>("All");
  const [selectedDeal, setSelectedDeal] = useState<DealRow | null>(null);

  const { data: availableOrigins } = trpc.scans.availableOrigins.useQuery();
  const showOriginFilter = (availableOrigins?.length ?? 1) > 1;

  const { data: deals, isLoading, isError, error, refetch } = trpc.scans.todayDeals.useQuery(
    { origin: originFilter !== "All" ? originFilter : undefined },
    { refetchInterval: 60_000 }
  );

  const triggerScan = trpc.scans.triggerScan.useMutation({
    onSuccess: (data) => {
      toast.success(`Scan complete — ${data.results.filter((r) => r.success).length} destinations updated`);
      refetch();
    },
    onError: (err) => toast.error(`Scan failed: ${err.message}`),
  });

  const filteredDeals = deals?.filter((d) => {
    const matchDeal = dealFilter === "all" || d.scan.dealRating === dealFilter;
    const matchContinent = continentFilter === "All" || d.destination.continent === continentFilter;
    return matchDeal && matchContinent;
  }) as DealRow[] | undefined;

  const hotCount = deals?.filter((d) => d.scan.dealRating === "Hot Deal").length ?? 0;
  const goodCount = deals?.filter((d) => d.scan.dealRating === "Good Price").length ?? 0;
  const lastScan = deals?.[0]?.scan.scannedAt;

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-1">Flight Deals</h1>
          <p className="text-muted-foreground text-sm">Round-trip fares · AI-rated · Updated daily</p>
          {lastScan && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              {isToday(new Date(lastScan))
                ? `Last scanned today at ${format(new Date(lastScan), "h:mm a")}`
                : `Last scanned ${formatDistanceToNow(new Date(lastScan), { addSuffix: true })}`}
            </p>
          )}
        </div>
        {isAdmin && (
          <Button
            onClick={() => triggerScan.mutate()}
            disabled={triggerScan.isPending}
            className="flex items-center gap-2 text-sm font-semibold flex-shrink-0"
            style={{ background: "linear-gradient(135deg, oklch(0.78 0.15 75), oklch(0.65 0.18 60))", color: "oklch(0.10 0.01 260)" }}
          >
            {triggerScan.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {triggerScan.isPending ? "Scanning…" : "Scan Now"}
          </Button>
        )}
      </div>

      {/* Stats */}
      {deals && deals.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatCard label="Destinations scanned" value={deals.length.toString()} icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />} />
          <StatCard label="Hot Deals today" value={hotCount.toString()} icon={<Flame className="w-4 h-4 text-orange-400" />} highlight={hotCount > 0} />
          <StatCard label="Good Prices today" value={goodCount.toString()} icon={<TrendingDown className="w-4 h-4 text-emerald-400" />} />
        </div>
      )}

      {/* Origin filter (only shown when multiple origins are configured) */}
      {showOriginFilter && availableOrigins && (
        <div className="mb-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <PlaneTakeoff className="w-3.5 h-3.5 text-muted-foreground mr-1" />
            {["All", ...availableOrigins].map((o) => (
              <button
                key={o}
                onClick={() => setOriginFilter(o)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-150 ${
                  originFilter === o
                    ? "text-black"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
                style={originFilter === o ? { background: "linear-gradient(135deg, oklch(0.65 0.20 35), oklch(0.72 0.18 50))" } : {}}
              >
                {o === "All" ? "All Origins" : `${ORIGIN_CITIES[o] ?? o} (${o})`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Continent filter */}
      <div className="mb-4">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Globe className="w-3.5 h-3.5 text-muted-foreground mr-1" />
          {CONTINENTS.map((c) => (
            <button
              key={c}
              onClick={() => setContinentFilter(c)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-150 ${
                continentFilter === c
                  ? "text-black"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
              style={continentFilter === c ? { background: "linear-gradient(135deg, oklch(0.78 0.15 75), oklch(0.65 0.18 60))" } : {}}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Deal rating filter */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {DEAL_FILTERS.map((opt) => {
          const Icon = opt.icon;
          const active = dealFilter === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => setDealFilter(opt.value)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-150 ${
                active ? "text-black" : "bg-secondary/60 text-muted-foreground hover:text-foreground"
              }`}
              style={active ? { background: "linear-gradient(135deg, oklch(0.65 0.20 35), oklch(0.72 0.18 50))" } : {}}
            >
              {Icon && <Icon className="w-3 h-3" />}
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Error state */}
      {isError && !isLoading && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Failed to load deals</h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            {error?.message ?? "Something went wrong fetching today's deals."}
          </p>
          <Button
            onClick={() => refetch()}
            variant="outline"
            className="flex items-center gap-2 text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </Button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-5 h-56 skeleton-shimmer" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && (!deals || deals.length === 0) && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">No deals scanned yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            No scans have run yet. Trigger a scan to see the latest fares from your configured origins.
          </p>
          {isAdmin && (
            <Button
              onClick={() => triggerScan.mutate()}
              disabled={triggerScan.isPending}
              style={{ background: "linear-gradient(135deg, oklch(0.78 0.15 75), oklch(0.65 0.18 60))", color: "oklch(0.10 0.01 260)", fontWeight: 600 }}
            >
              {triggerScan.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Run First Scan
            </Button>
          )}
        </div>
      )}

      {/* Deal cards */}
      {!isLoading && !isError && filteredDeals && filteredDeals.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredDeals.map((row, i) => (
            <DealCard
              key={row.scan.id}
              destinationId={row.destination.id}
              destinationName={row.destination.name}
              iataCode={row.destination.iataCode}
              region={row.destination.region}
              country={row.destination.country}
              price={parseFloat(String(row.scan.price))}
              currency={row.scan.currency}
              airline={row.scan.airline ?? row.scan.airlineCode ?? ""}
              airlineCode={row.scan.airlineCode ?? ""}
              stops={row.scan.stops}
              departureDate={row.scan.departureDate}
              returnDate={row.scan.returnDate}
              outboundDuration={row.scan.outboundDuration ?? ""}
              returnDuration={row.scan.returnDuration ?? ""}
              dealRating={row.scan.dealRating}
              aiSummary={row.scan.aiSummary}
              percentVsAvg={row.scan.percentVsAvg !== null ? parseFloat(String(row.scan.percentVsAvg)) : null}
              seatsAvailable={row.scan.seatsAvailable}
              animationDelay={i * 35}
              onClick={() => setSelectedDeal(row)}
            />
          ))}
        </div>
      )}

      {!isLoading && !isError && filteredDeals?.length === 0 && deals && deals.length > 0 && (
        <div className="text-center py-16 text-muted-foreground text-sm">
          No deals found for the selected filters. Try adjusting the continent or deal rating filter.
        </div>
      )}

      {/* Deal detail drawer */}
      {selectedDeal && (
        <DealDetailDrawer
          open={!!selectedDeal}
          onClose={() => setSelectedDeal(null)}
          destination={{
            name: selectedDeal.destination.name,
            iataCode: selectedDeal.destination.iataCode,
            region: selectedDeal.destination.region,
            country: selectedDeal.destination.country,
          }}
          scan={{
            price: parseFloat(String(selectedDeal.scan.price)),
            currency: selectedDeal.scan.currency,
            airline: selectedDeal.scan.airline ?? selectedDeal.scan.airlineCode ?? "",
            airlineCode: selectedDeal.scan.airlineCode ?? "",
            stops: selectedDeal.scan.stops,
            outboundDuration: selectedDeal.scan.outboundDuration ?? "",
            returnDuration: selectedDeal.scan.returnDuration ?? "",
            departureDate: selectedDeal.scan.departureDate,
            returnDate: selectedDeal.scan.returnDate,
            seatsAvailable: selectedDeal.scan.seatsAvailable,
            cabinClass: selectedDeal.scan.cabinClass,
            outboundSegments: Array.isArray(selectedDeal.scan.outboundSegments) ? selectedDeal.scan.outboundSegments : null,
            returnSegments: Array.isArray(selectedDeal.scan.returnSegments) ? selectedDeal.scan.returnSegments : null,
            dealRating: selectedDeal.scan.dealRating,
            aiSummary: selectedDeal.scan.aiSummary,
            aiTravelTip: selectedDeal.scan.aiTravelTip,
            percentVsAvg: selectedDeal.scan.percentVsAvg !== null ? parseFloat(String(selectedDeal.scan.percentVsAvg)) : null,
            thirtyDayAvg: selectedDeal.scan.thirtyDayAvg !== null ? parseFloat(String(selectedDeal.scan.thirtyDayAvg)) : null,
            scannedAt: new Date(selectedDeal.scan.scannedAt),
          }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, icon, highlight = false }: {
  label: string; value: string; icon: React.ReactNode; highlight?: boolean;
}) {
  return (
    <div className={`bg-card border rounded-xl px-4 py-3 flex items-center gap-3 ${highlight ? "border-orange-500/30" : "border-border"}`}>
      <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">{icon}</div>
      <div>
        <p className="text-xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
