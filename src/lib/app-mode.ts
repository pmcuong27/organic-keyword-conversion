export function isDemoMode() {
  return process.env.DEMO_MODE === "true";
}

/** Local Python exporter SQLite — opt-in only, not the public default. */
export function useOfflineDb() {
  return process.env.USE_OFFLINE_DB === "true" && !isDemoMode();
}

export function isLiveGoogleMode() {
  return !isDemoMode() && !useOfflineDb();
}

export function isGoogleOAuthConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function dataSourceMode(): "demo" | "offline-db" | "live" {
  if (isDemoMode()) return "demo";
  if (useOfflineDb()) return "offline-db";
  return "live";
}
