'use strict';
/*
 * Server side of the hidden Fan Mail to Song mode. Called from api/song-helper.js
 * (no new api/ file). The xAI key stays on the server via lib/xai-client.
 * Research uses public Wikipedia pages; every fact carries its source link.
 */
const fan = require('./fan-song');
const xai = require('./xai-client');

const WIKI = 'https://en.wikipedia.org';
const UA = 'PLAIGROUND-FanSong/1.0 (https://www.wannaplai.com)';

const PAGE_HTML = [
  '<!DOCTYPE html>',
  '<html lang="en">',
  '<head>',
  '  <meta charset="UTF-8" />',
  '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
  '  <title>Fan Mail to Song</title>',
  '  <meta name="robots" content="noindex, nofollow, noarchive" />',
  '  <meta name="referrer" content="no-referrer" />',
  '  <link rel="stylesheet" href="/song-helper-v3.css?v=20261018h1" />',
  '  <link rel="stylesheet" href="/fan-song.css?v=20261019f2" />',
  '</head>',
  '<body>',
  '  <main class="v3-app fan-app" id="fan"></main>',
  '  <script src="/lib/fan-song.js?v=20261019f2"></script>',
  '  <script src="/fan-song.js?v=20261019f2"></script>',
  '</body>',
  '</html>',
  '',
].join('\n');

async function getJson(url) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), 8000) : null;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: controller ? controller.signal : undefined });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function findPage(name) {
  const q = encodeURIComponent(name);
  const s = await getJson(WIKI + '/w/api.php?action=query&list=search&srlimit=1&format=json&srsearch=' + q);
  const hit = s && s.query && s.query.search && s.query.search[0];
  if (!hit) return null;
  const title = hit.title;
  const sum = await getJson(WIKI + '/api/rest_v1/page/summary/' + encodeURIComponent(title.replace(/ /g, '_')));
  const ext = await getJson(WIKI + '/w/api.php?action=query&prop=extracts&explaintext=1&exsectionformat=plain&format=json&titles=' + encodeURIComponent(title));
  const pages = ext && ext.query && ext.query.pages ? Object.values(ext.query.pages) : [];
  const text = String((pages[0] && pages[0].extract) || '').slice(0, 9000);
  return {
    title,
    description: (sum && sum.description) || '',
    url: (sum && sum.content_urls && sum.content_urls.desktop && sum.content_urls.desktop.page) || (WIKI + '/wiki/' + encodeURIComponent(title.replace(/ /g, '_'))),
    text,
  };
}

function heuristicFacts(page, type) {
  const sentences = page.text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 40 && s.length < 220);
  const want = type === 'Musician' ? /\b(album|single|song|tour|grammy|debut|released|record|chart|billboard)\b/i
    : type === 'Actor' ? /\b(film|role|starred|series|played|award|oscar|emmy|debut|cast)\b/i
      : /\b(award|founded|known|career|debut|won|began)\b/i;
  const out = [];
  sentences.forEach((s) => {
    if (out.length >= 8 || !want.test(s) || !/\b(19|20)\d{2}\b/.test(s)) return;
    const f = fan.safeFact(s, type);
    if (f) out.push(f);
  });
  return out;
}

async function modelFacts(page, type) {
  const rules = type === 'Musician'
    ? 'Song and album titles with a short backstory are good. Never include any lyrics.'
    : type === 'Actor'
      ? 'Roles and milestones. At most one fact may include a short iconic catchphrase of a few words, in quotes.'
      : 'Career milestones.';
  const r = await xai.chat({
    model: xai.chatModel('grok-4.20-0309-non-reasoning'),
    temperature: 0.2,
    max_tokens: 700,
    timeoutMs: 20000,
    messages: [
      { role: 'system', content: 'You extract true, kind, public career facts from the provided text only. One fact per line, no numbering, under 30 words each. Do not add anything not in the text. Do not use em dashes.' },
      { role: 'user', content: 'Subject: ' + page.title + ' (' + type + '). ' + rules + '\nWrite 8 facts.\n\nTEXT:\n' + page.text },
    ],
  });
  return String(r.content || '').split('\n').map((l) => l.replace(/^[-*\d.)\s]+/, '')).map((l) => fan.safeFact(l, type)).filter(Boolean);
}

async function research(body) {
  const name = String((body && body.name) || '').trim().slice(0, 80);
  if (!name) return { status: 400, body: { ok: false, error: 'Who is the song for? Add their name.' } };
  const nameCheck = fan.check(name);
  if (!nameCheck.ok) return { status: 400, body: { ok: false, error: nameCheck.error } };
  const page = await findPage(name);
  if (!page || !page.text) return { status: 200, body: { ok: true, found: false, type: 'Other', facts: [], note: 'We could not find public facts for that name. You can still write it from your own story.' } };
  const type = fan.typeFromDescription(page.description, page.text.slice(0, 400));
  let facts = [];
  if (xai.configured()) {
    try { facts = await modelFacts(page, type); } catch (e) { facts = []; }
  }
  if (facts.length < 5) facts = facts.concat(heuristicFacts(page, type)).filter((f, i, a) => a.indexOf(f) === i);
  return {
    status: 200,
    body: {
      ok: true,
      found: true,
      name: page.title,
      type,
      description: page.description,
      facts: facts.slice(0, 8).map((text) => ({ text, source: page.url })),
    },
  };
}

async function write(body) {
  const n = fan.normalize(body);
  const v = fan.validate(n);
  if (!v.ok) return { status: 400, body: { ok: false, error: v.error } };
  const style = fan.stylePrompt(n);
  const extra = fan.crisis(n) ? { crisis: fan.CRISIS_LINK, crisisIntl: fan.CRISIS_INTL } : {};
  if (!xai.configured()) {
    return { status: 200, body: Object.assign({ ok: true, sample: true, notice: 'Sample draft. The writer is not connected here.', lyrics: fan.sampleSong(n), style, letter: fan.polishLetter(n), read: fan.plaiRead(n) }, extra) };
  }
  let lyrics = '';
  for (let i = 0; i < 2 && !lyrics; i += 1) {
    try {
      const r = await xai.chat({
        model: xai.chatModel('grok-4.20-0309-non-reasoning'),
        temperature: 0.8,
        max_tokens: 1200,
        timeoutMs: 25000,
        messages: [{ role: 'system', content: fan.systemPrompt() }, { role: 'user', content: fan.writerPrompt(n) }],
      });
      const out = fan.scrubOutput(r.content);
      if (out.split('\n').length >= 8) lyrics = out;
    } catch (e) { /* try once more, then sample */ }
  }
  if (!lyrics) return { status: 200, body: Object.assign({ ok: true, sample: true, notice: 'The writer is busy, so here is a sample draft.', lyrics: fan.sampleSong(n), style, letter: fan.polishLetter(n), read: fan.plaiRead(n) }, extra) };
  return { status: 200, body: Object.assign({ ok: true, sample: false, lyrics, style, letter: fan.polishLetter(n), read: fan.plaiRead(n) }, extra) };
}

module.exports = { PAGE_HTML, research, write, findPage, heuristicFacts };
