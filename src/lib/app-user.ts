import { isDatabaseConnectionError, prisma } from "@/lib/prisma";

export type AppUserInput = {
  id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
};

/**
 * Ensure a single User row for this Google login.
 * Prefer id match, then email match (avoids unique email collisions when JWT sub changes).
 * Returns the canonical user id that pairings and accounts must use.
 */
export async function ensureAppUser(input: AppUserInput): Promise<string> {
  const email = input.email?.trim() || null;
  const name = input.name ?? null;
  const image = input.image ?? null;

  try {
    const byId = await prisma.user.findUnique({ where: { id: input.id } });
    if (byId) {
      await prisma.user.update({
        where: { id: byId.id },
        data: {
          email: email ?? byId.email,
          name: name ?? byId.name,
          image: image ?? byId.image,
        },
      });
      return byId.id;
    }

    if (email) {
      const byEmail = await prisma.user.findUnique({ where: { email } });
      if (byEmail) {
        await prisma.user.update({
          where: { id: byEmail.id },
          data: {
            name: name ?? byEmail.name,
            image: image ?? byEmail.image,
          },
        });
        return byEmail.id;
      }
    }

    const created = await prisma.user.create({
      data: {
        id: input.id,
        email,
        name,
        image,
      },
    });
    return created.id;
  } catch (err) {
    if (isDatabaseConnectionError(err)) {
      throw new Error(
        "Postgres is not running. In the web folder run: npm run db:up",
      );
    }

    // Race: another request created the email row first.
    if (email) {
      const byEmail = await prisma.user.findUnique({ where: { email } });
      if (byEmail) return byEmail.id;
    }
    const byId = await prisma.user.findUnique({ where: { id: input.id } });
    if (byId) return byId.id;
    throw err;
  }
}
