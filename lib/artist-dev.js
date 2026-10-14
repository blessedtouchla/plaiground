'use strict';

/**
 * Song Helper artist-development preview.
 * Idea Vault, Read Me, and Persona Lock stay on the signed-in user.
 * Themes and rewrites quote saved lines. They do not invent a story.
 */

const isNode = typeof module !== 'undefined' && module.exports;
const crypto = isNode ? require('crypto') : null;
const db = isNode ? require('./db') : null;

const ALLOWANCE = 12;
const CREDIT = 1;
const TITLE_MAX = 80;
const LINE_MAX = 400;
const NOTE_MAX = 400;
const AUDIO_MAX = 180000;
const VAULT_LIMIT = 40;
const KINDS = { title: true, line: true, memo: true, song: true };
const SONG_MAX = 8000;

const STOP = {
  a: true, an: true, the: true, and: true, or: true, but: true, if: true, so: true,
  to: true, of: true, in: true, on: true, at: true, for: true, with: true, from: true,
  is: true, was: true, are: true, were: true, be: true, been: true, it: true, its: true,
  this: true, that: true, these: true, those: true, my: true, your: true, you: true,
  me: true, i: true, we: true, our: true, they: true, them: true, he: true, she: true,
  his: true, her: true, not: true, no: true, just: true, like: true, when: true, then: true,
  there: true, here: true, what: true, who: true, how: true, about: true, into: true,
  out: true, up: true, down: true, over: true, after: true, before: true, still: true,
  have: true, had: true, has: true, do: true, did: true, can: true, could: true,
};

const GENRES = [
  { genre: 'R&B', subgenre: 'quiet storm', words: ['heart', 'baby', 'night', 'love', 'hold', 'kiss', 'soul', 'slow'] },
  { genre: 'Hip-hop', subgenre: 'boom bap', words: ['block', 'bars', 'rhyme', 'city', 'crew', 'mic', 'street'] },
  { genre: 'Country', subgenre: 'storytelling country', words: ['truck', 'town', 'dirt', 'porch', 'whiskey', 'highway', 'boots'] },
  { genre: 'Gospel', subgenre: 'choir gospel', words: ['god', 'lord', 'faith', 'pray', 'church', 'grace', 'heaven', 'amen'] },
  { genre: 'Pop', subgenre: 'bedroom pop', words: ['dance', 'tonight', 'lights', 'radio', 'party', 'chorus'] },
  { genre: 'Latin', subgenre: 'latin pop', words: ['amor', 'noche', 'corazon', 'baile', 'mami'] },
  { genre: 'Reggae', subgenre: 'one drop', words: ['skank', 'riddim', 'offbeat', 'dub', 'backyard', 'bassline'] },
];

const GENRE_SLANG = {
  'R&B': ['baby', 'for real', 'all night'],
  'Hip-hop': ['for real', 'no cap', 'on me'],
  'Country': ['yall', 'reckon', 'back home'],
  'Gospel': ['amen', 'glory', 'hallelujah'],
  'Pop': ['for real', 'all night', 'right now'],
  'Latin': ['mami', 'noche', 'vamo'],
  'Reggae': ['bassline', 'skank', 'offbeat'],
};

let vaultRows = [];
let stateRows = [];

function resetStore() {
  vaultRows = [];
  stateRows = [];
}

function usingAccountsMemory() {
  try {
    const accounts = require('./accounts');
    return typeof accounts.usingMemory === 'function' && accounts.usingMemory();
  } catch (err) {
    return false;
  }
}

function memoryMode() {
  return usingAccountsMemory() || !db.hasDatabase();
}

function validationError(message) {
  const err = new Error(message);
  err.code = 'VALIDATION';
  return err;
}

function clip(value, max) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function clipBlock(value, max) {
  return String(value == null ? '' : value).replace(/\r\n/g, '\n').trim().slice(0, max);
}

function tokens(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9'\s]/g, ' ').split(/\s+/).filter(Boolean);
}

