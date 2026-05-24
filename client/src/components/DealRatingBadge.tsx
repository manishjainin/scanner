import { Flame, TrendingDown, Minus } from "lucide-react";

type DealRating = "Hot Deal" | "Good Price" | "Standard";

interface DealRatingBadgeProps {
  rating: DealRating;
  size?: "sm" | "md";
}

export function DealRatingBadge({ rating, size = "sm" }: DealRatingBadgeProps) {
  const config = {
    "Hot Deal": {
      className: "badge-hot-deal",
      icon: <Flame className="w-2.5 h-2.5" />,
    },
    "Good Price": {
      className: "badge-good-price",
      icon: <TrendingDown className="w-2.5 h-2.5" />,
    },
    Standard: {
      className: "badge-standard",
      icon: <Minus className="w-2.5 h-2.5" />,
    },
  };

  const { className, icon } = config[rating];

  return (
    <span
      className={`${className} inline-flex items-center gap-1 ${size === "md" ? "text-xs px-2.5 py-1" : ""}`}
    >
      {icon}
      {rating}
    </span>
  );
}
