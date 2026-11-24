"use client";

import { type ReactNode, useEffect, useId, useRef } from "react";

import { Button } from "./button";

type DialogProps = {
  open: boolean;
  compact?: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
};

export function Dialog({ open, title, description, children, onClose, compact = false }: DialogProps) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onCancel={onClose}
      onClose={onClose}
      className={`m-auto max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-border bg-surface p-0 text-foreground shadow-2xl backdrop:bg-brand/45 ${compact ? "w-[min(27rem,calc(100%-2rem))] backdrop:backdrop-blur-sm" : "w-[min(42rem,calc(100%-2rem))]"}`}
      aria-labelledby={id + "-title"}
      aria-describedby={description ? id + "-description" : undefined}
    >
      <div className="flex items-start justify-between gap-4 border-b border-border p-5">
        <div>
          <h2 id={id + "-title"} className="text-xl font-black">{title}</h2>
          {description ? <p id={id + "-description"} className="mt-1 text-sm text-muted">{description}</p> : null}
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="بستن پنجره">×</Button>
      </div>
      <div className="p-5">{children}</div>
    </dialog>
  );
}

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "تایید",
  destructive = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} title={title} description={description} onClose={onClose}>
      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <Button variant="secondary" onClick={onClose}>انصراف</Button>
        <Button variant={destructive ? "danger" : "primary"} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Dialog>
  );
}
