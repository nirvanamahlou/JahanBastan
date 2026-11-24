"use client";

import { type FormEvent, useRef, useState } from "react";
import { AccountForm } from "@/components/account-form";
import { JalaliDateRangeInput } from "@/components/search/jalali-date-range-input";
import { PUBLIC_API_BASE_URL } from "@/lib/api/client";
import { readCustomerSession, invalidateCustomerSession } from "@/lib/customer-session";
import { PhoneIcon } from "./site-icons";
import styles from "./footer-newsletter.module.css";

type Request = { phone: string; origin: string; destination: string; departure: string; returnDate: string; budget: string };
export function FooterNewsletter() {
  const [busy, setBusy] = useState(false);
  const [login, setLogin] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const pending = useRef<Request | null>(null);
  async function sendRequest() {
    const request = pending.current;
    if (!request) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const session = await readCustomerSession();
      if (session.status === 401 || session.status === 403) { setLogin(true); return; }
      if (!session.ok) throw new Error("بررسی حساب انجام نشد؛ دوباره تلاش کنید.");
      const customer = await session.json() as { fullName: string };
      const response = await fetch(`${PUBLIC_API_BASE_URL}/account/leads`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: `درخواست پیگیری تور ${request.origin} به ${request.destination}`,
          contactName: customer.fullName, contactPhone: request.phone,
          details: `مبدأ: ${request.origin}\nمقصد: ${request.destination}\nرفت: ${request.departure}\nبرگشت: ${request.returnDate || "مشخص نشده"}`,
          expectedAmount: request.budget ? Number(request.budget) : null, currency: "IRT",
        }),
      });
      if (response.status === 401) { setLogin(true); return; }
      if (!response.ok) throw new Error("ثبت درخواست انجام نشد؛ دوباره تلاش کنید.");
      pending.current = null; setLogin(false); setMessage("درخواست شما ثبت شد؛ کارشناس سفر پیگیری می‌کند.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ارتباط با سرور برقرار نشد."); }
    finally { setBusy(false); }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    pending.current = { phone: String(form.get("phone") || ""), origin: String(form.get("origin") || ""), destination: String(form.get("destination") || ""), departure: String(form.get("departureFrom") || ""), returnDate: String(form.get("departureTo") || ""), budget: String(form.get("budget") || "") };
    if (!pending.current.departure) { setError("تاریخ رفت را انتخاب کنید."); return; }
    void sendRequest();
  }
  return <section className={styles.newsletter} aria-labelledby="footer-newsletter-title">
    <div className={styles.wrap}>
      <header><span className={styles.icon}><PhoneIcon /></span><div><h2 id="footer-newsletter-title">اعلان موجودی تور</h2><p>درخواستتان را ثبت کنید تا وقتی تور دلخواهتان موجود شد، باخبر شوید.</p></div></header>
      <form onSubmit={submit}>
        <div className={styles.fields}>
          <label><input name="phone" type="tel" inputMode="tel" dir="ltr" autoComplete="tel" placeholder=" " required maxLength={32} /><span>شماره موبایل</span></label>
          <label><input name="origin" placeholder=" " required maxLength={120} /><span>مبدأ</span></label>
          <label><input name="destination" placeholder=" " required maxLength={120} /><span>مقصد</span></label>
          <JalaliDateRangeInput compact showTripType={false} dateLabels={{ departure: "تاریخ رفت", return: "تاریخ برگشت", field: "تاریخ سفر" }} />
          <label><input type="number" name="budget" dir="ltr" min="1" step="1" placeholder=" " /><span>سقف بودجه (تومان)</span></label>
        </div>
        <div className={styles.bottom}><button type="submit" disabled={busy}>{busy ? "در حال ثبت…" : "ثبت درخواست پیگیری ←"}</button></div>
        {message ? <p role="status" className={styles.success}>{message}</p> : null}
        {error ? <p role="alert" className={styles.error}>{error}</p> : null}
      </form>
      {login ? <div role="dialog" aria-modal="true" aria-label="ورود برای ثبت درخواست" className={styles.login}><div><button type="button" aria-label="بستن" onClick={() => setLogin(false)}>×</button><h2>ورود برای ثبت درخواست</h2><AccountForm refreshAfterAuthentication={false} onAuthenticated={() => { invalidateCustomerSession(); void sendRequest(); }} /></div></div> : null}
    </div>
  </section>;
}
