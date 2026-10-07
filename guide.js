(function () {
  var guide = window.PlaigroundGuide;
  var core = window.DestinationCore;
  if (!guide || !document.querySelector('[data-guide]')) return;

  if (guide.isDone()) {
    window.location.replace('/destination');
    return;
  }

  var root = document.querySelector('[data-guide]');
  var answers = { song: '', want: '' };
  var steps = 4;
  var route = null;
  var token = 0;
  var bar = root.querySelector('[data-guide-bar]');
  var fill = root.querySelector('[data-guide-fill]');
  var burst = root.querySelector('[data-guide-burst]');
  var stopsBox = root.querySelector('[data-guide-stops]');
  var cta = root.querySelector('[data-guide-cta]');

  function reduceMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function paintProgress(step) {
    var pct = Math.max(1, Math.min(steps, step)) / steps * 100;
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
      var on = n === step || (step === 4 && n === 3);
      section.hidden = !on;
    });
    var heading = root.querySelector('[data-guide-screen="' + (step === 4 ? 3 : step) + '"] h1');
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

  function shownFirstId() {
    if (!core || !core.sectionsFor || !route) return route && route.firstStop;
    var groups = core.sectionsFor(route.stops);
    var openId = core.openSectionId(route.song, route.goal, route.stops);
    var openGroup = null;
    groups.forEach(function (section) {
      if (section.id === openId) openGroup = section;
    });
    if (openGroup && openGroup.stops.length) return openGroup.stops[0];
    if (groups.length && groups[0].stops.length) return groups[0].stops[0];
    return route.firstStop;
  }

  function renderStops(lit) {
    if (!stopsBox || !route || !core || !core.sectionsFor) return;
    stopsBox.textContent = '';
    var groups = core.sectionsFor(route.stops);
    var openId = core.openSectionId(route.song, route.goal, route.stops);
    var firstId = shownFirstId();
    var number = 1;
    groups.forEach(function (section) {
      var open = section.id === openId;
      var block = document.createElement('section');
      block.className = 'guide-fold' + (open ? ' is-open' : '');
      var toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'guide-fold-toggle';
      toggle.setAttribute('data-guide-fold', section.id);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      var name = document.createElement('span');
      name.textContent = section.label;
      var chevron = document.createElement('span');
      chevron.className = 'guide-fold-chevron';
      chevron.setAttribute('aria-hidden', 'true');
      toggle.appendChild(name);
      toggle.appendChild(chevron);
      var list = document.createElement('ol');
      list.hidden = !open;
      section.stops.forEach(function (id) {
        var info = core.explain ? core.explain(id, route.goal) : null;
        var li = document.createElement('li');
        li.className = 'guide-stop' + (lit || open ? ' is-on' : '');
        if (id === firstId) li.classList.add('is-first');
        var pin = document.createElement('span');
        pin.className = 'guide-pin';
        pin.textContent = String(number);
        number += 1;
        var label = document.createElement('b');
        label.textContent = info && info.title ? info.title : id;
        li.appendChild(pin);
        li.appendChild(label);
        list.appendChild(li);
      });
      block.appendChild(toggle);
      block.appendChild(list);
      stopsBox.appendChild(block);
    });
  }

  function lightStops(run) {
    var nodes = stopsBox ? stopsBox.querySelectorAll('.guide-fold.is-open .guide-stop') : [];
    if (!nodes.length) {
      show(4);
      return;
    }
    nodes.forEach(function (node) { node.classList.remove('is-on'); });
    if (reduceMotion()) {
      nodes.forEach(function (node) { node.classList.add('is-on'); });
      window.setTimeout(function () {
        if (run === token) show(4);
      }, 350);
      return;
    }
    Array.prototype.forEach.call(nodes, function (node, index) {
      window.setTimeout(function () {
        if (run !== token) return;
        node.classList.add('is-on');
        if (index === nodes.length - 1) {
          window.setTimeout(function () {
            if (run === token) show(4);
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
    if (step === 3) {
      route = guide.routeFor(answers);
      if (cta && core && core.stopHref) cta.setAttribute('href', core.stopHref(shownFirstId()) || '/destination');
      else if (cta) cta.setAttribute('href', route.firstHref || '/destination');
      persist(route);
      renderStops(false);
      lightStops(run);
    }
    if (step === 4 && stopsBox) {
      var first = stopsBox.querySelector('.guide-fold.is-open .guide-stop');
      if (first) first.classList.add('is-first');
    }
  }

  root.addEventListener('click', function (event) {
    var fold = event.target.closest('[data-guide-fold]');
    if (fold && root.contains(fold)) {
      var block = fold.parentNode;
      var list = block ? block.querySelector('ol') : null;
      var open = fold.getAttribute('aria-expanded') === 'true';
      fold.setAttribute('aria-expanded', open ? 'false' : 'true');
      if (block) block.classList.toggle('is-open', !open);
      if (list) list.hidden = open;
      if (!open && list) {
        list.querySelectorAll('.guide-stop').forEach(function (node) { node.classList.add('is-on'); });
      }
      return;
    }
    var choice = event.target.closest('[data-guide-choice]');
    if (choice && root.contains(choice)) {
      var key = choice.getAttribute('data-guide-choice');
      answers[key] = choice.getAttribute('data-value');
      choice.classList.add('is-pick');
      var next = key === 'song' ? 2 : 3;
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
      cta.setAttribute('href', (core && core.stopHref ? core.stopHref(shownFirstId()) : route.firstHref) || '/destination');
    });
  }

  show(1);
})();
