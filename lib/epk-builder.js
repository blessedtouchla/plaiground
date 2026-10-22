'use strict';
// EPK builder tester. Writes bios ONLY from the artist's own answers. No scraping, no invented facts.

const FIELDS = ['mode', 'name', 'era', 'gender', 'hair', 'look', 'cyborg', 'planet', 'voice', 'genre', 'vibe', 'hobbies', 'fears', 'dreams', 'hometown', 'item', 'superpower', 'stats', 'links', 'tracks', 'extra'];
const CLAIM_RE = /(#\s?1\b|number one|no\.? ?1\b|million(s)? (of )?(streams|plays|views|fans|followers)|billion|platinum|gold record|grammy|chart[- ]topping|top of the charts|viral hit|award[- ]winning|sold[- ]out)/i;

function clip(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max || 300);
}
function clean(text) {
  return String(text || '').replace(/[\u2014\u2013]/g, ', ').replace(/\s+,/g, ',').trim();
}
function normalize(body) {
  const src = body && typeof body === 'object' ? body : {};
  const out = {};
  FIELDS.forEach(function (k) {
    let v = src[k];
    if (Array.isArray(v)) v = v.map(function (x) { return clip(x, 120); }).filter(Boolean).join(', ');
    else if (v && typeof v === 'object') v = Object.keys(v).map(function (s) { return s + ' ' + clip(v[s], 4); }).join(', ');
    out[k] = clip(v, k === 'extra' || k === 'links' || k === 'tracks' ? 800 : 200);
  });
  out.name = out.name || 'This artist';
  return out;
}
function factsFrom(a) {
  const facts = [];
  function add(label, v) { if (v) facts.push(label + ': ' + v); }
  add('Artist name', a.name); add('Build mode', a.mode); add('Era', a.era); add('Pronoun', a.gender);
  add('Hair', a.hair); add('Look', a.look); add('Cyborg percent', a.cyborg); add('Home planet', a.planet);
  add('Voice texture', a.voice); add('Genre', a.genre); add('Vibe', a.vibe); add('Hobbies', a.hobbies);
  add('Fear (the villain)', a.fears); add('Dream (the quest)', a.dreams); add('Hometown', a.hometown);
  add('Signature item', a.item); add('Superpower', a.superpower); add('Stats', a.stats); add('Extra notes', a.extra);
  return facts;
}
function hasClaim(text) { return CLAIM_RE.test(String(text || '')); }

function sample(a) {
  const n = a.name;
  const genre = a.genre || 'genre-bending';
  return {
    oneLiner: n + ' is a ' + (a.vibe ? a.vibe + ' ' : '') + genre + ' act with a ' + (a.voice || 'one-of-a-kind') + ' voice.',
    shortBio: n + ' makes ' + genre + ' music. ' + (a.hometown ? 'Home base is ' + a.hometown + '. ' : '') + (a.dreams ? 'The quest: ' + a.dreams + '.' : ''),
    longBio: n + ' brings a ' + (a.voice || 'distinct') + ' voice to ' + genre + '. ' + (a.hobbies ? 'Off the mic: ' + a.hobbies + '. ' : '') + (a.fears ? 'The villain in this story is ' + a.fears + '. ' : '') + (a.superpower ? 'Superpower: ' + a.superpower + '. ' : '') + (a.item ? 'Never seen without ' + a.item + '.' : ''),
    forFansOf: 'For fans of ' + genre + (a.vibe ? ' with a ' + a.vibe + ' feel' : '') + '.',
    panels: [
      'Panel 1: ' + (a.hometown ? 'Back in ' + a.hometown + ', ' : 'At the start, ') + n + ' finds the first spark.',
      'Panel 2: The villain shows up: ' + (a.fears || 'doubt') + '.',
      'Panel 3: ' + n + ' powers up with ' + (a.superpower || a.item || 'the music') + '.',
      'Panel 4: The quest continues: ' + (a.dreams || 'the next stage') + '.',
    ],
    captions: [
      'Meet ' + n + '. ' + genre + ' with a ' + (a.voice || 'new') + ' voice. Press start.',
      'Villain: ' + (a.fears || 'doubt') + '. Quest: ' + (a.dreams || 'the stage') + '. Level up with ' + n + '.',
      'New EPK just dropped. Come plai.',
    ],
    socialBio: n + ' | ' + genre + (a.hometown ? ' | ' + a.hometown : '') + ' | come plai',
  };
}

const SYSTEM = [
  'You write electronic press kit copy for a music artist on PLAIGROUND.',
  'Use ONLY the facts given. Never invent stats, streams, charts, awards, labels, collaborators, press, or tour dates.',
  'Never claim #1, millions, viral, platinum, sold out, or award winning.',
  'Do not name real artists unless the artist gave them. The "for fans of" line uses genres and moods only unless the artist named someone.',
  'Short, punchy sentences. No em dashes or en dashes. Spell the word play as plai when it refers to PLAIGROUND.',
  'If build mode is Full AI, describe the artist as an AI artist persona honestly.',
  'Return JSON only: {"oneLiner":"","shortBio":"","longBio":"","forFansOf":"","panels":["","","",""],"captions":["","",""],"socialBio":""}.',
  'shortBio is 2 to 3 sentences. longBio is 2 short paragraphs. panels are 4 comic panels of an origin story. captions are 3 social posts. socialBio is under 150 characters.',
].join(' ');

function parse(content) {
  const text = String(content || '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch (e) { return null; }
}
function shape(raw, fb) {
  const r = raw && typeof raw === 'object' ? raw : {};
  function s(k) { const v = clean(r[k]); return v && !hasClaim(v) ? v : fb[k]; }
  function arr(k, n) {
    const v = Array.isArray(r[k]) ? r[k].map(clean).filter(function (x) { return x && !hasClaim(x); }) : [];
    return v.length >= n ? v.slice(0, n) : fb[k];
  }
  return { oneLiner: s('oneLiner'), shortBio: s('shortBio'), longBio: s('longBio'), forFansOf: s('forFansOf'), panels: arr('panels', 4), captions: arr('captions', 3), socialBio: s('socialBio') };
}

async function write(body, chat) {
  const a = normalize(body);
  const facts = factsFrom(a);
  const fb = sample(a);
  if (!chat) {
    return { ok: true, source: 'sample', notice: 'Sample copy built from your answers. The AI writer is offline here.', facts: facts, epk: fb };
  }
  const reply = await chat({ temperature: 0.8, max_tokens: 1200, timeoutMs: 20000, messages: [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: 'Facts from the artist:\n' + facts.join('\n') },
  ] });
  const parsed = parse(reply && reply.content);
  if (!parsed) {
    return { ok: true, source: 'sample', refund: true, notice: 'The AI draft came back blank, so you got sample copy and your credits come back automatically.', facts: facts, epk: fb };
  }
  return { ok: true, source: 'ai', notice: '', facts: facts, epk: shape(parsed, fb) };
}

module.exports = { write: write, normalize: normalize, factsFrom: factsFrom, hasClaim: hasClaim, sample: sample, CLAIM_RE: CLAIM_RE };
