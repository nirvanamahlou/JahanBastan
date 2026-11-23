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
