"use client";

import { useState } from "react";
import { RichText } from "@/components/content/rich-text";

type AccordionItem = {
  id: string;
  title: string;
  content: string;
};

export function Accordion({ items }: { items: ReadonlyArray<AccordionItem> }) {
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null);

  return (
    <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
      {items.map((item) => {
        const isOpen = openId === item.id;
        return (
          <section key={item.id}>
            <h2>
              <button
                type="button"
                className="flex min-h-16 w-full items-center justify-between gap-4 px-5 py-4 text-right font-black hover:bg-surface-muted"
                aria-expanded={isOpen}
                aria-controls={`${item.id}-panel`}
                onClick={() => setOpenId(isOpen ? null : item.id)}
              >
                {item.title}
                <span className="text-xl" aria-hidden="true">{isOpen ? "−" : "+"}</span>
              </button>
            </h2>
            <div id={`${item.id}-panel`} hidden={!isOpen} className="px-5 pb-5 text-sm leading-8 text-muted">
              <RichText content={item.content} />
            </div>
          </section>
        );
      })}
    </div>
  );
}
