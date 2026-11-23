"use client";
import { type ReactNode, useMemo, useState } from "react";
export function SearchableTicketDestinations({ children, labels }: { children: ReactNode[]; labels: string[] }) {
  const [query,setQuery]=useState(""); const visible=useMemo(()=>labels.map((label)=>label.includes(query.trim())),[labels,query]);
  return <><label className="mt-5 block max-w-md text-sm font-black text-brand">جستجوی شهر<input className="mt-2 min-h-11 w-full rounded-xl border border-border bg-white px-4 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/10" onChange={(event)=>setQuery(event.target.value)} placeholder="نام شهر مقصد را بنویسید" type="search" value={query}/></label><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{children.map((child,index)=>visible[index]?child:null)}</div></>;
}