# BlendAttrib

Blend Google Search Console queries with GA4 organic conversions. Pair **any** Search Console site with **any** GA4 property the signed-in Google account can access.

## Who does what

**People using the hosted app** only sign in with Google. They do **not** create a Cloud project or enable APIs.

They need:

- A Google account
- Permission on the Search Console site(s) they want to blend
- Permission on the GA4 property(ies) they want to blend (invite the same email on both if they live in different orgs)
- To approve read access when Google shows the consent screen

**You (the person who deploys this repo)** enable the APIs once on *your* Google Cloud project. The app then calls those APIs with each user's OAuth token.

## Try the UI (no Google account)

```bash
npm install
cp .env.example .env
npm run dev
```

`DEMO_MODE=true` serves generic sample data at http://localhost:3000

## Deploy once (app operator)

Do this on the Cloud project that owns the OAuth client — not on each user's account.

1. Enable in [Google Cloud Console](https://console.cloud.google.com/apis/library):
   - Google Search Console API
   - Google Analytics Admin API
   - Google Analytics Data API
2. Configure the OAuth consent screen (External).
3. Create an OAuth **Web** client. Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://your-domain/api/auth/callback/google`
4. Put the client id/secret in the server `.env` (never in the browser, never in git).
5. **Testing vs Production**
   - **Testing:** only emails listed as Test users can sign in. Fine for you and a few teammates.
   - **Anyone can click Sign in:** set the consent screen to **In production** and complete [Google's OAuth verification](https://support.google.com/cloud/answer/13463374) for `webmasters.readonly` and `analytics.readonly`. Those are sensitive scopes; unverified apps stay limited to test users.

Then run Postgres and the app:

```bash
npm run db:up
cp .env.example .env
```

`npm run db:up` starts Docker Postgres when Docker Desktop is running. If Docker is not available, it starts a local Prisma Postgres instance and writes `DATABASE_URL` for you.

```
DEMO_MODE="false"
USE_OFFLINE_DB="false"
DATABASE_URL="postgresql://blend:blend@localhost:5432/gsc_ga4_blend?schema=public"
AUTH_SECRET="replace-with-a-long-random-string"
AUTH_URL="https://your-domain"
GOOGLE_CLIENT_ID="...."
GOOGLE_CLIENT_SECRET="...."
```

```bash
npm run db:push
npm run dev
```

After deploy, users: **Sign in with Google → pick a GSC site and a GA4 property → Sync**.

## What this app does not do

- It cannot join a GSC query to a specific GA4 session or cookie. Attribution is click-share on landing page × date (and hour when that grain exists).
- It does not support two separate Google logins in one pairing. One signed-in account must be able to read both properties.

## Optional offline SQLite

For local development with the companion Python exporters, set `USE_OFFLINE_DB="true"` and `OFFLINE_DB_PATH` to a SQLite file. Do not commit that database.

## License

Use and modify freely. Do not commit `.env`, OAuth client secrets, or exported analytics databases.
