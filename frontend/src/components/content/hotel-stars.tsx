type HotelStarsProps = {
  className?: string;
  rating: number;
  size?: "sm" | "md";
};

export function HotelStars({ className = "", rating, size = "sm" }: HotelStarsProps) {
  const normalizedRating = Math.max(0, Math.min(5, Math.round(rating)));
  const starSize = size === "md" ? "size-5" : "size-4";
  const label = `${normalizedRating.toLocaleString("fa-IR")} ستاره`;

  return (
    <span aria-label={label} className={`inline-flex items-center gap-0.5 ${className}`} role="img">
      <span className="sr-only">{label}</span>
      {Array.from({ length: 5 }, (_, index) => (
        <svg
          aria-hidden="true"
          className={`${starSize} ${index < normalizedRating ? "fill-amber-400 text-amber-400" : "fill-transparent text-amber-200"}`}
          key={index}
          viewBox="0 0 24 24"
        >
          <path d="m12 2.8 2.84 5.75 6.35.92-4.6 4.48 1.09 6.33L12 17.3l-5.68 2.98 1.08-6.33-4.59-4.48 6.35-.92L12 2.8Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        </svg>
      ))}
    </span>
  );
}