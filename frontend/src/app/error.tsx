"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <h1 className="text-3xl font-black">مشکلی پیش آمد</h1>
      <p className="mt-4 text-muted">در حال حاضر نمایش این بخش ممکن نیست.</p>
      <button onClick={reset} className="mt-8 min-h-11 rounded-xl bg-brand px-5 font-bold text-white">
        تلاش مجدد
      </button>
    </main>
  );
}
