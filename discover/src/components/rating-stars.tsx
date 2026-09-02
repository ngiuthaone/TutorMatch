import { Star } from "lucide-react";

interface RatingStarsProps {
  value: number;
  size?: "sm" | "md" | "lg";
  showCount?: boolean;
  count?: number;
  className?: string;
}

const sizeClasses = { sm: "h-3 w-3", md: "h-4 w-4", lg: "h-5 w-5" };

export function RatingStars({ value, size = "md", showCount, count, className = "" }: RatingStarsProps) {
  const s = sizeClasses[size];
  const rounded = Math.round(value);
  return (
    <div className={`inline-flex items-center gap-0.5 ${className}`} aria-label={`Rating: ${value.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${s} ${i <= rounded ? "fill-amber-400 text-amber-400" : "text-gray-200"}`}
        />
      ))}
      {showCount && count !== undefined && (
        <span className="ml-1.5 text-xs text-muted-foreground">({count})</span>
      )}
    </div>
  );
}
