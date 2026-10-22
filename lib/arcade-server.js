'use strict';
/*
 * Server side of the hidden Song Helper Arcade. Called from api/song-helper.js (no new api/ file).
 * The xAI key stays on the server (lib/xai-client). Credits are counted on the page, like the v3 preview.
 */
const A = require('./arcade');
const xai = require('./xai-client');
const guard = require('./song-guard');
const parodyV2 = require('./parody-v2');
const artistDev = require('./artist-dev');

const PAGE_HTML = [
  '<!DOCTYPE html>',
  '<html lang="en">',
  '<head>',
  '  <meta charset="UTF-8" />',
  '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
  '  <title>Song Lab | PLAIGROUND</title>',
  '  <meta name="robots" content="noindex, nofollow, noarchive" />',
  '  <meta name="referrer" content="no-referrer" />',
  '  <link rel="stylesheet" href="/song-helper-v3.css?v=20261018h1" />',
  '  <link rel="stylesheet" href="/arcade.css?v=20261022wordy" />',
  '</head>',
  '<body>',
  '  <main class="v3-app arc-app" id="arc"></main>',
  '  <script src="/lib/fan-song.js?v=20261020r1"></script>',
  '  <script src="/lib/prompt-check.js?v=20261022flip"></script>',
  '  <script src="/lib/arcade.js?v=20261022flip"></script>',
  '  <script src="/arcade.js?v=20261022flip"></script>',
  '</body>',
  '</html>',
  '',
].join('\n');

function model() { return xai.chatModel('grok-4.20-0309-non-reasoning'); }

async function chat(system, user, maxTokens, temp) {
  const r = await xai.chat({
    model: model(),
    temperature: typeof temp === 'number' ? temp : 0.8,
    max_tokens: maxTokens || 1400,
    timeoutMs: 25000,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
  });
  return String(r.content || '');
}

function bad(error, status) { return { status: status || 400, body: { ok: false, error } }; }
function ok(body) { return { status: 200, body: Object.assign({ ok: true }, body) }; }
function state(body) { return (body && body.state && typeof body.state === 'object') ? body.state : {}; }

function inputGate(s, text) {
  const g = guard.contentFilter(text, { allowVoice: false });
  if (!g.ok) return g;
  return A.checkInput(s, text);
}
function crisisExtra(text) { return A.crisis(text) ? { crisis: A.CRISIS } : {}; }
function allText(s, extra) { return [JSON.stringify(s.answers || {}), (s.built || []).join('\n'), s.title || '', extra || ''].join('\n'); }

function lines3(text) {
  return String(text || '').split('\n').map((l) => l.replace(/^[\d\-*.)\s]+/, '').replace(/^"|"$/g, '').trim())
    .filter((l) => l && !/^\[/.test(l)).slice(0, 3);
}

async function celebResearch(s) {
  const a = s.answers || {};
  const name = String(a.name || '').trim().slice(0, 100);
  if (!name) return bad('Who are we roasting?');
  const g = inputGate(s, name);
  if (!g.ok) return bad(g.error);
  const sample = { persona: name + ', as the public knows them', songs: ['Their biggest hit (the one everyone knows)'], brand: ['The signature look'], moments: ['The moment that went viral'], jokes: ['The running joke fans make'], career: ['The pivot nobody saw coming'] };
  const pack = (d) => {
    const clean = (v, n) => (Array.isArray(v) ? v : (v ? [v] : [])).slice(0, n).map((t) => A.scrubOutput(String(t).slice(0, 160), Object.assign({}, s, { type: 'roast' }))).filter(Boolean);
    const r = { persona: clean(d.persona, 1)[0] || '', songs: clean(d.songs, 6), brand: clean(d.brand, 4), moments: clean(d.moments, 5), jokes: clean(d.jokes, 5), career: clean(d.career, 5), sound: A.normalizeSound(d.sound, [name]) };
    r.topics = [r.persona].concat(r.songs.slice(0, 2), r.moments.slice(0, 2), r.jokes.slice(0, 2)).filter(Boolean);
    return r;
  };
  if (!xai.configured()) return ok({ sample: true, notice: A.SAMPLE_NOTICE, research: pack(sample) });
  try {
    const raw = await chat('You are a comedy roast researcher. Public, widely reported facts only. Never quote lyrics. JSON only.', A.celebResearchPrompt(name), 900, 0.4);
    const m = raw.match(/\{[\s\S]*\}/);
    const d = m ? JSON.parse(m[0]) : null;
    if (!d) throw new Error('parse');
    return ok({ sample: false, research: pack(d) });
  } catch (e) {
    return ok({ sample: true, notice: 'Research is busy, so here are starter ideas.', research: pack(sample) });
  }
}

