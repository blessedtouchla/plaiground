'use strict';

/**
 * Pull the live SIQA charts page and write only the lists it actually publishes.
 * Titles, artists, and ranks come from the page. Nothing is invented or padded.
 * A chart that cannot be read is left on disk as it is.
 *
 * Usage: node scripts/refresh-siqa-charts.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCE = 'https://www.thesiqa.com/charts';

const CHARTS = [
  {
    tab: 'AI MUSIC HOT 100',
    file: 'data/siqa-chart.json',
    expect: 100,
    pages: ['charts-top-100.html'],
    hubHref: '/charts/top-100'
  },
  {
    tab: 'TOP 20 AI R&B SONGS',
    file: 'data/siqa-rnb.json',
    expect: 20,
    pages: ['charts-rnb.html'],
    hubHref: '/charts/rnb'
  },
  {
    tab: 'TOP 20 AI COUNTRY SONGS',
    file: 'data/siqa-country.json',
    expect: 20,
    pages: ['charts-country.html'],
    hubHref: '/charts/country'
  },
  {
    tab: 'TOP 20 AI GOSPEL SONGS',
    file: 'data/siqa-gospel.json',
    expect: 20,
    pages: ['charts-gospel.html'],
    hubHref: '/charts/gospel'
  }
];

function unescapeHtml(value) {
  return String(value || '')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

function parsePanes(html) {
  const marks = [];
  const re = /data-w-tab="([^"]+)"[^>]*class="[^"]*w-tab-pane/g;
  let match;
  while ((match = re.exec(html))) {
    marks.push({ tab: unescapeHtml(match[1]), at: match.index });
  }
  const panes = {};
  marks.forEach(function (mark, index) {
    const end = index + 1 < marks.length ? marks[index + 1].at : html.length;
    panes[mark.tab] = html.slice(mark.at, end);
  });
  return panes;
}

function parseTracks(paneHtml) {
  const tracks = [];
  const re = /class="text-block-9">(\d+)<\/div>[\s\S]*?class="song_title">([\s\S]*?)<\/div>[\s\S]*?class="artist_name">([\s\S]*?)<\/div>/g;
  let match;
  while ((match = re.exec(paneHtml))) {
    tracks.push({
      rank: Number(match[1]),
      title: unescapeHtml(match[2].replace(/<[^>]+>/g, '')),
      artist: unescapeHtml(match[3].replace(/<[^>]+>/g, ''))
    });
  }
  return tracks;
}

function weekFrom(paneHtml) {
  const match = paneHtml.match(/Week of ([^<]+)/);
  if (!match) return '';
  return unescapeHtml(match[1]).replace(/\s+/g, ' ').trim();
}

function contiguous(tracks, expect) {
  if (tracks.length !== expect) return false;
  for (let i = 0; i < tracks.length; i += 1) {
    if (tracks[i].rank !== i + 1) return false;
    if (!tracks[i].title || !tracks[i].artist) return false;
  }
  return true;
}

function keepVideo(previous, track) {
  const prior = (previous.tracks || []).find(function (row) {
    return row.title === track.title && row.artist === track.artist && row.youtubeId;
  });
  if (!prior) return track;
  return { rank: track.rank, title: track.title, artist: track.artist, youtubeId: prior.youtubeId };
}

function writeChart(rel, previous, week, tracks) {
  const next = {
    week: week,
    official: previous.official || SOURCE,
    category: previous.category,
    tracks: tracks.map(function (track) { return keepVideo(previous, track); })
  };
  fs.writeFileSync(path.join(ROOT, rel), JSON.stringify(next, null, 2) + '\n');
}

function patchPage(rel, previousWeek, week) {
  const file = path.join(ROOT, rel);
  let html = fs.readFileSync(file, 'utf8');
  html = html.split('Week of ' + previousWeek).join('Week of ' + week);
  html = html.replace(/\(week of [^)]+ until they update\)/g, '(week of ' + week + ' until they update)');
  fs.writeFileSync(file, html);
}

function patchHubCard(href, previousWeek, week) {
  const file = path.join(ROOT, 'charts.html');
  let html = fs.readFileSync(file, 'utf8');
  const re = new RegExp('(href="' + href.replace('/', '\\/') + '"[\\s\\S]*?charts-hub-meta">)([^<]*)');
  html = html.replace(re, function (all, pre, meta) {
    if (meta.indexOf(previousWeek) === -1 && meta.indexOf(week) === -1) return all;
    return pre + meta.split(previousWeek).join(week);
  });
  fs.writeFileSync(file, html);
}

async function main() {
  const response = await fetch(SOURCE, {
    headers: { 'user-agent': 'plaiground-charts-refresh' }
  });
  if (!response.ok) {
    console.error('SIQA fetch failed: ' + response.status);
    process.exit(1);
  }
  const html = await response.text();
  const panes = parsePanes(html);
  const refreshed = [];
  const skipped = [];

  CHARTS.forEach(function (chart) {
    const pane = panes[chart.tab];
    if (!pane) {
      skipped.push(chart.file + ': pane missing');
      return;
    }
    const week = weekFrom(pane);
    const tracks = parseTracks(pane);
    if (!week || !/^Week of /.test('Week of ' + week) || week.indexOf('20') === -1) {
      skipped.push(chart.file + ': week label missing');
      return;
    }
    if (!contiguous(tracks, chart.expect)) {
      skipped.push(chart.file + ': got ' + tracks.length + ' rows, expected ' + chart.expect);
      return;
    }
    const previous = readJson(chart.file);
    writeChart(chart.file, previous, week, tracks);
    chart.pages.forEach(function (page) { patchPage(page, previous.week, week); });
    patchHubCard(chart.hubHref, previous.week, week);
    refreshed.push({ tab: chart.tab, count: tracks.length, week: week, previousWeek: previous.week });
  });

  if (refreshed.length === CHARTS.length) {
    const week = refreshed[0].week;
    const previousWeek = refreshed[0].previousWeek;
    patchPage('charts.html', previousWeek, week);
  }

  console.log('Refreshed:');
  refreshed.forEach(function (row) {
    console.log('  ' + row.tab + ' (' + row.count + ') week of ' + row.week);
  });
  console.log('Skipped:');
  if (!skipped.length) console.log('  none');
  skipped.forEach(function (line) { console.log('  ' + line); });
  if (!refreshed.length) process.exit(1);
}

main().catch(function (err) {
  console.error(err && err.message ? err.message : err);
  process.exit(1);
});
