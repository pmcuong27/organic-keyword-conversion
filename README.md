# BlendAttrib (Next.js)

GSC × GA4 keyword-to-conversion attribution dashboard.

## Quick start (demo)

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3000 — `DEMO_MODE=true` serves seeded attribution data without Google OAuth or Postgres.

## Full stack (live Google + Postgres)

1. `npm run db:up` (Docker Postgres)
2. Copy `.env.example` → `.env` and set:
   - `DATABASE_URL`
   - `AUTH_SECRET`
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (Web client, redirect `http://localhost:3000/api/auth/callback/google`)
   - `DEMO_MODE=false`
3. Enable Google Analytics Data API, Admin API, Search Console API
4. `npm run db:push`
5. `npm run dev`

## Features

- WhatConverts-style shell (sidebar, sticky header, Cmd+K)
- URL normalizer + click-share attribution model
- Virtualized keyword table (TanStack Table + Virtual)
- Suspense skeletons, `useTransition` for filter updates
- Overview KPIs + dual-axis clicks vs conversions chart
