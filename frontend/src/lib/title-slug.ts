const persianLetters: Record<string, string> = {
  آ: "a", ا: "a", أ: "a", إ: "a", ب: "b", پ: "p", ت: "t", ث: "s",
  ج: "j", چ: "ch", ح: "h", خ: "kh", د: "d", ذ: "z", ر: "r", ز: "z",
  ژ: "zh", س: "s", ش: "sh", ص: "s", ض: "z", ط: "t", ظ: "z", ع: "a",
  غ: "gh", ف: "f", ق: "gh", ک: "k", ك: "k", گ: "g", ل: "l", م: "m",
  ن: "n", و: "u", ه: "h", ة: "h", ی: "y", ي: "y", ى: "y", ئ: "y", ؤ: "u",
};

export function slugFromTitle(title: string, maxLength: number): string {
  const normalized = title.trim().normalize("NFC");
  if (!normalized) return "";
  const slug = Array.from(normalized, char => persianLetters[char] ?? char).join("")
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 1632))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  // Keep titles written in other scripts usable with the existing ASCII URL contract.
  const fallback = `item-${Array.from(normalized, char => char.codePointAt(0)!.toString(36)).join("-")}`;
  return (slug || fallback).slice(0, maxLength).replace(/-+$/, "");
}

/** PATCH the URL only when the title itself changed. */
export function slugOnTitleEdit(title: unknown, previousTitle: string | undefined, maxLength: number): string | undefined {
  if (typeof title !== "string" || title.trim() === previousTitle?.trim()) return undefined;
  return slugFromTitle(title, maxLength) || undefined;
}
