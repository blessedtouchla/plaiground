# PLAIGROUND

Static site. Split-sheet signing uses SignWell via `api/signwell.js`.
The PLAI voice bubble mints an xAI ephemeral token via `api/plai-session.js`.
Creator and Pro Checkout Sessions are created via `api/create-checkout-session.js` (`mode=subscription`, monthly or yearly). Settings → Manage plan redirects to `plan-confirm.html`. Submit there updates the subscription (`action=switch`). Preview (`action=preview`) does not charge. Settings → Manage billing opens the Stripe Customer Billing Portal (`action=portal`) to update the card. No Stripe customer means no card on file — the site does not invent a portal. The signed Stripe webhook lives in that same file at `/api/stripe/webhook` (Hobby rewrite — not a seventh function). Stripe does not follow redirects, so POST is accepted on both `https://wannaplai.com/api/stripe/webhook` and `https://www.wannaplai.com/api/stripe/webhook`. Other apex pages may still 308 to www.
Artist and release calls go to ToneGrid via the server-only handler in `api/tonegrid.js`.

Vercel Hobby allows at most 12 Serverless Functions. This repo has 6, in `api/`:

- `auth.js` — signup, login, logout, schema bootstrap, confirm mail
- `me.js` — session user + catalog ids
- `tonegrid.js` — health, stores, artists, releases, submit, dsps, artwork, tracks, audio, analytics, royalties
- `create-checkout-session.js` — Checkout, Manage-plan switch, Manage-billing portal, `/api/stripe/webhook`
- `plai-session.js`
- `signwell.js`

`vercel.json` rewrites keep the public URLs (`/api/auth/signup`, `/api/me/catalog`, `/api/me/problem`, `/api/signwell/:id`, `/api/tonegrid/releases/:id/submit`, `/api/tonegrid/tracks/:id/audio`, `/api/stripe/webhook`, and the rest). No extra Serverless Function files.

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
META_PIXEL_ID=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_ENDPOINT=
```

`XAI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `TONEGRID_API_KEY`, `DATABASE_URL`, `SESSION_SECRET`, `RESEND_API_KEY`, `CONFIRM_SECRET`, `SIGNUP_CONFIRM_SECRET`, `META_PIXEL_ID`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, and `R2_ENDPOINT` are server-only. Do not put them in frontend files. No `NEXT_PUBLIC_` mail keys. No `NEXT_PUBLIC_R2_*`. Live talk and Checkout stay off until `STRIPE_SECRET_KEY` is set on Vercel. `GET /api/create-checkout-session` may return a publishable key from `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` or `STRIPE_PUBLISHABLE_KEY` (pk only).

After Checkout pays, the webhook — not the browser — sets the account to Creator or Pro (`status=active`). Basic stays Basic until a signed event for a mapped live price arrives. New Checkout Sessions use Creator month/year and Pro month/year. Old yearly ids stay webhook-only. Checkout uses `mode=subscription`. Do not send `subscription_data[collection_method]` — Checkout Sessions reject it.

Failed-pay statuses (plan stays Creator/Pro until cancel/delete):

| Account status | Stripe signal | Paid features | Payouts |
|---|---|---|---|
| `warning` | `customer.subscription.updated` `past_due`, or `invoice.payment_failed` while `period_end` is still in the future | stay on | blocked (`canGetPayout` false; Withdraw disabled) |
| `hold` (shutoff) | `customer.subscription.updated` `unpaid`, or `invoice.payment_failed` at/after `period_end` | locked (upload beyond Basic, publishing, Boost, advanced analytics) | blocked |
| `active` | `invoice.paid` or paid `checkout.session.completed` | restored from the price | allowed |

`invoice.upcoming` is acknowledged only — no status write (still in the paid period). Cancel (`customer.subscription.updated` status `canceled`) or `customer.subscription.deleted` writes Basic and `status=active`. No cron: Stripe `past_due` is the 7-day warning window; `unpaid` / period end is shutoff.

7-day-early collection is Stripe Billing, not an invented job:

