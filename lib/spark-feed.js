'use strict';

/**
 * Optional live spark feed. Used only when SPARK_FEEDS is a comma-separated
 * list of https URLs. Titles that look like tragedies are dropped.
 * If the feed fails, the caller should show samples and say so.
 */

const spark = require('./spark');

function feedUrls() {
  return String(process.env.SPARK_FEEDS || '')
    .split(',')
    .map(function (value) { return value.trim(); })
    .filter(function (value) { return /^https:\/\//i.test(value); })
    .slice(0, 4);
}

function titlesFromXml(xml) {
  var source = String(xml || '');
  var items = source.match(/<item\b[\s\S]*?<\/item>/gi) || source.match(/<entry\b[\s\S]*?<\/entry>/gi) || [];
  var chunks = items.length ? items : [source];
  var found = [];
  chunks.forEach(function (chunk, index) {
    var match = chunk.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    if (!match) return;
    var title = match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (!items.length && index === 0) return;
    if (!title || title.length > 180) return;
    if (spark.tragedy(title)) return;
    found.push(title);
  });
  return found;
}

async function load() {
  var urls = feedUrls();
  if (!urls.length) return null;
  var titles = [];
  var sources = [];
  for (var i = 0; i < urls.length; i += 1) {
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 6000) : null;
    try {
      var response = await fetch(urls[i], { signal: controller ? controller.signal : undefined });
      if (!response.ok) continue;
      var text = await response.text();
      titlesFromXml(text).forEach(function (title) {
        if (titles.length >= 12) return;
        titles.push({ title: title, sourceUrl: urls[i] });
      });
      sources.push(urls[i]);
    } catch (err) {
      // This feed is skipped. Samples stay available to the caller.
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  if (!titles.length) return { failed: true, sources: sources };
  var items = titles.map(function (row, index) {
    return {
      id: 'live-' + index,
      lane: 'trending',
      title: row.title,
      detail: 'From the feed you connected. Nothing else was added.',
      flip: 'Flip the angle: who is off to the side of this, and what can they hold in their hand?',
      answer: 'An answer song from the person this item does not quote.',
      cause: '',
      sourceLabel: 'Live feed',
      sourceUrl: row.sourceUrl,
      sample: false,
    };
  });
  return {
    failed: false,
    items: items,
    daily: Object.assign({}, items[0], {
      daily: true,
      dailyNote: 'Daily spark from the first live item. Not a chart.',
    }),
  };
}

module.exports = {
  feedUrls: feedUrls,
  load: load,
  titlesFromXml: titlesFromXml,
};
