export const communicationChannels = [
  { key: "instagram", label: "اینستاگرام" },
  { key: "telegram", label: "تلگرام" },
  { key: "app", label: "اپلیکیشن" },
  { key: "whatsapp", label: "واتساپ" },
] as const;

export function communicationBannerHref(value: string | undefined): string | null {
  const href = value?.trim();
  if (!href) return null;
  if (/^\/(?![\/\\])[^\\\s]*$/.test(href)) return href;
  try {
    const url = new URL(href);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
