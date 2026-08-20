export type OrganicSourceGroup = "google" | "other-engine";

/** Google web/app search sources that can overlap with Search Console clicks. */
export function isGoogleSearchSource(source?: string | null): boolean {
  const s = (source || "").trim().toLowerCase();
  if (!s || s === "(direct)" || s === "(none)" || s === "(not set)") return false;
  if (s === "google" || s.startsWith("google.") || s.startsWith("google/")) return true;
  if (/^google(\s|\/|$)/.test(s)) return true;
  if (s.includes(".google.")) return true;
  if (s.startsWith("com.google.")) return true;
  return false;
}

/**
 * Empty source is legacy rows from before sessionSource was stored.
 * Keep those in the Google join so existing syncs do not go blank until re-download.
 */
export function isGoogleOrganicForJoin(source?: string | null): boolean {
  const s = (source || "").trim();
  if (!s) return true;
  return isGoogleSearchSource(s);
}

export function classifyOrganicSource(source?: string | null): OrganicSourceGroup {
  return isGoogleOrganicForJoin(source) ? "google" : "other-engine";
}

export function organicSourceLabel(source?: string | null): string {
  return classifyOrganicSource(source) === "google" ? "Google" : "Other Engine";
}

export function organicSourceDetail(source?: string | null): string | null {
  if (classifyOrganicSource(source) === "google") return null;
  const s = (source || "").trim();
  return s || null;
}
