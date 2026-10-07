(function () {
  var guide = window.PlaigroundGuide;
  var core = window.DestinationCore;
  if (!guide || !document.querySelector('[data-guide]')) return;

  if (guide.isDone()) {
    window.location.replace('/destination');
    return;
  }

  var root = document.querySelector('[data-guide]');
  var answers = { role: '', song: '', want: '' };
  var route = null;
  var token = 0;
  var bar = root.querySelector('[data-guide-bar]');
  var fill = root.querySelector('[data-guide-fill]');
  var burst = root.querySelector('[data-guide-burst]');
  var stopsBox = root.querySelector('[data-guide-stops]');
  var rail = root.querySelector('.guide-rail');
  var cta = root.querySelector('[data-guide-cta]');

  function reduceMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function paintProgress(step) {
    var pct = Math.max(1, Math.min(5, step)) / 5 * 100;
    if (fill) fill.style.width = pct + '%';
    if (bar) bar.setAttribute('aria-valuenow', String(step));
    if (burst) {
      burst.style.left = pct + '%';
      burst.classList.remove('pop');
      if (!reduceMotion()) {
        void burst.offsetWidth;
        burst.classList.add('pop');
      }
    }
  }

  function showScreen(step) {
    root.querySelectorAll('[data-guide-screen]').forEach(function (section) {
      var n = Number(section.getAttribute('data-guide-screen'));
      var on = n === step || (step === 5 && n === 4);
      section.hidden = !on;
    });
    var heading = root.querySelector('[data-guide-screen="' + (step === 5 ? 4 : step) + '"] h1');
    if (heading && heading.focus) heading.focus();
  }

  function persist(next) {
    if (!core || !next) return null;
    var record = core.planRecord({
      song: next.song,
      goal: next.goal,
      note: '',
      stops: next.stops,
      kit: next.kit,
      managed: next.managed,
      artistCount: next.artistCount
    });
    var account = window.PlaigroundRoadmapAccount;
    if (account && typeof account.savePlan === 'function') {
      try { account.savePlan(record, { immediate: true }); } catch (err) {}
      return record;
    }
    try {
      window.localStorage.setItem(core.STORAGE_KEY, JSON.stringify(record));
    } catch (err2) {}
    return record;
  }

  function renderStops(lit) {
    if (!stopsBox || !route) return;
    stopsBox.textContent = '';
    route.stops.forEach(function (id, index) {
      var info = core && core.explain ? core.explain(id, route.goal) : null;
      var li = document.createElement('li');
      li.className = 'guide-stop' + (lit ? ' is-on' : '');
      if (lit && index === 0) li.classList.add('is-first');
      var pin = document.createElement('span');
      pin.className = 'guide-pin';
      pin.textContent = String(index + 1);
      var name = document.createElement('b');
      name.textContent = info && info.title ? info.title : id;
      li.appendChild(pin);
      li.appendChild(name);
      stopsBox.appendChild(li);
    });
  }

  function lightStops(run) {
    var nodes = stopsBox ? stopsBox.querySelectorAll('.guide-stop') : [];
    if (!nodes.length) {
      show(5);
      return;
    }
    if (rail) rail.classList.add('is-draw');
    if (reduceMotion()) {
      nodes.forEach(function (node, index) {
        node.classList.add('is-on');
        if (index === 0) node.classList.add('is-first');
      });
      window.setTimeout(function () {
        if (run === token) show(5);
      }, 350);
      return;
    }
    Array.prototype.forEach.call(nodes, function (node, index) {
      window.setTimeout(function () {
        if (run !== token) return;
        node.classList.add('is-on');
        if (index === nodes.length - 1) {
          window.setTimeout(function () {
            if (run === token) show(5);
          }, 650);
        }
      }, 260 * index + 180);
    });
  }

  function show(step) {
    token += 1;
    var run = token;
    paintProgress(step);
    showScreen(step);
    if (step === 4) {
      route = guide.routeFor(answers);
      if (cta) cta.setAttribute('href', route.firstHref || '/destination');
      persist(route);
      if (rail) rail.classList.remove('is-draw');
      renderStops(false);
      lightStops(run);
    }
    if (step === 5 && stopsBox) {
      var first = stopsBox.querySelector('.guide-stop');
      if (first) first.classList.add('is-first');
    }
  }

  root.addEventListener('click', function (event) {
    var choice = event.target.closest('[data-guide-choice]');
    if (choice && root.contains(choice)) {
      var key = choice.getAttribute('data-guide-choice');
      answers[key] = choice.getAttribute('data-value');
      choice.classList.add('is-pick');
      var next = key === 'role' ? 2 : key === 'song' ? 3 : 4;
      window.setTimeout(function () { show(next); }, reduceMotion() ? 0 : 160);
      return;
    }
    var skip = event.target.closest('[data-guide-skip]');
    if (skip && root.contains(skip)) {
      event.preventDefault();
      token += 1;
      guide.mark('skipped', answers);
      window.location.href = '/destination';
    }
  });

  if (cta) {
    cta.addEventListener('click', function () {
      token += 1;
      if (!route) route = guide.routeFor(answers);
      persist(route);
      guide.mark('completed', answers);
      cta.setAttribute('href', route.firstHref || '/destination');
    });
  }

  show(1);
})();
