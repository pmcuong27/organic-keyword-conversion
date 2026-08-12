import { subDays } from "date-fns";

export function rangeToDates(range: string) {
  const to = new Date();
  if (range === "24h") {
    const from = subDays(to, 1);
    return { from, to, days: 2 };
  }
  const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  const from = subDays(to, days - 1);
  return { from, to, days };
}

export function toDateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Use GSC/GA4 hourly dimensions for short windows (e.g. Last 24 hours). */
export function shouldUseHourlySync(from: Date, to: Date) {
  const spanDays = (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
  return spanDays <= 2.5;
}

export function hourToStorage(hour: string | null | undefined) {
  return hour && hour.length ? hour : "";
}

export function hourFromStorage(hour: string | null | undefined): string | null {
  return hour && hour.length ? hour : null;
}