async function research(body) {
  const s = state(body);
  if (s.sub === 'celeb') return celebResearch(s);
  const a = s.answers || {};
  const song = String(a.song || '').trim().slice(0, 100);
  const artist = String(a.artist || '').trim().slice(0, 100);
  if (!song) return bad('What song are we flipping?');
  const g = inputGate(s, song + ' ' + artist);
  if (!g.ok) return bad(g.error);
  if (!xai.configured()) {
    return ok({ sample: true, notice: A.SAMPLE_NOTICE, research: {
      topics: ['The big boast in the hook', 'How the singer says they do not care', 'The flashy scene everyone remembers', 'The story beat in verse 2'],
      angles: A.parodyAngles(song, artist),
      sound: null,
    } });
  }
  try {
    const raw = await chat('You are a music researcher. Never quote lyrics. JSON only.', A.researchPrompt(song, artist), 700, 0.3);
    const m = raw.match(/\{[\s\S]*\}/);
    const data = m ? JSON.parse(m[0]) : null;
    if (!data || !Array.isArray(data.topics)) throw new Error('parse');
    const names = [song, artist];
    const sound = A.normalizeSound(data.sound, names);
    return ok({ sample: false, research: {
      topics: data.topics.slice(0, 5).map((t) => A.scrubOutput(String(t).slice(0, 160), s)).filter(Boolean),
      angles: A.normalizeAngles(data.angles, song, artist).map((t, i) => A.scrubOutput(String(t).slice(0, 140), s) || A.parodyAngles(song, artist)[i]),
      sound,
    } });
  } catch (e) {
    return ok({ sample: true, notice: 'Research is busy, so here are starter ideas.', research: { topics: ['The hook\'s big claim', 'The attitude in the verses', 'The famous moment'], angles: A.parodyAngles(song, artist), sound: null } });
  }
}

async function lineOptions(body) {
  const s = state(body);
  if (s.aiLevel === 'human') return bad('Me, all me mode has no Plai lines.');
  const g = inputGate(s, allText(s));
  if (!g.ok) return bad(g.error);
  const slot = String(body.slot || 'chorus').slice(0, 30);
  if (!xai.configured()) return ok({ sample: true, notice: A.SAMPLE_NOTICE, lines: A.finishNextLines(A.sampleLines(s, slot), s, slot, body.left) });
  try {
    const raw = await chat(A.baseRules ? A.baseRules(s) : A.BASE_RULES, A.nextLinePrompt(s, slot, body.left), 300, 0.85);
    let got = A.parseNextLines(raw).map((l) => A.scrubOutput(l, s));
    if (!got.filter(Boolean).length) got = lines3(raw).map((l) => A.scrubOutput(l, s));
    const fresh = A.dedupeLines(got.filter(Boolean).map((l) => l.split(' / ')[0]), s.built || []);
    if (fresh.length < 3) {
      // The model echoed the song. Ask once more, naming the lines it must not reuse.
      const retry = await chat(A.BASE_RULES, A.nextLinePrompt(s, slot, body.left) + '\nYour last try repeated lines already in the song. Every option must use NEW words and NEW images. Do not reuse: ' + (s.built || []).join(' | '), 300, 0.95);
      got = got.concat(A.parseNextLines(retry).map((l) => A.scrubOutput(l, s)));
    }
    got = A.finishNextLines(got, s, slot, body.left);
    return ok({ sample: false, lines: got });
  } catch (e) {
    return ok({ sample: true, notice: A.SAMPLE_NOTICE, lines: A.finishNextLines(A.sampleLines(s, slot), s, slot, body.left) });
  }
}

