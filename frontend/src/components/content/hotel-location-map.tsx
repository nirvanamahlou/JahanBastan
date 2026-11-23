type HotelLocationMapProps = {
  name: string;
  address?: string | null;
  region?: string | null;
  destination?: string | null;
  country?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  compact?: boolean;
};

export type HotelLocationQuery = Omit<HotelLocationMapProps, "compact">;

export function hotelMapQuery({
  name,
  address,
  region,
  destination,
  country,
  latitude,
  longitude,
}: HotelLocationQuery) {
  if (latitude && longitude && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude)) && Math.abs(Number(latitude)) <= 90 && Math.abs(Number(longitude)) <= 180) return Number(latitude) + "," + Number(longitude);
  return [name, address, region, destination, country]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(", ");
}

export function hotelMapSearchUrl(props: HotelLocationQuery) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hotelMapQuery(props))}`;
}

export function HotelLocationMap({ compact = false, ...hotel }: HotelLocationMapProps) {
  const query = hotelMapQuery(hotel);
  const embedUrl = `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed&hl=fa`;
  const searchUrl = hotelMapSearchUrl(hotel);
  const locationLabel = [hotel.region, hotel.destination, hotel.country].filter(Boolean).join("، ");

  return (
    <section className={compact ? "rounded-2xl border border-border bg-surface p-3" : "rounded-3xl border border-border bg-surface p-5 shadow-sm sm:p-7"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-brand">موقعیت هتل روی نقشه</h2>
          <p className="mt-1 text-sm text-muted">{hotel.address || locationLabel || "موقعیت در دسترس نیست"}</p>
        </div>
        <a
          className="text-sm font-black text-accent-strong underline-offset-4 hover:underline"
          href={searchUrl}
          rel="noreferrer"
          target="_blank"
        >
          باز کردن در Google Maps
        </a>
      </div>
      <iframe
        className={`mt-4 w-full rounded-2xl border-0 ${compact ? "h-40" : "h-72 sm:h-96"}`}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        src={embedUrl}
        title={`نقشه موقعیت ${hotel.name}`}
      />
    </section>
  );
}
