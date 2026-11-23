"use client";

import { useEffect, useLayoutEffect, useState } from "react";

type Props = { images: string[]; title: string; subtitle: string };

export function PublicLoadingScreen({ images, title, subtitle }: Props) {
  const [visible, setVisible] = useState(true);
  const [imageIndex, setImageIndex] = useState(0);
  const imageUrl = images[imageIndex];
  const activeSlideIndex = images.length ? imageIndex % images.length : 0;
  const progressBars = Array.from({ length: Math.max(1, Math.min(3, images.length || 1)) }, (_, index) => index);
  useEffect(() => {
    if (!visible || images.length < 2) return;
    const advance = window.setInterval(() => setImageIndex((current) => (current + 1) % images.length), 900);
    return () => window.clearInterval(advance);
  }, [images.length, visible]);
  useLayoutEffect(() => {
    let frame = 0;
    const hideWhenReady = () => {
      // There is deliberately no minimum duration: a ready page is shown immediately.
      frame = window.requestAnimationFrame(() => setVisible(false));
    };

    if (document.readyState === "complete") {
      hideWhenReady();
    } else {
      window.addEventListener("load", hideWhenReady, { once: true });
    }

    return () => {
      window.removeEventListener("load", hideWhenReady);
      window.cancelAnimationFrame(frame);
    };
  }, []);
  if (!visible) return null;
  return <div aria-busy="true" aria-live="polite" className="fixed inset-0 z-[200] grid place-items-center overflow-hidden bg-[#f4f6fd] p-5 text-right" dir="rtl"><div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_12%,rgba(235,93,159,.16),transparent_28%),radial-gradient(circle_at_85%_78%,rgba(1,37,105,.12),transparent_32%)]" /><section className="relative w-full max-w-[27rem]"><div className="overflow-hidden rounded-[2rem] bg-white p-2 shadow-[0_24px_60px_rgba(1,37,105,.16)]"><div className="relative aspect-[4/5] overflow-hidden rounded-[1.5rem] bg-brand">{imageUrl ? <div className="absolute inset-0 bg-cover bg-center" key={imageUrl} style={{ animation: "public-loader-slide .45s ease-out both", backgroundImage: "url(" + imageUrl + ")" }} /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(235,93,159,.7),transparent_35%),linear-gradient(135deg,#012569,#2b69b2)]" />}<div className="absolute inset-0 bg-gradient-to-t from-brand/65 via-transparent to-brand/20" /><div className="absolute inset-x-5 top-5 flex gap-2" aria-hidden="true">{progressBars.map((index) => <span className={"h-1 flex-1 rounded-full transition-colors duration-300 " + (index === activeSlideIndex ? "bg-white" : "bg-white/40")} key={index} />)}</div><div className="absolute inset-x-5 bottom-5 rounded-2xl bg-brand/72 p-4 text-white backdrop-blur-sm"><p className="text-xs font-bold text-white/75">جهان باستان</p><p className="mt-1 text-lg font-black">{title}</p></div></div></div><div className="px-2 pt-6"><p className="text-2xl font-medium leading-10 text-brand sm:text-3xl">{subtitle}</p><p className="mt-2 text-base text-muted">در حال بارگذاری اطلاعات و تصاویر…</p><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-brand/10"><span className="block h-full w-2/3 animate-pulse rounded-full bg-accent-strong" /></div></div></section><style>{"@keyframes public-loader-slide{from{opacity:0;transform:translateX(-7%) scale(1.04)}to{opacity:1;transform:translateX(0) scale(1)}}@media(prefers-reduced-motion:reduce){*{animation-duration:.01ms!important}}"}</style></div>;
}
