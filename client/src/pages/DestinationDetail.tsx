import { useState } from "react";
import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { PriceTrendChart } from "@/components/PriceTrendChart";
import { DealRatingBadge } from "@/components/DealRatingBadge";
import { AIChatBox, type Message } from "@/components/AIChatBox";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Plane, Clock, Calendar, TrendingDown, TrendingUp,
  Minus, MapPin, Sparkles, AlertCircle, RefreshCw, MessageSquare,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { format, parseISO } from "date-fns";

const REGION_EMOJI: Record<string, string> = {
  "SE Asia": "🌴", "NE Asia": "⛩️", "Europe": "🏛️",
  "N America": "🗽", "Pacific": "🌊", "Middle East": "🕌",
  "Mexico": "🌮",
};

type Tab = "overview" | "history";

export default function DestinationDetail() {
  const params = useParams<{ id: string }>();
  const destinationId = parseInt(params.id ?? "0", 10);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);

  const { data: destination, isLoading: destLoading, isError: destError, refetch: refetchDest } =
    trpc.destinations.getById.useQuery({ id: destinationId }, { enabled: !!destinationId });

  const { data: priceHistory, isLoading: historyLoading } =
    trpc.scans.priceHistory.useQuery({ destinationId }, { enabled: !!destinationId });

  const { data: fullHistory, isLoading: fullHistoryLoading } =
    trpc.scans.fullHistory.useQuery({ destinationId }, { enabled: !!destinationId && activeTab === "history" });

  const { data: latestScan, isLoading: scanLoading } =
    trpc.scans.latestForDestination.useQuery({ destinationId }, { enabled: !!destinationId });

  const chatMutation = trpc.ai.chat.useMutation({
    onSuccess: (data) => {
      setChatMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
    },
    onError: (err) => {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Sorry, I couldn't respond right now. ${err.message}` },
      ]);
    },
  });

  const handleSendMessage = (content: string) => {
    const userMsg: Message = { role: "user", content };
    const nextMessages = [...chatMessages, userMsg];
    setChatMessages(nextMessages);
    chatMutation.mutate({
      destinationId,
      messages: nextMessages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    });
  };

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

  if (destError || !destination) {
    return (
      <div className="p-6 lg:p-8 text-center py-24">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4 mx-auto">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <p className="text-muted-foreground mb-4">
          {destError ? "Failed to load destination." : "Destination not found."}
        </p>
        <div className="flex items-center justify-center gap-3">
          {destError && (
            <Button variant="outline" size="sm" onClick={() => refetchDest()} className="flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </Button>
          )}
          <Link href="/">
            <span className="text-primary text-sm cursor-pointer">← Back to dashboard</span>
          </Link>
        </div>
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
      <div className="flex items-center gap-4 mb-6">
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

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-border">
        {(["overview", "history"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors capitalize border-b-2 -mb-px ${
              activeTab === tab
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "overview" ? "Overview" : "Price History"}
          </button>
        ))}
      </div>

      {/* ── Overview tab ── */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Price trend + AI tip */}
          <div className="lg:col-span-2 space-y-6">
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

            {latestScan?.aiTravelTip && (
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4" style={{ color: "oklch(0.78 0.15 75)" }} />
                  <h2 className="text-base font-semibold text-foreground">AI Travel Tip</h2>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{latestScan.aiTravelTip}</p>
              </div>
            )}

            {/* AI Chat */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <button
                onClick={() => setShowChat((v) => !v)}
                className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-foreground hover:bg-secondary/40 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" style={{ color: "oklch(0.78 0.15 75)" }} />
                  Ask AI about {destination.name}
                </div>
                {showChat ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>
              {showChat && (
                <div className="border-t border-border">
                  <AIChatBox
                    messages={chatMessages}
                    onSendMessage={handleSendMessage}
                    isLoading={chatMutation.isPending}
                    height="400px"
                    placeholder={`Ask anything about ${destination.name}…`}
                    emptyStateMessage={`Ask me about ${destination.name} — visas, best time to visit, what to do, or whether this deal is worth it.`}
                    suggestedPrompts={[
                      `Is this a good deal to ${destination.name}?`,
                      `Do I need a visa to ${destination.name}?`,
                      `Best time to visit ${destination.name}?`,
                      `What should I do in ${destination.name}?`,
                    ]}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Right: Current fare breakdown */}
          <div className="space-y-4">
            {latestScan && price ? (
              <>
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

                <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Flight Details</p>
                  <div className="space-y-3">
                    <DetailRow icon={<Calendar className="w-3.5 h-3.5" />} label="Departure" value={format(parseISO(latestScan.departureDate), "EEEE, d MMMM yyyy")} />
                    <DetailRow icon={<Calendar className="w-3.5 h-3.5" />} label="Return" value={format(parseISO(latestScan.returnDate), "EEEE, d MMMM yyyy")} />
                    <DetailRow icon={<Clock className="w-3.5 h-3.5" />} label="Trip duration" value={`${tripDays} nights`} />
                    <DetailRow icon={<Plane className="w-3.5 h-3.5" />} label="Airline" value={latestScan.airline ?? latestScan.airlineCode ?? "Unknown"} />
                    <DetailRow icon={<Clock className="w-3.5 h-3.5" />} label="Outbound" value={`${latestScan.outboundDuration ?? "—"} · ${latestScan.stops === 0 ? "Direct" : `${latestScan.stops} stop${latestScan.stops > 1 ? "s" : ""}`}`} />
                    <DetailRow icon={<Clock className="w-3.5 h-3.5" />} label="Return leg" value={latestScan.returnDuration ?? "—"} />
                  </div>
                </div>

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
                      <span className="text-foreground font-medium">{format(new Date(latestScan.scannedAt), "d MMM, h:mm a")}</span>
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
      )}

      {/* ── Price History tab ── */}
      {activeTab === "history" && (
        <div className="space-y-6">
          {/* All-time chart */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-foreground">All-Time Price Chart</h2>
              <span className="text-xs text-muted-foreground">{priceHistory?.length ?? 0} data points (30 days)</span>
            </div>
            <PriceTrendChart data={priceHistory ?? []} height={260} />
          </div>

          {/* Stats row */}
          {fullHistory && fullHistory.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatTile label="Total scans" value={fullHistory.length.toString()} />
              <StatTile
                label="Lowest ever"
                value={`$${Math.round(Math.min(...fullHistory.map((r) => r.price))).toLocaleString("en-AU")}`}
                highlight
              />
              <StatTile
                label="Highest seen"
                value={`$${Math.round(Math.max(...fullHistory.map((r) => r.price))).toLocaleString("en-AU")}`}
              />
              <StatTile
                label="Hot Deals found"
                value={fullHistory.filter((r) => r.dealRating === "Hot Deal").length.toString()}
              />
            </div>
          )}

          {/* Scan history table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Scan History</h3>
            </div>
            {fullHistoryLoading ? (
              <div className="p-8 text-center text-muted-foreground text-sm">Loading…</div>
            ) : !fullHistory || fullHistory.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">No scan history yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/20">
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Scanned</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Price</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">Airline</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Departs</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">Stops</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Rating</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">vs Avg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fullHistory.map((row, i) => (
                      <tr key={row.id} className={`border-b border-border last:border-0 ${i % 2 === 0 ? "" : "bg-secondary/10"}`}>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(row.scannedAt), "d MMM yyyy")}
                        </td>
                        <td className="px-4 py-3 font-semibold text-foreground">
                          ${Math.round(row.price).toLocaleString("en-AU")}
                          <span className="text-xs text-muted-foreground ml-1">{row.currency}</span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell text-xs">
                          {row.airline ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-xs">
                          {row.departureDate}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell text-xs">
                          {row.stops === 0 ? "Direct" : `${row.stops} stop${row.stops > 1 ? "s" : ""}`}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            row.dealRating === "Hot Deal" ? "bg-orange-500/15 text-orange-400" :
                            row.dealRating === "Good Price" ? "bg-emerald-500/15 text-emerald-400" :
                            "bg-secondary text-muted-foreground"
                          }`}>
                            {row.dealRating}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-xs hidden md:table-cell ${
                          row.percentVsAvg === null ? "text-muted-foreground" :
                          row.percentVsAvg <= -10 ? "text-orange-400" :
                          row.percentVsAvg <= -5 ? "text-emerald-400" :
                          row.percentVsAvg >= 5 ? "text-red-400" : "text-muted-foreground"
                        }`}>
                          {row.percentVsAvg !== null
                            ? `${row.percentVsAvg > 0 ? "+" : ""}${row.percentVsAvg.toFixed(1)}%`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
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

function StatTile({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`bg-card border rounded-xl px-4 py-3 ${highlight ? "border-orange-500/30" : "border-border"}`}>
      <p className={`text-xl font-bold ${highlight ? "gold-text" : "text-foreground"}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