async function writeSong(body) {
  const s = state(body);
  const text = allText(s);
  const g = inputGate(s, text);
  if (!g.ok) return bad(g.error);
  const extra = crisisExtra(text);
  if (s.aiLevel === 'human') {
    // No AI call. Their own lines, assembled.
    const built = (s.built || []).filter(Boolean);
    const half = Math.ceil(built.length / 2);
    const lyrics = ['[Chorus]'].concat(built.slice(0, half), ['', '[Verse 1]'], built.slice(half)).join('\n');
    return ok(Object.assign({ sample: false, human: true, lyrics: A.scrubOutput(lyrics, s) }, extra));
  }
  if (!xai.configured()) {
    let lyrics = A.sampleSong(s);
    if (s.type === 'parody') {
      const a = s.answers || {};
      const pack = parodyV2.package({ title: s.title || A.suggestTitle(s), originalTitle: a.song, comment: String(a.newTopic || a.angle || '').replace(/^(what it says|how it says it|the artist)\s*:\s*/i, ''), happened: (s.research && s.research.topics || []).join('. ') });
      lyrics = A.scrubOutput(parodyV2.plain(pack).replace(/\nStyle prompt[\s\S]*$/, '').replace(/^(Straight|Weird Al style mix)\n/, '').replace(/^(Intro|Verse 1|Pre-chorus|Chorus|Verse 2|Bridge|Outro)$/gm, '[$1]'), s);
    }
    return ok(Object.assign({ sample: true, notice: A.SAMPLE_NOTICE, lyrics }, extra));
  }
  try {
    let lyrics = A.scrubOutput(await chat(A.baseRules(s), A.songPrompt(s), 1400, s.sub === 'celeb' ? 0.95 : 0.8), s);
    if (s.type === 'parody' && s.answers && s.answers.song) {
      const pack = parodyV2.scrubPackage({ draft: { sections: A.splitLyrics(lyrics).map((x) => ({ label: x.label, lines: x.lines.map((t) => ({ text: t })) })) } }, { lines: '', title: s.title, originalTitle: s.answers.song });
      lyrics = pack.draft.sections.map((x) => '[' + x.label + ']\n' + x.lines.map((r) => r.text || r).join('\n')).join('\n\n');
    }
    const after = guard.contentFilter(lyrics);
    if (!after.ok || lyrics.split('\n').length < 6) throw new Error('weak');
    return ok(Object.assign({ sample: false, lyrics }, extra));
  } catch (e) {
    return ok(Object.assign({ sample: true, notice: 'The writer is busy, so here is a sample draft.', lyrics: A.sampleSong(s) }, extra));
  }
}

async function battle(body) {
  const s = state(body);
  const round = Math.max(1, Math.min(3, Number(body.round) || 1));
  const userBars = String(body.userBars || '').slice(0, 1200);
  const history = String(body.history || '').slice(0, 4000);
  const g = inputGate(s, allText(s, userBars));
  if (!g.ok) return bad(g.error);
  if (!xai.configured()) return ok({ sample: true, notice: A.SAMPLE_NOTICE, bars: A.sampleBattle(s, round) });
  try {
    const bars = A.scrubOutput(await chat(A.BASE_RULES, A.battlePrompt(s, round, userBars, history), 500), s);
    if (!guard.contentFilter(bars).ok || bars.split('\n').length < 4) throw new Error('weak');
    return ok({ sample: false, bars });
  } catch (e) {
    return ok({ sample: true, notice: A.SAMPLE_NOTICE, bars: A.sampleBattle(s, round) });
  }
}

function localFix(text) {
  const parts = artistDev.splitSong(text);
  const voice = artistDev.inferVoice(parts);
  return parts.map((p) => '[' + p.label + ']\n' + artistDev.improvePart(p.text, p.kind, voice).text).join('\n\n');
}

// Too wordy and Clean up my lines. The model only proposes line breaks, tags and cuts;
// alignDraft rebuilds every line from the writer's own words, so no new words and no dropped lines.
async function shape(text, mode, level) {
  let sample = !xai.configured();
  const ask = async (prompt) => { if (sample) return ''; try { return await chat(A.BASE_RULES, prompt, 1400, 0.3); } catch (e) { return ''; } };
  // Step 1: structure only. Same words, same order, real line breaks.
  let draft = await ask(A.cleanupPrompt(text));
  if (!draft || draft.split('\n').length < 3) { draft = A.localLines(text); sample = true; }
  const items = A.alignDraft(text, draft, true);
  const base = A.draftText(items);
  if (mode === 'trim') {
    // Step 2: cut. Up to 2 tries to reach the level, only ever deleting.
    const lv = A.trimLevel(level);
    const goal = Math.round(A.countWords(base) * lv.pct / 100);
    for (let tries = 0; tries < 2 && A.cutCount(items) < goal * 0.85; tries++) {
      const now = A.draftText(items);
      const list = A.parseCutList(await ask(A.trimPrompt(now, lv.id, goal - A.cutCount(items))));
      if (list.length) A.applyCutList(items, list, goal, lv.pct >= 40 ? 0.6 : 0.7);
      else { A.applyCuts(items, A.localTrimDraft(now, lv.id)); sample = true; break; }
    }
  }
  const after = A.draftText(items);
  return { sample, notice: sample ? A.SAMPLE_NOTICE : '', mode, level: mode === 'trim' ? A.trimLevel(level).id : '', items, lyrics: after, structured: base, wordsBefore: A.countWords(text), wordsAfter: A.countWords(after) };
}

