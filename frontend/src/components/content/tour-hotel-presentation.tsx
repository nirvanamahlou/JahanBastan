import type { ReactNode } from "react";
import Link from "next/link";
import { HotelStars } from "./hotel-stars";
import { TourHotelGallery } from "./tour-hotel-gallery";

type Props = {name:string; href?:string; images:string[]; location:string; stars?:number; summary?:string|null; facilities?:string|null; badges:ReactNode; amenities:ReactNode};
export function TourHotelPresentation({name,href,images,location,stars,summary,facilities,badges,amenities}:Props) {
  return (
                <div>
                  <TourHotelGallery name={name} gallery={images} />
                  <div className="min-w-0 p-3 sm:p-4">
                    <div className="flex flex-wrap items-start justify-between gap-x-5 gap-y-3">
                      <div className="min-w-0 flex-1 basis-64">
                        {href ? <Link className="text-xl font-black text-brand hover:text-accent-strong" href={href}>{name}</Link> : <h3 className="text-xl font-black text-brand">{name}</h3>}
                        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">{location}</p>
                      </div>
                      <div className="flex max-w-full flex-wrap items-center gap-2">
                        {badges}
                        <span className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-[#e3edf9] bg-white px-3">
                          <HotelStars rating={stars ?? 0} size="md" />
                          <span className="whitespace-nowrap text-xs text-muted">هتل {stars?.toLocaleString("fa-IR")} ستاره</span>
                        </span>
                      </div>
                    </div>
                    {amenities}
                    <div className="mt-3 flex flex-wrap items-start gap-2 border-t border-dashed border-border pt-3">
                      {summary ? <p className="min-w-0 flex-1 basis-72 line-clamp-2 text-sm leading-6 text-muted">{summary}</p> : null}
                      {facilities ? <details className="min-w-44 flex-1 basis-56 rounded-xl bg-[#f4f8ff] px-3 py-2.5 text-sm sm:max-w-md"><summary className="cursor-pointer font-black text-brand">امکانات هتل</summary><p className="mt-2 line-clamp-3 leading-6 text-muted">{facilities}</p></details> : null}
                      {href && <Link className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#fff0f6] px-4 text-sm font-black text-[#e6236c] transition hover:bg-[#f12b75] hover:text-white" href={href}>
                        مشاهده جزئیات هتل <span aria-hidden="true">←</span>
                      </Link>}
                    </div>
                  </div>
                </div>
  );
}
