export const YEKTANET_SIGNUP_TAG = "cce247b8-3f91-4b2d-a40d-3cbdc6c0f831";
export const YEKTANET_INSTALL_TAG = "6f4803bd-0482-4ebe-9620-c199e7e8e14d";

type YektanetWindow = Window & {
  yektanet?: { event?: (tagId: string) => void };
  yektanetManualTags?: string[];
};

// Send only the tag ID; account details and form values never enter analytics.
export function sendYektanetEvent(tagId: string): void {
  if (typeof window === "undefined" || process.env.NODE_ENV !== "production") return;
  if (!["jahanbastan.ir", "www.jahanbastan.ir"].includes(window.location.hostname)) return;
  try {
    const target = window as YektanetWindow;
    if (typeof target.yektanet?.event === "function") target.yektanet.event(tagId);
    else (target.yektanetManualTags ??= []).push(tagId);
  } catch {
    // An unavailable analytics service must not interrupt registration or install.
  }
}
