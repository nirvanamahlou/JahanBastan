"use client";

import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { JalaliDateInput } from "@/components/admin/jalali-date-input";
import { SiteSelect } from "@/components/ui/site-select";
import type { PassengerCounts } from "@/lib/tour-passenger-counts";

type PassengerKind = "adult" | "child" | "infant";

function FlightDateInput({ defaultGregorian = false, ...props }: React.ComponentProps<typeof JalaliDateInput> & { defaultGregorian?: boolean }) {
  const [gregorian, setGregorian] = useState(defaultGregorian);
  if (!props.ariaLabel) return <JalaliDateInput {...props} />;
  return <div className="grid gap-2">
    <div role="group" aria-label={props.ariaLabel + " · نوع تقویم"} className="flex gap-2">
      {[false, true].map((mode) => <button key={String(mode)} type="button" aria-pressed={gregorian === mode} onClick={() => setGregorian(mode)} className="rounded-lg border border-border px-3 py-1 text-xs aria-pressed:bg-brand aria-pressed:text-white">{mode ? "میلادی" : "شمسی"}</button>)}
    </div>
    {gregorian ? <input type="date" dir="ltr" aria-label={props.ariaLabel} className={props.className} min={props.min} max={props.max} required={props.required} value={props.value ?? ""} onChange={(event) => props.onChange?.(event.target.value || null)} /> : <JalaliDateInput {...props} />}
  </div>;
}

type PassengerHistory = {
  id: number;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  firstNameEn: string | null;
  fatherName: string | null;
  lastNameEn: string | null;
  nationalCode: string | null;
  passportNumber: string | null;
  passportExpiryDate: string | null;
  email: string | null;
  gender: "male" | "female" | "unspecified";
  age: number | null;
  birthDate: string | null;
  phone: string | null;
  hasPet: boolean;
  petName: string | null;
  petType: string | null;
  petWeightKg: number | null;
  isDefault: boolean;
};

export type PassengerCheckoutData = {
  id?: number;
  passengerType: PassengerKind;
  firstName: string;
  lastName: string;
  firstNameEn: string;
  lastNameEn: string;
  fatherName: string;
  nationalCode: string;
  passportNumber: string;
  passportExpiryDate: string;
  email: string;
  gender: "male" | "female" | "unspecified";
  age: string;
  birthDate: string;
  phone: string;
  hasPet: boolean;
  petName: string;
  petType: string;
  petWeightKg: string;
};

const emptyPassenger = (passengerType: PassengerKind): PassengerCheckoutData => ({
  passengerType,
  firstName: "",
  lastName: "",
  firstNameEn: "",
  lastNameEn: "",
  fatherName: "",
  nationalCode: "",
  passportNumber: "",
  passportExpiryDate: "",
  email: "",
  gender: "unspecified",
  age: "",
  birthDate: "",
  phone: "",
  hasPet: false,
  petName: "",
  petType: "",
  petWeightKg: "",
});

function minimumPassportExpiryDate() {
  const value = new Date();
  value.setHours(12, 0, 0, 0);
  value.setMonth(value.getMonth() + 4);
  return value.toISOString().slice(0, 10);
}

function passportWarning(passenger: Pick<PassengerCheckoutData, "passportNumber" | "passportExpiryDate">, minimumExpiry: string, required: boolean) {
  if (required && !passenger.passportNumber.trim()) return "برای این سفر ثبت شماره گذرنامه الزامی است.";
  if (!passenger.passportNumber && !passenger.passportExpiryDate) return "";
  if (passenger.passportNumber && !passenger.passportExpiryDate) {
    return "برای شماره گذرنامه، تاریخ انقضای گذرنامه را وارد کنید.";
  }
  if (passenger.passportExpiryDate && passenger.passportExpiryDate < minimumExpiry) {
    return "تاریخ انقضای گذرنامه از حداقل تاریخ اعتبار این سفر زودتر است.";
  }
  return "";
}

function historyToForm(passenger: PassengerHistory, passengerType: PassengerKind): PassengerCheckoutData {
  return {
    id: passenger.id,
    passengerType,
    firstName: passenger.firstName ?? passenger.fullName.split(" ")[0] ?? "",
    lastName: passenger.lastName ?? passenger.fullName.split(" ").slice(1).join(" "),
    firstNameEn: (passenger.firstNameEn ?? "").toUpperCase(),
    fatherName: passenger.fatherName ?? "",
    lastNameEn: (passenger.lastNameEn ?? "").toUpperCase(),
    nationalCode: passenger.nationalCode ?? "",
    passportNumber: passenger.passportNumber ?? "",
    passportExpiryDate: passenger.passportExpiryDate ?? "",
    email: passenger.email ?? "",
    gender: passenger.gender,
    age: passenger.age === null ? "" : String(passenger.age),
    birthDate: passenger.birthDate ?? "",
    phone: passenger.phone ?? "",
    hasPet: passenger.hasPet,
    petName: passenger.petName ?? "",
    petType: passenger.petType ?? "",
    petWeightKg: passenger.petWeightKg === null ? "" : String(passenger.petWeightKg),
  };
}


