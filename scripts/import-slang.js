'use strict';

/**
 * Import a slang CSV into data/slang.json.
 *
 * Usage:
 *   node scripts/import-slang.js
 *   node scripts/import-slang.js path/to/slang-log.csv
 *
 * Columns: word, meaning, example, region_tag, region_detail,
 * source_url, source_url_2, first_seen, logged_on, confidence, notes.
 * Profanity is flagged from the notes and from a small word list.
 * The script does not call the network.
 */

const fs = require('fs');
const path = require('path');

const PROFANITY_RE = /\b(bih|bitch|fuck|fucking|shit|nigga|nigger|asshole|pussy|cock|dick)\b/i;

function parseCsv(text) {
  var rows = [];
  var row = [];
  var cell = '';
  var inQuotes = false;
  var i = 0;
  var src = String(text || '').replace(/^\uFEFF/, '');
  while (i < src.length) {
    var ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      row.push(cell);
      cell = '';
      i += 1;
      continue;
    }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1;
      row.push(cell);
      cell = '';
      if (row.some(function (value) { return String(value || '').trim(); })) rows.push(row);
      row = [];
      i += 1;
      continue;
    }
    cell += ch;
    i += 1;
  }
  if (cell.length || row.length) {
    row.push(cell);
    if (row.some(function (value) { return String(value || '').trim(); })) rows.push(row);
  }
  return rows;
}

function flagProfanity(entry) {
  var blob = [entry.word, entry.example, entry.notes].join(' ');
  if (/profan/i.test(entry.notes || '')) return true;
  return PROFANITY_RE.test(blob);
}

function toEntry(header, cells) {
  var raw = {};
  header.forEach(function (key, index) {
    raw[String(key || '').trim()] = String(cells[index] || '').trim();
  });
  var sources = [raw.source_url, raw.source_url_2].filter(Boolean);
  var entry = {
    word: raw.word,
    meaning: raw.meaning,
    example: raw.example,
    region_tag: raw.region_tag,
    region_detail: raw.region_detail,
    sources: sources,
    first_seen: raw.first_seen,
    logged_on: raw.logged_on,
    confidence: raw.confidence,
    notes: raw.notes,
  };
  entry.profanity = flagProfanity(entry);
  return entry;
}

function importCsv(csvText) {
  var rows = parseCsv(csvText);
  if (!rows.length) return [];
  var header = rows[0].map(function (key) { return String(key || '').trim(); });
  return rows.slice(1).map(function (cells) { return toEntry(header, cells); }).filter(function (entry) {
    return entry.word;
  });
}

function main() {
  var input = process.argv[2] || path.join(__dirname, '..', 'data', 'slang-log.csv');
  var output = path.join(__dirname, '..', 'data', 'slang.json');
  var csv = fs.readFileSync(input, 'utf8');
  var entries = importCsv(csv);
  var payload = {
    imported_from: path.basename(input),
    count: entries.length,
    entries: entries,
  };
  fs.writeFileSync(output, JSON.stringify(payload, null, 2) + '\n');
  console.log('Wrote ' + entries.length + ' slang rows to ' + output);
}

if (require.main === module) main();

module.exports = {
  importCsv: importCsv,
  parseCsv: parseCsv,
  flagProfanity: flagProfanity,
};
