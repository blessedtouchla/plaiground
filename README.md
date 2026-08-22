# PLAIGROUND

Static site. Split-sheet signing uses SignWell via `api/signwell.js`.
The PLAI voice bubble mints an xAI ephemeral token via `api/plai-session.js`.
Creator and Pro Checkout Sessions are created via `api/create-checkout-session.js`.
Artist and release calls go to ToneGrid via server-only routes in `api/tonegrid/`.

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
```

`XAI_API_KEY`, `STRIPE_SECRET_KEY`, and `TONEGRID_API_KEY` are server-only. Do not put them in frontend files. Live talk and Checkout stay off until `STRIPE_SECRET_KEY` is set on Vercel. `GET /api/create-checkout-session` may return a publishable key from `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` or `STRIPE_PUBLISHABLE_KEY` (pk only).

ToneGrid routes (no browser key):

- `GET /api/tonegrid/health`
- `GET /api/tonegrid/artists`
- `POST /api/tonegrid/artists`
- `POST /api/tonegrid/releases`

Set `TONEGRID_BASE_URL` on Vercel to the sandbox host with the `/api` prefix. Do not point this preview at production.
