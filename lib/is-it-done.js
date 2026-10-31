// "Is it done?" check for the Done stop of the Song Helper road.
// Three taps. Free, no credits. Songs that are not ready go in the Drawer,
// and after 7 days plai offers to pull them back out.
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.IsItDone = api;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DRAWER_KEY = 'plaiground.songHelper.drawer';
  var DAY = 24 * 60 * 60 * 1000;
  var WAIT_DAYS = 7;

  // pass is the answer that means "ready". The line question is reversed: Yes is the bad answer.
  var QUESTIONS = [
    { id: 'moved', q: 'Did it move you?', pass: 'yes' },
    { id: 'bugs', q: 'Is there a line that bugs you every time?', pass: 'no' },
    { id: 'fun', q: 'Is it fun to sing out loud?', pass: 'yes' },
  ];

  var COPY = {
    title: 'Is it done?',
    intro: 'Three quick taps. Be honest, nobody is grading this.',
    done: 'It is done. That feeling right there, when nothing is left to add and it still lands, is the whole point. You finished a song. Most people never get here.',
    notYet: 'Not done yet, and that is normal. Fix the line that is in the way, or put it in the drawer and come back fresh.',
    fix: 'Fix that line',
    drawer: 'Put it in the drawer',
    pickLine: 'Tap the line that bugs you. I will open that part so you can fix it.',
    saved: 'In the drawer. I will bring it back in 7 days.',
    offer: 'Want to pull this one back out?',
    pull: 'Pull it out',
    later: 'Not yet',
  };

  function verdict(answers) {
    var a = answers || {};
    var misses = [];
    for (var i = 0; i < QUESTIONS.length; i += 1) {
      var q = QUESTIONS[i];
      if (a[q.id] !== 'yes' && a[q.id] !== 'no') return { complete: false, done: false, misses: [] };
      if (a[q.id] !== q.pass) misses.push(q.id);
    }
    return { complete: true, done: misses.length === 0, misses: misses };
  }

  function lineChoices(sections) {
    var out = [];
    (sections || []).forEach(function (row) {
      String(row && row.text || '').split(/\n/).forEach(function (line) {
        var t = line.trim();
        if (t && !/^\[.*\]$/.test(t)) out.push({ id: row.id, label: row.label || row.id, line: t });
      });
    });
    return out;
  }

  function readDrawer(store) {
    try { var list = JSON.parse(store.getItem(DRAWER_KEY) || '[]'); return Array.isArray(list) ? list : []; } catch (e) { return []; }
  }

  function writeDrawer(store, list) {
    try { store.setItem(DRAWER_KEY, JSON.stringify(list.slice(-30))); return true; } catch (e) { return false; }
  }

  function toDrawer(store, song, now) {
    var at = new Date(now == null ? Date.now() : now).toISOString();
    var sections = (song && song.sections || []).map(function (r) { return { id: r.id, kind: r.kind, label: r.label, text: r.text }; });
    var lyrics = song && song.lyrics || sections.map(function (r) { return '[' + r.label + ']\n' + r.text; }).join('\n\n');
    var first = lineChoices(sections)[0];
    var item = { id: 'd' + Date.parse(at), title: (song && song.title) || (first ? first.line : 'Untitled'), lyrics: lyrics, sections: sections, misses: song && song.misses || [], at: at, offeredAt: '' };
    var list = readDrawer(store);
    list.push(item);
    return writeDrawer(store, list) ? item : null;
  }

  // Oldest drawer song that has waited 7+ days and was not offered in the last day.
  function due(store, now) {
    var t = now == null ? Date.now() : now;
    var list = readDrawer(store).filter(function (x) {
      var at = Date.parse(x.at);
      if (!(at && t - at >= WAIT_DAYS * DAY)) return false;
      var off = Date.parse(x.offeredAt || '');
      return !(off && t - off < DAY);
    });
    list.sort(function (a, b) { return Date.parse(a.at) - Date.parse(b.at); });
    return list[0] || null;
  }

  function markOffered(store, id, now) {
    var list = readDrawer(store);
    list.forEach(function (x) { if (x.id === id) x.offeredAt = new Date(now == null ? Date.now() : now).toISOString(); });
    writeDrawer(store, list);
  }

  function pullOut(store, id) {
    var list = readDrawer(store);
    var hit = null;
    list = list.filter(function (x) { if (x.id === id) { hit = x; return false; } return true; });
    writeDrawer(store, list);
    return hit;
  }

  function dateLabel(iso) {
    var d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // DOM pieces. opts: { sections(), onFix(sectionId, line), store, onDrawer(item) }
  function mount(host, opts) {
    if (!host || typeof document === 'undefined') return null;
    var store = opts.store || window.localStorage;
    var box = host.querySelector('.sh-done-check');
    if (box) box.parentNode.removeChild(box);
    box = document.createElement('div');
    box.className = 'sh-done-check sh-craft';
    var answers = {};
    function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
    function button(label, cls, fn) { var b = el('button', cls, label); b.type = 'button'; b.addEventListener('click', fn); return b; }
    function paint() {
      box.textContent = '';
      box.appendChild(el('h3', 'sh-craft-title', COPY.title));
      box.appendChild(el('p', 'sh-help', COPY.intro));
      QUESTIONS.forEach(function (q) {
        var row = el('div', 'sh-done-q');
        row.setAttribute('data-q', q.id);
        row.appendChild(el('p', '', q.q));
        ['yes', 'no'].forEach(function (v) {
          var b = button(v === 'yes' ? 'Yes' : 'No', 'btn btn-md ' + (answers[q.id] === v ? 'btn-purple' : 'btn-ghost'), function () { answers[q.id] = v; paint(); });
          b.setAttribute('aria-pressed', answers[q.id] === v ? 'true' : 'false');
          row.appendChild(b);
        });
        box.appendChild(row);
      });
      var v = verdict(answers);
      if (!v.complete) return;
      if (v.done) { box.appendChild(el('p', 'v3-plai sh-done-yay', 'plai: ' + COPY.done)); return; }
      box.appendChild(el('p', 'v3-plai', 'plai: ' + COPY.notYet));
      var acts = el('div', 'sh-side-actions');
      var picker = el('div', 'sh-done-lines');
      acts.appendChild(button(COPY.fix, 'btn btn-purple btn-md sh-done-fix', function () {
        picker.textContent = '';
        picker.appendChild(el('p', 'sh-help', COPY.pickLine));
        lineChoices(opts.sections()).forEach(function (c) {
          picker.appendChild(button(c.label + ': ' + c.line, 'btn btn-ghost btn-md sh-done-line', function () { opts.onFix(c.id, c.line); }));
        });
      }));
      acts.appendChild(button(COPY.drawer, 'btn btn-ghost btn-md sh-done-drawer', function (ev) {
        var item = toDrawer(store, { sections: opts.sections(), misses: v.misses });
        ev.target.disabled = true;
        ev.target.textContent = item ? 'In the drawer, ' + dateLabel(item.at) : 'Could not save';
        if (item) { picker.textContent = ''; picker.appendChild(el('p', 'sh-help', COPY.saved)); if (opts.onDrawer) opts.onDrawer(item); }
      }));
      box.appendChild(acts);
      box.appendChild(picker);
    }
    paint();
    host.appendChild(box);
    return box;
  }

  // Offer card when Song Helper opens. opts: { store, onPull(item) }
  function offer(host, opts) {
    if (!host || typeof document === 'undefined') return null;
    var store = opts.store || window.localStorage;
    var item = due(store);
    if (!item) return null;
    markOffered(store, item.id);
    var card = document.createElement('div');
    card.className = 'sh-drawer-offer sh-craft';
    var p = document.createElement('p');
    p.className = 'v3-plai';
    p.textContent = 'plai: You put "' + item.title + '" in the drawer on ' + dateLabel(item.at) + '. ' + COPY.offer;
    card.appendChild(p);
    var acts = document.createElement('div');
    acts.className = 'sh-side-actions';
    var yes = document.createElement('button'); yes.type = 'button'; yes.className = 'btn btn-purple btn-md'; yes.textContent = COPY.pull;
    yes.addEventListener('click', function () { var got = pullOut(store, item.id); card.parentNode && card.parentNode.removeChild(card); if (got && opts.onPull) opts.onPull(got); });
    var no = document.createElement('button'); no.type = 'button'; no.className = 'btn btn-ghost btn-md'; no.textContent = COPY.later;
    no.addEventListener('click', function () { card.parentNode && card.parentNode.removeChild(card); });
    acts.appendChild(yes); acts.appendChild(no);
    card.appendChild(acts);
    host.insertBefore(card, host.firstChild);
    return card;
  }

  return { QUESTIONS: QUESTIONS, COPY: COPY, DRAWER_KEY: DRAWER_KEY, WAIT_DAYS: WAIT_DAYS, verdict: verdict, lineChoices: lineChoices, readDrawer: readDrawer, toDrawer: toDrawer, due: due, markOffered: markOffered, pullOut: pullOut, mount: mount, offer: offer };
}));
