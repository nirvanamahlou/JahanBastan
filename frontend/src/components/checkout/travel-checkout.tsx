"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { JalaliDateInput } from "@/components/admin/jalali-date-input";
import {
  PassengerCheckoutData,
  PassengerCheckoutModal,
} from "@/components/passenger-checkout-modal";
import { SiteSelect } from "@/components/ui/site-select";
import { PUBLIC_API_BASE_URL } from "@/lib/api/client";
import { formatCurrency } from "@/lib/currency";
import { formatPersianDate } from "@/lib/persian-date";
import { ErpFlightOrders, FlightCartDetails, type FlightCartOrder } from "@/components/content/erp-flight-orders";
import { notifyCartUpdated, readGuestCart, removeGuestCartIntents, type GuestCartIntent } from "@/lib/guest-cart";
import { getTourPassengerCounts } from "@/lib/tour-passenger-counts";
import { toToman, type ExchangeRates } from "@/lib/currency-conversion";

type CartItem = {
  id: number;
  itemType: "tour" | "flight" | "train" | "bus";
  titleSnapshot: string;
  detailsSnapshot: string | null;
  priceAmount: string | null;
  currency: string | null;
  hotelAmount: string | null;
  hotelCurrency: string | null;
  flightAmount: string | null;
  flightCurrency: string | null;
  imageId: number | null;
  status: "active" | "price_changed" | "availability_check_required" | "unavailable" | "expired" | string;
  priceCheckedAt: string | null;
  expiresAt: string | null;
  currentPriceAmount: string | null;
  currentCurrency: string | null;
  currentHotelAmount: string | null;
  currentHotelCurrency: string | null;
  currentFlightAmount: string | null;
  currentFlightCurrency: string | null;
  roomSelection: Record<string, number>;
};

type Requirement = {
  id: number;
  title: string;
  description: string | null;
  category: string;
  appliesTo: string;
  isRequired: boolean;
  maxBytes: number;
  allowedExtensions: string[];
};

type Configuration = {
  cashEnabled: boolean;
  installmentEnabled: boolean;
  minDownPaymentPercent: string;
  defaultDownPaymentPercent: string;
  allowedMonths: number[];
  monthlyFeeRate: string;
  maxCreditAmount: string;
  usdToIrt: string;
  eurToIrt: string;
  termsVersion: string;
  documentRequirements: Requirement[];
};

type Booking = {
  id: number;
  bookingNumber: string;
  status: string;
  totalAmount: string | null;
  currency: string;
  paymentMethod: "cash" | "installment" | "agency_credit";
  installmentMonthlyAmount: string | null;
  installmentMonths: number | null;
  paymentExpiresAt: string | null;
  payableNowAmount?: string | null;
};

type AgencyCredit = {
  status: "pending" | "approved" | "rejected";
  legalName: string;
  availableCredit: string;
  creditLimit: string;
  currency: string;
};

type HotelAlternative = {
  offerId: number;
  hotelName: string;
  hotelSlug: string;
  tourSlug: string;
  stars: number;
  region: string | null;
  roomType: string;
  serviceType: string;
  price: string;
  currency: string;
};

type Quote = {
  totalAmount: string;
  downPayment: string;
  financedAmount: string;
  feeAmount: string;
  installmentTotal: string;
  monthlyAmount: string;
  months: number;
  schedule: { sequence: number; dueDate: string; amount: string }[];
};
function apiErrorMessage(body: unknown, fallback: string) {
  if (!body || typeof body !== "object" || !("detail" in body)) return fallback;
  const detail = (body as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => item && typeof item === "object" && "msg" in item ? String(item.msg) : "")
      .filter(Boolean)
      .join("، ") || fallback;
  }
  return fallback;
}
const flightSteps = ["مرور سبد", "اطلاعات مسافران", "درخواست ثبت‌شده", "تأیید نهایی"];
const steps = ["مرور سبد", "اطلاعات مسافران", "ثبت درخواست", "مدارک", "تأیید نهایی"];
const cartStatusLabels: Record<string, string> = {
  active: "قیمت و ظرفیت بررسی شده",
  price_changed: "تغییر قیمت",
  availability_check_required: "نیاز به بررسی ظرفیت",
  unavailable: "ناموجود",
  expired: "نیاز به تازه‌سازی",
};

const itemLabels = {
  tour: "تور",
  flight: "بلیط هواپیما",
  train: "بلیط قطار",
  bus: "بلیط اتوبوس",
};

function money(value: string | null, currency = "IRT") {
  return value ? formatCurrency(value, currency) : "پس از بررسی کارشناس";
}

function pricingAmountToToman(
  priceAmount: string | null,
  currency: string | null,
  hotelAmount: string | null,
  hotelCurrency: string | null,
  flightAmount: string | null,
  flightCurrency: string | null,
  exchangeRates: ExchangeRates,
) {
  const direct = toToman(priceAmount, currency, exchangeRates);
  if (direct !== null) return direct;
  const hotel = toToman(hotelAmount, hotelCurrency, exchangeRates);
  const flight = toToman(flightAmount, flightCurrency, exchangeRates);
  if (hotel === null && flight === null) return null;
  if (hotelAmount !== null && hotel === null) return null;
  if (flightAmount !== null && flight === null) return null;
  return (hotel ?? 0) + (flight ?? 0);
}

function cartItemAmountToToman(item: CartItem, exchangeRates: ExchangeRates) {
  return pricingAmountToToman(
    item.priceAmount,
    item.currency,
    item.hotelAmount,
    item.hotelCurrency,
    item.flightAmount,
    item.flightCurrency,
    exchangeRates,
  );
}

