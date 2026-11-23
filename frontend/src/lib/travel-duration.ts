function minutesFromTime(value: string | null | undefined): number | null {
  if (!value) return null;

  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours > 23 || minutes > 59) {
    return null;
  }

  return (hours * 60) + minutes;
}

/** Formats a duration in minutes in a concise Persian hour-and-minute form. */
export function formatDurationMinutes(durationMinutes: number | null | undefined): string | null {
  if (typeof durationMinutes !== "number" || !Number.isInteger(durationMinutes) || durationMinutes < 0) return null;

  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  const segments: string[] = [];

  if (hours > 0) segments.push(`${hours.toLocaleString("fa-IR")} ساعت`);
  if (minutes > 0 || segments.length === 0) segments.push(`${minutes.toLocaleString("fa-IR")} دقیقه`);

  return segments.join(" و ");
}

/** Returns a Persian duration calculated from local departure and arrival times. */
export function formatTravelDuration(
  departureTime: string | null | undefined,
  arrivalTime: string | null | undefined,
): string | null {
  const departureMinutes = minutesFromTime(departureTime);
  const arrivalMinutes = minutesFromTime(arrivalTime);
  if (departureMinutes === null || arrivalMinutes === null) return null;

  const durationMinutes = (arrivalMinutes - departureMinutes + (24 * 60)) % (24 * 60);
  return formatDurationMinutes(durationMinutes);
}
