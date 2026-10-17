/**
 * Song Helper v3 screens. One question per screen.
 * Tiles only pick options. They never write a lyric.
 */
(function (root, factory) {
  var api = factory(function () {
    if (typeof module === 'object' && module.exports && typeof require === 'function') return require('./song-v3');
    return root.SongV3;
  });
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SongV3Flow = api;
})(typeof window !== 'undefined' ? window : globalThis, function (getWriter) {
  var POINTS_SCREEN = 100;
  var POINTS_CHECK = 50;

  var A3 = [
    ['love', 'Someone I love', ''],
    ['miss', 'Someone I miss', ''],
    ['done', "Someone I'm done with", ''],
    ['me', 'Me', ''],
    ['people', 'My people', ''],
    ['all', 'Everybody', ''],
    ['else', 'Something else', ''],
  ];

  var A4 = {
    love: { plai: "What's the story with them?", tiles: [['start', "We're just starting"], ['through', "We've been through it all"], ['never', 'I never told them']] },
    miss: { plai: 'Where did they go?', gentleOn: 'passed', tiles: [['moved', 'They moved away'], ['apart', 'We grew apart'], ['passed', 'They passed away']] },
    done: { plai: 'What happened?', tiles: [['lied', 'They lied'], ['left', 'They left'], ['outgrew', 'I outgrew them']] },
    me: { plai: "What's going on with you?", tiles: [['up', "I'm leveling up"], ['heal', "I'm healing"], ['stuck', "I'm stuck"], ['proud', "I'm proud of me"]] },
    people: { plai: "What's the moment?", tiles: [['made', 'We made it'], ['night', "A night we'll never forget"], ['hold', 'Holding each other up'], ['miss', 'Missing someone together']] },
    all: { plai: 'What should they do when it plays?', tiles: [['dance', 'Dance'], ['sing', 'Sing along'], ['car', 'Turn it up in the car'], ['alone', 'Feel less alone']] },
  };

  var FEEL_ORDER = {
    start: ['Joy', 'Hype', 'Longing', 'Peace'],
    through: ['Pride', 'Nostalgia', 'Joy', 'Peace'],
    never: ['Longing', 'Heartbreak', 'Nostalgia', 'Peace'],
    moved: ['Longing', 'Heartbreak', 'Nostalgia', 'Peace'],
    apart: ['Heartbreak', 'Longing', 'Nostalgia', 'Anger'],
    passed: ['Heartbreak', 'Longing', 'Peace', 'Nostalgia'],
    lied: ['Anger', 'Heartbreak', 'Pride', 'Hype'],
    left: ['Heartbreak', 'Anger', 'Longing', 'Pride'],
    outgrew: ['Pride', 'Peace', 'Joy', 'Nostalgia'],
    up: ['Pride', 'Hype', 'Joy', 'Peace'],
    heal: ['Peace', 'Longing', 'Pride', 'Nostalgia'],
    stuck: ['Longing', 'Anger', 'Heartbreak', 'Peace'],
    proud: ['Pride', 'Joy', 'Hype', 'Peace'],
    made: ['Pride', 'Joy', 'Hype', 'Nostalgia'],
    night: ['Nostalgia', 'Joy', 'Hype', 'Funny'],
    hold: ['Peace', 'Longing', 'Pride', 'Heartbreak'],
    miss: ['Longing', 'Heartbreak', 'Nostalgia', 'Peace'],
    dance: ['Hype', 'Joy', 'Funny', 'Pride'],
    sing: ['Joy', 'Hype', 'Peace', 'Funny'],
    car: ['Hype', 'Joy', 'Nostalgia', 'Funny'],
    alone: ['Peace', 'Longing', 'Heartbreak', 'Nostalgia'],
  };

  var ALL_FEELINGS = ['Joy', 'Heartbreak', 'Hype', 'Longing', 'Anger', 'Pride', 'Peace', 'Nostalgia', 'Funny'];

  var GENRE_TIP = {
    'Hip-hop': 'Longer lines, rhymes inside the bar, and a punch at the end.',
    'R&B': 'Fewer words, with room to run a word.',
    'Pop': 'Short lines, and the title comes back again.',
    'Country': 'Plain talk, a real place, and a twist on the last chorus.',
    'Afrobeats': 'A short hook the crowd can shout back.',
    'Reggaeton': 'A short hook the crowd can shout back.',
    'Reggae': 'Offbeat lines, no put-on accent.',
    'Rock': 'A hook you can shout, and lines that drive.',
    'Gospel': 'A big refrain, then a lift in the bridge.',
    'House': 'Two to four lines, and then they repeat.',
    'Surprise me': 'I will pick a sound that fits.',
  };

  var FIT = {
    Joy: ['Pop', 'Hip-hop'],
    Hype: ['Hip-hop', 'Pop'],
    Heartbreak: ['R&B', 'Country'],
    Longing: ['R&B', 'Country'],
    Anger: ['Rock', 'Hip-hop'],
    Pride: ['Gospel', 'Hip-hop'],
    Peace: ['Reggae', 'R&B'],
    Nostalgia: ['Country', 'R&B'],
    Funny: ['Pop', 'Hip-hop'],
  };

  var VIBES = ['Late night', 'Party', 'Sad but dancing', 'Chill', 'Big and loud', 'Church'];

  var ADVANCED = [
    { id: 'delivery', label: "How it's delivered", options: [['sung', 'Sung'], ['rapped', 'Rapped'], ['chant', 'Chant it'], ['call', 'Call and response'], ['spoken', 'Spoken']] },
    { id: 'rhyme', label: 'Rhymes', options: [['tight', 'Tight rhymes'], ['loose', 'Loose rhymes'], ['none', 'No rhymes needed']] },
    { id: 'pattern', label: 'Rhyme pattern', options: [['aabb', 'Every two lines'], ['abab', 'Every other line'], ['auto', 'Let Plai pick']] },
    { id: 'density', label: 'Words per line', options: [['few', 'Few words, room to breathe'], ['mid', 'In between'], ['packed', 'Packed']] },
    { id: 'shape', label: 'Song shape', options: [['short', 'Short'], ['full', 'Full'], ['hook', 'Hook first']] },
    { id: 'speed', label: 'Speed', options: [['slow', 'Slow'], ['medium', 'Medium'], ['fast', 'Fast']] },
    { id: 'pov', label: 'Point of view', options: [['you', 'I sing to you'], ['them', 'I sing about them'], ['we', 'We'], ['story', "Tell someone else's story"]] },
  ];

  var RHYMES = {
    day: ['way', 'stay', 'play', 'say'],
    way: ['day', 'stay', 'play'],
    stay: ['day', 'way', 'play'],
    play: ['day', 'stay', 'way'],
    cup: ['up'],
    up: ['cup'],
    stop: ['top', 'drop'],
    top: ['stop', 'drop'],
    light: ['bright', 'sight'],
    bright: ['light', 'sight'],
    heart: ['start', 'part'],
    home: ['roam'],
    you: ['true', 'blue'],
    me: ['be', 'free', 'see'],
    go: ['show', 'know'],
    know: ['go', 'show'],
    love: ['glove'],
    time: ['rhyme', 'climb'],
    fire: ['higher'],
    night: ['light', 'bright'],
  };

  var FEEL_COLOR = {
    Joy: '#F5C542',
    Heartbreak: '#9B8CFF',
    Hype: '#FF3C8E',
    Longing: '#5B8CFF',
    Anger: '#FF5A36',
    Pride: '#F5C542',
    Peace: '#3DDC97',
    Nostalgia: '#C084FC',
    Funny: '#FF8A3D',
  };

  function fresh() {
    return {
      screen: 'hall',
      history: [],
      mode: '',
      path: '',
      label: '',
      addressee: '',
      addresseeNote: '',
      story: '',
      storyId: '',
      feelings: [],
      moreFeelings: false,
      spice: '',
      title: '',
      titleHelp: false,
      titleQ: '',
      detailTitle: '',
      scene: '',
      sceneQ: '',
      detail: '',
      genre: '',
      language: 'English',
      explicit: 'Clean',
      vibe: '',
      advanced: {},
      advancedOpen: false,
      chorus: '',
      verse: '',
      lyrics: '',
      song: null,
      points: 0,
      awarded: {},
      checksHit: {},
      notice: '',
      offers: [],
      rushed: false,
      gentle: false,
      seed: 1,
      versions: [],
      styleTweak: '',
      shareOpen: false,
      moreOpen: false,
      clockOpen: false,
      appEditor: false,
      best: 0,
    };
  }

  function copyState(state) {
    return Object.assign({}, state, {
      feelings: (state.feelings || []).slice(),
      history: (state.history || []).slice(),
      advanced: Object.assign({}, state.advanced || {}),
      awarded: Object.assign({}, state.awarded || {}),
      checksHit: Object.assign({}, state.checksHit || {}),
      offers: (state.offers || []).slice(),
      versions: (state.versions || []).slice(),
    });
  }

  function go(state, next) {
    var copy = copyState(state);
    if (state.screen && state.screen !== 'hall' && state.screen !== next && !state.awarded[state.screen]) {
      copy.points += POINTS_SCREEN;
      copy.awarded[state.screen] = true;
    }
    if (state.screen && state.screen !== next) copy.history = (state.history || []).concat(state.screen);
    copy.screen = next;
    copy.notice = '';
    copy.offers = [];
    return arrive(copy);
  }

  function arrive(state) {
    if ((state.screen === 'a10h' || state.screen === 'a10t') && !state.chorus && state.title) {
      state.chorus = state.title;
    }
    if (state.screen === 'a10v' && !state.verse) state.verse = '';
    return awardChecks(state);
  }

  function nextId(state) {
    var id = state.screen;
    if (id === 'a1') return state.mode === 'fix' ? 'fix-soon' : 'a2';
    if (id === 'a2') return 'a3';
    if (id === 'a3') return state.addressee && state.addressee !== 'else' ? 'a4' : 'a5';
    if (id === 'a4') return 'a5';
    if (id === 'a5') return !state.skipFeelings && state.feelings.indexOf('Funny') !== -1 ? 'a5s' : 'a6';
    if (id === 'a5s') return 'a6';
    if (id === 'a6') return state.title ? 'a6w' : 'a7';
    if (id === 'a6w') return 'a7';
    if (id === 'a7') return needsDetail(state) ? 'a7x' : 'a8';
    if (id === 'a7x') return 'a8';
    if (id === 'a8') return 'a9';
    if (id === 'a9') return a10(state);
    if (id === 'a10h') return 'a10v';
    if (id === 'a10v' || id === 'a10t' || id === 'a10a') return 'reveal';
    return 'hall';
  }

  function a10(state) {
    if (state.path === 'human') return 'a10h';
    if (state.path === 'together') return 'a10t';
    return 'a10a';
  }

  function needsDetail(state) {
    var words = String(state.scene || '').trim().split(/\s+/).filter(Boolean);
    return words.length > 0 && words.length < 5;
  }

  function awardChecks(state) {
    var copy = state;
    var rows = craftChecks(state);
    rows.forEach(function (row) {
      if (row.on && !copy.checksHit[row.id]) {
        copy = copyState(copy);
        copy.points += POINTS_CHECK;
        copy.checksHit[row.id] = true;
      }
    });
    return copy;
  }

  function craftChecks(state) {
    var chorus = String(state.chorus || '');
    var title = String(state.title || '').trim();
    var picture = /\b(cup|bus|stop|hand|road|light|porch|phone|key|kitchen|street|room)\b/i.test(chorus + ' ' + state.scene);
    return [
      { id: 'title', label: 'Title in the chorus', on: !!(title && chorus.toLowerCase().indexOf(title.toLowerCase()) !== -1) },
      { id: 'repeat', label: 'Title repeats', on: !!(title && occurrences(chorus, title) >= 2) },
      { id: 'you', label: 'You is in there', on: /\byou\b/i.test(chorus) },
      { id: 'picture', label: 'One real picture', on: picture && chorus.length > 0 },
    ];
  }

  function occurrences(hay, needle) {
    if (!needle) return 0;
    var n = 0;
    var at = 0;
    var low = hay.toLowerCase();
    var bit = needle.toLowerCase();
    while (at >= 0) {
      at = low.indexOf(bit, at);
      if (at === -1) break;
      n += 1;
      at += bit.length;
    }
    return n;
  }

  function feelingList(state) {
    var first = FEEL_ORDER[state.storyId] || ['Joy', 'Heartbreak', 'Hype', 'Longing'];
    var rest = ALL_FEELINGS.filter(function (name) { return first.indexOf(name) === -1; });
    return state.moreFeelings ? first.concat(rest) : first.concat(['More feelings']);
  }

  function fitGenres(state) {
    var name = (state.feelings || [])[0] || '';
    return FIT[name] || ['Pop', 'Hip-hop'];
  }

  function vibeList(state) {
    var feelings = state.feelings || [];
    var list;
    if (feelings.indexOf('Heartbreak') !== -1 || feelings.indexOf('Longing') !== -1) list = ['Late night', 'Sad but dancing', 'Chill', 'Big and loud'];
    else if (feelings.indexOf('Hype') !== -1 || feelings.indexOf('Joy') !== -1) list = ['Party', 'Big and loud', 'Chill', 'Late night'];
    else list = ['Late night', 'Party', 'Chill', 'Big and loud'];
    if (state.genre === 'Gospel') list = list.concat(['Church']).slice(0, 4);
    else list = list.filter(function (name) { return name !== 'Church'; }).slice(0, 4);
    return list;
  }

  function tiles(rows, onId) {
    return rows.map(function (row) {
      return { id: row[0], label: row[1], small: row[2] || '', on: onId === row[0] };
    });
  }

  function brief(state) {
    var aim = 'I want this song to make them feel it.';
    if ((state.feelings || []).indexOf('Heartbreak') !== -1) aim = 'I want this song to make them cry.';
    if ((state.feelings || []).indexOf('Joy') !== -1) aim = 'I want this song to make them smile.';
    var advanced = state.advanced || {};
    return {
      title: state.title || 'Untitled',
      scene: [state.scene, state.detail].filter(Boolean).join('. '),
      addressee: state.addressee === 'else' ? (state.addresseeNote || '') : addresseeLabel(state.addressee),
      story: state.story || '',
      feelings: state.feelings || [],
      spice: state.spice || '',
      genre: state.genre || 'Pop',
      language: state.language || 'English',
      explicit: state.explicit || 'Clean',
      vibe: state.vibe || '',
      path: state.path || 'ai',
      seed: state.seed || 1,
      intent_private: aim,
      advanced: {
        delivery: advanced.delivery || '',
        rhymeTightness: advanced.rhyme || '',
        rhymePattern: advanced.pattern && advanced.pattern !== 'auto' ? advanced.pattern : '',
        density: advanced.density || '',
        shape: advanced.shape || '',
        speed: advanced.speed || '',
        pov: advanced.pov || '',
      },
    };
  }

  function addresseeLabel(id) {
    var row = A3.filter(function (item) { return item[0] === id; })[0];
    return row ? row[1] : '';
  }

  function quote(wallet) {
    var freeLeft = wallet && wallet.freeLeft > 0 ? wallet.freeLeft : 0;
    var credits = wallet && wallet.credits > 0 ? wallet.credits : 0;
    if (freeLeft > 0) return { ok: true, free: true, label: 'free' };
    if (credits > 0) return { ok: true, free: false, label: '1 credit' };
    return { ok: false, free: false, label: '1 credit', error: 'That takes 1 credit.' };
  }

  function charge(wallet) {
    var current = { freeLeft: (wallet && wallet.freeLeft) || 0, credits: (wallet && wallet.credits) || 0 };
    var price = quote(current);
    if (!price.ok) return null;
    if (price.free) return { freeLeft: current.freeLeft - 1, credits: current.credits };
    return { freeLeft: current.freeLeft, credits: current.credits - 1 };
  }

  function buttonPrice(wallet, verb) {
    var price = quote(wallet || { freeLeft: 1, credits: 0 });
    return verb + ' (' + price.label + ')';
  }

  function rhymesFor(word) {
    var key = String(word || '').toLowerCase().replace(/[^a-z]/g, '');
    if (!key) return [];
    if (RHYMES[key]) return RHYMES[key].slice();
    var tail = key.slice(-3);
    var found = [];
    Object.keys(RHYMES).forEach(function (name) {
      if (name !== key && name.slice(-3) === tail) found.push(name);
    });
    return found.slice(0, 6);
  }

  function scoreLine(state) {
    var points = state.points || 0;
    var best = state.best || 0;
    var shown = points.toLocaleString ? points.toLocaleString('en-US') : String(points);
    if (points > best) return 'New high score';
    return 'Score: ' + shown;
  }

  function styleLine(state) {
    var writer = getWriter();
    return writer.stylePrompt(brief(state), state.styleTweak || '');
  }

  function act(state, action) {
    var type = action && action.type;
    var id = action && action.id;
    var next = copyState(state);
    if (type === 'back') {
      var prev = (next.history || []).pop();
      next.history = (state.history || []).slice(0, -1);
      next.screen = prev || 'hall';
      next.notice = '';
      return next;
    }
    if (type === 'quit') {
      next.screen = 'hall';
      next.notice = '';
      return next;
    }
    if (type === 'text') {
      if (action.field && Object.prototype.hasOwnProperty.call(next, action.field)) next[action.field] = String(action.value || '');
      return awardChecks(next);
    }
    if (type === 'skip') {
      if (next.screen === 'a8') return next;
      if (next.screen === 'a1') next.mode = 'fresh';
      if (next.screen === 'a2') {
        next.path = 'ai';
        next.label = 'Fully AI';
      }
      if (next.screen === 'a5') next.skipFeelings = true;
      if (['a3', 'a4', 'a5', 'a5s', 'a6', 'a7', 'a7x', 'a9'].indexOf(next.screen) !== -1) next.rushed = true;
      return go(next, nextId(next));
    }
    if (type === 'next') {
      if (next.screen === 'a3' && next.addressee === 'else' && !String(next.addresseeNote || '').trim()) {
        next.notice = 'Type who you are singing to, or skip.';
        return next;
      }
      if (next.screen === 'a6' && next.titleHelp) {
        var answered = String(next.detailTitle || next.scene || '').trim();
        if (!answered) {
          next.notice = 'A few words is enough.';
          return next;
        }
        next.title = answered;
      }
      if (next.screen === 'a8' && !next.genre) {
        next.notice = 'Pick the sound.';
        return next;
      }
      return go(next, nextId(next));
    }
    if (type === 'tile') return pickTile(next, id);
    if (type === 'chip') {
      if (action.group === 'language') next.language = id;
      if (action.group === 'explicit') next.explicit = id;
      return next;
    }
    if (type === 'advanced-toggle') {
      next.advancedOpen = !next.advancedOpen;
      return next;
    }
    if (type === 'advanced') {
      next.advanced[action.group] = id;
      return next;
    }
    if (type === 'question') {
      next.sceneQ = id;
      next.titleQ = id;
      return next;
    }
    if (type === 'idea') {
      next.title = id;
      next.titleHelp = false;
      return next;
    }
    if (type === 'offer') {
      next.offers = (action.lines || []).slice();
      return next;
    }
    if (type === 'keep') {
      var line = String(action.line || '').trim();
      if (!line) return next;
      var field = next.screen === 'a10v' ? 'verse' : 'chorus';
      next[field] = (next[field] ? next[field] + '\n' : '') + line;
      next.offers = [];
      if (next.label === 'Human') {
        next.label = 'AI-assisted';
        next.notice = 'You kept my line, so this is AI-assisted now.';
      }
      return awardChecks(next);
    }
    if (type === 'finish-apply') {
      var target = next.screen === 'a10v' ? 'verse' : 'chorus';
      next[target] = String(action.line || '');
      if (next.label === 'Human') {
        next.label = 'AI-assisted';
        next.notice = 'You kept my line, so this is AI-assisted now.';
      }
      return awardChecks(next);
    }
    if (type === 'wrote') {
      next.song = action.song;
      next.lyrics = action.song && action.song.text || '';
      next.label = 'Fully AI';
      next.versions = (next.versions || []).concat([{ label: 'Fully AI', text: next.lyrics }]);
      return go(next, 'reveal');
    }
    if (type === 'tweak') {
      next.styleTweak = id;
      return next;
    }
    if (type === 'share') {
      next.shareOpen = !next.shareOpen;
      return next;
    }
    if (type === 'more') {
      next.moreOpen = !next.moreOpen;
      return next;
    }
    if (type === 'clock') {
      next.clockOpen = !next.clockOpen;
      return next;
    }
    if (type === 'app-editor') {
      next.appEditor = !next.appEditor;
      return next;
    }
    if (type === 'more-feelings') {
      next.moreFeelings = true;
      return next;
    }
    return next;
  }

  function pickTile(state, id) {
    var screen = state.screen;
    if (screen === 'hall') {
      if (id === 'write') return go(state, 'a1');
      if (id === 'parody') return go(state, 'soon-parody');
      if (id === 'remix') return go(state, 'soon-remix');
    }
    if (screen === 'soon-parody' || screen === 'soon-remix' || screen === 'fix-soon') {
      if (id === 'fresh') {
        state.mode = 'fresh';
        return go(state, 'a2');
      }
      if (id === 'hall') return go(state, 'hall');
    }
    if (screen === 'a1') {
      state.mode = id === 'fix' ? 'fix' : 'fresh';
      return go(state, nextId(state));
    }
    if (screen === 'a2') {
      state.path = id;
      state.label = id === 'human' ? 'Human' : (id === 'together' ? 'AI-assisted' : 'Fully AI');
      return go(state, 'a3');
    }
    if (screen === 'a3') {
      state.addressee = id;
      if (id !== 'else') return go(state, nextId(state));
      return state;
    }
    if (screen === 'a4') {
      if (id === 'else') {
        state.storyId = 'else';
        return state;
      }
      var pack = A4[state.addressee] || A4.love;
      var chosen = (pack.tiles || []).filter(function (row) { return row[0] === id; })[0];
      state.storyId = id;
      state.story = chosen ? chosen[1] : '';
      state.gentle = !!(pack.gentleOn && pack.gentleOn === id);
      return go(state, 'a5');
    }
    if (screen === 'a5') {
      if (id === 'more') {
        state.moreFeelings = true;
        return state;
      }
      var has = state.feelings.indexOf(id);
      if (has !== -1) state.feelings.splice(has, 1);
      else if (state.feelings.length < 2) state.feelings.push(id);
      else state.notice = 'Pick up to 2.';
      return state;
    }
    if (screen === 'a5s') {
      state.spice = id;
      return go(state, 'a6');
    }
    if (screen === 'a6') {
      if (id === 'later') {
        state.titleHelp = true;
        return state;
      }
    }
    if (screen === 'a9') {
      state.vibe = id;
      return state;
    }
    if (screen === 'a8') {
      state.genre = id;
      return state;
    }
    return state;
  }

  function view(state) {
    var id = state.screen;
    var base = {
      id: id,
      kicker: 'Write or fix my song',
      plai: '',
      note: '',
      tiles: [],
      skip: id !== 'hall' && id !== 'a8' && id !== 'reveal' && id.indexOf('soon') !== 0 && id !== 'fix-soon',
      next: false,
      box: null,
      chips: [],
      advanced: null,
      rhyme: false,
      checks: [],
      label: state.label || '',
      points: state.points || 0,
      notice: state.notice || '',
      offers: state.offers || [],
      gentle: !!state.gentle,
    };
    if (id === 'hall') {
      base.kicker = 'Song Helper';
      base.plai = "Pick a machine. I'll host.";
      base.skip = false;
      base.tiles = [
        { id: 'write', label: 'Write or fix my song', small: 'Start fresh or tune one up' },
        { id: 'parody', label: 'Make a parody', small: 'Poke fun at a famous song', sticker: 'NEW', soon: true },
        { id: 'remix', label: 'Remix my song', small: 'Your song, new genre', soon: true },
      ];
      return base;
    }
    if (id === 'soon-parody' || id === 'soon-remix' || id === 'fix-soon') {
      base.skip = false;
      base.plai = id === 'fix-soon'
        ? 'Fixing a song is coming soon. You can start fresh now.'
        : 'Coming soon.';
      base.note = id === 'soon-parody'
        ? 'Make a parody is next. Poke fun at a famous song.'
        : (id === 'soon-remix' ? 'Remix my song is next. Your song, new genre.' : '');
      base.tiles = [
        { id: 'fresh', label: 'Start fresh' },
        { id: 'hall', label: 'Back to the machines' },
      ];
      return base;
    }
    if (id === 'a1') {
      base.plai = 'Starting fresh or fixing one?';
      base.tiles = [
        { id: 'fresh', label: 'Starting fresh', on: state.mode === 'fresh' },
        { id: 'fix', label: 'Fixing a song I wrote', on: state.mode === 'fix' },
      ];
      return base;
    }
    if (id === 'a2') {
      base.plai = 'How do you want to write it?';
      base.tiles = [
        { id: 'human', label: "I'll write, coach me", small: 'Human' },
        { id: 'together', label: "Let's write it together", small: 'AI-assisted' },
        { id: 'ai', label: 'Write it for me', small: 'Fully AI' },
      ];
      return base;
    }
    if (id === 'a3') {
      base.plai = 'Who are you singing to?';
      base.tiles = A3.map(function (row) {
        return { id: row[0], label: row[1], on: state.addressee === row[0] };
      });
      if (state.addressee === 'else') {
        base.box = { field: 'addresseeNote', value: state.addresseeNote || '', placeholder: 'Who is it?', rows: 2 };
        base.next = 'Next';
      }
      return base;
    }
    if (id === 'a4') {
      var pack = A4[state.addressee] || A4.love;
      base.plai = pack.plai;
      if (state.gentle) base.note = "We'll go slow.";
      base.tiles = pack.tiles.map(function (row) {
        return { id: row[0], label: row[1], on: state.storyId === row[0] };
      }).concat([{ id: 'else', label: 'Something else', on: state.storyId === 'else' }]);
      if (state.storyId === 'else') {
        base.box = { field: 'story', value: state.story || '', placeholder: 'Your own answer', rows: 2 };
        base.next = 'Next';
      }
      return base;
    }
    if (id === 'a5') {
      base.plai = state.gentle
        ? "We'll go slow. How should they feel when they hear it?"
        : 'How should they feel when they hear it?';
      base.note = 'Pick up to 2.';
      base.tiles = feelingList(state).map(function (name) {
        if (name === 'More feelings') return { id: 'more', label: 'More feelings' };
        return { id: name, label: name, on: state.feelings.indexOf(name) !== -1 };
      });
      base.next = 'Next';
      return base;
    }
    if (id === 'a5s') {
      base.plai = 'How spicy?';
      base.tiles = [
        { id: 'friendly', label: 'Friendly' },
        { id: 'sharp', label: 'Sharp but fair' },
        { id: 'full', label: 'Full send' },
      ];
      return base;
    }
    if (id === 'a6') {
      base.plai = state.titleQ === 'place'
        ? 'Where does this title live?'
        : (state.titleQ === 'who' ? 'Who is it for?' : (state.titleQ === 'thing' ? 'What were you holding?' : 'Got a title or a line stuck in your head?'));
      base.box = {
        field: state.titleHelp ? 'detailTitle' : 'title',
        value: state.titleHelp ? (state.detailTitle || '') : (state.title || ''),
        placeholder: state.titleHelp ? 'A few words' : 'Your title',
        rows: 2,
      };
      base.tiles = state.titleHelp ? [] : [{ id: 'later', label: 'Not yet' }];
      base.questions = [
        { id: 'place', label: 'Where does this title live?' },
        { id: 'who', label: 'Who is it for?' },
        { id: 'thing', label: 'What were you holding?' },
      ];
      base.ideas = ['Bus stop Sunday', 'Paper cup', 'Salt on the seat'];
      base.next = 'Next';
      return base;
    }
    if (id === 'a6w') {
      base.plai = "That's a title. Now we prove it.";
      base.marquee = state.title;
      base.color = FEEL_COLOR[state.feelings[0]] || '#F5C542';
      base.next = 'Next';
      return base;
    }
    if (id === 'a7' || id === 'a7x') {
      var prompts = {
        where: 'Where were you?',
        who: 'Who was there?',
        said: 'What did someone say?',
        held: 'What were you holding?',
      };
      base.plai = id === 'a7x'
        ? 'Where were you standing?'
        : (prompts[state.sceneQ] || 'Take me there. Where were you, and what happened?');
      base.box = {
        field: id === 'a7x' ? 'detail' : 'scene',
        value: id === 'a7x' ? (state.detail || '') : (state.scene || ''),
        placeholder: '1 to 3 lines',
        rows: 4,
      };
      base.questions = id === 'a7' ? [
        { id: 'where', label: 'Where were you?' },
        { id: 'who', label: 'Who was there?' },
        { id: 'said', label: 'What did someone say?' },
        { id: 'held', label: 'What were you holding?' },
      ] : [];
      base.next = 'Next';
      return base;
    }
    if (id === 'a8') {
      var fits = fitGenres(state);
      base.plai = 'Pick the sound.';
      base.skip = false;
      base.tiles = ['Hip-hop', 'R&B', 'Pop', 'Country', 'Afrobeats', 'Reggaeton', 'Reggae', 'Rock', 'Gospel', 'House', 'Surprise me'].map(function (name) {
        return {
          id: name,
          label: name,
          on: state.genre === name,
          badge: fits.indexOf(name) !== -1 ? 'Fits your song' : '',
        };
      });
      base.note = state.genre ? (GENRE_TIP[state.genre] || '') : '';
      base.chips = [
        { group: 'language', label: 'Language: ' + (state.language || 'English'), options: ['English', 'Spanish', 'Spanglish'], value: state.language || 'English' },
        { group: 'explicit', label: state.explicit || 'Clean', options: ['Clean', 'Explicit'], value: state.explicit || 'Clean' },
      ];
      base.next = 'Next';
      return base;
    }
    if (id === 'a9') {
      base.plai = 'Pick the vibe.';
      base.tiles = vibeList(state).map(function (name) {
        return { id: name, label: name, on: state.vibe === name };
      });
      base.advanced = { open: !!state.advancedOpen, groups: ADVANCED, value: state.advanced || {} };
      base.next = 'Next';
      return base;
    }
    if (id === 'a10a') {
      base.plai = 'Ready? I will use everything you told me.';
      if (state.rushed) base.note = 'The more you tell me, the more it sounds like you.';
      base.write = true;
      base.skip = true;
      return base;
    }
    if (id === 'a10h' || id === 'a10t' || id === 'a10v') {
      var writingVerse = id === 'a10v';
      base.plai = writingVerse
        ? 'Now verse 1. Lead us to the title.'
        : 'Write your chorus. Your title is already in.';
      var q = {
        why: 'Why does this title matter?',
        feel: 'What do you want them to feel?',
        again: 'Say it again, differently',
      };
      if (!writingVerse && q[state.titleQ]) base.plai = q[state.titleQ];
      base.box = {
        field: writingVerse ? 'verse' : 'chorus',
        value: writingVerse ? (state.verse || '') : (state.chorus || ''),
        placeholder: writingVerse ? 'Verse 1' : 'Chorus',
        rows: 6,
      };
      base.questions = writingVerse ? [] : [
        { id: 'why', label: 'Why does this title matter?' },
        { id: 'feel', label: 'What do you want them to feel?' },
        { id: 'again', label: 'Say it again, differently' },
      ];
      base.rhyme = true;
      base.checks = craftChecks(state);
      base.together = id === 'a10t';
      base.next = writingVerse ? 'Done' : 'Verse 1';
      return base;
    }
    if (id === 'reveal') {
      base.kicker = 'High score';
      base.plai = '';
      base.skip = false;
      base.marquee = state.title || 'Untitled';
      base.color = FEEL_COLOR[(state.feelings || [])[0]] || '#F5C542';
      base.scoreLine = scoreLine(state);
      base.lyrics = state.lyrics || '';
      base.checks = craftChecks(state).filter(function (row) { return row.on; });
      base.style = styleLine(state);
      base.tweaks = [
        { id: 'more-energy', label: 'More energy' },
        { id: 'softer', label: 'Softer' },
        { id: 'different-voice', label: 'Different voice' },
        { id: 'more-instruments', label: 'More instruments' },
      ];
      base.moreOpen = !!state.moreOpen;
      base.shareOpen = !!state.shareOpen;
      base.clockOpen = !!state.clockOpen;
      base.versions = state.versions || [];
      base.more = moreOffers(state);
      return base;
    }
    return base;
  }

  function moreOffers(state) {
    var human = state.path === 'human';
    return [
      { id: 'verse2', label: 'Verse 2', free: human },
      { id: 'bridge', label: 'Bridge', note: 'What have you never told them?', free: human },
      { id: 'close', label: 'Closing line', note: 'What do you know now?', free: human },
      { id: 'line', label: 'Give me a line', credit: !human },
      { id: 'finish', label: 'Finish my line', credit: !human },
      { id: 'version', label: 'Write another version', credit: true },
    ];
  }

  function visibleText(node) {
    return JSON.stringify(node || {});
  }

  return {
    POINTS_SCREEN: POINTS_SCREEN,
    POINTS_CHECK: POINTS_CHECK,
    ADVANCED: ADVANCED,
    fresh: fresh,
    act: act,
    view: view,
    brief: brief,
    quote: quote,
    charge: charge,
    buttonPrice: buttonPrice,
    rhymesFor: rhymesFor,
    craftChecks: craftChecks,
    nextId: nextId,
    scoreLine: scoreLine,
    styleLine: styleLine,
    visibleText: visibleText,
    fitGenres: fitGenres,
    GENRE_TIP: GENRE_TIP,
  };
});
