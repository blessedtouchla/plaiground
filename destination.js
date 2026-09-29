(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DestinationCore = api;
  if (typeof document !== 'undefined' && document.getElementById('dest-app')) api.mount(document);
})(typeof window !== 'undefined' ? window : globalThis, function () {
  var root = typeof window !== 'undefined' ? window : globalThis;
  var STORAGE_KEY = 'plaigroundDestinationPlan';
  var NOTE_LIMIT = 240;

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
    'helper', 'check', 'cover', 'persona', 'distro', 'publishing', 'royalties',
    'sync', 'pitch', 'marketing', 'multiverse', 'billboard', 'shows'
  ];

  var RECOMMENDED = {
    'idea|money': ['helper', 'check', 'persona', 'publishing', 'royalties', 'sync'],
    'idea|fanbase': ['helper', 'cover', 'persona', 'check', 'distro', 'pitch'],
    'idea|release': ['helper', 'check', 'cover', 'persona', 'distro', 'publishing'],
    'made|money': ['check', 'persona', 'distro', 'publishing', 'royalties', 'sync'],
    'made|fanbase': ['cover', 'persona', 'check', 'distro', 'pitch', 'marketing'],
    'made|release': ['persona', 'check', 'cover', 'distro'],
    'out|money': ['publishing', 'royalties', 'sync', 'check'],
    'out|fanbase': ['persona', 'pitch', 'marketing', 'check'],
    'out|release': ['check', 'publishing', 'royalties']
  };

  var KITS = {
    release: {
      id: 'release',
      label: 'Release Kit',
      song: 'made',
      goal: 'release',
      stops: ['persona', 'check', 'cover', 'distro']
    },
    record: {
      id: 'record',
      label: 'Break Your Record',
      song: 'out',
      goal: 'fanbase',
      stops: ['marketing', 'pitch', 'sync', 'billboard']
    },
    management: {
      id: 'management',
      label: 'Management'
    }
  };

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

  function signupHref(plan) {
    var params = new URLSearchParams();
    params.set('plan', 'basic');
    params.set('song', plan.song || '');
    params.set('goal', plan.goal || '');
    params.set('stops', (plan.stops || []).join(','));
    var note = clipNote(plan.note);
    if (note) params.set('note', note);
    if (plan.kit) params.set('kit', plan.kit);
    return 'signup.html?' + params.toString();
  }

  function planRecord(plan) {
    return {
      song: plan.song,
      goal: plan.goal,
      note: clipNote(plan.note),
      stops: (plan.stops || []).slice(),
      kit: plan.kit || '',
      managed: !!plan.managed
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
      kit: '',
      managed: false,
      routeSong: '',
      routeGoal: '',
      stopIds: [],
      editing: false
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
    var drawerGet = doc.getElementById('dest-drawer-get');
    var drawerWho = doc.getElementById('dest-drawer-who');
    var drawerFace = doc.getElementById('dest-drawer-face');
    var drawerLink = doc.getElementById('dest-drawer-link');
    var drawerClose = doc.getElementById('dest-drawer-close');
    var lastFocus = null;
    var drawTimer = 0;

    var copy = {
      1: ["Where's your song?", 'Pick one. This is the start of the route.'],
      2: ['Where do you want to go?', 'Pick one goal. The note is optional.']
    };

    function selected(group) {
      var on = app.querySelector('[data-group="' + group + '"].on');
      return on ? on.getAttribute('data-value') : '';
    }

    function readNote() {
      if (!about) return;
      state.note = String(about.value || '').slice(0, NOTE_LIMIT);
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
        managed: state.managed
      };
    }

    function save(plan) {
      var record = planRecord(plan);
      try {
        root.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
      } catch (err) {}
      return record;
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

    function renderRoute() {
      readNote();
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
      if (go) go.setAttribute('href', signupHref(plan));
      save(plan);

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
        var list = doc.createElement('ol');
        list.className = 'dest-stops';
        state.stopIds.forEach(function (id, index) {
          if (!STOPS[id]) return;
          var li = doc.createElement('li');
          li.className = 'dest-stop';
          var pin = doc.createElement('span');
          pin.className = 'dest-pin';
          pin.textContent = String(index + 1);
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
          list.appendChild(li);
        });
        map.appendChild(svg);
        map.appendChild(list);
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
          spare.forEach(function (id) {
            var row = doc.createElement('div');
            row.className = 'dest-extra';
            row.appendChild(stopButton(id, state.routeGoal, state.kit));
            var add = doc.createElement('button');
            add.type = 'button';
            add.className = 'dest-stop-add';
            add.setAttribute('data-add', id);
            add.textContent = 'Add';
            row.appendChild(add);
            extraList.appendChild(row);
          });
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
        var rect = pin.getBoundingClientRect();
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
      readNote();
      state.editing = false;
      state.kit = '';
      state.managed = false;
      state.routeSong = state.song;
      state.routeGoal = state.goal;
      state.stopIds = recommendedIds(state.song, state.goal);
    }

    app.addEventListener('click', function (event) {
      var choice = event.target.closest('[data-group]');
      if (choice && app.contains(choice)) {
        choose(choice);
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
        readNote();
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
        readNote();
        if (state.step === 3) save(currentPlan());
      });
    }
    if (go) {
      go.addEventListener('click', function () {
        readNote();
        if (state.routeSong && state.routeGoal) save(currentPlan());
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
    showStep();
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
    recommendedIds: recommendedIds,
    applyKit: applyKit,
    headsUp: headsUp,
    headline: headline,
    explain: explain,
    isRecommended: isRecommended,
    packageTotal: packageTotal,
    signupHref: signupHref,
    planRecord: planRecord,
    roadPath: roadPath,
    mount: mount
  };
});
