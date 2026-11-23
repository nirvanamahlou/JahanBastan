"use client";

import { useEffect, useState } from "react";

import { SearchIcon } from "@/components/layout/site-icons";

function normalize(value: string) {
  return value
    .toLocaleLowerCase("fa-IR")
    .replaceAll("ي", "ی")
    .replaceAll("ك", "ک")
    .replace(/\s+/g, " ")
    .trim();
}

export function AdminContentSearch() {
  const [query, setQuery] = useState("");

useEffect(() => {
    const applyFilter = () => {
      const needle = normalize(query);
      document
        .querySelectorAll<HTMLElement>("[data-admin-search-item], article, tbody tr")
        .forEach((item) => {
          item.hidden = Boolean(needle) && !normalize(item.textContent ?? "").includes(needle);
        });
    };
    applyFilter();
    const observer = new MutationObserver(applyFilter);
    observer.observe(document.querySelector("main") ?? document.body, {
      childList: true,
      subtree: true,
    });
    return () => observer.disconnect();
  }, [query]);

  return (
    <label className="relative block w-full max-w-md">
      <span className="sr-only">جستجو در موارد ثبت‌شده این بخش</span>
      <input
        className="min-h-11 w-full rounded-xl border border-border bg-white pe-11 ps-4 text-sm font-bold outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10"
        onChange={(event) => setQuery(event.target.value)}
        placeholder="جستجو در موارد ثبت‌شده..."
        type="search"
        value={query}
      />
      <SearchIcon className="pointer-events-none absolute end-4 top-1/2 size-4 -translate-y-1/2 text-brand" />
    </label>
  );
}