function currentCartItemAmountToToman(item: CartItem, exchangeRates: ExchangeRates) {
  return pricingAmountToToman(
    item.currentPriceAmount,
    item.currentCurrency,
    item.currentHotelAmount,
    item.currentHotelCurrency,
    item.currentFlightAmount,
    item.currentFlightCurrency,
    exchangeRates,
  );
}

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function TravelCheckout() {
  const [items, setItems] = useState<CartItem[] | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [configuration, setConfiguration] = useState<Configuration | null>(null);
  const [passengers, setPassengers] = useState<PassengerCheckoutData[]>([]);
  const [passengerModal, setPassengerModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "installment" | "agency_credit">("cash");
  const [agencyCredit, setAgencyCredit] = useState<AgencyCredit | null>(null);
  const [months, setMonths] = useState(6);
  const [downPayment, setDownPayment] = useState("");
  const [firstDueDate, setFirstDueDate] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [discountCode, setDiscountCode] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [step, setStep] = useState(0);
  const [flight, setFlight] = useState<{ order: FlightCartOrder; payable: boolean } | null>(null);
  const [flightStep, setFlightStep] = useState(0);
  const [lastFlightStep, setLastFlightStep] = useState(0);
  const activeStep = flight ? flightStep : step;

  function goToFlightStep(nextStep: number) {
    setFlightStep(nextStep);
    setLastFlightStep((visited) => Math.max(visited, nextStep));
  }
  const [uploaded, setUploaded] = useState<Record<string, string>>({});
  const [documentPassengerByRequirement, setDocumentPassengerByRequirement] = useState<Record<number, string>>({});
  const [alternatives, setAlternatives] = useState<HotelAlternative[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [payingBooking, setPayingBooking] = useState<number | null>(null);
  const [guestItems, setGuestItems] = useState<GuestCartIntent[]>([]);
  const [refreshingCart, setRefreshingCart] = useState(false);
  const [consulting, setConsulting] = useState(false);

  async function load() {
    const [cartResponse, bookingResponse, configResponse, agencyResponse] = await Promise.all([
      fetch(`${PUBLIC_API_BASE_URL}/account/cart`, { credentials: "include", cache: "no-store" }),
      fetch(`${PUBLIC_API_BASE_URL}/account/bookings`, { credentials: "include", cache: "no-store" }),
      fetch(`${PUBLIC_API_BASE_URL}/account/checkout/configuration`, {
        credentials: "include",
        cache: "no-store",
      }),
      fetch(`${PUBLIC_API_BASE_URL}/account/agency`, {
        credentials: "include",
        cache: "no-store",
      }),
    ]);
    setSignedIn(cartResponse.ok);
    if (cartResponse.status === 401) {
      const savedGuestItems = readGuestCart();
      setGuestItems(savedGuestItems);
      setItems([]);
      setNotice(
        savedGuestItems.length
          ? "انتخاب شما در سبد مهمان محفوظ است؛ برای نهایی‌کردن رزرو وارد حساب شوید و مراحل سبد خرید را کامل کنید."
          : "برای دریافت قیمت و ظرفیت و ثبت درخواست رزرو وارد حساب کاربری شوید.",
      );
      return;
    }

    let nextItems = cartResponse.ok ? ((await cartResponse.json()) as CartItem[]) : [];
    const pendingGuestItems = readGuestCart();
    if (cartResponse.ok && pendingGuestItems.length) {
      const results = await Promise.all(
        pendingGuestItems.map(async (item) => {
          const response = await fetch(`${PUBLIC_API_BASE_URL}/account/cart`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
            body: JSON.stringify({
              itemType: item.itemType,
              tourId: item.tourId,
              travelServiceId: item.travelServiceId,
              tourDepartureId: item.tourDepartureId,
              hotelPackageId: item.hotelPackageId,
              tourHotelPriceId: item.tourHotelPriceId,
              combinedDeparturePriceId: item.combinedDeparturePriceId,
              roomSelection: item.roomSelection,
            }),
          }).catch(() => null);
          if (response?.ok) return "transferred";
          if (response?.status === 404) {
            const body = await response.json().catch(() => null);
            if (body?.detail === "purchasable item not found") return "unavailable";
          }
          return "retry";
        }),
      );
      removeGuestCartIntents(pendingGuestItems.filter((_, index) => results[index] !== "retry"));
      setGuestItems(readGuestCart());
      if (results.includes("transferred")) {
        const synced = await fetch(`${PUBLIC_API_BASE_URL}/account/cart`, {
          credentials: "include",
          cache: "no-store",
        }).catch(() => null);
        if (synced?.ok) nextItems = (await synced.json()) as CartItem[];
      }
      if (results.includes("retry")) {
        setNotice("انتقال بعضی انتخاب‌ها کامل نشد. می‌توانید دوباره تلاش کنید.");
      } else if (results.includes("transferred")) {
        setNotice("انتخاب‌ها به سبد حساب شما منتقل شدند.");
      }
    }
    setItems(nextItems);
    setBookings(bookingResponse.ok ? ((await bookingResponse.json()) as Booking[]) : []);
    if (agencyResponse.ok) {
      setAgencyCredit((await agencyResponse.json()) as AgencyCredit | null);
    }
    if (configResponse.ok) {
      const config = (await configResponse.json()) as Configuration;
      setConfiguration(config);
      setMonths(config.allowedMonths.includes(6) ? 6 : config.allowedMonths[0] ?? 3);
    }
  }
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const exchangeRates: ExchangeRates = {
    usdToIrt: configuration?.usdToIrt,
    eurToIrt: configuration?.eurToIrt,
  };
  const amounts = items?.map((item) => cartItemAmountToToman(item, exchangeRates)) ?? [];
  const total = items?.length && amounts.every((amount) => amount !== null && amount > 0)
    ? amounts.reduce<number>((sum, amount) => sum + (amount ?? 0), 0)
    : null;
  const currency = "IRT";
  const incompletePriceItems = items?.filter((item) => cartItemAmountToToman(item, exchangeRates) === null) ?? [];
  const minimumDownPaymentPercent = Math.min(100, Math.max(50, Number(configuration?.minDownPaymentPercent ?? 50)));
  const defaultDownPaymentPercent = Math.min(100, Math.max(minimumDownPaymentPercent, Number(configuration?.defaultDownPaymentPercent ?? minimumDownPaymentPercent)));
  const minimumDownPayment = total && configuration
    ? Math.ceil(total * minimumDownPaymentPercent / 100)
    : 0;
  const financedAmount = total ? Math.max(0, total - Number(downPayment || 0)) : 0;
  const quoteReady = Boolean(
    total && configuration && firstDueDate && Number(downPayment) >= minimumDownPayment && Number(downPayment) < total && financedAmount <= Number(configuration.maxCreditAmount),
  );
  const fixedTourPassengerCounts = useMemo(
    () => getTourPassengerCounts(items ?? []),
    [items],
  );
  const requiresPassengerDetails = Boolean(items?.length);
  const blockedCartItems = items?.filter((item) => item.status !== "active") ?? [];
  const priceChangedItems = items?.filter((item) => item.status === "price_changed") ?? [];
  const relevantRequirements = configuration?.documentRequirements.filter(
    (requirement) =>
      requirement.appliesTo === "all" ||
      (paymentMethod === "installment" && requirement.appliesTo === "installment") ||
      items?.some((item) => item.itemType === requirement.appliesTo),
  ) ?? [];

  useEffect(() => {
    if (!total || !configuration) return;
    const timer = window.setTimeout(() => {
      const percent = defaultDownPaymentPercent;
      setDownPayment(String(Math.round((total * percent) / 100)));
      setFirstDueDate(toDateInput(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [configuration, defaultDownPaymentPercent, total]);

  async function removeItem(id: number) {
    const response = await fetch(`${PUBLIC_API_BASE_URL}/account/cart/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (response.ok) {
      setItems((current) => current?.filter((item) => item.id !== id) ?? []);
      setPassengers([]);
      notifyCartUpdated();
    }
  }

  async function refreshCart() {
    setRefreshingCart(true);
    setNotice("");
    try {
      const response = await fetch(`${PUBLIC_API_BASE_URL}/account/cart/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("refresh failed");
      setItems((await response.json()) as CartItem[]);
      setNotice("قیمت و ظرفیت انتخاب‌ها بررسی شد. موارد تغییرکرده را تأیید کنید.");
    } catch {
      setNotice("بررسی قیمت و ظرفیت انجام نشد. چند لحظه دیگر دوباره تلاش کنید.");
    } finally {
      setRefreshingCart(false);
    }
  }

  async function acceptPriceChanges() {
    setRefreshingCart(true);
    try {
      const response = await fetch(`${PUBLIC_API_BASE_URL}/account/cart/accept-price`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds: priceChangedItems.map((item) => item.id) }),
      });
      if (!response.ok) throw new Error("accept failed");
      setItems((await response.json()) as CartItem[]);
      setNotice("قیمت‌های جدید تأیید شد. می‌توانید درخواست رزرو را ادامه دهید.");
    } catch {
      setNotice("تأیید قیمت‌های جدید ناموفق بود.");
    } finally {
      setRefreshingCart(false);
    }
  }

  async function requestConsultation() {
    setConsulting(true);
    try {
      const response = await fetch(`${PUBLIC_API_BASE_URL}/account/cart/consultation`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      setNotice(response.ok ? "درخواست مشاوره ثبت شد؛ کارشناس با شما تماس می‌گیرد." : "ثبت درخواست مشاوره ناموفق بود.");
    } catch {
      setNotice("ارتباط با پشتیبانی برقرار نشد. دوباره تلاش کنید.");
    } finally {
      setConsulting(false);
    }
  }
  async function calculate() {
    if (!total || !configuration) {
      setNotice(incompletePriceItems.length
        ? "برای محاسبه اقساط، قیمت هتل و پرواز باید نهایی باشد و برای دلار/یورو نرخ تبدیل در تنظیمات مدیریت ثبت شده باشد."
        : "مبلغ نهایی سبد خرید هنوز مشخص نشده است.");
      return;
    }
    if (!firstDueDate) {
      setNotice("تاریخ اولین قسط را انتخاب کنید.");
      return;
    }
    if (Number(downPayment) < minimumDownPayment) {
      setNotice(`حداقل پیش‌پرداخت ${minimumDownPaymentPercent.toLocaleString("fa-IR")}٪، معادل ${money(String(minimumDownPayment), currency)} است.`);
      return;
    }
    if (Number(downPayment) >= total) {
      setNotice("پیش‌پرداخت باید کمتر از مبلغ کل سفارش باشد.");
      return;
    }
    if (financedAmount > Number(configuration.maxCreditAmount)) {
      setNotice(`مانده قابل تأمین بیشتر از سقف اعتبار ${money(configuration.maxCreditAmount, currency)} است؛ مبلغ پیش‌پرداخت را افزایش دهید.`);
      return;
    }
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(`${PUBLIC_API_BASE_URL}/account/checkout/installment-quote`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totalAmount: total, downPayment: Number(downPayment), months, monthlyFeeRate: Number(configuration.monthlyFeeRate), firstDueDate }),
      });
      const body = (await response.json().catch(() => null)) as unknown;
      if (!response.ok || !body || typeof body !== "object" || !("schedule" in body)) {
        setNotice(apiErrorMessage(body, "محاسبه برنامه اقساط ناموفق بود."));
        return;
      }
      setQuote(body as Quote);
    } catch {
      setNotice("ارتباط با سرویس محاسبه اقساط برقرار نشد. اتصال بک‌اند را بررسی و دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  }

  async function createBooking() {
    if (!items?.length || !configuration) return;
    if (requiresPassengerDetails && !passengers.length) {
      setStep(1);
      setPassengerModal(true);
      setNotice("اطلاعات مسافران را تکمیل کنید.");
      return;
    }
    if (!termsAccepted) {
      setNotice("پذیرش قوانین خرید و استرداد الزامی است.");
      return;
    }
    if (blockedCartItems.length) {
      setNotice(
        "پیش از ارسال درخواست رزرو، قیمت و ظرفیت همهٔ انتخاب‌ها را بررسی و تأیید کنید.",
      );
      setStep(0);
      return;
    }
    if (paymentMethod === "agency_credit") {
      if (!agencyCredit || agencyCredit.status !== "approved") {
        setNotice("حساب آژانسی شما هنوز برای خرید اعتباری تأیید نشده است.");
        return;
      }
      if (!total || total > Number(agencyCredit.availableCredit)) {
        setNotice("اعتبار قابل استفاده آژانس برای این خرید کافی نیست.");
        return;
      }
    }
    if (paymentMethod === "installment" && total && !quote) {
      setNotice("ابتدا برنامه اقساط را محاسبه و تأیید کنید.");
      return;
    }
    setBusy(true);
    setNotice("");
    const response = await fetch(`${PUBLIC_API_BASE_URL}/account/bookings`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentMethod,
        termsAccepted,
        termsVersion: configuration.termsVersion,
        discountCode: discountCode.trim() || null,
        customerNote: customerNote.trim() || null,
        passengers: passengers.map((passenger) => ({
          id: passenger.id,
          passengerType: passenger.passengerType,
          firstName: passenger.firstName,
          lastName: passenger.lastName,
          fatherName: passenger.fatherName || null,
          firstNameEn: passenger.firstNameEn || null,
          lastNameEn: passenger.lastNameEn || null,
          nationalCode: passenger.nationalCode || null,
          passportNumber: passenger.passportNumber || null,
          passportExpiryDate: passenger.passportExpiryDate || null,
          email: passenger.email || null,
          gender: passenger.gender,
          age: passenger.age ? Number(passenger.age) : null,
          birthDate: passenger.birthDate || null,
          phone: passenger.phone || null,
          hasPet: passenger.hasPet,
          petName: passenger.hasPet ? passenger.petName || null : null,
          petType: passenger.hasPet ? passenger.petType || null : null,
          petWeightKg: passenger.hasPet && passenger.petWeightKg ? Number(passenger.petWeightKg) : null,
        })),
      }),
    });
    const created = (await response.json().catch(() => null)) as Booking | { detail?: string | { message?: string; alternatives?: HotelAlternative[] } } | null;
    if (!response.ok || !created || !("bookingNumber" in created)) {
      setBusy(false);
      if (created && "detail" in created && typeof created.detail === "object") {
        setAlternatives(created.detail.alternatives ?? []);
        setNotice(created.detail.message ?? "هتل انتخابی دیگر ظرفیت ندارد.");
      } else {
        setNotice(created && "detail" in created && typeof created.detail === "string" ? created.detail : "ثبت درخواست رزرو ناموفق بود.");
      }
      return;
    }
    setAlternatives([]);
    if (paymentMethod === "installment" && quote) {
      const planResponse = await fetch(
        `${PUBLIC_API_BASE_URL}/account/checkout/bookings/${created.id}/installment-plan`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            totalAmount: total,
            downPayment: Number(downPayment),
            months,
            monthlyFeeRate: Number(configuration.monthlyFeeRate),
            firstDueDate,
          }),
        },
      );
      if (!planResponse.ok) {
        const planError = (await planResponse.json().catch(() => null)) as { detail?: string } | null;
        setNotice(planError?.detail ?? "درخواست رزرو ثبت شد ولی برنامه اقساط نیازمند بررسی کارشناس است.");
      }
    }
    setBooking(created);
    setItems([]);
    notifyCartUpdated();
    setBusy(false);
    setStep(3);
  }

  async function uploadDocument(
    requirement: Requirement,
    file: File | null,
    passengerSelection: string,
  ) {
    if (!booking || !file) return;
    const uploadKey = `${requirement.id}:${passengerSelection}`;
    const data = new FormData();
    data.append("requirementId", String(requirement.id));
    if (passengerSelection !== "general") {
      data.append("passengerIndex", passengerSelection);
    }
    data.append("file", file);
    setUploaded((current) => ({ ...current, [uploadKey]: "در حال بارگذاری…" }));
    const response = await fetch(
      `${PUBLIC_API_BASE_URL}/account/checkout/bookings/${booking.id}/documents`,
      { method: "POST", credentials: "include", body: data },
    );
    setUploaded((current) => ({
      ...current,
      [uploadKey]: response.ok ? "بارگذاری شد" : "بارگذاری ناموفق",
    }));
  }

  async function payBooking(row: Booking) {
    setNotice("");
    setPayingBooking(row.id);
    try {
      const response = await fetch(`${PUBLIC_API_BASE_URL}/payments/intents`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crmContractNumber: row.bookingNumber,
          amount: Number(row.payableNowAmount ?? row.totalAmount),
          currency: row.currency,
        }),
      });
      const result = await response.json().catch(() => null);
      if (response.status === 503 && result?.detail === "online payment is not configured") {
        window.location.assign("/payment/waiting/");
      } else if (response.ok && result?.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
      } else {
        setNotice("ورود به درگاه انجام نشد. وضعیت یا اعتبار پرداخت را در سفرهای من بررسی کنید.");
      }
    } catch {
      setNotice("ارتباط با سرویس پرداخت برقرار نشد. دوباره تلاش کنید.");
    } finally {
      setPayingBooking(null);
    }
  }

  if (items === null) {
    return <div className="rounded-3xl border border-border bg-white p-12 text-center">در حال دریافت سبد خرید…</div>;
  }

  return (
    <>
      <div className="space-y-6" dir="rtl">
        <nav aria-label="مراحل تکمیل خرید" className="overflow-x-auto">
          <ol className={`rounded-2xl border border-border bg-white p-2 ${flight ? "grid grid-cols-2 gap-1 sm:grid-cols-4" : "flex min-w-max gap-2"}`}>
            {(flight ? flightSteps : steps).map((label, index) => (
              <li key={label}>
                <button
                  className={`rounded-xl px-3 py-3 text-sm font-black ${flight ? "flex h-full w-full items-center gap-2 text-right" : ""} ${index === activeStep ? "bg-brand text-white" : index < activeStep ? "bg-emerald-50 text-emerald-700" : "text-muted"}`}
                  aria-current={index === activeStep ? "step" : undefined}
                  disabled={flight ? index > lastFlightStep : index > step || (index === 3 && !booking)}
                  onClick={() => flight ? goToFlightStep(index) : setStep(index)}
                  type="button"
                >
                  {flight ? (
                    <>
                      <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full border border-current/20 text-xs">{(index + 1).toLocaleString("fa-IR")}</span>
                      <span>{label}</span>
                    </>
                  ) : <>{index + 1}. {label}</>}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        {notice ? <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900" role="status" aria-live="polite" aria-atomic="true">{notice}</p> : null}

        {flight && (
          <FlightCartDetails
            key={flight.order.id}
            order={flight.order}
            payable={flight.payable}
            step={flightStep}
            onStep={goToFlightStep}
            onBackToCart={() => setFlight(null)}
          />
        )}

        {!flight && step === 0 ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_21rem]">
            <section className="min-w-0 space-y-3">
              {guestItems.length ? (
                <section className="rounded-2xl border border-dashed border-pink-300 bg-pink-50 p-4">
                  <h2 className="font-black text-brand">سبد مهمان ({guestItems.length.toLocaleString("fa-IR")} انتخاب)</h2>
                  <p className="mt-1 text-sm leading-7 text-muted">این انتخاب‌ها روی همین دستگاه محفوظ‌اند؛ با ورود، قیمت و ظرفیت آن‌ها بررسی و به سبد شما منتقل می‌شود.</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {guestItems.map((item) => <p className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-brand" key={`${item.itemType}-${item.addedAt}`}>{item.label}</p>)}
                  </div>
                  {signedIn ? <button type="button" className="mt-4 min-h-11 rounded-xl bg-accent px-4 font-black text-brand" onClick={() => void load()}>تلاش دوباره برای انتقال</button> : <Link className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-accent px-4 font-black text-brand" href="/account/?next=%2Fcart%2F">ورود و انتقال سبد</Link>}
                </section>
              ) : null}
              {items.map((item) => {
                const quotedAmount = cartItemAmountToToman(item, exchangeRates);
                const currentQuotedAmount = currentCartItemAmountToToman(item, exchangeRates);
                const quotedPrice = quotedAmount !== null
                  ? money(String(quotedAmount), currency)
                  : money(item.priceAmount, item.currency ?? currency);
                const currentQuotedPrice = currentQuotedAmount !== null
                  ? money(String(currentQuotedAmount), currency)
                  : money(item.currentPriceAmount, item.currentCurrency ?? currency);

                return (
                  <article className={`flex flex-col gap-4 rounded-2xl border bg-white p-4 sm:flex-row ${item.status === "price_changed" ? "border-pink-300 shadow-[0_10px_30px_rgba(236,72,153,.12)]" : item.status === "active" ? "border-border" : "border-amber-300"}`} key={item.id}>
                  {item.imageId ? <Image alt="" className="size-24 rounded-xl object-cover" height={96} src={`${PUBLIC_API_BASE_URL}/media/${item.imageId}`} unoptimized width={96} /> : <div className="size-24 rounded-xl bg-brand-soft" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-lg bg-brand-soft px-2 py-1 text-xs font-black text-brand">{itemLabels[item.itemType]}</span>
                      <span className={`rounded-lg px-2 py-1 text-xs font-black ${item.status === "active" ? "bg-emerald-50 text-emerald-700" : item.status === "price_changed" ? "bg-pink-100 text-pink-700" : "bg-amber-100 text-amber-800"}`}>{cartStatusLabels[item.status] ?? "نیازمند بررسی"}</span>
                    </div>
                    <h2 className="mt-2 font-black text-brand">{item.titleSnapshot}</h2>
                    <p className="mt-1 text-sm text-muted">{item.detailsSnapshot ?? "جزئیات پس از تأیید تأمین‌کننده"}</p>
                    {item.status === "price_changed" ? <div className="mt-3 rounded-xl bg-pink-50 p-3 text-sm"><span className="text-muted">قیمت پیشین: </span><del>{quotedPrice}</del><strong className="mr-3 text-pink-700">قیمت جدید: {currentQuotedPrice}</strong></div> : <div className="mt-3"><strong className="block text-base">{item.itemType === "tour" ? `قیمت تور: ${quotedPrice}` : quotedPrice}</strong>{item.itemType === "tour" && item.hotelAmount !== null && item.flightAmount !== null ? <span className="mt-1 block text-xs text-muted">شامل اقامت و پرواز انتخابی</span> : null}</div>}
                    {item.priceCheckedAt ? <span className="mt-2 block text-xs text-muted">آخرین بررسی قیمت و ظرفیت: {formatPersianDate(item.priceCheckedAt)}</span> : null}
                  </div>
                  <button className="self-start rounded-lg px-2 py-1 text-sm font-bold text-red-700 hover:bg-red-50" onClick={() => void removeItem(item.id)} type="button">حذف</button>
                </article>
                );
              })}
              <ErpFlightOrders cart onSelect={(order, payable) => { setFlightStep(0); setLastFlightStep(0); setFlight({ order, payable }); }} empty={!items.length && !guestItems.length ? <div className="rounded-2xl border border-dashed border-border bg-white p-10 text-center"><p>سبد خرید شما خالی است.</p><Link className="mt-4 inline-flex rounded-xl bg-brand px-5 py-3 font-black text-white" href="/tours/">مشاهده تورها</Link></div> : undefined} />
            </section>
            {items.length > 0 && <aside className="h-fit rounded-2xl border border-border bg-white p-5 lg:sticky lg:top-24">
              <h2 className="text-xl font-black text-brand">خلاصه سفر</h2>
              <p className="mt-2 text-xs leading-6 text-muted">قیمت‌ها برآورد هستند و پیش از پرداخت توسط کارشناس تأیید می‌شوند.</p>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between"><dt>تعداد خدمات</dt><dd className="font-black">{items.length.toLocaleString("fa-IR")}</dd></div>
                <div className="flex justify-between border-t border-border pt-3"><dt>مبلغ برآوردی</dt><dd className="font-black">{total ? money(String(total), currency) : "نیازمند استعلام"}</dd></div>
              </dl>
              {blockedCartItems.length ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-7 text-amber-900">برای ادامه، قیمت و ظرفیت {blockedCartItems.length.toLocaleString("fa-IR")} انتخاب را بررسی کنید.</div> : null}
              <button className="mt-4 min-h-11 w-full rounded-xl border border-brand px-4 font-black text-brand disabled:opacity-60" disabled={refreshingCart || !items.length} onClick={() => void refreshCart()} type="button">{refreshingCart ? "در حال بررسی…" : "بررسی دوباره قیمت و ظرفیت"}</button>
              {priceChangedItems.length ? <button className="mt-2 min-h-11 w-full rounded-xl bg-accent px-4 font-black text-brand disabled:opacity-60" disabled={refreshingCart} onClick={() => void acceptPriceChanges()} type="button">تأیید قیمت‌های جدید</button> : null}
              <button className="mt-2 min-h-11 w-full rounded-xl border border-pink-300 px-4 font-black text-pink-700 disabled:opacity-60" disabled={consulting} onClick={() => void requestConsultation()} type="button">{consulting ? "در حال ثبت…" : "نیاز به مشاوره دارم"}</button>
              <button className="mt-5 w-full rounded-xl bg-accent px-5 py-3 font-black text-brand disabled:opacity-50" disabled={!items.length || blockedCartItems.length > 0} onClick={() => setStep(1)} type="button">ادامه و اطلاعات مسافران</button>
            </aside>}
          </div>
        ) : null}

        {!flight && step === 1 ? (
          <section className="rounded-3xl border border-border bg-white p-6">
            <h2 className="text-2xl font-black text-brand">اطلاعات مسافران</h2>
            <p className="mt-2 text-sm leading-7 text-muted">برای بلیط‌ها نام انگلیسی، کد ملی یا گذرنامه و تاریخ تولد باید مطابق مدرک هویتی باشد.</p>
            {passengers.length > 0 && !passengerModal && (
              <button className="mt-5 rounded-xl border border-brand px-5 py-3 font-black text-brand" onClick={() => setPassengerModal(true)} type="button">
                ویرایش مسافران
              </button>
            )}
            <PassengerCheckoutModal
              inline
              fixedPassengerCounts={fixedTourPassengerCounts}
              onClose={() => setPassengerModal(false)}
              onComplete={(value) => {
                setPassengers(value);
                setPassengerModal(false);
                setNotice("");
              }}
              open={passengerModal || !passengers.length}
            />
            <p className="mt-4 font-bold">{passengers.length.toLocaleString("fa-IR")} مسافر ثبت شده است.</p>
            <label className="mt-5 grid gap-1.5 text-sm font-bold text-brand">
              <span>درخواست ویژه برای کارشناس (اختیاری)</span>
              <textarea aria-label="درخواست ویژه برای کارشناس" className="min-h-24 rounded-xl border border-border bg-white p-3 font-normal text-foreground outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" maxLength={1000} onChange={(event) => setCustomerNote(event.target.value)} placeholder="مثلاً درخواست صندلی کنار هم، ترنسفر، رژیم غذایی یا توضیح ضروری" value={customerNote} />
            </label>
            <div className="mt-6 flex gap-2"><button className="rounded-xl bg-brand px-5 py-3 font-black text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={requiresPassengerDetails && !passengers.length} onClick={() => setStep(2)} type="button">ادامه و ثبت درخواست</button><button className="rounded-xl border border-border px-5 py-3" onClick={() => setStep(0)} type="button">بازگشت</button></div>
          </section>
        ) : null}

        {!flight && step === 2 ? (
          <section className="grid gap-6 lg:grid-cols-[1fr_22rem]">
            <div className="space-y-5 rounded-3xl border border-border bg-white p-6">
              <h2 className="text-2xl font-black text-brand">شیوهٔ پرداخت پیشنهادی</h2>
              <p className="text-sm leading-7 text-muted">در این مرحله فقط درخواست رزرو شما ثبت می‌شود؛ قیمت و ظرفیت نهایی توسط کارشناس تأیید و سپس لینک پرداخت ارسال می‌شود.</p>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {configuration?.cashEnabled ? <button aria-pressed={paymentMethod === "cash"} className={`rounded-2xl border p-5 text-right ${paymentMethod === "cash" ? "border-brand bg-brand-soft" : "border-border"}`} onClick={() => { setPaymentMethod("cash"); setQuote(null); }} type="button"><strong className="block text-brand">پرداخت نقدی</strong><span className="mt-2 block text-sm text-muted">پرداخت کل مبلغ پس از تأیید نهایی</span></button> : null}
                {configuration?.installmentEnabled ? <button aria-pressed={paymentMethod === "installment"} className={`rounded-2xl border p-5 text-right ${paymentMethod === "installment" ? "border-accent-strong bg-[#fff1f7]" : "border-border"}`} onClick={() => setPaymentMethod("installment")} type="button"><strong className="block text-brand">پرداخت اقساطی</strong><span className="mt-2 block text-sm text-muted">پیش‌پرداخت و برنامه اقساط شفاف</span></button> : null}
                {agencyCredit ? <button aria-pressed={paymentMethod === "agency_credit"} className={`rounded-2xl border p-5 text-right disabled:cursor-not-allowed disabled:opacity-60 ${paymentMethod === "agency_credit" ? "border-emerald-500 bg-emerald-50" : "border-border"}`} disabled={agencyCredit.status !== "approved"} onClick={() => { setPaymentMethod("agency_credit"); setQuote(null); }} type="button"><strong className="block text-brand">اعتبار آژانسی</strong><span className="mt-2 block text-sm text-muted">{agencyCredit.status === "approved" ? `قابل استفاده: ${money(agencyCredit.availableCredit, agencyCredit.currency)}` : agencyCredit.status === "pending" ? "در انتظار تأیید و تعیین اعتبار پشتیبان" : "درخواست آژانس تأیید نشده است"}</span></button> : null}
              </div>
              {paymentMethod === "installment" ? (
                <div className="space-y-5 rounded-2xl border border-pink-200 bg-pink-50/40 p-4">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl bg-white p-3"><span className="text-xs text-muted">مبلغ کل سفارش</span><strong className="mt-1 block text-brand">{total ? money(String(total), currency) : "قیمت نهایی نشده"}</strong></div>
                    <div className="rounded-xl bg-white p-3"><span className="text-xs text-muted">حداقل پیش‌پرداخت</span><strong className="mt-1 block text-brand">{configuration ? `${minimumDownPaymentPercent.toLocaleString("fa-IR")}٪ · ${money(String(minimumDownPayment), currency)}` : "—"}</strong></div>
                    <div className="rounded-xl bg-white p-3"><span className="text-xs text-muted">نرخ کارمزد ماهانه</span><strong className="mt-1 block text-brand">{configuration ? `${Number(configuration.monthlyFeeRate).toLocaleString("fa-IR")}٪` : "—"}</strong></div>
                    <div className="rounded-xl bg-white p-3"><span className="text-xs text-muted">سقف تأمین مالی</span><strong className="mt-1 block text-brand">{configuration ? money(configuration.maxCreditAmount, currency) : "—"}</strong></div>
                  </div>

                  {incompletePriceItems.length ? <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm leading-7 text-amber-900">قیمت {incompletePriceItems.length.toLocaleString("fa-IR")} مورد از سبد نهایی یا قابل تبدیل نیست. برای دلار و یورو ابتدا نرخ تبدیل را در تنظیمات مدیریت ثبت کنید.</div> : null}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2 text-sm font-bold">پیش‌پرداخت ({currency === "IRT" ? "تومان" : currency})<input className="min-h-12 rounded-xl border border-border bg-white px-3" inputMode="numeric" min={minimumDownPayment} onChange={(event) => { setDownPayment(event.target.value); setQuote(null); }} type="number" value={downPayment} /><span className="text-xs font-normal text-muted">مانده فعلی: {total ? money(String(financedAmount), currency) : "—"}</span></label>
                    <label className="grid gap-2 text-sm font-bold">تعداد اقساط<SiteSelect ariaLabel="تعداد اقساط" className="min-h-12" id="checkout-installment-months" onValueChange={(nextValue) => { setMonths(Number(nextValue)); setQuote(null); }} options={(configuration?.allowedMonths ?? []).map((value) => ({ label: `${value.toLocaleString("fa-IR")} ماهه`, value: String(value) }))} value={String(months)} /><span className="text-xs font-normal text-muted">طرح‌های مجاز از تنظیمات مدیریت دریافت می‌شوند.</span></label>
                    <label className="grid gap-2 text-sm font-bold sm:col-span-2">تاریخ اولین قسط<JalaliDateInput ariaLabel="تاریخ اولین قسط" className="min-h-12 w-full rounded-xl border border-border bg-white px-3" min={toDateInput(new Date())} onChange={(value) => { setFirstDueDate(value ?? ""); setQuote(null); }} value={firstDueDate || null} /></label>
                  </div>

                  <button aria-disabled={!quoteReady} className="w-full rounded-xl bg-accent-strong px-5 py-3 font-black text-white transition hover:bg-[#d94687] disabled:opacity-50" disabled={busy} onClick={() => void calculate()} type="button">{busy ? "در حال محاسبه…" : "محاسبه برنامه اقساط"}</button>

                  {quote ? (
                    <div className="space-y-4 rounded-2xl border border-border bg-white p-4">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <div><span className="text-xs text-muted">پیش‌پرداخت</span><strong className="block text-brand">{money(quote.downPayment, currency)}</strong></div>
                        <div><span className="text-xs text-muted">اصل مبلغ تأمین مالی</span><strong className="block text-brand">{money(quote.financedAmount, currency)}</strong></div>
                        <div><span className="text-xs text-muted">کارمزد کل</span><strong className="block text-brand">{money(quote.feeAmount, currency)}</strong></div>
                        <div><span className="text-xs text-muted">جمع اقساط با کارمزد</span><strong className="block text-brand">{money(quote.installmentTotal, currency)}</strong></div>
                        <div><span className="text-xs text-muted">مبلغ تقریبی هر قسط</span><strong className="block text-accent-strong">{money(quote.monthlyAmount, currency)}</strong></div>
                        <div><span className="text-xs text-muted">کل پرداخت نهایی</span><strong className="block text-accent-strong">{money(String(Number(quote.downPayment) + Number(quote.installmentTotal)), currency)}</strong></div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[30rem] text-sm"><caption className="sr-only">Installment schedule and due dates</caption><thead><tr className="bg-surface-muted text-right"><th className="p-3">قسط</th><th className="p-3">تاریخ سررسید</th><th className="p-3">مبلغ</th></tr></thead><tbody>{quote.schedule.map((line) => <tr className="border-t border-border" key={line.sequence}><td className="p-3 font-black">قسط {line.sequence.toLocaleString("fa-IR")}</td><td className="p-3">{formatPersianDate(line.dueDate)}</td><td className="p-3 font-black text-brand">{money(line.amount, currency)}</td></tr>)}</tbody></table>
                      </div>
                      <p className="text-xs leading-6 text-muted">این محاسبه اولیه است؛ تأیید اعتبار، مدارک و قرارداد اقساط پیش از نهایی‌شدن سفارش انجام می‌شود.</p>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <label className="grid gap-1.5 rounded-2xl border border-brand/15 bg-brand/5 p-4 text-sm font-bold text-brand"><span>کد تخفیف (اختیاری)</span><input aria-label="کد تخفیف" className="min-h-11 rounded-xl border border-border bg-white px-3 uppercase" onChange={(event) => setDiscountCode(event.target.value)} placeholder="مثلاً SUMMER1405" value={discountCode} /></label>
              <label className="flex items-start gap-3 rounded-2xl border border-border p-4 text-sm leading-7"><input checked={termsAccepted} className="mt-1 size-5 accent-brand" onChange={(event) => setTermsAccepted(event.target.checked)} type="checkbox" /><span><Link className="font-black text-brand underline" href="/terms/" target="_blank">قوانین قیمت، خرید و استرداد</Link>، تغییر برنامه سفر و <Link className="font-black text-brand underline" href="/privacy/" target="_blank">حفظ حریم خصوصی</Link> و در حالت اقساطی شرایط اعتبارسنجی و قرارداد اقساط را مطالعه و قبول دارم.</span></label>
            </div>
            <aside className="h-fit rounded-2xl border border-border bg-white p-5 lg:sticky lg:top-24">
              <h3 className="font-black text-brand">برآورد فعلی سفر</h3>
              <strong className="mt-3 block text-xl">{paymentMethod === "installment" ? money(downPayment || null) : total ? money(String(total), currency) : "پس از استعلام"}</strong>
              {paymentMethod === "agency_credit" && agencyCredit ? <p className="mt-2 text-xs leading-6 text-muted">پس از تأیید قیمت و ظرفیت توسط پشتیبان، مبلغ نهایی به‌صورت خودکار از اعتبار آژانس کسر می‌شود.</p> : null}
              <button className="mt-5 w-full rounded-xl bg-accent px-5 py-3 font-black text-brand disabled:opacity-50" disabled={busy || !termsAccepted || blockedCartItems.length > 0} onClick={() => void createBooking()} type="button">{busy ? "در حال ثبت…" : "ثبت درخواست رزرو و ادامه مدارک"}</button>
            </aside>
            {alternatives.length ? <div className="rounded-2xl border border-pink-200 bg-pink-50 p-4 lg:col-span-2"><h3 className="font-black text-brand">هتل‌های مشابه دارای ظرفیت</h3><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{alternatives.map((hotel) => <Link className="rounded-xl bg-white p-4 shadow-sm" href={`/tours/${hotel.tourSlug}/#tour-booking`} key={hotel.offerId}><strong className="block text-brand">{hotel.hotelName}</strong><span className="mt-1 block text-xs text-muted">{hotel.stars.toLocaleString("fa-IR")} ستاره · {hotel.region ?? "همان مقصد"}</span><span className="mt-2 block text-sm font-bold text-pink-600">{money(hotel.price, hotel.currency)}</span></Link>)}</div></div> : null}
          </section>
        ) : null}

        {!flight && step === 3 && booking ? (
          <section className="rounded-3xl border border-border bg-white p-6">
            <h2 className="text-2xl font-black text-brand">بارگذاری مدارک سفارش {booking.bookingNumber}</h2>
            <p className="mt-2 text-sm leading-7 text-muted">فایل‌ها خصوصی هستند و فقط شما و مدیران مجاز پرونده به آن‌ها دسترسی دارند.</p>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {relevantRequirements.map((requirement) => {
                const passengerSelection = documentPassengerByRequirement[requirement.id] ?? (passengers.length ? "0" : "general");
                const uploadKey = `${requirement.id}:${passengerSelection}`;
                return (
                  <label className="rounded-2xl border border-border p-4" key={requirement.id}>
                    <span className="font-black text-brand">{requirement.title}{requirement.isRequired ? <span className="text-red-600"> *</span> : null}</span>
                    <span className="mt-1 block text-xs leading-6 text-muted">{requirement.description} — حداکثر {Math.round(requirement.maxBytes / 1024 / 1024)} مگابایت</span>
                    <span className="mt-3 block text-xs font-bold text-brand">ثبت مدرک برای</span>
                    <SiteSelect
                      ariaLabel={`ثبت ${requirement.title} برای`}
                      className="mt-1 min-h-10"
                      id={`document-passenger-${requirement.id}`}
                      onValueChange={(nextValue) => setDocumentPassengerByRequirement((current) => ({ ...current, [requirement.id]: nextValue }))}
                      options={[{ label: "مدرک مشترک سفارش", value: "general" }, ...passengers.map((passenger, index) => ({ label: `${passenger.firstName} ${passenger.lastName}`.trim() || `مسافر ${index + 1}`, value: String(index) }))]}
                      value={passengerSelection}
                    />
                    <input accept={requirement.allowedExtensions.map((value) => `.${value}`).join(",")} className="mt-3 block w-full text-sm" onChange={(event) => void uploadDocument(requirement, event.target.files?.[0] ?? null, passengerSelection)} type="file" />
                    {uploaded[uploadKey] ? <span className="mt-2 block text-xs font-bold text-emerald-700">{uploaded[uploadKey]}</span> : null}
                  </label>
                );
              })}
            </div>
            <button className="mt-6 rounded-xl bg-brand px-6 py-3 font-black text-white" onClick={() => setStep(4)} type="button">ادامه و مشاهده نتیجه</button>
          </section>
        ) : null}

        {!flight && step === 4 && booking ? (
          <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center">
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-600 text-3xl text-white">✓</div>
            <h2 className="mt-5 text-2xl font-black text-emerald-900">درخواست رزرو با موفقیت ثبت شد</h2>
            <p className="mt-2 text-emerald-800">شماره پیگیری: <strong dir="ltr">{booking.bookingNumber}</strong></p>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-emerald-900">کارشناس موجودی، قیمت نهایی و مدارک را بررسی می‌کند. نتیجه و امکان پرداخت از همین صفحه و حساب کاربری در دسترس خواهد بود.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2"><a className="rounded-xl border border-emerald-700 px-5 py-3 font-black text-emerald-800" href={`${PUBLIC_API_BASE_URL}/account/bookings/${booking.id}/proforma.pdf`}>دانلود پیش‌فاکتور</a><Link className="rounded-xl bg-emerald-700 px-5 py-3 font-black text-white" href="/account/?tab=trips">پیگیری در حساب کاربری</Link></div>
          </section>
        ) : null}

        {!flight && bookings.length ? <section className="rounded-3xl border border-border bg-white p-6"><h2 className="text-xl font-black text-brand">سفارش‌های اخیر</h2><div className="mt-4 grid gap-2">{bookings.slice(0, 5).map((row) => <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-muted p-4" key={row.id}><div><strong className="block text-brand" dir="ltr">{row.bookingNumber}</strong><span className="text-xs text-muted">{row.paymentMethod === "installment" ? "اقساطی" : "نقدی"} · {row.status}</span></div><div className="flex flex-wrap items-center gap-3"><span className="font-black">{money(row.totalAmount, row.currency)}</span>{row.status === "approved" && Number(row.payableNowAmount ?? row.totalAmount) > 0 ? <button type="button" disabled={payingBooking !== null} onClick={() => void payBooking(row)} className="min-h-11 rounded-xl bg-brand px-4 font-bold text-white disabled:opacity-50">{payingBooking === row.id ? "در حال اتصال…" : "ادامه به پرداخت"}</button> : <Link href="/account/?tab=trips" className="font-bold text-brand underline">پیگیری سفارش</Link>}</div></div>)}</div></section> : null}
      </div>
    </>
  );
}
