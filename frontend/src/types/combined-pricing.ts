export type CombinedDeparturePrice = {
  id: number;
  departureId: number;
  doublePrice: string | null;
  doubleCurrency: string;
  singlePrice: string | null;
  singleCurrency: string;
  childWithBedPrice: string | null;
  childWithBedCurrency: string;
  childWithoutBedPrice: string | null;
  childWithoutBedCurrency: string;
  infantPrice: string | null;
  infantCurrency: string;
  infantSupplementPrice?: string | null;
  infantSupplementCurrency?: string;
  doubleFlightPrice?: string | null;
  singleFlightPrice?: string | null;
  regularFlightPrice: string | null;
  regularFlightCurrency: string;
  childWithBedFlightPrice: string | null;
  childWithBedFlightCurrency: string;
  extraPrice?: string | null;
  extraCurrency?: string;
};

export type PublicCombinedPackage = Omit<CombinedDeparturePrice, "id" | "departureId" | "childWithBedFlightPrice" | "childWithBedFlightCurrency"> & {
  id?: number;
  combinedDeparturePriceId?: number;
  title: string;
  childWithBedFlightPrice?: string | null;
  childWithBedFlightCurrency?: string;
  extraPrice?: string | null;
  extraCurrency?: string;
  childWithoutBedFlightPrice: string | null;
  childWithoutBedFlightCurrency: string;
  addFlightToDouble: boolean;
  addFlightToSingle: boolean;
  addFlightToChildWithBed: boolean;
  addFlightToChildWithoutBed: boolean;
  addFlightToInfant: boolean;
  departurePrices?: CombinedDeparturePrice[];
  hotels: {
    nights: number;
    boardType: string | null;
    hotel: {
      name: string;
      slug: string;
      starRating: number;
      imageId: number | null;
      galleryImageIds: number[];
    };
  }[];
};
