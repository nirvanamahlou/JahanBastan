export const TOUR_STAGE_TYPES = [
  "شروع تور",
  "پرواز یا جابه‌جایی",
  "ورود و اقامت",
  "گشت و بازدید",
  "زمان آزاد",
  "پایان تور و بازگشت",
] as const;

const TOUR_STAGE_TYPE_LABELS: Record<string, string> = {
  start: "شروع تور",
  beginning: "شروع تور",
  outbound: "رفت",
  departure: "رفت",
  movement: "پرواز یا جابه‌جایی",
  transport: "پرواز یا جابه‌جایی",
  transfer: "پرواز یا جابه‌جایی",
  flight: "پرواز یا جابه‌جایی",
  intercity: "جابه‌جایی بین‌شهری",
  arrival: "ورود و اقامت",
  stay: "ورود و اقامت",
  accommodation: "ورود و اقامت",
  sightseeing: "گشت و بازدید",
  tour: "گشت و بازدید",
  free_time: "زمان آزاد",
  "free-time": "زمان آزاد",
  return: "برگشت",
  inbound: "برگشت",
  end: "پایان تور و بازگشت",
  finish: "پایان تور و بازگشت",
};

export function tourStageTypeLabel(value: string | null | undefined): string {
  const normalized = value?.trim();
  if (!normalized) return "";
  return TOUR_STAGE_TYPE_LABELS[normalized.toLocaleLowerCase("en-US")] ?? normalized;
}
