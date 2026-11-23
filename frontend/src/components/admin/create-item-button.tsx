"use client";

import { Button } from "@/components/ui/button";

type Props = {
  formId: string;
  label: string;
  onCreate: () => void;
};

export function CreateItemButton({ formId, label, onCreate }: Props) {
  function startCreating() {
    onCreate();
    window.requestAnimationFrame(() => {
      const form = document.getElementById(formId);
      if (!(form instanceof HTMLFormElement)) return;
      form.reset();
      form.scrollIntoView({ behavior: "smooth", block: "start" });
      const firstField = form.querySelector<HTMLElement>(
        'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])',
      );
      firstField?.focus({ preventScroll: true });
    });
  }

  return (
    <Button
      aria-label={`افزودن ${label}`}
      className="shrink-0"
      onClick={startCreating}
      size="sm"
      type="button"
      variant="secondary"
    >
      <span aria-hidden="true">＋</span>
      افزودن {label}
    </Button>
  );
}
