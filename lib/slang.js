'use strict';

/**
 * Slang lookup shared by Bars mode (browser) and the refresh route (Node).
 * The dataset lives in data/slang.json. This file does not hold an API key.
 */
(function (root, factory) {
  var data = null;
  if (typeof module === 'object' && module.exports) {
    try { data = require('../data/slang.json'); } catch (err) { data = { entries: [] }; }
  }
  var api = factory(data);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SlangCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (bundled) {
  function entriesFrom(source) {
    if (Array.isArray(source)) return source;
    if (source && Array.isArray(source.entries)) return source.entries;
    if (bundled && Array.isArray(bundled.entries)) return bundled.entries;
    return [];
  }

  function regions(source) {
    var seen = {};
    var list = [];
    entriesFrom(source).forEach(function (row) {
      var tag = String(row && row.region_tag || '').trim();
      if (!tag || seen[tag]) return;
      seen[tag] = true;
      list.push(tag);
    });
    list.sort();
    return list;
  }

  function suggest(source, region, opts) {
    var options = opts || {};
    var want = String(region || '').trim().toLowerCase();
    var includeProfanity = options.profanity === true;
    return entriesFrom(source).filter(function (row) {
      if (!row || !row.word) return false;
      if (row.profanity && !includeProfanity) return false;
      if (!want || want === 'any') return true;
      return String(row.region_tag || '').trim().toLowerCase() === want;
    });
  }

  function tooltip(row) {
    if (!row) return '';
    var source = (row.sources && row.sources[0]) || '';
    var parts = [row.meaning || 'No meaning on file.'];
    if (source) parts.push('Source: ' + source);
    if (row.profanity) parts.push('Marked as profanity.');
    return parts.join(' ');
  }

  return {
    entriesFrom: entriesFrom,
    regions: regions,
    suggest: suggest,
    tooltip: tooltip,
  };
}));
