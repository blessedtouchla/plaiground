/*
 * Fan Mail to Song (hidden preview). The reverse of the roast: a song of appreciation.
 * Shared by the browser page (window.FanSong) and the server (require).
 * Rules: user's own words first, sourced public facts only, never copied lyrics,
 * no endorsement wording, no voice impersonation, style prompt never names an artist.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FanSong = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var TYPES = ['Musician', 'Actor', 'Other'];
  var AFFECT = ['Made me laugh', 'Got me through something hard', 'Changed my life', 'Just a big fan', 'Inspired my dream'];
  var HEAVY_AFFECT = { 'Got me through something hard': 2, 'Changed my life': 2, 'Inspired my dream': 1 };
  var LIGHT_AFFECT = { 'Made me laugh': 2, 'Just a big fan': 1 };
  var GENRES = ['Pop', 'Hip hop', 'R&B', 'Rock', 'Country', 'Acoustic', 'Electronic', 'Gospel', 'Latin'];
  var TEMPOS = ['Slow', 'Mid', 'Upbeat'];
  var VOICES = ['Female vocal', 'Male vocal', 'Duet', 'Choir'];
  var CRISIS_LINK = { label: 'If you are going through it right now, free help is here', href: 'https://988lifeline.org' };
  var CRISIS_INTL = 'https://findahelpline.com';
  var FAN_TAG = 'fanSong';
  var STORE_KEY = 'plaiground.fanSongs';

  var HEAVY_RE = /\b(depress\w*|anxiety|panic|grief|griev\w*|lost my|passed away|died|cancer|hospital|rehab|sober|addict\w*|divorce|abuse\w*|bully\w*|lonely|alone|dark(est)? (time|place|days)|hard time|rough (time|year)|saved me|got me through|kept me going|healing|chemo|homeless)\b/i;
  var CRISIS_RE = /\b(suicid\w*|kill myself|end it all|want(ed|ing)? to die|(didn'?t|don'?t) want to (be here|live)|self[- ]?harm|cutting myself|no reason to live|overdos\w*)\b/i;
  var FUNNY_RE = /\b(lol|lmao|haha|funny|laugh\w*|embarrass\w*|cringe|confess|accidentally|tripped|screamed|cried at|obsessed|fangirl\w*|fanboy\w*|poster|tattoo)\b/i;

  // Blocked in user input, facts, and model output.
  var RULES = [
    { id: 'sexual', re: /\b(sex\w*|nude\w*|naked|hook ?up|in bed with|make love|horny|thirst trap|onlyfans|kiss(ing)? (you|your|him|her) all over)\b/i, msg: 'Keep it a fan song. Nothing sexual.' },
    { id: 'minor', re: /\b(underage|minor|child|kid|teen(ager)?|\d{1,2} ?(yo|years? old))\b.*\b(hot|sexy|date|dating|crush)\b|\b(hot|sexy|date|dating|crush)\b.*\b(underage|minor|child|kid|teen(ager)?)\b/i, msg: 'That crosses a line. No romantic or sexual lines about minors.' },
    { id: 'stalk', re: /\b(your (home )?address|where you live|outside your (house|home|hotel)|follow(ed|ing)? you home|track(ed|ing)? you|watch(ing)? you sleep|find you|your (phone|cell) number|show up at your|i know where)\b/i, msg: 'No addresses or showing up where they live. Cheer from the crowd.' },
    { id: 'possess', re: /\b(you('| a)re mine|you belong to me|mine forever|you('| wi)ll be mine|nobody else can have you|marry me or|you owe me)\b/i, msg: 'Keep it fan love, not ownership. Try how they made you feel.' },
    { id: 'endorse', re: /\b(official (song|anthem|tribute|track)|endorsed by|approved by|authorized|sponsored|feat\.?|featuring|ft\.)\b/i, msg: 'No official or endorsement wording. This is a fan tribute.' },
    { id: 'voice', re: /\b(in the voice of|sound(s|ing)? (exactly )?like|sung by|voice of|impersonat\w*|clone\w*|deepfake|their (real )?voice|his (real )?voice|her (real )?voice)\b/i, msg: 'We do not copy anyone\'s voice. Pick a voice style instead.' },
    { id: 'defame', re: /\b(is a (fraud|criminal|liar|cheater|addict)|got arrested for|secretly (gay|married|pregnant|dating)|rumou?r has it|i heard (that )?(he|she|they))\b/i, msg: 'Stick to things that are true and kind. No rumors.' },
  ];

  function clean(s, max) {
    return String(s == null ? '' : s).replace(/\u2014|\u2013/g, ', ').replace(/\s+/g, ' ').trim().slice(0, max || 300);
  }

  function pick(list, value, fallback) {
    var v = clean(value, 60);
    for (var i = 0; i < list.length; i += 1) if (list[i].toLowerCase() === v.toLowerCase()) return list[i];
    return fallback;
  }

  function normalize(input) {
    var b = input || {};
    var affect = [].concat(b.affect || []).map(function (a) { return pick(AFFECT, a, ''); }).filter(Boolean);
    var depth = Number(b.depth);
    return {
      name: clean(b.name, 80),
      type: pick(TYPES, b.type, 'Other'),
      affect: affect.filter(function (a, i) { return affect.indexOf(a) === i; }),
      did: clean(b.did, 400),
      moment: clean(b.moment, 400),
      confession: clean(b.confession, 300),
      tenSeconds: clean(b.tenSeconds, 300),
      letter: String(b.letter == null ? '' : b.letter).replace(/\u2014|\u2013/g, ', ').trim().slice(0, 4000),
      depth: isFinite(depth) ? Math.max(0, Math.min(100, Math.round(depth))) : null,
      genre: pick(GENRES, b.genre, 'Pop'),
      tempo: pick(TEMPOS, b.tempo, 'Mid'),
      voice: pick(VOICES, b.voice, 'Female vocal'),
      facts: [].concat(b.facts || []).slice(0, 8).map(function (f) {
        return { text: clean(f && f.text, 220), source: clean(f && f.source, 300) };
      }).filter(function (f) { return f.text; }),
    };
  }

  function userText(n) { return [n.did, n.moment, n.confession, n.tenSeconds, n.letter || ''].join('\n'); }

  function crisis(n) { return CRISIS_RE.test(userText(n)); }

  // 0 = light and funny, 100 = deep and emotional.
  function inferDepth(n) {
    var score = 40;
    n.affect.forEach(function (a) { score += (HEAVY_AFFECT[a] || 0) * 15; score -= (LIGHT_AFFECT[a] || 0) * 12; });
    var text = userText(n);
    if (HEAVY_RE.test(text)) score += 25;
    if (CRISIS_RE.test(text)) score += 30;
    if (FUNNY_RE.test(text) || n.confession) score -= 10;
    return Math.max(0, Math.min(100, score));
  }

  function depthOf(n) { return n.depth == null ? inferDepth(n) : n.depth; }

  function arc(depth) { return depth >= 60 ? 'heavy' : depth <= 35 ? 'light' : 'mixed'; }

  // One-line read from Plai before writing.
  function plaiRead(n) {
    var d = depthOf(n);
    if (crisis(n)) return 'This sounds like it came from a really hard place. We will keep it gentle and hopeful. Sound right?';
    if (d >= 75) return 'Sounds deep and heartfelt. Sound right?';
    if (d >= 60) return 'Sounds heartfelt with a little humor. Sound right?';
    if (d > 35) return 'Sounds warm and a little playful. Sound right?';
    if (d > 15) return 'Sounds fun and light with a soft spot. Sound right?';
    return 'Sounds playful and funny. Sound right?';
  }

  function check(text) {
    var blob = String(text || '');
    for (var i = 0; i < RULES.length; i += 1) if (RULES[i].re.test(blob)) return { ok: false, rule: RULES[i].id, error: RULES[i].msg };
    return { ok: true };
  }

  function validate(n) {
    if (!n.name) return { ok: false, error: 'Who is the song for? Add their name.' };
    if (!n.did && !n.moment && !n.tenSeconds && !n.letter) return { ok: false, error: 'Tell us at least one thing they did for you.' };
    return check([n.name, userText(n)].concat(n.facts.map(function (f) { return f.text; })).join('\n'));
  }

  // Never names an artist. Built only from picked chips.
  function stylePrompt(n) {
    var d = depthOf(n);
    var mood = arc(d) === 'heavy' ? 'emotional, hopeful lift in the final chorus' : arc(d) === 'light' ? 'playful, funny, bright' : 'warm, heartfelt with a light touch';
    var tempo = { Slow: 'slow tempo, about 72 bpm', Mid: 'mid tempo, about 96 bpm', Upbeat: 'upbeat, about 120 bpm' }[n.tempo];
    return [n.genre.toLowerCase(), tempo, n.voice.toLowerCase(), mood, 'fan tribute, clear lead vocal, singalong chorus'].join(', ');
  }

  function typeFromDescription(desc, more) {
    var lead = String(desc || '').toLowerCase();
    if (/\b(actor|actress)\b/.test(lead) && !/\b(singer|rapper|musician)\b/.test(lead.split(/actor|actress/)[0])) return 'Actor';
    var d = (lead + ' ' + String(more || '')).toLowerCase();
    if (/\b(singer|rapper|musician|songwriter|band|guitarist|drummer|dj|producer|composer|vocalist|pianist)\b/.test(d)) return 'Musician';
    if (/\b(actor|actress|comedian|filmmaker|television personality)\b/.test(d)) return 'Actor';
    return 'Other';
  }

  // Strip anything that looks like quoted lyrics from research text.
  function safeFact(text, type) {
    var t = clean(text, 220);
    if (!t) return '';
    if (/\blyrics?\b|\bsings?,? ["\u201c]/i.test(t)) return '';
    var quotes = t.match(/["\u201c][^"\u201d]+["\u201d]/g) || [];
    for (var i = 0; i < quotes.length; i += 1) {
      var words = quotes[i].replace(/["\u201c\u201d]/g, '').trim().split(/\s+/).length;
      if (type === 'Musician' && words > 6) return ''; // titles ok, lines not
      if (type !== 'Musician' && words > 6) return ''; // catchphrase of a few words max
    }
    return check(t).ok ? t : '';
  }

  function systemPrompt() {
    return [
      'You write original fan tribute song lyrics. Warm, specific, true.',
      'Use the fan\'s own words first. Their phrases must appear nearly as written in the verses and chorus.',
      'Only use the public facts given. Do not invent facts, rumors, or private details.',
      'Song titles may be named. Never quote or paraphrase the celebrity\'s lyrics.',
      'For actors you may use at most one short catchphrase of a few words, only if it is in the facts.',
      'No sexual content, nothing about minors romantically, no addresses or showing up at their home, no possessive lines like "you are mine".',
      'Never say official, endorsed, featuring, or imply they approved this. Never write in their voice; this is from the fan to them.',
      'Do not use em dashes. Use section tags [Verse 1], [Chorus], [Verse 2], [Bridge], [Chorus].',
      'Return lyrics only.',
    ].join('\n');
  }

  function writerPrompt(n) {
    var d = depthOf(n);
    var a = arc(d);
    var shape = a === 'heavy'
      ? 'Emotional arc: Verse 1 starts inside the hard moment. Verse 2 turns at what ' + n.name + ' gave them. The bridge and last chorus lift with hope.'
      : a === 'light'
        ? 'Keep it light and funny the whole way. Lean into the fan confession for laughs. Big singalong chorus.'
        : 'Warm and heartfelt with a few smiles. Let the confession land as a light moment before the chorus.';
    var gentle = crisis(n) ? '\nThe fan mentioned a very hard time. Be gentle. Never describe self harm. Focus on still being here and the comfort they found.' : '';
    return [
      'Write a fan song for ' + n.name + ' (' + n.type.toLowerCase() + ').',
      'Tone: ' + d + ' out of 100 where 0 is silly and 100 is deep. ' + shape + gentle,
      'What they did for the fan: ' + (n.did || '-'),
      'The moment they became a fan: ' + (n.moment || '-'),
      'Funny fan confession: ' + (n.confession || '-'),
      'What the fan would say in 10 seconds (use as the chorus hook): ' + (n.tenSeconds || '-'),
      'How they affected the fan: ' + (n.affect.join(', ') || '-'),
      'Public facts the fan picked (weave 2 to 4 in lightly):',
      n.facts.map(function (f) { return '- ' + f.text; }).join('\n') || '- none',
      n.letter ? 'The fan\'s letter (pull their exact phrases from it):\n' + n.letter.slice(0, 2000) : '',
      'Genre ' + n.genre + ', ' + n.tempo.toLowerCase() + ' tempo.',
    ].join('\n');
  }

  function scrubOutput(text) {
    var t = String(text || '').replace(/\u2014|\u2013/g, ', ').replace(/\bsuno\b/ig, '').replace(/,?\s*\b(lol|lmao|haha)\b/ig, '').trim();
    var lines = t.split('\n').filter(function (line) { return check(line).ok; });
    return lines.join('\n').trim();
  }

  // Short singable form of a fact: "Lover in 2019". Empty if none.
  function shortFact(text) {
    var m = String(text || '').match(/((?:[A-Z0-9][\w'&:!.-]*)(?: (?:[A-Z0-9][\w'&:!.-]*|of|the|and|a|in|to)){0,4}) \(((?:19|20)\d\d)\)/);
    if (!m) return '';
    var title = m[1].replace(/^(The|A|An|In|On|With|And|Her|His|Their) /, function (w) { return /^(The|A|An)$/.test(w.trim()) ? w : ''; }).trim();
    return title ? title + ' in ' + m[2] : '';
  }

  function cap(s) { s = clean(s, 300).replace(/[.!?]+$/, ''); return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

  // Labeled sample used when the server has no model key. Built only from the fan's words and facts.
  function sampleSong(n) {
    var a = arc(depthOf(n));
    var f = n.facts.map(function (x) { return shortFact(x.text); }).filter(Boolean);
    var hook = cap(n.tenSeconds) || ('Thank you, ' + n.name);
    var out;
    if (a === 'heavy') {
      out = [
        '[Verse 1]', cap(n.moment) || 'I was low and the nights were long', 'I did not have the words, I could barely hold on', 'Then your voice came through on a borrowed screen', 'And it felt like somebody saw me',
        '', '[Chorus]', hook, cap(n.did) || 'You got me through', n.name + ', you will never know', 'How far one light can go',
        '', '[Verse 2]', f[0] ? f[0] + ', I learned it by heart' : 'I learned your story by heart', f[1] ? f[1] + ', a brand new start' : 'Every stage a brand new start', 'I am still here, I am still singing', 'Turned the hurt into something ringing',
        '', '[Bridge]', n.confession ? cap(n.confession) + ', I can laugh about it now' : 'I can laugh about it now', 'Look at me, I made it somehow',
        '', '[Chorus]', hook, 'You got me through', n.name + ', from the back of the crowd', 'I am singing it loud',
      ];
    } else {
      out = [
        '[Verse 1]', cap(n.moment) || 'First time I saw you, I lost my mind', cap(n.confession) || 'I told the whole world, every single time', f[0] ? 'Still talking about ' + f[0] : 'Talking nonstop about your best part', 'My friends roll their eyes, I just turn it up',
        '', '[Chorus]', hook, cap(n.did) || 'You made my day', n.name + ', hey hey hey', 'Fan for life, no take backs, okay',
        '', '[Verse 2]', f[1] ? f[1] + ', I was there in spirit' : 'Every new drop, I was first to hear it', 'Practiced my speech in the bathroom mirror', 'Ten seconds, go, it never got clearer',
        '', '[Chorus]', hook, 'You made my day', n.name + ', hey hey hey', 'Fan for life, no take backs, okay',
      ];
    }
    return scrubOutput(out.join('\n'));
  }


  // Path 1: pasted letter -> pre-filled intake the user confirms.
  function sentences(text) {
    return String(text || '').replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).map(function (x) { return x.trim(); }).filter(Boolean);
  }
  function extractFromLetter(letter, name) {
    var list = sentences(String(letter || '').replace(/^\s*(dear|hi|hey|to)\s+[^,\n]{1,40},\s*/i, ''));
    var out = { did: '', moment: '', confession: '', tenSeconds: '', affect: [], depth: null };
    var firstOf = function (re, used) {
      for (var i = 0; i < list.length; i += 1) if (used.indexOf(i) === -1 && re.test(list[i])) { used.push(i); return list[i]; }
      return '';
    };
    var used = [];
    out.moment = firstOf(/\b(first time|the day|when i (first )?(saw|heard|watched)|ever since|that night|back in (19|20)\d\d|i was \d+|years? ago)\b/i, used);
    out.did = firstOf(/\b(you (helped|taught|showed|gave|made|got|saved|pulled|reminded|inspired)|because of you|your (music|songs?|show|movies?|role|words) (helped|got|made|saved|kept))\b/i, used);
    out.confession = firstOf(/\b(confess|embarrass\w*|i (once|still|may have|definitely)|my (mom|friends|roommate|dog)|lol|haha|don'?t judge|cringe|poster|tattoo|screamed|cried)\b/i, used);
    out.tenSeconds = firstOf(/\b(thank you|thanks|i love you|keep going|never stop|you matter|i just want(ed)? to say)\b/i, used);
    if (!out.tenSeconds && list.length) out.tenSeconds = list[list.length - 1];
    var text = String(letter || '');
    if (/\b(laugh\w*|funny|hilarious|lol|haha)\b/i.test(text)) out.affect.push('Made me laugh');
    if (HEAVY_RE.test(text) || CRISIS_RE.test(text)) out.affect.push('Got me through something hard');
    if (/\bchanged my life|life ?changing|different person\b/i.test(text)) out.affect.push('Changed my life');
    if (/\b(dream|i want to be|because of you i (started|became|picked up)|inspired)\b/i.test(text)) out.affect.push('Inspired my dream');
    if (!out.affect.length) out.affect.push('Just a big fan');
    ['did', 'moment', 'confession', 'tenSeconds'].forEach(function (k) { out[k] = clean(out[k], 300); });
    out.depth = inferDepth(normalize(Object.assign({ name: name || 'them', letter: letter }, out)));
    return out;
  }

  // Path 2: guided answers -> a rough letter.
  function assembleLetter(n) {
    var bits = ['Dear ' + (n.name || 'you') + ','];
    if (n.moment) bits.push(cap(n.moment) + '.');
    if (n.did) bits.push(cap(n.did) + '.');
    if (n.confession) bits.push('Confession: ' + n.confession.replace(/[.!?]+$/, '') + '.');
    if (n.tenSeconds) bits.push(cap(n.tenSeconds) + '.');
    return bits.join('\n\n');
  }

  // Polished letter to send with the song. Fan's words, tidied, nothing invented.
  function polishLetter(n) {
    var heavy = arc(depthOf(n)) === 'heavy';
    var p = ['Dear ' + n.name + ','];
    var open = heavy ? 'I wanted to finally say this properly.' : 'I have been meaning to write this for a while, so here goes.';
    p.push(open + (n.moment ? ' ' + cap(n.moment) + '.' : ''));
    if (n.did) p.push(cap(n.did) + '.' + (heavy ? ' I do not think you know how much that meant.' : ''));
    if (n.confession) p.push('A small confession: ' + n.confession.replace(/[.!?]+$/, '') + '.' + (heavy ? '' : ' No regrets.'));
    p.push('So I turned it into a song for you. It is a fan tribute, made with love.');
    p.push((cap(n.tenSeconds) || 'Thank you for everything') + '.');
    p.push(heavy ? 'With gratitude,\nYour fan' : 'Your biggest fan (probably),\nMe');
    return p.join('\n\n').replace(/\.\./g, '.').replace(/\u2014|\u2013/g, ', ');
  }

  function fanRecord(n, lyrics, style, letter) {
    return { fanSong: true, for: n.name, type: n.type, lyrics: lyrics, style: style, letter: letter || '', at: new Date().toISOString() };
  }

  function fingerprint(text) {
    return String(text || '').toLowerCase().replace(/\[[^\]]*\]/g, ' ').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 40).join(' ');
  }

  // True if pasted lyrics match a saved fan song (any 12-word run in common).
  function matchesFanSong(pasted, saved) {
    var p = ' ' + fingerprint(pasted) + ' ';
    if (p.trim().split(' ').length < 12) return false;
    return (saved || []).some(function (row) {
      if (!row || row.fanSong !== true) return false;
      var w = fingerprint(row.lyrics).split(' ');
      for (var i = 0; i + 12 <= w.length; i += 4) if (p.indexOf(' ' + w.slice(i, i + 12).join(' ') + ' ') !== -1) return true;
      return false;
    });
  }

  return {
    TYPES: TYPES, AFFECT: AFFECT, GENRES: GENRES, TEMPOS: TEMPOS, VOICES: VOICES, CRISIS_LINK: CRISIS_LINK, CRISIS_INTL: CRISIS_INTL,
    FAN_TAG: FAN_TAG, STORE_KEY: STORE_KEY, BLOCK_COPY: 'Fan songs are for fun and sharing, not for release. Write your own lyrics to release a song.',
    normalize: normalize, validate: validate, check: check, crisis: crisis, inferDepth: inferDepth, depthOf: depthOf, arc: arc,
    plaiRead: plaiRead, stylePrompt: stylePrompt, typeFromDescription: typeFromDescription, safeFact: safeFact,
    systemPrompt: systemPrompt, writerPrompt: writerPrompt, scrubOutput: scrubOutput, sampleSong: sampleSong,
    extractFromLetter: extractFromLetter, assembleLetter: assembleLetter, polishLetter: polishLetter,
    shortFact: shortFact, fanRecord: fanRecord, matchesFanSong: matchesFanSong, fingerprint: fingerprint,
  };
});
