"use client";

import { useRef, useState } from "react";

import { MediaUpload } from "@/components/admin/media-upload";
import { RichText } from "@/components/content/rich-text";

type Props = {
  defaultValue?: string | null; id?: string; label: string; minLength?: number;
  name?: string; onChange?: (value: string) => void; required?: boolean;
  rows?: number; value?: string;
};

export function RichTextEditor({ defaultValue, id, label, minLength, name, onChange, required, rows = 8, value }: Props) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const [preview, setPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const content = value ?? internalValue;

  function update(next: string) {
    if (value === undefined) setInternalValue(next);
    onChange?.(next);
  }

  function insert(prefix: string, suffix = "", fallback = "متن") {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? content.length;
    const end = textarea?.selectionEnd ?? content.length;
    const selected = content.slice(start, end) || fallback;
    update(`${content.slice(0, start)}${prefix}${selected}${suffix}${content.slice(end)}`);
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    });
  }

  const tools = [
    ["تیتر بزرگ", "\n## ", "\n", "عنوان بخش"],
    ["تیتر کوچک", "\n### ", "\n", "عنوان فرعی"],
    ["بولد", "**", "**", "متن"],
    ["ایتالیک", "*", "*", "متن"],
    ["فهرست", "\n- ", "\n", "مورد فهرست"],
    ["شماره‌دار", "\n1. ", "\n", "مورد فهرست"],
    ["نقل‌قول", "\n> ", "\n", "نقل‌قول"],
    ["لینک", "[", "](https://example.com)", "عنوان لینک"],
  ] as const;

  return (
    <div className="space-y-2">
      <label className="block text-sm font-bold" htmlFor={id}>{label}</label>
      <div className="overflow-hidden rounded-xl border border-border bg-background">
        <div aria-label={`ابزار ویرایش ${label}`} className="flex max-w-full flex-wrap gap-1 border-b border-border bg-surface-muted p-2" role="toolbar">
          {tools.map(([toolLabel, prefix, suffix, fallback]) => <button className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-bold hover:border-brand hover:text-brand" key={toolLabel} onClick={() => insert(prefix, suffix, fallback)} type="button">{toolLabel}</button>)}
          <button className="w-full rounded-lg px-2.5 py-1.5 text-xs font-bold text-brand sm:mr-auto sm:w-auto" onClick={() => setPreview((current) => !current)} type="button">{preview ? "ویرایش" : "پیش‌نمایش"}</button>
        </div>
        <textarea className={`${preview ? "hidden " : ""}min-h-40 w-full resize-y bg-background p-3 text-sm leading-7 outline-none`} id={id} minLength={minLength} name={name} onChange={(event) => update(event.target.value)} ref={textareaRef} required={required} rows={rows} value={content} />
        {preview ? <RichText className="min-h-40 p-4" content={content} /> : null}
      </div>
      <details className="rounded-xl border border-border bg-surface-muted p-3">
        <summary className="cursor-pointer text-sm font-bold">افزودن تصویر داخل متن</summary>
        <div className="mt-3"><MediaUpload currentId={null} label={`تصویر داخل ${label}`} onUploaded={(mediaId) => insert("\n![تصویر](", ")\n", `media:${mediaId}`)} /></div>
      </details>
      <p className="text-xs leading-6 text-muted">برای نمایش بهتر، تیتر و پاراگراف‌ها را با یک خط خالی از هم جدا کنید.</p>
    </div>
  );
}
