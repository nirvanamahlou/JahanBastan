"use client";

import { type ReactNode, useState } from "react";

type TabItem = {
  id: string;
  label: string;
  content: ReactNode;
};

export function Tabs({ items, label }: { items: ReadonlyArray<TabItem>; label: string }) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");
  const activeItem = items.find((item) => item.id === activeId);

  return (
    <div>
      <div role="tablist" aria-label={label} className="flex gap-2 overflow-x-auto border-b border-border">
        {items.map((item) => (
          <button
            key={item.id}
            id={`${item.id}-tab`}
            type="button"
            role="tab"
            aria-selected={activeId === item.id}
            aria-controls={`${item.id}-panel`}
            onClick={() => setActiveId(item.id)}
            className={`min-h-12 shrink-0 border-b-2 px-4 text-sm font-bold ${
              activeId === item.id ? "border-brand text-brand" : "border-transparent text-muted hover:text-brand"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {activeItem ? (
        <div id={`${activeItem.id}-panel`} role="tabpanel" aria-labelledby={`${activeItem.id}-tab`} className="py-5">
          {activeItem.content}
        </div>
      ) : null}
    </div>
  );
}