1. Checkout: `mode=subscription` (automatic collection is the Checkout default; do not send `subscription_data[collection_method]`)
2. Dashboard → Settings → Billing → Subscriptions and emails → **Upcoming renewal events = 7 days** (fires `invoice.upcoming`)
3. Same page / Invoices: **Generate invoices 7 days in advance** (Stripe finalizes and charges then)
4. After retries: **Mark the subscription as unpaid** so renewal-day shutoff is `unpaid`

Stripe Dashboard (you add this; the repo has no webhook secret):

1. Developers → Webhooks → Add endpoint
2. URL: `https://www.wannaplai.com/api/stripe/webhook` (apex `https://wannaplai.com/api/stripe/webhook` must also accept POST; do not 308)
3. Events: `checkout.session.completed`, `invoice.paid`, `invoice.upcoming`, `invoice.payment_failed`, `payment_intent.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`
4. Put the signing secret in Vercel as `STRIPE_WEBHOOK_SECRET`

Existing live prices only (do not create products or prices):

- Creator month `$14.99` `price_1U6kDm47ejpgV1ChUQ7V937J` (`prod_V6yAuvAiyZV8Jn`)
- Creator year `$149` `price_1U7nE647ejpgV1ChOARh5tC3` (`prod_V83KtcIQcKaCn4`) — do not send new checkouts to old `price_1U6kE547ejpgV1Chb6vtfjju`
- Pro month `$19.99` `price_1U6kDz47ejpgV1ChuxQ7yZ86` (`prod_V6yA0MmLFSeetg`)
- Pro year `$199` `price_1U7nDG47ejpgV1ChqpY9Swvb` (`prod_V83JukLyqvB9CN`) — do not send new checkouts to old `price_1U6kE647ejpgV1ChsovROe7H`

Accounts need `DATABASE_URL` (Postgres / Neon) and `SESSION_SECRET` (HMAC cookie). If either is missing, `/api/auth/*` and `/api/me` return `503 { "error": "Accounts are not configured." }` and the signup/login UI says that — they do not claim an account was created. Set both on Vercel before treating preview signup as live.

Account routes (server-only `DATABASE_URL` + `SESSION_SECRET`):

- `GET /api/auth` (schema bootstrap)
- `GET /api/auth/pixel` (`{ pixel_id }` from `META_PIXEL_ID` only; empty when unset — no fake pixel)
- `POST /api/auth/signup` (pending user only; no session; tries confirm mail; records `signup` once)
- `POST /api/auth/login` (confirmed users only)
- `POST /api/auth/logout`
- `POST /api/auth/confirm` (`{ token }` marks confirmed and attaches the session)
- `GET /api/auth/mail` (`{ configured }`; optional `?token=` HMAC check)
- `POST /api/auth/mail` (`{ email, artist }` resend)
- `GET /api/me`
- `POST /api/me` (store Stripe session id only; plan comes from the webhook)
- `POST /api/create-checkout-session` `{ action: "switch", plan, interval }` (signed-in; upgrades `proration_behavior=always_invoice`, downgrades `none`; looks up the sub by `stripe_customer_id`, not email)
- `POST /api/create-checkout-session` `{ action: "preview", plan, interval }` (confirm page only; does not charge)
- `POST /api/create-checkout-session` `{ action: "billing" }` (current price for that customer)
- `POST /api/create-checkout-session` `{ action: "portal" }` (Stripe Customer Billing Portal, card update only; `{ no_card: true }` when there is no Stripe customer)
- `POST /api/stripe/webhook` (Stripe-Signature; Hobby rewrite onto `create-checkout-session.js`; apex and www, no 308)
- `POST /api/me/catalog` (`artist_id`, `release_id`, and/or `track_id`)
- `POST /api/me/problem` (signed-in; `{ problem }` plus the session email; Resend to `emailplaiground@gmail.com`. Missing mail or a send failure returns `mail_sent: false` — the page does not fake success.)
- `GET /api/admin/signups` (owner session only; signups, paid rows, store rows, once-per-user growth events)