async function fix(body) {
  const s = state(body);
  const text = String(body.text || '').slice(0, 6000);
  if (text.trim().length < 12) return bad('Paste your song first.');
  const g = inputGate(s, text);
  if (!g.ok) return bad(g.error);
  const extra = crisisExtra(text);
  const line = String(body.line || '').slice(0, 300);
  const off = Array.isArray(body.off) ? body.off.slice(0, 7).map(String) : [];
  if (body.mode === 'trim' || body.mode === 'cleanup') return ok(Object.assign(await shape(text, body.mode, String(body.level || '')), extra));
  if (line) {
    const sample = () => [line.replace(/\b(really|just|very|so)\b\s*/ig, '').trim() || line, line.split(' ').reverse().slice(0, 3).reverse().join(' ') + ', yeah', cap(line.replace(/[.!?]+$/, '')) + ' tonight'];
    if (!xai.configured()) return ok({ sample: true, notice: A.SAMPLE_NOTICE, options: sample() });
    try {
      let got = lines3(await chat(A.BASE_RULES, A.fixPrompt(text, off, line), 300)).map((l) => A.scrubOutput(l, s)).filter(Boolean);
      if (got.length < 3) got = got.concat(sample()).slice(0, 3);
      return ok({ sample: false, options: got });
    } catch (e) {
      return ok({ sample: true, notice: A.SAMPLE_NOTICE, options: sample() });
    }
  }
  if (!xai.configured()) return ok(Object.assign({ sample: true, notice: A.SAMPLE_NOTICE, lyrics: A.scrubOutput(localFix(text), s) }, extra));
  try {
    const lyrics = A.scrubOutput(await chat(A.BASE_RULES, A.fixPrompt(text, off, '')), s);
    if (lyrics.split('\n').length < 4) throw new Error('weak');
    return ok(Object.assign({ sample: false, lyrics }, extra));
  } catch (e) {
    return ok(Object.assign({ sample: true, notice: A.SAMPLE_NOTICE, lyrics: A.scrubOutput(localFix(text), s) }, extra));
  }
}
function cap(x) { x = String(x || '').trim(); return x ? x.charAt(0).toUpperCase() + x.slice(1) : ''; }

async function flip(body) {
  const s = state(body);
  s.card = 'flip';
  const text = String(body.text || '').slice(0, 6000);
  if (text.trim().length < 12) return bad('Paste your song first.');
  const g = inputGate(s, text + '\n' + JSON.stringify(s.flip || {}));
  if (!g.ok) return bad(g.error);
  const extra = crisisExtra(text);
  if (!xai.configured()) return ok(Object.assign({ sample: true, notice: A.SAMPLE_NOTICE, lyrics: A.sampleFlip(text, s) }, extra));
  try {
    const lyrics = A.scrubOutput(await chat(A.BASE_RULES, A.flipPrompt(text, s)), s);
    if (lyrics.split('\n').length < 4) throw new Error('weak');
    return ok(Object.assign({ sample: false, lyrics }, extra));
  } catch (e) {
    return ok(Object.assign({ sample: true, notice: A.SAMPLE_NOTICE, lyrics: A.sampleFlip(text, s) }, extra));
  }
}

function status() { return ok({ writer: xai.configured() }); }

async function ideas(body) {
  const s = state(body);
  const g = inputGate(s, allText(s));
  if (!g.ok) return bad(g.error);
  if (!xai.configured()) return ok({ sample: true, notice: A.SAMPLE_NOTICE, ideas: A.sampleIdeas(s) });
  try {
    let got = A.parseIdeas(await chat('You help songwriters brainstorm. Real public facts only for real people and songs. Never quote lyrics.', A.ideasPrompt(s), 400, 0.5), s);
    if (got.length < 6) got = got.concat(A.sampleIdeas(s)).filter((x, i, arr) => arr.indexOf(x) === i).slice(0, 8);
    return ok({ sample: false, ideas: got });
  } catch (e) {
    return ok({ sample: true, notice: 'Plai is busy, so here are starter ideas.', ideas: A.sampleIdeas(s) });
  }
}