function capWord(value) {
  const word = String(value || '');
  if (!word) return '';
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function hookOk(text) {
  const line = String(text || '').trim();
  if (line.length < 12 || line.indexOf(' ') === -1) return false;
  const parts = line.split('\n').map((row) => row.trim()).filter(Boolean);
  if (!parts.length || parts.length > 2) return false;
  const counts = {};
  for (let i = 0; i < parts.length; i += 1) {
    const key = parts[i].toLowerCase();
    counts[key] = (counts[key] || 0) + 1;
    if (counts[key] >= 4) return false;
  }
  return true;
}

function themesFromLines(lines) {
  const unique = [];
  const seen = {};
  (Array.isArray(lines) ? lines : []).forEach((row) => {
    const line = clip(row, 400);
    const key = line.toLowerCase();
    if (line.length < 12 || line.indexOf(' ') === -1 || seen[key]) return;
    seen[key] = true;
    unique.push(line);
  });
  if (unique.length < 3) return [];
  const freq = {};
  unique.forEach((line) => {
    tokens(line).forEach((word) => {
      if (STOP[word] || word.length < 4) return;
      freq[word] = (freq[word] || 0) + 1;
    });
  });
  const shared = Object.keys(freq).filter((word) => freq[word] >= 2);
  const clusters = shared.map((word) => ({
    word,
    quotes: unique.filter((line) => tokens(line).indexOf(word) !== -1),
  })).sort((a, b) => b.quotes.length - a.quotes.length || a.word.localeCompare(b.word));
  const picked = [];
  const used = {};
  clusters.forEach((cluster) => {
    if (picked.length >= 5) return;
    const quote = cluster.quotes.filter((line) => !used[line.toLowerCase()])[0];
    if (!quote) return;
    used[quote.toLowerCase()] = true;
    picked.push({ name: capWord(cluster.word), quote });
  });
  if (picked.length < 3) return [];
  return picked.slice(0, 5);
}

function genreSuggestions(lines) {
  const blob = tokens((Array.isArray(lines) ? lines : []).join(' '));
  const scored = GENRES.map((row) => {
    const hits = row.words.filter((word) => blob.indexOf(word) !== -1);
    return { genre: row.genre, subgenre: row.subgenre, hits: hits.length };
  }).filter((row) => row.hits >= 2).sort((a, b) => b.hits - a.hits || a.genre.localeCompare(b.genre));
  return scored.slice(0, 3).map((row) => ({ genre: row.genre, subgenre: row.subgenre }));
}

function pointOfView(quotes) {
  const blob = tokens((quotes || []).join(' '));
  let first = 0;
  let second = 0;
  blob.forEach((word) => {
    if (word === 'i' || word === 'me' || word === 'my' || word === "i'm") first += 1;
    if (word === 'you' || word === 'your') second += 1;
  });
  if (first > second) return 'first person';
  if (second > first) return 'second person';
  return 'the speaker in the saved lines';
}

function vocabularyFrom(quotes) {
  const freq = {};
  (quotes || []).forEach((line) => {
    tokens(line).forEach((word) => {
      if (STOP[word] || word.length < 4) return;
      freq[word] = (freq[word] || 0) + 1;
    });
  });
  return Object.keys(freq).sort((a, b) => freq[b] - freq[a] || a.localeCompare(b)).slice(0, 16);
}

function personaFromReadMe(readMe) {
  const themes = readMe && Array.isArray(readMe.themes) ? readMe.themes : [];
  const quotes = themes.map((row) => clip(row && row.quote, 400)).filter(Boolean);
  if (quotes.length < 3) return null;
  const genres = readMe && Array.isArray(readMe.genres) ? readMe.genres : [];
  const genre = genres[0] ? genres[0].genre : '';
  const slang = (GENRE_SLANG[genre] || []).slice(0, 3);
  const pov = pointOfView(quotes);
  return {
    pov,
    vocabulary: vocabularyFrom(quotes),
    slang,
    slangNote: slang.length
      ? 'Slang matched to ' + genre + '. These words are a genre match, not a claim that you wrote them.'
      : 'No genre slang yet. Read Me did not have two genre matches.',
    themes: themes.map((row) => ({ name: clip(row.name, 40), quote: clip(row.quote, 400) })).filter((row) => row.quote),
    quotes,
    genre,
    do: [
      'Stay in ' + pov + '.',
      'Use words from the saved lines.',
      'When a part needs a turn, quote a saved line as written.',
    ],
    dont: [
      'Do not add a story that is not in the saved lines.',
      'Do not name a music generator.',
      'Do not promise streams, placements, or a royalty cut. Artists keep 100%.',
    ],
  };
}

function offVoice(text, persona) {
  const body = String(text || '').trim();
  if (!body || !persona) return { off: false, reason: '' };
  const lower = body.toLowerCase();
  var blockedName = new RegExp('\\b(' + ['su', 'no'].join('') + '|' + ['tone', 'grid'].join('') + ')\\b', 'i');
  if (blockedName.test(body)) {
    return { off: true, reason: 'This part names a tool that does not belong in the lyric.' };
  }
  if (/royalty cut|we take \d+\s*%/.test(lower)) {
    return { off: true, reason: 'This part talks about a royalty cut. Artists keep 100%.' };
  }
  const quotes = (persona.quotes || []).map((row) => String(row || '').toLowerCase()).filter(Boolean);
  if (quotes.some((quote) => lower.indexOf(quote) !== -1)) return { off: false, reason: '' };
  const vocab = persona.vocabulary || [];
  const words = tokens(body).filter((word) => !STOP[word] && word.length >= 4);
  const hits = words.filter((word) => vocab.indexOf(word) !== -1);
  if (words.length >= 3 && hits.length === 0) {
    return { off: true, reason: 'This part does not use the words from your voice sheet.' };
  }
  return { off: false, reason: '' };
}

const PART_HEADER = /^\s*\[?\s*(intro|verse|chorus|hook|pre[-\s]?chorus|bridge|outro)(?:\s+(\d+))?\s*\]?\s*:?\s*$/i;

function headerMeta(word, num) {
  const name = String(word || '').toLowerCase().replace(/[\s-]+/g, '');
  if (name === 'chorus' || name === 'hook') return { kind: 'hook', label: 'Hook' };
  if (name === 'bridge') return { kind: 'bridge', label: 'Bridge' };
  if (name === 'outro') return { kind: 'outro', label: 'Outro' };
  if (name === 'intro') return { kind: 'intro', label: 'Intro' };
  if (name === 'prechorus') return { kind: 'prechorus', label: 'Pre-chorus' };
  const n = num ? Number(num) : 0;
  return { kind: 'verse', label: 'Verse ' + (n || 1), verseNum: n };
}

function withPartIds(rows) {
  const seen = {};
  return rows.map((row) => {
    const base = row.kind === 'verse'
      ? ('verse-' + ((String(row.label).match(/\d+/) || ['1'])[0]))
      : row.kind;
    const n = seen[base] || 0;
    seen[base] = n + 1;
    return {
      id: n ? (base + '-' + (n + 1)) : base,
      kind: row.kind,
      label: row.label,
      text: String(row.text || '').trim(),
      inferred: !!row.inferred,
    };
  }).filter((row) => row.text);
}

function sectionsFromHeaders(lines) {
  const sections = [];
  let current = null;
  const preface = [];
  let verseN = 0;
  function pushCurrent() {
    if (!current) return;
    current.text = current.text.replace(/^\n+|\n+$/g, '');
    sections.push(current);
    current = null;
  }
  lines.forEach((line) => {
    const match = String(line || '').trim().match(PART_HEADER);
    if (!match) {
      if (!current) preface.push(line);
      else current.text += (current.text ? '\n' : '') + line;
      return;
    }
    pushCurrent();
    const meta = headerMeta(match[1], match[2]);
    if (meta.kind === 'verse') {
      verseN = meta.verseNum || (verseN + 1);
      meta.label = 'Verse ' + verseN;
    }
    current = { id: '', kind: meta.kind, label: meta.label, text: '', inferred: false };
  });
  pushCurrent();
  const intro = preface.join('\n').trim();
  if (intro) {
    sections.unshift({ id: '', kind: 'verse', label: 'Verse 1', text: intro, inferred: true });
  }
  return sections;
}

function blankBlocks(raw) {
  const blocks = [];
  let current = [];
  function push() {
    const body = current.join('\n').trim();
    if (body) blocks.push(body);
    current = [];
  }
  String(raw || '').split('\n').forEach((line) => {
    if (!String(line).trim()) {
      if (current.length) push();
      return;
    }
    current.push(String(line).replace(/[ \t]+$/g, ''));
  });
  if (current.length) push();
  return blocks;
}

function chunkBlock(body) {
  const lines = String(body || '').split('\n');
  if (lines.length < 8) return [body];
  const chunks = [];
  for (let i = 0; i < lines.length; i += 4) chunks.push(lines.slice(i, i + 4).join('\n'));
  return chunks;
}

function lineKey(line) {
  return String(line || '').toLowerCase().replace(/[^a-z0-9\s']/g, '').replace(/\s+/g, ' ').trim();
}

function inferLabels(blocks) {
  const counts = {};
  const keysOf = blocks.map((body) => String(body || '').split('\n').map(lineKey).filter((key) => key.length >= 12));
  keysOf.forEach((keys) => {
    keys.forEach((key) => { counts[key] = (counts[key] || 0) + 1; });
  });
  const hookish = keysOf.map((keys) => {
    const hits = keys.filter((key) => counts[key] >= 2);
    return keys.length > 0 && hits.length >= Math.ceil(keys.length / 2);
  });
  let sawHook = hookish.some(Boolean);
  let verseN = 0;
  return blocks.map((body, index) => {
    const lines = String(body || '').split('\n').filter((line) => line.trim());
    if (hookish[index] || (!sawHook && index === 1 && blocks.length >= 2)) {
      sawHook = true;
      return { kind: 'hook', label: 'Hook', text: body, inferred: true };
    }
    if (index === blocks.length - 1 && blocks.length >= 3 && lines.length <= 2 && verseN >= 2) {
      return { kind: 'bridge', label: 'Bridge', text: body, inferred: true };
    }
    verseN += 1;
    return { kind: 'verse', label: 'Verse ' + verseN, text: body, inferred: true };
  });
}

function splitSong(text) {
  const raw = clipBlock(text, SONG_MAX);
  if (raw.length < 12 || raw.indexOf(' ') === -1) return [];
  const lines = raw.split('\n');
  let headers = 0;
  lines.forEach((line) => { if (PART_HEADER.test(String(line || '').trim())) headers += 1; });
  if (headers >= 1) return withPartIds(sectionsFromHeaders(lines));
  const blocks = blankBlocks(raw);
  const chunked = blocks.length === 1 ? chunkBlock(blocks[0]) : blocks;
  if (!chunked.length) return [];
  return withPartIds(inferLabels(chunked));
}

function focusWord(text) {
  const freq = {};
  tokens(text).forEach((word) => {
    if (STOP[word] || word.length < 4) return;
    freq[word] = (freq[word] || 0) + 1;
  });
  const ranked = Object.keys(freq).sort((a, b) => freq[b] - freq[a] || a.localeCompare(b));
  return { word: ranked[0] || '', count: ranked[0] ? freq[ranked[0]] : 0 };
}

function slangBit(genre, focus) {
  const list = GENRE_SLANG[genre] || [];
  const word = list.filter((item) => item !== focus)[0] || '';
  if (!word) return '';
  if (word === 'yall') return " Y'all.";
  return ' ' + capWord(word) + '.';
}

function partNote(part, genre) {
  const text = String(part && part.text || '').trim();
  const focus = focusWord(text);
  const works = (focus.count >= 2
    ? ('You keep coming back to ' + focus.word + '.')
    : (focus.word ? (capWord(focus.word) + ' is already in this part.') : 'Your words are already in this part.'))
    + slangBit(genre, focus.word);
  let move = focus.word ? ('Lead with the line that names ' + focus.word + '.') : 'Keep the picture you already wrote in the first line.';
  let hookOkFlag = null;
  let hookNote = '';
  if (part && part.kind === 'hook') {
    hookOkFlag = hookOk(text);
    if (hookOkFlag) {
      move = 'Leave the hook at one or two lines so people can sing it back.';
      hookNote = 'Hook score: this hook holds.';
    } else {
      const rows = text.split('\n').map((row) => row.trim()).filter(Boolean);
      if (rows.length > 2) move = 'Keep the hook to one or two lines.';
      else if (text.length < 12 || text.indexOf(' ') === -1) move = 'Give the hook a full line with a few words.';
      else move = 'Do not repeat the same line four times.';
      hookNote = 'Hook score: this hook needs one or two full lines, and the same line cannot repeat four times.';
    }
  }
  return { works: works, improve: 'One move: ' + move, hook_ok: hookOkFlag, hook_note: hookNote };
}

function ownLines(text) {
  return String(text || '').split('\n').map((row) => row.trim()).filter(Boolean);
}

function inferVoice(parts) {
  const lines = [];
  (parts || []).forEach((part) => { ownLines(part && part.text).forEach((line) => lines.push(line)); });
  const genres = genreSuggestions(lines);
  const genre = genres[0] ? genres[0].genre : '';
  return {
    pov: pointOfView(lines),
    vocabulary: vocabularyFrom(lines),
    slang: (GENRE_SLANG[genre] || []).slice(0, 3),
    quotes: lines.filter((line) => line.length >= 12).slice(0, 8),
    genre: genre,
  };
}

function improvePart(text, kind, voice) {
  const lines = ownLines(text);
  if (!lines.length) return { text: '', changed: false };
  const vocab = voice && Array.isArray(voice.vocabulary) ? voice.vocabulary : [];
  const quotes = voice && Array.isArray(voice.quotes) ? voice.quotes.map((row) => String(row || '').toLowerCase()) : [];
  function score(line) {
    const words = tokens(line);
    return words.filter((word) => vocab.indexOf(word) !== -1).length * 2
      + words.filter((word) => !STOP[word] && word.length >= 4).length;
  }
  let nextLines = lines.slice();
  if (kind === 'hook' && !hookOk(lines.join('\n'))) {
    const ranked = lines.slice().sort((a, b) => score(b) - score(a));
    let pick = ranked.filter((line) => hookOk(line));
    if (!pick.length) pick = ranked.filter((line) => line.length >= 12 && line.indexOf(' ') !== -1);
    const chosen = {};
    (pick.length ? pick : ranked).slice(0, 2).forEach((line) => { chosen[line] = true; });
    nextLines = lines.filter((line) => chosen[line]).slice(0, 2);
    if (!nextLines.length) nextLines = lines.slice(0, 2);
  } else {
    const counts = {};
    nextLines = [];
    lines.forEach((line) => {
      const key = line.toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
      if (counts[key] <= 2) nextLines.push(line);
    });
    const hit = nextLines.findIndex((line) => quotes.some((quote) => quote && line.toLowerCase().indexOf(quote) !== -1));
    if (hit > 0) nextLines = [nextLines[hit]].concat(nextLines.slice(0, hit), nextLines.slice(hit + 1));
  }
  const allowed = {};
  lines.forEach((line) => { allowed[line] = true; });
  nextLines = nextLines.filter((line) => allowed[line]);
  const next = nextLines.join('\n');
  return { text: next, changed: next !== lines.join('\n') };
}

function publicVoice(voice) {
  if (!voice) return null;
  return {
    pov: String(voice.pov || ''),
    vocabulary: (voice.vocabulary || []).slice(0, 16),
    slang: (voice.slang || []).slice(0, 3),
    quotes: (voice.quotes || []).map((row) => clip(row, 400)).filter(Boolean).slice(0, 8),
    genre: String(voice.genre || ''),
  };
}

function rewriteOnVoice(text, persona, kind) {
  const quotes = (persona && persona.quotes ? persona.quotes : []).map((row) => clip(row, 400)).filter(hookOk);
  if (!quotes.length) {
    return { ok: false, error: 'Save a full line before an on-voice rewrite.' };
  }
  const wanted = String(kind || '').toLowerCase();
  const sourceTokens = tokens(text);
  const ranked = quotes.slice().sort((a, b) => {
    const score = (line) => tokens(line).filter((word) => sourceTokens.indexOf(word) !== -1).length;
    return score(b) - score(a);
  });
  if (wanted === 'hook') {
    return { ok: true, text: ranked[0] };
  }
  const take = wanted === 'bridge' ? ranked.slice(0, 2) : ranked.slice(0, 4);
  const unique = [];
  take.forEach((line) => {
    if (unique.map((row) => row.toLowerCase()).indexOf(line.toLowerCase()) === -1) unique.push(line);
  });
  return { ok: true, text: unique.join('\n') };
}

function madeCaption(input) {
  const row = input && typeof input === 'object' ? input : {};
  const how = String(row.made_how || '');
  const ai = row.ai_used === true || how === 'ai_assisted' || how === 'fully_ai';
  let lead = '';
  if (how === 'fully_ai') lead = 'generated with AI';
  else if (how === 'ai_assisted' || (ai && how !== 'no_ai')) lead = 'AI assisted, with a person writing and performing the rest';
  else if (how === 'no_ai' || row.ai_used === false) lead = 'written, played, and performed by people';
  else if (ai) lead = 'this release used AI';
  if (!lead) return '';
  const humans = (Array.isArray(row.human_elements) ? row.human_elements : [])
    .map((item) => clip(item, 80))
    .filter(Boolean)
    .slice(0, 8);
  const extra = humans.length ? ' Human work: ' + humans.join(', ') + '.' : '';
  const note = clipBlock(row.human_contribution, 280);
  const more = note ? ' ' + note : '';
  return 'How this song was made: ' + lead + '.' + extra + more;
}

function publicVault(row) {
  if (!row) return null;
  return {
    id: String(row.id || ''),
    kind: String(row.kind || ''),
    title: String(row.title || ''),
    body: String(row.body || ''),
    mime: String(row.mime || ''),
    has_audio: Boolean(row.audio),
    audio: row.audio ? String(row.audio) : '',
    created_at: row.created_at ? new Date(row.created_at).toISOString() : '',
  };
}

function asObject(value) {
  if (value && typeof value === 'object') return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (err) {
      return null;
    }
  }
  return null;
}

async function ready() {
  if (memoryMode()) return;
  const accounts = require('./accounts');
  await accounts.ensureReady();
}

async function readState(userId) {
  await ready();
  const want = String(userId || '');
  if (memoryMode()) {
    const found = stateRows.filter((row) => String(row.user_id) === want)[0];
    if (found) return found;
    const created = { user_id: want, credits: ALLOWANCE, read_me: null, persona: null };
    stateRows.push(created);
    return created;
  }
  const rows = await db.query(
    'SELECT user_id, credits, read_me, persona FROM artist_dev_state WHERE user_id = $1',
    [want]
  );
  if (rows[0]) {
    return {
      user_id: want,
      credits: Number(rows[0].credits),
      read_me: asObject(rows[0].read_me),
      persona: asObject(rows[0].persona),
    };
  }
  await db.query(
    'INSERT INTO artist_dev_state (user_id, credits) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING',
    [want, ALLOWANCE]
  );
  return { user_id: want, credits: ALLOWANCE, read_me: null, persona: null };
}

async function writeState(userId, patch) {
  const current = await readState(userId);
  const next = {
    user_id: String(userId),
    credits: patch.credits != null ? patch.credits : current.credits,
    read_me: patch.read_me !== undefined ? patch.read_me : current.read_me,
    persona: patch.persona !== undefined ? patch.persona : current.persona,
  };
  if (memoryMode()) {
    const index = stateRows.findIndex((row) => String(row.user_id) === next.user_id);
    if (index === -1) stateRows.push(next);
    else stateRows[index] = next;
    return next;
  }
  await db.query(
    'INSERT INTO artist_dev_state (user_id, credits, read_me, persona, updated_at) VALUES ($1, $2, $3::jsonb, $4::jsonb, now()) ON CONFLICT (user_id) DO UPDATE SET credits = EXCLUDED.credits, read_me = EXCLUDED.read_me, persona = EXCLUDED.persona, updated_at = now()',
    [next.user_id, next.credits, JSON.stringify(next.read_me), JSON.stringify(next.persona)]
  );
  return next;
}

async function listVault(userId) {
  await ready();
  const want = String(userId || '');
  if (memoryMode()) {
    return vaultRows
      .filter((row) => String(row.user_id) === want)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, VAULT_LIMIT)
      .map(publicVault);
  }
  const rows = await db.query(
    'SELECT id, kind, title, body, mime, audio, created_at FROM idea_vault WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
    [want, VAULT_LIMIT]
  );
  return rows.map(publicVault);
}

function sanitizeVault(input) {
  const source = input && typeof input === 'object' ? input : {};
  const kind = clip(source.kind, 16);
  if (!KINDS[kind]) throw validationError('Save a title, a line, a voice memo, or a song draft.');
  const title = clip(source.title, TITLE_MAX);
  const bodyMax = kind === 'song' ? SONG_MAX : LINE_MAX;
  const body = kind === 'memo'
    ? clip(source.body || source.note, NOTE_MAX)
    : clipBlock(source.body || source.text, bodyMax);
  const mime = clip(source.mime, 40);
  let audio = String(source.audio || '').replace(/\s+/g, '');
  if (audio.indexOf('base64,') !== -1) audio = audio.slice(audio.indexOf('base64,') + 7);
  if (kind === 'title' && title.length < 2) throw validationError('Write a title before you save it.');
  if (kind === 'line' && (body.length < 12 || body.indexOf(' ') === -1)) {
    throw validationError('Write a full line before you save it.');
  }
  if (kind === 'song' && title.length < 2) throw validationError('Name the draft before you save it.');
  if (kind === 'song' && (body.length < 12 || body.indexOf(' ') === -1)) {
    throw validationError('Paste the song before you save it.');
  }
  if (kind === 'memo' && !audio && body.length < 2) throw validationError('Add a voice memo or a short note.');
  if (audio && !/^audio\/(webm|mpeg|mp4|wav|ogg|x-m4a)$/.test(mime)) {
    throw validationError('That audio type is not supported.');
  }
  if (audio && audio.length > AUDIO_MAX) throw validationError('That voice memo is too long to save here.');
  if (audio && !/^[A-Za-z0-9+/=]+$/.test(audio)) throw validationError('That voice memo did not come through.');
  return { kind, title: kind === 'line' ? '' : title, body, mime: audio ? mime : '', audio: audio || '' };
}

async function saveVault(userId, input) {
  const item = sanitizeVault(input);
  const guard = require('./song-guard');
  const filtered = guard.contentFilter([item.title, item.body].join('\n'));
  if (!filtered.ok) throw validationError(filtered.error);
  await ready();
  const existing = await listVault(userId);
  if (existing.length >= VAULT_LIMIT) throw validationError('Idea Vault is full. Delete a saved item first.');
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  if (memoryMode()) {
    vaultRows.push({
      id,
      user_id: String(userId),
      kind: item.kind,
      title: item.title,
      body: item.body,
      mime: item.mime,
      audio: item.audio,
      created_at: now,
    });
  } else {
    await db.query(
      'INSERT INTO idea_vault (id, user_id, kind, title, body, mime, audio) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [id, String(userId), item.kind, item.title, item.body, item.mime, item.audio]
    );
  }
  return { ok: true, item: publicVault(Object.assign({ id, created_at: now }, item)), items: await listVault(userId) };
}

async function deleteVault(userId, id) {
  const want = clip(id, 80);
  if (!want) throw validationError('That saved item is missing.');
  await ready();
  if (memoryMode()) {
    vaultRows = vaultRows.filter((row) => !(String(row.user_id) === String(userId) && String(row.id) === want));
  } else {
    await db.query('DELETE FROM idea_vault WHERE user_id = $1 AND id = $2', [String(userId), want]);
  }
  return { ok: true, items: await listVault(userId) };
}

function lineCorpus(items) {
  return (items || []).filter((row) => row.kind === 'line' || (row.kind === 'memo' && row.body)).map((row) => row.body).filter(Boolean);
}

async function spend(userId, nextPatch) {
  const state = await readState(userId);
  if (state.credits < CREDIT) {
    const err = validationError('That uses 1 credit. You are out of credits.');
    err.code = 'CREDITS';
    throw err;
  }
  return writeState(userId, Object.assign({ credits: state.credits - CREDIT }, nextPatch));
}

async function readMe(userId) {
  const items = await listVault(userId);
  const lines = lineCorpus(items);
  const themes = themesFromLines(lines);
  if (themes.length < 3) {
    return {
      ok: false,
      status: 400,
      error: 'Save at least three lines that share your words. Read Me only quotes lines you saved.',
    };
  }
  const genres = genreSuggestions(lines);
  const read = {
    themes,
    genres,
    genreNote: genres.length
      ? (genres.length === 1 ? 'One genre matched your lines.' : '')
      : 'Not enough of your lines match a genre list, so no genre is suggested.',
  };
  const state = await spend(userId, { read_me: read, persona: null });
  return { ok: true, credit: CREDIT, credits: state.credits, read_me: read, persona: null };
}

async function personaLock(userId) {
  const state = await readState(userId);
  const persona = personaFromReadMe(state.read_me);
  if (!persona) {
    return { ok: false, status: 400, error: 'Run Read Me first. Persona Lock is built only from that screen.' };
  }
  const next = await spend(userId, { persona });
  return { ok: true, credit: CREDIT, credits: next.credits, persona };
}

async function voiceCheck(userId, input) {
  const state = await readState(userId);
  if (!state.persona) return { ok: true, checks: [] };
  const sections = Array.isArray(input && input.sections) ? input.sections : [];
  const checks = sections.slice(0, 12).map((row) => {
    const verdict = offVoice(row && row.text, state.persona);
    return {
      id: clip(row && row.id, 40),
      label: clip(row && row.label, 40),
      off: verdict.off,
      reason: verdict.reason,
    };
  });
  return { ok: true, checks, credits: state.credits };
}

async function voiceRewrite(userId, input) {
  const state = await readState(userId);
  if (!state.persona) return { ok: false, status: 400, error: 'Lock a voice before an on-voice rewrite.' };
  const kind = clip(input && (input.kind || input.section), 24).toLowerCase();
  const written = rewriteOnVoice(input && input.text, state.persona, kind);
  if (!written.ok) return { ok: false, status: 400, error: written.error };
  if (kind === 'hook' && !hookOk(written.text)) {
    return { ok: false, status: 400, error: 'That hook did not meet the hook rules, so it was not rewritten.' };
  }
  const next = await spend(userId, {});
  return { ok: true, credit: CREDIT, credits: next.credits, text: written.text };
}

function coachParts(parts, genre) {
  return parts.map((part) => Object.assign({}, part, partNote(part, genre)));
}

async function songBreakdown(userId, input) {
  const raw = String(input && (input.text || input.song) || '').replace(/\r\n/g, '\n').trim();
  if (raw.length > SONG_MAX) {
    return { ok: false, status: 400, error: 'That song is too long for this pass. Shorten it and try again.' };
  }
  if (raw.length < 12 || raw.indexOf(' ') === -1) {
    return { ok: false, status: 400, error: 'Paste the song first.' };
  }
  const guard = require('./song-guard');
  const filtered = guard.contentFilter(raw);
  if (!filtered.ok) throw validationError(filtered.error);
  const parts = splitSong(raw);
  if (!parts.length) return { ok: false, status: 400, error: 'Paste the song first.' };
  const state = await readState(userId);
  const voice = state.persona || inferVoice(parts);
  const genre = voice.genre || '';
  const next = await spend(userId, {});
  return {
    ok: true,
    credit: CREDIT,
    credits: next.credits,
    parts: coachParts(parts, genre),
    voice: publicVoice(voice),
    voice_source: state.persona ? 'persona' : 'lyrics',
  };
}

function cleanRewriteParts(input) {
  const rows = Array.isArray(input && input.parts) ? input.parts : [];
  return rows.slice(0, 12).map((row) => {
    const label = clip(row && row.label, 40) || 'Verse 1';
    const kind = clip(row && row.kind, 16).toLowerCase() || 'verse';
    const text = clipBlock(row && row.text, 2000);
    return {
      id: clip(row && row.id, 40) || kind,
      kind: kind,
      label: label,
      text: text,
    };
  }).filter((row) => row.text);
}

async function songRewrite(userId, input) {
  const parts = cleanRewriteParts(input);
  if (!parts.length) return { ok: false, status: 400, error: 'Break the song down before a full rewrite.' };
  const blob = parts.map((part) => part.text).join('\n');
  const guard = require('./song-guard');
  const filtered = guard.contentFilter(blob);
  if (!filtered.ok) throw validationError(filtered.error);
  const state = await readState(userId);
  const voice = state.persona || inferVoice(parts);
  const suggested = parts.map((part) => {
    const better = improvePart(part.text, part.kind, voice);
    return {
      id: part.id,
      label: part.label,
      kind: part.kind,
      original: part.text,
      suggested: better.text,
      changed: better.changed,
    };
  });
  const next = await spend(userId, {});
  return {
    ok: true,
    credit: CREDIT,
    credits: next.credits,
    parts: suggested,
    voice_source: state.persona ? 'persona' : 'lyrics',
  };
}

async function status(userId) {
  const state = await readState(userId);
  const items = await listVault(userId);
  return {
    ok: true,
    signedIn: true,
    credits: state.credits,
    allowance: ALLOWANCE,
    read_me: state.read_me,
    persona: state.persona,
    items,
  };
}

const browser = {
  ALLOWANCE,
  CREDIT,
  genreSuggestions,
  hookOk,
  improvePart,
  inferVoice,
  madeCaption,
  offVoice,
  partNote,
  personaFromReadMe,
  rewriteOnVoice,
  splitSong,
  themesFromLines,
};

const api = {
  ALLOWANCE,
  CREDIT,
  browser,
  deleteVault,
  genreSuggestions,
  hookOk,
  improvePart,
  inferVoice,
  listVault,
  madeCaption,
  offVoice,
  partNote,
  personaFromReadMe,
  personaLock,
  readMe,
  resetStore,
  rewriteOnVoice,
  saveVault,
  songBreakdown,
  songRewrite,
  splitSong,
  status,
  themesFromLines,
  voiceCheck,
  voiceRewrite,
};

if (typeof globalThis !== 'undefined') globalThis.PlaigroundArtistDev = browser;

if (isNode) module.exports = api;
