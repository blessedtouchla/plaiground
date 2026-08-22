# PLAIGROUND

Static site. Split-sheet signing uses SignWell via `api/signwell.js`.
The PLAI voice bubble mints an xAI ephemeral token via `api/plai-session.js`.
Creator and Pro Checkout Sessions are created via `api/create-checkout-session.js`.
Artist and release calls go to ToneGrid via the server-only handler in `api/tonegrid.js`.

Vercel Hobby allows at most 12 Serverless Functions. This repo has 6, in `api/`:

- `auth.js` — signup, login, logout, schema bootstrap
- `me.js` — session user + catalog ids
- `tonegrid.js` — health, artists, releases, tracks, audio, analytics, royalties
- `create-checkout-session.js`
- `plai-session.js`
- `signwell.js`

`vercel.json` rewrites keep the public URLs (`/api/auth/signup`, `/api/me/catalog`, `/api/tonegrid/tracks/:id/audio`, and the rest).

Environment variables (set on the host; never commit values):

```
SIGNWELL_API_KEY=
SIGNWELL_TEMPLATE_ID=
XAI_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
TONEGRID_API_KEY=
TONEGRID_BASE_URL=
DATABASE_URL=
SESSION_SECRET=
```

`XAI_API_KEY`, `STRIPE_SECRET_KEY`, `TONEGRID_API_KEY`, `DATABASE_URL`, and `SESSION_SECRET` are server-only. Do not put them in frontend files. Live talk and Checkout stay off until `STRIPE_SECRET_KEY` is set on Vercel. `GET /api/create-checkout-session` may return a publishable key from `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` or `STRIPE_PUBLISHABLE_KEY` (pk only).

Accounts need `DATABASE_URL` (Postgres / Neon) and `SESSION_SECRET` (HMAC cookie). If either is missing, `/api/auth/*` and `/api/me` return `503 { "error": "Accounts are not configured." }` and the signup/login UI says that — they do not claim an account was created. Set both on Vercel before treating preview signup as live.

Account routes (server-only `DATABASE_URL` + `SESSION_SECRET`):

- `GET /api/auth` (schema bootstrap)
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`
- `POST /api/me` (store Stripe session + plan)
- `POST /api/me/catalog` (`artist_id`, `release_id`, and/or `track_id`)

ToneGrid routes (no browser key):

- `GET /api/tonegrid/health`
- `GET /api/tonegrid/artists`
- `POST /api/tonegrid/artists`
- `POST /api/tonegrid/releases`
- `POST /api/tonegrid/tracks` (create track on a release; `explicit` defaults to false)
- `POST /api/tonegrid/tracks/:id/audio` (multipart field `audio`; WAV/FLAC; max 200MB; stored by ToneGrid, not a PLAIGROUND bucket)
- `GET /api/tonegrid/analytics` (session; filtered to that user’s ToneGrid ids)
- `GET /api/tonegrid/releases` (session; filtered)
- `GET /api/tonegrid/royalties` (session; filtered)

Song audio is uploaded to ToneGrid with the existing `TONEGRID_API_KEY`. Do not add a second object store or new cloud-storage keys.

Set `TONEGRID_BASE_URL` on Vercel to the sandbox host with the `/api` prefix. Do not point this preview at production.
