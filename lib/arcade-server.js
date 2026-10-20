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
  '  <link rel="stylesheet" href="/arcade.css?v=20261020q1" />',
  '</head>',
  '<body>',
  '  <main class="v3-app arc-app" id="arc"></main>',
  '  <script src="/lib/fan-song.js?v=20261020q1"></script>',
  '  <script src="/lib/arcade.js?v=20261020q1"></script>',
  '  <script src="/arcade.js?v=20261020q1"></script>',
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

async function research(body) {
  const s = state(body);
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
    const sound = data.sound && typeof data.sound === 'object' ? {
      genre: A.stripNames(String(data.sound.genre || 'Pop'), names) || 'Pop',
      sub: A.stripNames(String(data.sound.sub || ''), names),
      bpm: Math.max(50, Math.min(180, Number(data.sound.bpm) || 100)),
      inst: A.stripNames(String(data.sound.inst || ''), names),
      vocal: A.stripNames(String(data.sound.vocal || ''), names),
      key: /minor/i.test(String(data.sound.key || '')) ? 'minor key' : 'major key',
    } : null;
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
  if (!xai.configured()) return ok({ sample: true, notice: A.SAMPLE_NOTICE, lines: A.sampleLines(s, slot) });
  try {
    let got = lines3(await chat(A.BASE_RULES, A.linesPrompt(s, slot), 300)).map((l) => A.scrubOutput(l, s)).filter(Boolean);
    if (got.length < 3) got = got.concat(A.sampleLines(s, slot)).slice(0, 3);
    return ok({ sample: false, lines: got });
  } catch (e) {
    return ok({ sample: true, notice: A.SAMPLE_NOTICE, lines: A.sampleLines(s, slot) });
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
    let lyrics = A.scrubOutput(await chat(A.BASE_RULES, A.songPrompt(s)), s);
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

async function fix(body) {
  const s = state(body);
  const text = String(body.text || '').slice(0, 6000);
  if (text.trim().length < 12) return bad('Paste your song first.');
  const g = inputGate(s, text);
  if (!g.ok) return bad(g.error);
  const extra = crisisExtra(text);
  const line = String(body.line || '').slice(0, 300);
  const off = Array.isArray(body.off) ? body.off.slice(0, 7).map(String) : [];
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

const ACTIONS = { 'arcade-research': research, 'arcade-lines': lineOptions, 'arcade-write': writeSong, 'arcade-battle': battle, 'arcade-fix': fix, 'arcade-flip': flip, 'arcade-status': status };

module.exports = { PAGE_HTML, ACTIONS, localFix };
