"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function JalaliCalendarModal({ ariaLabel, children, fitViewport = false, onClose }: { ariaLabel: string; children: ReactNode; fitViewport?: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => dialogRef.current?.focus(), 0);

    function handleKeyboard(event: KeyboardEvent) {
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyboard);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyboard);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      aria-label={ariaLabel}
      aria-modal="true"
      className={`fixed inset-0 z-[1100] grid place-items-center bg-slate-950/35 backdrop-blur-md ${fitViewport ? "p-2" : "overflow-y-auto p-3 sm:p-6"}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      ref={dialogRef}
      role="dialog"
      tabIndex={-1}
    >
      {children}
    </div>,
    document.body,
  );
}