async function section(body) {
  const s = state(body);
  const sec = String(body.section || '').slice(0, 1500);
  const idea = String(body.idea || '').slice(0, 120);
  const song = String(body.song || '').slice(0, 6000);
  const keep = Array.isArray(body.keep) ? body.keep.slice(0, 8).map(String) : [];
  if (!sec.trim()) return bad('Pick a part first.');
  const g = inputGate(s, sec + '\n' + idea);
  if (!g.ok) return bad(g.error);
  if (!xai.configured()) return ok({ sample: true, notice: A.SAMPLE_NOTICE, lines: A.finishSection('', s, sec, keep, song) });
  try {
    const raw = await chat(A.BASE_RULES, A.sectionPrompt(s, sec, idea, keep, song), 500, 0.85);
    return ok({ sample: false, lines: A.finishSection(raw, s, sec, keep, song) });
  } catch (e) {
    return ok({ sample: true, notice: A.SAMPLE_NOTICE, lines: A.finishSection('', s, sec, keep, song) });
  }
}


// ---------- Give me ideas: real stories from the news feed, angles from the AI ----------
const NEWS_CACHE = {};
function decodeXml(t) { return String(t || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim(); }
async function fetchStories(tile) {
  const hit = NEWS_CACHE[tile.id];
  if (hit && Date.now() - hit.at < 15 * 60 * 1000) return hit.items;
  const url = tile.q ? 'https://news.google.com/rss/search?q=' + encodeURIComponent(tile.q + ' when:7d') + '&hl=en-US&gl=US&ceid=US:en' : 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en';
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 8000);
  let xml = '';
  try { const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 PLAIGROUND Song Lab' } }); if (!r.ok) throw new Error('feed'); xml = await r.text(); } finally { clearTimeout(timer); }
  const items = (xml.match(/<item>[\s\S]*?<\/item>/g) || []).map((it) => {
    const get = (tag) => { const m = it.match(new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>')); return m ? decodeXml(m[1]) : ''; };
    const source = get('source');
    let title = get('title'); if (source && title.endsWith(' - ' + source)) title = title.slice(0, -(source.length + 3));
    const d = new Date(get('pubDate'));
    return { title: title.slice(0, 220), link: get('link'), source: source.slice(0, 80), date: isNaN(d) ? '' : d.toISOString().slice(0, 10) };
  }).filter((x) => x.title && /^https:\/\//.test(x.link));
  NEWS_CACHE[tile.id] = { at: Date.now(), items };
  return items;
}
async function newsIdeas(body) {
  const tile = A.ideaTile(String(body.tile || ''));
  if (!tile) return bad('Pick a tile first.');
  const seen = new Set(Array.isArray(body.seen) ? body.seen.slice(0, 60).map(String) : []);
  const none = () => ok({ ideas: [], empty: true, message: A.NO_STORIES });
  if (!xai.configured()) return none();
  let stories;
  try { stories = (await fetchStories(tile)).filter((x) => !seen.has(x.link)); } catch (e) { return none(); }
  if (stories.length < 3) return none();
  stories = stories.slice(0, 10);
  try {
    const raw = await chat('You write song ideas from real news. Facts only from the given headlines. JSON only.', A.newsIdeasPrompt(tile, stories), 900, 0.6);
    const ideas = A.parseNewsIdeas(raw, stories, tile).filter((x) => guard.contentFilter(x.angle + ' ' + x.story, { allowVoice: false }).ok);
    if (!ideas.length) return none();
    return ok({ ideas, tile: tile.id });
  } catch (e) {
    return none();
  }
}

const ACTIONS = { 'arcade-news-ideas': newsIdeas, 'arcade-section': section, 'arcade-ideas': ideas, 'arcade-research': research, 'arcade-lines': lineOptions, 'arcade-write': writeSong, 'arcade-battle': battle, 'arcade-fix': fix, 'arcade-flip': flip, 'arcade-status': status };

module.exports = { PAGE_HTML, ACTIONS, localFix };
