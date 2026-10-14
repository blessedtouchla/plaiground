'use strict';

/**
 * Daily trending for What's hot.
 * Sources: Google Trends daily RSS, Apple Music most played, YouTube most
 * popular music when YOUTUBE_API_KEY is set, plus optional SPARK_FEEDS.
 * Titles are copied from those sources. Nothing is invented.
 * Tragedies and NSFW titles are dropped. A same-day cache avoids repeat fetches.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const spark = require('./spark');

const CACHE_PATH = path.join(os.tmpdir(), 'plaiground-spark-trends.json');
const GOOGLE_URL = 'https://trends.google.com/trending/rss?geo=US';
const APPLE_URL = 'https://rss.marketingtools.apple.com/api/v2/us/music/most-played/10/songs.json';
const YOUTUBE_PAGE = 'https://www.youtube.com/feed/trending';
const NSFW_RE = /\b(porn|xxx|nsfw|onlyfans|nude|nudes|sex tape|escort)\b/i;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

var memory = null;

function feedUrls() {
  return String(process.env.SPARK_FEEDS || '')
    .split(',')
    .map(function (value) { return value.trim(); })
    .filter(function (value) { return /^https:\/\//i.test(value); })
    .slice(0, 4);
}

function decode(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function blocked(text) {
  var value = String(text || '');
  return spark.tragedy(value) || NSFW_RE.test(value);
}

function tagValues(chunk, tag) {
  var re = new RegExp('<' + tag + '>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/' + tag + '>', 'gi');
  var out = [];
  var match;
  while ((match = re.exec(chunk))) out.push(decode(match[1]));
  return out;
}

function titlesFromXml(xml) {
  var source = String(xml || '');
  var items = source.match(/<item\b[\s\S]*?<\/item>/gi) || source.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
  var chunks = items.length ? items : [source];
  var found = [];
  chunks.forEach(function (chunk, index) {
    if (!items.length && index === 0) return;
    var titles = tagValues(chunk, 'title');
    var news = tagValues(chunk, 'ht:news_item_title');
    var title = titles[0] || '';
    if (!title || title.length > 180) return;
    if (titles.concat(news).some(blocked)) return;
    found.push(title);
  });
  return found;
}

function dayKey(now) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: 'numeric',
  }).format(now || new Date());
}

function dayLabel(now) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(now || new Date());
}

function readCache(day) {
  if (memory && memory.day === day && memory.live && memory.live.items && memory.live.items.length) return memory.live;
  try {
    var saved = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    if (saved && saved.day === day && saved.live && saved.live.items && saved.live.items.length) {
      memory = saved;
      return saved.live;
    }
  } catch (err) {}
  return null;
}

function writeCache(day, live) {
  memory = { day: day, live: live };
  try { fs.writeFileSync(CACHE_PATH, JSON.stringify(memory)); } catch (err) {}
}

function clearCache() {
  memory = null;
  try { fs.unlinkSync(CACHE_PATH); } catch (err) {}
}

async function fetchText(url) {
  var controller = typeof AbortController === 'function' ? new AbortController() : null;
  var timer = controller ? setTimeout(function () { controller.abort(); }, 6000) : null;
  try {
    var response = await fetch(url, {
      signal: controller ? controller.signal : undefined,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/rss+xml, application/json, text/xml, */*',
      },
    });
    if (!response.ok) return null;
    return await response.text();
  } catch (err) {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function takeSafe(titles, limit) {
  var out = [];
  (titles || []).forEach(function (title) {
    var clean = String(title || '').replace(/\s+/g, ' ').trim();
    if (!clean || clean.length > 180 || blocked(clean)) return;
    if (out.indexOf(clean) !== -1) return;
    if (out.length >= limit) return;
    out.push(clean);
  });
  return out;
}

function appleTitles(text) {
  var json = null;
  try { json = JSON.parse(text || ''); } catch (err) { return []; }
  var results = json && json.feed && json.feed.results;
  if (!Array.isArray(results)) return [];
  return results.map(function (row) {
    var name = String((row && row.name) || '').trim();
    var artist = String((row && row.artistName) || '').trim();
    if (!name) return '';
    return artist ? (name + ' · ' + artist) : name;
  });
}

function youtubeTitles(text) {
  var json = null;
  try { json = JSON.parse(text || ''); } catch (err) { return []; }
  var items = json && json.items;
  if (!Array.isArray(items)) return [];
  return items.map(function (row) {
    var snippet = row && row.snippet;
    var title = String((snippet && snippet.title) || '').trim();
    var channel = String((snippet && snippet.channelTitle) || '').trim();
    if (!title) return '';
    return channel ? (title + ' · ' + channel) : title;
  });
}

function liveItem(topic, title, sourceLabel, sourceUrl, asOf, index) {
  return {
    id: 'live-' + index,
    lane: 'trending',
    topic: topic,
    headline: title,
    title: title,
    detail: sourceLabel + '. As of ' + asOf + '.',
    flip: 'Write from someone hearing this today. Use a place and an object from your own day.',
    answer: 'An answer song in your own words. Do not copy the lyric, and do not pretend you were there if you were not.',
    cause: '',
    sourceLabel: sourceLabel,
    sourceUrl: sourceUrl,
    sample: false,
  };
}

function publicPack(live) {
  var base = spark.pack();
  var rest = (base.items || []).filter(function (item) { return item.lane !== 'trending'; });
  if (live && !live.failed && live.items && live.items.length) {
    return {
      ok: true,
      demo: false,
      notice: live.notice,
      asOf: live.asOf || '',
      lanes: base.lanes,
      groups: base.groups,
      daily: live.daily || null,
      items: live.items.concat(rest),
    };
  }
  return spark.withoutTrending(base);
}

async function load() {
  var day = dayKey();
  var cached = readCache(day);
  if (cached) return cached;
  var asOf = dayLabel();
  var buckets = [];

  var googleText = await fetchText(GOOGLE_URL);
  var google = takeSafe(googleText ? titlesFromXml(googleText) : [], 8);
  if (google.length) buckets.push({ topic: 'Search trends', label: 'Google Trends', url: GOOGLE_URL, titles: google });

  var appleText = await fetchText(APPLE_URL);
  var apple = takeSafe(appleText ? appleTitles(appleText) : [], 8);
  if (apple.length) buckets.push({ topic: 'Most played songs', label: 'Apple Music', url: APPLE_URL, titles: apple });

  var youtubeKey = String(process.env.YOUTUBE_API_KEY || '').trim();
  if (youtubeKey) {
    var youtubeUrl = 'https://www.googleapis.com/youtube/v3/videos?part=snippet&chart=mostPopular&videoCategoryId=10&regionCode=US&maxResults=15&key=' + encodeURIComponent(youtubeKey);
    var youtubeText = await fetchText(youtubeUrl);
    var youtube = takeSafe(youtubeText ? youtubeTitles(youtubeText) : [], 6);
    if (youtube.length) buckets.push({ topic: 'Music videos', label: 'YouTube', url: YOUTUBE_PAGE, titles: youtube });
  }

  var extras = feedUrls();
  var extraTitles = [];
  for (var i = 0; i < extras.length; i += 1) {
    var extraText = await fetchText(extras[i]);
    if (!extraText) continue;
    titlesFromXml(extraText).forEach(function (title) {
      if (extraTitles.length >= 8) return;
      if (blocked(title)) return;
      if (extraTitles.indexOf(title) !== -1) return;
      extraTitles.push(title);
    });
  }
  if (extraTitles.length) buckets.push({ topic: 'From the feed', label: 'Live feed', url: extras[0], titles: extraTitles });

  if (!buckets.length) return { failed: true };

  var items = [];
  buckets.forEach(function (bucket) {
    bucket.titles.forEach(function (title) {
      items.push(liveItem(bucket.topic, title, bucket.label, bucket.url, asOf, items.length));
    });
  });
  var names = [];
  buckets.forEach(function (bucket) {
    if (names.indexOf(bucket.label) === -1) names.push(bucket.label);
  });
  var first = items[0];
  var live = {
    failed: false,
    asOf: asOf,
    notice: 'As of ' + asOf + '. From ' + names.join(', ') + '.',
    sources: names,
    items: items,
    daily: Object.assign({}, first, {
      daily: true,
      dailyNote: 'Daily spark from ' + first.sourceLabel + '. As of ' + asOf + '.',
    }),
  };
  writeCache(day, live);
  return live;
}

module.exports = {
  CACHE_PATH: CACHE_PATH,
  clearCache: clearCache,
  feedUrls: feedUrls,
  load: load,
  publicPack: publicPack,
  titlesFromXml: titlesFromXml,
};
