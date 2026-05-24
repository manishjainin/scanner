import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import { format, parseISO } from "date-fns";

interface PricePoint {
  date: string;
  price: number;
  dealRating: "Hot Deal" | "Good Price" | "Standard";
}

interface PriceTrendChartProps {
  data: PricePoint[];
  height?: number;
}

const ratingColor = (rating: string) => {
  if (rating === "Hot Deal") return "#e8703a";
  if (rating === "Good Price") return "#4ade80";
  return "#6b7280";
};

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: PricePoint }>;
  label?: string;
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]!;
  const rating = point.payload.dealRating;

  return (
    <div
      style={{
        background: "oklch(0.14 0.01 260)",
        border: "1px solid oklch(0.25 0.01 260)",
        borderRadius: "8px",
        padding: "10px 14px",
      }}
    >
      <p style={{ color: "oklch(0.60 0.01 260)", fontSize: "0.75rem", marginBottom: 4 }}>
        {label ? format(parseISO(label), "d MMM yyyy") : ""}
      </p>
      <p style={{ color: "oklch(0.95 0.01 90)", fontWeight: 600, fontSize: "1rem" }}>
        ${point.value.toLocaleString("en-AU")} AUD
      </p>
      <p style={{ color: ratingColor(rating), fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginTop: 4 }}>
        {rating}
      </p>
    </div>
  );
};

export function PriceTrendChart({ data, height = 220 }: PriceTrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        style={{ height, display: "flex", alignItems: "center", justifyContent: "center" }}
        className="text-muted-foreground text-sm"
      >
        No price history available yet. Check back after the first daily scan.
      </div>
    );
  }

  const prices = data.map((d) => d.price);
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const padding = (maxPrice - minPrice) * 0.15 || 50;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="oklch(0.78 0.15 75)" stopOpacity={0.25} />
            <stop offset="95%" stopColor="oklch(0.78 0.15 75)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="oklch(0.22 0.01 260)"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tickFormatter={(v) => format(parseISO(v), "d MMM")}
          tick={{ fill: "oklch(0.50 0.01 260)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[minPrice - padding, maxPrice + padding]}
          tickFormatter={(v) => `$${Math.round(v / 100) * 100}`}
          tick={{ fill: "oklch(0.50 0.01 260)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={60}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine
          y={avg}
          stroke="oklch(0.78 0.15 75)"
          strokeDasharray="4 4"
          strokeOpacity={0.5}
          label={{
            value: `Avg $${Math.round(avg).toLocaleString("en-AU")}`,
            fill: "oklch(0.78 0.15 75)",
            fontSize: 10,
            position: "insideTopRight",
          }}
        />
        <Area
          type="monotone"
          dataKey="price"
          stroke="oklch(0.78 0.15 75)"
          strokeWidth={2}
          fill="url(#priceGradient)"
          dot={(props) => {
            const { cx, cy, payload } = props as { cx: number; cy: number; payload: PricePoint };
            const color = ratingColor(payload.dealRating);
            return (
              <circle
                key={`dot-${payload.date}`}
                cx={cx}
                cy={cy}
                r={3.5}
                fill={color}
                stroke="oklch(0.14 0.01 260)"
                strokeWidth={1.5}
              />
            );
          }}
          activeDot={{ r: 5, fill: "oklch(0.78 0.15 75)", stroke: "oklch(0.14 0.01 260)", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
