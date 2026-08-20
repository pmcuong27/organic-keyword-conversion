/** Shared bucket keys and GSC/GA4 dimension normalization for hourly joins. */

export function normalizeHour(hour?: string | null): string | null {
  if (hour === undefined || hour === null || hour === "") return null;
  const n = Number(hour);
  if (Number.isFinite(n)) {
    return String(Math.max(0, Math.min(23, Math.floor(n)))).padStart(2, "0");
  }
  return hour.slice(0, 2).padStart(2, "0");
}

export function normalizeDevice(device?: string | null): string | null {
  if (!device) return null;
  const d = device.trim().toUpperCase();
  if (d === "DESKTOP" || d === "MOBILE" || d === "TABLET") return d;
  if (d.includes("MOBILE")) return "MOBILE";
  if (d.includes("TABLET")) return "TABLET";
  if (d.includes("DESKTOP")) return "DESKTOP";
  return d;
}

const ALPHA3_TO_ALPHA2: Record<string, string> = {
  NZL: "NZ",
  AUS: "AU",
  USA: "US",
  GBR: "GB",
  CAN: "CA",
  DEU: "DE",
  FRA: "FR",
  IND: "IN",
  JPN: "JP",
  CHN: "CN",
  BRA: "BR",
  MEX: "MX",
  ESP: "ES",
  ITA: "IT",
  NLD: "NL",
  SWE: "SE",
  NOR: "NO",
  DNK: "DK",
  FIN: "FI",
  IRL: "IE",
  SGP: "SG",
  HKG: "HK",
  KOR: "KR",
  ZAF: "ZA",
  ARE: "AE",
  SAU: "SA",
  PHL: "PH",
  THA: "TH",
  MYS: "MY",
  IDN: "ID",
  VNM: "VN",
  POL: "PL",
  PRT: "PT",
  CHE: "CH",
  AUT: "AT",
  BEL: "BE",
  ISR: "IL",
  TUR: "TR",
  RUS: "RU",
  UKR: "UA",
  ARG: "AR",
  CHL: "CL",
  COL: "CO",
  PER: "PE",
};

/** GSC country is ISO alpha-3; GA4 countryId is alpha-2. */
export function normalizeCountry(country?: string | null): string | null {
  if (!country) return null;
  const c = country.trim().toUpperCase();
  if (c.length === 3 && ALPHA3_TO_ALPHA2[c]) return ALPHA3_TO_ALPHA2[c];
  if (c.length === 2) return c;
  return c;
}

/**
 * GSC HOUR keys are Pacific (America/Los_Angeles). GA4 dateHour uses the property timezone.
 * Convert the GSC timestamp to { date, hour } in the target timezone for joining.
 */
export function convertGscHourToTimezone(
  hourRaw: string | undefined,
  targetTimezone: string,
): { date: string; hour: string | null } {
  if (!hourRaw) return { date: "", hour: null };

  const isoMatch = hourRaw.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):/);
  if (!isoMatch) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(hourRaw)) {
      return { date: hourRaw, hour: null };
    }
    return { date: hourRaw.slice(0, 10), hour: normalizeHour(hourRaw) };
  }

  const parsed = new Date(hourRaw);
  if (Number.isNaN(parsed.getTime())) {
    return { date: isoMatch[1], hour: isoMatch[2] };
  }

  const tz = targetTimezone || "UTC";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(parsed);

  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const year = pick("year");
  const month = pick("month");
  const day = pick("day");
  let hour = pick("hour");
  if (hour === "24") hour = "00";

  return {
    date: `${year}-${month}-${day}`,
    hour: normalizeHour(hour),
  };
}

export function attributionBucketKey(params: {
  date: string;
  hour: string | null;
  landingPage: string;
  device?: string | null;
  country?: string | null;
}) {
  const device = normalizeDevice(params.device) ?? "*";
  const country = normalizeCountry(params.country) ?? "*";
  return `${params.date}::${params.hour ?? "all"}::${params.landingPage}::${device}::${country}`;
}

export function bucketHasSegmentation(key: string) {
  const parts = key.split("::");
  return parts.length >= 5 && parts[3] !== "*" && parts[4] !== "*";
}
