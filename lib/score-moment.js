/*
 * Score the Moment (Song Lab). Shared by the page (window.ScoreMoment) and the server.
 * A coached interview that pulls the real feeling out before any lyrics get written,
 * shaped around four film-song tests (fits the moment, the hook sticks, original, lifts the work)
 * plus emotional impact.
 * Listening Layer: reflect back, notice repeats, light check-ins, running notes (message, scene, arc).
 * The notes update inside the same reply call. No drift question, no end review screen.
 * Rules: no em dashes, never name the music engine or distributor in copy.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ScoreMoment = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var OPEN_LINE = "Nothing's too dumb to say here. Ramble if you want; the messy version is usually where the song is.";
  var UNDER_BOX = 'Talk like you are telling a friend. Run-on sentences welcome.';
  var MAX_FOLLOWUPS = 3;
  var PARK_LINE = 'We can come back to this. Keep going.';

  // The seven screens, in order. Each one carries its own ladder: angles and guess seeds.
  var QUESTIONS = [
    { key: 'moment', q: "What's happening right when this song plays?", chips: ['Falling in love', 'Losing someone', 'The comeback', 'Leaving home', 'The party', 'The fight', 'A quiet morning'],
      ph: 'Where are you, what just happened, who is there',
      angles: { sense: 'Where were you standing when you knew? What could you hear?', body: 'What was your body doing right then? Sitting, driving, frozen?', feel: 'What was the feeling right under the obvious one?' },
      guesses: ['The car outside their place, engine still running', 'The last text you never answered', 'The kitchen at 3 AM with the lights off'] },
    { key: 'who', q: 'Who is this song talking to?', chips: ['Me', 'A lover', 'An ex', 'A friend', 'A parent', 'The haters', 'The world'],
      ph: 'A name, a nickname, or just who they are to you',
      angles: { sense: 'Picture them hearing this. Where are they?', body: 'If they heard this song, what would you want their face to do?', feel: 'What do you need them to finally understand?' },
      guesses: ['Someone who left before I could say it', 'The version of me from five years ago', 'Everybody who said I would not make it'] },
    { key: 'truth', q: "What are you really saying that you'd never say out loud?", required: true,
      ph: 'The thing under the thing. Say it messy.',
      angles: { sense: 'When you think about it, what is the image that shows up first?', body: "What's the part you'd only say at 2 AM?", feel: 'If you were brave for ten seconds, what would you admit?' },
      guesses: ['I still wanted you to stay', 'I was proud of myself and scared to say it', 'I am not over it, I just got quiet'] },
    { key: 'detail', q: 'Name one thing you can see, hold, or remember from it.',
      ph: 'A car, a smell, a street, an object, a song on the radio',
      angles: { sense: 'One object, one smell, one sound. Pick any.', body: 'What were your hands holding?', feel: 'Did it feel like weather? Rain that would not start, heat that would not break?' },
      guesses: ['The porch light left on', 'Their hoodie that still smells like them', 'The cracked phone screen'] },
    { key: 'arc', q: 'How do you feel at the start of the song, and how do you feel at the end?',
      ph: 'Start: ... End: ...',
      angles: { sense: 'What did the room look like at the start versus the end?', body: 'What did your hands do at the start versus the end?', feel: 'What would have to happen for the end to feel earned?' },
      guesses: ['Start: waiting by the phone. End: finally letting go', 'Start: small and quiet. End: loud and sure', 'Start: angry. End: grateful it happened'] },
    { key: 'line', q: 'Say the whole thing in five words or fewer.', required: true,
      ph: 'This becomes the hook',
      angles: { sense: 'What words would you write on the wall?', body: 'What would you shout in the car with the windows down?', feel: 'If the song had a text message, what would it say?' },
      guesses: [] },
    { key: 'sound', q: 'Pick the closest sound, and tell me what it should NOT sound like.', chipsOnly: true,
      chips: ['Oldies soul', '70s funk', '90s R&B', 'Boom bap', 'Trap', 'Pop ballad', 'Indie rock', 'Gospel', 'Afrobeats', 'Lo-fi'] },
  ];
  var SHORT = ['moment', 'truth', 'line'];
  var ANGLE_ORDER = ['sense', 'body', 'feel'];

  var GENERIC_RE = /^(sad|happy|love|idk|i don'?t know|nothing|dunno|stuff|things|whatever|life|pain|hurt|him|her|them|you|me|a breakup|breakup|my ex|ok|okay|yes|no|maybe|good|bad|fine)[.!?]*$/i;
  function words(t) { return String(t || '').trim().split(/\s+/).filter(Boolean); }
  function isThin(text, q) {
    var t = String(text || '').trim();
    if (q && q.key === 'line') return !t; // five words or fewer is the point
    if (q && q.chipsOnly) return false;
    if (!t) return true;
    if (GENERIC_RE.test(t)) return true;
    return words(t).length < 8;
  }
  // Ladder step for a screen: 0 warm nudge, 1 angle, 2 guesses, 3 park it.
  function ladderStep(follow) { return Math.max(0, Math.min(MAX_FOLLOWUPS, Number(follow) || 0)); }
  function nextAngle(used) {
    var u = used || [];
    for (var i = 0; i < ANGLE_ORDER.length; i++) if (u.indexOf(ANGLE_ORDER[i]) === -1) return ANGLE_ORDER[i];
    return ANGLE_ORDER[u.length % ANGLE_ORDER.length];
  }
  var NUDGES = ["That's a start. Stay there a second. What else is in that moment?", "Good. Don't clean it up. Keep talking.", "I'm with you. Say a little more, even if it feels silly."];
  function nudge(n) { return NUDGES[(Number(n) || 0) % NUDGES.length]; }

  // Tears are material. Crisis words show the support line.
  var TEARS_RE = /\b(cry|cried|crying|tears|sobb\w*|broke down|heartbroken|grief|griev\w*|funeral|passed away|died|miss (him|her|them|you) so)\b/i;
  var CRISIS_RE = /\b(suicid\w*|kill myself|end it all|want(ed|ing)? to die|self[- ]?harm|cutting myself|no reason to live|overdos\w*|(didn'?t|don'?t) want to (be here|live))\b/i;
  var CRISIS = { text: "You matter. If you're hurting, call or text 988 (US) or visit 988lifeline.org", href: 'https://988lifeline.org' };
  var TEARS_LINE = "That's exactly the stuff. Want to stay here a minute? You can skip anytime.";
  function tears(t) { return TEARS_RE.test(String(t || '')); }
  function crisis(t) { return CRISIS_RE.test(String(t || '')); }

  // Catch a line: a short, concrete or striking phrase inside a ramble.
  var CONCRETE_RE = /\b(porch|light|car|door|phone|text|kitchen|street|rain|window|bed|hoodie|shirt|ring|keys|radio|mirror|couch|table|hands?|eyes|voice|smell|coffee|cigarette|bus|train|ocean|sun|moon|night|morning|floor|stairs|room|house|home)\b/i;
  function catchLine(text) {
    var parts = String(text || '').split(/[.!?\n;,]+/).map(function (x) { return x.trim(); }).filter(Boolean);
    var best = '';
    parts.forEach(function (p) {
      var n = words(p).length;
      if (n < 4 || n > 12) return;
      var score = (CONCRETE_RE.test(p) ? 2 : 0) + (/\b(never|still|always|last|only|first)\b/i.test(p) ? 1 : 0) + (/\b(i|you|we)\b/i.test(p) ? 1 : 0);
      if (score >= 3 && (!best || score > best.s)) best = { t: p, s: score };
    });
    return best ? best.t.replace(/^\w/, function (c) { return c.toUpperCase(); }) : '';
  }

  // Notice repeats across answers: a word that keeps coming back.
  var STOP = { that: 1, this: 1, with: 1, from: 1, they: 1, them: 1, have: 1, just: 1, like: 1, what: 1, when: 1, were: 1, there: 1, then: 1, about: 1, would: 1, could: 1, really: 1, still: 1, never: 1, because: 1, know: 1, want: 1, feel: 1, felt: 1, been: 1, your: 1, said: 1, into: 1, some: 1, very: 1, much: 1, every: 1, thing: 1, things: 1, didn: 1, dont: 1, cant: 1, start: 1, song: 1, time: 1 };
  function repeats(answers, already) {
    var seen = {}, out = [];
    var done = already || [];
    Object.keys(answers || {}).forEach(function (k) {
      if (k === 'sound' || k === 'avoid') return;
      var uniq = {};
      String(answers[k] || '').toLowerCase().replace(/[^a-z\s']/g, ' ').split(/\s+/).forEach(function (w) {
        w = w.replace(/'s$/, '');
        if (w.length < 4 || STOP[w] || uniq[w]) return;
        uniq[w] = 1; seen[w] = (seen[w] || 0) + 1;
      });
    });
    Object.keys(seen).forEach(function (w) { if (seen[w] >= 2 && done.indexOf(w) === -1) out.push(w); });
    return out;
  }
  function repeatLine(word) { return "You've mentioned the " + word + ' twice now. That feels important.'; }

  // Running notes: message, scene, arc. Built from answers with no model call; the reply call can refine them.
  function splitArc(t) {
    var s = String(t || '');
    var m = s.match(/start\s*:?\s*([^.\n]+?)[.\n,;]?\s*end\s*:?\s*([^.\n]+)/i);
    if (m) return { start: m[1].trim(), end: m[2].trim() };
    var parts = s.split(/\b(?:to|then|now|but now|and now|->)\b/i);
    if (parts.length >= 2) return { start: parts[0].trim(), end: parts.slice(1).join(' ').trim() };
    return { start: s.trim(), end: '' };
  }
  function clip(t, n) { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n).replace(/\s\S*$/, '') : t; }
  function updateNotes(notes, answers, bank) {
    var a = answers || {}, n = Object.assign({ message: '', scene: '', start: '', end: '' }, notes || {});
    if (a.truth) n.message = clip(a.truth, 140);
    else if ((bank || []).length) n.message = clip(bank[0], 140);
    var scene = [a.moment, a.detail].filter(Boolean).join('; ');
    if (scene) n.scene = clip(scene, 160);
    if (a.arc) { var arc = splitArc(a.arc); n.start = clip(arc.start, 60); n.end = clip(arc.end, 60); }
    return n;
  }
  function mergeNotes(local, fromModel) {
    var out = Object.assign({}, local);
    var m = fromModel || {};
    ['message', 'scene', 'start', 'end'].forEach(function (k) { var v = clip(m[k], 160); if (v) out[k] = v; });
    return out;
  }
  function understanding(n) {
    var bits = [];
    if (n.message) bits.push('This is about ' + n.message.replace(/[.!?]+$/, ''));
    if (n.scene) bits.push((bits.length ? 'in ' : 'It lives in ') + n.scene.replace(/[.!?]+$/, ''));
    var head = bits.join(', ');
    var arc = n.start ? 'going from ' + n.start + (n.end ? ' to ' + n.end : '') : '';
    return 'Okay, I\'ve got you. ' + [head, arc].filter(Boolean).join(', ') + '. Let\'s write it.';
  }
  function lockThesis(n, line) {
    return {
      message: n.message || '', scene: n.scene || '', start: n.start || '', end: n.end || '',
      hook: clip(line || '', 60),
      thesis: 'This song is about ' + (n.message || 'the moment') + (n.scene ? ', set in ' + n.scene : '') + (n.start ? ', moving from ' + n.start + (n.end ? ' to ' + n.end : '') : '') + '.',
    };
  }

  // Point of view from "who it's for".
  function povRule(who) {
    var w = String(who || '').toLowerCase();
    if (!w) return '';
    if (/^me\b|myself/.test(w)) return 'Point of view: the singer talks to themselves. Use "I" and an inner voice; second person only as self talk.';
    if (/world|everybody|everyone|haters/.test(w)) return 'Point of view: sung out to a crowd. "You" means them all; keep it public, chantable.';
    return 'Point of view: sung straight to one person (' + clip(who, 40) + '). Use "you" for them, never address a crowd.';
  }

  // Lyric template block. Appended to the normal song prompt on the server.
  function lyricBlock(lock, bank, answers, kind) {
    if (!lock || !lock.thesis) return '';
    var a = answers || {};
    var out = [
      'Score the Moment (the writer was interviewed first; their words come first):',
      'Locked thesis: ' + lock.thesis + ' Every line must serve this thesis. Cut any line that does not.',
      a.detail ? 'Real detail, required in verse 1, word for word if you can: ' + clip(a.detail, 120) + '. Every verse carries at least one concrete image the listener can see, touch, smell, or hear.' : 'Every verse carries at least one concrete image the listener can see, touch, smell, or hear.',
      lock.start ? 'Arc: verse 1 lives in "' + lock.start + '". The bridge is the turn' + (lock.message ? ' and carries the 2 AM truth: ' + clip(lock.message, 120) : '') + '. The final chorus lands in "' + (lock.end || 'something new') + '", with a few chorus words changed to show they moved.' : '',
      lock.hook ? 'Hook: "' + lock.hook + '". Sing it 3 to 4 times, the first time within the first 20 seconds, singable in one breath.' : '',
      povRule(a.who),
      (bank || []).length ? 'Line Bank, the writer\'s own caught lines. Use them before inventing anything, keep their wording:\n- ' + bank.slice(0, 8).join('\n- ') : '',
      'Use body and sense details from the interview. Comparisons come from nature (weather, water, light, seasons) instead of stock phrases.',
      'Never use these cliches: ' + CLICHES.slice(0, 24).join(', ') + '.',
      a.avoid ? 'It must not sound like or borrow from: ' + clip(a.avoid, 80) + '.' : '',
    ];
    if (kind === 'battle') out = [out[0], out[1], 'Punchlines come from the writer\'s real experience above, not generic brags.', out[2], out[6], out[8]];
    return out.filter(Boolean).join('\n');
  }

  // Style prompt template bits.
  var STANDING_EXCLUDE = ['country', 'twang', 'banjo', 'pedal steel', 'Americana', 'whimsical', 'novelty', 'cartoon'];
  var MOMENT_DYNAMICS = {
    'Falling in love': 'warm intimate verses, chorus blooms open',
    'Losing someone': 'sparse opening, builds slowly, stripped final line',
    'The comeback': 'drops in hard, punchy, chorus lifts higher each time',
    'Leaving home': 'steady travelling pulse, bittersweet lift on the chorus',
    'The party': 'high energy from bar one, crowd-shout hook',
    'The fight': 'tense verses, chorus explodes, sudden stop',
    'A quiet morning': 'soft, close vocal, lots of air, gentle swell',
  };
  function styleBits(lock, answers) {
    var a = answers || {};
    var notes = [];
    var moment = QUESTIONS[0].chips.filter(function (c) { return String(a.moment || '').toLowerCase().indexOf(c.toLowerCase()) === 0; })[0];
    notes.push(MOMENT_DYNAMICS[moment] || 'quiet verses, chorus lifts, stripped final line');
    if (lock && lock.start && lock.end) notes.push('dynamics move from ' + clip(lock.start, 30) + ' to ' + clip(lock.end, 30));
    notes.push('melody serves the lyric, leave space around the hook line');
    var sound = (Array.isArray(a.sound) ? a.sound : String(a.sound || '').split(',')).map(function (x) { return String(x).trim(); }).filter(Boolean).slice(0, 2);
    var exclude = STANDING_EXCLUDE.slice();
    String(a.avoid || '').split(/,|\band\b|\//).map(function (x) { return clip(x.replace(/[^\w\s'&-]/g, ''), 30).toLowerCase(); }).filter(Boolean).slice(0, 4)
      .forEach(function (x) { if (exclude.indexOf(x) === -1) exclude.push(x); });
    return { notes: notes, sound: sound, exclude: exclude };
  }
  function applyStyle(style, lock, answers, nameStrip) {
    var b = styleBits(lock, answers);
    var head = b.sound.length ? b.sound.join(' meets ').toLowerCase() + ', ' : '';
    var out = (head + String(style || '') + ', ' + b.notes.join(', ')).replace(/\u2014|\u2013/g, ', ').replace(/\bsuno\b/ig, '').replace(/(,\s*){2,}/g, ', ').trim();
    if (typeof nameStrip === 'function') out = nameStrip(out);
    if (out.length > 600) out = out.slice(0, 600).replace(/,[^,]*$/, '');
    return { style: out, exclude: b.exclude };
  }

  // Cliche list and the five-part self score.
  var CLICHES = ['heart of gold', 'tears like rain', 'broken heart', 'set me free', 'end of time', 'fire in my soul', 'light up the night', 'dance the night away', 'meant to be', 'stars align', 'shining star', 'against all odds', 'never let you go', 'on top of the world', 'touch the sky', 'rise above', 'chasing dreams', 'hold on tight', 'lost without you', 'you complete me', 'love is blind', 'deep inside', 'cold as ice', 'burning desire', 'only time will tell', 'perfect storm', 'walk away', 'all night long', 'feel alive', 'world on fire'];
  function clicheHits(text) {
    var t = String(text || '').toLowerCase();
    return CLICHES.filter(function (c) { return t.indexOf(c) !== -1; });
  }
  function sections(text) {
    var out = [], cur = null;
    String(text || '').split('\n').forEach(function (line) {
      var m = line.match(/^\[([^\]]+)\]/);
      if (m) { cur = { label: m[1].toLowerCase(), lines: [] }; out.push(cur); return; }
      if (line.trim()) { if (!cur) { cur = { label: 'verse', lines: [] }; out.push(cur); } cur.lines.push(line.trim()); }
    });
    return out;
  }
  function overlap(a, b) {
    var aw = {}; words(String(a).toLowerCase().replace(/[^a-z\s]/g, ' ')).forEach(function (w) { if (w.length > 3 && !STOP[w]) aw[w] = 1; });
    var keys = Object.keys(aw); if (!keys.length) return 0;
    var bt = ' ' + String(b).toLowerCase().replace(/[^a-z\s]/g, ' ') + ' ';
    return keys.filter(function (w) { return bt.indexOf(' ' + w) !== -1; }).length / keys.length;
  }
  function band(x) { return Math.max(1, Math.min(5, Math.round(x))); }
  function selfScore(lyrics, lock, answers) {
    var a = answers || {}, L = lock || {};
    var text = String(lyrics || '');
    var secs = sections(text);
    var lower = text.toLowerCase();
    var hook = String(L.hook || a.line || '').toLowerCase().replace(/[^a-z0-9\s']/g, '').trim();
    var hookCount = hook ? lower.split(hook).length - 1 : 0;
    var first = secs.slice(0, 2).map(function (x) { return x.lines.join(' '); }).join(' ').toLowerCase();
    var fit = 1 + 2 * overlap(L.scene || a.moment || '', text) + 2 * overlap(a.detail || L.scene || '', first);
    var hookS = !hook ? 3 : (hookCount >= 3 ? 5 : hookCount === 2 ? 4 : hookCount === 1 ? 3 : 1);
    var hits = clicheHits(text);
    var orig = 5 - hits.length * 1.5 - (a.avoid && overlap(a.avoid, text) > 0.5 ? 2 : 0);
    var choruses = secs.filter(function (x) { return /chorus|hook/.test(x.label); });
    var changed = choruses.length >= 2 && choruses[0].lines.join('|') !== choruses[choruses.length - 1].lines.join('|');
    var lift = 1 + (secs.some(function (x) { return /bridge/.test(x.label); }) ? 2 : 0) + (changed ? 2 : 0);
    var endText = secs.length ? secs.slice(-2).map(function (x) { return x.lines.join(' '); }).join(' ') : '';
    var impact = 1 + 2 * overlap(L.message || a.truth || '', text) + (L.end ? 2 * Math.min(1, overlap(L.end, endText) * 2) : 1);
    var scores = { fit: band(fit), hook: band(hookS), originality: band(orig), lift: band(lift), impact: band(impact) };
    return { scores: scores, cliches: hits, low: Object.keys(scores).filter(function (k) { return scores[k] < 3; }) };
  }
  var FIX = {
    fit: 'Put the real detail and the scene into verse 1 so the song lives in that exact moment.',
    hook: 'Use the hook line word for word in every chorus, 3 to 4 times total, first within the opening lines.',
    originality: 'Replace every cliche with a concrete image from the interview.',
    lift: 'Add a bridge that turns the story, and change a few words in the final chorus to show the singer moved.',
    impact: 'Make the bridge say the truth plainly and let the last chorus land in the end feeling.',
  };
  function rewriteRule(result) {
    return 'Rewrite the song once. Keep everything that works. Fix only this:\n- ' + result.low.map(function (k) { return FIX[k]; }).join('\n- ') + (result.cliches.length ? '\nCliches to remove: ' + result.cliches.join(', ') + '.' : '') + '\nReturn lyrics only.';
  }
  var PRAISE = { fit: 'it lives right in your moment', hook: 'your hook is strong', originality: 'it sounds like nobody else', lift: 'the song really moves', impact: 'the feeling lands' };
  var DRIFT = { fit: 'the verses wander from the scene', hook: 'the hook could come back more', originality: 'a line or two feels borrowed', lift: 'the ending could turn more', impact: 'verse 2 drifted from the truth' };
  function coachNote(scores) {
    var keys = Object.keys(scores || {});
    if (!keys.length) return '';
    var best = keys.slice().sort(function (x, y) { return scores[y] - scores[x]; })[0];
    var worst = keys.slice().sort(function (x, y) { return scores[x] - scores[y]; })[0];
    var head = PRAISE[best].replace(/^\w/, function (c) { return c.toUpperCase(); });
    if (scores[worst] >= 4) return head + '. Nothing to fix; sing it like you mean it.';
    return head + '; ' + DRIFT[worst] + '.';
  }
  var SCORE_LABELS = { fit: 'Fits the moment', hook: 'Hook sticks', originality: 'Original', lift: 'Lifts it', impact: 'Emotional impact' };

  // The reply call: one per answer. Coached reply plus refreshed running notes, as JSON.
  var TURN_SYSTEM = [
    'You are plai at PLAIGROUND, a warm songwriting coach who listens like a good therapist.',
    'You are interviewing a writer to find the real feeling before any lyrics are written.',
    'Never judge, correct, or lecture. Reflect their own words back, short and warm, then dig one step deeper.',
    'Notice patterns when something comes back. Check in lightly, like "Am I hearing that right, or is it more like...?"',
    'If they say something that could be a lyric, catch it exactly as they said it.',
    'Never ask whether this is the same song or a new one. Follow new directions with curiosity.',
    'Plain short sentences. No em dashes. Do not name any music app, company, artist, or song.',
    'Return only JSON: {"reflect":"one or two sentences in their words","checkin":"one light check-in question or empty","catch":"a lyric-worthy phrase from their answer, word for word, or empty","guesses":["up to 3 short example answers built from what they already said, only if asked"],"notes":{"message":"the single core statement so far","scene":"place, moment, sense details so far","start":"start feeling","end":"end feeling"},"final":"only when final is true: one spoken sentence that says what you understood and ends with Let\'s write it."}',
  ].join('\n');
  function turnUser(p) {
    var q = QUESTIONS.filter(function (x) { return x.key === p.key; })[0] || QUESTIONS[0];
    return [
      'Screen question: ' + q.q,
      'Their answer: ' + clip(p.answer, 1200),
      'Follow-ups on this screen so far: ' + (Number(p.follow) || 0) + ' of ' + MAX_FOLLOWUPS + '.',
      p.angle ? 'If you ask more, come at the same moment from this angle: ' + p.angle + '.' : '',
      p.wantGuesses ? 'They are stuck. Offer 2 or 3 guesses shaped like "did you mean something like this".' : 'Leave guesses empty.',
      'Earlier answers:\n' + Object.keys(p.answers || {}).filter(function (k) { return k !== p.key && p.answers[k]; }).map(function (k) { return k + ': ' + clip(p.answers[k], 200); }).join('\n'),
      'Running notes so far: ' + JSON.stringify(p.notes || {}),
      (p.bank || []).length ? 'Line Bank: ' + p.bank.slice(0, 6).join(' | ') : '',
      p.final ? 'final is true: this was the last screen. Fill "final".' : 'final is false. Leave "final" empty.',
    ].filter(Boolean).join('\n');
  }
  function parseTurn(raw) {
    var t = String(raw || '');
    var m = t.match(/\{[\s\S]*\}/);
    var d = {};
    try { d = m ? JSON.parse(m[0]) : {}; } catch (e) { d = {}; }
    var clean = function (x, n) { return clip(String(x || '').replace(/\u2014|\u2013/g, ', ').replace(/\bsuno\b/ig, '').replace(/\btonegrid\b/ig, ''), n); };
    return {
      reflect: clean(d.reflect, 260), checkin: clean(d.checkin, 160), catch: clean(d.catch, 90),
      guesses: (Array.isArray(d.guesses) ? d.guesses : []).slice(0, 3).map(function (g) { return clean(g, 90); }).filter(Boolean),
      notes: d.notes && typeof d.notes === 'object' ? d.notes : {}, final: clean(d.final, 300),
    };
  }
  // No-model fallback: reflect their words back with a light touch.
  function localTurn(p) {
    var ans = String(p.answer || '').trim();
    var q = QUESTIONS.filter(function (x) { return x.key === p.key; })[0] || QUESTIONS[0];
    var short = clip(ans, 90).replace(/[.!?]+$/, '');
    var reflect = short ? 'So it is "' + short + '". I hear that.' : 'Take your time.';
    var guesses = p.wantGuesses ? localGuesses(q, p.answers) : [];
    var n = updateNotes(p.notes, Object.assign({}, p.answers, ans ? (function () { var o = {}; o[p.key] = ans; return o; })() : {}), p.bank);
    return { reflect: reflect, checkin: short && q.key === 'truth' ? 'Am I hearing that right, or is it more like something else?' : '', catch: catchLine(ans), guesses: guesses, notes: n, final: p.final ? understanding(n) : '' };
  }
  function localGuesses(q, answers) {
    var a = answers || {};
    var g = (q.guesses || []).slice();
    if (q.key === 'truth' && a.who) g.unshift('Is it that you still needed ' + clip(a.who, 30).toLowerCase() + ' to see you?');
    if (q.key === 'detail' && a.moment) g.unshift('Something you could see right in ' + clip(a.moment, 30).toLowerCase());
    return g.slice(0, 3);
  }
  function lineBankPicks(bank) { return (bank || []).filter(function (l) { return words(l).length <= 8; }).slice(0, 3); }

  function screensFor(short) { return short ? QUESTIONS.filter(function (q) { return SHORT.indexOf(q.key) !== -1; }) : QUESTIONS.slice(); }
  var ENTRY = { story: 'Score the Moment', banger: 'Score the Moment', battle: 'Make it hit' };

  return {
    OPEN_LINE: OPEN_LINE, UNDER_BOX: UNDER_BOX, MAX_FOLLOWUPS: MAX_FOLLOWUPS, PARK_LINE: PARK_LINE, QUESTIONS: QUESTIONS, SHORT: SHORT,
    isThin: isThin, ladderStep: ladderStep, nextAngle: nextAngle, nudge: nudge, tears: tears, crisis: crisis, CRISIS: CRISIS, TEARS_LINE: TEARS_LINE,
    catchLine: catchLine, repeats: repeats, repeatLine: repeatLine, updateNotes: updateNotes, mergeNotes: mergeNotes, understanding: understanding,
    lockThesis: lockThesis, povRule: povRule, lyricBlock: lyricBlock, styleBits: styleBits, applyStyle: applyStyle, STANDING_EXCLUDE: STANDING_EXCLUDE,
    CLICHES: CLICHES, clicheHits: clicheHits, selfScore: selfScore, rewriteRule: rewriteRule, coachNote: coachNote, SCORE_LABELS: SCORE_LABELS,
    TURN_SYSTEM: TURN_SYSTEM, turnUser: turnUser, parseTurn: parseTurn, localTurn: localTurn, localGuesses: localGuesses, lineBankPicks: lineBankPicks,
    screensFor: screensFor, ENTRY: ENTRY, splitArc: splitArc,
  };
});
