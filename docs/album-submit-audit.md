# Album submit audit

Checked 9 Nov 2026 against the live pages and the current source. No album redesign is included here.

## Live UI

The submit-release page is [https://www.wannaplai.com/upload.html](https://www.wannaplai.com/upload.html). The visible heading is "Submit a song". It returns HTTP 200, including `?type=album`.

The release-type control is on that page, not on a later step:

- Single links to `upload.html` (`data-type="single"`).
- Album links to `upload.html?type=album` (`data-type="album"`).
- Album copy: "An album is one store release with multiple tracks under the same artist."
- The album step asks for a track count (`#tg-album-count`), then shows one audio and title row per track (`data-album-tracks`). Lyrics can be stored per track.

[https://www.wannaplai.com/review.html](https://www.wannaplai.com/review.html) is titled "Schedule and review". It has no album selector. Its action is "Submit" and it continues the draft already started on the upload page.

[https://www.wannaplai.com/releases.html](https://www.wannaplai.com/releases.html) has a separate "Upload an album" link to `upload.html?type=album`, marked for Creator and Pro (`data-for-plans="creator pro"`).

## What is saved

The browser draft stores `type: "album"`, `album_count`, and `tracks[]` with each track title, audio, lyrics, and featured credit. Submit sends `featured_tracks` only when `draft.type === "album"`.

The account API accepts `type` of `single`, `ep`, or `album` and forwards that `type` when it creates the distributor release. A Basic account is refused an album (`album_allowed: false`). Creator and Pro can start one. The upload hint says an album is open to every artist; the server and the releases-page link do not. That mismatch is unchanged.

## Prepared vs live

Album distribution is live in the product: the selector, the multitrack draft, and the provider `type: "album"` path are already on the site. This publishing change does not alter that flow.

Publishing an album is separate. A publishing album is a group of compositions. Each composition keeps its own writers, writer shares, represented publisher share, human contribution, and track credits. The recording can be distributed elsewhere. Publishing intake does not turn the album into one work registration.
