# PLAIGROUND

Static site. Split-sheet signing uses SignWell via `api/signwell.js`.
The PLAI voice bubble mints an xAI ephemeral token via `api/plai-session.js`.
Creator and Pro Checkout Sessions are created via `api/create-checkout-session.js`.
Artist and release calls go to ToneGrid via server-only routes in `api/tonegrid/`.
Signup confirmation mail uses `api/signup-confirm.js` (Resend when configured).

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
RESEND_API_KEY=
CONFIRM_SECRET=
SIGNUP_CONFIRM_SECRET=
CONFIRM_FROM=emailplaiground@gmail.com
```

`XAI_API_KEY`, `STRIPE_SECRET_KEY`, and `TONEGRID_API_KEY` are server-only. Do not put them in frontend files. Live talk and Checkout stay off until `STRIPE_SECRET_KEY` is set on Vercel. `GET /api/create-checkout-session` may return a publishable key from `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` or `STRIPE_PUBLISHABLE_KEY` (pk only).

ToneGrid routes (no browser key):

- `GET /api/tonegrid/health`
- `GET /api/tonegrid/artists`
- `POST /api/tonegrid/artists`
- `POST /api/tonegrid/releases`

Set `TONEGRID_BASE_URL` on Vercel to the sandbox host with the `/api` prefix. Do not point this preview at production.

Signup confirmation (server-only; no `NEXT_PUBLIC_` mail keys):

- `POST /api/signup-confirm` with `{ email, artist }` emails a link to `https://www.wannaplai.com/confirmed.html?email=...`
- Missing `RESEND_API_KEY` returns `503 { "error": "Mail is not configured." }`
- Optional HMAC token uses `CONFIRM_SECRET` or `SIGNUP_CONFIRM_SECRET` (about 24 hours)
- From address defaults to `CONFIRM_FROM=emailplaiground@gmail.com`
