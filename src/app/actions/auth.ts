"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signOut } from "@/auth";

const AUTH_COOKIES = [
  "authjs.session-token",
  "authjs.callback-url",
  "authjs.csrf-token",
  "__Secure-authjs.session-token",
  "__Host-authjs.csrf-token",
  "next-auth.session-token",
  "next-auth.callback-url",
  "next-auth.csrf-token",
  "__Secure-next-auth.session-token",
];

export async function signOutAction() {
  try {
    await signOut({ redirect: false });
  } catch {
    // No session, or Auth.js has no Google provider configured.
  }

  const jar = await cookies();
  for (const name of AUTH_COOKIES) {
    jar.delete(name);
  }

  redirect("/login");
}
