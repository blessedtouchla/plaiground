/*
 * Hidden-link gate for the new Song Helper.
 *
 * The page and its write actions only answer when the request carries the
 * private key (?k=... on the page, k in the POST body for the API). Only a
 * SHA-256 hash of the key lives in this file, so the repo never holds the key.
 * SONG_HELPER_V3_KEY_SHA256 in the environment can replace the hash to rotate it.
 */
'use strict';

var crypto = require('crypto');

var BUILT_IN_HASH = 'a95a6fadbdd52be4f007cf172a192e2a186687c576494532595a0a0109b83f0a';

function expectedHash() {
  var fromEnv = String(process.env.SONG_HELPER_V3_KEY_SHA256 || '').trim().toLowerCase();
  return /^[0-9a-f]{64}$/.test(fromEnv) ? fromEnv : BUILT_IN_HASH;
}

function keyOk(key) {
  var given = String(key == null ? '' : key).trim();
  if (given.length < 10 || given.length > 200) return false;
  var a = Buffer.from(crypto.createHash('sha256').update(given).digest('hex'), 'utf8');
  var b = Buffer.from(expectedHash(), 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function queryKey(req) {
  var query = req && req.query;
  if (query && query.k != null) return String(Array.isArray(query.k) ? query.k[0] : query.k);
  var url = String((req && req.url) || '');
  var mark = url.indexOf('?');
  if (mark === -1) return '';
  return new URLSearchParams(url.slice(mark + 1)).get('k') || '';
}

var PAGE_HTML = [
  '<!DOCTYPE html>',
  '<html lang="en">',
  '<head>',
  '  <meta charset="UTF-8" />',
  '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
  '  <title>Song Helper</title>',
  '  <meta name="robots" content="noindex, nofollow, noarchive" />',
  '  <meta name="referrer" content="no-referrer" />',
  '  <link rel="stylesheet" href="/song-helper-v3.css?v=20261018h1" />',
  '</head>',
  '<body>',
  '  <main class="v3-app" id="v3" data-screen="hall"></main>',
  '  <script src="/lib/song-v3.js?v=20261018h1"></script>',
  '  <script src="/lib/song-v3-flow.js?v=20261018h1"></script>',
  '  <script src="/song-helper-v3.js?v=20261018h1"></script>',
  '</body>',
  '</html>',
  '',
].join('\n');

module.exports = {
  keyOk: keyOk,
  queryKey: queryKey,
  PAGE_HTML: PAGE_HTML,
};
