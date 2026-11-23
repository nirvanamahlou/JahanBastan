export type PassengerCounts = {
  adults: number;
  children: number;
  infants: number;
};

type CartItemWithRoomSelection = {
  itemType: string;
  roomSelection?: Record<string, number> | null;
};

function validQuantity(value: number | undefined) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value ?? 0)) : 0;
}

export function getTourPassengerCounts(
  items: CartItemWithRoomSelection[],
): PassengerCounts | null {
  const counts: PassengerCounts = { adults: 0, children: 0, infants: 0 };
  let hasTourSelection = false;

  for (const item of items) {
    if (item.itemType !== "tour" || !item.roomSelection) continue;

    const doubleRooms = validQuantity(item.roomSelection.double);
    const singleRooms = validQuantity(item.roomSelection.single);
    const extraPassengers = validQuantity(item.roomSelection.extra);
    const childrenWithBed = validQuantity(item.roomSelection.childWithBed);
    const childrenWithoutBed = validQuantity(item.roomSelection.childWithoutBed);
    const infants = validQuantity(item.roomSelection.infant);
    const selectedPassengers =
      doubleRooms * 2 +
      singleRooms +
      extraPassengers +
      childrenWithBed +
      childrenWithoutBed +
      infants;

    if (!selectedPassengers) continue;
    hasTourSelection = true;
    counts.adults += doubleRooms * 2 + singleRooms + extraPassengers;
    counts.children += childrenWithBed + childrenWithoutBed;
    counts.infants += infants;
  }

  return hasTourSelection ? counts : null;
}
