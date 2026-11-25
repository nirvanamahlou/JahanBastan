// Retain only an opaque request key and a salted fingerprint of the confirmed submission.
const pendingKeys = new Map<string, string>();
const prefix = "jahan.direct-tour.v1.";

function readEntry(key: string) {
  try { return sessionStorage.getItem(key) ?? pendingKeys.get(key); }
  catch { return pendingKeys.get(key); }
}

function writeEntry(key: string, value: string) {
  pendingKeys.set(key, value);
  try { sessionStorage.setItem(key, value); } catch { /* Memory covers this page when storage is unavailable. */ }
}

export async function pendingDirectTourRequest(customerId: number, body: string) {
  const saltKey = prefix + "salt";
  let salt = readEntry(saltKey);
  if (!salt) {
    salt = crypto.randomUUID();
    writeEntry(saltKey, salt);
  }
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([salt, customerId, body])));
  const slot = prefix + Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
  const requestKey = readEntry(slot) ?? crypto.randomUUID();
  writeEntry(slot, requestKey);
  return { slot, requestKey };
}

export function finishDirectTourRequest(pending: { slot: string; requestKey: string }) {
  if (readEntry(pending.slot) !== pending.requestKey) return;
  pendingKeys.delete(pending.slot);
  try { sessionStorage.removeItem(pending.slot); } catch { /* Storage can be disabled. */ }
}

export function directTourAmount(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}
