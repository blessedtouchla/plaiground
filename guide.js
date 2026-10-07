(function () {
  var guide = window.PlaigroundGuide;
  var core = window.DestinationCore;
  if (!guide || !document.querySelector('[data-guide]')) return;

  if (guide.isDone()) {
    window.location.replace('/destination');
    return;
  }

  var root = document.querySelector('[data-guide]');
  var answers = { song: '', want: '', wants: [], pace: '' };
  var steps = 4;
  var route = null;
  var token = 0;
  var bar = root.querySelector('[data-guide-bar]');
  var fill = root.querySelector('[data-guide-fill]');
  var burst = root.querySelector('[data-guide-burst]');
  var stopsBox = root.querySelector('[data-guide-stops]');
  var cta = root.querySelector('[data-guide-cta]');
  var nextBtn = root.querySelector('[data-guide-next]');
  var paceBox = root.querySelector('[data-guide-pace]');

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
    if (route && route.pace === 'cheap') return route.stops[0];
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

  function stopNode(id, number, lit, firstId) {
    var info = core.explain ? core.explain(id, route.goal) : null;
    var li = document.createElement('li');
    li.className = 'guide-stop' + (lit ? ' is-on' : '');
    if (id === firstId) li.classList.add('is-first');
    var pin = document.createElement('span');
    pin.className = 'guide-pin';
    pin.textContent = String(number);
    var label = document.createElement('b');
    label.textContent = info && info.title ? info.title : id;
    if (route.pace === 'cheap' && guide.priceLabel) {
      var price = guide.priceLabel(id);
      if (price) {
        var note = document.createElement('small');
        note.className = 'guide-stop-price';
        note.textContent = price;
        label.appendChild(note);
      }
    }
    li.appendChild(pin);
    li.appendChild(label);
    return li;
  }

  function renderFlat(lit) {
    var list = document.createElement('ol');
    list.className = 'guide-flat';
    route.stops.forEach(function (id, index) {
      var li = stopNode(id, index + 1, lit, route.stops[0]);
      if (!lit) li.classList.remove('is-on');
      list.appendChild(li);
    });
    stopsBox.appendChild(list);
  }

  function renderStops(lit) {
    if (!stopsBox || !route || !core || !core.sectionsFor) return;
    stopsBox.textContent = '';
    if (route.pace === 'cheap') {
      renderFlat(lit);
      return;
    }
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
        var li = stopNode(id, number, lit || open, firstId);
        if (!(lit || open)) li.classList.remove('is-on');
        number += 1;
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
      answers.pace = '';
      paintPace();
      applyRoute(false);
      lightStops(run);
    }
    if (step === 4 && stopsBox) {
      var first = stopsBox.querySelector('.guide-fold.is-open .guide-stop, .guide-flat .guide-stop');
      if (first) first.classList.add('is-first');
    }
  }

  function paintPace() {
    if (!paceBox) return;
    paceBox.querySelectorAll('[data-pace]').forEach(function (button) {
      var on = button.getAttribute('data-pace') === answers.pace;
      button.classList.toggle('is-pick', on);
      button.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function applyRoute(lit) {
    route = guide.routeFor(answers);
    var href = '/destination';
    if (core && core.stopHref) href = core.stopHref(shownFirstId()) || href;
    else if (route.firstHref) href = route.firstHref;
    if (cta) cta.setAttribute('href', href);
    persist(route);
    renderStops(!!lit);
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
    var paceBtn = event.target.closest('[data-pace]');
    if (paceBtn && root.contains(paceBtn)) {
      var pace = paceBtn.getAttribute('data-pace');
      answers.pace = answers.pace === pace ? '' : pace;
      paintPace();
      applyRoute(true);
      return;
    }
    var nextWant = event.target.closest('[data-guide-next]');
    if (nextWant && root.contains(nextWant)) {
      if (nextWant.disabled || !answers.wants.length) return;
      answers.want = answers.wants[0];
      show(3);
      return;
    }
    var choice = event.target.closest('[data-guide-choice]');
    if (choice && root.contains(choice)) {
      var key = choice.getAttribute('data-guide-choice');
      var value = choice.getAttribute('data-value');
      if (key === 'want') {
        var at = answers.wants.indexOf(value);
        if (at === -1) answers.wants.push(value);
        else answers.wants.splice(at, 1);
        var on = at === -1;
        choice.classList.toggle('is-pick', on);
        choice.setAttribute('aria-pressed', on ? 'true' : 'false');
        answers.want = answers.wants[0] || '';
        if (nextBtn) nextBtn.disabled = answers.wants.length === 0;
        return;
      }
      answers[key] = value;
      choice.classList.add('is-pick');
      window.setTimeout(function () { show(2); }, reduceMotion() ? 0 : 160);
      return;
    }
    var skip = event.target.closest('[data-guide-skip]');
    if (skip && root.contains(skip)) {
      event.preventDefault();
      token += 1;
      guide.mark('skipped', answers);
      saveGuide('skipped');
      window.location.href = '/destination';
    }
  });

  if (cta) {
    cta.addEventListener('click', function () {
      token += 1;
      if (!route) route = guide.routeFor(answers);
      persist(route);
      guide.mark('completed', answers);
      saveGuide('completed');
      cta.setAttribute('href', (core && core.stopHref ? core.stopHref(shownFirstId()) : route.firstHref) || '/destination');
    });
  }

  function saveGuide(status) {
    var built = guide.routeFor(answers);
    var roleEl = document.getElementById('guide-role');
    var payload = {
      status: status,
      song: answers.song || '',
      wants: (answers.wants || []).slice(),
      route: (built && built.stops) || [],
      pace: answers.pace || '',
      role: roleEl ? String(roleEl.value || '') : ''
    };
    if (window.PlaigroundEvents && window.PlaigroundEvents.saveGuide) {
      window.PlaigroundEvents.saveGuide(payload);
    } else {
      (window.PlaigroundEventQueue = window.PlaigroundEventQueue || []).push(Object.assign({ kind: 'guide' }, payload));
    }
    if (status === 'completed') {
      (window.PlaigroundEventQueue = window.PlaigroundEventQueue || []).push({ name: 'route_map_built', payload: {} });
    }
  }

  show(1);
})();
