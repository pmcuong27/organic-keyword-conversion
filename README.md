# BlendAttrib

Blend Google Search Console queries with GA4 organic conversions. Pair **any** Search Console site with **any** GA4 property the signed-in Google account can access.

## Try the UI (no Google account)

```bash
npm install
cp .env.example .env
npm run dev
```

`DEMO_MODE=true` serves generic sample data at http://localhost:3000

## Live Google accounts

The Google account you sign in with must have access to **both** the Search Console site and the GA4 property you want to blend. If they live in different organizations, invite that same user on both properties.

1. Create a Google Cloud project and enable:
   - Google Search Console API
   - Google Analytics Admin API
   - Google Analytics Data API
2. Create an OAuth **Web** client. Add authorized redirect URI:
   - `http://localhost:3000/api/auth/callback/google`
   - plus your production origin, e.g. `https://your-domain/api/auth/callback/google`
3. If the OAuth app is in Testing, add each user under **Audience → Test users**.
4. Start Postgres and configure env:

```bash
npm run db:up
cp .env.example .env
```

Set in `.env`:

```
DEMO_MODE="false"
USE_OFFLINE_DB="false"
DATABASE_URL="postgresql://blend:blend@localhost:5432/gsc_ga4_blend?schema=public"
AUTH_SECRET="replace-with-a-long-random-string"
AUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="...."
GOOGLE_CLIENT_SECRET="...."
```

5. Push the schema and run:

```bash
npm run db:push
npm run dev
```

6. Sign in with Google, then pick one GSC site and one GA4 property. Add more pairings in **Settings** (agencies / multiple brands).

Use **Sync** in the header to refresh the selected date range from Google.

## What this app does not do

- It cannot join a GSC query to a specific GA4 session or cookie. Attribution is click-share on landing page × date (and hour when that grain exists).
- It does not support two separate Google logins in one pairing. One signed-in account must be able to read both properties.

## Optional offline SQLite

For local development with the companion Python exporters, set `USE_OFFLINE_DB="true"` and `OFFLINE_DB_PATH` to a SQLite file. Do not commit that database.

## License

Use and modify freely. Do not commit `.env`, OAuth client secrets, or exported analytics databases.
