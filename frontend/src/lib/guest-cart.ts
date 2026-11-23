export type GuestCartPayload = {
  itemType: "tour" | "flight" | "train" | "bus";
  tourId?: number;
  travelServiceId?: number;
  tourDepartureId?: number;
  hotelPackageId?: number;
  tourHotelPriceId?: number;
  combinedDeparturePriceId?: number;
  roomSelection?: Record<string, number>;
};

export type GuestCartIntent = GuestCartPayload & {
  addedAt: string;
  label: string;
};

const storageKey = "jahan-bastan.guest-cart.v1";
export const CART_UPDATED_EVENT = "jahan-bastan:cart-updated";

function canUseStorage() {
  return typeof window !== "undefined";
}

export function notifyCartUpdated() {
  if (!canUseStorage()) return;
  window.dispatchEvent(new Event(CART_UPDATED_EVENT));
}

export function readGuestCart(): GuestCartIntent[] {
  if (!canUseStorage()) return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isGuestCartIntent) : [];
  } catch {
    return [];
  }
}

function isGuestCartIntent(value: unknown): value is GuestCartIntent {
  return Boolean(
    value &&
      typeof value === "object" &&
      "itemType" in value &&
      "addedAt" in value &&
      "label" in value,
  );
}

export function addGuestCartIntent(payload: GuestCartPayload, label: string) {
  if (!canUseStorage()) return;
  const current = readGuestCart();
  const duplicateIndex = current.findIndex(
    (item) =>
      item.itemType === payload.itemType &&
      item.tourHotelPriceId === payload.tourHotelPriceId &&
      item.combinedDeparturePriceId === payload.combinedDeparturePriceId &&
      item.travelServiceId === payload.travelServiceId,
  );
  if (duplicateIndex === -1) {
    current.push({ ...payload, addedAt: new Date().toISOString(), label });
  } else {
    current[duplicateIndex] = { ...payload, addedAt: new Date().toISOString(), label };
  }
  window.localStorage.setItem(storageKey, JSON.stringify(current));
  notifyCartUpdated();
}

export function clearGuestCart() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(storageKey);
  notifyCartUpdated();
}

export function removeGuestCartIntents(intents: readonly GuestCartIntent[]) {
  if (!canUseStorage() || !intents.length) return;
  const keys = new Set(intents.map((item) => JSON.stringify(item)));
  const remaining = readGuestCart().filter((item) => !keys.has(JSON.stringify(item)));
  if (remaining.length) window.localStorage.setItem(storageKey, JSON.stringify(remaining));
  else window.localStorage.removeItem(storageKey);
  notifyCartUpdated();
}
