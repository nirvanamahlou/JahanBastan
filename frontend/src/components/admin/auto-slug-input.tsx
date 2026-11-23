"use client";

import { useEffect, useRef, type InputHTMLAttributes } from "react";
import { slugFromTitle } from "@/lib/title-slug";

type Props = Pick<InputHTMLAttributes<HTMLInputElement>, "className" | "id" | "defaultValue" | "disabled"> & {
  name?: "slug";
  sourceName?: "title" | "name";
  sourceValue?: string;
  maxLength: number;
};

export function AutoSlugInput({ name = "slug", sourceName = "title", sourceValue, maxLength, defaultValue, ...props }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const manuallyEdited = useRef(Boolean(defaultValue));

  useEffect(() => {
    const input = inputRef.current;
    const form = input?.form;
    if (!input || !form || input.disabled) return;

    function sync() {
      if (!input || !form || manuallyEdited.current) return;
      const source = form.elements.namedItem(sourceName);
      if (sourceValue !== undefined) input.value = slugFromTitle(sourceValue, maxLength);
      else if (source instanceof HTMLInputElement) input.value = slugFromTitle(source.value, maxLength);
    }

    function onFormInput(event: Event) {
      if (event.target === form?.elements.namedItem(sourceName)) sync();
    }

    function onReset() {
      manuallyEdited.current = Boolean(defaultValue);
    }

    sync();
    form.addEventListener("input", onFormInput);
    form.addEventListener("reset", onReset);
    return () => {
      form.removeEventListener("input", onFormInput);
      form.removeEventListener("reset", onReset);
    };
  }, [defaultValue, maxLength, props.disabled, sourceName, sourceValue]);

  return <input {...props} ref={inputRef} name={name} dir="ltr"
    defaultValue={defaultValue} maxLength={maxLength} required
    aria-label="نشانی صفحه (اسلاگ)" placeholder="از عنوان ساخته می‌شود"
    pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
    onInput={() => { manuallyEdited.current = true; }} />;
}