type ApiErrorBody = { detail?: string | Array<{ msg?: string; loc?: Array<string | number> }> };

function passengerApiError(body: ApiErrorBody | null, status: number): string {
  if (typeof body?.detail === "string") {
    if (body.detail === "authentication required") return "برای ذخیره اطلاعات در حساب، ابتدا وارد شوید.";
    if (body.detail.includes("national code already exists")) return "مسافری با این کد ملی قبلاً ذخیره شده است؛ از تاریخچه انتخابش کنید.";
    return body.detail;
  }
  if (Array.isArray(body?.detail)) {
    return body.detail.map((item) => item.msg).filter(Boolean).join("، ") || "اطلاعات یکی از فیلدها معتبر نیست.";
  }
  return status >= 500 ? "سرویس ذخیره اطلاعات مسافر موقتاً در دسترس نیست." : "ذخیره اطلاعات مسافر انجام نشد.";
}
export type FlightBuyerContact = {
  fullName: string;
  buyerMobile: string;
  address: string;
  landline: string;
  postalCode: string;
};

type PassengerCheckoutModalProps = {
  initialPassengers?: PassengerCheckoutData[];
  buyerContact?: FlightBuyerContact;
  onBuyerContactChange?: (contact: FlightBuyerContact) => void;
  saveBuyerContact?: () => Promise<void>;
  checkFlightCapacity?: (birthDates: string[]) => Promise<void>;
  inline?: boolean;
  open: boolean;
  onClose: () => void;
  onComplete: (passengers: PassengerCheckoutData[]) => void;
  availableSeats?: number | null;
  requiresPassport?: boolean;
  lastTravelDay?: string | null;
  fixedPassengerCounts?: PassengerCounts | null;
  context?: "flight";
};

function passengerKinds(counts: PassengerCounts): PassengerKind[] {
  return [
    ...Array.from({ length: counts.adults }, () => "adult" as const),
    ...Array.from({ length: counts.children }, () => "child" as const),
    ...Array.from({ length: counts.infants }, () => "infant" as const),
  ];
}

