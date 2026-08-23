# PLAIGROUND

Static site. Split-sheet signing uses SignWell via `api/signwell.js`.
The PLAI voice bubble mints an xAI ephemeral token via `api/plai-session.js`.
Creator and Pro Checkout Sessions are created via `api/create-checkout-session.js` (`mode=subscription`, monthly or yearly). The signed Stripe webhook lives in that same file at `/api/stripe/webhook` (Hobby rewrite — not a seventh function).
Artist and release calls go to ToneGrid via the server-only handler in `api/tonegrid.js`.

Vercel Hobby allows at most 12 Serverless Functions. This repo has 6, in `api/`:

- `auth.js` — signup, login, logout, schema bootstrap, confirm mail
- `me.js` — session user + catalog ids
- `tonegrid.js` — health, artists, releases, tracks, audio, analytics, royalties
- `create-checkout-session.js` — Checkout + `/api/stripe/webhook`
- `plai-session.js`
- `signwell.js`

`vercel.json` rewrites keep the public URLs (`/api/auth/signup`, `/api/me/catalog`, `/api/tonegrid/tracks/:id/audio`, `/api/stripe/webhook`, and the rest).

Environment variables (set on the host; never commit values):

```
SIGNWELL_API_KEY=
SIGNWELL_TEMPLATE_ID=
XAI_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PUBLISHABLE_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
TONEGRID_API_KEY=
TONEGRID_BASE_URL=
DATABASE_URL=
SESSION_SECRET=
RESEND_API_KEY=
CONFIRM_SECRET=
SIGNUP_CONFIRM_SECRET=
CONFIRM_FROM=PLAIGROUND <confirm@wannaplai.com>
```

`XAI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `TONEGRID_API_KEY`, `DATABASE_URL`, `SESSION_SECRET`, `RESEND_API_KEY`, `CONFIRM_SECRET`, and `SIGNUP_CONFIRM_SECRET` are server-only. Do not put them in frontend files. No `NEXT_PUBLIC_` mail keys. Live talk and Checkout stay off until `STRIPE_SECRET_KEY` is set on Vercel. `GET /api/create-checkout-session` may return a publishable key from `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` or `STRIPE_PUBLISHABLE_KEY` (pk only).

After Checkout pays, the webhook — not the browser — sets the account to Creator or Pro. Basic stays Basic until a signed event for one of the four live prices arrives. Cancel or lapse (`customer.subscription.deleted`, or `customer.subscription.updated` with status canceled / unpaid / incomplete_expired) writes Basic.

Stripe Dashboard (you add this; the repo has no webhook secret):

1. Developers → Webhooks → Add endpoint
2. URL: `https://wannaplai.com/api/stripe/webhook`
3. Events: `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted`
4. Put the signing secret in Vercel as `STRIPE_WEBHOOK_SECRET`

Existing live prices only (do not create products or prices):

- Creator month `$14.99` `price_1U6kDm47ejpgV1ChUQ7V937J`
- Creator year `$149` `price_1U6kE547ejpgV1Chb6vtfjju`
- Pro month `$19.99` `price_1U6kDz47ejpgV1ChuxQ7yZ86`
- Pro year `$149` `price_1U6kE647ejpgV1ChsovROe7H`

Accounts need `DATABASE_URL` (Postgres / Neon) and `SESSION_SECRET` (HMAC cookie). If either is missing, `/api/auth/*` and `/api/me` return `503 { "error": "Accounts are not configured." }` and the signup/login UI says that — they do not claim an account was created. Set both on Vercel before treating preview signup as live.

Account routes (server-only `DATABASE_URL` + `SESSION_SECRET`):

- `GET /api/auth` (schema bootstrap)
- `POST /api/auth/signup` (pending user only; no session; tries confirm mail)
- `POST /api/auth/login` (confirmed users only)
- `POST /api/auth/logout`
- `POST /api/auth/confirm` (`{ token }` marks confirmed and attaches the session)
- `GET /api/auth/mail` (`{ configured }`; optional `?token=` HMAC check)
- `POST /api/auth/mail` (`{ email, artist }` resend)
- `GET /api/me`
- `POST /api/me` (store Stripe session id only; plan comes from the webhook)
- `POST /api/stripe/webhook` (Stripe-Signature; Hobby rewrite onto `create-checkout-session.js`)
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

Signup confirmation mail (same `api/auth.js` function; no `api/signup-confirm.js`):

- `POST /api/auth/signup` creates a **pending** row only. It does not attach a session and does not send the browser to `dashboard.html`.
- Resend emails `https://www.wannaplai.com/confirmed.html?email=...&token=...` (live `confirmed.html`, signed token). Clicking it calls `POST /api/auth/confirm`, marks the account confirmed, then attaches the session.
- Until confirmed, `GET /api/me` is not a finished account. Login with a pending password returns `403` and says they need to confirm (resend allowed).
- Duplicate email (pending or confirmed) is still `409`.
- Missing `RESEND_API_KEY` or a Resend failure keeps the row pending and returns `mail_sent: false`. Signup does not 500 and does not claim the email was sent.
- From address is `CONFIRM_FROM` (docs default `PLAIGROUND <confirm@wannaplai.com>`). Resend rejects Gmail from-addresses.
- HMAC uses `CONFIRM_SECRET` or `SIGNUP_CONFIRM_SECRET` (about 24 hours)
