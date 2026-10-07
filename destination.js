(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DestinationCore = api;
  if (typeof document !== 'undefined' && document.getElementById('dest-app')) api.mount(document);
})(typeof window !== 'undefined' ? window : globalThis, function () {
  var root = typeof window !== 'undefined' ? window : globalThis;
  var STORAGE_KEY = 'plaigroundDestinationPlan';
  var NOTE_LIMIT = 240;
  var GENRES = ['Hip-Hop', 'R&B/Soul', 'Pop', 'Rock', 'Country', 'Electronic', 'Latin', 'Gospel', 'Jazz', 'Afrobeats', 'Alternative', 'Dance'];
  var COUNTS = { '1': true, '2-5': true, '6+': true, label: true };

  var SONGS = {
    idea: { id: 'idea', label: 'Just an idea', from: 'an idea' },
    made: { id: 'made', label: "It's made", from: 'a made song' },
    out: { id: 'out', label: "It's out", from: "a song that's out" }
  };

  var GOALS = {
    money: { id: 'money', label: 'Make money' },
    fanbase: { id: 'fanbase', label: 'Build a fanbase' },
    release: { id: 'release', label: 'Just release it right' }
  };

  var STATUS = {
    live: 'Live',
    soon: 'Coming soon',
    ask: 'Ask us',
    apply: 'By application'
  };

  var STOPS = {
    helper: {
      id: 'helper',
      title: 'Song Helper',
      face: 'plai',
      status: 'soon',
      href: '',
      link: '',
      what: 'Help for the idea stage: write, Flip it, Funkify it, Make it funny, Mad Libs, and Battle. Coming soon, until the writer connection is wired.',
      get: 'A draft you can shape, once this is live. People check the work.',
      who: 'PLAI on the AI team. People check the work.',
      why: {
        money: 'A finished song is what can earn.',
        fanbase: 'Fans show up for a song they can hear.',
        release: 'A release needs a song, even if today it is only an idea.'
      }
    },
    cover: {
      id: 'cover',
      title: 'Cover Art',
      face: 'plai',
      status: 'soon',
      href: '',
      link: '',
      what: 'Cover art with themes, made for this song.',
      get: 'Artwork for the release, once this is live. People check the work.',
      who: 'The AI team drafts it. People check the work.',
      why: {
        money: 'The cover is what a buyer sees first.',
        fanbase: 'A cover gives the song a face people remember.',
        release: 'Stores ask for art with the song.'
      }
    },
    check: {
      id: 'check',
      title: 'Song check',
      face: 'scout',
      status: 'live',
      href: '/ar',
      link: 'Song check',
      what: 'Scout listens and tells you what is working, what to fix, and who it is for.',
      get: 'Honest notes on your song. People check the work.',
      who: 'Scout on the AI team. People check the work.',
      why: {
        money: 'A clearer song is easier to sell and to license.',
        fanbase: 'You learn who the song is for before you ask anyone to follow.',
        release: 'A song check is how the release stays honest.'
      }
    },
    persona: {
      id: 'persona',
      title: 'Persona + EPK',
      face: 'scoop',
      status: 'live',
      href: '/epk',
      link: 'EPK',
      what: 'A persona, a short bio, and a press kit for the act.',
      get: 'A page a blog, venue, or curator can read. People check the work.',
      who: 'Scoop on the AI team. People check the work.',
      why: {
        money: 'Partners need a name and a story before they pay.',
        fanbase: 'A bio gives fans a place to land.',
        release: 'The act needs a name and a bio with the song.'
      }
    },
    distro: {
      id: 'distro',
      title: 'Distribution',
      face: 'drop',
      status: 'live',
      href: '/how-it-works.html#distribute',
      link: 'Distribution',
      what: 'The release goes to the major stores.',
      get: 'Your song on the stores. People check the work.',
      who: 'Drop on the AI team. People check the work.',
      why: {
        money: 'Store royalties start after the song is on the stores.',
        fanbase: 'Fans look for the song where they already listen.',
        release: 'Distribution is how the song gets to the stores.'
      }
    },
    royalties: {
      id: 'royalties',
      title: 'How you get paid',
      face: 'plai',
      status: 'live',
      href: '/royalties.html',
      link: 'How you get paid',
      what: 'Store royalties land in the dashboard. PLAIGROUND does not take a cut of them.',
      get: 'A clear picture of payment. People check the work.',
      who: 'The AI team keeps the books in view. People check the work.',
      why: {
        money: 'This is how money from the stores reaches you.',
        fanbase: 'When fans play the song, this is where that money shows up.',
        release: 'A proper release includes how you get paid.'
      }
    },
    qualify: {
      id: 'qualify',
      title: 'Qualify my song',
      face: 'plai',
      status: 'live',
      href: '/qualify',
      link: 'Qualify my song',
      what: 'A short check for the AI lane: what a person wrote, and what was generated.',
      get: 'One of three reads, and the next step. People check the work.',
      who: 'You answer for this song. People check the work.',
      why: {
        money: 'Human authorship is what can be registered and licensed.',
        fanbase: 'A clear read helps when the song is already getting plays.',
        release: 'Know the gap before the song goes out.'
      }
    },
    makehuman: {
      id: 'makehuman',
      title: 'Make it human',
      face: 'plai',
      status: 'live',
      href: '/make-human',
      link: 'Make it human',
      what: 'Human re-sing, a new human master, or a sync-ready package.',
      get: 'A record labels, supervisors and distributors can clear. People do this work.',
      who: 'People sing, play, and write. People check the work.',
      why: {
        money: 'A human recording and a human composition are what can earn.',
        fanbase: 'Listeners can meet a voice a person sang.',
        release: 'Sort the human pass before the song goes out.'
      }
    },
    contracts: {
      id: 'contracts',
      title: 'Contracts',
      face: 'plai',
      status: 'live',
      href: '/contracts',
      link: 'Contracts',
      what: 'Read a contract, mark it up, or start a fair draft.',
      get: 'A plain read or a draft you can copy. People check the work.',
      who: 'You bring the contract. People check the work.',
      why: {
        money: 'A clear contract is how the money stays yours.',
        fanbase: 'A clear contract keeps the song yours when you share it.',
        release: 'Sort the paper before the song goes out.'
      }
    },
    copyright: {
      id: 'copyright',
      title: 'Copyright & publishing',
      face: 'plai',
      status: 'live',
      href: '/copyright',
      link: 'Copyright & publishing',
      what: 'For this song: which parts a person made, then the publishing steps.',
      get: 'A note saved on this release. People check the work.',
      who: 'You answer for this song. People check the work.',
      why: {
        money: 'The parts a person made are what can earn.',
        fanbase: 'A clear note helps when you share the song.',
        release: 'Sort copyright and publishing out before the song goes out.'
      }
    },
    publishing: {
      id: 'publishing',
      title: 'Publishing and splits',
      face: 'plai',
      status: 'live',
      href: '/publishing.html',
      link: 'Publishing',
      what: 'Register the composition and the splits, under a separate publishing agreement.',
      get: 'Credit and shares on file. People check the work.',
      who: 'The AI team drafts the paperwork. People check the work.',
      why: {
        money: 'Splits decide who gets paid when the song earns.',
        fanbase: 'Credit stays clear as more people share the song.',
        release: 'A right release names the writers and the shares.'
      }
    },
    pitch: {
      id: 'pitch',
      title: 'Playlist and blog pitching',
      face: 'pitch',
      status: 'soon',
      href: '',
      link: '',
      what: 'Pitches to playlists and blogs. No placement promise.',
      get: 'A pitch you can send, once this is live. No placement promise.',
      who: 'Pitch on the AI team. People check the work.',
      why: {
        money: 'A playlist or a blog can send people who stream the song.',
        fanbase: 'New listeners often meet a song on a playlist or a blog.',
        release: 'After the song is out, pitching is one way more people hear it.'
      }
    },
    sync: {
      id: 'sync',
      title: 'Sync pitching',
      face: 'plai',
      status: 'live',
      href: '/#pricing',
      link: 'Sync package',
      what: 'Packages for film, TV, games, and ads. No placement promise.',
      get: 'A sync package. No placement promise. People check the work.',
      who: 'The AI team builds the package. People check the work.',
      why: {
        money: 'A license is another way the song can earn.',
        fanbase: 'A film or a show can introduce the song to a new room.',
        release: 'The package is there if a brief comes in. No placement promise.'
      }
    },
    marketing: {
      id: 'marketing',
      title: 'Marketing plan',
      face: 'buzz',
      status: 'soon',
      href: '',
      link: '',
      what: 'A simple plan for posts around the release.',
      get: 'A written plan, once this is live. People check the work.',
      who: 'Buzz on the AI team. People check the work.',
      why: {
        money: 'The plan points attention at the song that can earn.',
        fanbase: 'Posts give fans a reason to come back.',
        release: 'The song goes out with a plan beside it.'
      }
    },
    multiverse: {
      id: 'multiverse',
      title: 'Multiverse Album',
      face: 'plai',
      status: 'soon',
      href: '',
      link: '',
      what: 'One song flipped into several genres, released as one project.',
      get: 'Several versions in one project, once this is live. People check the work.',
      who: 'The AI team drafts the versions. People check the work.',
      why: {
        money: 'More versions give the song more ways to earn.',
        fanbase: 'Different rooms can meet the same song.',
        release: 'One project, several genres, still one release.'
      }
    },
    billboard: {
      id: 'billboard',
      title: 'Digital billboard',
      face: 'hw',
      status: 'ask',
      href: '',
      link: '',
      what: 'A digital billboard in LA, SF, or Times Square. The HW team handles it. Ask us.',
      get: 'A conversation with the HW team. People do this work.',
      who: 'The HW team. People, not a bot.',
      why: {
        money: 'A big screen can point a city at a song that earns.',
        fanbase: 'People in LA, SF, or Times Square can see the song.',
        release: 'A billboard is a human add-on after the release exists.'
      }
    },
    shows: {
      id: 'shows',
      title: 'Shows, features, and radio',
      face: 'hw',
      status: 'apply',
      href: '',
      link: '',
      what: 'Shows, features, and radio, run by the HW team.',
      get: 'A review by application. People do this work.',
      who: 'The HW team. People, not a bot.',
      why: {
        money: 'A show or a feature can open a paid room.',
        fanbase: 'A room, a feature, or radio is how fans meet you in person.',
        release: 'Live work sits beside the release, by application.'
      }
    }
  };

  var STOP_ORDER = [
    'helper', 'check', 'copyright', 'contracts', 'qualify', 'makehuman', 'cover', 'persona', 'distro', 'publishing', 'royalties',
    'sync', 'pitch', 'marketing', 'multiverse', 'billboard', 'shows'
  ];

  var RECOMMENDED = {
    'idea|money': ['helper', 'check', 'copyright', 'contracts', 'qualify', 'makehuman', 'persona', 'publishing', 'royalties', 'sync'],
    'idea|fanbase': ['helper', 'cover', 'persona', 'check', 'distro', 'pitch'],
    'idea|release': ['helper', 'check', 'copyright', 'contracts', 'qualify', 'makehuman', 'cover', 'persona', 'distro', 'publishing'],
    'made|money': ['check', 'copyright', 'contracts', 'qualify', 'makehuman', 'persona', 'distro', 'publishing', 'royalties', 'sync'],
    'made|fanbase': ['cover', 'persona', 'check', 'copyright', 'contracts', 'qualify', 'makehuman', 'distro', 'pitch', 'marketing'],
    'made|release': ['persona', 'check', 'copyright', 'contracts', 'qualify', 'makehuman', 'cover', 'distro'],
    'out|money': ['publishing', 'royalties', 'sync', 'check', 'copyright', 'contracts', 'qualify', 'makehuman'],
    'out|fanbase': ['persona', 'pitch', 'marketing', 'check', 'copyright', 'contracts', 'qualify', 'makehuman'],
    'out|release': ['check', 'copyright', 'contracts', 'qualify', 'makehuman', 'publishing', 'royalties']
  };

  var SECTIONS = [
    { id: 'make', label: 'Make it', stops: ['helper', 'cover', 'multiverse'] },
    { id: 'ready', label: 'Get ready', stops: ['check'] },
    { id: 'protect', label: 'Protect it', stops: ['copyright', 'contracts', 'qualify', 'makehuman'] },
    { id: 'put', label: 'Put it out', stops: ['distro', 'persona'] },
    { id: 'heard', label: 'Get heard', stops: ['pitch', 'marketing', 'billboard'] },
    { id: 'paid', label: 'Get paid', stops: ['royalties', 'publishing', 'sync'] },
    { id: 'run', label: 'Run it', stops: ['shows'] }
  ];

  var KITS = {
    release: {
      id: 'release',
      label: 'Release Kit',
      song: 'made',
      goal: 'release',
      stops: ['persona', 'check', 'copyright', 'contracts', 'qualify', 'makehuman', 'cover', 'distro']
    },
    record: {
      id: 'record',
      label: 'Break Your Record',
      song: 'out',
      goal: 'fanbase',
      stops: ['marketing', 'pitch', 'copyright', 'contracts', 'qualify', 'makehuman', 'sync', 'billboard']
    },
    management: {
      id: 'management',
      label: 'Management'
    }
  };

  function sectionsFor(stopIds) {
    var on = {};
    (stopIds || []).forEach(function (id) { on[id] = true; });
    var out = [];
    SECTIONS.forEach(function (section) {
      var stops = section.stops.filter(function (id) { return on[id] && STOPS[id]; });
      if (stops.length) out.push({ id: section.id, label: section.label, stops: stops });
    });
    return out;
  }

  function openSectionId(song, goal, stopIds) {
    var groups = sectionsFor(stopIds);
    var ids = groups.map(function (section) { return section.id; });
    var prefer = song === 'made' ? 'ready' : song === 'out' ? 'heard' : 'make';
    if (song === 'out' && goal === 'money') prefer = 'paid';
    if (song === 'out' && goal === 'release') prefer = 'put';
    if (ids.indexOf(prefer) !== -1) return prefer;
    if (goal === 'money' && ids.indexOf('paid') !== -1) return 'paid';
    if (goal === 'fanbase' && ids.indexOf('heard') !== -1) return 'heard';
    if (goal === 'release' && ids.indexOf('put') !== -1) return 'put';
    return ids[0] || prefer;
  }

  function recommendedIds(song, goal) {
    var list = RECOMMENDED[song + '|' + goal];
    return list ? list.slice() : [];
  }

  function packageTotal(managed) {
    return managed ? 'By application' : 'Free to start';
  }

  function applyKit(kitId, song, goal) {
    var kit = KITS[kitId];
    if (!kit) {
      return {
        kit: '',
        song: song,
        goal: goal,
        stops: recommendedIds(song, goal),
        managed: false,
        total: packageTotal(false)
      };
    }
    if (kitId === 'management') {
      var stops = recommendedIds(song, goal);
      if (stops.indexOf('shows') === -1) stops.push('shows');
      return {
        kit: 'management',
        song: song,
        goal: goal,
        stops: stops,
        managed: true,
        total: packageTotal(true)
      };
    }
    return {
      kit: kitId,
      song: kit.song,
      goal: kit.goal,
      stops: kit.stops.slice(),
      managed: false,
      total: packageTotal(false)
    };
  }

  function headsUp(stopIds, song, goal) {
    var notes = [];
    var on = {};
    (stopIds || []).forEach(function (id) { on[id] = true; });
    var base = {};
    recommendedIds(song, goal).forEach(function (id) { base[id] = true; });
    if (on.sync && !on.publishing) notes.push('Sync pitching needs splits registered first.');
    if (base.distro && !on.distro && song !== 'out') notes.push('Distribution is how this song gets to the stores.');
    if (goal === 'release' && base.check && !on.check) notes.push('A song check is how the release stays honest.');
    return notes;
  }

  function headline(song, goal) {
    var songRow = SONGS[song];
    var goalRow = GOALS[goal];
    if (!songRow || !goalRow) return 'Your route';
    return 'For ' + goalRow.label + ', starting from ' + songRow.from + ", here's your route.";
  }

  function joinNames(names) {
    if (!names.length) return '';
    if (names.length === 1) return names[0];
    if (names.length === 2) return names[0] + ' and ' + names[1];
    return names.slice(0, -1).join(', ') + ', and ' + names[names.length - 1];
  }

  function audienceLine(plan) {
    plan = plan || {};
    var count = '';
    if (plan.artistCount === '1') count = '1 artist';
    else if (plan.artistCount === '2-5') count = '2 to 5 artists';
    else if (plan.artistCount === '6+') count = '6+ artists';
    else if (plan.artistCount === 'label') count = 'label or manager';
    var genres = joinNames(packGenres(plan.genres, plan.genreOther));
    if (count && genres) return 'Plai built this for your ' + count + ' in ' + genres + '.';
    if (count) return 'Plai built this for your ' + count + '.';
    if (genres) return 'Plai built this for ' + genres + '.';
    return '';
  }

  function explain(id, goal) {
    var stop = STOPS[id];
    if (!stop) return null;
    return {
      id: stop.id,
      title: stop.title,
      face: stop.face,
      status: stop.status,
      statusLabel: STATUS[stop.status],
      who: stop.who,
      what: stop.what,
      get: stop.get,
      why: stop.why[goal] || '',
      href: stop.href,
      link: stop.link
    };
  }

  function isRecommended(id, song, goal, kit) {
    if (kit === 'release' || kit === 'record') return KITS[kit].stops.indexOf(id) !== -1;
    return recommendedIds(song, goal).indexOf(id) !== -1;
  }

  function clipNote(note) {
    return String(note || '').replace(/\s+/g, ' ').trim().slice(0, NOTE_LIMIT);
  }

  function packGenres(list, other) {
    var out = [];
    (Array.isArray(list) ? list : []).forEach(function (name) {
      if (GENRES.indexOf(name) !== -1 && out.indexOf(name) === -1) out.push(name);
    });
    var extra = String(other || '').replace(/,/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (extra && out.indexOf(extra) === -1) out.push(extra);
    return out;
  }

  function signupHref(plan) {
    var params = new URLSearchParams();
    params.set('plan', 'basic');
    params.set('song', plan.song || '');
    params.set('goal', plan.goal || '');
    params.set('stops', (plan.stops || []).join(','));
    var note = clipNote(plan.note);
    if (note) params.set('note', note);
    if (plan.kit) params.set('kit', plan.kit);
    if (COUNTS[plan.artistCount]) params.set('artistCount', plan.artistCount);
    var genres = packGenres(plan.genres, plan.genreOther);
    if (genres.length) params.set('genres', genres.join(','));
    return '/signup.html?' + params.toString();
  }

  function signedInFromProbe(result, hinted) {
    if (result && result.ok) return true;
    return !!hinted;
  }

  function planForEdit(serverRecord, localRecord) {
    var serverPlan = serverRecord && serverRecord.plan;
    if (serverPlan && serverPlan.song && serverPlan.goal) return serverPlan;
    if (localRecord && localRecord.song && localRecord.goal) return localRecord;
    return null;
  }

  function editRequested(search) {
    var raw = String(search || '');
    if (raw.charAt(0) === '?') raw = raw.slice(1);
    try {
      return new URLSearchParams(raw).get('edit') === '1';
    } catch (err) {
      return false;
    }
  }

  function planRecord(plan) {
    return {
      song: plan.song,
      goal: plan.goal,
      note: clipNote(plan.note),
      stops: (plan.stops || []).slice(),
      kit: plan.kit || '',
      managed: !!plan.managed,
      artistCount: COUNTS[plan.artistCount] ? plan.artistCount : '',
      genres: packGenres(plan.genres, plan.genreOther)
    };
  }

  function roadPath(points, shape, narrow) {
    if (!points || points.length < 2) return '';
    var bow = {
      streams: 88,
      sync: 156,
      press: 42,
      playlists: 124,
      profit: 30,
      fanbase: 102,
      route: 72
    }[shape] || 72;
    var flip = shape === 'sync' || shape === 'playlists' || shape === 'fanbase' ? -1 : 1;
    if (narrow) bow = Math.min(bow * 0.34, 42);
    var d = 'M ' + points[0].x + ' ' + points[0].y;
    for (var i = 0; i < points.length - 1; i++) {
      var a = points[i];
      var b = points[i + 1];
      var midY = (a.y + b.y) / 2;
      var dir = flip;
      if (shape !== 'press' && shape !== 'profit') dir = flip * (i % 2 === 0 ? 1 : -1);
      var c1x = a.x + bow * dir;
      var c2x = b.x + bow * dir * 0.35;
      d += ' C ' + round(c1x) + ' ' + round(midY) + ', ' + round(c2x) + ' ' + round(midY) + ', ' + round(b.x) + ' ' + round(b.y);
    }
    return d;
  }

  function round(n) {
    return Math.round(n * 10) / 10;
  }

  function mount(doc) {
    var app = doc.getElementById('dest-app');
    if (!app || app.getAttribute('data-mounted') === '1') return;
    app.setAttribute('data-mounted', '1');

    var state = {
      step: 1,
      song: '',
      goal: '',
      note: '',
      artistCount: '',
      genres: [],
      genreOther: '',
      kit: '',
      managed: false,
      routeSong: '',
      routeGoal: '',
      stopIds: [],
      editing: false,
      openSections: null
    };
    var title = doc.getElementById('dest-title');
    var help = doc.getElementById('dest-help');
    var stepLabel = doc.getElementById('dest-step-label');
    var next = doc.getElementById('dest-next');
    var back = doc.getElementById('dest-back');
    var actions = doc.getElementById('dest-actions');
    var go = doc.getElementById('dest-go');
    var map = doc.getElementById('dest-map');
    var heads = doc.getElementById('dest-heads');
    var extras = doc.getElementById('dest-extras');
    var extraList = doc.getElementById('dest-extra-list');
    var edit = doc.getElementById('dest-edit');
    var total = doc.getElementById('dest-total');
    var about = doc.getElementById('dest-about');
    var drawer = doc.getElementById('dest-drawer');
    var drawerTitle = doc.getElementById('dest-drawer-title');
    var drawerStatus = doc.getElementById('dest-drawer-status');
    var drawerWhat = doc.getElementById('dest-drawer-what');
    var drawerWhy = doc.getElementById('dest-drawer-why');
    var drawerFor = doc.getElementById('dest-drawer-for');
    var routeFor = doc.getElementById('dest-for');
    var drawerGet = doc.getElementById('dest-drawer-get');
    var drawerWho = doc.getElementById('dest-drawer-who');
    var drawerFace = doc.getElementById('dest-drawer-face');
    var drawerLink = doc.getElementById('dest-drawer-link');
    var drawerClose = doc.getElementById('dest-drawer-close');
    var lastFocus = null;
    var drawTimer = 0;
    var authKnown = false;
    var signedIn = false;
    var accountTimer = 0;

    var copy = {
      1: ["Where's your song?", 'Pick one. This is the start of the route.'],
      2: ['Where do you want to go?', 'Pick one goal. The note is optional.']
    };

    function applyPickedSong() {
      var stage = '';
      try {
        if (root.ArtistProfiles && typeof root.ArtistProfiles.pickedStage === 'function') {
          stage = root.ArtistProfiles.pickedStage();
        }
      } catch (err) {
        return;
      }
      if (!stage) return;
      var button = app.querySelector('[data-group="song"][data-value="' + stage + '"]');
      if (button) choose(button);
    }

    function selected(group) {
      var on = app.querySelector('[data-group="' + group + '"].on');
      return on ? on.getAttribute('data-value') : '';
    }

    function readNote() {
      if (!about) return;
      state.note = String(about.value || '').slice(0, NOTE_LIMIT);
    }

    function readMini() {
      readNote();
      var other = doc.getElementById('dest-genre-other');
      if (other) state.genreOther = String(other.value || '');
    }

    function paintCount() {
      app.querySelectorAll('[data-count]').forEach(function (el) {
        var on = el.getAttribute('data-count') === state.artistCount;
        el.classList.toggle('on', on);
        el.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }

    function paintGenres() {
      app.querySelectorAll('[data-genre]').forEach(function (el) {
        var on = state.genres.indexOf(el.getAttribute('data-genre')) !== -1;
        el.classList.toggle('on', on);
        el.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }

    function canContinue() {
      if (state.step === 1) return !!state.song;
      if (state.step === 2) return !!state.goal;
      return false;
    }

    function currentPlan() {
      return {
        song: state.routeSong,
        goal: state.routeGoal,
        note: state.note,
        stops: state.stopIds.slice(),
        kit: state.kit,
        managed: state.managed,
        artistCount: state.artistCount,
        genres: state.genres.slice(),
        genreOther: state.genreOther
      };
    }

    function save(plan, immediate) {
      var record = planRecord(plan);
      try {
        root.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
      } catch (err) {}
      persistAccount(record, !!immediate);
      return record;
    }

    function accountApi() {
      return root.PlaigroundRoadmapAccount || null;
    }

    function persistAccount(record, immediate) {
      var account = accountApi();
      if (!account || typeof account.savePlan !== 'function' || !signedIn) return;
      if (root.clearTimeout) root.clearTimeout(accountTimer);
      if (immediate) {
        account.savePlan(record, { immediate: true });
        return;
      }
      accountTimer = root.setTimeout(function () {
        account.savePlan(record, { immediate: true });
      }, 600);
    }

    function paintAccount(plan) {
      var box = doc.getElementById('dest-save');
      var savedNote = doc.getElementById('dest-saved');
      var signup = doc.getElementById('dest-save-signup');
      var login = doc.getElementById('dest-save-login');
      var endNote = doc.querySelector('.dest-end-note');
      var href = signupHref(plan || currentPlan());
      if (signup) signup.setAttribute('href', href);
      if (login) login.setAttribute('href', '/login');
      var showPrompt = authKnown && !signedIn && state.step === 3;
      var showSaved = authKnown && signedIn && state.step === 3;
      if (box) box.hidden = !showPrompt;
      if (savedNote) savedNote.hidden = !showSaved;
      if (go) go.setAttribute('href', showSaved ? '/my-roadmap' : href);
      if (endNote && state.step === 3 && authKnown) {
        endNote.textContent = signedIn
          ? 'Saved to your account. You can open it any time.'
          : 'This opens the free account. Your route comes along so the plan can be saved later.';
      }
    }

    function localPlan() {
      try {
        var raw = root.localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        if (!parsed || !parsed.song || !parsed.goal) return null;
        return parsed;
      } catch (err) {
        return null;
      }
    }

    function markGroup(group, value) {
      app.querySelectorAll('[data-group="' + group + '"]').forEach(function (el) {
        var on = el.getAttribute('data-value') === value;
        el.classList.toggle('on', on);
        el.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }

    function editMode() {
      try {
        return editRequested(root.location && root.location.search);
      } catch (err) {
        return false;
      }
    }

    function sessionHint() {
      var account = accountApi();
      if (account && typeof account.hasSession === 'function') {
        try {
          if (account.hasSession()) return true;
        } catch (err) {}
      }
      var membership = root.PlaigroundMembership;
      if (membership && typeof membership.isSignedIn === 'function') {
        try {
          return !!membership.isSignedIn();
        } catch (err2) {}
      }
      return false;
    }

    function applySavedPlan(plan, options) {
      if (!plan || !plan.song || !plan.goal) return;
      var genres = [];
      var other = plan.genreOther || '';
      (plan.genres || []).forEach(function (name) {
        if (GENRES.indexOf(name) !== -1) {
          if (genres.indexOf(name) === -1) genres.push(name);
        } else if (!other) other = name;
      });
      state.song = plan.song;
      state.goal = plan.goal;
      state.note = plan.note || '';
      state.artistCount = plan.artistCount || '';
      state.genres = genres;
      state.genreOther = other;
      state.kit = plan.kit || '';
      state.managed = !!plan.managed;
      state.routeSong = plan.song;
      state.routeGoal = plan.goal;
      state.stopIds = (plan.stops || []).filter(function (id) { return !!STOPS[id]; });
      state.editing = !!(options && options.editing);
      state.openSections = null;
      state.step = 3;
      if (about) about.value = state.note;
      var otherInput = doc.getElementById('dest-genre-other');
      if (otherInput) otherInput.value = other;
      markGroup('song', state.song);
      markGroup('goal', state.goal);
      paintCount();
      paintGenres();
      showStep();
    }

    function avatarNode(face) {
      var src = doc.getElementById('avatar-' + face);
      var wrap = doc.createElement('span');
      wrap.className = 'dest-avatar';
      wrap.setAttribute('aria-hidden', 'true');
      if (src && src.firstElementChild) wrap.appendChild(src.firstElementChild.cloneNode(true));
      return wrap;
    }

    function statusNode(status) {
      var badge = doc.createElement('span');
      badge.className = 'dest-badge dest-badge-' + status;
      badge.textContent = STATUS[status] || '';
      return badge;
    }

    function stopButton(id, goal, kit) {
      var info = explain(id, goal);
      var button = doc.createElement('button');
      button.type = 'button';
      button.className = 'dest-stop-open';
      button.setAttribute('data-open', id);
      var main = doc.createElement('span');
      main.className = 'dest-stop-copy';
      var top = doc.createElement('span');
      top.className = 'dest-stop-top';
      var name = doc.createElement('span');
      name.className = 'dest-stop-title';
      name.textContent = info.title;
      top.appendChild(name);
      top.appendChild(statusNode(info.status));
      var why = doc.createElement('span');
      why.className = 'dest-why';
      why.textContent = info.why;
      main.appendChild(top);
      main.appendChild(why);
      if (isRecommended(id, state.routeSong, goal, kit)) {
        var tag = doc.createElement('span');
        tag.className = 'dest-rec';
        tag.textContent = 'Recommended for your goal';
        main.appendChild(tag);
      }
      button.appendChild(avatarNode(info.face));
      button.appendChild(main);
      return button;
    }

    function showStep() {
      [1, 2, 3].forEach(function (n) {
        var section = doc.getElementById('dest-step-' + n);
        if (section) section.hidden = n !== state.step;
      });
      if (stepLabel) stepLabel.textContent = 'Step ' + state.step + ' of 3';
      if (actions) actions.hidden = state.step === 3;
      if (back) back.hidden = state.step === 1;
      if (next) next.disabled = !canContinue();
      if (state.step === 3) {
        if (help) help.hidden = true;
        renderRoute();
        return;
      }
      if (help) help.hidden = false;
      if (title) title.textContent = copy[state.step][0];
      if (help) help.textContent = copy[state.step][1];
    }

    function choose(button) {
      var group = button.getAttribute('data-group');
      app.querySelectorAll('[data-group="' + group + '"]').forEach(function (el) {
        var on = el === button;
        el.classList.toggle('on', on);
        el.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      state[group] = button.getAttribute('data-value');
      if (next) next.disabled = !canContinue();
    }

    function sectionIsOpen(id) {
      if (state.openSections) return !!state.openSections[id];
      return id === openSectionId(state.routeSong, state.routeGoal, state.stopIds);
    }

    function toggleSection(id) {
      var groups = sectionsFor(state.stopIds);
      if (!state.openSections) {
        state.openSections = {};
        var current = openSectionId(state.routeSong, state.routeGoal, state.stopIds);
        groups.forEach(function (section) {
          state.openSections[section.id] = section.id === current;
        });
      }
      state.openSections[id] = !state.openSections[id];
      renderRoute();
    }

    function appendFolds(parent, ids, mode) {
      var groups = sectionsFor(ids);
      var numbers = {};
      var count = 1;
      if (mode === 'route') {
        sectionsFor(state.stopIds).forEach(function (section) {
          section.stops.forEach(function (id) {
            numbers[id] = count;
            count += 1;
          });
        });
      }
      groups.forEach(function (section) {
        var open = sectionIsOpen(section.id);
        var block = doc.createElement('section');
        block.className = 'dest-fold' + (open ? ' is-open' : '');
        var toggle = doc.createElement('button');
        toggle.type = 'button';
        toggle.className = 'dest-fold-toggle';
        toggle.setAttribute('data-section-toggle', section.id);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        var name = doc.createElement('span');
        name.textContent = section.label;
        var chevron = doc.createElement('span');
        chevron.className = 'dest-fold-chevron';
        chevron.setAttribute('aria-hidden', 'true');
        toggle.appendChild(name);
        toggle.appendChild(chevron);
        var panel = doc.createElement(mode === 'route' ? 'ol' : 'div');
        panel.className = mode === 'route' ? 'dest-stops' : 'dest-fold-extras';
        panel.hidden = !open;
        section.stops.forEach(function (id) {
          if (!STOPS[id]) return;
          if (mode === 'route') {
            var li = doc.createElement('li');
            li.className = 'dest-stop';
            var pin = doc.createElement('span');
            pin.className = 'dest-pin';
            pin.textContent = String(numbers[id] || '');
            var body = doc.createElement('div');
            body.className = 'dest-stop-body';
            body.appendChild(stopButton(id, state.routeGoal, state.kit));
            if (state.editing) {
              var remove = doc.createElement('button');
              remove.type = 'button';
              remove.className = 'dest-stop-remove';
              remove.setAttribute('data-remove', id);
              remove.textContent = 'Remove';
              body.appendChild(remove);
            }
            li.appendChild(pin);
            li.appendChild(body);
            panel.appendChild(li);
            return;
          }
          var row = doc.createElement('div');
          row.className = 'dest-extra';
          row.appendChild(stopButton(id, state.routeGoal, state.kit));
          var add = doc.createElement('button');
          add.type = 'button';
          add.className = 'dest-stop-add';
          add.setAttribute('data-add', id);
          add.textContent = 'Add';
          row.appendChild(add);
          panel.appendChild(row);
        });
        block.appendChild(toggle);
        block.appendChild(panel);
        parent.appendChild(block);
      });
    }

    function renderRoute() {
      readMini();
      if (state.openSections) {
        var stillOpen = sectionsFor(state.stopIds).some(function (section) {
          return state.openSections[section.id];
        });
        var explicitlyClosed = sectionsFor(state.stopIds).every(function (section) {
          return state.openSections[section.id] === false;
        });
        if (!stillOpen && !explicitlyClosed) state.openSections = null;
      }
      if (title) title.textContent = headline(state.routeSong, state.routeGoal);
      if (help) help.textContent = 'One package for this goal.';
      if (total) total.textContent = packageTotal(state.managed);
      var packageNote = doc.getElementById('dest-package-note');
      if (packageNote) {
        packageNote.hidden = !state.managed;
        packageNote.textContent = state.managed ? 'The HW team runs this route.' : '';
      }
      app.querySelectorAll('[data-kit]').forEach(function (button) {
        var on = button.getAttribute('data-kit') === state.kit;
        button.classList.toggle('on', on);
        button.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      if (edit) {
        edit.setAttribute('aria-pressed', state.editing ? 'true' : 'false');
        edit.textContent = state.editing ? 'Done editing' : 'Edit route';
      }
      var plan = currentPlan();
      var forLine = audienceLine(plan);
      if (routeFor) {
        routeFor.textContent = forLine;
        routeFor.hidden = !forLine;
      }
      if (go) go.setAttribute('href', signupHref(plan));
      save(plan);
      paintAccount(plan);

      var notes = headsUp(state.stopIds, state.routeSong, state.routeGoal);
      if (heads) {
        heads.textContent = '';
        heads.hidden = notes.length === 0;
        notes.forEach(function (line) {
          var p = doc.createElement('p');
          p.textContent = line;
          heads.appendChild(p);
        });
      }

      if (map) {
        map.setAttribute('data-shape', 'route');
        map.textContent = '';
        var svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'dest-road');
        svg.setAttribute('aria-hidden', 'true');
        var glow = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
        glow.setAttribute('class', 'dest-road-glow');
        var line = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
        line.setAttribute('class', 'dest-road-line');
        svg.appendChild(glow);
        svg.appendChild(line);
        var groups = doc.createElement('div');
        groups.className = 'dest-sections';
        appendFolds(groups, state.stopIds, 'route');
        map.appendChild(svg);
        map.appendChild(groups);
        drawRoad(false);
      }

      if (extras) extras.hidden = !state.editing;
      if (extraList) {
        extraList.textContent = '';
        if (state.editing) {
          var spare = STOP_ORDER.filter(function (id) { return state.stopIds.indexOf(id) === -1; });
          if (!spare.length) {
            var empty = doc.createElement('p');
            empty.className = 'dest-extras-lead';
            empty.textContent = 'Every stop is already on your route.';
            extraList.appendChild(empty);
          }
          appendFolds(extraList, spare, 'extra');
        }
      }
    }

    function drawRoad(skipIntro, attempt) {
      attempt = attempt || 0;
      if (!map || state.step !== 3) return;
      var svg = map.querySelector('.dest-road');
      var glow = map.querySelector('.dest-road-glow');
      var line = map.querySelector('.dest-road-line');
      if (!svg || !line || !glow) return;
      var width = map.clientWidth;
      var height = map.clientHeight;
      if (!width || !height) {
        if (attempt < 10) root.setTimeout(function () { drawRoad(skipIntro, attempt + 1); }, 30);
        return;
      }
      var box = map.getBoundingClientRect();
      var points = [];
      map.querySelectorAll('.dest-pin').forEach(function (pin) {
        var fold = pin.closest ? pin.closest('.dest-fold') : null;
        if (fold && !fold.classList.contains('is-open')) return;
        var rect = pin.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        points.push({
          x: rect.left - box.left + rect.width / 2,
          y: rect.top - box.top + rect.height / 2
        });
      });
      svg.setAttribute('viewBox', '0 0 ' + width + ' ' + height);
      var d = roadPath(points, 'route', width < 800);
      glow.setAttribute('d', d);
      line.setAttribute('d', d);
      var reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
      line.classList.remove('is-flow');
      line.style.transition = 'none';
      if (skipIntro || reduce || points.length < 2 || typeof line.getTotalLength !== 'function') {
        line.style.strokeDasharray = '10 14';
        line.style.strokeDashoffset = '0';
        if (!reduce) line.classList.add('is-flow');
        return;
      }
      try {
        var len = line.getTotalLength();
        line.style.strokeDasharray = String(len);
        line.style.strokeDashoffset = String(len);
        line.getBoundingClientRect();
        line.style.transition = 'stroke-dashoffset 1.15s ease';
        line.style.strokeDashoffset = '0';
        root.clearTimeout(drawTimer);
        drawTimer = root.setTimeout(function () {
          line.style.transition = 'none';
          line.style.strokeDasharray = '10 14';
          line.style.strokeDashoffset = '0';
          line.classList.add('is-flow');
        }, 1200);
      } catch (err) {
        line.style.strokeDasharray = '10 14';
        line.style.strokeDashoffset = '0';
      }
    }

    function openDrawer(id) {
      var info = explain(id, state.routeGoal);
      if (!info || !drawer) return;
      lastFocus = doc.activeElement;
      if (drawerTitle) drawerTitle.textContent = info.title;
      if (drawerStatus) {
        drawerStatus.className = 'dest-badge dest-badge-' + info.status;
        drawerStatus.textContent = info.statusLabel;
      }
      if (drawerWhat) drawerWhat.textContent = info.what;
      if (drawerWhy) drawerWhy.textContent = info.why;
      if (drawerGet) drawerGet.textContent = info.get;
      if (drawerWho) drawerWho.textContent = info.who;
      if (drawerFor) {
        var forLine = audienceLine(currentPlan());
        drawerFor.textContent = forLine;
        drawerFor.hidden = !forLine;
      }
      if (drawerFace) {
        drawerFace.textContent = '';
        drawerFace.appendChild(avatarNode(info.face));
      }
      if (drawerLink) {
        drawerLink.textContent = '';
        drawerLink.hidden = !info.href;
        if (info.href) {
          var link = doc.createElement('a');
          link.href = info.href;
          link.textContent = info.link;
          drawerLink.appendChild(link);
        }
      }
      drawer.hidden = false;
      if (drawerClose) drawerClose.focus();
    }

    function closeDrawer() {
      if (!drawer || drawer.hidden) return;
      drawer.hidden = true;
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    function toggleKit(id) {
      if (state.kit === id) {
        var reset = applyKit('', state.song, state.goal);
        state.kit = '';
        state.managed = false;
        state.routeSong = reset.song;
        state.routeGoal = reset.goal;
        state.stopIds = reset.stops;
      } else {
        var nextKit = applyKit(id, state.song, state.goal);
        state.kit = nextKit.kit;
        state.managed = nextKit.managed;
        state.routeSong = nextKit.song;
        state.routeGoal = nextKit.goal;
        state.stopIds = nextKit.stops.slice();
      }
      renderRoute();
    }

    function startRoute() {
      readMini();
      state.editing = false;
      state.kit = '';
      state.managed = false;
      state.routeSong = state.song;
      state.routeGoal = state.goal;
      state.stopIds = recommendedIds(state.song, state.goal);
      state.openSections = null;
    }

    app.addEventListener('click', function (event) {
      var countChip = event.target.closest('[data-count]');
      if (countChip && app.contains(countChip)) {
        var nextCount = countChip.getAttribute('data-count');
        state.artistCount = state.artistCount === nextCount ? '' : nextCount;
        paintCount();
        return;
      }
      var genreChip = event.target.closest('[data-genre]');
      if (genreChip && app.contains(genreChip)) {
        var name = genreChip.getAttribute('data-genre');
        var index = state.genres.indexOf(name);
        if (index === -1) state.genres.push(name);
        else state.genres.splice(index, 1);
        paintGenres();
        return;
      }
      var choice = event.target.closest('[data-group]');
      if (choice && app.contains(choice)) {
        choose(choice);
        return;
      }
      var sectionToggle = event.target.closest('[data-section-toggle]');
      if (sectionToggle && app.contains(sectionToggle)) {
        toggleSection(sectionToggle.getAttribute('data-section-toggle'));
        return;
      }
      var kit = event.target.closest('[data-kit]');
      if (kit && app.contains(kit)) {
        toggleKit(kit.getAttribute('data-kit'));
        return;
      }
      var remove = event.target.closest('[data-remove]');
      if (remove && app.contains(remove)) {
        var removeId = remove.getAttribute('data-remove');
        state.stopIds = state.stopIds.filter(function (id) { return id !== removeId; });
        renderRoute();
        return;
      }
      var add = event.target.closest('[data-add]');
      if (add && app.contains(add)) {
        var addId = add.getAttribute('data-add');
        if (STOPS[addId] && state.stopIds.indexOf(addId) === -1) state.stopIds.push(addId);
        renderRoute();
        return;
      }
      var open = event.target.closest('[data-open]');
      if (open && app.contains(open)) openDrawer(open.getAttribute('data-open'));
    });

    if (next) {
      next.addEventListener('click', function () {
        if (!canContinue()) return;
        readMini();
        if (state.step === 2) startRoute();
        if (state.step < 3) state.step += 1;
        showStep();
      });
    }
    if (back) {
      back.addEventListener('click', function () {
        if (state.step > 1) state.step -= 1;
        showStep();
      });
    }
    var back3 = doc.getElementById('dest-back-3');
    if (back3) {
      back3.addEventListener('click', function () {
        state.step = 2;
        showStep();
      });
    }
    if (edit) {
      edit.addEventListener('click', function () {
        state.editing = !state.editing;
        renderRoute();
      });
    }
    if (about) {
      about.addEventListener('input', function () {
        readMini();
        if (state.step === 3) save(currentPlan());
      });
    }
    var genreOther = doc.getElementById('dest-genre-other');
    if (genreOther) {
      genreOther.addEventListener('input', function () {
        readMini();
        if (state.step === 3) save(currentPlan());
      });
    }
    if (go) {
      go.addEventListener('click', function () {
        readMini();
        if (state.routeSong && state.routeGoal) save(currentPlan(), true);
      });
    }
    if (drawerClose) drawerClose.addEventListener('click', closeDrawer);
    var backdrop = doc.getElementById('dest-drawer-backdrop');
    if (backdrop) backdrop.addEventListener('click', closeDrawer);
    doc.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeDrawer();
    });

    root.addEventListener('resize', function () {
      root.clearTimeout(drawTimer);
      drawTimer = root.setTimeout(function () { drawRoad(true); }, 80);
    });

    state.song = selected('song');
    state.goal = selected('goal');
    if (!state.song) applyPickedSong();
    var existingPlan = localPlan();
    if (existingPlan) applySavedPlan(existingPlan, { editing: editMode() });
    else showStep();
    var membership = root.PlaigroundMembership;
    var ready = membership && typeof membership.whenReady === 'function'
      ? membership.whenReady()
      : Promise.resolve(null);
    ready.then(function (result) {
      authKnown = true;
      signedIn = signedInFromProbe(result, sessionHint());
      var account = accountApi();
      function showSignedOut() {
        signedIn = false;
        paintAccount(currentPlan());
      }
      function showPlan(plan, persistLocal) {
        var editing = state.editing || editMode();
        if (persistLocal && plan) persistAccount(planRecord(plan), true);
        if (plan) applySavedPlan(plan, { editing: editing });
        else paintAccount(currentPlan());
      }
      if (!signedIn) {
        paintAccount(currentPlan());
        return;
      }
      if (!account || typeof account.loadPlan !== 'function') {
        showPlan(localPlan(), true);
        return;
      }
      account.loadPlan().then(function (saved) {
        if (!(result && result.ok) && !(saved && saved.plan)) {
          showSignedOut();
          return;
        }
        var next = planForEdit(saved, localPlan());
        showPlan(next, !(saved && saved.plan));
      }).catch(function () {
        if (result && result.ok) {
          showPlan(localPlan(), true);
          return;
        }
        showSignedOut();
      });
    }).catch(function () {
      authKnown = true;
      signedIn = false;
      paintAccount(currentPlan());
    });
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    NOTE_LIMIT: NOTE_LIMIT,
    SONGS: SONGS,
    GOALS: GOALS,
    STATUS: STATUS,
    STOPS: STOPS,
    STOP_ORDER: STOP_ORDER,
    KITS: KITS,
    SECTIONS: SECTIONS,
    sectionsFor: sectionsFor,
    openSectionId: openSectionId,
    recommendedIds: recommendedIds,
    applyKit: applyKit,
    headsUp: headsUp,
    headline: headline,
    audienceLine: audienceLine,
    explain: explain,
    isRecommended: isRecommended,
    packageTotal: packageTotal,
    signupHref: signupHref,
    signedInFromProbe: signedInFromProbe,
    planForEdit: planForEdit,
    editRequested: editRequested,
    planRecord: planRecord,
    roadPath: roadPath,
    mount: mount
  };
});
