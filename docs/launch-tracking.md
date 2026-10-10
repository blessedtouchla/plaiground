# Launch tracking (Oct 10 to Oct 20)

Pixels stay off until these env vars are set on Vercel (Production and Preview). No ids belong in the repo.

| Env var | What Victoria creates | Shape |
| --- | --- | --- |
| `META_PIXEL_ID` | Meta Events Manager pixel for wannaplai.com | Digits only, 5 to 20 |
| `TIKTOK_PIXEL_ID` | TikTok Events Manager pixel | Letters and digits, 10 to 32 |
| `GA4_MEASUREMENT_ID` | Google Analytics 4 web stream for wannaplai.com | `G-` plus 4 to 20 letters or digits |

`GET /api/auth/pixel` returns `pixel_id`, `tiktok_pixel_id`, and `ga4_measurement_id`. Each is an empty string until that env var is set.

## What each standard event means

| Ours | Meta | TikTok | GA4 |
| --- | --- | --- | --- |
| Page view on a public page | PageView | Pageview | page_view |
| Signup | CompleteRegistration | CompleteRegistration | sign_up |
| First Song Helper song | Lead | SubmitForm | generate_lead |
| Distribution checkout started | InitiateCheckout | InitiateCheckout | begin_checkout |
| Distribution checkout completed | Purchase | CompletePayment | purchase |

Cover Art made is stored on our side with the same first-touch source. It does not send a sixth pixel event.

Pixel calls send the event name only. They do not send email, name, account id, or IP.

## First landing

The first page stores `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `fbclid`, `ttclid`, and `gclid` in `localStorage` key `plaiground.attribution` and cookie `plaiground_attr`. A later visit does not overwrite that first landing.

Those values are attached to signup, the first Song Helper song, Cover Art made, and distribution checkout started and completed.

## Cookie choice

If cookie `plaiground_consent` or `localStorage` key `plaiground.consent` is `denied`, the pixels do not load. `granted` allows them. If neither is set, pixels load only when an id is set. There is no new banner. Turn the ids on only after the privacy notice is updated.

## Daily report

Owner session only.

- Today: `GET /api/admin/marketing`
- Sprint: `GET /api/admin/marketing?from=2026-10-10&to=2026-10-20`
- CSV: `GET /api/admin/marketing.csv?from=2026-10-10&to=2026-10-20`

Columns: source, medium, campaign, content, visits, signups, first songs, distribution purchases. A blank source is reported as `direct`.

The same numbers print from `node scripts/launch-report.js 2026-10-10 2026-10-20` wherever `DATABASE_URL` is set.

Distribution checkout is counted when a button with `data-checkout-kind="distro"` gets a Stripe URL, and again when Stripe sends the artist back. There is no distribution price id in the repo yet. Do not invent one.
