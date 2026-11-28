"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useState } from "react";

import { JalaliDateRangeInput } from "@/components/search/jalali-date-range-input";
import { PassengerSelector } from "@/components/search/passenger-selector";
import { SearchableRouteSelect } from "@/components/search/searchable-route-select";
import { TravelSearchIcon } from "@/components/search/travel-search-icon";
import { CompassIcon, LocationIcon, PassportIcon, SearchIcon, UsersIcon } from "@/components/layout/site-icons";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import styles from "./travel-search.module.css";

export type SearchOption = {
  label: string;
  value: string;
};

type Option = SearchOption;

type TransportServiceType = "flight" | "bus" | "train";

export type TransportSearchOptions = Record<
  TransportServiceType,
  {
    origins: SearchOption[];
    destinations: SearchOption[];
    routes: Array<{ origin: string; destination: string }>;
  }
>;

export type ServiceType =
  "tour" | "hotel" | "flight" | "bus" | "train" | "visa";

const fieldClassName =
  "min-h-12 min-w-0 rounded-xl px-3 text-sm";

export const serviceTabs: ReadonlyArray<{
  key: ServiceType;
  label: string;
  icon: ReactNode;
  route: string;
}> = [
  {
    key: "tour",
    label: "تور",
    icon: <TravelSearchIcon icon="tour" className="size-7 sm:size-8" />,
    route: "/tours/",
  },
  {
    key: "hotel",
    label: "هتل",
    icon: <TravelSearchIcon icon="hotel" className="size-7 sm:size-8" />,
    route: "/hotels/",
  },
  {
    key: "flight",
    label: "پرواز",
    icon: <TravelSearchIcon icon="flight" className="size-7 sm:size-8" />,
    route: "/services/flights/",
  },
  {
    key: "bus",
    label: "اتوبوس",
    icon: <TravelSearchIcon icon="bus" className="size-7 sm:size-8" />,
    route: "/services/",
  },
  {
    key: "train",
    label: "قطار",
    icon: <TravelSearchIcon icon="train" className="size-7 sm:size-8" />,
    route: "/services/",
  },
  {
    key: "visa",
    label: "ویزا",
    icon: <TravelSearchIcon icon="visa" className="size-7 sm:size-8" />,
    route: "/services/",
  },
];

function RouteSelector({
  originId,
  originLabel,
  originPlaceholder,
  originValue,
  destinationId,
  destinationLabel,
  destinationPlaceholder,
  destinationValue,
  onOriginChange,
  onDestinationChange,
  originOptions,
  destinationOptions,
  required = false,
}: {
  originId: string;
  originLabel: string;
  originPlaceholder: string;
  originValue: string;
  destinationId: string;
  destinationLabel: string;
  destinationPlaceholder: string;
  destinationValue: string;
  onOriginChange: (value: string) => void;
  onDestinationChange: (value: string) => void;
  originOptions: ReadonlyArray<Option>;
  destinationOptions: ReadonlyArray<Option>;
  required?: boolean;
}) {
  return (
    <div data-search-route className={styles.route}>
      <div className={styles.field}><CompassIcon className={styles.fieldIcon} />
      <SearchableRouteSelect
        id={originId}
        name="departure"
        label={originLabel}
        options={originOptions}
        placeholder={originPlaceholder}
        required={required}
        value={originValue}
        onValueChange={onOriginChange}
        className={fieldClassName}
      />
      </div>
      <button
        aria-label="جابه‌جایی مبدأ و مقصد"
        className="mb-0.5 grid size-10 place-items-center self-end rounded-full border border-brand/30 bg-white/62 text-base font-black text-brand shadow-[0_5px_14px_rgba(1,37,105,0.12)] transition hover:-translate-y-0.5 hover:border-accent-strong hover:bg-accent/35 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent"
        onClick={() => {
          onOriginChange(destinationValue);
          onDestinationChange(originValue);
        }}
        type="button"
      >
        <TravelSearchIcon icon="swap" className="size-5" />
      </button>
      <div className={styles.field}><LocationIcon className={styles.fieldIcon} />
      <SearchableRouteSelect
        id={destinationId}
        name="destination"
        label={destinationLabel}
        options={destinationOptions}
        placeholder={destinationPlaceholder}
        required={required}
        value={destinationValue}
        onValueChange={onDestinationChange}
        className={fieldClassName}
      />
      </div>
    </div>
  );
}

