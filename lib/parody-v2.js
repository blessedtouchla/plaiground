'use strict';

/**
 * Parody v2. Original lyrics from the writer's notes.
 * Browser and server. No API key lives here.
 * Weird Al style mix is a style label only.
 */
(function (root, factory) {
  var modes = {};
  if (typeof module === 'object' && module.exports) {
    try { modes = require('./song-modes'); } catch (err) { modes = {}; }
  } else if (root && root.SongModes) {
    modes = root.SongModes;
  }
  var api = factory(modes || {});
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PlaigroundParodyV2 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (modes) {
  var SECTIONS = ['Intro', 'Verse 1', 'Pre-chorus', 'Chorus', 'Verse 2', 'Bridge', 'Outro'];
  var CREDIT = 1;
  var RUN = 6;
  var FAIR_USE_NOTE = modes.FAIR_USE_NOTE || 'A parody can be fair use when it comments on the original. A court decides that later, not this page. This is not legal advice.';
  var RELEASE_NOTE = modes.RELEASE_NOTE || 'Label the release as a parody. Do not upload the original recording. Do not ask a generator for the original singer\'s voice. A look-alike title or cover can still be a problem.';
  var PARODY_LABEL = modes.PARODY_LABEL || 'Parody';
  var DEMO_NOTICE = modes.DEMO_NOTICE || 'Demo mode. This is a sample, not written by AI.';
  var SIGN_IN_NOTE = 'Sign in to run the AI pass. That uses 1 credit. This view is a sample from your notes.';
  var TIPS = [
    'Label it as a parody.',
    'Frame claims about real people as jokes or opinion, not stated facts.',
    'No voice cloning or a sound-alike of the real artist\'s voice.',
    'YouTube and TikTok are the usual home. A store release usually needs permission from the publisher.',
  ];
  var HUMBLE_FEEL = 'minimal West Coast hip-hop, hard piano stabs, booming 808s, sparse trap hats, sarcastic deadpan female rap, playful whisper ad-libs, comedic parody energy, punchy and bouncy';
  var SAFE = [
    'New words carry the point. The old lyric stays out.',
    'The comment leads. The record does not lend a line.',
    'A parody answer, written fresh, with none of their bars.',
    'Same argument, different pocket, none of their wording.',
  ];
  var FIXES = [
    [/\bteh\b/gi, 'the'],
    [/\brecieve\b/gi, 'receive'],
    [/\bwierd\b/gi, 'weird'],
    [/\bseperate\b/gi, 'separate'],
    [/\bdefinately\b/gi, 'definitely'],
    [/\balledged\b/gi, 'alleged'],
    [/\bboughten\b/gi, 'bought'],
    [/\bhumbe\b/gi, 'humble'],
    [/\bsneeky\b/gi, 'sneaky'],
    [/\bsneeki\b/gi, 'sneaky'],
    [/\bim\b/gi, "I'm"],
    [/\bdont\b/gi, "don't"],
    [/\bcant\b/gi, "can't"],
    [/\bwont\b/gi, "won't"],
    [/\bdidnt\b/gi, "didn't"],
    [/\bisnt\b/gi, "isn't"],
    [/\bwasnt\b/gi, "wasn't"],
    [/\barent\b/gi, "aren't"],
    [/\btheyre\b/gi, "they're"],
    [/\byoure\b/gi, "you're"],
    [/\bthats\b/gi, "that's"],
    [/\bits\b/gi, "it's"],
    [/\btheres\b/gi, "there's"],
    [/\bwhats\b/gi, "what's"],
    [/\blets\b/gi, "let's"],
    [/\bcouldnt\b/gi, "couldn't"],
    [/\bwouldnt\b/gi, "wouldn't"],
    [/\bshouldnt\b/gi, "shouldn't"],
  ];

  function line(text) {
    return { text: String(text || '').replace(/\s+/g, ' ').trim(), source: 'generated', role: '', locked: false, vote: 0 };
  }

  function section(label, rows) {
    return { label: label, lines: rows.map(line).filter(function (row) { return row.text; }) };
  }

  function wordsOf(text) {
    return String(text || '').toLowerCase().replace(/[^a-z0-9'\s]/g, ' ').split(/\s+/).filter(Boolean);
  }

  function gramsOf(text) {
    var words = wordsOf(text);
    var bag = {};
    if (words.length < RUN) return bag;
    for (var i = 0; i <= words.length - RUN; i += 1) {
      bag[words.slice(i, i + RUN).join(' ')] = true;
    }
    return bag;
  }

  function hasRun(text, bag) {
    var words = wordsOf(text);
    if (words.length < RUN) return false;
    for (var i = 0; i <= words.length - RUN; i += 1) {
      if (bag[words.slice(i, i + RUN).join(' ')]) return true;
    }
    return false;
  }

  function cleanVoice(text) {
    var raw = String(text || '');
    var unsure = [];
    raw.split(/[^A-Za-z0-9']+/).forEach(function (token) {
      if (!token || token.length < 3) return;
      if (looksUnsure(token) && unsure.indexOf(token) === -1) unsure.push(token);
    });
    var next = raw;
    FIXES.forEach(function (pair) {
      next = next.replace(pair[0], pair[1]);
    });
    next = next.replace(/\b(?:um+|uh+|er+|ah+)\b/gi, ' ');
    next = next.replace(/\b([A-Za-z']+)(\s+\1\b)+/gi, '$1');
    next = next.replace(/\s+/g, ' ').trim();
    return { text: next, unsure: unsure };
  }

  function looksUnsure(token) {
    var word = String(token || '');
    if (/[a-z]/i.test(word) && /\d/.test(word)) return true;
    if (/(.)\1\1/i.test(word) && !/^(?:mmm|ooo|ahh|ohh|woo)+$/i.test(word)) return true;
    var letters = word.replace(/[^a-z]/gi, '');
    if (letters.length >= 4 && !/[aeiou]/i.test(letters)) return true;
    if (/[bcdfghjklmnpqrstvwxyz]{5,}/i.test(letters)) return true;
    return false;
  }

  function cap(text) {
    var value = String(text || '').replace(/\s+/g, ' ').trim().replace(/[.]+$/, '');
    if (!value) return '';
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function pointsOf(input) {
    var raw = [input && input.happened, input && input.comment].filter(Boolean).join('. ');
    var out = [];
    raw.split(/[\n\.;]+/).forEach(function (chunk) {
      chunk.split(/,/).forEach(function (bit) {
        bit.split(/\b(?:while|versus|vs\.?)\b/i).forEach(function (part) {
          var text = part.replace(/\s+/g, ' ').trim();
          if (text.length < 6) return;
          var words = text.split(/\s+/).slice(0, 12);
          var short = words.join(' ');
          if (out.indexOf(short) === -1) out.push(short);
        });
      });
    });
    return out.slice(0, 8);
  }

  function point(list, index, fallback) {
    return list[index] || fallback;
  }

  function hookFromTitle(title) {
    var words = String(title || '').replace(/[^\w\s']/g, ' ').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return 'Say it plain';
    if (/^(me|my|the|a|an)$/i.test(words[0]) && words.length > 1) words = words.slice(1);
    if (words.length === 1) return 'Be ' + words[0].toLowerCase();
    return words.join(' ');
  }

  function humbleCue(input) {
    return /humbl|humil|sit down|bought stream|family-man|family man/i.test([
      input && input.originalTitle,
      input && input.comment,
      input && input.happened,
    ].join(' '));
  }

  function straightSections(input, hook, pts) {
    var a = cap(point(pts, 0, 'the sermon and the swing do not match'));
    var b = cap(point(pts, 1, 'the argument starts when the moral shows up'));
    var c = cap(point(pts, 2, 'the numbers look rented'));
    var d = cap(point(pts, 3, 'the picture at home'));
    var e = cap(point(pts, 4, 'the lyric tells on itself'));
    var title = input.title || 'This one';
    var low = hook.toLowerCase();
    return [
      section('Intro', [
        a + ', then the pose starts ' + b.toLowerCase() + '.',
        'New pocket, new wording, none of their bars in the crowd.',
      ]),
      section('Verse 1', [
        a + ' while the smile stays ready for the room.',
        b + ', and the quiet line cannot hide the boom.',
        'Sharp on the contrast. Soft on nobody\'s throat.',
        'I say the gap in my own voice, not a borrowed note.',
      ]),
      section('Pre-chorus', [
        c + ', blinking like a scoreboard that will not sit.',
        'Hold the public pose beside the private bit.',
      ]),
      section('Chorus', [
        hook + ', ' + low + ', say the quiet part twice.',
        hook + ' with the moral, ' + low + ' with the price.',
        title + ' keeps a new cadence and a clean rhyme.',
        'Commentary in a new pocket. Not a borrowed line.',
      ]),
      section('Verse 2', [
        d + ' on the wall, polished till it shines.',
        e + ', and the hallway keeps the empty time.',
        'A family picture can smile while the story leaves the house.',
        'Opinion, not a verdict. The contrast can still be loud.',
      ]),
      section('Bridge', [
        'Call it a joke if you need the frame. Call it opinion if you need the name.',
        'Do not state a real life as a fact this song can claim.',
      ]),
      section('Outro', [
        'That is the comment. The original lyric stays put.',
        title + ' walks out on its own feet.',
      ]),
    ];
  }

  function weirdSections(input, hook, pts) {
    var a = cap(point(pts, 0, 'the sermon in a party hat'));
    var b = cap(point(pts, 1, 'picking a fight with a sandwich'));
    var c = cap(point(pts, 2, 'numbers rented by the hour'));
    var d = cap(point(pts, 3, 'a family poster on a waffle'));
    var e = cap(point(pts, 4, 'the lyric admits the mess'));
    var title = input.title || 'This joke';
    var sit = humbleCue(input)
      ? "Okay, okay... I'll sit down. (chair squeaks loudly)"
      : 'Okay, okay... I talked too long. (chair squeaks loudly)';
    var chorus = /sneaky/i.test(hook) ? [
      'Be sneaky (sneaky), be sneaky (shh),',
      'Tiptoe in Timberlands, squeaky, squeaky',
      'Quiet on the poster, petty in the group chat. (phone buzzes)',
      'I hid behind a ficus and the ficus called me that. (leaves shake)',
    ] : [
      hook + ' (' + wordsOf(hook).slice(-1)[0] + '), ' + hook.toLowerCase() + ' (shh),',
      'Tiptoe through the punchline, squeaky, squeaky. (shoe squeak)',
      'Absurd on purpose, like a penguin auditing a parade. (honk)',
      'I am the punchline too, so the swing is not a blade. (rimshot)',
    ];
    return [
      section('Intro', [
        '(whispers) ' + a + ', like a cat in church shoes.',
        'I brought a juice box to the sermon and the juice box called a truce. (cap pops)',
      ]),
      section('Verse 1', [
        a + ', then ' + b.toLowerCase() + ', like a goose in a lawsuit. (honk)',
        c + ', as if the chart were a rented bouncy house.',
        'Big twist, soft shoes, nobody gets a bruise.',
        'Funny first. The comment rides along in the caboose. (train whistle)',
      ]),
      section('Pre-chorus', [
        'I am not the hall monitor. I am the squeak in the shoe.',
        'If this gets too sharp, I clown myself before I clown you. (nose honk)',
      ]),
      section('Chorus', chorus),
      section('Verse 2', [
        d + ', smiling like a mascot who lost his head. (head rolls)',
        e + ', then the suitcase waves from the driveway. (zipper)',
        'The halo is a sticker. The punchline peels it back.',
        'A family-man frame on a pancake. That is the poke. (syrup drip)',
      ]),
      section('Bridge', [
        'This is a joke, not a court and not a sworn report. (paper rustles)',
        'Opinion in a party hat. I will not clone a voice to make the point.',
        'I sound like a guy who lost a bet with a cake. (fork clinks)',
      ]),
      section('Outro', [
        sit,
        'I came to tease the pose and I tripped on my own shoe.',
        title + ' bows on the way out. The old lyric stays with you. (mic thumps)',
      ]),
    ];
  }

  function writeSections(input) {
    var hook = hookFromTitle(input.title);
    var pts = pointsOf(input);
    var sections = input.version === 'weird'
      ? weirdSections(input, hook, pts)
      : straightSections(input, hook, pts);
    var by = {};
    sections.forEach(function (part) { by[part.label] = part; });
    return SECTIONS.map(function (label) {
      return by[label] || section(label, ['New words. The point stays. Their lyric stays out.']);
    });
  }

  function scrubLine(text, bag, index) {
    if (!hasRun(text, bag)) return { text: text, changed: false };
    var safe = SAFE[index % SAFE.length];
    if (hasRun(safe, bag)) safe = 'New words only. The copied run was removed.';
    return { text: safe, changed: true };
  }

  function scrubSections(sections, sourceText) {
    var bag = gramsOf(sourceText);
    var changed = false;
    if (!Object.keys(bag).length) return { sections: sections, changed: false };
    var next = (sections || []).map(function (part) {
      var lines = (part.lines || []).map(function (row, index) {
        var text = typeof row === 'string' ? row : (row && row.text);
        var cleaned = scrubLine(text, bag, index);
        if (cleaned.changed) changed = true;
        var copy = typeof row === 'string' ? line(cleaned.text) : Object.assign({}, row, { text: cleaned.text });
        return copy;
      });
      return { label: part.label, lines: lines };
    });
    return { sections: next, changed: changed };
  }

  function filterNames(text, input) {
    var raw = [input && input.originalTitle, input && input.artist, input && input.song].filter(Boolean).join(' ');
    var stop = { the: true, and: true, song: true, feat: true, with: true, her: true, his: true, their: true, from: true, by: true };
    var out = String(text || '');
    raw.split(/[^A-Za-z0-9]+/).forEach(function (token) {
      if (!token || token.length < 3 || stop[token.toLowerCase()]) return;
      var re = new RegExp('\\b' + token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'ig');
      out = out.replace(re, '');
    });
    out = out.replace(/\s{2,}/g, ' ').replace(/\s+,/g, ',').replace(/,\s*,/g, ',').replace(/^[,\s]+|[,\s]+$/g, '').trim();
    return out;
  }

  function stylePrompt(input) {
    var blob = [input && input.originalTitle, input && input.comment, input && input.happened].join(' ').toLowerCase();
    var prompt;
    if (/humbl|humil|sit down|bought stream|family-man|family man/.test(blob)) prompt = HUMBLE_FEEL;
    else if (/reggae|riddim|dancehall/.test(blob)) prompt = 'one drop reggae, warm bass, offbeat guitar, conversational vocal, comedic parody energy, punchy and bouncy';
    else if (/country|nashville|truck/.test(blob)) prompt = 'modern country, acoustic guitar, steady kick, conversational vocal, dry humor, comedic parody energy, punchy and bouncy';
    else prompt = 'modern pop, tight drums, bright synths, conversational vocal, comedic parody energy, punchy and bouncy';
    return filterNames(prompt, input || {});
  }

  function prepare(input) {
    var src = input || {};
    var title = cleanVoice(src.title);
    var comment = cleanVoice(src.comment);
    var happened = cleanVoice(src.happened);
    var unsure = [];
    title.unsure.concat(comment.unsure, happened.unsure).forEach(function (token) {
      if (unsure.indexOf(token) === -1) unsure.push(token);
    });
    return {
      title: title.text || String(src.title || '').trim(),
      comment: comment.text,
      happened: happened.text,
      originalTitle: String(src.originalTitle || '').trim(),
      lines: String(src.lines || src.originalLyrics || '').trim(),
      artNote: String(src.artNote || '').trim(),
      version: src.version === 'weird' || src.parodyVersion === 'weird' ? 'weird' : 'straight',
      unsure: unsure,
    };
  }

  function versionLabel(version) {
    return version === 'weird' ? 'Weird Al style mix' : 'Straight';
  }

  function notesFor() {
    return [PARODY_LABEL, FAIR_USE_NOTE, RELEASE_NOTE].concat(TIPS);
  }

  function buildPack(input) {
    var ready = prepare(input);
    var scrubbed = scrubSections(writeSections(ready), ready.lines);
    var prompt = stylePrompt(ready);
    var label = versionLabel(ready.version);
    return {
      ok: true,
      preview: true,
      source: 'sample',
      notice: DEMO_NOTICE,
      mode: 'parody',
      step: 'draft',
      credit: CREDIT,
      version: ready.version,
      versionLabel: label,
      unsure: ready.unsure,
      stylePrompt: prompt,
      rewritten: scrubbed.changed,
      critique: {
        ok: true,
        label: label,
        fairUse: FAIR_USE_NOTE,
        release: RELEASE_NOTE,
        tips: TIPS.slice(),
      },
      draft: {
        title: ready.title || 'Parody',
        versionLabel: label,
        stylePrompt: prompt,
        sections: scrubbed.sections,
        notes: notesFor(),
      },
    };
  }

  function scrubPackage(pack, input) {
    var ready = prepare(input);
    var source = ready.lines;
    var scrubbed = scrubSections(pack && pack.draft && pack.draft.sections, source);
    if (!pack || !pack.draft) return pack;
    pack.draft.sections = scrubbed.sections;
    if (scrubbed.changed) pack.rewritten = true;
    pack.stylePrompt = filterNames(pack.stylePrompt || stylePrompt(ready), ready);
    if (pack.draft) pack.draft.stylePrompt = pack.stylePrompt;
    return pack;
  }

  function parseJson(content) {
    var text = String(content || '').trim();
    if (!text) return null;
    text = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
    var start = text.indexOf('{');
    var end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    try { return JSON.parse(text.slice(start, end + 1)); } catch (err) { return null; }
  }

  function fromModel(content, input, fallback) {
    var parsed = parseJson(content);
    if (!parsed || !parsed.sections) return null;
    var base = fallback || buildPack(input);
    var ready = prepare(input);
    var local = writeSections(ready);
    var by = {};
    parsed.sections.forEach(function (part) {
      var label = String(part && part.label || '').trim().toLowerCase();
      var match = SECTIONS.filter(function (name) { return name.toLowerCase() === label; })[0];
      if (!match) return;
      var rows = (part.lines || []).map(function (row) {
        var text = typeof row === 'string' ? row : (row && row.text);
        text = String(text || '').replace(/\s+/g, ' ').trim();
        return text ? line(text) : null;
      }).filter(Boolean);
      if (rows.length) by[match] = rows;
    });
    base.draft.sections = SECTIONS.map(function (name, index) {
      return { label: name, lines: by[name] || local[index].lines };
    });
    if (parsed.title) base.draft.title = String(parsed.title).replace(/\s+/g, ' ').trim().slice(0, 80);
    if (parsed.stylePrompt) base.stylePrompt = filterNames(parsed.stylePrompt, ready);
    else base.stylePrompt = stylePrompt(ready);
    base.draft.stylePrompt = base.stylePrompt;
    base.preview = false;
    base.source = 'writer';
    base.notice = '';
    return scrubPackage(base, ready);
  }

  function plain(pack) {
    var draft = (pack && pack.draft) || pack || {};
    var parts = [];
    if (draft.versionLabel) parts.push(draft.versionLabel);
    (draft.sections || []).forEach(function (part) {
      parts.push(part.label);
      (part.lines || []).forEach(function (row) {
        parts.push(typeof row === 'string' ? row : row.text);
      });
      parts.push('');
    });
    if (pack && pack.stylePrompt) {
      parts.push('Style prompt');
      parts.push(pack.stylePrompt);
    }
    return parts.join('\n').trim();
  }

  function systemPrompt(input) {
    var version = input && (input.version === 'weird' || input.parodyVersion === 'weird') ? 'weird' : 'straight';
    return [
      'You are PLAIGROUND Song Helper in parody mode.',
      'Write original parody lyrics. Sections in order: Intro, Verse 1, Pre-chorus, Chorus, Verse 2, Bridge, Outro.',
      'Never copy or quote the original lyrics. Echo the cadence and the hook idea with new words.',
      'Version: ' + version + '.',
      version === 'weird'
        ? 'Weird Al style mix is a style label only. Use big comedic twists, absurd similes, a self-deprecating outro, and sound-gag ad-libs in parentheses. Funny, not an attack.'
        : 'Straight is sharp commentary. No sound-gag ad-libs.',
      'Frame claims about real people as jokes or opinion, not stated facts.',
      'Do not imitate a real voice. Do not ask for an original recording.',
      'stylePrompt describes the feel only. Do not name the artist or the song.',
      'Return JSON only: {"title":"","stylePrompt":"","sections":[{"label":"Intro","lines":["..."]}]}.',
    ].join(' ');
  }

  return {
    CREDIT: CREDIT,
    SECTIONS: SECTIONS,
    TIPS: TIPS,
    FAIR_USE_NOTE: FAIR_USE_NOTE,
    RELEASE_NOTE: RELEASE_NOTE,
    DEMO_NOTICE: DEMO_NOTICE,
    SIGN_IN_NOTE: SIGN_IN_NOTE,
    HUMBLE_FEEL: HUMBLE_FEEL,
    cleanVoice: cleanVoice,
    filterNames: filterNames,
    stylePrompt: stylePrompt,
    package: buildPack,
    scrubPackage: scrubPackage,
    fromModel: fromModel,
    plain: plain,
    prepare: prepare,
    systemPrompt: systemPrompt,
    pointsOf: pointsOf,
    hookFromTitle: hookFromTitle,
  };
});
