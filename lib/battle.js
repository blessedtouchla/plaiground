'use strict';

/**
 * PLAIGROUND verse battle core.
 * Shared by the serverless function (Node) and the page (browser).
 * No API keys live here.
 */
(function (root, factory) {
  var song = (typeof module === 'object' && module.exports) ? require('./song-helper') : root.SongHelperCore;
  var api = factory(song || {});
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BattleCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (song) {
  var DEFAULT_MODEL = (song && song.DEFAULT_MODEL) || 'grok-4.20-0309-non-reasoning';
  var PREVIEW_NOTICE = 'Preview mode: sample verse, not written by AI.';
  var ATTRIBUTION = 'Verse drafted with Grok by xAI';
  var CREDIT_NOTE = 'Your own lines are yours to register as lyrics. AI-generated lines should be disclosed as AI when you distribute the song. This is a plain note, not legal advice.';
  var SUNO_CHAR_LIMIT = (song && song.SUNO_CHAR_LIMIT) || 3000;
  var ARTIST_NOTE = (song && song.ARTIST_NOTE) || 'We describe the sound instead of naming artists.';
  var RATE_MAX = 24;
  var RATE_WINDOW_MS = 60 * 60 * 1000;
  var BODY_MAX = 20000;
  var MAX_ROUNDS = 4;
  var TOPIC_MAX = 120;
  var NAME_MAX = 40;
  var VERSE_CHARS = 1600;
  var LINE_MAX = 200;
  var MAX_LINES_IN = 24;

  var VIBES = {
    friendly: 'Friendly cypher',
    competitive: 'Competitive',
    roast: 'Clean roast',
  };

  var STYLE = {
    friendly: {
      bpm: 94,
      prompt: 'Two contrasting voices trading verses over a warm boom-bap beat, playful cypher, 94 BPM',
    },
    competitive: {
      bpm: 144,
      prompt: 'Two contrasting voices trading verses over a hard beat, sharp and tense, 144 BPM',
    },
    roast: {
      bpm: 100,
      prompt: 'Two contrasting voices trading verses over a bouncy beat, playful roast, clean language, 100 BPM',
    },
  };

  var SYSTEM_PROMPT = [
    'You are the other voice in a verse-for-verse battle on PLAIGROUND.',
    'Write only your next verse. Do not write the human\'s next verse, a second speaker, a score, a title, or any commentary.',
    'Stay on the human\'s point. Do not reuse their sentence skeleton, their rhyme words, or an antonym swap such as deny for embrace or lies for wise.',
    'Each verse needs new imagery, new punchlines, and at least one concrete example: a place, an object, a moment, or a proof-style bar that was not in their verse.',
    'Match their energy and roughly their rhyme density. Originality matters more than mirroring. Match their length, from 4 to 16 lines, one line per bar.',
    'If the writer is a girl, use she, her, or her name. Never call her a guy, a fanboy, a bro, a dude, or he. If the writer is a boy, use he, him, or his name. Never call him a girl, a fangirl, or she. Do not copy gendered words out of their verse when those words do not match them.',
    'If there is no human verse yet, write only a short opening verse and stop.',
    'No slurs, no hate or harassment, no threats, and no sexual content about a real person.',
    'Never name a real artist, band, or producer, and never copy a real artist\'s style. Describe a sound only if you must, without a name.',
    'Do not roast a real, named private person. A light playful tease is allowed only for the name the human gave you, and only if they asked for a roast.',
    'If the vibe is clean roast, stay PG-13. No explicit words.',
    'Do not add labels, section tags, quotes, or credit lines such as "Written with Grok".',
    'Return the verse only.',
    'Everyday slang and local terms are welcome when a region or a slang word is named. Use them in the verse. Region is optional. If it is blank, do not invent a regional word.',
  ].join(' ');

  var RETRY_INSTRUCTION = [
    'The last reply failed because it echoed their lines or used the wrong voice.',
    'Write ONLY your next verse, exactly the requested number of lines, one line per bar.',
    'Do not reuse their sentence with the words swapped. Bring a new scene and one concrete example that was not in their verse.',
    'Match the writer voice in the prompt. No fanboy or guy framing for a girl. No fangirl framing for a boy.',
    'Do not write the human part. No labels. No real artist names. No slurs.',
  ].join(' ');

  var MESSAGES = {
    long: 'That is a little long. Shorten it and try again.',
    rounds: 'Pick 2, 3, or 4 rounds.',
    vibe: 'Pick a vibe: friendly cypher, competitive, or clean roast.',
    starter: 'Choose who starts.',
    shape: 'That verse did not come through. Try again.',
    cap: 'This battle is already at its last round.',
    order: 'Send your verse first. The reply is only the next verse.',
    empty: 'Write a verse first.',
    blocked: 'That crosses a line this battle will not take. No slurs, hate, threats, or sexual content about a real person.',
    artist: 'Leave real artists out. Describe the sound instead of naming one.',
    roast: 'Roasts stay light, and only with the name in this battle. Leave other people out.',
    pg13: 'Clean roast stays PG-13. Take the explicit words out and try again.',
    echo: 'The reply mirrored your lines. Try again.',
    voice: 'That reply used the wrong words for you. Try again.',
    rate: 'That is a lot of verses from this connection. Wait a bit and try again.',
    busy: 'The reply did not come back. Try again in a moment.',
    method: 'Use POST.',
    big: 'That is more than this page can take. Shorten it and try again.',
    bad: 'That did not come through. Try again.',
    honey: 'Could not take that verse.',
  };

  var SLURS = [
    'nigger', 'niggers', 'nigga', 'niggas', 'faggot', 'faggots', 'fag', 'tranny',
    'retard', 'retarded', 'kike', 'spic', 'chink', 'wetback', 'beaner',
  ];

  var NOT_NAMES = {
    the: true, this: true, that: true, your: true, you: true, beat: true, track: true,
    verse: true, rhyme: true, mic: true, rap: true, flow: true, bars: true, bar: true,
    human: true, clean: true, roast: true,
  };

  var STOP = {
    the: 1, and: 1, that: 1, this: 1, with: 1, your: 1, you: 1, for: 1, are: 1, was: 1,
    but: 1, not: 1, just: 1, like: 1, its: 1, it: 1, my: 1, me: 1, to: 1, a: 1, of: 1,
    in: 1, on: 1, i: 1, is: 1, be: 1, so: 1, we: 1, they: 1, them: 1, or: 1, if: 1,
    at: 1, from: 1, up: 1, out: 1, about: 1, into: 1, than: 1, then: 1, too: 1, can: 1,
  };

  var THREAT_RE = /\b(kill you|kills you|murder you|shoot you|stab you|rape you|rape her|rape him|i('|’)ll kill|i will kill|going to kill|gonna kill|kill yourself|kys|bomb the|shoot up|your address is|i know where you live|doxx|swat you)\b/i;
  var HATE_RE = /\b(i hate all|go back to your country|you people should|should all die|gas the|ethnic cleansing)\b/i;
  var SEXUAL_RE = /\b(sex|sexual|nude|nudes|naked|porn|orgasm|blowjob|handjob|dick|cock|pussy|boobs|tits|horny)\b/i;
  var PG13_RE = /\b(fuck|fucking|fucked|fucker|shit|shitty|bullshit|bitch|asshole|bastard|dick|cock|pussy|slut|whore|sex|sexual|nude|nudes|naked|porn)\b/i;
  var STYLE_ASK_RE = /\b(style of|sounds like|spit like|rap like|write like|flow like|flow of|channel(?:ing|ling)?|imitat\w*|voice of|as if you were|like)\b/i;
  var ROAST_CUE_RE = /\b(roast|diss|humiliate|expose|destroy|drag|clown|make fun of|put on blast|go in on)\b/i;
  var RELATION_NAME_RE = /\b(?:my|our)\s+(?:ex|boss|coworker|co-worker|colleague|mom|mother|dad|father|sister|brother|girlfriend|boyfriend|wife|husband|teacher|neighbor|neighbour|friend|manager|roommate)\s+([A-Z][\p{L}'’.-]{1,30})\b/u;
  var ROAST_NAME_RE = /\b(?:roast|diss|humiliate|expose|drag|clown|destroy)\s+([A-Z][\p{L}'’.-]{2,30}(?:\s+[A-Z][\p{L}'’.-]{2,30})?)\b/u;

  var BANKS = {
    friendly: [
      '{name}, the late bus had one headlight and {w} was not the punchline.',
      'A paper cup on a crate, and {w} is only the guest at the corner store.',
      'I am not swapping your words. {w} waits while the kettle gets loud.',
      'Rain on the window, one empty seat, and {w} starts a different story.',
      'Concrete bar: the gate was half down, and {w} still got a verse.',
      'New room, new joke. {w} can sit on the stoop beside the cracked watch.',
      'I keep a rhyme and change the street. {w} stays inside while the pocket is mine.',
      '{name}, a bus ticket answers {w} better than a sentence turned inside out.',
    ],
    competitive: [
      '{name}, I brought a bus ticket and a cracked watch. {w} does not get a free echo.',
      'The corner store gate sticks. {w} is not proof, and neither is a swapped word.',
      'You wanted a mirror. I brought a wet street, and {w} does not get copied.',
      'Specific: one headlight, one paper cup, and {w} still loses the round.',
      'I answer the point with a new picture. {w} waits by the kettle.',
      'Stack a scene, not an opposite. {w} missed the train and the kick stayed hard.',
      '{w} can wait by the door. The train left without a bow.',
      'Clean counter, new imagery. {w} does not wear your bars backwards.',
    ],
    roast: [
      '{name}, the joke is a half-down gate and a warm pan. {w} is just the guest.',
      'Cute setup. {w} gets a paper cup, and the mean stuff stays home.',
      'We can laugh and still shake hands. {w} is not your sentence backwards.',
      'Light roast. {w} told on the cracked watch, and I am still smiling.',
      'I tease the moment, not the person. {w} gets a kettle and a softer landing.',
      '{w} called itself sharp. I brought a grocery list and a better punchline.',
      'No blood. {w} already heard the clerk shrug at the corner store.',
      '{name}, saved you a seat on the wet street. {w} fits in a paper cup.',
    ],
  };

  var BEATS = { 'boom-bap': 'boom-bap', trap: 'trap', drill: 'drill', soul: 'soul', sparse: 'sparse' };
  var ENERGIES = { low: 'low', medium: 'medium', high: 'high' };
  var INSTRUMENTS = { piano: 'piano', '808s': '808s', guitar: 'guitar', bass: 'bass', drums: 'drums', synth: 'synth' };
  var ANTONYMS = {
    deny: 'embrace', embrace: 'deny',
    lies: 'wise', wise: 'lies',
    lie: 'truth', truth: 'lie',
    hate: 'love', love: 'hate',
    sticky: 'icky', icky: 'sticky',
    afraid: 'brave', brave: 'afraid',
    good: 'bad', bad: 'good',
    weak: 'strong', strong: 'weak',
  };

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  var SLUR_RE = new RegExp('\\b(' + SLURS.map(escapeRegExp).join('|') + ')\\b', 'i');

  function fail(code) {
    var err = new Error(code);
    err.code = code;
    return err;
  }

  function lyricLines(text) {
    return String(text || '').split(/\n/).map(function (line) {
      return line.trim();
    }).filter(Boolean);
  }

  function clampLines(n) {
    var value = Number(n);
    if (!isFinite(value) || value <= 0) return 8;
    value = Math.round(value);
    if (value < 4) return 4;
    if (value > 16) return 16;
    return value;
  }

  function targetLineCount(text) {
    var n = lyricLines(text).length;
    if (!n) return 8;
    return clampLines(n);
  }

  function fold(text) {
    return String(text || '').toLowerCase()
      .replace(/[@4]/g, 'a')
      .replace(/0/g, 'o')
      .replace(/[1!]/g, 'i')
      .replace(/3/g, 'e')
      .replace(/\$/g, 's')
      .replace(/7/g, 't');
  }

  function mentionsArtist(text) {
    return Boolean(song.publicFigureName && song.publicFigureName(text));
  }

  function stripArtists(text) {
    if (song.stripArtistNames) return song.stripArtistNames(text);
    return { text: String(text || '').trim(), stripped: false };
  }

  function isGrokLine(text) {
    if (song.isGrokCreditLine && song.isGrokCreditLine(text)) return true;
    return /written with grok|made with grok|generated by grok|written by grok/i.test(String(text || ''));
  }

  function nameTokens(name) {
    return String(name || '').toLowerCase().split(/\s+/).filter(function (part) {
      return part.length > 1;
    });
  }

  function isParticipant(found, name) {
    var token = String(found || '').trim().toLowerCase();
    if (!token) return false;
    var parts = nameTokens(name);
    if (!parts.length) return false;
    if (token === parts.join(' ')) return true;
    return token.split(/\s+/).every(function (part) { return parts.indexOf(part) >= 0; });
  }

  function looksLikePerson(token) {
    var key = String(token || '').trim().toLowerCase();
    if (!key || NOT_NAMES[key]) return false;
    return true;
  }

  function isBlocked(text) {
    var folded = fold(text);
    if (SLUR_RE.test(folded) || SLUR_RE.test(String(text || ''))) return true;
    if (THREAT_RE.test(folded) || THREAT_RE.test(String(text || ''))) return true;
    if (HATE_RE.test(folded) || HATE_RE.test(String(text || ''))) return true;
    return false;
  }

  function isPg13(text) {
    return PG13_RE.test(String(text || ''));
  }

  function sexualAboutPerson(text, participant) {
    var value = String(text || '');
    if (!SEXUAL_RE.test(value)) return false;
    if (mentionsArtist(value)) return true;
    var parts = nameTokens(participant);
    var named = parts.some(function (part) {
      var re = new RegExp('(^|[^\\p{L}\\p{N}])' + escapeRegExp(part) + '(?![\\p{L}\\p{N}])', 'iu');
      return re.test(value);
    });
    if (named) return true;
    var rel = value.match(RELATION_NAME_RE);
    if (rel && looksLikePerson(rel[1]) && !isParticipant(rel[1], participant)) return true;
    var ofName = value.match(/\b(?:of|about|with)\s+([A-Z][\p{L}'’.-]{2,30})\b/u);
    if (ofName && looksLikePerson(ofName[1]) && !isParticipant(ofName[1], participant)) return true;
    var two = value.match(/\b([A-Z][\p{L}'’.-]{2,30}\s+[A-Z][\p{L}'’.-]{2,30})\b/u);
    if (two && !isParticipant(two[1], participant)) return true;
    return false;
  }

  function asksForArtistStyle(text) {
    if (!mentionsArtist(text)) return false;
    return STYLE_ASK_RE.test(String(text || ''));
  }

  function roastsSomeoneElse(text, participant, vibe) {
    var value = String(text || '');
    var rel = value.match(RELATION_NAME_RE);
    if (rel && looksLikePerson(rel[1]) && !isParticipant(rel[1], participant)) {
      if (vibe === 'roast' || ROAST_CUE_RE.test(value)) return true;
    }
    var named = value.match(ROAST_NAME_RE);
    if (!named) return false;
    var token = named[1];
    if (!looksLikePerson(token.split(/\s+/)[0])) return false;
    if (isParticipant(token, participant)) return false;
    return true;
  }

  function refusalCode(text, setup) {
    var src = setup || {};
    var value = String(text || '');
    if (!value.trim()) return '';
    if (isBlocked(value)) return 'blocked';
    if (sexualAboutPerson(value, src.name)) return 'blocked';
    if (src.checkArtist && mentionsArtist(value)) return 'artist';
    if (asksForArtistStyle(value)) return 'artist';
    if (roastsSomeoneElse(value, src.name, src.vibe)) return 'roast';
    if (src.vibe === 'roast' && isPg13(value)) return 'pg13';
    return '';
  }

  function cleanClip(value, max) {
    var text = String(value == null ? '' : value).replace(/\r\n/g, '\n').trim();
    if (text.length > max) throw fail('long');
    return text;
  }

  function normalizeVerse(entry) {
    if (!entry || (entry.role !== 'human' && entry.role !== 'ai')) throw fail('shape');
    var text = cleanClip(entry.text, VERSE_CHARS);
    var lines = lyricLines(text).slice(0, MAX_LINES_IN).map(function (line) {
      return line.slice(0, LINE_MAX);
    });
    return {
      role: entry.role,
      text: lines.join('\n'),
      preview: entry.preview === true,
    };
  }

  function checkOrder(setup) {
    var list = setup.transcript;
    var expect = setup.starter;
    var i;
    for (i = 0; i < list.length; i += 1) {
      if (list[i].role !== expect) throw fail('order');
      expect = expect === 'human' ? 'ai' : 'human';
    }
    var aiCount = 0;
    list.forEach(function (verse) { if (verse.role === 'ai') aiCount += 1; });
    if (aiCount >= setup.rounds || aiCount >= MAX_ROUNDS) throw fail('cap');
    if (!list.length) {
      if (setup.starter !== 'ai') throw fail('empty');
      return;
    }
    var last = list[list.length - 1];
    if (last.role !== 'human') throw fail('order');
    if (!lyricLines(last.text).length) throw fail('empty');
  }

  function normalizeBattle(body) {
    var src = body || {};
    var rounds = Number(src.rounds);
    if (rounds !== 2 && rounds !== 3 && rounds !== 4) throw fail('rounds');
    var vibe = String(src.vibe || '');
    if (!VIBES[vibe]) throw fail('vibe');
    var starter = src.starter === 'ai' ? 'ai' : (src.starter === 'human' ? 'human' : '');
    if (!starter) throw fail('starter');
    var topic = cleanClip(src.topic, TOPIC_MAX);
    var name = cleanClip(src.name, NAME_MAX).replace(/[{}]/g, '');
    var voice = src.voice === 'girl' || src.voice === 'boy' ? src.voice : '';
    var beat = BEATS[String(src.beat || '')] || '';
    var energy = ENERGIES[String(src.energy || '')] || '';
    var instruments = [];
    (Array.isArray(src.instruments) ? src.instruments : []).forEach(function (item) {
      var key = INSTRUMENTS[String(item || '').trim().toLowerCase()];
      if (!key || instruments.indexOf(key) !== -1 || instruments.length >= 3) return;
      instruments.push(key);
    });
    var variant = Number(src.variant);
    if (!isFinite(variant) || variant < 0) variant = 0;
    variant = Math.min(12, Math.floor(variant));
    var rawList = Array.isArray(src.transcript) ? src.transcript : null;
    if (!rawList) throw fail('shape');
    if (rawList.length > MAX_ROUNDS * 2) throw fail('cap');
    var transcript = rawList.map(normalizeVerse);
    var setup = {
      rounds: rounds,
      vibe: vibe,
      starter: starter,
      topic: topic,
      name: name,
      voice: voice,
      beat: beat,
      energy: energy,
      instruments: instruments,
      variant: variant,
      transcript: transcript,
      region: cleanClip(src.region, 40),
      slang: cleanClip(src.slang, 40),
    };
    checkOrder(setup);
    return setup;
  }

  function guardSetup(setup) {
    var src = setup || {};
    var nameCode = refusalCode(src.name, { vibe: src.vibe, name: src.name, checkArtist: true });
    if (nameCode) return nameCode;
    var topicCode = refusalCode(src.topic, { vibe: src.vibe, name: src.name, checkArtist: true });
    if (topicCode) return topicCode;
    var found = '';
    (src.transcript || []).forEach(function (verse) {
      if (found) return;
      found = refusalCode(verse.text, { vibe: src.vibe, name: src.name, checkArtist: false });
    });
    return found;
  }

  function lastHumanText(setup) {
    var list = (setup && setup.transcript) || [];
    var i;
    for (i = list.length - 1; i >= 0; i -= 1) {
      if (list[i].role === 'human') return list[i].text;
    }
    return '';
  }

  function contentWords(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s']/gu, ' ')
      .split(/\s+/)
      .filter(function (word) { return word.length > 2 && !STOP[word]; })
      .slice(0, 16);
  }

  function buildSampleVerse(setup, humanText, target, variant) {
    var src = setup || {};
    var words = contentWords(humanText);
    var topicWords = contentWords(src.topic);
    var bag = words.length ? words : topicWords;
    if (!bag.length) bag = ['rhythm'];
    var name = String(src.name || '').trim() || 'you';
    var bank = BANKS[src.vibe] || BANKS.friendly;
    var start = Math.abs(Number(variant) || 0) % bank.length;
    var count = clampLines(target);
    var lines = [];
    var i;
    for (i = 0; i < count; i += 1) {
      var tmpl = bank[(start + i) % bank.length];
      var word = bag[i % bag.length];
      lines.push(tmpl.replace(/\{w\}/g, word).replace(/\{name\}/g, name));
    }
    if (src.slang && lines.length) {
      lines[lines.length - 1] = 'Everyday talk from ' + (src.region || 'home') + ': ' + String(src.slang).replace(/[{}]/g, '') + '.';
    }
    return lines.join('\n');
  }

  function lyricTokens(line) {
    return String(line || '').toLowerCase()
      .replace(/['’]s\b/g, '')
      .replace(/['’]/g, '')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(Boolean);
  }

  function isFunctionWord(word) {
    return Boolean(STOP[word] || /^(might|could|would|should|your|youre|theyre|cant|dont|im|its|a|an|call|what)$/.test(word));
  }

  function lcsRatio(a, b) {
    var n = a.length;
    var m = b.length;
    if (!n || !m) return 0;
    var prev = [];
    var j;
    for (j = 0; j <= m; j += 1) prev[j] = 0;
    var i;
    for (i = 1; i <= n; i += 1) {
      var cur = [0];
      for (j = 1; j <= m; j += 1) {
        if (a[i - 1] === b[j - 1]) cur[j] = prev[j - 1] + 1;
        else cur[j] = Math.max(prev[j], cur[j - 1]);
      }
      prev = cur;
    }
    return prev[m] / Math.max(n, m);
  }

  function hasAntonymSwap(aiWords, humanWords) {
    var n = Math.min(aiWords.length, humanWords.length);
    var i;
    for (i = 0; i < n; i += 1) {
      if (aiWords[i] !== humanWords[i] && ANTONYMS[humanWords[i]] === aiWords[i]) return true;
    }
    return false;
  }

  function contentSet(lines) {
    var set = {};
    lines.forEach(function (words) {
      words.forEach(function (word) {
        if (word.length >= 4 && !isFunctionWord(word)) set[word] = true;
      });
    });
    return set;
  }

  function lineEchoes(aiWords, humanWords, humanContent) {
    if (aiWords.length >= 6 && humanWords.length >= 6 && lcsRatio(aiWords, humanWords) >= 0.62) return true;
    if (aiWords.length >= 5 && humanWords.length >= 5 && lcsRatio(aiWords, humanWords) >= 0.5 && hasAntonymSwap(aiWords, humanWords)) return true;
    if (aiWords.length >= 5 && humanWords.length >= 2 && aiWords[0] === humanWords[0] && aiWords[1] === humanWords[1]) {
      var i;
      for (i = 2; i < aiWords.length; i += 1) {
        if (aiWords[i].length >= 4 && humanContent[aiWords[i]]) return true;
      }
    }
    return false;
  }

  function echoesHuman(lines, humanText) {
    var humanRaw = lyricLines(humanText);
    var human = humanRaw.map(function (line) { return line.toLowerCase(); });
    if (!human.length || !lines.length) return false;
    var humanBlob = human.join('\n');
    var blob = lines.join('\n').toLowerCase();
    if (humanBlob.length > 40 && blob.indexOf(humanBlob) >= 0) return true;
    var same = lines.filter(function (line) { return human.indexOf(line.toLowerCase()) >= 0; }).length;
    if (same >= Math.max(1, Math.ceil(lines.length * 0.5))) return true;
    var humanTokens = humanRaw.map(lyricTokens);
    var humanContent = contentSet(humanTokens);
    var echoCount = 0;
    lines.forEach(function (line) {
      var words = lyricTokens(line);
      var hit = humanTokens.some(function (row) { return lineEchoes(words, row, humanContent); });
      if (hit) echoCount += 1;
    });
    if (echoCount >= 2) return true;
    if (echoCount / lines.length >= 0.5) return true;
    var shared = 0;
    var aiContent = 0;
    var seen = {};
    lines.forEach(function (line) {
      lyricTokens(line).forEach(function (word) {
        if (word.length < 5 || isFunctionWord(word) || seen[word]) return;
        seen[word] = true;
        aiContent += 1;
        if (humanContent[word]) shared += 1;
      });
    });
    return aiContent >= 6 && shared >= 6 && shared / aiContent >= 0.4;
  }

  function misgenders(text, voice) {
    var value = String(text || '');
    if (voice === 'girl') return /\b(fanboys?|bros?|dudes?|fellas?|guys?|hey man)\b/i.test(value);
    if (voice === 'boy') return /\b(fangirls?|you girls|hey girl|hey sis)\b/i.test(value);
    return false;
  }

  function voiceRule(voice) {
    if (voice === 'girl') return 'The writer is a girl. Call her she, her, or by name. Never fanboy, guy, guys, bro, dude, or he for her. Do not copy those words out of her verse.';
    if (voice === 'boy') return 'The writer is a boy. Call him he, him, or by name. Never fangirl, girl, or she for him. Do not copy those words out of his verse.';
    return 'Do not assume the writer is a guy. Avoid fanboy, bro, and dude unless they chose boy.';
  }

  function verseFromModel(raw, target, humanText, setup) {
    var text = String(raw || '').replace(/```[a-z]*\n?/gi, '').trim();
    var sourceLines = text.split(/\n/);
    var lines = [];
    var i;
    for (i = 0; i < sourceLines.length; i += 1) {
      var line = sourceLines[i].trim();
      if (!line) continue;
      if (/^\[/.test(line)) continue;
      if (/^(ai|human|verse|reply)$/i.test(line)) continue;
      if (/^(human|user|me)\s*[:\-]/i.test(line)) break;
      if (/^\[verse[^\]]*\bhuman\b/i.test(line)) break;
      line = line.replace(/^(ai|verse|reply)\s*[:\-]\s*/i, '');
      line = line.replace(/^\d+[\).\]]\s*/, '');
      line = line.replace(/^[-*•]\s*/, '');
      if (/^(here('|’)s|sure[,.]|okay[,.]|note:|commentary:)/i.test(line)) continue;
      if (isGrokLine(line)) continue;
      if (/^preview mode\b/i.test(line)) continue;
      if (/^sample verse\b/i.test(line)) continue;
      var cleaned = stripArtists(line).text;
      if (!cleaned) continue;
      lines.push(cleaned.slice(0, LINE_MAX));
      if (lines.length >= 16) break;
    }
    var want = clampLines(target);
    if (lines.length > want) lines = lines.slice(0, want);
    var code = refusalCode(lines.join('\n'), {
      vibe: setup && setup.vibe,
      name: setup && setup.name,
    });
    if (code) return { ok: false, code: code, text: '', lines: [] };
    if (echoesHuman(lines, humanText)) return { ok: false, code: 'echo', text: '', lines: [] };
    if (misgenders(lines.join('\n'), setup && setup.voice)) return { ok: false, code: 'voice', text: '', lines: [] };
    if (!lines.length) return { ok: false, code: 'empty', text: '', lines: [] };
    return { ok: true, code: '', text: lines.join('\n'), lines: lines };
  }

  function battlePrompt(setup) {
    var src = setup || {};
    var last = lastHumanText(src);
    var target = targetLineCount(last);
    return JSON.stringify({
      task: 'Write ONLY your next verse. ' + target + ' lines. Answer the human\'s point with new imagery, new punchlines, and at least one concrete example that was not in their verse. Do not reuse their sentence skeleton or swap their words for opposites. Originality matters more than mirroring. Do not write the human\'s next verse, a score, or a title.',
      writerVoice: voiceRule(src.voice),
      vibe: src.vibe,
      topic: src.topic || '',
      region: src.region || '',
      slang: src.slang || '',
      nameYouMayTeaseLightly: src.name || '',
      targetLines: target,
      variant: src.variant || 0,
      lastHumanVerse: last,
      transcript: (src.transcript || []).map(function (verse) {
        return { role: verse.role, text: verse.text };
      }),
      rules: src.vibe === 'roast'
        ? 'Clean roast. PG-13. Light teasing only. No slurs, hate, threats, or sexual content. Do not name real artists or copy a real style. Do not roast anyone except a light tease of the name above.'
        : 'No slurs, hate, harassment, threats, or sexual content about a real person. Do not name real artists or copy a real style. Do not roast a real private person beyond a light tease of the name above.',
    });
  }

  function keepLyricLine(line) {
    var text = String(line || '').trim();
    if (!text) return '';
    if (isGrokLine(text)) return '';
    if (/^preview mode\b/i.test(text)) return '';
    if (/^sample verse\b/i.test(text)) return '';
    if (/^written with\b/i.test(text)) return '';
    if (/^\[/.test(text)) return '';
    return text;
  }

  function formatSunoLyrics(verses, options) {
    var opts = options || {};
    var humanN = 0;
    var aiN = 0;
    var blocks = [];
    if (opts.intro) blocks.push('[Intro]');
    (verses || []).forEach(function (verse) {
      var role = verse && verse.role === 'ai' ? 'ai' : 'human';
      var kept = [];
      lyricLines(verse && verse.text).forEach(function (line) {
        var clean = keepLyricLine(line);
        if (clean) kept.push(clean);
      });
      if (!kept.length) return;
      var n;
      var label;
      if (role === 'ai') {
        aiN += 1;
        n = aiN;
        label = 'AI';
      } else {
        humanN += 1;
        n = humanN;
        label = 'Human';
      }
      blocks.push('[Verse ' + n + ' - ' + label + ']\n' + kept.join('\n'));
    });
    if (opts.outro) blocks.push('[Outro]');
    return blocks.join('\n\n');
  }

  function countLines(verses) {
    var human = 0;
    var ai = 0;
    var sample = 0;
    (verses || []).forEach(function (verse) {
      var n = lyricLines(verse && verse.text).filter(keepLyricLine).length;
      if (!n) return;
      if (!verse || verse.role !== 'ai') human += n;
      else if (verse.preview) sample += n;
      else ai += n;
    });
    return { human: human, ai: ai, sample: sample };
  }

  function creditCounts(verses) {
    var counts = countLines(verses);
    var lines = ['Lines you wrote: ' + counts.human];
    if (counts.ai || !counts.sample) lines.push('Lines generated by AI: ' + counts.ai);
    if (counts.sample) lines.push('Sample lines, not written by AI: ' + counts.sample);
    return lines.join('\n');
  }

  function creditSummary(verses) {
    return creditCounts(verses) + '\n\n' + CREDIT_NOTE;
  }

  function buildStylePrompt(vibe, options) {
    var row = STYLE[vibe] || STYLE.competitive;
    var opts = options || {};
    var parts = [row.prompt];
    if (opts.voice === 'girl') parts.push('lead vocal is a girl');
    else if (opts.voice === 'boy') parts.push('lead vocal is a boy');
    if (BEATS[opts.beat]) parts.push(BEATS[opts.beat] + ' drums');
    if (ENERGIES[opts.energy]) parts.push(ENERGIES[opts.energy] + ' energy');
    var instruments = [];
    (opts.instruments || []).forEach(function (name) {
      var key = INSTRUMENTS[String(name || '').trim().toLowerCase()];
      if (!key || instruments.indexOf(key) !== -1 || instruments.length >= 3) return;
      instruments.push(key);
    });
    if (instruments.length) parts.push('instruments: ' + instruments.join(', '));
    var cleaned = stripArtists(parts.join(', '));
    return {
      prompt: cleaned.text,
      bpm: row.bpm,
      artistNamesStripped: Boolean(cleaned.stripped),
      note: cleaned.stripped ? ARTIST_NOTE : '',
    };
  }

  function cleanPrompt(text) {
    return stripArtists(text).text;
  }

  function undoLastReply(verses) {
    var list = (verses || []).map(function (verse) {
      return { role: verse.role, text: verse.text, preview: Boolean(verse && verse.preview) };
    });
    if (!list.length || list[list.length - 1].role !== 'ai') {
      return { verses: list, restored: '' };
    }
    list.pop();
    var restored = '';
    if (list.length && list[list.length - 1].role === 'human') restored = list.pop().text;
    return { verses: list, restored: restored };
  }

  function withoutLastReply(verses) {
    var list = (verses || []).map(function (verse) {
      return { role: verse.role, text: verse.text, preview: Boolean(verse && verse.preview) };
    });
    if (list.length && list[list.length - 1].role === 'ai') list.pop();
    return list;
  }

  function sideCounts(verses) {
    var human = 0;
    var ai = 0;
    (verses || []).forEach(function (verse) {
      if (!lyricLines(verse && verse.text).length) return;
      if (verse.role === 'human') human += 1;
      else if (verse.role === 'ai') ai += 1;
    });
    return { human: human, ai: ai };
  }

  function exportReady(verses) {
    var counts = sideCounts(verses);
    return counts.human >= 1 && counts.ai >= 1;
  }

  function battleFinished(verses, rounds) {
    var counts = sideCounts(verses);
    var n = Number(rounds) || 0;
    return n > 0 && counts.human >= n && counts.ai >= n;
  }

  function songHelperDraft(verses, meta) {
    var info = meta || {};
    var sections = [];
    var humanN = 0;
    var aiN = 0;
    (verses || []).forEach(function (verse) {
      var lines = lyricLines(verse && verse.text).map(keepLyricLine).filter(Boolean);
      if (!lines.length) return;
      var label;
      if (verse.role === 'ai') {
        aiN += 1;
        label = 'Verse ' + aiN + ' - AI';
      } else {
        humanN += 1;
        label = 'Verse ' + humanN + ' - Human';
      }
      var index = sections.length;
      sections.push({
        label: label,
        lines: lines.map(function (text, lineIndex) {
          return {
            text: text,
            source: verse.role === 'human' ? 'user' : 'generated',
            role: '',
            id: 'b' + index + 'l' + lineIndex,
            original: text,
            edited: false,
          };
        }),
      });
    });
    var hookText = info.line || 'I showed up with my own bars.';
    return {
      title: String(info.title || 'Human and AI').slice(0, 80),
      hooks: [
        { id: 'a', text: hookText, source: 'user', selected: true, original: hookText },
        { id: 'b', text: 'Say it back over the same beat.', source: 'generated', original: 'Say it back over the same beat.' },
      ],
      sections: sections,
    };
  }

  function helperSession(state) {
    var src = state || {};
    var verses = src.verses || [];
    var lyrics = [];
    verses.forEach(function (verse) {
      lyricLines(verse && verse.text).forEach(function (text) {
        var clean = keepLyricLine(text);
        if (!clean) return;
        lyrics.push({ text: clean.slice(0, 280), yours: verse.role === 'human' });
      });
    });
    var firstHuman = '';
    verses.forEach(function (verse) {
      if (!firstHuman && verse && verse.role === 'human') firstHuman = lyricLines(verse.text)[0] || '';
    });
    var line = firstHuman || 'I showed up with my own bars.';
    if (line.length < 12 || line.indexOf(' ') === -1) line = 'I showed up with my own bars.';
    var happened = src.topic || firstHuman || 'We traded verses back and forth.';
    if (String(happened).length < 8) happened = 'We traded verses back and forth.';
    var who = src.name || 'you';
    var title = String(src.topic || 'Human and AI').slice(0, 80);
    var aiVerses = verses.filter(function (verse) { return verse && verse.role === 'ai'; });
    var everySample = aiVerses.length > 0 && aiVerses.every(function (verse) { return verse.preview; });
    var vibeLabel = src.vibe === 'roast' ? 'clean roast' : (src.vibe === 'friendly' ? 'friendly cypher' : 'competitive');
    return {
      source: 'battle',
      mood: vibeLabel,
      happened: String(happened).slice(0, 280),
      who: String(who).slice(0, 80),
      why: 'We answered each other, one verse at a time.',
      line: String(line).slice(0, 280),
      genre: 'Hip-hop',
      pack: 'hiphop',
      title: title,
      artistName: String(src.name || '').slice(0, 80),
      coverLook: 'collage',
      lyrics: lyrics.slice(0, 80),
      battlePreview: everySample,
      battleDraft: songHelperDraft(verses, { title: title, line: String(line).slice(0, 280) }),
    };
  }

  return {
    ARTIST_NOTE: ARTIST_NOTE,
    ATTRIBUTION: ATTRIBUTION,
    BODY_MAX: BODY_MAX,
    CREDIT_NOTE: CREDIT_NOTE,
    DEFAULT_MODEL: DEFAULT_MODEL,
    LINE_MAX: LINE_MAX,
    MAX_ROUNDS: MAX_ROUNDS,
    MESSAGES: MESSAGES,
    NAME_MAX: NAME_MAX,
    PREVIEW_NOTICE: PREVIEW_NOTICE,
    RATE_MAX: RATE_MAX,
    RATE_WINDOW_MS: RATE_WINDOW_MS,
    RETRY_INSTRUCTION: RETRY_INSTRUCTION,
    STYLE: STYLE,
    SUNO_CHAR_LIMIT: SUNO_CHAR_LIMIT,
    SYSTEM_PROMPT: SYSTEM_PROMPT,
    TOPIC_MAX: TOPIC_MAX,
    VERSE_CHARS: VERSE_CHARS,
    VIBES: VIBES,
    asksForArtistStyle: asksForArtistStyle,
    battleFinished: battleFinished,
    battlePrompt: battlePrompt,
    buildSampleVerse: buildSampleVerse,
    buildStylePrompt: buildStylePrompt,
    cleanPrompt: cleanPrompt,
    countLines: countLines,
    creditCounts: creditCounts,
    creditSummary: creditSummary,
    exportReady: exportReady,
    formatSunoLyrics: formatSunoLyrics,
    guardSetup: guardSetup,
    helperSession: helperSession,
    lastHumanText: lastHumanText,
    lyricLines: lyricLines,
    normalizeBattle: normalizeBattle,
    refusalCode: refusalCode,
    targetLineCount: targetLineCount,
    undoLastReply: undoLastReply,
    echoesHuman: echoesHuman,
    verseFromModel: verseFromModel,
    withoutLastReply: withoutLastReply,
  };
}));
