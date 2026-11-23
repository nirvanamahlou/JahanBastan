import { CurrencySelect } from "@/components/admin/currency-select";
import type {
  HotelOption,
  TourCombinedPackage,
} from "@/types/editorial";

const field =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm";

const priceFields = [
  ["doublePrice", "doubleCurrency", "دوتخته (Double/Twin)"],
  ["singlePrice", "singleCurrency", "یک‌تخته (Single)"],
  ["childWithBedPrice", "childWithBedCurrency", "کودک با تخت (CWB)"],
  [
    "childWithoutBedPrice",
    "childWithoutBedCurrency",
    "کودک بدون تخت (CNB)",
  ],
  ["infantPrice", "infantCurrency", "نوزاد (INF)"],
] as const;

const flightTargets = [
  ["addFlightToDouble", "دوتخته"],
  ["addFlightToSingle", "یک‌تخته"],
  ["addFlightToChildWithBed", "کودک با تخت"],
  ["addFlightToChildWithoutBed", "کودک بدون تخت"],
  ["addFlightToInfant", "نوزاد"],
] as const;

function createCombinedPackage(index: number): TourCombinedPackage {
  return {
    title: `پکیج ترکیبی ${(index + 1).toLocaleString("fa-IR")}`,
    doublePrice: null,
    doubleCurrency: "IRT",
    singlePrice: null,
    singleCurrency: "IRT",
    childWithBedPrice: null,
    childWithBedCurrency: "IRT",
    childWithoutBedPrice: null,
    childWithoutBedCurrency: "IRT",
    infantPrice: null,
    infantCurrency: "IRT",
    regularFlightPrice: null,
    regularFlightCurrency: "IRT",
    childWithoutBedFlightPrice: null,
    childWithoutBedFlightCurrency: "IRT",
    addFlightToDouble: true,
    addFlightToSingle: true,
    addFlightToChildWithBed: true,
    addFlightToChildWithoutBed: true,
    addFlightToInfant: false,
    hotels: [],
  };
}

