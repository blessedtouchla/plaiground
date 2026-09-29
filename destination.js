(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DestinationCore = api;
  if (typeof document !== 'undefined' && document.getElementById('dest-app')) api.mount(document);
})(typeof window !== 'undefined' ? window : globalThis, function () {
  var root = typeof window !== 'undefined' ? window : globalThis;
  var STORAGE_KEY = 'plaigroundDestinationPlan';

  var STOPS = {
    song: {
      id: 'song',
      title: 'Song check',
      team: 'A&R listens for where your sound fits and who should hear it. People check the notes.',
      href: '/ar',
      link: 'A&R'
    },
    epk: {
      id: 'epk',
      title: 'EPK and bio',
      team: 'The team drafts the bio and one-sheet from your music, with AI assistance. The disclosure stays human, assisted, or fully AI.',
      href: '/epk',
      link: 'EPK'
    },
    sync: {
      id: 'sync',
      title: 'Sync pitching',
      team: 'Pitch-ready packages for film, TV, games, and ads. Packaging only. No placement promise.',
      href: '/#pricing',
      link: 'Sync package'
    },
    distro: {
      id: 'distro',
      title: 'Distribution',
      team: 'The release goes to the major stores.',
      href: '/how-it-works.html#distribute',
      link: 'Distribution'
    },
    royalties: {
      id: 'royalties',
      title: 'How you get paid',
      team: 'Store royalties land in the dashboard. PLAIGROUND does not take a cut of them.',
      href: '/royalties.html',
      link: 'How you get paid'
    },
    publishing: {
      id: 'publishing',
      title: 'Publishing',
      team: 'Register the composition from the signed-in product, under a separate publishing agreement.',
      href: '/publishing.html',
      link: 'Publishing'
    },
    pitch: {
      id: 'pitch',
      title: 'Playlist and blog pitching',
      team: 'Pitching to matching playlists, blogs, and sync briefs. The site marks this Coming soon.',
      href: '',
      link: '',
      soon: true
    }
  };

  var FOCUS = {
    streams: 'song',
    profit: 'royalties',
    sync: 'sync',
    press: 'epk',
    playlists: 'pitch',
    fanbase: 'epk'
  };

  function orderFor(destination, level, pace) {
    var starting = level === 'starting';
    var momentum = level === 'momentum';
    var fast = pace === 'fast';

    if (destination === 'streams') {
      if (momentum && fast) return ['song', 'pitch', 'epk'];
      if (momentum) return ['epk', 'pitch', 'song'];
      if (fast) return starting ? ['song', 'epk', 'distro', 'pitch'] : ['song', 'epk', 'pitch'];
      return starting ? ['epk', 'song', 'distro', 'pitch'] : ['epk', 'song', 'pitch'];
    }

    if (destination === 'sync') {
      if (momentum && fast) return ['sync', 'song', 'epk'];
      if (momentum) return ['epk', 'sync'];
      if (fast && level === 'releases') return ['sync', 'epk', 'song'];
      if (fast) return ['sync', 'song', 'epk'];
      if (level === 'releases') return ['epk', 'song', 'sync'];
      return ['song', 'epk', 'sync'];
    }

    if (destination === 'press') {
      if (momentum && fast) return ['epk', 'pitch', 'song'];
      if (momentum) return ['pitch', 'song', 'epk'];
      if (fast && level === 'releases') return ['epk', 'pitch', 'song'];
      if (fast) return ['epk', 'song', 'pitch'];
      if (level === 'releases') return ['song', 'pitch', 'epk'];
      return ['song', 'epk', 'pitch'];
    }

    if (destination === 'playlists') {
      if (momentum && fast) return ['pitch', 'song', 'epk'];
      if (momentum) return ['song', 'epk', 'pitch'];
      if (fast) return starting ? ['pitch', 'song', 'epk', 'distro'] : ['pitch', 'epk', 'song'];
      return starting ? ['song', 'epk', 'distro', 'pitch'] : ['song', 'epk', 'pitch'];
    }

    if (destination === 'profit') {
      if (momentum && fast) return ['royalties', 'publishing', 'song'];
      if (momentum) return ['publishing', 'royalties'];
      if (fast && starting) return ['royalties', 'publishing', 'distro'];
      if (fast) return ['royalties', 'publishing'];
      if (starting) return ['distro', 'publishing', 'royalties'];
      return ['publishing', 'epk', 'royalties'];
    }

    if (momentum && fast) return ['epk', 'pitch', 'song'];
    if (momentum) return ['song', 'epk'];
    if (fast) return starting ? ['epk', 'song', 'distro', 'pitch'] : ['epk', 'song', 'pitch'];
    return starting ? ['song', 'epk', 'distro', 'pitch'] : ['song', 'epk', 'pitch'];
  }

  function noteFor(destination, level) {
    var line;
    if (level === 'starting' && (destination === 'streams' || destination === 'playlists' || destination === 'fanbase' || destination === 'profit')) {
      line = 'Nothing is released yet, so distribution is on this route.';
    } else if (level === 'starting') {
      line = 'Nothing is released yet. This destination leaves distribution off the route.';
    } else if (level === 'releases') {
      line = 'Releases are already out, so distribution stays off this route.';
    } else {
      line = 'Building momentum leaves a first release off this route.';
    }
    return line + ' Pace changes the order. No date is attached.';
  }

  function buildRoute(destination, level, pace) {
    var ids = orderFor(destination, level, pace);
    var focus = FOCUS[destination];
    return {
      destination: destination,
      level: level,
      pace: pace,
      shape: destination,
      focus: focus,
      note: noteFor(destination, level),
      stops: ids.map(function (id) {
        var stop = STOPS[id];
        return {
          id: stop.id,
          title: stop.title,
          team: stop.team,
          href: stop.href,
          link: stop.link,
          soon: !!stop.soon,
          focus: id === focus
        };
      })
    };
  }

  function signupHref(destination, level, pace) {
    var params = new URLSearchParams();
    params.set('plan', 'basic');
    params.set('destination', destination);
    params.set('level', level);
    params.set('pace', pace);
    return 'signup.html?' + params.toString();
  }

  function planRecord(route) {
    return {
      destination: route.destination,
      level: route.level,
      pace: route.pace,
      stops: route.stops.map(function (stop) { return stop.id; })
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
      fanbase: 102
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

    var state = { step: 1, destination: '', level: '', pace: '' };
    var title = doc.getElementById('dest-title');
    var help = doc.getElementById('dest-help');
    var stepLabel = doc.getElementById('dest-step-label');
    var next = doc.getElementById('dest-next');
    var back = doc.getElementById('dest-back');
    var actions = doc.getElementById('dest-actions');
    var go = doc.getElementById('dest-go');
    var map = doc.getElementById('dest-map');
    var note = doc.getElementById('dest-note');
    var drawTimer = 0;

    var copy = {
      1: ['Where are you headed?', 'Pick one destination for your own music.'],
      2: ['Where are you now?', 'Level sets which stops belong. Pace changes the order. No date is attached.'],
      3: ['Your route', 'AI runs the business side, and people check the work.']
    };

    function selected(group) {
      var on = app.querySelector('[data-group="' + group + '"].on');
      return on ? on.getAttribute('data-value') : '';
    }

    function canContinue() {
      if (state.step === 1) return !!state.destination;
      if (state.step === 2) return !!state.level && !!state.pace;
      return false;
    }

    function showStep() {
      [1, 2, 3].forEach(function (n) {
        var section = doc.getElementById('dest-step-' + n);
        if (section) section.hidden = n !== state.step;
      });
      if (title) title.textContent = copy[state.step][0];
      if (help) help.textContent = copy[state.step][1];
      if (stepLabel) stepLabel.textContent = 'Step ' + state.step + ' of 3';
      if (actions) actions.hidden = state.step === 3;
      if (back) back.hidden = state.step === 1;
      if (next) next.disabled = !canContinue();
      if (state.step === 3) renderRoute();
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

    function save(route) {
      var record = planRecord(route);
      try {
        root.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
      } catch (err) {}
      return record;
    }

    function renderRoute() {
      var route = buildRoute(state.destination, state.level, state.pace);
      var href = signupHref(state.destination, state.level, state.pace);
      if (note) note.textContent = route.note;
      if (go) go.setAttribute('href', href);
      save(route);
      if (!map) return;
      map.setAttribute('data-shape', route.shape);
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
      route.stops.forEach(function (stop, index) {
        var li = doc.createElement('li');
        li.className = 'dest-stop' + (stop.focus ? ' is-focus' : '') + (stop.soon ? ' is-soon' : '');
        var pin = doc.createElement('span');
        pin.className = 'dest-pin';
        pin.textContent = String(index + 1);
        var h = doc.createElement('h2');
        h.textContent = stop.title;
        if (stop.soon) {
          var badge = doc.createElement('span');
          badge.className = 'coming-soon';
          badge.textContent = 'Coming soon';
          h.appendChild(badge);
        }
        var p = doc.createElement('p');
        p.textContent = stop.team;
        li.appendChild(pin);
        li.appendChild(h);
        li.appendChild(p);
        if (stop.href) {
          var a = doc.createElement('a');
          a.className = 'dest-link';
          a.href = stop.href;
          a.textContent = stop.link;
          li.appendChild(a);
        }
        list.appendChild(li);
      });

      map.appendChild(svg);
      map.appendChild(list);
      drawRoad(false);
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
      var d = roadPath(points, map.getAttribute('data-shape'), width < 800);
      glow.setAttribute('d', d);
      line.setAttribute('d', d);
      var reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
      line.classList.remove('is-flow');
      line.style.transition = 'none';
      if (skipIntro || reduce || typeof line.getTotalLength !== 'function') {
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

    app.addEventListener('click', function (event) {
      var choice = event.target.closest('[data-group]');
      if (choice && app.contains(choice)) choose(choice);
    });

    if (next) {
      next.addEventListener('click', function () {
        if (!canContinue()) return;
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
    if (go) {
      go.addEventListener('click', function () {
        if (state.destination && state.level && state.pace) save(buildRoute(state.destination, state.level, state.pace));
      });
    }

    root.addEventListener('resize', function () {
      root.clearTimeout(drawTimer);
      drawTimer = root.setTimeout(function () { drawRoad(true); }, 80);
    });

    state.destination = selected('destination');
    state.level = selected('level');
    state.pace = selected('pace');
    showStep();
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    STOPS: STOPS,
    FOCUS: FOCUS,
    buildRoute: buildRoute,
    signupHref: signupHref,
    planRecord: planRecord,
    roadPath: roadPath,
    mount: mount
  };
});
