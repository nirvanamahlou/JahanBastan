const latinDigits = new Map([
  ["۰", "0"], ["۱", "1"], ["۲", "2"], ["۳", "3"], ["۴", "4"],
  ["۵", "5"], ["۶", "6"], ["۷", "7"], ["۸", "8"], ["۹", "9"],
  ["٠", "0"], ["١", "1"], ["٢", "2"], ["٣", "3"], ["٤", "4"],
  ["٥", "5"], ["٦", "6"], ["٧", "7"], ["٨", "8"], ["٩", "9"],
]);

const partsFormatter = new Intl.DateTimeFormat("en-US-u-ca-persian", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
  year: "numeric",
});

const displayFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  dateStyle: "long",
  timeZone: "Asia/Tehran",
});

const displayDateTimeFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Tehran",
});

export function formatPersianDate(value: string | Date): string {
  const date = typeof value === "string" ? parseIsoDate(value) : value;
  return displayFormatter.format(date);
}

export function formatPersianDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? parseIsoDate(value) : value;
  return Number.isNaN(date.getTime()) ? "—" : displayDateTimeFormatter.format(date);
}

export function isoToJalaliInput(value: string | null): string {
  if (!value) return "";
  const parts = persianParts(parseIsoDate(value));
  return `${parts.year}/${pad(parts.month)}/${pad(parts.day)}`;
}

export function jalaliInputToIso(value: string): string | null {
  const normalized = [...value.trim()]
    .map((character) => latinDigits.get(character) ?? character)
    .join("")
    .replaceAll("-", "/");
  const match = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(normalized);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const newYearSearch = new Date(Date.UTC(year + 621, 2, 18));
  let farvardinFirst: Date | null = null;
  for (let offset = 0; offset < 8; offset += 1) {
    const candidate = addUtcDays(newYearSearch, offset);
    const parts = persianParts(candidate);
    if (parts.year === year && parts.month === 1 && parts.day === 1) {
      farvardinFirst = candidate;
      break;
    }
  }
  if (!farvardinFirst) return null;
  const dayOfYear = month <= 6
    ? (month - 1) * 31 + day - 1
    : 186 + (month - 7) * 30 + day - 1;
  const result = addUtcDays(farvardinFirst, dayOfYear);
  const verified = persianParts(result);
  if (verified.year !== year || verified.month !== month || verified.day !== day) {
    return null;
  }
  return result.toISOString().slice(0, 10);
}

function parseIsoDate(value: string): Date {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  return new Date(dateOnly ? `${value}T12:00:00Z` : value);
}

function persianParts(date: Date) {
  const parts = Object.fromEntries(
    partsFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return { year: parts.year, month: parts.month, day: parts.day };
}

function addUtcDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function pad(value: number) {
  return value.toString().padStart(2, "0");
}
