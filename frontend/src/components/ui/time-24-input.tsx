"use client";

import type { InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: string;
  onValueChange: (value: string) => void;
};

export function Time24Input({ value, onValueChange, ...props }: Props) {
  return <input {...props} type="text" dir="ltr" inputMode="text" maxLength={5}
    placeholder={props.placeholder ?? "HH:mm — ۲۴ ساعته"}
    pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
    title="ساعت ۲۴ ساعته وارد کنید؛ مثلاً ۰۹:۳۰ یا ۲۱:۳۰"
    value={value}
    onChange={event => {
      let text = event.target.value.replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 1776)).replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 1632));
      if (/^\d{4}$/.test(text)) text = `${text.slice(0, 2)}:${text.slice(2)}`;
      if (/^\d:\d{2}$/.test(text)) text = `0${text}`;
      onValueChange(text);
    }} />;
}
