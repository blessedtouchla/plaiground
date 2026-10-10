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

## Visitor id

Each browser gets a random first-party id in `localStorage` key `plaiground.visitor` and cookie `plaiground_vid`. It is not an email, name, or account id. The same id is sent with every anonymous event.

If cookie `plaiground_consent` or `localStorage` key `plaiground.consent` is `denied`, the id is not written and anonymous events are not sent. `granted` allows them. If neither is set, anonymous events are sent. There is still no banner.

Signup and login copy that id onto the earlier rows (`user_id` on the server only). The owner report never returns `user_id`, click ids, lyrics, or other free text.

## What we count

Page views are `tool_view` with a tool name: `song_helper`, `cover_art`, `roadmap`, `qualify`, `contracts`, `distribution`, `ar`, `epk`, `pricing`, `plai`. One row per visitor, tool, and UTC day.

| Event | When |
| --- | --- |
| `visit` | First page of a UTC day |
| `returned_visit` | A new session on a later UTC day. The first day does not count. |
| `signup` | Account created. Once per visitor. |
| `song_helper_started` | Song Helper start, including a start choice |
| `song_helper_step` | A Song Helper step id, or scratch, source, lyrics, ideas, own |
| `song_helper_draft` | A draft was generated |
| `song_first` | The first of those drafts. Once per visitor. This is the Lead pixel. |
| `song_helper_section` | A section was edited. Step is the section id, or `section`. |
| `song_helper_ask` | Ask me a question |
| `song_helper_rhymify` | Rhymify |
| `song_helper_sounds` | Sounds like traits or layout |
| `song_helper_style_made` | Make my style prompt |
| `song_helper_style_copied` | Style prompt copied |
| `cover_art` | Cover generated |
| `cover_art_downloaded` | Cover file downloaded |
| `roadmap_stage` | Idea, Made, or Out |
| `roadmap_goal` | money, fanbase, or release |
| `check_and_file_completed` | Check and file reached a result |
| `contract_opened` | Review, fix, create, or read |
| `distro_started` | Distribution checkout started |
| `distro_purchased` | Distribution checkout completed |
| `plai_opened` | Chat with Plai opened |
| `plai_chip` | A quick chip. Step is `start`, `distribution`, `cost`, or `protect`. |

Payloads are the event name, tool name, step name, and the first-touch UTM fields. Lyrics, questions, prompts, and personal details are dropped.

## Segment tag

`utm_content` values shaped `segment_angle_version` (three letters-or-digits parts) are stored as segment, angle, and version. Example: `launch_hook_v1` is segment `launch`, angle `hook`, version `v1`. Any other content stays in the content column with segment and angle blank.

## Daily report

Owner session only.

- Today: `GET /api/admin/marketing`
- Sprint: `GET /api/admin/marketing?from=2026-10-10&to=2026-10-20`
- CSV: `GET /api/admin/marketing.csv?from=2026-10-10&to=2026-10-20`

Source columns: source, medium, campaign, content, segment, angle, visits, signups, first songs, distribution purchases. A blank source is reported as `direct`.

The same response adds tool totals, funnel visitors, and 1-day and 7-day return by first tool and by source plus segment. 1-day means any event on the next UTC day after that visitor's first day in the range. 7-day means any later day through day 7. The query looks 7 days past the end date so a range that ends today can still see a return. Usage counts stay inside the selected dates.

The same numbers print from `node scripts/launch-report.js 2026-10-10 2026-10-20` wherever `DATABASE_URL` is set.

Distribution checkout is counted when a button with `data-checkout-kind="distro"` gets a Stripe URL, and again when Stripe sends the artist back. There is no distribution price id in the repo yet. Do not invent one.
