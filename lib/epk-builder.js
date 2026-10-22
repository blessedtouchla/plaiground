'use strict';
// EPK builder tester. Writes bios ONLY from the artist's own answers. No scraping, no invented facts.

const FIELDS = ['mode', 'name', 'era', 'gender', 'hair', 'look', 'cyborg', 'planet', 'voice', 'genre', 'vibe', 'hobbies', 'fears', 'dreams', 'hometown', 'region', 'ageRange', 'item', 'superpower', 'stats', 'links', 'tracks', 'extra'];
const CLAIM_RE = /(#\s?1\b|number one|no\.? ?1\b|million(s)? (of )?(streams|plays|views|fans|followers)|billion|platinum|gold record|grammy|chart[- ]topping|top of the charts|viral hit|award[- ]winning|sold[- ]out)/i;

function clip(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max || 300);
}
function clean(text) {
  return String(text || '').replace(/[\u2014\u2013]/g, ', ').replace(/\b(hair|look|eyes|skin|voice|vibe|vibes|energy|outfit)\s+(?=[a-z]+\s+(hair|look|eyes|skin|voice|vibe|vibes|energy|outfit|and)\b)/gi, '$1, ').replace(/\s+,/g, ',').trim();
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
  add('Fear (the villain)', a.fears); add('Dream (the quest)', a.dreams); add('Hometown', a.hometown); add('Reps (real city or region)', a.region); add('Age range', a.ageRange);
  add('Signature item', a.item); add('Superpower', a.superpower); add('Stats', a.stats);
  add('Track titles', a.tracks); add('Links and handles', a.links); add('Extra notes from the artist (use as facts, do not copy word for word)', a.extra);
  return facts;
}
function cap(text) {
  const t = String(text || '').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}
// Join chip picks with commas: "neon hair futuristic look" style runs become "neon hair, futuristic look".
function listy(v) { return String(v || '').split(/\s*,\s*/).filter(Boolean).join(', '); }
function hasClaim(text) { return CLAIM_RE.test(String(text || '')); }

function sample(a) {
  const n = a.name;
  const genre = a.genre || 'genre-bending';
  const firstTrack = a.tracks ? a.tracks.split(/\s*,\s*/)[0] : '';
  return {
    oneLiner: n + ' brings ' + (a.voice ? listy(a.voice).toLowerCase() + ' vocals' : 'a one-of-a-kind voice') + ' to ' + genre + (firstTrack ? ', starting with "' + firstTrack + '"' : '') + '.',
    shortBio: n + ' makes ' + genre + ' music. ' + (a.region ? 'Reps ' + a.region + '. ' : (a.hometown ? 'Home base is ' + a.hometown + '. ' : '')) + (a.dreams ? 'The quest: ' + a.dreams + '. ' : '') + (firstTrack ? 'Listen to "' + firstTrack + '". ' : '') + (a.links ? 'Find ' + n + ' at ' + a.links + '.' : ''),
    longBio: n + ' brings a ' + (a.voice ? listy(a.voice).toLowerCase() : 'distinct') + ' voice to ' + genre + '. ' + (a.hobbies ? 'Off the mic: ' + a.hobbies + '. ' : '') + (a.fears ? 'The villain in this story is ' + a.fears + '. ' : '') + (a.superpower ? 'Superpower: ' + a.superpower + '. ' : '') + (a.item ? 'Never seen without ' + a.item + '.' : ''),
    forFansOf: 'For fans of ' + genre + (a.vibe ? ' with a ' + listy(a.vibe) + ' feel' : '') + '.',
    panels: [
      'Panel 1: ' + (a.planet ? 'Born on ' + a.planet + ', ' : 'At the start, ') + n + ' hears the first spark.' + (a.hometown ? ' The signal lands in ' + a.hometown + ', the new home base.' : ''),
      'Panel 2: The villain shows up: ' + (a.fears || 'doubt') + '.',
      'Panel 3: ' + n + ' powers up with ' + (a.superpower || a.item || 'the music') + '.',
      'Panel 4: The quest continues: ' + (a.dreams || 'the next stage') + '.',
    ],
    captions: [
      'Meet ' + n + '. ' + cap(genre) + ' with a ' + (a.voice ? listy(a.voice).toLowerCase() : 'new') + ' voice. Press start.',
      'Villain: ' + (a.fears || 'doubt') + '. Quest: ' + (a.dreams || 'the stage') + '. Level up with ' + n + '.',
      'New EPK just dropped. Come plai.',
    ],
    socialBio: n + ' | ' + genre + (a.region ? ' | ' + a.region : (a.hometown ? ' | ' + a.hometown : '')) + ' | come plai',
  };
}

