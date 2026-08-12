import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { PropertyMapping } from "@prisma/client";

export const PROPERTY_COOKIE = "ba_property";

export type PropertyOption = {
  id: string;
  name: string;
  ga4PropertyId: string;
  ga4DisplayName: string | null;
  gscSiteUrl: string;
  timezone: string;
  lastSyncedAt: Date | null;
};

export function toPropertyOption(row: PropertyMapping): PropertyOption {
  return {
    id: row.id,
    name: row.name,
    ga4PropertyId: row.ga4PropertyId,
    ga4DisplayName: row.ga4DisplayName,
    gscSiteUrl: row.gscSiteUrl,
    timezone: row.timezone,
    lastSyncedAt: row.lastSyncedAt,
  };
}

export async function listUserProperties(userId: string): Promise<PropertyOption[]> {
  const rows = await prisma.propertyMapping.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });
  return rows.map(toPropertyOption);
}

export async function getSelectedProperty(
  userId: string,
  requestedId?: string | null,
): Promise<PropertyOption | null> {
  const mappings = await listUserProperties(userId);
  if (!mappings.length) return null;

  if (requestedId && mappings.some((m) => m.id === requestedId)) {
    return mappings.find((m) => m.id === requestedId) ?? null;
  }

  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(PROPERTY_COOKIE)?.value;
  if (fromCookie && mappings.some((m) => m.id === fromCookie)) {
    return mappings.find((m) => m.id === fromCookie) ?? null;
  }

  return mappings[0] ?? null;
}
