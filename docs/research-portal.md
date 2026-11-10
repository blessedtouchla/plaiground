# Research portal

Free artist and song research for PLAIGROUND. It is not a clearance opinion, not an earnings estimate, and not the EPK.

Licence check: 9 Nov 2026.

## What runs

| Area | What you can do | Source |
| --- | --- | --- |
| Artist presence | Search a name, MusicBrainz artist ID, Spotify / Apple Music / Deezer artist link, or Wikidata item. Confirm a row. Same names stay side by side. | Wikidata CC0, via the public Action API and Query Service |
| Song and credits | ISRC and ISWC stay separate. Linked recordings are Wikidata items that list an ISRC. Linked works are composer or lyricist claims. | Wikidata CC0 |
| Catalog progress | Three counts you mark yourself on this browser: released recordings, composition registration evidence, publishing agreement on file. Covers stay off the composition counts. A Wikidata identifier is stored as a public ID and is not counted as released, registered, or an agreement. | Your notes on this browser, labeled self-report or pending |
| Manual registries | MusicBrainz, ASCAP repertory, BMI repertoire, Songview, The MLC, US Copyright Office, USPTO, ISRC search | You open the site. Nothing is copied |
| Analytics | Not connected | Account analytics stay on Analytics |
| Opportunities | Not built | Nothing is submitted |
| Payments | No estimates and no statement upload | Earnings and Payouts for this account |

## Sources

Wikidata's data is CC0. The portal sends the search you start to `www.wikidata.org` and `query.wikidata.org`, with User-Agent `PLAIGROUND-research/1.0 (https://www.wannaplai.com/contact)`, `maxlag=5`, about one request per second, and at most 30 searches in 10 minutes for one address. That pace limit lives in the memory of one server instance. It resets when the instance restarts and is not shared across instances. Responses are capped at 800 KB and kept in a 40-entry memory cache for 10 minutes. There is no automatic retry. A miss is labelled "not in this result", not "does not exist".

A MusicBrainz ID or a store artist link is only the seed for that Wikidata query. The portal does not call MusicBrainz or the store.

MusicBrainz core data is CC0. Supplementary data (annotations, tags, ratings, derived statistics, search indexes, edit history) is CC BY-NC-SA and is not requested. The MusicBrainz web service docs say non-commercial use of that hosted service is free, and commercial use needs their commercial plans. This portal does not call `musicbrainz.org/ws` and does not download a database dump. MusicBrainz links are pages you open.

MetaBrainz supporter tiers are for database dumps and the Live Data Feed. This portal uses neither. If lookup volume outgrows the public Wikidata service, the next lawful step is a self-hosted copy, not a faster proxy.

Apple, Deezer, and Spotify are not catalog APIs here. An artist URL is only a seed to find a Wikidata item. Identifiers Wikidata already lists can be opened in the browser. No analytics are read from those services.

SIQA is not connected. If it is added later, a row would be an attestation or an editorial review, not an audio detector. Absence would mean unknown.

AudD, ACRCloud, Muso, Chartmetric, Soundcharts, and audio fingerprinting are not connected. There is no purchase step on this page.

## Privacy

Catalog notes are stored in the browser under a key for the signed-in account. They are not sent to the lookup route. Another account on the same browser does not read them. Royalty statements are rejected. The lookup route does not keep a database of searches.

The route is `POST /api/research`, rewritten onto the existing `api/youtube.js` function so the Hobby function cap stays at 12. It accepts only the two Wikidata hosts above.
