import { auth } from "@/auth";
import { isDemoMode, isLiveGoogleMode, useOfflineDb } from "@/lib/app-mode";
import { getSelectedProperty, listUserProperties } from "@/lib/properties";
import type { PropertyOption } from "@/lib/properties";

export async function getDashboardContext(requestedPropertyId?: string | null): Promise<{
  userId: string | null;
  property: PropertyOption | null;
  properties: PropertyOption[];
  mode: "demo" | "offline-db" | "live";
}> {
  if (isDemoMode()) {
    return { userId: "demo", property: null, properties: [], mode: "demo" };
  }
  if (useOfflineDb()) {
    return { userId: null, property: null, properties: [], mode: "offline-db" };
  }

  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId || !isLiveGoogleMode()) {
    return { userId, property: null, properties: [], mode: "live" };
  }

  const properties = await listUserProperties(userId);
  const property = await getSelectedProperty(userId, requestedPropertyId);
  return { userId, property, properties, mode: "live" };
}
