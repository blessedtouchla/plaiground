# Vercel Web Analytics events

The public and app pages load `/_vercel/insights/script.js` (from `site.js`, the Song Lab page, or the page itself). Custom events go through `window.va('event', …)` in `funnel-analytics.js`. The catalog page at `analytics.html` keeps its own `analytics.js`.

The owner still has to turn on **Web Analytics** in the Vercel project dashboard. Until that switch is on, the script does not store page views or these events. This branch does not change Vercel project settings.

Event properties are short tokens only. Lyrics, prompts, names, emails, and account ids are not sent.

| Event | When it fires | Properties |
| --- | --- | --- |
| `try_it_submit` | Signed-out homepage prompt is submitted, or the same box on `/lp/` | `surface=homepage`, or `surface=lp` plus `variant` |
| `lp_view` | The noindex ad landing at `/lp/` opens | `surface=lp`, `variant` (default `a`, or the `variant` query) |
| `song_lab_start` | Song Lab starts from a door, or from a homepage idea | `surface=song_lab`, `entry=door` or `entry=homepage` |
| `song_lab_completed` | A Song Lab song is finished (including a labeled sample) | `surface=song_lab`, `sample=yes` or `sample=no` |
| `signup_start` | "Save to my account", or the sign-up link that follows a save | `surface=song_lab`, `from=save_song` or `from=save_prompt` |
| `signup_completed` | Account creation succeeds on the signup page (same moment as the existing registration pixel) | `surface=signup` |
| `primary_cta` | Release Now, Join free, Create free account, Start releasing, Write a song free, a homepage feature tile, or a homepage option | `surface`, `cta` (`release_now`, `join_free`, `create_account`, `start_releasing`, `write_song`, `release`, `publish`, `artist_profile`, `lyrics`, `style`, `stores`, `own`). Homepage options: Write a song `write_song`, Release your music `release`, Publish and protect `publish`, Artist profile and EPK `artist_profile`. On `/lp/`, `variant` is included. |
