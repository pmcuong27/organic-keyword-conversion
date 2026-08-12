import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

const scopes = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/analytics.readonly",
].join(" ");

const demoMode = process.env.DEMO_MODE === "true";
const offlineMode =
  process.env.USE_OFFLINE_DB === "true" || demoMode;
// Offline SQLite dashboard doesn't need Postgres/Auth.js adapter
const skipDbAuth = offlineMode;

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: skipDbAuth ? undefined : PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID || "demo",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "demo",
      authorization: {
        params: {
          scope: scopes,
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  session: { strategy: skipDbAuth ? "jwt" : "database" },
  callbacks: {
    async session({ session, user, token }) {
      if (session.user) {
        session.user.id = user?.id ?? (token.sub as string) ?? "offline";
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  trustHost: true,
});