export function CombinedTourPackageFields({
  packages,
  hotels,
  onChange,
}: {
  packages: TourCombinedPackage[];
  hotels: HotelOption[];
  onChange: (packages: TourCombinedPackage[]) => void;
}) {
  const updatePackage = (
    packageIndex: number,
    changes: Partial<TourCombinedPackage>,
  ) =>
    onChange(
      packages.map((item, index) =>
        index === packageIndex ? { ...item, ...changes } : item,
      ),
    );

  return (
    <section className="overflow-hidden rounded-2xl border-2 border-violet-200 bg-gradient-to-b from-violet-50 via-white to-sky-50 shadow-[0_12px_32px_rgba(76,29,149,0.08)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-violet-100 bg-white/80 px-4 py-4">
        <div>
          <p className="text-xs font-black text-violet-600">اقامت چندمقصدی یا چندهتلی</p>
          <h3 className="mt-1 text-lg font-black text-brand">پکیج‌های هتل ترکیبی</h3>
          <p className="mt-1 text-xs leading-6 text-muted">
            برای هر ترکیب، هتل‌ها و تعداد شب، قیمت اقامت و نحوه اضافه‌شدن پرواز را مستقل ثبت کنید.
          </p>
        </div>
        <button
          className="rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-violet-800"
          onClick={() =>
            onChange([...packages, createCombinedPackage(packages.length)])
          }
          type="button"
        >
          + افزودن ترکیب جدید
        </button>
      </header>

      <div className="space-y-5 p-4">
        {packages.map((combinedPackage, packageIndex) => {
          const totalNights = combinedPackage.hotels.reduce(
            (total, hotel) => total + hotel.nights,
            0,
          );
          const selectedHotelIds = new Set(
            combinedPackage.hotels.map((hotel) => hotel.hotelId),
          );
          return (
            <article
              className="overflow-hidden rounded-2xl border-2 border-violet-200 bg-white shadow-sm"
              data-combined-package-card
              key={`combined-package-${packageIndex}`}
            >
              <div className="flex flex-wrap items-center gap-3 border-b border-violet-100 bg-gradient-to-l from-violet-100/80 to-sky-50 px-4 py-3">
                <span className="grid size-9 place-items-center rounded-xl bg-violet-700 text-sm font-black text-white">
                  {(packageIndex + 1).toLocaleString("fa-IR")}
                </span>
                <label className="min-w-52 flex-1 space-y-1 text-xs font-bold">
                  <span>عنوان ترکیب</span>
                  <input
                    aria-label={`عنوان ترکیب ${packageIndex + 1}`}
                    className={`${field} bg-white font-black text-brand`}
                    maxLength={160}
                    onChange={(event) =>
                      updatePackage(packageIndex, { title: event.target.value })
                    }
                    placeholder="مثلاً ۳ شب استانبول + ۴ شب آنتالیا"
                    value={combinedPackage.title}
                  />
                </label>
                <span className="rounded-full border border-violet-200 bg-white px-3 py-2 text-xs font-black text-violet-700">
                  {totalNights
                    ? `${totalNights.toLocaleString("fa-IR")} شب`
                    : "بدون هتل"}
                </span>
                <button
                  className="rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-50"
                  onClick={() =>
                    onChange(
                      packages.filter((_, index) => index !== packageIndex),
                    )
                  }
                  type="button"
                >
                  حذف این ترکیب
                </button>
              </div>

              <div className="space-y-5 p-4">
                <fieldset className="space-y-3 rounded-2xl border border-sky-200 bg-sky-50/70 p-3">
                  <legend className="px-2 text-sm font-black text-brand">
                    هتل‌های این ترکیب
                  </legend>
                  <div
                    aria-label={`انتخاب هتل‌های ${combinedPackage.title}`}
                    className="grid max-h-52 gap-2 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3"
                    role="group"
                  >
                    {hotels.map((hotel) => {
                      const checked = selectedHotelIds.has(hotel.id);
                      return (
                        <label
                          className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm transition ${checked ? "border-violet-400 bg-white shadow-sm" : "border-sky-100 bg-white/60 hover:border-violet-300"}`}
                          key={hotel.id}
                        >
                          <input
                            checked={checked}
                            className="mt-1 size-4 accent-violet-700"
                            onChange={(event) =>
                              updatePackage(packageIndex, {
                                hotels: event.target.checked
                                  ? [
                                      ...combinedPackage.hotels,
                                      {
                                        hotelId: hotel.id,
                                        nights: 1,
                                        boardType:
                                          hotel.serviceType ??
                                          hotel.serviceCategory ??
                                          null,
                                      },
                                    ]
                                  : combinedPackage.hotels.filter(
                                      (item) => item.hotelId !== hotel.id,
                                    ),
                              })
                            }
                            type="checkbox"
                          />
                          <span>
                            <strong className="block text-brand">{hotel.name}</strong>
                            <span className="mt-1 block text-xs text-muted">
                              {[hotel.city, hotel.region, `${hotel.starRating.toLocaleString("fa-IR")} ستاره`]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {combinedPackage.hotels.length ? (
                    <div className="grid gap-2 lg:grid-cols-2">
                      {combinedPackage.hotels.map((assignedHotel, hotelIndex) => {
                        const hotel = hotels.find(
                          (item) => item.id === assignedHotel.hotelId,
                        );
                        return (
                          <div
                            className="grid gap-2 rounded-xl border border-sky-200 bg-white p-3 sm:grid-cols-[1fr_7rem_9rem] sm:items-end"
                            key={assignedHotel.hotelId}
                          >
                            <div>
                              <span className="text-xs text-muted">هتل</span>
                              <strong className="mt-1 block text-sm text-brand">
                                {hotel?.name ?? `هتل ${assignedHotel.hotelId}`}
                              </strong>
                            </div>
                            <label className="space-y-1 text-xs font-bold">
                              <span>تعداد شب</span>
                              <input
                                className={field}
                                min={1}
                                onChange={(event) =>
                                  updatePackage(packageIndex, {
                                    hotels: combinedPackage.hotels.map(
                                      (item, index) =>
                                        index === hotelIndex
                                          ? {
                                              ...item,
                                              nights: Math.max(
                                                1,
                                                Number(event.target.value) || 1,
                                              ),
                                            }
                                          : item,
                                    ),
                                  })
                                }
                                type="number"
                                value={assignedHotel.nights}
                              />
                            </label>
                            <label className="space-y-1 text-xs font-bold">
                              <span>نوع خدمات</span>
                              <input
                                className={field}
                                onChange={(event) =>
                                  updatePackage(packageIndex, {
                                    hotels: combinedPackage.hotels.map(
                                      (item, index) =>
                                        index === hotelIndex
                                          ? {
                                              ...item,
                                              boardType:
                                                event.target.value || null,
                                            }
                                          : item,
                                    ),
                                  })
                                }
                                placeholder="UALL / BB"
                                value={assignedHotel.boardType ?? ""}
                              />
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="rounded-xl border border-dashed border-sky-300 bg-white/60 p-4 text-center text-xs text-muted">
                      از فهرست بالا، هتل‌های این ترکیب را انتخاب کنید.
                    </p>
                  )}
                </fieldset>

                <fieldset className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3">
                  <legend className="px-2 text-sm font-black text-emerald-800">
                    قیمت اقامت به تفکیک مسافر
                  </legend>
                  <p className="text-xs leading-6 text-emerald-900/75">
                    همه قیمت‌ها اختیاری‌اند و واحد پول هر رده مستقل انتخاب می‌شود.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    {priceFields.map(([priceKey, currencyKey, label]) => (
                      <div
                        className="space-y-2 rounded-xl border border-emerald-200 bg-white p-3"
                        key={priceKey}
                      >
                        <label className="space-y-1 text-xs font-bold">
                          <span>{label}</span>
                          <input
                            aria-label={`قیمت ${label}`}
                            className={field}
                            min={0}
                            onChange={(event) =>
                              updatePackage(packageIndex, {
                                [priceKey]: event.target.value || null,
                              })
                            }
                            placeholder="قیمت اقامت"
                            step="any"
                            type="number"
                            value={combinedPackage[priceKey] ?? ""}
                          />
                        </label>
                        <CurrencySelect
                          aria-label={`واحد پول ${label}`}
                          className={field}
                          onChange={(event) =>
                            updatePackage(packageIndex, {
                              [currencyKey]: event.target.value,
                            })
                          }
                          value={combinedPackage[currencyKey]}
                        />
                      </div>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-3">
                  <legend className="px-2 text-sm font-black text-amber-900">
                    هزینه جداگانه پرواز و اعمال هوشمند نرخ
                  </legend>
                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="grid gap-2 rounded-xl border border-amber-200 bg-white p-3 sm:grid-cols-[1fr_11rem]">
                      <label className="space-y-1 text-xs font-bold">
                        <span>هزینه پرواز عادی هر نفر</span>
                        <input
                          className={field}
                          min={0}
                          onChange={(event) =>
                            updatePackage(packageIndex, {
                              regularFlightPrice: event.target.value || null,
                            })
                          }
                          placeholder="مثلاً ۲۰٬۰۰۰٬۰۰۰"
                          step="any"
                          type="number"
                          value={combinedPackage.regularFlightPrice ?? ""}
                        />
                      </label>
                      <CurrencySelect
                        className={field}
                        label="واحد پول"
                        onChange={(event) =>
                          updatePackage(packageIndex, {
                            regularFlightCurrency: event.target.value,
                          })
                        }
                        value={combinedPackage.regularFlightCurrency}
                      />
                    </div>
                    <div className="grid gap-2 rounded-xl border border-amber-200 bg-white p-3 sm:grid-cols-[1fr_11rem]">
                      <label className="space-y-1 text-xs font-bold">
                        <span>هزینه پرواز کودک بدون تخت</span>
                        <input
                          className={field}
                          min={0}
                          onChange={(event) =>
                            updatePackage(packageIndex, {
                              childWithoutBedFlightPrice:
                                event.target.value || null,
                            })
                          }
                          placeholder="خالی = هزینه پرواز عادی"
                          step="any"
                          type="number"
                          value={
                            combinedPackage.childWithoutBedFlightPrice ?? ""
                          }
                        />
                      </label>
                      <CurrencySelect
                        className={field}
                        label="واحد پول"
                        onChange={(event) =>
                          updatePackage(packageIndex, {
                            childWithoutBedFlightCurrency: event.target.value,
                          })
                        }
                        value={combinedPackage.childWithoutBedFlightCurrency}
                      />
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-black text-amber-900">
                      هزینه پرواز به قیمت کدام رده‌ها اضافه شود؟
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                      {flightTargets.map(([key, label]) => (
                        <label
                          className="flex cursor-pointer items-center gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm font-bold transition has-[:checked]:border-amber-500 has-[:checked]:bg-amber-100"
                          key={key}
                        >
                          <input
                            checked={combinedPackage[key]}
                            className="size-4 accent-amber-600"
                            onChange={(event) =>
                              updatePackage(packageIndex, {
                                [key]: event.target.checked,
                              })
                            }
                            type="checkbox"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                </fieldset>
              </div>
            </article>
          );
        })}
        {!packages.length ? (
          <div className="rounded-2xl border-2 border-dashed border-violet-200 bg-white/70 p-7 text-center">
            <strong className="text-brand">هنوز ترکیبی ساخته نشده است.</strong>
            <p className="mt-2 text-xs leading-6 text-muted">
              با «افزودن ترکیب جدید» یک پکیج مثل ۳ شب هتل اول + ۴ شب هتل دوم بسازید.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
