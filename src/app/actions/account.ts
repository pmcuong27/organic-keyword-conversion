"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { isDatabaseConnectionError, prisma } from "@/lib/prisma";
import { getGoogleAccessToken } from "@/lib/google-token";
import { getGa4PropertyTimezone } from "@/lib/data-blending/ga4";
import { PROPERTY_COOKIE } from "@/lib/properties";
import { syncLiveProperty } from "@/lib/data-blending/sync";
import { rangeToDates } from "@/lib/range";
import { isLiveGoogleMode } from "@/lib/app-mode";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("You must be signed in.");
  return session.user.id;
}

/** JWT sessions do not create Prisma users; pairings still need a User row. */
async function ensureUserRow(userId: string) {
  const session = await auth();
  try {
    await prisma.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        name: session?.user?.name ?? null,
        email: session?.user?.email ?? null,
        image: session?.user?.image ?? null,
      },
      update: {
        name: session?.user?.name ?? null,
        email: session?.user?.email ?? null,
        image: session?.user?.image ?? null,
      },
    });
  } catch (err) {
    if (isDatabaseConnectionError(err)) {
      throw new Error(
        "Postgres is not running. In the web folder run: npm run db:up",
      );
    }
    throw err;
  }
}

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/onboarding" });
}

export async function savePropertyMapping(formData: FormData) {
  const userId = await requireUserId();
  const gscSiteUrl = String(formData.get("gscSiteUrl") || "").trim();
  const ga4PropertyId = String(formData.get("ga4PropertyId") || "").trim();
  const ga4DisplayName = String(formData.get("ga4DisplayName") || "").trim();
  const name = String(formData.get("name") || "").trim() || ga4DisplayName || gscSiteUrl;

  if (!gscSiteUrl || !ga4PropertyId) {
    throw new Error("Choose both a Search Console site and a GA4 property.");
  }

  const accessToken = await getGoogleAccessToken(userId);
  const timezone = await getGa4PropertyTimezone(accessToken, ga4PropertyId);
  await ensureUserRow(userId);

  try {
    const existingCount = await prisma.propertyMapping.count({ where: { userId } });

    const mapping = await prisma.propertyMapping.upsert({
      where: {
        userId_ga4PropertyId_gscSiteUrl: { userId, ga4PropertyId, gscSiteUrl },
      },
      create: {
        userId,
        name,
        ga4PropertyId,
        ga4DisplayName: ga4DisplayName || null,
        gscSiteUrl,
        timezone,
        isDefault: existingCount === 0,
      },
      update: {
        name,
        ga4DisplayName: ga4DisplayName || null,
        timezone,
      },
    });

    const cookieStore = await cookies();
    cookieStore.set(PROPERTY_COOKIE, mapping.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  } catch (err) {
    if (isDatabaseConnectionError(err)) {
      throw new Error("Postgres is not running. In the web folder run: npm run db:up");
    }
    throw err;
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function selectPropertyAction(propertyId: string) {
  const userId = await requireUserId();
  const mapping = await prisma.propertyMapping.findFirst({
    where: { id: propertyId, userId },
  });
  if (!mapping) throw new Error("Property not found.");

  const cookieStore = await cookies();
  cookieStore.set(PROPERTY_COOKIE, mapping.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
}

export async function deletePropertyAction(propertyId: string) {
  const userId = await requireUserId();
  await prisma.propertyMapping.deleteMany({ where: { id: propertyId, userId } });
  revalidatePath("/", "layout");
}

export async function syncSelectedPropertyAction(range = "30d") {
  if (!isLiveGoogleMode()) return { ok: false as const, error: "Live Google mode is not enabled." };
  const userId = await requireUserId();
  const cookieStore = await cookies();
  const propertyId = cookieStore.get(PROPERTY_COOKIE)?.value;
  if (!propertyId) return { ok: false as const, error: "No property selected." };

  const { from, to } = rangeToDates(range);
  try {
    const result = await syncLiveProperty({ userId, propertyId, from, to });
    revalidatePath("/", "layout");
    return { ok: true as const, ...result };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
  }
}
