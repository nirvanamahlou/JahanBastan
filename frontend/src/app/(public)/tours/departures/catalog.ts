import { apiGet } from "@/lib/api/client";
import { formatCurrency } from "@/lib/currency";
type Price = { amount: string; currencyCode: string };
type Hotel = { profileSlug?: string | null; englishName?: string; region?: string; serviceLevel?: string; city?: { name: string; country: { name: string } }; facilities: { facility: { name: string } }[]; latitude?: string; longitude?: string; id: string; name: string; description?: string; address?: string; starRating?: number; sourceMainImage?: string; sourceGalleryImages?: string; hotelRules?: string; sourceRefundRules?: string };
type Leg = { originName: string; destinationName: string; departureAt: string; arrivalAt?: string; carrierName: string; serviceNumber: string };
type Rate = { hotelId: string; kind: string; roomTypeName?: string; checkIn?: string; checkOut?: string; total: Price[]; hotel: Price[]; flight: Price[] };
type Step = { title?: string; location?: string; description?: string; startTime?: string; stayDays?: number };
type ProfileDetails = { summary?: string; description?: string; services?: string; requiredDocuments?: string; refundRules?: string; installmentTerms?: string; itinerary?: Step[] };
export type Departure = { resourceId: string; details?: ProfileDetails; includedServices?: string[]; id: string; title: string; description?: string; startsOn: string; endsOn: string; remainingCapacity: number | null; kind: "tour" | "floating-tour"; outbound: Leg; returning?: Leg; hotels: Hotel[]; rates: Rate[]; previewOnly: boolean; salesStopped: boolean };
export const labels: Record<string, string> = { double: "دوتخته", single: "یک‌تخته", childWithBed: "کودک با تخت", extra: "تخت اضافه", childWithoutBed: "کودک بدون تخت", infant: "نوزاد" };
export const priceText = (prices: Price[]) => prices.map(p => formatCurrency(p.amount, p.currencyCode)).join(" + ");

export function hotelImages(hotel: Hotel) {
  return [...new Set([hotel.sourceMainImage, ...(hotel.sourceGalleryImages || "").split("|")])]
    .filter((url): url is string => Boolean(url && /^https:\/\//i.test(url)));
}

export async function getDepartures() {
  const tours: Departure[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await apiGet<Departure[]>(`/erp/dated-tours?limit=100&offset=${offset}`, { cache: "no-store" });
    tours.push(...page);
    if (page.length < 100) break;
  }
  return tours;
}
