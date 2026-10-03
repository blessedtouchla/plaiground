'use strict';

/**
 * Pull candidate slang from Reddit's official OAuth API (script app,
 * client credentials). Returns candidates only. It does not write the dataset.
 * With no REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET, it returns not configured.
 */

const DEFAULT_SUBS = ['slang', 'SlangOfTheDay', 'Chiraqology'];
const TOKEN_URL = 'https://www.reddit.com/api/v1/access_token';

function citySubs() {
  var raw = String(process.env.REDDIT_CITY_SUBS || '').trim();
  if (!raw) return ['chicago', 'nyc', 'Atlanta', 'houston', 'miami', 'london', 'toronto'];
  return raw.split(',').map(function (name) { return name.trim(); }).filter(Boolean).slice(0, 12);
}

function userAgent() {
  return String(process.env.REDDIT_USER_AGENT || 'plaiground:song-helper:2.0 (slang refresh)').trim();
}

function notConfigured() {
  return {
    ok: false,
    configured: false,
    error: 'Reddit is not configured. Add REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET on the host.',
    candidates: [],
  };
}

function subsToRead() {
  var seen = {};
  var list = [];
  DEFAULT_SUBS.concat(citySubs()).forEach(function (name) {
    var clean = String(name || '').replace(/^r\//i, '').trim();
    if (!clean || seen[clean.toLowerCase()]) return;
    seen[clean.toLowerCase()] = true;
    list.push(clean);
  });
  return list;
}

async function accessToken(id, secret) {
  var controller = typeof AbortController === 'function' ? new AbortController() : null;
  var timer = controller ? setTimeout(function () { controller.abort(); }, 8000) : null;
  try {
    var response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(id + ':' + secret).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': userAgent(),
      },
      body: 'grant_type=client_credentials',
      signal: controller ? controller.signal : undefined,
    });
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok || !data.access_token) {
      var failure = new Error('reddit');
      failure.status = response.status;
      throw failure;
    }
    return data.access_token;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function candidatesFromPosts(posts, sub) {
  var out = [];
  (posts || []).forEach(function (post) {
    var title = String(post && post.title || '').replace(/\s+/g, ' ').trim();
    if (!title) return;
    var quoted = title.match(/["“]([^"”]{2,40})["”]/g) || [];
    var phrases = quoted.map(function (chunk) { return chunk.replace(/["“”]/g, '').trim(); });
    if (!phrases.length) phrases = [title.slice(0, 80)];
    phrases.forEach(function (phrase) {
      if (!phrase || phrase.length < 2) return;
      out.push({
        word: phrase,
        subreddit: sub,
        title: title.slice(0, 180),
        permalink: post.permalink ? 'https://www.reddit.com' + post.permalink : '',
        created_utc: post.created_utc || null,
      });
    });
  });
  return out;
}

async function listing(token, sub) {
  var controller = typeof AbortController === 'function' ? new AbortController() : null;
  var timer = controller ? setTimeout(function () { controller.abort(); }, 8000) : null;
  try {
    var response = await fetch('https://oauth.reddit.com/r/' + encodeURIComponent(sub) + '/new?limit=15&raw_json=1', {
      headers: {
        Authorization: 'Bearer ' + token,
        'User-Agent': userAgent(),
      },
      signal: controller ? controller.signal : undefined,
    });
    var data = await response.json().catch(function () { return {}; });
    if (!response.ok) return [];
    var children = data && data.data && data.data.children || [];
    return children.map(function (child) { return child && child.data; }).filter(Boolean);
  } catch (err) {
    return [];
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function refresh() {
  var id = String(process.env.REDDIT_CLIENT_ID || '').trim();
  var secret = String(process.env.REDDIT_CLIENT_SECRET || '').trim();
  if (!id || !secret) return notConfigured();
  var token;
  try {
    token = await accessToken(id, secret);
  } catch (err) {
    return {
      ok: false,
      configured: true,
      error: 'Reddit did not hand back a token. Check the script-app id and secret.',
      candidates: [],
    };
  }
  var subs = subsToRead();
  var candidates = [];
  for (var i = 0; i < subs.length; i += 1) {
    var posts = await listing(token, subs[i]);
    candidates = candidates.concat(candidatesFromPosts(posts, subs[i]));
    if (candidates.length >= 40) break;
  }
  return {
    ok: true,
    configured: true,
    note: 'Candidates only. They are not added to the slang list until you import a CSV.',
    subs: subs,
    candidates: candidates.slice(0, 40),
  };
}

module.exports = {
  DEFAULT_SUBS: DEFAULT_SUBS,
  citySubs: citySubs,
  notConfigured: notConfigured,
  refresh: refresh,
};