const SYSTEM = [
  'You write electronic press kit copy for a music artist on PLAIGROUND.',
  'Use ONLY the facts given. Never invent stats, streams, charts, awards, labels, collaborators, press, or tour dates.',
  'Never claim #1, millions, viral, platinum, sold out, or award winning.',
  'Do not name real artists unless the artist gave them. The "for fans of" line uses genres and moods only unless the artist named someone.',
  'Short, punchy sentences. No em dashes or en dashes. Spell the word play as plai when it refers to PLAIGROUND.',
  'If build mode is Full AI, describe the artist as an AI artist persona honestly.',
  'Use the track titles and links/handles as facts: mention at least one track title by name and include the handle or link in socialBio or a caption.',
  'oneLiner must be newly written in your own words. Never copy the artist\'s extra notes word for word.',
  'Home planet (origin) and hometown are different places. The origin story starts on the home planet, then the artist arrives in the hometown. Keep them logical and never merge them.',
  'Start every line with a capital letter. Separate list items with commas (for example "neon hair, futuristic look"). Use correct grammar.',
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
function echoes(v, extra) {
  const x = String(extra || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  const y = String(v || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  return x.length > 12 && (y.indexOf(x) !== -1 || x.indexOf(y) !== -1);
}
function shape(raw, fb, extra) {
  const r = raw && typeof raw === 'object' ? raw : {};
  function s(k) { const v = cap(clean(r[k])); if (k === 'oneLiner' && v && echoes(v, extra)) return fb[k]; return v && !hasClaim(v) ? v : fb[k]; }
  function arr(k, n) {
    const v = Array.isArray(r[k]) ? r[k].map(function (x) { return cap(clean(x)); }).filter(function (x) { return x && !hasClaim(x); }) : [];
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
  return { ok: true, source: 'ai', notice: '', facts: facts, epk: shape(parsed, fb, a.extra) };
}

module.exports = { write: write, shape: shape, cap: cap, normalize: normalize, factsFrom: factsFrom, hasClaim: hasClaim, sample: sample, CLAIM_RE: CLAIM_RE };

const CYBORG = {
  human: '',
  light: 'Light implants: a few small, believable machine details such as a fine metal temple plate or a slim glowing line on the forearm, real materials.',
  half: 'Half cyborg: one arm and parts of the torso are visibly machine, brushed metal and carbon fiber joined to real skin, photographed for real.',
  machine: 'Full machine body with a human-like face, articulated metal and ceramic plates, real reflections, photographed like a fashion campaign.',
};
const REALISM = {
  photoreal: 'Fully human: a real-looking person with no visible machine or alien features.',
  '75': 'About 75 percent human, 25 percent synthetic: subtle, believable cyborg or alien details such as a fine chrome seam along the jaw or iridescent skin on one shoulder, rendered as real materials on a real person. Real photograph, not a painting, not digital art, no brushstrokes, no illustration.',
  '50': 'A 50-50 hybrid: half human, half synthetic, with clearly visible machine or alien parts built from real-looking metal, glass and skin, shot as a real photograph of a real person in costume and prosthetics. Real photograph, not a painting, not digital art, no brushstrokes, no illustration.',
  full: 'A fully synthetic avatar being, a photoreal humanoid made of real-looking materials such as chrome, ceramic and glowing glass, photographed like a real fashion model.',
};
// Full-body 9:16 avatar from the picks. Image AI via the same xAI images API Cover Art uses.
function avatarPrompt(body) {
  const a = normalize(body);
  const scene = clip(body && body.scene, 240);
  const bits = [
    scene ? 'Lifestyle scene: ' + scene + '. Same character, same outfit and hair in every shot.' : '',
    body && body.shot === 'portrait' ? 'Cinematic close-up portrait from the chest up, shallow depth of field, dramatic rim light, editorial magazine look,' : 'Full-body photograph of the person, head to toe, standing, slightly off-center,',
    'vertical 9:16, photorealistic high-end editorial photograph, shot on a full-frame camera with an 85mm lens, cinematic lighting, real skin texture and pores, natural fabric detail, subtle film grain, tight intentional crop, magazine-quality color grade. Real photograph, not a painting, not digital art, no brushstrokes. Never a cartoon, illustration, 3D render or anime.',
    REALISM[clip(body && body.realism, 20)] || REALISM.photoreal,
    CYBORG[clip(body && body.cyborgLevel, 20)] || '',
    body && body.parts ? 'Costume pieces: ' + clip(body.parts, 400) + '.' : '',
    'Original person, not any real celebrity or real public figure, no text, no logos, no watermark.',
    a.gender ? 'Presents as: ' + a.gender + '.' : '',
    a.ageRange ? 'Apparent age: ' + a.ageRange + ' years old, adult.' : '',
    a.region ? 'Rooted in ' + a.region + ': wardrobe, styling and background feel true to that place, no signs or readable text.' : '',
    a.era ? 'Era style: ' + a.era + '.' : '',
    a.hair ? 'Hair: ' + listy(a.hair) + '.' : '',
    a.look ? 'Outfit and costume: ' + listy(a.look) + '.' : '',
    a.item ? 'Holding or wearing signature item: ' + listy(a.item) + '.' : '',
    a.planet ? 'Alien origin details from ' + a.planet + '.' : '',
    a.vibe ? 'Stance and energy: ' + listy(a.vibe) + '.' : '',
    a.genre ? 'Music genre: ' + a.genre + '.' : '',
    a.voice ? 'Mood of the voice: ' + listy(a.voice) + ', expressed through lighting.' : '',
    a.superpower ? 'Superpower glow: ' + a.superpower + '.' : '',
  ];
  return bits.filter(Boolean).join(' ').slice(0, 1800);
}

async function avatar(body, opts) {
  const o = opts || {};
  const prompt = avatarPrompt(body);
  if (!o.key) return { ok: true, source: 'svg', refund: true, notice: 'The AI avatar is offline here, so you got the drawn avatar. Credits come back automatically.', prompt: prompt };
  const photo = body && typeof body.photo === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(body.photo) && body.mode === 'AI assisted' && body.photoOk ? body.photo : '';
  const model = o.model || 'grok-imagine-image-2.0';
  async function call(url, payload) {
    const r = await o.postJson(url, o.key, payload, 55000);
    const d = await r.json().catch(function () { return {}; });
    const item = r.ok && d && d.data && d.data[0];
    return item && item.b64_json ? 'data:image/jpeg;base64,' + item.b64_json : (item && item.url && /^https:\/\//.test(item.url) ? item.url : '');
  }
  let img = '';
  let blended = false;
  if (photo) {
    try {
      img = await call('https://api.x.ai/v1/images/edits', { model: model, prompt: 'Turn the person in this photo into this character, keep their face recognizable: ' + prompt, image: { url: photo, type: 'image_url' }, aspect_ratio: '9:16', response_format: 'b64_json' });
      blended = Boolean(img);
    } catch (e) { img = ''; }
  }
  if (!img) {
    try { img = await call('https://api.x.ai/v1/images/generations', { model: model, prompt: prompt, n: 1, aspect_ratio: '9:16', response_format: 'b64_json' }); } catch (e) { img = ''; }
  }
  if (!img) return { ok: true, source: 'svg', refund: true, notice: 'The avatar came back blank, so you got the drawn avatar. Your credits come back automatically.', prompt: prompt };
  return { ok: true, source: 'ai', blended: blended, notice: photo && !blended ? 'We could not blend your photo this time, so this avatar is built from your picks.' : '', image: img };
}

module.exports.avatar = avatar;
module.exports.avatarPrompt = avatarPrompt;
module.exports.REALISM = REALISM;
