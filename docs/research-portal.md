# Research portal

Free artist and song research for PLAIGROUND. It is not a clearance opinion, not an earnings estimate, and not the EPK.

Licence check: 14 Nov 2026.

## What runs

| Area | What you can do | Source |
| --- | --- | --- |
| Search a person | First and last name, with an optional IPI or known artist name. Same names stay side by side, each with a confidence label. Aliases, a sample of credits, and registry links. | MusicBrainz core data (CC0) via the public web service, Wikidata CC0, Discogs public API when it answers without a key |
| Artist presence | Search a name, MusicBrainz artist ID, Spotify / Apple Music / Deezer artist link, or Wikidata item. Confirm a row. Same names stay side by side. | Wikidata CC0, via the public Action API and Query Service |
| Song and credits | ISRC and ISWC stay separate. Linked recordings are Wikidata items that list an ISRC. Linked works are composer or lyricist claims. | Wikidata CC0 |
| Catalog progress | Three counts you mark yourself on this browser: released recordings, composition registration evidence, publishing agreement on file. Covers stay off the composition counts. A Wikidata identifier is stored as a public ID and is not counted as released, registered, or an agreement. | Your notes on this browser, labeled self-report or pending |
| Manual registries | MusicBrainz, ASCAP repertory, BMI repertoire, Songview, The MLC, US Copyright Office, USPTO, ISRC search | You open the site. Nothing is copied |
| Analytics | Not connected | Account analytics stay on Analytics |
| Opportunities | Not built | Nothing is submitted |
| Payments | No estimates and no statement upload | Earnings and Payouts for this account |

## Sources

Wikidata's data is CC0. The portal sends the search you start to `www.wikidata.org` and `query.wikidata.org`, with User-Agent `PLAIGROUND-research/1.0 (https://www.wannaplai.com/contact)`, `maxlag=5`, about one request per second, and at most 30 searches in 10 minutes for one address. That pace limit lives in the memory of one server instance. It resets when the instance restarts and is not shared across instances. Responses are capped at 800 KB and kept in a 40-entry memory cache for 10 minutes. There is no automatic retry. A miss is labelled "not in this result", not "does not exist".

A MusicBrainz ID or a store artist link on Artist presence is only the seed for that Wikidata query. That tab does not call MusicBrainz or the store.

Search a person does call the MusicBrainz web service for artist search, artist lookup (`aliases`, `url-rels`, `artist-rels` only), and a 10-work sample. Core data is CC0. Tags, ratings, annotations, and genres are not requested. The call uses User-Agent `PLAIGROUND-research/1.0 (https://www.wannaplai.com/contact)` and the same one-request-a-second gate as Wikidata. MusicBrainz says non-commercial use of the hosted service is free, and commercial use should be arranged with them. No paid MusicBrainz key is used. The full recording-relationship list is not downloaded. A count on the card tells you when MusicBrainz has more works than the sample.

Discogs search and artist lookup are called without a key when `api.discogs.com` answers. Unauthenticated Discogs requests are the low rate tier (about 25 a minute). Name variations, aliases, and URLs Discogs itself lists are kept. The biography text is not copied. If Discogs refuses the call, the card says so and the other sources still show.

BMI repertoire, ASCAP repertory, Songview, and The MLC are links only. The name, and an IPI when you typed one, is put in the URL those sites already use for a search. Their results are not copied. The MLC public data API requires enrollment. ASCAP and BMI do not offer an open keyless API for this page, so their pages are not fetched.

MetaBrainz supporter tiers are for database dumps and the Live Data Feed. This portal uses neither. If lookup volume outgrows the public Wikidata service, the next lawful step is a self-hosted copy, not a faster proxy.

Apple, Deezer, and Spotify are not catalog APIs here. An artist URL is only a seed to find a Wikidata item. Identifiers Wikidata already lists can be opened in the browser. No analytics are read from those services.

SIQA is not connected. If it is added later, a row would be an attestation or an editorial review, not an audio detector. Absence would mean unknown.

AudD, ACRCloud, Muso, Chartmetric, Soundcharts, and audio fingerprinting are not connected. There is no purchase step on this page.

## Privacy

Catalog notes are stored in the browser under a key for the signed-in account. They are not sent to the lookup route. Another account on the same browser does not read them. Royalty statements are rejected. The lookup route does not keep a database of searches.

The route is `POST /api/research`, rewritten onto the existing `api/youtube.js` function so the Hobby function cap stays at 12. Artist presence accepts only the two Wikidata hosts. Search a person also accepts `musicbrainz.org/ws/2` artist, work, and recording reads, and `api.discogs.com` artist search and artist lookup. Other hosts are rejected.