export function PassengerCheckoutModal({
  initialPassengers,
  inline = false,
  open,
  onClose,
  onComplete,
  availableSeats = null,
  requiresPassport = false,
  lastTravelDay,
  fixedPassengerCounts,
  context,
  buyerContact,
  onBuyerContactChange,
  saveBuyerContact,
  checkFlightCapacity,
}: PassengerCheckoutModalProps) {
const subscribeToHydration = () => () => undefined;

  const fixedAdults = fixedPassengerCounts?.adults ?? 0;
  const fixedChildren = fixedPassengerCounts?.children ?? 0;
  const fixedInfants = fixedPassengerCounts?.infants ?? 0;
  const hasFixedPassengerCounts = fixedAdults + fixedChildren + fixedInfants > 0;

  const [step, setStep] = useState<"count" | "details">("count");
  const [counts, setCounts] = useState({ adults: 1, children: 0, infants: 0 });
  const [passengers, setPassengers] = useState<PassengerCheckoutData[]>([
    emptyPassenger("adult"),
  ]);
  const [history, setHistory] = useState<PassengerHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [errors, setErrors] = useState<Record<number, string>>({});
  const mounted = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const closeFromKeyboard = useEffectEvent(() => onClose());

  const total = counts.adults + counts.children + counts.infants;
  const DateInput = context === "flight" ? FlightDateInput : JalaliDateInput;
  const seatsUsed = counts.adults + counts.children;
  const seatsFull = availableSeats !== null && seatsUsed >= availableSeats;
  const tooManySeats = availableSeats !== null && seatsUsed > availableSeats;
  const minimumValidity = minimumPassportExpiryDate();
  const minimumExpiry = lastTravelDay && lastTravelDay > minimumValidity ? lastTravelDay : minimumValidity;

  useEffect(() => {
    if (!open) return;
    let active = true;
    const resetTimer = window.setTimeout(() => {
      const nextCounts = hasFixedPassengerCounts
        ? { adults: fixedAdults, children: fixedChildren, infants: fixedInfants }
        : { adults: 1, children: 0, infants: 0 };
      setStep(hasFixedPassengerCounts ? "details" : "count");
      setCounts(nextCounts);
      setPassengers(initialPassengers?.length ? initialPassengers.map(person => ({ ...person })) : passengerKinds(nextCounts).map(emptyPassenger));
      setErrors({});
      setNotice("");
      setHistoryLoading(true);
    }, 0);
    fetch("/api/customer-passengers", {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (response) => (response.ok ? (await response.json()) as PassengerHistory[] : []))
      .then((items) => { if (active) setHistory(items); })
      .catch(() => {
        if (!active) return;
        setHistory([]);
        setNotice("تاریخچه مسافران از سرور دریافت نشد. اطلاعات حساس در مرورگر ذخیره نمی‌شود؛ اتصال خود را بررسی کنید.");
      })
      .finally(() => { if (active) setHistoryLoading(false); });
    return () => {
      active = false;
      window.clearTimeout(resetTimer);
    };
  }, [fixedAdults, fixedChildren, fixedInfants, hasFixedPassengerCounts, initialPassengers, open]);

  useEffect(() => {
    if (!open || inline) return;

    const previousOverflow = document.body.style.overflow;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => dialogRef.current?.focus(), 0);
    const handleDialogKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeFromKeyboard();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleDialogKeyboard);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleDialogKeyboard);
      previousFocusRef.current?.focus();
    };
  }, [inline, open]);

  if (!open || !mounted) return null;

  function updateCount(key: "adults" | "children" | "infants", delta: number) {
    setCounts((current) => {
      const minimum = key === "adults" ? 1 : 0;
      const next = Math.max(minimum, Math.min(20, current[key] + delta));
      const nextTotal = current.adults + current.children + current.infants + next - current[key];
      if (nextTotal > 20 || (delta > 0 && key !== "infants" && seatsFull)) return current;
      return { ...current, [key]: next };
    });
  }

  function continueToDetails() {
    if (tooManySeats) return;
    const nextKinds = passengerKinds(counts);
    setPassengers(nextKinds.map((kind, index) => passengers[index]?.passengerType === kind ? passengers[index] : emptyPassenger(kind)));
    setStep("details");
    setNotice("");
  }

  function updatePassenger(index: number, key: keyof PassengerCheckoutData, value: string | boolean) {
    setPassengers((current) => current.map((passenger, passengerIndex) => (
      passengerIndex === index ? { ...passenger, [key]: value } : passenger
    )));
    setErrors((current) => ({ ...current, [index]: "" }));
  }

  function chooseHistory(index: number, value: string | boolean) {
    if (!value) {
      const passengerType = passengers[index]?.passengerType ?? "adult";
      setPassengers((current) => current.map((passenger, passengerIndex) => passengerIndex === index ? emptyPassenger(passengerType) : passenger));
      return;
    }
    const selected = history.find((item) => item.id === Number(value));
    if (!selected) return;
    const selectedForm = historyToForm(selected, passengers[index]?.passengerType ?? "adult");
    const warning = passportWarning(selectedForm, minimumExpiry, requiresPassport);
    if (warning) {
      setNotice(selected.fullName + ": " + warning + " برای ادامه اطلاعات پاسپورت جدید را وارد کنید.");
      setErrors((current) => ({ ...current, [index]: warning }));
      return;
    }
    setPassengers((current) => current.map((passenger, passengerIndex) => passengerIndex === index ? selectedForm : passenger));
    setErrors((current) => ({ ...current, [index]: "" }));
    setNotice("");
  }

  function validate() {
    const nextErrors: Record<number, string> = {};
    passengers.forEach((passenger, index) => {
      if (!passenger.firstName.trim() || !passenger.lastName.trim()) {
        nextErrors[index] = "نام و نام خانوادگی فارسی الزامی است.";
        return;
      }
      if (!passenger.birthDate) {
        nextErrors[index] = "تاریخ تولد مسافر الزامی است.";
        return;
      }
      if (passenger.gender === "unspecified") {
        nextErrors[index] = "جنسیت مسافر را انتخاب کنید.";
        return;
      }
      if (!passenger.nationalCode.trim() && !passenger.passportNumber.trim()) {
        nextErrors[index] = "حداقل کد ملی یا شماره گذرنامه الزامی است.";
        return;
      }
      if (passenger.passportNumber && (!passenger.firstNameEn.trim() || !passenger.lastNameEn.trim())) {
        nextErrors[index] = "برای مسافر دارای گذرنامه، نام و نام خانوادگی انگلیسی الزامی است.";
        return;
      }
      const warning = passportWarning(passenger, minimumExpiry, requiresPassport);
      if (warning) {
        nextErrors[index] = warning;
        return;
      }
      if (passenger.hasPet && (!passenger.petType.trim() || !passenger.petWeightKg)) {
        nextErrors[index] = "نوع و وزن حیوان خانگی را وارد کنید.";
      }
    });
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function saveAndContinue() {
    if (tooManySeats || (availableSeats !== null && passengers.filter(person => person.passengerType !== "infant").length > availableSeats)) {
      setNotice("تعداد بزرگسالان و کودکان از ظرفیت پرواز بیشتر است.");
      return;
    }
    if (buyerContact && (buyerContact.fullName.trim().length < 2 || !buyerContact.buyerMobile.trim() || !buyerContact.address.trim())) {
      setNotice("نام کامل، شماره همراه و نشانی خریدار را وارد کنید.");
      return;
    }
    if (!validate()) {
      setNotice("اطلاعات مسافران را کامل کنید. پاسپورت منقضی یا با اعتبار کمتر از چهار ماه قابل ثبت نیست.");
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      await checkFlightCapacity?.(passengers.map(person => person.birthDate));
      await saveBuyerContact?.();
      const saved: PassengerCheckoutData[] = [];
      for (const passenger of passengers) {
        let current = passenger;
        if (!current.id) {
          let response: Response | null = null;
          try {
            response = await fetch("/api/customer-passengers", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
              firstName: current.firstName,
              lastName: current.lastName,
              fullName: `${current.firstName} ${current.lastName}`.trim(),
              firstNameEn: current.firstNameEn || null,
              fatherName: current.fatherName || null,
              lastNameEn: current.lastNameEn || null,
              nationalCode: current.nationalCode || null,
              passportNumber: current.passportNumber || null,
              passportExpiryDate: current.passportExpiryDate || null,
              email: current.email || null,
              gender: current.gender,
              age: current.age ? Number(current.age) : null,
              birthDate: current.birthDate || null,
              phone: current.phone || null,
              hasPet: current.hasPet,
              petName: current.hasPet ? current.petName || null : null,
              petType: current.hasPet ? current.petType || null : null,
              petWeightKg: current.hasPet && current.petWeightKg ? Number(current.petWeightKg) : null,
              isDefault: false,
              }),
            });
          } catch {
            response = null;
          }
          if (!response) {
            throw new Error("ارتباط با سرور برقرار نشد. اطلاعات مسافر ذخیره نشده است؛ اتصال را بررسی و دوباره تلاش کنید.");
          } else if (response.status === 409 && current.nationalCode) {
            const existingResponse = await fetch("/api/customer-passengers", { credentials: "include", cache: "no-store" }).catch(() => null);
            const existingItems = existingResponse?.ok ? await existingResponse.json() as PassengerHistory[] : [];
            const existing = existingItems.find((item) => item.nationalCode === current.nationalCode);
            if (!existing) {
              const body = await response.json().catch(() => null) as ApiErrorBody | null;
              throw new Error(passengerApiError(body, response.status));
            }
            current = { ...current, id: existing.id };
          } else {
            const body = await response.json().catch(() => null) as PassengerHistory | ApiErrorBody | null;
            if (!response.ok) throw new Error(passengerApiError(body as ApiErrorBody | null, response.status));
            current = { ...current, id: (body as PassengerHistory).id };
          }
        }
        saved.push(current);
      }
      onComplete(saved);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "ذخیره اطلاعات مسافران انجام نشد.");
    } finally {
      setBusy(false);
    }
  }

  const passengerTypeLabel = (kind: PassengerKind) => kind === "adult" ? "بزرگسال" : kind === "child" ? "کودک" : "نوزاد";
  const fieldStatus = (key: keyof PassengerCheckoutData) => {
    if (requiresPassport && ["passportNumber", "firstNameEn", "lastNameEn"].includes(key)) return { label: "الزامی", required: true };
    if (key === "firstName" || key === "lastName") return { label: "الزامی", required: true };
    if (key === "firstNameEn" || key === "lastNameEn") return { label: "با ثبت گذرنامه الزامی", required: false };
    if (key === "nationalCode" || key === "passportNumber") return { label: "یکی از این دو الزامی", required: false };
    return { label: "اختیاری", required: false };
  };

  const content = (
      <section
        ref={dialogRef}
        aria-labelledby="passenger-checkout-title"
        aria-modal={inline ? undefined : true}
        className={inline ? "w-full rounded-xl border border-border bg-background" : "my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl overflow-x-hidden overflow-y-auto rounded-[2rem] border-2 border-white/80 bg-background shadow-[0_32px_100px_rgba(1,37,105,0.42)] sm:max-h-[calc(100dvh-3rem)]"}
        role={inline ? undefined : "dialog"}
        tabIndex={-1}
      >
        <header className={`flex items-start justify-between gap-4 border-b border-border ${inline ? "px-3 py-2.5 sm:px-4" : "sticky top-0 z-10 bg-background/95 px-5 py-4 backdrop-blur sm:px-7"}`}>
          <div>
            <p className="text-xs font-black text-accent-strong">{context === "flight" ? "ثبت درخواست بلیت هواپیما" : "تکمیل خرید بلیط و هتل"}</p>
            <h2 className={`mt-1 font-black text-brand ${inline ? "text-base sm:text-lg" : "text-xl sm:text-2xl"}`} id="passenger-checkout-title">
              {step === "count" ? "تعداد مسافران را مشخص کنید" : "اطلاعات مسافران"}
            </h2>
          </div>
          {!inline && <button aria-label="بستن" className="grid size-10 shrink-0 place-items-center rounded-full border border-border text-xl text-brand hover:bg-surface-muted" onClick={onClose} type="button">×</button>}
        </header>

        <div className={inline ? "space-y-3 p-3 sm:p-4" : "space-y-5 p-5 sm:p-7"}>
          {seatsFull && <p role="status" className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-950">
            {tooManySeats ? "تعداد بزرگسالان و کودکان را کاهش دهید." : "همهٔ صندلی‌های موجود این پرواز انتخاب شده‌اند."}
            {" "}ظرفیت پرواز {availableSeats?.toLocaleString("fa-IR")} صندلی است.
          </p>}
          {step === "count" ? (
            <>
              <div className="rounded-2xl border border-brand/15 bg-brand/5 p-4 text-sm leading-7 text-brand">
                تعداد مسافران را انتخاب کنید. حداقل یک بزرگسال لازم است و مجموع مسافران حداکثر ۲۰ نفر است.
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {([
                  ["adults", "بزرگسال", "۱۲ سال به بالا"],
                  ["children", "کودک", "۲ تا ۱۱ سال"],
                  ["infants", "نوزاد", "زیر ۲ سال"],
                ] as const).map(([key, label, hint]) => (
                  <div className="rounded-2xl border border-border bg-white p-4" key={key}>
                    <p className="font-black text-brand">{label}</p>
                    <p className="mt-1 text-xs text-muted">{hint}</p>
                    <div className="mt-4 flex items-center justify-between rounded-xl bg-surface-muted p-2">
                      <button aria-label={"کاهش " + label} className="grid size-9 place-items-center rounded-lg bg-white text-lg font-black text-brand disabled:opacity-35" disabled={counts[key] <= (key === "adults" ? 1 : 0)} onClick={() => updateCount(key, -1)} type="button">−</button>
                      <output aria-live="polite" className="font-black text-brand">{counts[key].toLocaleString("fa-IR")}</output>
                      <button aria-label={"افزایش " + label} className="grid size-9 place-items-center rounded-lg bg-white text-lg font-black text-brand" disabled={key !== "infants" && seatsFull} onClick={() => updateCount(key, 1)} type="button">+</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand px-4 py-3 text-sm font-black text-white">
                <span>مجموع مسافران: {total.toLocaleString("fa-IR")} نفر</span>
                <button className="min-h-11 rounded-xl bg-accent-strong px-5 text-sm font-black text-white hover:bg-accent-strong/90" disabled={tooManySeats} onClick={continueToDetails} type="button">ادامه و ورود اطلاعات</button>
              </div>
            </>
          ) : (
            <>
              {buyerContact && onBuyerContactChange && (
                <fieldset className={`grid min-w-0 border border-border bg-white ${inline ? "gap-2.5 rounded-xl p-3 sm:grid-cols-2 lg:grid-cols-5" : "grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] gap-4 rounded-2xl p-4"}`}>
                  <legend className={`px-2 font-black text-brand ${inline ? "text-sm" : ""}`}>اطلاعات خریدار</legend>
                  {([
                    ["fullName", "نام کامل خریدار", "text", 120, true],
                    ["buyerMobile", "شماره همراه خریدار", "tel", 32, true],
                    ["address", "نشانی", "text", 1000, true],
                    ["landline", "تلفن ثابت (اختیاری)", "tel", 32, false],
                    ["postalCode", "کد پستی (اختیاری)", "text", 20, false],
                  ] as const).map(([key, label, type, maxLength, required]) => (
                    <label key={key} className={`min-w-0 font-bold text-brand ${inline ? "flex flex-col justify-between gap-1 text-xs" : "grid gap-1.5 text-sm"}`}>
                      {label}
                      <input type={type} dir={key === "postalCode" || type === "tel" ? "ltr" : undefined}
                        inputMode={key === "postalCode" ? "numeric" : undefined}
                        required={required} disabled={busy} maxLength={maxLength} value={buyerContact[key]}
                        onChange={(event) => onBuyerContactChange({ ...buyerContact, [key]: event.target.value })}
                        className={`min-h-11 w-full min-w-0 border border-border bg-surface-muted/60 font-normal focus-visible:outline-2 focus-visible:outline-brand ${inline ? "rounded-lg px-2.5 lg:min-h-10" : "rounded-xl px-3"}`} />
                    </label>
                  ))}
                </fieldset>
              )}
              {hasFixedPassengerCounts && context !== "flight" ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-7 text-emerald-950">
                  تعداد مسافران از انتخاب اتاق‌های تور ثبت شده است و نیازی به انتخاب دوباره ندارد:
                  <strong className="mr-1">
                    {fixedAdults.toLocaleString("fa-IR")} بزرگسال
                    {fixedChildren ? ` · ${fixedChildren.toLocaleString("fa-IR")} کودک` : ""}
                    {fixedInfants ? ` · ${fixedInfants.toLocaleString("fa-IR")} نوزاد` : ""}
                  </strong>
                </div>
              ) : null}
              <div className={`border border-amber-200 bg-amber-50 text-sm text-amber-950 ${inline ? "rounded-xl px-3 py-2 leading-relaxed" : "rounded-2xl p-4 leading-7"}`}>
                {requiresPassport ? "برای این سفر گذرنامهٔ معتبر الزامی است." : "در صورت ثبت گذرنامه، اعتبار آن بررسی می‌شود."}
                {" "}تاریخ انقضای گذرنامه باید {new Intl.DateTimeFormat("fa-IR-u-ca-persian", { dateStyle: "medium" }).format(new Date(minimumExpiry + "T12:00:00"))} یا بعد از آن باشد.
              </div>
              <div className={inline ? "space-y-3" : "space-y-4"}>
                {passengers.map((passenger, index) => (
                  <article className={`border border-border bg-white ${inline ? "rounded-xl p-3" : "rounded-2xl p-4 sm:p-5"}`} key={index}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="font-black text-brand">مسافر {index + 1} · {passengerTypeLabel(passenger.passengerType)}</h3>
                      {context === "flight" && <button type="button" disabled={busy || (passenger.passengerType === "adult" && (counts.adults <= 1 || counts.adults <= counts.infants))}
                        className="text-sm text-brand disabled:opacity-50" onClick={() => {
                          const group = { adult: "adults", child: "children", infant: "infants" }[passenger.passengerType] as keyof PassengerCounts;
                          setPassengers(current => current.filter((_, i) => i !== index));
                          setCounts(current => ({ ...current, [group]: current[group] - 1 }));
                          setErrors({});
                        }}>حذف مسافر</button>}
                      {historyLoading ? <span className="text-xs text-muted">در حال دریافت مسافران ثبت‌شده…</span> : history.length ? (
                        <fieldset className="w-full">
                          <legend className="sr-only">انتخاب از مسافران ثبت‌شده</legend>
                          <div className="max-h-48 w-full space-y-2 overflow-y-auto rounded-xl border border-brand/15 bg-surface-muted p-2" role="group" aria-label={`انتخاب مسافر ثبت‌شده برای مسافر ${index + 1}`}>
                            {history.map((item) => {
                              const selected = passenger.id === item.id;
                              const selectedElsewhere = passengers.some((otherPassenger, otherIndex) => otherIndex !== index && otherPassenger.id === item.id);
                              const passportIssue = passportWarning(historyToForm(item, passenger.passengerType), minimumExpiry, requiresPassport);
                              const unavailable = Boolean(selectedElsewhere || (passportIssue && !selected));
                              return (
                                <label className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs transition ${selected ? "border-brand bg-white text-brand" : "border-transparent text-foreground hover:border-brand/25 hover:bg-white"} ${unavailable ? "cursor-not-allowed opacity-50" : ""}`} key={item.id}>
                                  <input
                                    aria-label={`انتخاب ${item.fullName}`}
                                    checked={selected}
                                    disabled={unavailable}
                                    onChange={(event) => chooseHistory(index, event.target.checked ? String(item.id) : "")}
                                    type="checkbox"
                                  />
                                  <span className="min-w-0 flex-1 truncate font-bold">{item.fullName}{item.isDefault ? " · پیش‌فرض" : ""}</span>
                                  <span className="shrink-0 text-[11px] text-muted">{selectedElsewhere ? "برای مسافر دیگر انتخاب شده" : passportIssue ? "نیازمند پاسپورت جدید" : "انتخاب"}</span>
                                </label>
                              );
                            })}
                          </div>
                        </fieldset>
                      ) : null}
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {([
                        ["firstName", "نام", "text"],
                        ["lastName", "نام خانوادگی", "text"],
                        ["firstNameEn", "نام انگلیسی مطابق گذرنامه", "text"],
                        ["fatherName", "نام پدر", "text"],
                        ["lastNameEn", "نام خانوادگی انگلیسی مطابق گذرنامه", "text"],
                        ["nationalCode", "کد ملی", "text"],
                        ["passportNumber", "شماره گذرنامه", "text"],

                        ["email", "ایمیل", "email"],
                        ["phone", "شماره موبایل", "tel"],
                        ["age", "سن", "number"],
                      ] as const).map(([key, label, type]) => (
                        <label className="grid gap-1.5 text-sm font-bold text-brand" key={key}>
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span>{label}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${fieldStatus(key).required ? "bg-red-50 text-red-700" : "bg-surface-muted text-muted"}`}>
                              {fieldStatus(key).label}
                            </span>
                          </span>
                          <input
                            className="min-h-11 rounded-xl border border-border bg-white px-3 text-sm font-normal outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
                            dir={key.includes("En") || key.includes("passport") || key === "email" || key === "phone" ? "ltr" : "rtl"}
                            autoCapitalize={key === "firstNameEn" || key === "lastNameEn" ? "characters" : undefined}
                            onChange={(event) => {
                              const input = event.currentTarget;
                              const value = input.value;
                              if (key !== "firstNameEn" && key !== "lastNameEn") {
                                updatePassenger(index, key, value);
                                return;
                              }
                              const uppercase = value.toUpperCase();
                              if (uppercase !== value) {
                                const { selectionStart, selectionEnd, selectionDirection } = input;
                                input.value = uppercase;
                                if (selectionStart !== null && selectionEnd !== null) {
                                  input.setSelectionRange(value.slice(0, selectionStart).toUpperCase().length, value.slice(0, selectionEnd).toUpperCase().length, selectionDirection ?? undefined);
                                }
                              }
                              updatePassenger(index, key, uppercase);
                            }}
                            required={
                              (requiresPassport && ["passportNumber", "firstNameEn", "lastNameEn"].includes(key)) ||
                              key === "firstName" ||
                              key === "lastName" ||
                              ((key === "firstNameEn" || key === "lastNameEn") && Boolean(passenger.passportNumber))
                            }
                            type={type}
                            value={passenger[key]}
                          />
                        </label>
                      ))}
                      <label className="grid gap-1.5 text-sm font-bold text-brand">
                        <span className="flex flex-wrap items-center gap-1.5"><span>تاریخ انقضای گذرنامه</span><span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-black text-muted">{requiresPassport ? "الزامی" : "با ثبت گذرنامه الزامی"}</span></span>
                        <DateInput
                          {...(context === "flight" ? { defaultGregorian: true } : {})}
                          ariaLabel={`تاریخ انقضای گذرنامه مسافر ${index + 1}`}
                          className="min-h-11 w-full rounded-xl border border-border bg-white px-3 text-sm font-normal outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
                          min={minimumExpiry}
                          onChange={(value) => updatePassenger(index, "passportExpiryDate", value ?? "")}
                          required={requiresPassport || Boolean(passenger.passportNumber)}
                          value={passenger.passportExpiryDate || null}
                        />
                      </label>
                      <label className="grid gap-1.5 text-sm font-bold text-brand">
                        <span className="flex flex-wrap items-center gap-1.5"><span>تاریخ تولد</span><span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-black text-red-700">الزامی</span></span>
                        <DateInput
                          ariaLabel={`تاریخ تولد مسافر ${index + 1}`}
                          yearSelection
                          className="min-h-11 w-full rounded-xl border border-border bg-white px-3 text-sm font-normal outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
                          max={new Date().toISOString().slice(0, 10)}
                          onChange={(value) => updatePassenger(index, "birthDate", value ?? "")}
                          required
                          value={passenger.birthDate || null}
                        />
                      </label>
                      <label className="grid gap-1.5 text-sm font-bold text-brand">
                        <span className="flex flex-wrap items-center gap-1.5"><span>جنسیت</span><span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-black text-red-700">الزامی</span></span>
                        <SiteSelect ariaLabel={`جنسیت مسافر ${index + 1}`} id={`checkout-passenger-gender-${index}`} onValueChange={(nextValue) => updatePassenger(index, "gender", nextValue as PassengerCheckoutData["gender"])} options={[{ label: "انتخاب نشده", value: "unspecified" }, { label: "مرد", value: "male" }, { label: "زن", value: "female" }]} required value={passenger.gender} />
                      </label>
                      <fieldset className="grid gap-3 rounded-xl border border-border bg-surface-muted/40 p-3 md:col-span-2">
                        <label className="flex min-h-11 items-center gap-2 text-sm font-bold text-brand">
                          <input checked={passenger.hasPet} onChange={(event) => updatePassenger(index, "hasPet", event.target.checked)} type="checkbox" />
                          همراه داشتن حیوان خانگی
                        </label>
                        {passenger.hasPet ? (
                          <div className="grid gap-3 md:grid-cols-3">
                            <label className="grid gap-1.5 text-sm font-bold text-brand"><span className="flex flex-wrap items-center gap-1.5"><span>نام حیوان</span><span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-black text-muted">اختیاری</span></span><input className="min-h-11 rounded-xl border border-border bg-white px-3 font-normal" onChange={(event) => updatePassenger(index, "petName", event.target.value)} value={passenger.petName} /></label>
                            <label className="grid gap-1.5 text-sm font-bold text-brand"><span className="flex flex-wrap items-center gap-1.5"><span>نوع حیوان</span><span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-black text-red-700">الزامی در صورت همراهی</span></span><input className="min-h-11 rounded-xl border border-border bg-white px-3 font-normal" onChange={(event) => updatePassenger(index, "petType", event.target.value)} placeholder="مثلاً گربه" required value={passenger.petType} /></label>
                            <label className="grid gap-1.5 text-sm font-bold text-brand"><span className="flex flex-wrap items-center gap-1.5"><span>وزن (کیلوگرم)</span><span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-black text-red-700">الزامی در صورت همراهی</span></span><input className="min-h-11 rounded-xl border border-border bg-white px-3 font-normal" max="100" min="0.1" onChange={(event) => updatePassenger(index, "petWeightKg", event.target.value)} required step="0.1" type="number" value={passenger.petWeightKg} /></label>
                          </div>
                        ) : null}
                      </fieldset>
                    </div>
                    {errors[index] ? <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-800" role="alert">{errors[index]}</p> : null}
                  </article>
                ))}
              </div>
              {notice ? <p className="rounded-xl bg-brand/10 px-4 py-3 text-sm font-bold text-brand" role="status" aria-live="polite" aria-atomic="true">{notice}</p> : null}
              <div className={`flex flex-wrap items-center gap-3 ${hasFixedPassengerCounts ? "justify-end" : "justify-between"}`}>
                {context === "flight" && <div className="flex flex-wrap gap-2" role="group" aria-label="افزودن مسافر">
                  {([["adult", "adults"], ["child", "children"], ["infant", "infants"]] as const).map(([kind, group]) => (
                    <button key={kind} className="min-h-11 rounded-xl border border-brand/30 px-3 font-bold text-brand disabled:opacity-50" type="button"
                      disabled={busy || passengers.length >= 30 || (kind === "infant" ? counts.infants >= counts.adults : seatsFull)}
                      onClick={() => {
                        setPassengers(current => [...current, emptyPassenger(kind)]);
                        setCounts(current => ({ ...current, [group]: current[group] + 1 }));
                      }}>＋ {passengerTypeLabel(kind)}</button>
                  ))}
                </div>}
                {!hasFixedPassengerCounts ? <button className="min-h-11 rounded-xl border border-border px-5 text-sm font-black text-brand hover:bg-surface-muted" onClick={() => setStep("count")} type="button">بازگشت به تعداد مسافران</button> : null}
                <button className="min-h-11 rounded-xl bg-brand px-6 text-sm font-black text-white hover:bg-brand/90 disabled:opacity-60" disabled={busy || tooManySeats} onClick={() => void saveAndContinue()} type="button">{busy ? "در حال ذخیره اطلاعات…" : inline ? "ذخیره اطلاعات مسافران" : "ثبت اطلاعات و ادامه خرید"}</button>
              </div>
            </>
          )}
        </div>
      </section>
  );
  if (inline) return content;
  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center overflow-y-auto overscroll-contain bg-[#061b4d]/70 p-3 backdrop-blur-sm sm:p-6"
      dir="rtl"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {content}
    </div>,
    document.body,
  );
}