export function TravelSearch({
  destinations,
  departures,
  transportOptions,
  tourTransportOptions,
  visaCountries,
  serviceType,
  onServiceTypeChange,
}: {
  destinations: Option[];
  departures: Option[];
  transportOptions: TransportSearchOptions;
  tourTransportOptions: TransportSearchOptions;
  visaCountries: Option[];
  serviceType: ServiceType;
  onServiceTypeChange: (serviceType: ServiceType) => void;
}) {
  const router = useRouter();
  const [searching, setSearching] = useState(false);
  const [routeOrigin, setRouteOrigin] = useState("");
  const [routeDestination, setRouteDestination] = useState("");
  const selectedTransportOptions =
    serviceType === "flight" || serviceType === "bus" || serviceType === "train"
      ? transportOptions[serviceType]
      : null;
  const tourRoutes = Object.values(tourTransportOptions);
  const transportOriginOptions = serviceType === "tour"
    ? Array.from(new Map([...departures, ...tourRoutes.flatMap((options) => options.origins)].map((option) => [option.value, option])).values())
    : selectedTransportOptions?.origins ?? departures;
  const matchingTransportDestinations = selectedTransportOptions && routeOrigin
    ? selectedTransportOptions.routes
        .filter((route) => route.origin === routeOrigin)
        .flatMap((route) => {
          const destination = selectedTransportOptions.destinations.find(
            (option) => option.value === route.destination,
          );
          return destination ? [destination] : [];
        })
    : [];
  const transportDestinationOptions = serviceType === "tour"
      ? Array.from(new Map(
          [
            ...tourRoutes.flatMap((options) => options.destinations),
            ...destinations,
          ].map((option) => [option.value, option]),
        ).values())
      : matchingTransportDestinations.length
        ? Array.from(new Map(
            matchingTransportDestinations.map((option) => [option.value, option]),
          ).values())
        : selectedTransportOptions
          ? selectedTransportOptions.destinations
          : destinations;

  function handleTransportOriginChange(value: string) {
    setRouteOrigin(value);

    if (
      serviceType !== "tour" &&
      selectedTransportOptions &&
      routeDestination &&
      !selectedTransportOptions.routes.some(
        (route) =>
          route.origin === value && route.destination === routeDestination,
      )
    ) {
      setRouteDestination("");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearching(true);

    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams();

    for (const key of [
      "hotelQuery",
      "visaType",
      "destination",
      "country",
      "departure",
      "departureFrom",
      "departureTo",
      "passengerCount",
      "adultCount",
      "childCount",
      "infantCount",
      "tripType",
      "compartmentType",
      "passengerCategory",
      "carTransport",
      "flightRouteMode",
      "multiCitySegments",
    ]) {
      const value = String(formData.get(key) || "").trim();

      if (value) {
        params.set(key, value);
      }
    }

    if (["flight", "train", "bus"].includes(serviceType) && params.get("tripType") === "one_way") {
      params.delete("departureTo");
    }

    if (["flight", "train", "bus"].includes(serviceType)) {
      params.set("showResults", "1");
      const destinationValue = params.get("destination");
      const destinationOption = transportDestinationOptions.find(
        (option) => option.value === destinationValue,
      );
      const originValue = params.get("departure");
      const originOption = transportOriginOptions.find(
        (option) => option.value === originValue,
      );

      if (destinationOption) {
        params.set("destination", destinationOption.label);
      }

      if (originValue) {
        params.set("origin", originOption?.label ?? originValue);
      }

      params.delete("departure");
    }

    const selectedService = serviceTabs.find((tab) => tab.key === serviceType);
    const route = selectedService?.route ?? "/tours/";

    if (serviceType !== "tour") {
      params.set("type", serviceType);
    }

    if (serviceType === "visa") params.set("showResults", "1");
    const query = params.toString();
    router.push(`${route}${query ? `?${query}` : ""}`);
  }

  return (
    <section
      aria-label="جستجوی سفر"
      className={styles.search}
    >
      <div
        className={styles.tabs}
        data-service-tabs
        role="group"
        aria-label="انتخاب نوع خدمت"
      >
        <div className={styles.tabRow}>
          {serviceTabs.map((tab) => {
            const selected = tab.key === serviceType;

            return (
              <button
                key={tab.key}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setRouteOrigin("");
                  setRouteDestination("");
                  onServiceTypeChange(tab.key);
                }}
                className={styles.tab}
              >
                <span className={styles.tabIcon} aria-hidden="true">
                  {tab.icon}
                </span>
                <span className={styles.tabLabel}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className={styles.body}>
        <form
          onSubmit={handleSubmit}
          className={`travel-search-form ${styles.form}`}
          data-service={serviceType}
        >
          {serviceType === "hotel" ? (
            <div className={styles.field} data-country-field>
              <LocationIcon className={styles.fieldIcon} />
              <input aria-label="نام شهر، هتل یا منطقه" name="hotelQuery" maxLength={180}
                placeholder="نام شهر، هتل یا منطقه" type="search"
                className="w-full min-h-10 min-w-0 rounded-xl border border-border bg-white ps-8 pe-3 text-sm text-brand placeholder:text-muted" />
            </div>
          ) : serviceType === "visa" ? (
            <div className={styles.field} data-country-field>
              <LocationIcon className={styles.fieldIcon} />
              <Select id={`${serviceType}-destination`} name="country" label="کشور مقصد"
                options={visaCountries}
                placeholder="انتخاب کشور مقصد" className={fieldClassName} searchable />
            </div>
          ) : (
            <RouteSelector originId={`${serviceType}-departure`} originLabel="مبدأ"
              originPlaceholder="انتخاب مبدأ"
              originValue={routeOrigin} destinationId={`${serviceType}-destination`} destinationLabel="مقصد"
              destinationPlaceholder="انتخاب مقصد"
              destinationValue={routeDestination} onOriginChange={handleTransportOriginChange}
              onDestinationChange={setRouteDestination} originOptions={transportOriginOptions}
              destinationOptions={transportDestinationOptions}
              required={serviceType === "flight"} />
          )}
          {serviceType === "visa" ? (
            <div className={styles.field}>
              <PassportIcon className={styles.fieldIcon} />
              <Select id="visa-type" name="visaType" label="نوع ویزا" placeholder="همه انواع ویزا"
                options={[
                  { value: "tourist", label: "گردشگری" }, { value: "business", label: "تجاری" },
                  { value: "exhibition", label: "نمایشگاهی" }, { value: "residency", label: "اقامتی" },
                  { value: "student", label: "دانشجویی" },
                ]} />
            </div>
          ) : <JalaliDateRangeInput key={serviceType} compact layout="hero"
            initialTripType={serviceType === "bus" ? "one_way" : "round_trip"}
            showTripType={["flight", "train", "bus"].includes(serviceType)}
            dateLabels={serviceType === "hotel"
              ? { departure: "تاریخ ورود", return: "تاریخ خروج", field: "تاریخ اقامت" }
              : serviceType === "tour"
                ? { departure: "از تاریخ", return: "تا تاریخ", field: "بازهٔ تاریخ حرکت" }
                : { departure: "تاریخ رفت", return: "تاریخ برگشت", field: "تاریخ سفر" }} />}
          <div className={styles.field} data-guests-field>
            <UsersIcon className={styles.fieldIcon} />
            <PassengerSelector tourAgeGroups={serviceType === "tour" || serviceType === "hotel"} label={serviceType === "visa" ? "تعداد متقاضیان" : "مسافران"} required={serviceType === "flight"} />
          </div>
          <div className={styles.submit}>
            <Button type="submit" loading={searching} className="search-action w-full">
              <SearchIcon className="size-4 shrink-0" />
              <span>جستجو</span>
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}
