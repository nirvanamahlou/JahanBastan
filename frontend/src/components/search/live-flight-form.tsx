"use client";

import { useEffect, useRef, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export function LiveFlightForm({ children, className }: { children: ReactNode; className?: string }) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const queued = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [pending, startTransition] = useTransition();

  function apply() {
    clearTimeout(queued.current);
    if (!form.current) return;
    const query = new URLSearchParams();
    const data = new FormData(form.current);
    data.forEach((value, name) => {
      if (name !== "airline" && typeof value === "string" && value.trim()) query.set(name, value.trim());
    });
    const airlines = data.getAll("airline");
    if (airlines.length) query.set("airlines", airlines.join("|"));
    const next = `/services/flights/?${query}`;
    if (location.pathname + location.search === next) return;
    startTransition(() => router.replace(next, { scroll: false }));
  }

  useEffect(() => () => clearTimeout(queued.current), []);

  return (
    <form
      action="/services/flights/"
      aria-busy={pending}
      className={className}
      data-live-flight-form
      onChange={(event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
        if (!target.name && target.type !== "range") return;
        clearTimeout(queued.current);
        queued.current = setTimeout(apply, target instanceof HTMLSelectElement || ["radio", "checkbox"].includes(target.type) ? 0 : 450);
      }}
      onSubmit={(event) => { event.preventDefault(); apply(); }}
      ref={form}
    >
      {children}
    </form>
  );
}
