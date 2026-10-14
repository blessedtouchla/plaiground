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
const NEWS_URL = 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en';
const NPR_URL = 'https://feeds.npr.org/1001/rss.xml';
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
  if (memory && memory.day === day) return memory;
  try {
    var saved = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    if (saved && saved.day === day && (saved.trending || saved.news)) {
      memory = saved;
      return saved;
    }
  } catch (err) {}
  return null;
}

function writeCache(day, record) {
  memory = record;
  memory.day = day;
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

function newsItem(title, sourceLabel, sourceUrl, asOf, index) {
  return {
    id: 'news-' + index,
    lane: 'news-world',
    topic: 'Top stories',
    headline: title,
    title: title,
    detail: sourceLabel + '. As of ' + asOf + '. A personal writing angle, not a news report.',
    flip: 'Write a calm scene from your own day that this brought to mind. A place and an object are enough. Do not retell the headline as if you were there.',
    answer: 'An answer song in your own words. Keep it personal and steady. If it feels heavy, write only the part you can hold, or skip it.',
    cause: '',
    sourceLabel: sourceLabel,
    sourceUrl: sourceUrl,
    sample: false,
  };
}

function titleKey(title) {
  return String(title || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function rssEntries(xml) {
  var items = String(xml || '').match(/<item\b[\s\S]*?<\/item>/gi) || [];
  var found = [];
  items.forEach(function (chunk) {
    var titles = tagValues(chunk, 'title');
    var links = tagValues(chunk, 'link');
    var notes = tagValues(chunk, 'description');
    var title = titles[0] || '';
    if (!title || title.length > 180) return;
    if (titles.concat(notes).some(blocked)) return;
    var url = links.filter(function (link) { return /^https:\/\//i.test(link); })[0] || '';
    found.push({ title: title, url: url });
  });
  return found;
}

function publicPack(live) {
  var base = spark.pack();
  var curated = (base.items || []).filter(function (item) {
    return item.lane === 'causes' || item.lane === 'mindset';
  });
  var trending = (live && live.items) || [];
  var news = (live && live.newsItems) || [];
  var trendingOk = !!(live && !live.failed && trending.length);
  var newsOk = news.length > 0;
  return {
    ok: true,
    demo: !trendingOk,
    notice: trendingOk ? live.notice : spark.REFRESH_NOTICE,
    newsNotice: newsOk ? live.newsNotice : spark.NEWS_REFRESH_NOTICE,
    asOf: trendingOk ? (live.asOf || '') : '',
    newsAsOf: newsOk ? (live.newsAsOf || '') : '',
    lanes: base.lanes,
    groups: base.groups,
    daily: trendingOk ? (live.daily || null) : null,
    newsDaily: newsOk ? (live.newsDaily || null) : null,
    items: trending.concat(news).concat(curated),
  };
}

async function loadTrending(asOf) {
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
  if (!buckets.length) return null;

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
  return {
    asOf: asOf,
    notice: 'As of ' + asOf + '. From ' + names.join(', ') + '.',
    sources: names,
    items: items,
    daily: Object.assign({}, first, {
      daily: true,
      dailyNote: 'Daily spark from ' + first.sourceLabel + '. As of ' + asOf + '.',
    }),
  };
}

async function loadNews(asOf, trendingItems) {
  var used = {};
  (trendingItems || []).forEach(function (item) { used[titleKey(item.title)] = true; });
  var pulls = [
    { label: 'Google News', url: NEWS_URL },
    { label: 'NPR', url: NPR_URL },
  ];
  var chosen = null;
  for (var i = 0; i < pulls.length; i += 1) {
    var text = await fetchText(pulls[i].url);
    var rows = text ? rssEntries(text) : [];
    rows = rows.filter(function (row) { return !used[titleKey(row.title)]; });
    if (rows.length) {
      chosen = { label: pulls[i].label, url: pulls[i].url, rows: rows.slice(0, 8) };
      break;
    }
  }
  if (!chosen) return null;
  var items = chosen.rows.map(function (row, index) {
    return newsItem(row.title, chosen.label, row.url || chosen.url, asOf, index);
  });
  var first = items[0];
  return {
    asOf: asOf,
    notice: 'As of ' + asOf + '. From ' + chosen.label + '.',
    items: items,
    daily: Object.assign({}, first, {
      daily: true,
      dailyNote: 'Daily spark from ' + chosen.label + '. As of ' + asOf + '.',
    }),
  };
}

async function load() {
  var day = dayKey();
  var asOf = dayLabel();
  var cached = readCache(day) || { day: day };
  if (!cached.trending) {
    var trending = await loadTrending(asOf);
    if (trending) cached.trending = trending;
  }
  if (!cached.news) {
    var news = await loadNews(asOf, cached.trending && cached.trending.items);
    if (news) cached.news = news;
  }
  if (cached.trending || cached.news) writeCache(day, cached);
  var trend = cached.trending;
  var newsPack = cached.news;
  return {
    failed: !(trend && trend.items && trend.items.length),
    asOf: trend ? trend.asOf : '',
    notice: trend ? trend.notice : '',
    sources: trend ? trend.sources : [],
    items: trend ? trend.items : [],
    daily: trend ? trend.daily : null,
    newsAsOf: newsPack ? newsPack.asOf : '',
    newsNotice: newsPack ? newsPack.notice : '',
    newsItems: newsPack ? newsPack.items : [],
    newsDaily: newsPack ? newsPack.daily : null,
  };
}

module.exports = {
  CACHE_PATH: CACHE_PATH,
  clearCache: clearCache,
  feedUrls: feedUrls,
  load: load,
  publicPack: publicPack,
  titlesFromXml: titlesFromXml,
};
