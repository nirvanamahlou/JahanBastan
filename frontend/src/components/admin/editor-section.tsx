import type { ReactNode } from "react";

export function EditorSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0 rounded-2xl border border-border bg-surface p-4 sm:p-6">
      <legend className="max-w-full px-2 text-lg font-black sm:text-xl">{title}</legend>
      {description ? <p className="mb-5 text-sm text-muted">{description}</p> : null}
      <div className="grid gap-5">{children}</div>
    </fieldset>
  );
}
