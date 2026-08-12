import { subDays } from "date-fns";

export function rangeToDates(range: string) {
  const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  const to = new Date();
  const from = subDays(to, days - 1);
  return { from, to, days };
}

export function toDateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}