Growth events (`user_events`, once per user): `signup` on account create, `first_upload` when the first release id is stored on our side (draft counts; not hop-to-store send), `first_store_live` when an already-polled store status becomes live (nothing is Live tonight — the hook still ships), `paid` on the existing Stripe webhook success writer (`checkout.session.completed` / `invoice.paid` / paid subscription update). Paid may wait if the live www webhook leftover (apex 308 / invalid signature) still blocks Stripe. Lifecycle mail A/B/C uses the existing Resend mailer (`CONFIRM_FROM`, default `PLAIGROUND <confirm@wannaplai.com>`). Mail C sends only when `first_store_live` actually records. Missing `RESEND_API_KEY` logs a skip. Meta pixel: `GET /api/auth/pixel` + `site.js` PageView on public pages and CompleteRegistration on signup success, only when `META_PIXEL_ID` is set. No Upload or Purchase pixel events.

ToneGrid routes (no browser key):

- `GET /api/tonegrid/health`
- `GET /api/tonegrid/artists`
- `POST /api/tonegrid/artists`
- `POST /api/tonegrid/releases`
- `POST /api/tonegrid/tracks` (create track on a release; `explicit` defaults to false)
- `POST /api/tonegrid/uploads` (session; mints a short-lived PUT for `audio/…` or `covers/…`)
- `GET /api/tonegrid/uploads?key=` (session; owner-only signed GET helper — not a public streamer)
- `POST /api/tonegrid/tracks/:id/audio` (JSON `{ object_key }`; server pulls the private object and forwards WAV/FLAC; max 200MB)
- `GET /api/tonegrid/analytics` (session; filtered to that user’s ToneGrid ids)
- `GET /api/tonegrid/releases` (session; filtered)
- `GET /api/tonegrid/releases/:id` and `PUT /api/tonegrid/releases/:id` (session; title/date/genre/language)
- `POST /api/tonegrid/releases/:id/dsps` and `PUT /api/tonegrid/releases/:id/dsps` (always includes `youtube-music`)
- `POST /api/tonegrid/releases/:id/artwork` (multipart field `artwork`)
- `POST /api/tonegrid/releases/:id/submit` (SignWell document must be Completed; then attach stores and `POST /releases/:uuid/submit`. Does not call `/distribute` or `/approve`)
- `PUT /api/tonegrid/tracks/:id` (session; parent must still be draft for ToneGrid)
- `GET /api/tonegrid/stores`
- `GET /api/tonegrid/royalties` (session; filtered)
- `GET /api/signwell` (`{ configured }`)
- `GET /api/signwell?id=` (document status; `signed` only when SignWell says Completed)
- `POST /api/signwell` (create the Writer Split Sheet; real embed, no fake pad)

Browser audio and covers PUT to a private object hop first. The `/audio` and `/artwork` POSTs send only the object key. The server then pulls those bytes for the store hop. Set the five `R2_*` values on the host. Missing any of them returns a nameless error. The bucket stays private. There is no public play page.

Set `TONEGRID_BASE_URL` on Vercel to the sandbox host with the `/api` prefix. Do not point this preview at production.

Signup confirmation mail (same `api/auth.js` function; no `api/signup-confirm.js`):

- `POST /api/auth/signup` creates a **pending** row only. It does not attach a session and does not send the browser to `dashboard.html`.
- Resend emails `https://www.wannaplai.com/confirmed.html?email=...&token=...` (live `confirmed.html`, signed token). Clicking it calls `POST /api/auth/confirm`, marks the account confirmed, then attaches the session.
- Until confirmed, `GET /api/me` is not a finished account. Login with a pending password returns `403` and says they need to confirm (resend allowed).
- Duplicate email (pending or confirmed) is still `409`.
- Missing `RESEND_API_KEY` or a Resend failure keeps the row pending and returns `mail_sent: false`. Signup does not 500 and does not claim the email was sent.
- From address is `CONFIRM_FROM` (docs default `PLAIGROUND <confirm@wannaplai.com>`). Resend rejects Gmail from-addresses.
- HMAC uses `CONFIRM_SECRET` or `SIGNUP_CONFIRM_SECRET` (about 24 hours)
