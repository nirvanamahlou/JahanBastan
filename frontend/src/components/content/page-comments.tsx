"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { PUBLIC_API_BASE_URL } from "@/lib/api/client";
import { isCommentablePage, normalizedPagePath } from "@/lib/reviews/page-path";

import { Container } from "../ui/container";

type PageReview = {
  id: number;
  rating: number;
  title: string | null;
  body: string;
  authorNameSnapshot: string;
  createdAt: string;
};

type AccountResponse = { user?: { fullName?: string } };

function persianDate(value: string) {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export function PageComments() {
  const pathname = usePathname();
  const pagePath = useMemo(() => normalizedPagePath(pathname), [pathname]);
  const shouldShow = useMemo(() => isCommentablePage(pathname), [pathname]);
  const [reviews, setReviews] = useState<PageReview[]>([]);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [accountChecked, setAccountChecked] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const reviewsUrl = new URL(`${PUBLIC_API_BASE_URL}/reviews`, window.location.origin);
    reviewsUrl.searchParams.set("target_type", "page");
    reviewsUrl.searchParams.set("page_path", pagePath);
    const [reviewsResponse, accountResponse] = await Promise.all([
      fetch(reviewsUrl, { cache: "no-store" }).catch(() => null),
      fetch(`${PUBLIC_API_BASE_URL}/account/me`, {
        cache: "no-store",
        credentials: "include",
      }).catch(() => null),
    ]);

    if (reviewsResponse?.ok) {
      setReviews((await reviewsResponse.json()) as PageReview[]);
    } else {
      setReviews([]);
    }
    if (accountResponse?.ok) {
      const account = (await accountResponse.json()) as AccountResponse;
      setCustomerName(account.user?.fullName ?? "کاربر");
    } else {
      setCustomerName(null);
    }
    setAccountChecked(true);
  }, [pagePath]);

  useEffect(() => {
    if (!shouldShow) return;
    const timer = window.setTimeout(() => {
      setNotice("");
      setAccountChecked(false);
      void load();
    }, 0);
    const refresh = () => void load();
    window.addEventListener("customer-authenticated", refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("customer-authenticated", refresh);
    };
  }, [load, shouldShow]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setNotice("");
    const response = await fetch(`${PUBLIC_API_BASE_URL}/account/reviews`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetType: "page",
        pagePath,
        pageTitle: document.title.split("|")[0]?.trim() || "صفحه سایت",
        rating: Number(data.get("rating")),
        title: String(data.get("title") ?? "").trim() || null,
        body: data.get("body"),
      }),
    }).catch(() => null);

    setBusy(false);
    if (response?.ok) {
      form.reset();
      setNotice("نظر شما ثبت شد و پس از تأیید مدیریت در همین صفحه نمایش داده می‌شود.");
      return;
    }
    if (response?.status === 401) {
      setCustomerName(null);
      setNotice("برای ثبت نظر ابتدا وارد حساب کاربری شوید.");
      return;
    }
    if (response?.status === 409) {
      setNotice("شما قبلاً برای این صفحه نظر ثبت کرده‌اید.");
      return;
    }
    setNotice("ثبت نظر انجام نشد. لطفاً دوباره تلاش کنید.");
  }

  if (!shouldShow) return null;

  const average = reviews.length
    ? reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length
    : 0;
  const loginHref = `/account/?returnTo=${encodeURIComponent(`${pagePath}#page-comments`)}`;

  return (
    <section className="border-t border-border bg-[linear-gradient(180deg,var(--surface-muted),var(--background))] py-10 sm:py-14" id="page-comments">
      <Container>
        <div className="rounded-3xl border border-border bg-surface p-5 shadow-[0_18px_45px_rgba(1,37,105,0.07)] sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
            <div>
              <p className="text-sm font-black text-accent">تجربه و دیدگاه کاربران</p>
              <h2 className="mt-1 text-2xl font-black text-brand">نظرهای این صفحه</h2>
              <p className="mt-2 text-sm leading-7 text-muted">نظرها پس از بررسی مدیریت منتشر می‌شوند.</p>
            </div>
            <div className="rounded-2xl bg-brand-soft px-4 py-3 text-center text-brand">
              <strong className="block text-xl font-black">{reviews.length ? average.toLocaleString("fa-IR", { maximumFractionDigits: 1 }) : "—"} ★</strong>
              <span className="text-xs font-bold">{reviews.length.toLocaleString("fa-IR")} نظر تأییدشده</span>
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="grid content-start gap-3">
              {reviews.map((review) => (
                <article className="rounded-2xl border border-border bg-white p-4" key={review.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-brand">{review.authorNameSnapshot}</strong>
                    <span aria-label={`${review.rating} از ۵ ستاره`} className="text-sm font-black text-amber-500" dir="ltr">
                      {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                    </span>
                  </div>
                  {review.title ? <h3 className="mt-3 font-black text-foreground">{review.title}</h3> : null}
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-foreground">{review.body}</p>
                  <time className="mt-3 block text-xs font-bold text-muted" dateTime={review.createdAt}>{persianDate(review.createdAt)}</time>
                </article>
              ))}
              {!reviews.length ? (
                <p className="rounded-2xl border border-dashed border-border bg-white p-7 text-center text-sm font-bold text-muted">هنوز نظر تأییدشده‌ای برای این صفحه ثبت نشده است.</p>
              ) : null}
            </div>

            <div className="h-fit rounded-2xl border border-brand/15 bg-brand-soft/55 p-4 sm:p-5">
              <h3 className="text-lg font-black text-brand">نظر شما</h3>
              {!accountChecked ? <p className="mt-3 text-sm text-muted">در حال بررسی حساب کاربری…</p> : null}
              {accountChecked && !customerName ? (
                <div className="mt-3">
                  <p className="text-sm leading-7 text-muted">برای نوشتن نظر وارد حساب کاربری خود شوید.</p>
                  <Link className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand px-4 font-black text-white" href={loginHref}>ورود یا ثبت‌نام</Link>
                </div>
              ) : null}
              {accountChecked && customerName ? (
                <form className="mt-4 grid gap-3" onSubmit={submit}>
                  <p className="text-sm font-bold text-muted">ثبت نظر با نام {customerName}</p>
                  <label className="grid gap-1 text-sm font-bold text-brand">
                    امتیاز
                    <select className="min-h-11 rounded-xl border border-border bg-white px-3" defaultValue="5" name="rating">
                      <option value="5">۵ ستاره</option><option value="4">۴ ستاره</option><option value="3">۳ ستاره</option><option value="2">۲ ستاره</option><option value="1">۱ ستاره</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm font-bold text-brand">
                    عنوان نظر <span className="font-normal text-muted">(اختیاری)</span>
                    <input className="min-h-11 rounded-xl border border-border bg-white px-3" maxLength={160} name="title" placeholder="خلاصه تجربه شما" />
                  </label>
                  <label className="grid gap-1 text-sm font-bold text-brand">
                    متن نظر
                    <textarea className="min-h-32 rounded-xl border border-border bg-white p-3 leading-7" maxLength={4000} minLength={10} name="body" placeholder="نظر خود را با حداقل ۱۰ حرف بنویسید" required />
                  </label>
                  <button className="min-h-11 rounded-xl bg-brand px-4 font-black text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={busy} type="submit">{busy ? "در حال ارسال…" : "ارسال برای تأیید"}</button>
                </form>
              ) : null}
              {notice ? <p aria-live="polite" className="mt-4 rounded-xl border border-brand/10 bg-white px-3 py-2 text-sm font-bold leading-6 text-brand" role="status">{notice}</p> : null}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
