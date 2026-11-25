export type TourDepartureAvailability = {
  bookingStatus: string;
  capacityRemaining: number | null;
};

export function isTourDepartureBookable(departure: TourDepartureAvailability) {
  return departure.bookingStatus === "open"
    && (departure.capacityRemaining === null || departure.capacityRemaining > 0);
}

export function tourDepartureUnavailableLabel(departure: TourDepartureAvailability) {
  return departure.bookingStatus === "sold_out" || departure.capacityRemaining === 0
    ? "تکمیل ظرفیت"
    : "بسته";
}

type AdultPrices = { doublePrice: string | null; singlePrice: string | null };

export function hasAvailableHotelRoom(offer: AdultPrices & { isAvailable: boolean; capacityRemaining: number | null }) {
  return offer.isAvailable && offer.capacityRemaining !== 0
    && (Number(offer.doublePrice) > 0 || Number(offer.singlePrice) > 0);
}

export function hasBookableTourPackage(
  departure: TourDepartureAvailability & { id: number; departureDate: string | null; hotelPrices: Parameters<typeof hasAvailableHotelRoom>[0][] },
  packages: { departurePrices?: (AdultPrices & { departureId: number; regularFlightPrice: string | null })[] }[] = [],
) {
  return Boolean(departure.departureDate) && isTourDepartureBookable(departure) && (
    departure.hotelPrices.some(hasAvailableHotelRoom) || packages.some(item =>
      item.departurePrices?.some(price => price.departureId === departure.id && price.regularFlightPrice != null
        && (Number(price.doublePrice) > 0 || Number(price.singlePrice) > 0)))
  );
}

export function tourReturnDate(departureDate: string, returnDate: string | null, nights?: number | null) {
  if (returnDate || nights == null || !Number.isInteger(nights) || nights < 0) return returnDate;
  const day = new Date(departureDate + "T00:00:00Z");
  day.setUTCDate(day.getUTCDate() + nights);
  return Number.isFinite(day.getTime()) ? day.toISOString().slice(0, 10) : null;
}

export function setTourDepartureUrl(departureId: number, hash?: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("departureId", String(departureId));
  if (hash) url.hash = hash;
  window.history.replaceState(null, "", url.pathname + url.search + url.hash);
}
