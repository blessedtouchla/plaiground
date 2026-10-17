/**
 * Song Helper arcade. Three cabinets, local word-keeping passes, and class labels.
 * Browser and server. No secrets. AI writing is charged by the API, not here.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PlaigroundSongArcade = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var CREDIT = 1;

  var CABINETS = [
    { id: 'write', title: 'Write or fix my song', blurb: 'Start a new song, or paste one and fix it.' },
    { id: 'parody', title: 'Make a parody', blurb: 'Comment on a real song. The lyric has to say something new.' },
    { id: 'remix', title: 'Remix my song', blurb: 'Keep your story and hook. Change the genre.' },
  ];

  var FRESH_CLASSES = [
    { id: 'human', label: "I'll write, coach me", note: 'Human', madeHow: 'no_ai', classLabel: 'Human' },
    { id: 'assisted', label: "Let's write it together", note: 'AI-assisted', madeHow: 'ai_assisted', classLabel: 'AI-assisted' },
    { id: 'full', label: 'Write it for me', note: 'Fully AI', madeHow: 'fully_ai', classLabel: 'Fully AI' },
  ];

  var FIX_CLASSES = [
    { id: 'human', label: 'Coach me to fix it', note: 'Human', madeHow: 'no_ai', classLabel: 'Human' },
    { id: 'assisted', label: 'Suggest fixes', note: 'AI-assisted', madeHow: 'ai_assisted', classLabel: 'AI-assisted' },
    { id: 'full', label: 'Fix it for me', note: 'Fully AI', madeHow: 'fully_ai', classLabel: 'Fully AI' },
  ];

  var FIXES = [
    { id: 'weak', label: 'Fix weak lines' },
    { id: 'hook', label: 'Tighten the hook' },
    { id: 'mood', label: 'Change the mood' },
    { id: 'length', label: 'Shorter/longer' },
    { id: 'voice', label: 'Make it more me' },
  ];

  var MOODS = [
    { id: 'Love', label: 'Love' },
    { id: 'Heartbreak', label: 'Heartbreak' },
    { id: 'Hype', label: 'Hype' },
    { id: 'Grateful', label: 'Grateful' },
    { id: 'Nostalgic', label: 'Nostalgic' },
    { id: 'Angry', label: 'Angry' },
    { id: 'Petty', label: 'Petty' },
    { id: 'Calm', label: 'Calm' },
  ];

  var GENRES = [
    'Pop', 'Hip-hop', 'R&B', 'Country', 'Rock', 'Reggaeton',
    'Afrobeats', 'EDM', 'Lo-fi', 'Gospel', 'Punk', 'Jazz',
  ].map(function (label) { return { id: label, label: label }; });

  var VIBES = ['Bright', 'Late night', 'Tender', 'Tough', 'Playful', 'Heavy', 'Soft', 'Anthem'].map(function (label) {
    return { id: label, label: label };
  });

  var GENRE_STYLE = {
    Pop: 'Pop. Bright tempo, clean drums, a hook that returns.',
    'Hip-hop': 'Hip-hop. Pocket drums, bass in front.',
    'R&B': 'R&B. Warm vocal, soft drums.',
    Country: 'Country. Acoustic strum, plain speech.',
    Rock: 'Rock. Live drums, guitar in front.',
    Reggaeton: 'Reggaeton. Dembow pulse, night tempo.',
    Afrobeats: 'Afrobeats. Rolling percussion, bright bass.',
    EDM: 'EDM. A build and a drop under the hook.',
    'Lo-fi': 'Lo-fi. Dusty drums, soft keys, late night.',
    Gospel: 'Gospel. Organ or choir pads, a lifted hook.',
    Punk: 'Punk. Fast drums, short lines.',
    Jazz: 'Jazz. Brushed drums, walking bass.',
  };

  var STOP = {
    a: true, an: true, the: true, and: true, or: true, but: true, if: true, so: true,
    to: true, of: true, in: true, on: true, at: true, for: true, with: true, from: true,
    is: true, was: true, are: true, be: true, it: true, this: true, that: true,
    my: true, your: true, you: true, me: true, i: true, we: true, they: true,
  };

  function classById(id) {
    var found = null;
    FRESH_CLASSES.concat(FIX_CLASSES).forEach(function (row) {
      if (row.id === id) found = row;
    });
    return found;
  }

  function clip(value, max) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
  }

  function block(value, max) {
    return String(value == null ? '' : value).replace(/\r\n/g, '\n').trim().slice(0, max);
  }

  function linesOf(text) {
    return String(text || '').replace(/\r\n/g, '\n').split('\n');
  }

  function isLabel(line) {
    return /^\[?(verse|chorus|hook|bridge|outro|intro)(?:\s+\d+)?\]?:?$/i.test(String(line || '').trim());
  }

  function contentLines(text) {
    return linesOf(text).map(function (line) { return line.trim(); }).filter(function (line) {
      return line && !isLabel(line);
    });
  }

  function tokens(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9'\s]/g, ' ').split(/\s+/).filter(Boolean);
  }

  function mostRepeated(lines) {
    var counts = {};
    lines.forEach(function (line) {
      var key = line.toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
    });
    var best = lines[0] || '';
    var bestN = 0;
    lines.forEach(function (line) {
      var n = counts[line.toLowerCase()] || 0;
      if (n > bestN) {
        best = line;
        bestN = n;
      }
    });
    return best;
  }

  function scene(row) {
    return {
      id: row.id,
      ask: row.ask,
      help: row.help || '',
      pick: row.pick || '',
      key: row.key || '',
      tiles: row.tiles || [],
      fields: row.fields || [],
      tips: row.tips || [],
      prefill: row.prefill || '',
      skip: !!row.skip,
    };
  }

  function hasFix(answers, id) {
    return Array.isArray(answers.fixes) && answers.fixes.indexOf(id) !== -1;
  }

  function stepWrite(answers) {
    var a = answers || {};
    if (a.path !== 'fresh' && a.path !== 'fix') {
      return {
        scene: scene({
          id: 'path',
          ask: 'Starting fresh or fixing one?',
          pick: 'one',
          key: 'path',
          tiles: [
            { id: 'fresh', label: 'Starting fresh' },
            { id: 'fix', label: 'Fixing one' },
          ],
        }),
        ready: false,
      };
    }
    if (!classById(a.classId)) {
      var fixing = a.path === 'fix';
      return {
        scene: scene({
          id: 'class',
          ask: 'How do you want to write it?',
          help: fixing
            ? 'Coaching tips are free. A suggested fix or a full rewrite is 1 credit.'
            : 'Coaching tips are free. A suggested line or a full song is 1 credit.',
          pick: 'one',
          key: 'classId',
          tiles: fixing ? FIX_CLASSES : FRESH_CLASSES,
        }),
        ready: false,
      };
    }
    if (a.path === 'fresh') return stepFresh(a);
    return stepFix(a);
  }

  function stepFresh(a) {
    if (!clip(a.mood, 40)) {
      return {
        scene: scene({
          id: 'mood',
          ask: 'What mood is this?',
          pick: 'one',
          key: 'mood',
          tiles: MOODS,
        }),
        ready: false,
      };
    }
    if (!clip(a.story, 2000)) {
      return {
        scene: scene({
          id: 'story',
          ask: 'What happened?',
          help: 'One answer. Your words stay in the song.',
          fields: [{ id: 'story', label: 'What happened', optional: false }],
        }),
        ready: false,
      };
    }
    if (!a.whoAsked) {
      return {
        scene: scene({
          id: 'who',
          ask: "Who is it about?",
          help: 'Skip this if it is just you.',
          fields: [{ id: 'who', label: "Who it's about", optional: true }],
          skip: true,
        }),
        ready: false,
      };
    }
    if (!a.keepAsked) {
      return {
        scene: scene({
          id: 'keep',
          ask: 'A line to keep?',
          help: 'Skip this if you do not have one yet.',
          fields: [{ id: 'keep', label: 'A line to keep', optional: true }],
          skip: true,
        }),
        ready: false,
      };
    }
    if (a.classId === 'full') {
      return {
        scene: scene({
          id: 'go',
          ask: 'Ready for the song?',
          help: 'You answered the questions. The song is 1 credit.',
        }),
        ready: true,
        action: 'write',
        credit: CREDIT,
        primary: { id: 'write', label: 'Write it for me (1 credit)', credit: CREDIT },
      };
    }
    var tips = coachTips(a);
    if (!block(a.lyrics, 8000)) {
      return {
        scene: scene({
          id: 'lyrics',
          ask: a.classId === 'human' ? 'Write every word.' : 'Write it, and take a line if you want one.',
          help: a.classId === 'human'
            ? 'Plai coaches. You write every word. Tips are free.'
            : 'You write the song. A suggested line is 1 credit. Keep it or edit it.',
          fields: [{ id: 'lyrics', label: 'Your lyrics', optional: false }],
          tips: tips,
        }),
        ready: false,
        action: a.classId === 'assisted' ? 'line' : 'tip',
        credit: a.classId === 'assisted' ? CREDIT : 0,
        secondary: a.classId === 'assisted'
          ? { id: 'line', label: 'Suggest a line (1 credit)', credit: CREDIT }
          : { id: 'tip', label: 'Another tip', credit: 0 },
      };
    }
    return {
      scene: scene({
        id: 'lyrics',
        ask: a.classId === 'human' ? 'Write every word.' : 'Write it, and take a line if you want one.',
        help: a.classId === 'human'
          ? 'Plai coaches. You write every word. Tips are free.'
          : 'You write the song. A suggested line is 1 credit. Keep it or edit it.',
        fields: [{ id: 'lyrics', label: 'Your lyrics', optional: false }],
        tips: tips,
        prefill: block(a.lyrics, 8000),
      }),
      ready: true,
      action: 'show',
      credit: 0,
      primary: { id: 'show', label: 'Show my song', credit: 0 },
      secondary: a.classId === 'assisted'
        ? { id: 'line', label: 'Suggest a line (1 credit)', credit: CREDIT }
        : { id: 'tip', label: 'Another tip', credit: 0 },
    };
  }

  function stepFix(a) {
    if (block(a.lyrics, 8000).length < 12) {
      return {
        scene: scene({
          id: 'paste',
          ask: 'Paste the lyrics.',
          fields: [{ id: 'lyrics', label: 'Your lyrics', optional: false }],
        }),
        ready: false,
      };
    }
    if (!Array.isArray(a.fixes) || !a.fixes.length) {
      return {
        scene: scene({
          id: 'fixes',
          ask: 'What should change?',
          pick: 'many',
          key: 'fixes',
          tiles: FIXES,
        }),
        ready: false,
      };
    }
    if (hasFix(a, 'mood') && !clip(a.fixMood, 40)) {
      return {
        scene: scene({
          id: 'fixMood',
          ask: 'Which mood?',
          pick: 'one',
          key: 'fixMood',
          tiles: MOODS,
        }),
        ready: false,
      };
    }
    if (hasFix(a, 'length') && a.length !== 'shorter' && a.length !== 'longer') {
      return {
        scene: scene({
          id: 'length',
          ask: 'Shorter or longer?',
          pick: 'one',
          key: 'length',
          tiles: [
            { id: 'shorter', label: 'Shorter' },
            { id: 'longer', label: 'Longer' },
          ],
        }),
        ready: false,
      };
    }
    if (hasFix(a, 'voice') && !clip(a.voice, 400)) {
      return {
        scene: scene({
          id: 'voice',
          ask: 'What should stay you?',
          fields: [{ id: 'voice', label: 'What should stay you?', optional: false }],
        }),
        ready: false,
      };
    }
    if (a.classId === 'human') {
      return {
        scene: scene({
          id: 'after',
          ask: 'Write the fix yourself.',
          help: 'Tips are free. You change the words.',
          tips: coachTips(a),
          fields: [{ id: 'after', label: 'Your fix', optional: false }],
          prefill: block(a.lyrics, 8000),
        }),
        ready: !!block(a.after, 8000),
        action: 'show',
        credit: 0,
        primary: block(a.after, 8000) ? { id: 'show', label: 'Show the fix', credit: 0 } : null,
        secondary: { id: 'tip', label: 'Another tip', credit: 0 },
      };
    }
    var full = a.classId === 'full';
    return {
      scene: scene({
        id: 'go',
        ask: full ? 'Ready for the rewrite?' : 'Ready for suggested fixes?',
        help: full
          ? 'The rewrite is 1 credit. Your story and hook stay.'
          : 'Suggested lines are 1 credit. Keep them or edit them.',
      }),
      ready: true,
      action: 'fix',
      credit: CREDIT,
      primary: {
        id: 'fix',
        label: full ? 'Fix it for me (1 credit)' : 'Suggest fixes (1 credit)',
        credit: CREDIT,
      },
    };
  }

  function stepRemix(answers) {
    var a = answers || {};
    if (block(a.lyrics, 8000).length < 12) {
      return {
        scene: scene({
          id: 'paste',
          ask: 'Paste your song.',
          fields: [{ id: 'lyrics', label: 'Lyrics', optional: false }],
        }),
        ready: false,
      };
    }
    if (!a.genreAsked) {
      return {
        scene: scene({
          id: 'fromGenre',
          ask: 'What genre is it now?',
          help: 'Skip this if you are not sure.',
          pick: 'one',
          key: 'fromGenre',
          tiles: [{ id: '', label: 'Skip' }].concat(GENRES),
          skip: true,
        }),
        ready: false,
      };
    }
    if (!a.moodAsked) {
      return {
        scene: scene({
          id: 'fromMood',
          ask: 'What mood is it now?',
          help: 'Skip this if you want.',
          fields: [{ id: 'fromMood', label: 'Current mood', optional: true }],
          skip: true,
        }),
        ready: false,
      };
    }
    if (!GENRE_STYLE[a.toGenre]) {
      return {
        scene: scene({
          id: 'genre',
          ask: 'Pick a new genre.',
          pick: 'one',
          key: 'toGenre',
          tiles: GENRES,
        }),
        ready: false,
      };
    }
    if (!clip(a.vibe, 40)) {
      return {
        scene: scene({
          id: 'vibe',
          ask: 'Pick a vibe.',
          pick: 'one',
          key: 'vibe',
          tiles: VIBES,
        }),
        ready: false,
      };
    }
    return {
      scene: scene({
        id: 'go',
        ask: 'Ready to remix?',
        help: 'The new lyric is 1 credit. Your story and hook stay.',
      }),
      ready: true,
      action: 'remix',
      credit: CREDIT,
      primary: { id: 'remix', label: 'Remix it (1 credit)', credit: CREDIT },
    };
  }

  function coachTips(input) {
    var a = input || {};
    var tips = ['Say it the way you would say it out loud.'];
    if (a.mood) tips.push('Let the ' + String(a.mood).toLowerCase() + ' feeling show up in a place or an object.');
    if (a.keep) tips.push('Keep this line where someone can sing it back: ' + clip(a.keep, 160));
    if (hasFix(a, 'weak')) tips.push('Cut any line you would not say twice.');
    if (hasFix(a, 'hook')) tips.push('Keep the hook to one or two lines you already mean.');
    if (hasFix(a, 'mood') && a.fixMood) tips.push('Aim the picture at ' + String(a.fixMood).toLowerCase() + '. Leave the story alone.');
    if (hasFix(a, 'length') && a.length === 'shorter') tips.push('Drop about half the lines. Keep the hook.');
    if (hasFix(a, 'length') && a.length === 'longer') tips.push('Bring the hook back one more time. Do not add a new story.');
    if (hasFix(a, 'voice') && a.voice) tips.push('Stay close to this: ' + clip(a.voice, 160));
    return tips.slice(0, 4);
  }

  function applyFix(lyrics, answers) {
    var source = contentLines(lyrics);
    var next = source.slice();
    if (!next.length) return block(lyrics, 8000);
    if (hasFix(answers, 'weak')) {
      var counts = {};
      next = next.filter(function (line) {
        var key = line.toLowerCase();
        counts[key] = (counts[key] || 0) + 1;
        if (counts[key] > 2) return false;
        if (line.length < 8 && source.length > 2) return false;
        return true;
      });
      if (!next.length) next = source.slice();
    }
    if (hasFix(answers, 'voice') && clip(answers.voice, 400)) {
      var words = tokens(answers.voice).filter(function (word) { return word.length >= 3 && !STOP[word]; });
      var hit = next.filter(function (line) {
        var lower = line.toLowerCase();
        return words.some(function (word) { return lower.indexOf(word) !== -1; });
      });
      if (hit.length) next = hit;
    }
    if (hasFix(answers, 'length') && answers.length === 'shorter' && next.length > 2) {
      var hookLine = mostRepeated(next);
      var keep = Math.max(2, Math.ceil(next.length / 2));
      var chosen = [];
      next.forEach(function (line) {
        if (line.toLowerCase() === hookLine.toLowerCase() || chosen.length < keep) chosen.push(line);
      });
      next = chosen;
    }
    if (hasFix(answers, 'length') && answers.length === 'longer') {
      var again = mostRepeated(next);
      next = next.concat(['[Hook]', again]);
    }
    if (hasFix(answers, 'hook') && next.length) {
      var body = contentLines(next.join('\n'));
      var hook = mostRepeated(body.length ? body : next);
      var rest = (body.length ? body : next).filter(function (line) {
        return line.toLowerCase() !== hook.toLowerCase();
      });
      var shaped = [];
      if (rest.length) shaped.push('[Verse]');
      rest.forEach(function (line) { shaped.push(line); });
      shaped.push('[Hook]');
      shaped.push(hook);
      next = shaped;
    }
    return next.join('\n');
  }

  function applyRemix(lyrics) {
    var lines = contentLines(lyrics);
    if (!lines.length) return block(lyrics, 8000);
    var hook = mostRepeated(lines);
    var rest = lines.filter(function (line) { return line.toLowerCase() !== hook.toLowerCase(); });
    var shaped = [];
    if (rest.length) shaped.push('[Verse]');
    rest.forEach(function (line) { shaped.push(line); });
    shaped.push('[Hook]');
    shaped.push(hook);
    return shaped.join('\n');
  }

  function sentences(text) {
    var rows = [];
    String(text || '').replace(/\r\n/g, '\n').split('\n').forEach(function (row) {
      String(row || '').split(/(?<=[.!?])\s+/).forEach(function (part) {
        var line = String(part || '').trim();
        if (line) rows.push(line);
      });
    });
    return rows;
  }

  function applyWrite(answers) {
    var a = answers || {};
    if (a.classId !== 'full') return block(a.lyrics, 8000);
    var story = sentences(a.story);
    var who = clip(a.who, 200);
    var keep = clip(a.keep, 200);
    var verse = story.slice();
    if (who) verse.push(who);
    if (!verse.length && keep) verse.push(keep);
    var hook = keep || verse[0] || '';
    var shaped = [];
    if (verse.length) shaped.push('[Verse]');
    verse.forEach(function (line) { shaped.push(line); });
    if (hook) {
      shaped.push('[Hook]');
      shaped.push(hook);
    }
    return shaped.join('\n');
  }

  function applyLine(answers) {
    var a = answers || {};
    var keep = clip(a.keep, 200);
    if (keep) return keep;
    var fromLyrics = contentLines(a.lyrics);
    if (fromLyrics.length) return mostRepeated(fromLyrics);
    var story = sentences(a.story);
    return story[0] || '';
  }

  function writeStyle(answers) {
    var a = answers || {};
    var mood = clip(a.mood, 40) || 'your mood';
    var bits = ['Mood: ' + mood + '.'];
    if (a.classId === 'human') bits.push('Plain speech. The writer sings every word.');
    else if (a.classId === 'assisted') bits.push('Plain speech, with room for a line the writer keeps or edits.');
    else bits.push('Plain speech. A hook that returns. Built from the story they told.');
    if (clip(a.keep, 200)) bits.push('Keep their line in the hook.');
    return bits.join(' ');
  }

  function fixStyle(answers) {
    var a = answers || {};
    var bits = [];
    if (hasFix(a, 'weak')) bits.push('Keep the strongest lines. Drop repeats.');
    if (hasFix(a, 'hook')) bits.push('A short hook that returns. Two lines, easy to sing back.');
    if (hasFix(a, 'mood')) bits.push('Mood: ' + (clip(a.fixMood, 40) || 'the new mood') + '.');
    if (hasFix(a, 'length') && a.length === 'shorter') bits.push('Shorter form. About half the lines, the hook stays.');
    if (hasFix(a, 'length') && a.length === 'longer') bits.push('Longer form. The hook comes back once more.');
    if (hasFix(a, 'voice')) bits.push('Stay in the writer\'s own words.');
    if (!bits.length) bits.push('Plain speech. The writer\'s story stays.');
    return bits.join(' ');
  }

  function remixStyle(answers) {
    var a = answers || {};
    var genre = GENRE_STYLE[a.toGenre] || ('Genre: ' + clip(a.toGenre, 40) + '.');
    var bits = [genre, 'Vibe: ' + (clip(a.vibe, 40) || 'the new vibe') + '.'];
    if (clip(a.fromMood, 80)) bits.push('Coming from a ' + clip(a.fromMood, 80) + ' feel.');
    bits.push('Keep the story and the hook.');
    return bits.join(' ');
  }

  function remixHeading(answers) {
    var next = clip(answers && answers.toGenre, 40) || 'the new genre';
    var prior = clip(answers && answers.fromGenre, 40);
    if (!prior) return 'Your song to ' + next;
    return prior + ' to ' + next;
  }

  function highlightLines(before, after) {
    var prior = {};
    linesOf(before).forEach(function (line) {
      var key = line.trim();
      if (key) prior[key] = true;
    });
    return linesOf(after).map(function (line) {
      var key = line.trim();
      return { text: line, changed: !!(key && !prior[key]) };
    });
  }

  function cleanModel(text) {
    return String(text || '')
      .replace(/```[a-z]*/gi, '')
      .replace(/[\u2014\u2013]/g, ',')
      .replace(/\bsuno\b/ig, '')
      .replace(/\btonegrid\b/ig, '')
      .replace(/\bgrok\b/ig, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function contentWords(text) {
    return tokens(text).filter(function (word) { return word.length >= 3 && !STOP[word]; });
  }

  function overlap(source, next) {
    var left = contentWords(source);
    var right = contentWords(next);
    if (!right.length) return 0;
    var set = {};
    left.forEach(function (word) { set[word] = true; });
    var hit = 0;
    right.forEach(function (word) { if (set[word]) hit += 1; });
    return hit / right.length;
  }

  function acceptAi(modelText, source) {
    var clean = cleanModel(modelText);
    if (!clean || overlap(source, clean) < 0.35) return '';
    return clean;
  }

  function acceptLine(modelText) {
    var clean = cleanModel(modelText).split('\n').map(function (line) { return line.trim(); }).filter(Boolean)[0] || '';
    if (!clean || clean.length > 180) return '';
    if (contentWords(clean).length < 2) return '';
    return clean;
  }

  function classFields(answers, kind) {
    if (kind === 'remix') return { classLabel: 'Fully AI', madeHow: 'fully_ai' };
    var row = classById(answers && answers.classId);
    if (!row) return { classLabel: '', madeHow: '' };
    return { classLabel: row.classLabel, madeHow: row.madeHow };
  }

  function sourceText(kind, answers) {
    var a = answers || {};
    if (kind === 'line' || kind === 'write') {
      return [a.story, a.who, a.keep, a.lyrics].filter(Boolean).join('\n');
    }
    return block(a.lyrics, 8000);
  }

  function localAfter(kind, answers) {
    if (kind === 'remix') return applyRemix(answers.lyrics);
    if (kind === 'fix') {
      if (answers.classId === 'human' && block(answers.after, 8000)) return block(answers.after, 8000);
      return applyFix(answers.lyrics, answers);
    }
    if (kind === 'line') return applyLine(answers);
    if (kind === 'write') return answers.classId === 'full' ? applyWrite(answers) : block(answers.lyrics, 8000);
    if (kind === 'show') {
      if (answers.path === 'fix') return block(answers.after || answers.lyrics, 8000);
      return block(answers.lyrics, 8000);
    }
    return '';
  }

  function styleFor(kind, answers) {
    if (kind === 'remix') return remixStyle(answers);
    if (kind === 'fix' || (kind === 'show' && answers && answers.path === 'fix')) return fixStyle(answers);
    return writeStyle(answers);
  }

  function headingFor(kind, answers) {
    if (kind === 'remix') return remixHeading(answers);
    if (kind === 'fix' || (kind === 'show' && answers && answers.path === 'fix')) return 'Before and after';
    return 'Your song';
  }

  function prepare(action, input) {
    var kind = action === 'arcade-remix' ? 'remix'
      : (action === 'arcade-fix' ? 'fix'
        : (action === 'arcade-line' ? 'line'
          : (action === 'arcade-write' ? 'write' : '')));
    var answers = input || {};
    if (!kind) return { ok: false, error: 'That action is not on this page.' };
    var source = sourceText(kind, answers);
    if (kind === 'line') {
      if (clip(source, 8000).length < 8) return { ok: false, error: 'Write a little first. Then I can offer a line.' };
    } else if (kind === 'write') {
      if (clip(answers.story, 2000).length < 8) return { ok: false, error: 'Tell a little of the story first.' };
    } else if (block(answers.lyrics, 8000).length < 12) {
      return { ok: false, error: 'Paste the lyrics first.' };
    }
    var after = localAfter(kind, answers);
    if (!after) return { ok: false, error: 'Paste the lyrics first.' };
    var labels = classFields(answers, kind);
    return {
      ok: true,
      kind: kind,
      before: kind === 'line' ? '' : block(answers.lyrics || answers.story, 8000),
      after: after,
      style: styleFor(kind, answers),
      heading: headingFor(kind, answers),
      classLabel: labels.classLabel,
      madeHow: labels.madeHow,
      sourceText: source,
      system: systemPrompt(kind),
      prompt: userPrompt(kind, answers),
    };
  }

  function systemPrompt(kind) {
    if (kind === 'line') {
      return 'Write ONE lyric line from the songwriter\'s own details. You may phrase it freshly, but the situation stays theirs. Do not copy any other song. Do not name a music generator. No em dash. Reply with the line only.';
    }
    if (kind === 'remix') {
      return 'Adapt the songwriter\'s lyrics to the new genre. Keep their story and their hook. You may regroup lines and adjust phrasing. Most of the words must stay theirs. Do not copy any other song. Do not name a music generator. No em dash. Reply with the lyric only.';
    }
    if (kind === 'fix') {
      return 'Fix the songwriter\'s own lyrics. Keep their story. You may drop weak lines, tighten the hook, shorten, or repeat their hook. Do not invent a new story. Do not copy any other song. Do not name a music generator. No em dash. Reply with the lyric only.';
    }
    return 'Write a short song from the songwriter\'s answers. Keep their story, names, and images. You may add a few connecting words so it sings. Use [Verse] and [Hook]. Put their keep line in the hook when they gave one. Do not copy any other song. Do not name a music generator. No em dash. Reply with the lyric only.';
  }

  function userPrompt(kind, answers) {
    var a = answers || {};
    if (kind === 'line') {
      return [
        'Mood: ' + clip(a.mood, 40),
        'Story: ' + clip(a.story, 2000),
        'Who: ' + clip(a.who, 200),
        'Keep: ' + clip(a.keep, 200),
        'Lyrics so far:',
        block(a.lyrics, 4000),
      ].join('\n');
    }
    if (kind === 'write') {
      return [
        'Mood: ' + clip(a.mood, 40),
        'What happened: ' + clip(a.story, 2000),
        'Who: ' + clip(a.who, 200),
        'Line to keep: ' + clip(a.keep, 200),
      ].join('\n');
    }
    if (kind === 'remix') {
      return [
        'Current genre: ' + clip(a.fromGenre, 40),
        'Current mood: ' + clip(a.fromMood, 80),
        'New genre: ' + clip(a.toGenre, 40),
        'Vibe: ' + clip(a.vibe, 40),
        'Lyrics:',
        block(a.lyrics, 8000),
      ].join('\n');
    }
    return [
      'Fixes: ' + (Array.isArray(a.fixes) ? a.fixes.join(', ') : ''),
      'Mood: ' + clip(a.fixMood, 40),
      'Length: ' + clip(a.length, 20),
      'Voice note: ' + clip(a.voice, 400),
      'Lyrics:',
      block(a.lyrics, 8000),
    ].join('\n');
  }

  function finish(built, after) {
    var next = block(after || built.after, 8000);
    var labels = { classLabel: built.classLabel, madeHow: built.madeHow };
    var lines = built.kind === 'line' ? [] : highlightLines(built.before, next);
    return {
      ok: true,
      before: built.before,
      after: next,
      style: built.style,
      heading: built.heading,
      lines: lines,
      classLabel: labels.classLabel,
      madeHow: labels.madeHow,
      options: built.kind === 'line' ? [next] : [],
    };
  }

  function reveal(kind, answers) {
    var built = prepare(kind === 'remix' ? 'arcade-remix' : (kind === 'fix' ? 'arcade-fix' : (kind === 'line' ? 'arcade-line' : 'arcade-write')), answers);
    if (!built.ok) return built;
    if (kind === 'show') {
      var shown = localAfter('show', answers);
      var styled = styleFor('show', answers);
      var labels = classFields(answers, answers && answers.path === 'fix' ? 'fix' : 'write');
      return {
        ok: true,
        before: block(answers.lyrics || '', 8000),
        after: shown,
        style: styled,
        heading: headingFor('show', answers),
        lines: highlightLines(answers.lyrics || '', shown),
        classLabel: labels.classLabel,
        madeHow: labels.madeHow,
        credit: 0,
      };
    }
    var painted = finish(built, built.after);
    painted.credit = CREDIT;
    return painted;
  }

  function trail(cabinet, answers) {
    var a = answers || {};
    var ids = [];
    if (cabinet === 'remix') {
      ids = ['paste', 'fromGenre', 'fromMood', 'genre', 'vibe', 'go'];
    } else if (a.path === 'fix') {
      ids = ['path', 'class', 'paste', 'fixes'];
      if (hasFix(a, 'mood')) ids.push('fixMood');
      if (hasFix(a, 'length')) ids.push('length');
      if (hasFix(a, 'voice')) ids.push('voice');
      ids.push(a.classId === 'human' ? 'after' : 'go');
    } else {
      ids = ['path', 'class', 'mood', 'story', 'who', 'keep'];
      ids.push(a.classId === 'full' ? 'go' : 'lyrics');
    }
    var step = cabinet === 'remix' ? stepRemix(a) : stepWrite(a);
    var current = step.scene ? step.scene.id : ids[ids.length - 1];
    var at = ids.indexOf(current);
    if (at < 0) at = 0;
    return { index: at + 1, total: ids.length, id: current };
  }

  function draftRecord(answers, painted) {
    var row = painted || {};
    return {
      path: answers && answers.path ? answers.path : (answers && answers.toGenre ? 'remix' : ''),
      classLabel: row.classLabel || '',
      madeHow: row.madeHow || '',
      mood: clip(answers && (answers.mood || answers.fixMood || answers.fromMood), 80),
      story: clip(answers && answers.story, 2000),
      before: row.before || '',
      lyrics: row.after || '',
      style: row.style || '',
      heading: row.heading || '',
    };
  }

  return {
    CREDIT: CREDIT,
    CABINETS: CABINETS,
    FRESH_CLASSES: FRESH_CLASSES,
    FIX_CLASSES: FIX_CLASSES,
    FIXES: FIXES,
    MOODS: MOODS,
    GENRES: GENRES,
    VIBES: VIBES,
    GENRE_STYLE: GENRE_STYLE,
    stepWrite: stepWrite,
    stepRemix: stepRemix,
    trail: trail,
    coachTips: coachTips,
    applyFix: applyFix,
    applyRemix: applyRemix,
    applyWrite: applyWrite,
    highlightLines: highlightLines,
    acceptAi: acceptAi,
    acceptLine: acceptLine,
    prepare: prepare,
    finish: finish,
    reveal: reveal,
    draftRecord: draftRecord,
    classById: classById,
    contentLines: contentLines,
  };
});
