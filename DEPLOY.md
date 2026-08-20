# Production deploy (HTTPS + managed Postgres)

This app stores Google OAuth refresh tokens and client analytics. Run it like a SaaS: TLS to users, TLS to the database, secrets only in the host, and a database that is not your laptop.

## 1. Prerequisites

- Private GitHub repo with this `web` project
- [Vercel](https://vercel.com) account
- [Prisma Console](https://console.prisma.io) (or Neon / similar managed Postgres)
- Google Cloud project with Search Console + Analytics APIs enabled

## 2. Create a production database

1. Create a **new** Prisma Postgres (or Neon) database in a region near your Vercel project.
2. Copy the connection string once. Prefer the pooled URL when offered.
3. Require TLS. Example shape:

```env
DATABASE_URL="postgres://USER:PASSWORD@db.prisma.io:5432/postgres?sslmode=require&pgbouncer=true&connection_limit=5"
```

Do **not** use `localhost`, `127.0.0.1`, or port `51214` in production.

4. From this folder, apply migrations against that URL (one-off shell — do not commit the URL):

```bash
# PowerShell
$env:DATABASE_URL="postgres://...sslmode=require..."
npm run db:migrate
```

Fresh databases get the full schema from `prisma/migrations`.  
If you already pushed the schema with `db push` on an empty prod DB before migrations existed, mark the baseline as applied once:

```bash
npm run db:baseline
npm run db:migrate
```

## 3. Link Vercel and set secrets

```bash
npx vercel login
npx vercel link
```

Set **Production** (and optionally separate Preview) env vars. Never commit them.

| Name | Production value |
|---|---|
| `DEMO_MODE` | `false` |
| `USE_OFFLINE_DB` | `false` |
| `DATABASE_URL` | TLS URL from step 2 |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_URL` | `https://app.yourcompany.com` (no trailing slash) |
| `GOOGLE_CLIENT_ID` | OAuth Web client id |
| `GOOGLE_CLIENT_SECRET` | OAuth Web client secret |
| `CRON_SECRET` | another `openssl rand -base64 32` |

CLI examples:

```bash
echo false | npx vercel env add DEMO_MODE production
echo false | npx vercel env add USE_OFFLINE_DB production
# then add DATABASE_URL, AUTH_SECRET, AUTH_URL, GOOGLE_*, CRON_SECRET the same way
```

Validate locally after pulling:

```bash
npx vercel env pull .env.production.local --environment=production --yes
# Load those vars in your shell, then:
npm run check:prod-env
```

## 4. Google OAuth for the production domain

1. OAuth consent screen → **In production** (complete verification when you leave test users).
2. Web client authorized redirect URI (exact):

   `https://app.yourcompany.com/api/auth/callback/google`

3. Keep `http://localhost:3000/api/auth/callback/google` only on a Testing client if you still develop locally.

Scopes stay least-privilege: `webmasters.readonly` and `analytics.readonly`.

## 5. Domain + HTTPS

1. In Vercel → Project → Domains, add `app.yourcompany.com`.
2. Point DNS as Vercel instructs. Certificate is automatic.
3. Production branch: only `main` / `master` deploys to that domain.
4. Enable **Deployment Protection** on Preview URLs so staging dashboards are not public.

Security headers (HSTS, frame deny, nosniff, referrer policy) are set in `next.config.ts`. Vercel terminates TLS.

## 6. Deploy

### Option A — Prisma Compute (GitHub connected)

This repo includes `prisma.compute.json` (Next.js standalone on port 3000).

1. Fix/push must be on `master` before merging Prisma’s setup PR (or close that PR if `prisma.compute.json` is already on `master`).
2. Keep `USE_OFFLINE_DB=false`. Do not rely on `better-sqlite3` in cloud builds (it is optional and native).
3. Set the same Production env vars in the Prisma Console as in the table above.
4. Redeploy from Console or push to `master`.

### Option B — Vercel

```bash
git push origin main
# or
npx vercel --prod
```

`npm run build` runs `prisma generate`, then `prisma migrate deploy` **only when `DATABASE_URL` is set**, then `next build`. On Prisma Compute, link the Postgres database (or set `DATABASE_URL` in app env) before expecting migrations in the build; otherwise run `npm run db:migrate` once against production after the first green deploy.

Daily sync: `vercel.json` calls `GET /api/cron/sync` at 06:00 UTC with `Authorization: Bearer $CRON_SECRET`.

## 7. Go-live checks

1. `https://app.yourcompany.com` loads with a valid certificate; HTTP redirects to HTTPS.
2. Sign in with Google once on the production domain (stores the refresh token for cron).
3. Create a GSC × GA4 pairing → **Download last 24 hours**.
4. `GET /api/cron/sync` without the bearer secret returns **401**.
5. `DEMO_MODE` is false; Query Mapping / Conversion Events show live data.
6. Next day, confirm `lastSyncedAt` moved after the 06:00 UTC cron.

## Local development vs production

| | Local | Production |
|---|---|---|
| DB | `npm run db:up` (Docker or Prisma on 51214) | Managed Postgres + TLS |
| Schema | `npm run db:migrate:dev` or `db:ensure` | `prisma migrate deploy` in build |
| Auth URL | `http://localhost:3000` | `https://your-domain` |
| Demo | `DEMO_MODE=true` OK | Must be `false` |

If your **local** database already has tables but no `_prisma_migrations` history:

```bash
npm run db:baseline
```

That records `20260820120000_init` as applied without re-running CREATE TABLE.
