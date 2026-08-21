# PLAIGROUND

Static site. Split-sheet signing uses SignWell via `api/signwell.js`.
The PLAI voice bubble mints an xAI ephemeral token via `api/plai-session.js`.

Environment variables (set on the host; never commit values):

```
SIGNWELL_API_KEY=
SIGNWELL_TEMPLATE_ID=
XAI_API_KEY=
```

`XAI_API_KEY` is server-only. Do not put it in frontend files. Live talk stays off until it is set on Vercel.
