// Song Helper Arcade (hidden preview). Three cards, one high score reveal.
(function () {
  'use strict';
  var A = window.Arcade;
  var root = document.getElementById('arc');
  var K = new URLSearchParams(location.search).get('k') || '';
  var WALLET = 'plaiground.v3.wallet';
  var BEST = 'plaiground.arcade.best';
  var SAVED = 'plaiground.arcade.saved';
  var ROAST_NOTE = 'Comedy parody. Not statements of fact.';
  var S;
  function fresh() {
    return { screen: 'home', card: '', type: '', sub: '', qIndex: 0, answers: {}, aiLevel: 'assist', vibe: '', title: '', length: 'Song', language: 'English',
      explicit: 'off', ageOk: false, built: [], slotIndex: 0, options: [], research: null, styleOverride: false, soundOpen: false, advOpen: false,
      sound: { genre: '', sub: '', instruments: [], vocal: '', custom: '', fusion: [] }, result: null, userWords: false, keptPlai: false,
      fix: { text: '', off: [], before: '', history: [], picking: null, options: [], scoreBefore: 0 },
      flip: { text: '', from: '', fromPrompt: '', showPrompt: false, target: '', fusion: [], fusionOn: false, vibe: '', level: '', keep: [] },
      battle: { round: 1, log: [], charged: false, bars: '' }, tune: { speed: '', bpm: '', vocals: '', gender: '', tone: '', must: [], energy: '', extra: '' }, tuneOpen: false, points: 0, busy: false, note: '', notice: '', crisis: false, history: [] };
  }
  S = fresh();

  // ---------- helpers ----------
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function btn(label, cls, onClick, disabled) { var b = el('button', cls || 'v3-go', label); b.type = 'button'; b.disabled = !!disabled; b.onclick = onClick; return b; }
  function wallet() { try { var w = JSON.parse(localStorage.getItem(WALLET) || ''); if (w && typeof w.freeLeft === 'number') return w; } catch (e) {} return { freeLeft: 1, credits: 0 }; }
  function canSpend() { return true; }
  function spend() { return true; }
  function refund() {}
  function priceTag() { return 'free'; }
  function go(screen) { if (Date.now() - (S.moodAt || 0) > 80) S.mood = ''; if (S.screen !== screen) { S.history.push(S.screen); S.points += 100; } S.screen = screen; S.note = ''; paint(); window.scrollTo(0, 0); }
  function back() { S.mood = ''; S.screen = S.history.pop() || 'home'; S.note = ''; paint(); }
  function post(action, extra) {
    var body = Object.assign({ action: action, company_website: '', k: K, state: stateForServer() }, extra || {});
    return fetch('/api/song-helper?action=' + action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'Something went wrong.' }; }).then(function (d) { d.__status = r.status; return d; }); })
      .catch(function () { return { ok: false, error: 'Connection hiccup. Try again.' }; })
      .then(function (d) { S.mood = d && d.ok ? 'gotit' : 'worried'; S.moodAt = Date.now(); return d; });
  }
  function stateForServer() {
    return { card: S.card, type: S.type, sub: S.sub, answers: S.answers, aiLevel: S.aiLevel, vibe: S.vibe, title: S.title, length: S.length, language: S.language,
      explicit: S.explicit, ageOk: S.ageOk, built: S.built, ideas: S.ideas || [], research: S.research, styleOverride: S.styleOverride, flip: S.flip };
  }
  function soundForStyle() { var s = S.sound; return { genre: s.genre, sub: s.sub, instruments: s.instruments, vocal: s.vocal, custom: s.custom, tune: S.tune, fusion: S.card === 'flip' && S.flip.fusionOn ? S.flip.fusion : s.fusion }; }
  function style() {
    var st = stateForServer();
    var snd = soundForStyle();
    if (S.card === 'flip' && !snd.genre && S.flip.target) snd.genre = S.flip.target;
    if (S.card === 'flip') { var fs = A.flipStyle(st, snd); S.flipExtras = fs; return fs.style; }
    return A.stylePrompt(st, snd);
  }
  function chips(list, isOn, onTap, cls) {
    var row = el('div', 'arc-chips');
    list.forEach(function (v) { var label = typeof v === 'string' ? v : v.label; var id = typeof v === 'string' ? v : v.id; var b = btn(label, 'arc-chip' + (isOn(id) ? ' on' : '') + (cls ? ' ' + cls : ''), function () { onTap(id); paint(); }); row.appendChild(b); });
    return row;
  }
  function input(value, ph, onInput, rows) {
    var t = el(rows ? 'textarea' : 'input', 'arc-input'); if (rows) t.rows = rows; t.placeholder = ph || ''; t.value = value || '';
    t.oninput = function () { onInput(t.value); if (A.crisis(t.value) && !S.crisis) { S.crisis = true; paintCrisis(); } };
    return t;
  }
  function plai(text) { var p = el('p', 'v3-plai arc-plai'); p.appendChild(el('b', '', 'Plai: ')); p.appendChild(document.createTextNode(text)); return p; }
  function copy(text, b) { (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () { b.textContent = 'Copied'; }, function () { b.textContent = 'Select and copy'; }); }
  function crisisCard() {
    var c = el('p', 'arc-crisis'); c.appendChild(document.createTextNode("You matter. If you're hurting, call or text 988 (US) or visit "));
    var a = el('a', '', '988lifeline.org'); a.href = A.CRISIS.href; a.target = '_blank'; a.rel = 'noopener'; c.appendChild(a);
    c.appendChild(document.createTextNode('. Want to keep writing? We can go slow.')); return c;
  }
  function paintCrisis() { var w = root.querySelector('.arc-wrap'); if (w && !w.querySelector('.arc-crisis')) w.insertBefore(crisisCard(), w.children[2] || null); }
  function syl(line) { return el('span', 'arc-syl', String(A.lineSyllables(line))); }

  // ---------- screens ----------
  var SCREENS = {};

  SCREENS.home = function (w) {
    w.appendChild(el('h1', 'arc-marquee', 'Song Lab'));
    var grid = el('div', 'arc-cards');
    A.CARDS.forEach(function (c) {
      var b = btn('', 'v3-cabinet arc-card cab-' + c.id, function () {
        var keepWallet = true; S = fresh(); S.card = c.id; if (keepWallet) {}
        go(c.id === 'scratch' ? 's-type' : (c.id === 'fix' ? 'f-paste' : 'x-paste'));
      });
      b.appendChild(el('b', '', c.label)); b.appendChild(el('small', '', c.small)); grid.appendChild(b);
    });
    w.appendChild(grid);
    w.appendChild(btn('\u2728 Give me ideas', 'v3-go arc-gi-start', function () { S = fresh(); S.gi = { seen: [] }; go('g-doors'); }));
    hotSlang(w);
  };

  // What's hot: slang of the day from data/slang.json (sourced daily research, no explicit words here).
  var slangCache = null;
  function hotSlang(w) {
    var box = el('section', 'arc-hot');
    box.appendChild(el('p', 'arc-kicker', "What's hot"));
    var body = el('div', 'arc-hot-body', 'Loading slang of the day...');
    box.appendChild(body);
    w.appendChild(box);
    var p = slangCache ? Promise.resolve(slangCache) : fetch('/data/slang.json', { headers: { Accept: 'application/json' } }).then(function (r) { return r.json(); }).then(function (d) { slangCache = d; return d; });
    p.then(function (d) {
      var rows = (d && Array.isArray(d.entries) ? d.entries : []).filter(function (r) { return r && r.word && r.meaning && !r.profanity; })
        .sort(function (a, b) { return String(b.logged_on || '').localeCompare(String(a.logged_on || '')); });
      if (!rows.length) { box.remove(); return; }
      var pick = rows[Math.floor(Date.now() / 86400000) % rows.length];
      body.textContent = '';
      body.appendChild(el('h3', 'arc-hot-word', pick.word));
      body.appendChild(el('p', '', pick.meaning));
      if (pick.example) body.appendChild(el('p', 'hint', '"' + pick.example + '"'));
      body.appendChild(el('p', 'hint', [pick.region_tag, pick.logged_on ? 'logged ' + pick.logged_on : ''].filter(Boolean).join(' · ')));
      var src = (pick.sources || []).filter(function (u) { return /^https:\/\//.test(u); })[0];
      var links = el('p', 'arc-hot-links');
      if (src) { var a1 = el('a', 'v3-link', 'Source'); a1.href = src; a1.target = '_blank'; a1.rel = 'noopener nofollow'; links.appendChild(a1); links.appendChild(document.createTextNode(' · ')); }
      var a2 = el('a', 'v3-link', 'All slang'); a2.href = '/slang'; links.appendChild(a2);
      body.appendChild(links);
    }).catch(function () { box.remove(); });
  }

  // ---------- Give me ideas ----------
  SCREENS['g-doors'] = function (w) {
    w.appendChild(plai('Real stories, your angle. Pick a door.'));
    var grid = el('div', 'arc-cards arc-gi-doors');
    A.IDEA_DOORS.forEach(function (d) {
      var b = btn('', 'v3-cabinet arc-card arc-gi-door gi-' + d.id, function () { S.gi.door = d.id; go('g-tiles'); });
      b.appendChild(el('b', '', d.label)); b.appendChild(el('small', '', d.small)); grid.appendChild(b);
    });
    w.appendChild(grid);
  };
  SCREENS['g-tiles'] = function (w) {
    var d = A.IDEA_DOORS.filter(function (x) { return x.id === S.gi.door; })[0] || A.IDEA_DOORS[0];
    w.appendChild(plai(d.id === 'news' ? 'What kind of story?' : 'What moves you?'));
    var grid = el('div', 'arc-tiles');
    d.tiles.forEach(function (t) {
      var b = btn('', 'v3-tile arc-tile', function () { S.gi.tile = t.id; S.gi.label = t.label; S.gi.ideas = []; S.gi.msg = ''; go('g-ideas'); fetchNewsIdeas(); });
      b.appendChild(el('b', '', t.label)); grid.appendChild(b);
    });
    w.appendChild(grid);
  };
  function fetchNewsIdeas() {
    S.gi.busy = true; S.gi.msg = ''; paint();
    post('arcade-news-ideas', { tile: S.gi.tile, seen: S.gi.seen }).then(function (d) {
      S.gi.busy = false;
      if (!d.ok) { S.gi.msg = d.error || A.NO_STORIES; paint(); return; }
      S.gi.ideas = d.ideas || []; S.gi.msg = d.empty ? (d.message || A.NO_STORIES) : '';
      S.gi.ideas.forEach(function (x) { S.gi.seen.push(x.link); });
      paint();
    });
  }
  function useNewsIdea(x) {
    var keep = S.gi;
    S = fresh(); S.card = 'scratch'; S.type = 'jam'; S.sub = ''; S.vibe = defaultVibe();
    S.answers = { topic: x.angle, detail: x.story };
    S.ideaList = [x.angle, x.story].concat(x.sides || []);
    S.ideas = [x.angle, x.story];
    S.newsIdea = x; S.gi = keep;
    S.qIndex = 2; go('s-q');
  }
  SCREENS['g-ideas'] = function (w) {
    w.appendChild(plai(S.gi.busy ? 'Reading this week\u2019s stories...' : 'Pick one. You set the vision.'));
    w.appendChild(el('p', 'arc-step', S.gi.label || ''));
    if (S.gi.msg) w.appendChild(el('p', 'flow-card hint arc-gi-empty', S.gi.msg));
    (S.gi.ideas || []).forEach(function (x) {
      var card = el('div', 'flow-card arc-gi-idea');
      card.appendChild(el('p', 'arc-gi-angle', x.angle));
      var st = el('p', 'arc-gi-story', 'The real story: ' + x.story + ' ');
      var a = el('a', 'arc-gi-src', (x.source || 'Source') + (x.date ? ', ' + x.date : '')); a.href = x.link; a.target = '_blank'; a.rel = 'noopener nofollow';
      st.appendChild(a); card.appendChild(st);
      if (x.sides && x.sides.length === 2) {
        card.appendChild(el('p', 'hint', 'Both sides. You pick the stance:'));
        var ul = el('ul', 'arc-gi-sides'); x.sides.forEach(function (sd) { ul.appendChild(el('li', '', sd)); }); card.appendChild(ul);
      }
      card.appendChild(btn('Use this idea', 'v3-mini', function () { useNewsIdea(x); }));
      w.appendChild(card);
    });
    w.appendChild(btn(S.gi.busy ? 'Thinking...' : 'More', 'v3-go', fetchNewsIdeas, S.gi.busy));
    w.appendChild(btn('Pick another tile', 'v3-link', function () { go('g-tiles'); }));
  };

  // Start From Scratch
  SCREENS['s-type'] = function (w) {
    w.appendChild(plai('What are we making?'));
    var grid = el('div', 'arc-tiles');
    A.TYPES.forEach(function (t) {
      var b = btn('', 'v3-tile arc-tile', function () {
        S.type = t.id; S.sub = ''; S.answers = {}; S.qIndex = 0; S.vibe = defaultVibe();
        if (t.sub) go('s-sub'); else go('s-q');
      });
      b.appendChild(el('b', '', t.label)); b.appendChild(el('small', '', t.small)); grid.appendChild(b);
    });
    w.appendChild(grid);
  };
  SCREENS['s-sub'] = function (w) {
    var t = A.TYPES.filter(function (x) { return x.id === S.type; })[0];
    w.appendChild(plai(S.type === 'tribute' ? "Who's it for?" : "Who's getting roasted?"));
    w.appendChild(chips(t.sub.map(function (id) { return { id: id, label: A.SUBS[id] }; }), function (id) { return S.sub === id; }, function (id) {
      S.sub = id; S.qIndex = 0; S.vibe = defaultVibe(); setTimeout(function () { go('s-q'); }, 0);
    }));
  };
  function defaultVibe() {
    if (S.sub === 'memory') return 'Sad';
    if (S.type === 'roast' || S.type === 'parody') return 'Funny';
    if (S.type === 'hype') return 'Hype';
    if (S.sub === 'occasion' || S.sub === 'fan') return 'Love';
    return 'Happy';
  }
  SCREENS['s-q'] = function (w) {
    var qs = A.questionsFor(S.type, S.sub);
    var q = qs[S.qIndex];
    if (!q) { go(S.sub === 'battle' ? 's-ai' : 's-ai'); return; }
    w.appendChild(el('p', 'arc-step', 'Question ' + (S.qIndex + 1) + ' of ' + qs.length));
    w.appendChild(plai(q.q));
    if (q.fromResearch && S.research) {
      var box = el('div', 'flow-card arc-research'); box.appendChild(el('h3', '', S.sub === 'celeb' ? 'Roast ammo (public info)' : "Here's what that song is about"));
      var ul = el('ul'); (S.research.topics || []).forEach(function (t) { ul.appendChild(el('li', '', t)); }); box.appendChild(ul);
      if (S.researchNotice) box.appendChild(el('p', 'hint', S.researchNotice));
      w.appendChild(box);
    }
    if (q.kind === 'chips') {
      var opts = q.options.slice();
      if (q.kind === 'chips' && q.fromResearch && S.research && S.research.angles && S.research.angles.length) opts = S.research.angles.slice(0, 3);
      w.appendChild(chips(opts, function (v) { return S.answers[q.key] === v; }, function (v) { S.answers[q.key] = v; }));
      if (q.other) w.appendChild(input(opts.indexOf(S.answers[q.key]) === -1 ? (S.answers[q.key] || '') : '', (q.otherPh || 'Something else? Type it'), function (v) { S.answers[q.key] = v; S.userWords = true; }));
      if (/^(spice|feel|twist)$/.test(q.key)) tunePanel(w, true);
    } else if (q.kind === 'text') {
      if (q.prefillFrom && !S.answers[q.key] && S.answers[q.prefillFrom]) S.answers[q.key] = S.answers[q.prefillFrom];
      w.appendChild(input(S.answers[q.key], q.ph, function (v) { S.answers[q.key] = v; S.userWords = true; }, q.rows || 3));
    } else if (q.kind === 'fields') {
      q.fields.forEach(function (f) { w.appendChild(input(S.answers[f[0]], f[1], function (v) { S.answers[f[0]] = v; })); });
    }
    w.appendChild(btn(S.busy ? 'Looking it up...' : 'Next', 'v3-go', function () {
      if (q.kind === 'fields' && !String(S.answers[q.fields[0][0]] || '').trim()) { S.note = 'Fill that in first.'; paint(); return; }
      if (q.research) {
        S.busy = true; paint();
        post('arcade-research').then(function (d) {
          S.busy = false;
          if (!d.ok) { S.note = d.error || 'Could not look that up.'; paint(); return; }
          S.research = d.research; S.researchNotice = d.notice || '';
          S.qIndex += 1; go('s-q');
        });
        return;
      }
      S.qIndex += 1; S.points += 100; paint();
    }, S.busy));
    w.appendChild(btn('Skip', 'v3-link', function () { S.qIndex += 1; paint(); }));
  };
  SCREENS['s-ai'] = function (w) {
    w.appendChild(plai("Who's holding the pen?"));
    var levels = A.AI_LEVELS.filter(function (l) { return l.id !== 'full' || !S.userWords; });
    if (S.sub === 'battle') levels = levels.filter(function (l) { return l.id !== 'human'; });
    var grid = el('div', 'arc-tiles');
    levels.forEach(function (l) {
      var b = btn('', 'v3-tile arc-tile' + (S.aiLevel === l.id ? ' on' : ''), function () { S.aiLevel = l.id; go(S.sub === 'battle' ? 's-battle' : 's-basics'); });
      b.appendChild(el('b', '', l.label)); b.appendChild(el('small', '', l.small)); grid.appendChild(b);
    });
    w.appendChild(grid);
    if (S.userWords) w.appendChild(el('p', 'hint', "You wrote some of this already, so All Plai is off. It's AI-assisted. Nice."));
  };
  function explicitToggle(w, required) {
    var box = el('div', 'arc-explicit');
    box.appendChild(chips(['Explicit off', 'Explicit OK'], function (v) { return (v === 'Explicit OK') === (S.explicit === 'ok'); }, function (v) { S.explicit = v === 'Explicit OK' ? 'ok' : 'off'; if (S.explicit === 'off') S.ageOk = false; }));
    if (S.explicit === 'ok') {
      var l = el('label', 'arc-age'); var c = el('input'); c.type = 'checkbox'; c.checked = S.ageOk; c.onchange = function () { S.ageOk = c.checked; };
      l.appendChild(c); l.appendChild(document.createTextNode(" I'm 18+ and I agree")); box.appendChild(l);
    }
    if (required) box.appendChild(el('p', 'hint', 'Spicy and Filthy need Explicit OK and the 18+ check.'));
    w.appendChild(box);
  }
  // Optional Fine-tune panel under the vibe. Everything feeds the style prompt.
  function tunePanel(w, preview) {
    var T = A.TUNE, t = S.tune;
    w.appendChild(btn((S.tuneOpen ? '\u25BE ' : '\u25B8 ') + 'Fine-tune (optional)', 'arc-tune-toggle', function () { S.tuneOpen = !S.tuneOpen; paint(); }));
    if (!S.tuneOpen) return;
    var box = el('div', 'arc-tune');
    var one = function (label, key, list) {
      box.appendChild(el('p', 'arc-q', label));
      box.appendChild(chips(list, function (v) { return t[key] === v; }, function (v) { t[key] = t[key] === v ? '' : v; }, 'small'));
    };
    one('Speed', 'speed', T.speed);
    var bpm = el('input', 'arc-input arc-tune-bpm'); bpm.type = 'number'; bpm.min = 40; bpm.max = 220; bpm.inputMode = 'numeric'; bpm.placeholder = 'BPM, if you know it'; bpm.value = t.bpm || '';
    bpm.onchange = function () { t.bpm = bpm.value; paint(); }; box.appendChild(bpm);
    one('Vocals', 'vocals', T.vocals);
    box.appendChild(el('p', 'arc-q', 'Voice'));
    box.appendChild(chips(T.gender, function (v) { return t.gender === v; }, function (v) { t.gender = t.gender === v ? '' : v; if (v === 'Surprise me') t.surprise = 1 + Math.floor(Math.random() * 1e6); }, 'small'));
    box.appendChild(btn((S.shapeOpen ? '\u25BE ' : '\u25B8 ') + 'Shape the voice', 'arc-tune-toggle arc-shape-toggle', function () { S.shapeOpen = !S.shapeOpen; paint(); }));
    if (S.shapeOpen) {
      t.voiceShape = t.voiceShape || {};
      Object.keys(T.shape).forEach(function (k) {
        box.appendChild(el('p', 'arc-q arc-q-sm', A.SHAPE_LABEL[k]));
        box.appendChild(chips(T.shape[k], function (v) { return t.voiceShape[k] === v; }, function (v) { t.voiceShape[k] = t.voiceShape[k] === v ? '' : v; }, 'small'));
      });
    }
    box.appendChild(el('p', 'hint arc-voice-line', 'Voice: ' + A.voiceDescriptor(stateForServer(), t)));
    box.appendChild(el('p', 'arc-q', 'Must-have instruments'));
    box.appendChild(chips(T.must, function (v) { return t.must.indexOf(v) !== -1; }, function (v) { var i = t.must.indexOf(v); if (i === -1) t.must.push(v); else t.must.splice(i, 1); }, 'small'));
    one('Energy build', 'energy', T.energy);
    box.appendChild(el('p', 'arc-q', 'Anything else?'));
    var ex = el('input', 'arc-input'); ex.maxLength = 120; ex.placeholder = 'a sound, a texture, a feeling (no artist names)'; ex.value = t.extra || '';
    ex.onchange = function () { t.extra = ex.value; paint(); }; box.appendChild(ex);
    if (preview) { box.appendChild(el('p', 'arc-q', 'Style prompt')); box.appendChild(el('pre', 'arc-style', style())); }
    w.appendChild(box);
  }

  function ideaChips(w) {
    S.ideas = S.ideas || [];
    var box = el('div', 'flow-card arc-ideas');
    box.appendChild(el('p', 'arc-q', 'Idea chips'));
    if (S.ideaList && S.ideaList.length) {
      box.appendChild(el('p', 'hint', 'Tap the ideas you want in the song.' + (/^(tribute|roast|parody)$/.test(S.type) ? ' Facts marked (unsure) may be wrong.' : '')));
      box.appendChild(el('p', 'hint', 'Plai picked her top ' + S.ideas.length + '. Tap to swap or remove.'));
      box.appendChild(chips(S.ideaList, function (v) { return S.ideas.indexOf(v) !== -1; }, function (v) { var i = S.ideas.indexOf(v); if (i === -1) S.ideas.push(v); else S.ideas.splice(i, 1); }, 'small'));
      var own = el('input', 'arc-input'); own.maxLength = 80; own.placeholder = 'Add your own idea';
      own.onchange = function () { var v = String(own.value || '').trim(); if (v && S.ideaList.indexOf(v) === -1) { S.ideaList.push(v); S.ideas.push(v); } paint(); };
      box.appendChild(own);
    }
    box.appendChild(btn(S.ideaBusy ? 'Thinking...' : (S.ideaList && S.ideaList.length ? 'More ideas' : 'Give me idea chips'), 'v3-mini', function () {
      S.ideaBusy = true; paint();
      post('arcade-ideas').then(function (d) { S.ideaBusy = false; if (d.ok) { S.ideaList = (d.ideas || []).concat(S.ideas.filter(function (x) { return (d.ideas || []).indexOf(x) === -1; })); if (!S.ideas.length) S.ideas = S.ideaList.filter(function (x) { return !/\(unsure\)/i.test(x); }).slice(0, 4); } else S.note = d.error || 'No ideas right now.'; paint(); });
    }, S.ideaBusy));
    w.appendChild(box);
  }
  SCREENS['s-basics'] = function (w) {
    w.appendChild(plai('Set the vibe.'));
    if (!S.title) S.title = A.suggestTitle(stateForServer());
    w.appendChild(chips(A.VIBES, function (v) { return S.vibe === v; }, function (v) { S.vibe = v; }));
    tunePanel(w, false);
    w.appendChild(el('p', 'arc-q', 'Title'));
    w.appendChild(input(S.title, 'Title', function (v) { S.title = v; }));
    ideaChips(w);
    w.appendChild(el('p', 'arc-q', 'Sound'));
    w.appendChild(el('pre', 'arc-style', style()));
    if (S.type === 'parody') w.appendChild(el('p', 'hint', S.research && S.research.sound ? 'Matches the original sound, described without names.' : 'Pick a sound below to match the original.'));
    var adv = btn(S.advOpen ? 'Hide Advanced' : (S.type === 'parody' ? 'Advanced: change the style' : 'Change the sound'), 'v3-link', function () { S.advOpen = !S.advOpen; if (S.type === 'parody') S.styleOverride = S.advOpen; paint(); });
    w.appendChild(adv);
    if (S.advOpen) {
      soundPanel(w);
      w.appendChild(el('p', 'arc-q', 'Length'));
      w.appendChild(chips(['Short', 'Song', 'Long'], function (v) { return S.length === v; }, function (v) { S.length = v; }));
      w.appendChild(el('p', 'arc-q', 'Language'));
      w.appendChild(chips(['English', 'Spanish', 'Spanglish'], function (v) { return S.language === v; }, function (v) { S.language = v; }));
    }
    if (S.type === 'roast') explicitToggle(w, false);
    if (S.aiLevel === 'assist') w.appendChild(btn('Make the whole song (' + priceTag(1) + ')', 'v3-mini', function () { if (S.explicit === 'ok' && !S.ageOk) { S.note = 'Tick the 18+ box, or switch Explicit off.'; paint(); return; } writeSong(); }));
    w.appendChild(btn(S.aiLevel === 'full' ? 'Write it (' + priceTag(1) + ')' : 'Start building', 'v3-go', function () {
      if (S.explicit === 'ok' && !S.ageOk) { S.note = 'Tick the 18+ box, or switch Explicit off.'; paint(); return; }
      if (S.aiLevel === 'full') writeSong(); else { S.slotIndex = 0; S.built = []; go('s-build'); if (S.aiLevel === 'assist') fetchLines(); }
    }));
  };
  var SLOTS = ['Chorus line 1', 'Chorus line 2', 'Chorus line 3', 'Chorus line 4', 'Verse line 1', 'Verse line 2', 'Verse line 3', 'Verse line 4'];
  function fetchLines(one) {
    S.busy = true; paint();
    post('arcade-lines', { slot: SLOTS[S.slotIndex].split(' ')[0].toLowerCase(), left: 4 - (S.slotIndex % 4) }).then(function (d) {
      S.busy = false;
      if (!d.ok) { S.note = d.error || 'Plai is stuck. Write your own.'; paint(); return; }
      var fresh = (window.Arcade && Arcade.dedupeLines) ? Arcade.dedupeLines(d.lines || [], S.built) : (d.lines || []);
      S.options = one ? [fresh[0]].concat(S.options.slice(1)) : fresh; S.notice = d.notice || ''; paint();
      if (TALK.on && S.options.length) say('Here are your options. ' + S.options.map(function (o, i) { return 'Option ' + (i + 1) + '. ' + String(o).split(' / ').join('. '); }).join(' ') + ' Tap the one you want.');
    });
  }
  SCREENS['s-build'] = function (w) {
    w.appendChild(plai(S.aiLevel === 'human' ? 'Write your next line. I count the syllables.' : 'Pick your next line.'));
    var song = el('div', 'flow-card arc-built');
    S.built.forEach(function (l, i) { var p = el('p', 'arc-line'); p.appendChild(syl(l)); p.appendChild(document.createTextNode(' ' + l)); var flag = mismatch(i); if (flag) p.classList.add('amber'); song.appendChild(p); });
    if (S.built.length) w.appendChild(song);
    if (S.slotIndex >= SLOTS.length) { w.appendChild(btn('Finish my song (' + priceTag(S.aiLevel === 'human' ? 0 : 1) + ')', 'v3-go', writeSong)); return; }
    w.appendChild(el('p', 'arc-step', SLOTS[S.slotIndex]));
    if (S.aiLevel !== 'human') {
      if (S.notice) w.appendChild(el('p', 'hint', S.notice));
      var left = 4 - (S.slotIndex % 4);
      S.options.forEach(function (o) {
        var two = String(o).split(' / ');
        if (two.length === 2 && left >= 2) {
          var card = el('div', 'v3-tile arc-option arc-couplet');
          two.forEach(function (l) { var p = el('p', 'arc-line'); p.appendChild(syl(l)); p.appendChild(document.createTextNode(' ' + l)); card.appendChild(p); });
          var row = el('div', 'arc-couplet-btns');
          row.appendChild(btn('Use both', 'v3-mini', function () { S.built.push(two[0], two[1]); S.keptPlai = true; S.mood = 'landed'; S.slotIndex += 1; nextSlot(); }));
          row.appendChild(btn('Just line 1', 'v3-mini', function () { S.built.push(two[0]); S.keptPlai = true; S.mood = 'landed'; nextSlot(); }));
          card.appendChild(row); w.appendChild(card); return;
        }
        var one1 = two[0];
        var b = btn('', 'v3-tile arc-option', function () { S.built.push(one1); S.keptPlai = true; S.mood = 'landed'; nextSlot(); });
        b.appendChild(syl(one1)); b.appendChild(document.createTextNode(' ' + one1)); w.appendChild(b);
      });
      w.appendChild(btn(S.busy ? 'Thinking...' : 'Give me a line', 'v3-mini', function () { fetchLines(true); }, S.busy));
    }
    var own = input('', 'Or write your own line', function (v) { S.ownLine = v; });
    w.appendChild(own);
    var rhymeBox = el('div', 'arc-rhymes');
    w.appendChild(btn('Rhymes', 'v3-mini', function () {
      var last = String(S.built[S.built.length - 1] || own.value || '').split(/\s+/).pop().replace(/[^a-z']/ig, '');
      if (!last) return;
      fetch('https://api.datamuse.com/words?max=12&rel_rhy=' + encodeURIComponent(last)).then(function (r) { return r.json(); }).then(function (rows) {
        rhymeBox.textContent = rows.length ? 'Rhymes for ' + last + ': ' + rows.map(function (x) { return x.word; }).join(', ') : 'No perfect rhymes. Try a near rhyme.';
      }).catch(function () { rhymeBox.textContent = 'Rhymes are offline.'; });
    }));
    w.appendChild(rhymeBox);
    w.appendChild(btn('Use my line', 'v3-go', function () { var v = String(S.ownLine || '').trim(); if (!v) return; S.built.push(v); (S.ownLines = S.ownLines || []).push(v); S.userWords = true; S.ownLine = ''; S.mood = 'landed'; nextSlot(); }));
    if (S.aiLevel !== 'human') w.appendChild(btn('Make the whole song (' + priceTag(1) + ')', 'v3-go', writeSong));
    w.appendChild(btn('Finish now (' + priceTag(S.aiLevel === 'human' ? 0 : 1) + ')', 'v3-link', writeSong));
  };
  function mismatch(i) { var j = i >= 4 ? i - 4 : i + 4; return S.built[j] && Math.abs(A.lineSyllables(S.built[i]) - A.lineSyllables(S.built[j])) > 2; }
  function nextSlot() { S.slotIndex += 1; S.points += 50; S.options = []; paint(); if (S.aiLevel === 'assist' && S.slotIndex < SLOTS.length) fetchLines(); }

  function writeSong() {
    var human = S.aiLevel === 'human';
    if (human && !S.built.length) { S.note = 'Write at least one line first.'; paint(); return; }
    var before = wallet();
    if (!human && !spend()) { S.note = 'That takes 1 credit.'; paint(); return; }
    S.busy = true; S.note = 'Writing...'; paint();
    post('arcade-write').then(function (d) {
      S.busy = false;
      if (!d.ok) { if (!human) refund(before); S.note = d.error || 'Could not write that.'; paint(); return; }
      finish(d.lyrics, d, 0);
    }).catch(function () { if (!human) refund(before); S.busy = false; S.note = 'Plai lost the words.'; paint(); });
  }
  function finish(lyrics, d, scoreBefore) {
    S.result = { lyrics: lyrics, sample: !!(d && d.sample), notice: (d && d.notice) || '', scoreBefore: scoreBefore || 0, label: A.aiLabel(S) };
    if (d && d.crisis) S.crisis = true;
    go('reveal');
  }

  // Battle the Bot: 1 credit covers all 3 rounds.
  SCREENS['s-battle'] = function (w) {
    var b = S.battle;
    w.appendChild(el('p', 'arc-step', 'Round ' + Math.min(b.round, 3) + ' of 3'));
    var log = el('div', 'flow-card arc-battle');
    b.log.forEach(function (r) { log.appendChild(el('p', 'arc-tag', '[' + r.who + ']')); log.appendChild(el('pre', 'arc-bars', r.text)); });
    if (b.log.length) w.appendChild(log);
    if (!b.log.length) tunePanel(w, true);
    var plaiFirst = S.answers.first === 'Plai first';
    if (b.round > 3) { w.appendChild(btn('See the battle', 'v3-go', endBattle)); return; }
    var needUser = !(plaiFirst && b.log.length === 0);
    if (needUser) {
      w.appendChild(plai(b.log.length ? 'Your turn. Flip my last line back at me.' : 'Spit 8 bars. Use your 3 facts.'));
      w.appendChild(input(b.bars, 'Your bars, one per line', function (v) { b.bars = v; S.userWords = true; }, 8));
    } else {
      w.appendChild(plai('I go first. Brace yourself.'));
    }
    w.appendChild(btn(S.busy ? 'Plai is writing...' : (b.charged ? 'Fire' : 'Fire (all 3 rounds free)'), 'v3-go', function () {
      if (needUser && !String(b.bars || '').trim()) { S.note = 'Write your bars first.'; paint(); return; }
      var before = wallet();
      if (!b.charged) { if (!spend()) { S.note = 'That takes 1 credit.'; paint(); return; } b.charged = true; }
      if (needUser) b.log.push({ who: 'You', text: b.bars.trim() });
      var mine = b.bars; b.bars = ''; S.busy = true; paint();
      post('arcade-battle', { round: b.round, userBars: needUser ? mine : '', history: b.log.map(function (r) { return r.who + ': ' + r.text; }).join('\n') }).then(function (d) {
        S.busy = false;
        if (!d.ok) { if (b.log.length <= 1) { refund(before); b.charged = false; } if (needUser) { b.log.pop(); b.bars = mine; } S.note = d.error || 'Plai fumbled. Try again.'; paint(); return; }
        b.log.push({ who: 'Plai', text: d.bars }); S.notice = d.notice || '';
        if (!(plaiFirst && b.log.length === 1)) b.round += 1;
        S.points += 150; paint();
      });
    }, S.busy));
    if (b.log.length) w.appendChild(btn('End the battle', 'v3-link', endBattle));
  };
  function endBattle() {
    var text = S.battle.log.map(function (r) { return '[' + r.who + ']\n' + r.text; }).join('\n\n');
    S.title = S.title || 'Battle the Bot';
    finish(text, { notice: S.notice }, 0);
  }

  // ---------- Sound panel (all cards, 0 credits) ----------
  function soundPanel(w) {
    var s = S.sound;
    var box = el('div', 'flow-card arc-sound'); box.appendChild(el('h3', '', 'Fine-tune the sound (free)'));
    box.appendChild(chips(Object.keys(A.GENRES), function (g) { return s.genre === g; }, function (g) { s.genre = s.genre === g ? '' : g; s.sub = ''; S.styleOverride = true; }));
    if (s.genre) box.appendChild(chips(A.GENRES[s.genre], function (x) { return s.sub === x; }, function (x) { s.sub = s.sub === x ? '' : x; }, 'small'));
    box.appendChild(el('p', 'arc-q', 'Instruments'));
    box.appendChild(chips(A.INSTRUMENTS, function (x) { return s.instruments.indexOf(x) !== -1; }, function (x) { var i = s.instruments.indexOf(x); if (i === -1) s.instruments.push(x); else s.instruments.splice(i, 1); }, 'small'));
    box.appendChild(el('p', 'arc-q', 'Voice'));
    box.appendChild(chips(A.VOCALS, function (x) { return s.vocal === x; }, function (x) { s.vocal = s.vocal === x ? '' : x; }, 'small'));
    box.appendChild(input(s.custom, 'Anything else? e.g. vinyl crackle, big drop', function (v) { s.custom = v.replace(/\u2014|\u2013/g, ', '); }));
    box.appendChild(btn('Rebuild style prompt (free)', 'v3-mini', function () { if (S.result) S.result.style = style(); paint(); }));
    w.appendChild(box);
  }

  // ---------- Change line / Change topic on the finished song ----------
  function isOwn(l) { return (S.ownLines || []).indexOf(String(l).trim()) !== -1; }

  // Song Lab saves to the wannaplai account when signed in. Signed out, the local copy stays and My lyrics offers to import it after login.
  function markImported(item, id) {
    try { var list = JSON.parse(localStorage.getItem(SAVED) || '[]'); list.forEach(function (x) { if (x.at === item.at && x.title === item.title) x.accountId = id; }); localStorage.setItem(SAVED, JSON.stringify(list)); } catch (e) {}
  }
  function saveToAccount(item, b, w) {
    var old = w.querySelector('.arc-save-note'); if (old) old.remove();
    var note = el('div', 'arc-save-note');
    function done(html) { note.innerHTML = html; b.insertAdjacentElement('afterend', note); }
    fetch('/api/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } }).then(function (me) {
      if (me.status === 401) {
        b.textContent = 'Saved on this device';
        done('<p><strong>Sign up free to save to your account.</strong> Your song stays on this device until you do. After you log in, import it from My lyrics.</p><p><a class="v3-mini arc-tiny" href="/signup.html?next=/my-lyrics">Sign up free</a> <a class="v3-mini arc-tiny" href="/login.html?next=/my-lyrics">Log in</a></p>');
        return;
      }
      if (!me.ok) throw new Error('me');
      return fetch('/api/me/lyrics', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ song: { title: item.title || '', text: item.lyrics || '', mode: String(item.card || '').slice(0, 40), mood: String(item.type || '').slice(0, 40) } }) }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) {
          if (!r.ok || !d || !d.song) { b.textContent = 'Saved on this device'; done('<p>' + ((d && d.error) ? String(d.error).replace(/</g, '&lt;') : 'The account save did not go through. Your song stays on this device.') + '</p>'); return; }
          markImported(item, d.song.id);
          b.textContent = 'Saved to your account';
          done('<p><a class="v3-link" href="/my-lyrics?id=' + encodeURIComponent(d.song.id) + '">Open My lyrics</a></p>');
        });
      });
    }).catch(function () { b.textContent = 'Saved on this device'; done('<p>The account save did not go through. Your song stays on this device.</p>'); });
  }
  // Lyrics / Prompt / Both badge next to a question.
  function qHead(text, badge) {
    var p = el('p', 'arc-q arc-qhead'); p.appendChild(document.createTextNode(text));
    if (badge) { var b = el('span', 'arc-badge arc-badge-' + badge.toLowerCase(), badge === 'Lyrics' ? 'LYRICS' : badge === 'Prompt' ? 'PROMPT' : 'BOTH'); b.title = badge === 'Lyrics' ? 'Changes the words' : badge === 'Prompt' ? 'Changes the sound' : 'Changes the words and the sound'; p.appendChild(b); }
    return p;
  }
  // A to Z word library for the picked slang mode. Explicit words only show when explicit is on.
  function wordLibrary(w) {
    var mode = window.SlangMode && window.SlangMode.modeFor(S.flip.slang);
    var box = el('div', 'arc-words');
    var head = el('div', 'arc-words-head');
    head.appendChild(el('b', '', (mode ? mode.label : 'Slang') + ' words'));
    head.appendChild(btn('Close', 'v3-mini arc-tiny', function () { S.wordsOpen = false; paint(); }));
    box.appendChild(head);
    if (!SLANG.entries) { box.appendChild(el('p', 'hint', 'Loading words...')); w.appendChild(box); return; }
    var showX = S.explicit === 'ok' && S.ageOk;
    var list = SLANG.entries.filter(function (e) { return mode && e.region_tag === mode.region && (showX || !(e.explicit || e.profanity)); })
      .sort(function (a, b) { return a.word.replace(/^the /i, '').localeCompare(b.word.replace(/^the /i, '')); });
    box.appendChild(el('p', 'hint', list.length + ' words' + (showX ? '' : '. Explicit words are hidden.')));
    list.forEach(function (e) {
      var row = el('div', 'arc-word');
      var top = el('p', 'arc-word-top'); top.appendChild(el('b', '', e.word));
      if (e.explicit || e.profanity) top.appendChild(el('span', 'arc-pop-flag', '18+'));
      row.appendChild(top);
      row.appendChild(el('p', 'arc-word-def', e.define || e.meaning));
      if (e.example) row.appendChild(el('p', 'arc-pop-ex', '\u201c' + e.example + '\u201d'));
      box.appendChild(row);
    });
    var a = el('a', 'v3-link', 'Open on the slang page'); a.href = '/slang?region=' + encodeURIComponent(mode ? mode.region : '');
    box.appendChild(a);
    w.appendChild(box);
  }
  // Go more hyphy: one level up, same meaning and rhyme words, per-line undo.
  function goMoreHyphy(r) {
    var f = S.flip; var SM = window.SlangMode;
    var before = String(r.lyrics || '');
    var up = SM.nextLevel(f.hyphy || 'hyphy');
    S.busy = true; paint();
    var keep = f.hyphy; f.hyphy = up; f.boost = true;
    post('arcade-flip', { text: before }).then(function (d) {
      S.busy = false; f.boost = false;
      if (!d.ok || !d.lyrics) { f.hyphy = keep; S.note = d.error || 'Could not go more hyphy. Try again.'; paint(); return; }
      var a = before.split('\n'), b = String(d.lyrics).split('\n');
      if (a.length === b.length) {
        r.hyphyEdits = [];
        b.forEach(function (line, i) { if (line !== a[i]) r.hyphyEdits.push({ i: i, before: a[i], after: line, undone: false }); });
        r.lyrics = b.join('\n');
      } else { r.hyphyUndoAll = before; r.hyphyEdits = []; r.lyrics = d.lyrics; }
      r.style = ''; r.extras = null;
      paint();
    });
  }
  function hyphyEdits(w, r) {
    if (!(r.hyphyEdits && r.hyphyEdits.length) && !r.hyphyUndoAll) return;
    var box = el('div', 'flow-card arc-hy-edits');
    box.appendChild(el('p', 'arc-q', 'More hyphy: ' + (r.hyphyEdits || []).filter(function (e) { return !e.undone; }).length + ' lines changed'));
    (r.hyphyEdits || []).forEach(function (e) {
      var row = el('div', 'arc-hy-row' + (e.undone ? ' undone' : ''));
      row.appendChild(el('p', 'arc-hy-before', e.before));
      row.appendChild(el('p', 'arc-hy-after', e.after));
      row.appendChild(btn(e.undone ? 'Redo' : 'Undo', 'v3-mini arc-tiny', function () {
        var lines = String(r.lyrics).split('\n'); e.undone = !e.undone; lines[e.i] = e.undone ? e.before : e.after; r.lyrics = lines.join('\n'); paint();
      }));
      box.appendChild(row);
    });
    if (r.hyphyUndoAll) box.appendChild(btn('Undo all', 'v3-mini', function () { r.lyrics = r.hyphyUndoAll; r.hyphyUndoAll = null; paint(); }));
    w.appendChild(box);
  }
  // ---------- Slang: underline + tap to define ----------
  var SLANG = { entries: null, loading: false };
  function loadSlang() {
    if (SLANG.entries || SLANG.loading) return;
    SLANG.loading = true;
    fetch('/data/slang.json', { headers: { Accept: 'application/json' } }).then(function (r) { return r.json(); }).then(function (d) { SLANG.entries = (d && d.entries) || []; SLANG.loading = false; paint(); }).catch(function () { SLANG.loading = false; });
  }
  function slangMatcher() {
    var mode = S.card === 'flip' && S.flip && S.flip.slang && window.SlangMode ? window.SlangMode.modeFor(S.flip.slang) : null;
    if (!mode) return null;
    if (!SLANG.entries) { loadSlang(); return null; }
    // Anything that made it past the explicit gate gets defined, so every underline has an answer.
    return window.SlangMode.matcher(SLANG.entries, mode.region);
  }
  function slangLine(text, m) {
    var span = el('span', 'arc-line-text');
    window.SlangMode.findTerms(text, m).forEach(function (part) {
      if (!part.entry) { span.appendChild(document.createTextNode(part.text)); return; }
      var b = el('button', 'arc-slang', part.text); b.type = 'button';
      b.onclick = function (ev) { ev.stopPropagation(); showSlangPop(b, part.entry); };
      span.appendChild(b);
    });
    return span;
  }
  function showSlangPop(anchor, entry) {
    var old = document.querySelector('.arc-pop'); if (old) old.remove();
    var p = window.SlangMode.popover(entry); if (!p) return;
    var pop = el('div', 'arc-pop');
    pop.appendChild(el('b', 'arc-pop-word', p.word));
    if (p.explicit) pop.appendChild(el('span', 'arc-pop-flag', '18+'));
    pop.appendChild(el('p', 'arc-pop-def', p.define));
    if (p.example) pop.appendChild(el('p', 'arc-pop-ex', '\u201c' + p.example + '\u201d'));
    document.body.appendChild(pop);
    var r = anchor.getBoundingClientRect();
    var left = Math.max(8, Math.min(window.innerWidth - pop.offsetWidth - 8, r.left + window.scrollX - 12));
    pop.style.left = left + 'px'; pop.style.top = (r.bottom + window.scrollY + 6) + 'px';
    setTimeout(function () { document.addEventListener('click', function close() { pop.remove(); document.removeEventListener('click', close); }); }, 0);
  }
  function editLyrics(w, r) {
    var box = el('div', 'lyrics-preview arc-lyrics arc-edit');
    var lines = String(r.lyrics).split('\n');
    lines.forEach(function (l, i) {
      var t = l.trim();
      if (/^\[.*\]$/.test(t)) {
        var head = el('div', 'arc-sec');
        head.appendChild(el('strong', '', t));
        head.appendChild(btn(S.secBusy === i ? 'Thinking...' : 'Change topic', 'v3-mini arc-tiny', function () { changeTopic(r, i); }, S.secBusy === i));
        box.appendChild(head); return;
      }
      var row = el('div', 'arc-lrow');
      var sm = slangMatcher();
      row.appendChild(sm && l ? slangLine(l, sm) : el('span', '', l || '\u00a0'));
      if (t && isOwn(t)) row.appendChild(el('span', 'hint', ' (your line)'));
      else if (t) row.appendChild(btn(S.lineBusy === i ? '...' : 'Change line', 'v3-mini arc-tiny', function () { changeLine(r, i); }, S.lineBusy === i));
      box.appendChild(row);
    });
    w.appendChild(box);
  }
  function changeLine(r, i) {
    var lines = String(r.lyrics).split('\n');
    S.lineBusy = i; paint();
    post('arcade-fix', { text: r.lyrics, line: lines[i], off: [] }).then(function (d) {
      S.lineBusy = null;
      var opts = (d.options || []).filter(function (o) { return !lines.some(function (x) { return A.nearDuplicate(o, x); }); });
      if (opts.length) { lines[i] = opts[0]; r.lyrics = lines.join('\n'); r.label = 'AI-assisted'; } else S.note = 'No fresh line right now. Try again.';
      paint();
    });
  }
  function changeTopic(r, i) {
    var lines = String(r.lyrics).split('\n');
    var end = i + 1; while (end < lines.length && !/^\[.*\]$/.test(lines[end].trim())) end++;
    var section = lines.slice(i + 1, end);
    var pool = (S.ideaList || []).filter(function (x) { return x !== r['topic' + i]; });
    var unused = pool.filter(function (x) { return S.ideas.indexOf(x) === -1; });
    var idea = (unused.length ? unused : pool)[0] || 'a fresh image';
    r['topic' + i] = idea;
    S.secBusy = i; paint();
    post('arcade-section', { section: section.join('\n'), idea: idea, song: r.lyrics, keep: section.filter(isOwn) }).then(function (d) {
      S.secBusy = null;
      if (d.ok && d.lines && d.lines.length) { lines.splice.apply(lines, [i + 1, end - i - 1].concat(d.lines)); r.lyrics = lines.join('\n'); S.note = 'New topic: ' + idea; }
      else S.note = d.error || 'Could not change that part.';
      paint();
    });
  }

  // ---------- Reveal ----------
  SCREENS.reveal = function (w) {
    var r = S.result || { lyrics: '' };
    var best = Number(localStorage.getItem(BEST) || 0);
    var score = S.card === 'fix' ? A.songScore(r.lyrics) : S.points + A.songScore(r.lyrics);
    var high = score > best;
    if (high) localStorage.setItem(BEST, String(score));
    if (S.revealHigh == null || S.revealSeen !== r) { S.revealHigh = high; S.revealSeen = r; }
    w.appendChild(el('p', 'arc-kicker', high ? 'New high score!' : 'High score'));
    w.appendChild(el('h2', 'arc-marquee', S.title || A.suggestTitle(stateForServer())));
    if (S.card === 'fix' && r.scoreBefore) w.appendChild(el('p', 'arc-jump', 'Score ' + r.scoreBefore + ' to ' + score + (score > r.scoreBefore ? '. Look at that jump!' : '')));
    else w.appendChild(el('p', 'arc-jump', 'Score: ' + score.toLocaleString('en-US')));
    if (high) w.appendChild(el('div', 'arc-confetti', '\u2728 \u2728 \u2728'));
    if (r.notice) w.appendChild(el('p', 'hint', r.notice));
    w.appendChild(el('span', 'arc-label', r.label || A.aiLabel(S)));
    if (S.sub === 'battle') w.appendChild(chips(['You won', 'Plai won', 'Tie'], function (v) { return S.vote === v; }, function (v) { S.vote = v; }));
    if (S.card !== 'fix' && S.aiLevel !== 'human' && r.lyrics) editLyrics(w, r);
    else { var pre = el('pre', 'lyrics-preview arc-lyrics', r.lyrics || ''); w.appendChild(pre); }
    if (S.type === 'roast') w.appendChild(el('p', 'arc-parody-note', ROAST_NOTE));
    if (!r.style) r.style = style();
    if (S.card === 'flip' && !r.extras) { style(); r.extras = S.flipExtras || null; }
    if (S.card === 'flip' && S.flip.slang === 'bay' && window.SlangMode) {
      var lvl = window.SlangMode.level(S.flip.hyphy);
      var hb = el('div', 'arc-hy-bar');
      hb.appendChild(el('span', 'arc-badge arc-badge-both', 'BOTH'));
      hb.appendChild(el('span', 'hint', 'Hyphy level: ' + lvl.label));
      if (lvl.id !== 'dumb') hb.appendChild(btn(S.busy ? 'Going...' : 'Go more hyphy', 'v3-mini arc-hy-go', function () { goMoreHyphy(r); }, S.busy));
      w.appendChild(hb);
      hyphyEdits(w, r);
    }
    var fx = S.card === 'flip' ? r.extras : null;
    var tagged = function (t) { return fx && fx.voice && window.PromptCheck ? window.PromptCheck.tagLyrics(t, fx.voice) : t; };
    w.appendChild(el('p', 'arc-q', 'Style prompt'));
    w.appendChild(el('pre', 'arc-style', r.style));
    if (fx) {
      var tips = el('div', 'flow-card arc-flip-tips');
      tips.appendChild(el('p', 'arc-q', 'Exclude'));
      tips.appendChild(el('pre', 'arc-style arc-exclude', (fx.exclude || []).join(', ')));
      var bx = btn('Copy Exclude', 'v3-mini', function () { copy((fx.exclude || []).join(', '), bx); });
      tips.appendChild(bx);
      tips.appendChild(el('p', 'hint', 'Paste this into the Exclude box in your music AI. Leave "no" words out of the style box.'));
      tips.appendChild(el('p', 'arc-q', 'Suggested sliders'));
      tips.appendChild(el('p', 'arc-sliders', 'Weirdness about ' + fx.sliders.weirdness + '%  \u00b7  Style Influence about ' + fx.sliders.styleInfluence + '%'));
      tips.appendChild(el('p', 'hint', 'Copy lyrics adds voice tags like [Rap] and [Sung] so the voice stays put.'));
      tips.appendChild(el('p', 'hint', 'Lower weirdness keeps the voice natural. Style Influence near 65 follows the prompt without going stiff.'));
      w.appendChild(tips);
    }
    var row = el('div', 'arc-actions');
    var b1 = btn('Copy lyrics', 'v3-mini', function () { copy(S.type === 'roast' ? r.lyrics + '\n\n' + ROAST_NOTE : tagged(r.lyrics), b1); });
    var b2 = btn('Copy style', 'v3-mini', function () { copy(r.style, b2); });
    var b3 = btn('Copy both', 'v3-mini', function () { copy(tagged(r.lyrics) + '\n\nStyle prompt\n' + r.style + (fx ? '\n\nExclude\n' + (fx.exclude || []).join(', ') : ''), b3); });
    var b4 = btn('Save to my account', 'v3-mini', function () {
      try { var list = JSON.parse(localStorage.getItem(SAVED) || '[]'); list.push({ title: S.title, lyrics: S.type === 'roast' ? r.lyrics + '\n\n' + ROAST_NOTE : r.lyrics, style: r.style, label: r.label, card: S.card, type: S.type, sub: S.sub, fanSong: S.sub === 'fan', at: new Date().toISOString() }); localStorage.setItem(SAVED, JSON.stringify(list.slice(-50))); b4.textContent = 'Saving...'; } catch (e) { b4.textContent = 'Could not save'; return; } saveToAccount(list[list.length - 1], b4, w);
    });
    var b5 = btn('Fix', 'v3-mini', function () { var t = r.lyrics; var keepTitle = S.title; S = fresh(); S.card = 'fix'; S.title = keepTitle; S.fix.text = t; go('f-off'); });
    var b6 = btn('Flip', 'v3-mini', function () { var t = r.lyrics; var keepTitle = S.title; S = fresh(); S.card = 'flip'; S.title = keepTitle; S.flip.text = t; go('x-genre'); });
    var b7 = btn('Release', 'v3-mini', function () { copy(r.lyrics, b7); setTimeout(function () { location.href = '/upload.html'; }, 600); });
    [b1, b2, b3, b4, b5, b6, b7].forEach(function (b) { row.appendChild(b); });
    w.appendChild(row);
    w.appendChild(el('p', 'hint', 'Paste this into your favorite music maker. Release copies your lyrics and opens the release form. Your label: ' + (r.label || A.aiLabel(S)) + '.'));
    soundPanel(w);
    w.appendChild(btn('Play again', 'v3-link', function () { S = fresh(); paint(); }));
  };

  // ---------- Fix My Song ----------
  SCREENS['f-paste'] = function (w) {
    w.appendChild(plai('Paste your song. Tags like [Verse] and [Chorus] help.'));
    w.appendChild(input(S.fix.text, 'Your lyrics', function (v) { S.fix.text = v; }, 12));
    w.appendChild(btn('Next', 'v3-go', function () { if (String(S.fix.text).trim().length < 12) { S.note = 'Paste your song first.'; paint(); return; } go('f-off'); }));
  };
  SCREENS['f-off'] = function (w) {
    w.appendChild(plai('What feels off?'));
    w.appendChild(chips(A.OFF_CHIPS, function (v) { return S.fix.off.indexOf(v) !== -1; }, function (v) { var i = S.fix.off.indexOf(v); if (i === -1) S.fix.off.push(v); else S.fix.off.splice(i, 1); }));
    w.appendChild(btn('Read it', 'v3-go', function () { S.fix.scoreBefore = A.songScore(S.fix.text); var p = A.prepSections(S.fix.text, S.fix.off); S.fix.text = p.text; S.fix.chorusNote = p.note; go('f-read'); }));
    w.appendChild(btn('Clean up my lines (free)', 'v3-link', function () { S.fix.scoreBefore = A.songScore(S.fix.text); runShape('cleanup'); }, S.busy));
  };
  function readLine() {
    var flags = A.syllableFlags(S.fix.text); var n = flags.filter(function (f) { return f.flag; }).length;
    var bits = [];
    if (n) bits.push(n + ' line' + (n > 1 ? 's are' : ' is') + ' off-beat next to ' + (n > 1 ? 'their partners' : 'its partner'));
    else bits.push('The rhythm lines up well');
    if (S.fix.off.length) bits.push('you flagged ' + S.fix.off.join(', ').toLowerCase());
    var says = S.fix.off.map(function (c) { var f = A.chipFocus(c); return f ? f.say : ''; }).filter(Boolean);
    return bits.join(', and ') + '. ' + (says.length ? says.join(' ') + ' ' : '') + 'Tap a line for 3 rewrites, or fix it all.';
  }
  SCREENS['f-read'] = function (w) {
    w.appendChild(plai(readLine()));
    if (S.fix.chorusNote) w.appendChild(el('p', 'hint', S.fix.chorusNote));
    var list = el('div', 'flow-card arc-read');
    var lit = []; S.fix.off.forEach(function (c) { A.focusLines(S.fix.text, c).forEach(function (l) { lit.push(l); }); });
    A.splitLyrics(S.fix.text).forEach(function (sec) {
      list.appendChild(el('p', 'arc-tag', '[' + sec.label + ']'));
      sec.lines.forEach(function (line) {
        var f = A.syllableFlags(S.fix.text).filter(function (x) { return x.line === line; })[0];
        var b = btn('', 'arc-readline' + (f && f.flag ? ' amber' : '') + (lit.indexOf(line) !== -1 ? ' focus' : '') + (S.fix.picking === line ? ' on' : ''), function () { pickLine(line); });
        b.appendChild(syl(line)); b.appendChild(document.createTextNode(' ' + line)); list.appendChild(b);
        if (S.fix.picking === line) {
          if (S.busy) list.appendChild(el('p', 'hint', 'Thinking...'));
          S.fix.options.forEach(function (o) { var ob = btn('', 'v3-tile arc-option', function () { S.fix.history.push(S.fix.text); S.fix.text = S.fix.text.replace(line, o); S.fix.picking = null; S.fix.options = []; S.points += 50; paint(); }); ob.appendChild(syl(o)); ob.appendChild(document.createTextNode(' ' + o)); list.appendChild(ob); });
        }
      });
    });
    w.appendChild(list);
    if (S.fix.history.length) w.appendChild(btn('Undo last change', 'v3-link', function () { S.fix.text = S.fix.history.pop(); paint(); }));
    if (wantsTrim()) w.appendChild(btn('Cut it down (' + priceTag(1) + ')', 'v3-go', function () { go('f-trim'); }, S.busy));
    var focusChips = S.fix.off.filter(function (c) { return A.chipFocus(c); });
    focusChips.forEach(function (c) { if (S.fix.chorusNote && A.chipFocus(c).part === 'chorus') return; w.appendChild(btn(A.chipFocus(c).action + ' (' + priceTag(1) + ')', wantsTrim() ? 'v3-link' : 'v3-go', function () { fixAll(null, [c]); }, S.busy)); });
    w.appendChild(btn('Fix it all (' + priceTag(1) + ')', wantsTrim() || focusChips.length ? 'v3-link' : 'v3-go', fixAll, S.busy));
    w.appendChild(btn('Clean up my lines (free)', 'v3-link', function () { runShape('cleanup'); }, S.busy));
    w.appendChild(btn('Done, show my score', 'v3-link', function () { S.result = { lyrics: S.fix.text, scoreBefore: S.fix.scoreBefore, label: S.fix.history.length ? 'AI-assisted' : 'Human' }; go('reveal'); }));
  };
  function pickLine(line) {
    S.fix.picking = line; S.fix.options = []; S.busy = true; paint();
    post('arcade-fix', { text: S.fix.text, line: line, off: S.fix.off }).then(function (d) { S.busy = false; if (!d.ok) { S.note = d.error; paint(); return; } S.fix.options = d.options || []; paint(); });
  }
  function fixAll(ev, only) {
    if (!only && wantsTrim() && S.screen !== 'f-trim' && !S.fix.trimAsked) { S.fix.trimAsked = true; go('f-trim'); return; }
    var before = wallet(); if (!spend()) { S.note = 'That takes 1 credit.'; paint(); return; }
    S.busy = true; paint();
    post('arcade-fix', { text: S.fix.text, off: only || S.fix.off }).then(function (d) {
      S.busy = false;
      if (!d.ok) { refund(before); S.note = (d.error || 'Could not fix that.') + ''; paint(); return; }
      S.fix.before = d.before || S.fix.text; S.fix.after = d.lyrics; S.fix.notice = d.notice || ''; if (d.crisis) S.crisis = true; go('f-compare');
    });
  }
  SCREENS['f-compare'] = function (w) {
    w.appendChild(plai('Before and after. Keep it or undo.'));
    if (S.fix.notice) w.appendChild(el('p', 'hint', S.fix.notice));
    var grid = el('div', 'arc-compare');
    var l = el('div', 'flow-card'); l.appendChild(el('h3', '', 'Before')); l.appendChild(el('pre', 'arc-lyrics', S.fix.before));
    var r = el('div', 'flow-card'); r.appendChild(el('h3', '', 'After')); r.appendChild(el('pre', 'arc-lyrics', S.fix.after));
    grid.appendChild(l); grid.appendChild(r); w.appendChild(grid);
    w.appendChild(btn('Keep', 'v3-go', function () { S.fix.history.push(S.fix.before); S.fix.text = S.fix.after; S.result = { lyrics: S.fix.after, scoreBefore: S.fix.scoreBefore, label: 'AI-assisted', notice: S.fix.notice }; go('reveal'); }));
    w.appendChild(btn('Undo', 'v3-link', function () { back(); }));
  };

  // ---------- Too wordy (real cuts) and Clean up my lines (structure only) ----------
  function wantsTrim() { return S.fix.off.indexOf('Too wordy') !== -1; }
  function runShape(mode, level) {
    if (mode === 'trim') { var before = wallet(); if (!spend()) { S.note = 'That takes 1 credit.'; paint(); return; } }
    S.busy = true; S.fix.shapeMode = mode; S.fix.level = level || ''; paint();
    post('arcade-fix', { text: S.fix.text, mode: mode, level: level || '', off: S.fix.off }).then(function (d) {
      S.busy = false;
      if (!d.ok) { if (mode === 'trim') refund(before); S.note = d.error || 'Could not do that.'; paint(); return; }
      S.fix.shape = { items: d.items || [], before: d.wordsBefore, mode: mode, level: d.level || level, notice: d.notice || '', undone: {} };
      if (d.crisis) S.crisis = true;
      go('f-shape');
    });
  }
  function shapeText() { var sh = S.fix.shape; return sh ? A.draftText(sh.items, sh.undone) : S.fix.text; }
  SCREENS['f-trim'] = function (w) {
    w.appendChild(plai('How much should I cut? A little only deletes words. Tighten and Cut to the bone shorten each line in your own words, same rhyme at the end.'));
    var grid = el('div', 'arc-trim-levels');
    A.TRIM_LEVELS.forEach(function (lv) {
      var b = btn('', 'v3-tile arc-trim-level', function () { runShape('trim', lv.id); }, S.busy);
      b.appendChild(el('b', '', lv.label)); b.appendChild(el('small', '', lv.small)); grid.appendChild(b);
    });
    w.appendChild(grid);
    w.appendChild(el('p', 'hint', 'Your song: ' + A.countWords(S.fix.text) + ' words. Price: ' + priceTag(1) + '.'));
    if (S.busy) w.appendChild(el('p', 'hint', 'Cutting...'));
  };
  SCREENS['f-shape'] = function (w) {
    var sh = S.fix.shape; if (!sh) { back(); return; }
    var lv = sh.mode === 'trim' ? A.trimLevel(sh.level) : null;
    var after = A.countWords(shapeText());
    w.appendChild(plai(sh.mode === 'trim'
      ? (A.isRewriteLevel(sh.level) ? lv.label + ': each line is shorter in your own words, same last word. Cut words are crossed out. Tap Undo on any line to get it back.' : lv.label + ': cut words are crossed out. Tap Undo on any line to bring its words back.')
      : 'Same words, now in lines and sections. Nothing added, nothing cut.'));
    if (sh.notice) w.appendChild(el('p', 'hint', sh.notice));
    var pct = sh.before ? Math.round((1 - after / sh.before) * 100) : 0;
    w.appendChild(el('p', 'arc-wordcount', sh.before + ' words \u2192 ' + after + ' words' + (sh.mode === 'trim' ? ' (' + pct + '% shorter)' : '')));
    var list = el('div', 'flow-card arc-shape');
    sh.items.forEach(function (it, i) {
      if (it.tag) { list.appendChild(el('p', 'arc-tag', it.tag)); return; }
      if (it.gap) { list.appendChild(el('div', 'arc-gap')); return; }
      var cut = !!it.rewrite || it.words.some(function (x) { return !x.keep; });
      var undone = !!sh.undone[i];
      var row = el('div', 'arc-shape-line' + (undone ? ' undone' : ''));
      var p = el('p', 'arc-shape-words');
      it.words.forEach(function (x, j) {
        if (j) p.appendChild(document.createTextNode(' '));
        if (x.keep || undone) p.appendChild(document.createTextNode(x.w));
        else p.appendChild(el('s', 'arc-cut', x.w));
      });
      if (it.rewrite && !undone) { var box = el('div', 'arc-shape-pair'); box.appendChild(p); box.appendChild(el('p', 'arc-shape-new', it.rewrite)); row.appendChild(box); }
      else row.appendChild(p);
      if (cut) row.appendChild(btn(undone ? 'Keep cut' : 'Undo', 'v3-mini arc-shape-toggle', function () { if (sh.undone[i]) delete sh.undone[i]; else sh.undone[i] = true; paint(); }));
      list.appendChild(row);
    });
    w.appendChild(list);
    var row2 = el('div', 'arc-actions');
    row2.appendChild(btn('Keep this', 'v3-go', function () {
      var t = shapeText(); S.fix.history.push(S.fix.text); S.fix.before = S.fix.text; S.fix.text = t; S.fix.shape = null;
      S.result = { lyrics: t, scoreBefore: S.fix.scoreBefore, label: sh.mode === 'trim' ? 'AI-assisted' : (S.fix.history.length > 1 ? 'AI-assisted' : 'Human'), notice: sh.notice };
      go(sh.mode === 'trim' ? 'reveal' : 'f-read');
    }));
    if (sh.mode === 'trim') {
      A.TRIM_LEVELS.filter(function (x) { return x.id !== sh.level; }).forEach(function (x) { row2.appendChild(btn(x.label, 'v3-mini', function () { runShape('trim', x.id); }, S.busy)); });
    }
    row2.appendChild(btn('Undo all', 'v3-link', function () { S.fix.shape = null; back(); }));
    w.appendChild(row2);
    if (S.busy) w.appendChild(el('p', 'hint', 'Working...'));
  };

  // ---------- Flip My Song ----------
  SCREENS['x-paste'] = function (w) {
    w.appendChild(plai('Paste the song you want to flip.'));
    w.appendChild(input(S.flip.text, 'Your lyrics', function (v) { S.flip.text = v; }, 12));
    w.appendChild(btn('Next', 'v3-go', function () { if (String(S.flip.text).trim().length < 12) { S.note = 'Paste your song first.'; paint(); return; } go('x-genre'); }));
  };
  SCREENS['x-genre'] = function (w) {
    var f = S.flip;
    w.appendChild(plai('What is it now? (optional)'));
    w.appendChild(chips(Object.keys(A.GENRES), function (g) { return f.from === g; }, function (g) { f.from = f.from === g ? '' : g; }, 'small'));
    w.appendChild(btn(f.showPrompt ? 'Hide' : 'Paste my prompt', 'v3-link', function () { f.showPrompt = !f.showPrompt; paint(); }));
    if (f.showPrompt) w.appendChild(input(f.fromPrompt, 'Paste the style prompt you used', function (v) { f.fromPrompt = v; f.from = v.slice(0, 80); }, 3));
    w.appendChild(plai('Flip it to...'));
    w.appendChild(chips(Object.keys(A.GENRES).concat(['Fusion (mix two)']), function (g) { return g === 'Fusion (mix two)' ? f.fusionOn : (f.fusionOn ? f.fusion.indexOf(g) !== -1 : f.target === g); }, function (g) {
      if (g === 'Fusion (mix two)') { f.fusionOn = !f.fusionOn; f.fusion = []; return; }
      if (f.fusionOn) { var i = f.fusion.indexOf(g); if (i !== -1) f.fusion.splice(i, 1); else if (f.fusion.length < 2) f.fusion.push(g); f.target = f.fusion.join(' + '); }
      else { f.target = g; S.sound.genre = g; }
    }));
    if (f.fusionOn) w.appendChild(el('p', 'hint', 'Pick two genres to mix.'));
    w.appendChild(btn('Next', 'v3-go', function () { if (!f.target || (f.fusionOn && f.fusion.length < 2)) { S.note = 'Pick where it is going.'; paint(); return; } go('x-vibe'); }));
  };
  SCREENS['x-vibe'] = function (w) {
    var f = S.flip;
    w.appendChild(plai('Pick a vibe.'));
    w.appendChild(chips(Object.keys(A.FLIP_VIBES).map(function (k) { return { id: k, label: A.FLIP_VIBES[k].label }; }), function (k) { return f.vibe === k; }, function (k) { f.vibe = f.vibe === k ? '' : k; f.level = A.FLIP_VIBES[k] && A.FLIP_VIBES[k].levels ? A.FLIP_VIBES[k].levels[0] : ''; }));
    if (f.vibe && A.FLIP_VIBES[f.vibe].levels) w.appendChild(chips(A.FLIP_VIBES[f.vibe].levels, function (x) { return f.level === x; }, function (x) { f.level = x; }, 'small'));
    if (f.vibe === 'funny') w.appendChild(el('p', 'hint', 'Exaggerate, twist, punchlines. The hook stays.'));
    if (window.SlangMode) {
      w.appendChild(qHead('Slang mode', 'Both'));
      w.appendChild(chips([{ id: '', label: 'Off' }, { id: 'bay', label: 'Hyphy / Bay Area' }], function (k) { return (f.slang || '') === k; }, function (k) { f.slang = k; if (k) { loadSlang(); f.hyphy = f.hyphy || 'hyphy'; } }, 'small'));
      if (f.slang === 'bay') {
        w.appendChild(btn('See all words', 'v3-link arc-see-all', function () { S.wordsOpen = true; loadSlang(); paint(); }));
        w.appendChild(qHead('How hyphy?', 'Both'));
        w.appendChild(chips(window.SlangMode.LEVELS.map(function (L) { return { id: L.id, label: L.label }; }), function (k) { return (f.hyphy || 'hyphy') === k; }, function (k) { f.hyphy = k; }, 'small'));
        w.appendChild(el('p', 'hint', { little: '1 or 2 Bay words and a subtle bounce.', hyphy: 'Bay words, a chant hook, a [Hype Break] and a thumping bounce.', dumb: 'Slang in most lines, crowd ad-libs, 100 to 110 BPM, claps and chants.' }[f.hyphy || 'hyphy'] + ' Tap any underlined word to see what it means.'));
      }
      if (S.wordsOpen) wordLibrary(w);
    }
    tunePanel(w, true);
    if (f.vibe === 'dirty') { w.appendChild(el('p', 'hint', 'Innuendo, not graphic. Never minors, real named people, or non-consent.')); explicitToggle(w, f.level !== 'Flirty'); }
    w.appendChild(plai('Tap the lines to keep exactly as they are.'));
    var list = el('div', 'flow-card arc-read');
    A.splitLyrics(f.text).forEach(function (sec) {
      list.appendChild(el('p', 'arc-tag', '[' + sec.label + ']'));
      sec.lines.forEach(function (line) { var on = f.keep.indexOf(line) !== -1; list.appendChild(btn((on ? '\u2713 ' : '') + line, 'arc-readline' + (on ? ' on' : ''), function () { var i = f.keep.indexOf(line); if (i === -1) f.keep.push(line); else f.keep.splice(i, 1); paint(); })); });
    });
    w.appendChild(list);
    w.appendChild(btn(S.busy ? 'Flipping...' : 'Flip it (' + priceTag(1) + ')', 'v3-go', flipIt, S.busy));
  };
  function flipIt() {
    var f = S.flip;
    if (f.vibe === 'dirty' && f.level !== 'Flirty' && !(S.explicit === 'ok' && S.ageOk)) { S.note = 'Spicy and Filthy need Explicit OK and the 18+ check.'; paint(); return; }
    var before = wallet(); if (!spend()) { S.note = 'That takes 1 credit.'; paint(); return; }
    S.busy = true; paint();
    post('arcade-flip', { text: f.text }).then(function (d) {
      S.busy = false;
      if (!d.ok) { refund(before); S.note = (d.error || 'Could not flip that.') + ''; paint(); return; }
      S.userWords = true; S.aiLevel = 'assist';
      if (!S.title) S.title = 'The Flip';
      finish(d.lyrics, d, 0);
    });
  }

  // ---------- paint ----------
  // ---------- Plai hosts: one small pose plus one short line, inline so it never covers content ----------
  function hostPose() {
    if (S.crisis) return null;
    if (S.busy) return ['thinking', 'Writing. Give me a second.'];
    if (S.mood === 'worried' && S.note) return ['worried', "Hit a snag. Let's try that again."];
    if (S.screen === 'reveal') {
      return S.revealHigh ? ['dancing', 'New high score. You earned that one.'] : ['dancing', 'Song done. You set the vision, I kept up.'];
    }
    if (S.screen === 'home') return ['hello', "Three machines. Pick one and I'll host."];
    if (S.card === 'flip' && S.flip.vibe === 'surprise') return ['wink', 'Surprise me? Bold. I like it.'];
    if (S.mood === 'landed') { var n = S.built.length; return ['gotit', n === 1 ? 'Got it. 1 down.' : (n === 2 ? 'Two down. It is building.' : (n === 3 ? 'Three down. That has hook energy.' : n + ' down. Keep that run going.')), true]; }
    if (S.mood === 'gotit') return ['gotit', 'Got it. Take a look.', true];
    return SCREEN_HOST[S.screen] || null;
  }
  // A fitting pose and one short line for every step, so Plai stays with you the whole way.
  var SCREEN_HOST = {
    'g-doors': ['hello', 'Real stories make real songs.'],
    'g-tiles': ['thinking', 'Pick what pulls at you.'],
    'g-ideas': ['thinking', 'Facts from the story. The angle is yours.'],
    's-type': ['hello', 'Pick a game. Each one plays different.'],
    's-sub': ['wink', 'Good pick. Now narrow it down.'],
    's-q': ['thinking', 'Real details beat generic every time.'],
    's-ai': ['autopilot', 'Your call. You lead either way.'],
    's-basics': ['side', 'Set the vibe, then we roll.'],
    's-build': ['claim', 'Your story. One line at a time.'],
    's-battle': ['wink', 'Bring your best bars.'],
    'f-paste': ['hello', 'Drop it in. I read every line.'],
    'f-off': ['thinking', 'What bugs you? Be honest.'],
    'f-read': ['claim', 'Here is my read. Tap any line.'],
    'f-compare': ['gotit', 'Before and after. You decide.'],
    'x-paste': ['hello', 'Paste it. Same heart, new outfit.'],
    'x-genre': ['side', 'Where are we taking it?'],
    'x-vibe': ['wink', 'Pick a mood. Go big.']
  };
  var STEPS = {
    scratch: ['s-type', 's-sub', 's-q', 's-ai', 's-basics', 's-build', 'reveal'],
    fix: ['f-paste', 'f-off', 'f-read', 'f-compare', 'reveal'],
    flip: ['x-paste', 'x-genre', 'x-vibe', 'reveal']
  };
  function stepBar() {
    var list = STEPS[S.card]; if (!list || S.screen === 'home') return null;
    var cur = S.screen === 's-battle' ? 's-build' : S.screen;
    var i = list.indexOf(cur); if (i < 0) return null;
    var wrap = el('div', 'arc-steps'); wrap.setAttribute('aria-label', 'Step ' + (i + 1) + ' of ' + list.length);
    var bar = el('div', 'arc-steps-bar');
    list.forEach(function (_, k) { bar.appendChild(el('span', k < i ? 'done' : (k === i ? 'now' : ''))); });
    wrap.appendChild(el('span', 'arc-steps-n', i === list.length - 1 ? 'Final' : 'Step ' + (i + 1) + ' of ' + list.length));
    wrap.appendChild(bar);
    return wrap;
  }
  function host() {
    var p = hostPose(); if (!p) return null;
    var h = el('div', 'arc-host arc-host-' + p[0] + (p[2] ? ' arc-host-win' : '')); h.setAttribute('role', 'status');
    if (p[2]) { var sp = el('span', 'arc-sparkle'); sp.setAttribute('aria-hidden', 'true'); sp.textContent = '\u2726 \u2727 \u2726'; h.appendChild(sp); }
    var img = el('img', 'arc-host-img'); img.src = '/for-david-fv/img/plai-' + p[0] + '.webp'; img.alt = ''; img.width = 56; img.height = 104; img.decoding = 'async';
    h.appendChild(img);
    var say = el('p', 'arc-host-say'); say.appendChild(el('b', '', 'Plai')); say.appendChild(document.createTextNode(p[1])); h.appendChild(say);
    return h;
  }

  // ---------- Talk to Plai: she asks out loud, you answer by voice or typing ----------
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var TALK = { on: false, muted: false, key: '', phase: 'idle', heard: '', log: [], rec: null, listening: false, noMic: !SR, spoke: '' };
  function say(text) {
    if (TALK.muted || !('speechSynthesis' in window) || !text) return;
    try { speechSynthesis.cancel(); var u = new SpeechSynthesisUtterance(text); u.rate = 1.02; u.pitch = 1.08; u.onend = function () { if (TALK.phase === 'ask' || TALK.phase === 'confirm') listen(); }; speechSynthesis.speak(u); } catch (e) {}
  }
  function stopListen() { try { if (TALK.rec) TALK.rec.abort(); } catch (e) {} TALK.listening = false; }
  function listen() {
    if (!TALK.on || TALK.noMic || TALK.listening || S.busy || S.crisis) return;
    try {
      var r = new SR(); r.lang = 'en-US'; r.interimResults = false; r.maxAlternatives = 1;
      r.onresult = function (e) { var t = (e.results[0] && e.results[0][0] && e.results[0][0].transcript) || ''; TALK.listening = false; heard(t); };
      r.onerror = function (e) { TALK.listening = false; if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { TALK.noMic = true; TALK.micNote = 'Mic is off, so type your answer. I will still talk.'; } paint(); };
      r.onend = function () { if (TALK.listening) { TALK.listening = false; paint(); } };
      TALK.rec = r; TALK.listening = true; r.start(); paint();
    } catch (e) { TALK.listening = false; TALK.noMic = true; paint(); }
  }
  // What Plai is asking on this screen, and how a spoken answer is applied.
  function talkTarget() {
    if (S.screen === 's-type') return { ask: 'What are we making? Say a game, like parody or roast.', options: A.TYPES.map(function (t) { return t.label; }), pick: true };
    if (S.screen === 's-sub') { var t = A.TYPES.filter(function (x) { return x.id === S.type; })[0]; return { ask: S.type === 'tribute' ? "Who's it for?" : "Who's getting roasted?", options: (t && t.sub || []).map(function (id) { return A.SUBS[id]; }), pick: true }; }
    if (S.screen === 's-q') {
      var q = A.questionsFor(S.type, S.sub)[S.qIndex]; if (!q) return null;
      var opts = q.kind === 'chips' ? (q.fromResearch && S.research && S.research.angles && S.research.angles.length ? S.research.angles.slice(0, 3) : q.options) : null;
      return { ask: q.q + (q.kind === 'fields' && q.fields.length === 2 ? ' Say it like: title by artist.' : ''), q: q, options: opts, pick: false };
    }
    if ((S.screen === 's-basics' || S.screen === 'x-vibe') && (TALK.tuneStep || 0) < TUNE_Q.length) {
      var tq = TUNE_Q[TALK.tuneStep || 0];
      return { ask: tq.ask + ' Or say skip.', options: tq.options.concat(['Skip']), tune: tq.key, pick: false };
    }
    if (S.screen === 'f-paste' || S.screen === 'x-paste') return { ask: 'Say your lyrics, a line at a time. Tap Done when you are finished.', dictate: true };
    return null;
  }
  var TUNE_Q = [
    { key: 'speed', ask: 'Want to fine-tune? What speed: slow, mid, upbeat or fast?', options: A.TUNE.speed },
    { key: 'vocals', ask: 'Vocals: solo, duet, band with backing vocals, or choir?', options: A.TUNE.vocals },
    { key: 'gender', ask: 'Voice: male, female, or surprise me?', options: A.TUNE.gender },
    { key: 'tone', ask: 'Voice texture: raspy, smooth or airy?', options: A.TUNE.tone },
    { key: 'energy', ask: 'Energy: steady, slow build, big drop, or quiet to loud?', options: A.TUNE.energy }
  ];
  function norm(t) { return String(t || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function matchOption(text, options) {
    var t = norm(text); if (!options || !t) return '';
    var best = '', score = 0;
    options.forEach(function (o) {
      var words = norm(o).split(' ').filter(function (w) { return w.length > 2; });
      var hit = words.filter(function (w) { return t.indexOf(w) !== -1; }).length / Math.max(1, words.length);
      if (norm(o) === t) hit = 2;
      if (hit > score) { score = hit; best = o; }
    });
    return score >= 0.5 ? best : '';
  }
  function heard(text) {
    text = String(text || '').trim(); if (!text) { paint(); return; }
    if (A.crisis(text)) { S.crisis = true; TALK.phase = 'idle'; TALK.log.push({ who: 'you', text: text }); paint(); return; }
    var tg = talkTarget(); if (!tg) return;
    if (TALK.phase === 'confirm') {
      if (/\b(yes|yeah|yep|yup|right|correct|sure|ok|okay)\b/i.test(text)) return confirmYes();
      if (/\b(no|nope|nah|wrong|redo)\b/i.test(text)) return confirmNo();
    }
    TALK.log.push({ who: 'you', text: text });
    if (tg.dictate) { var k = S.screen === 'f-paste' ? 'fix' : 'flip'; S[k].text = (S[k].text ? S[k].text + '\n' : '') + text; TALK.phase = 'ask'; paint(); setTimeout(listen, 300); return; }
    var pick = tg.options ? matchOption(text, tg.options) : '';
    if (tg.tune && pick === 'Skip') { TALK.heard = 'Skip'; return confirmYes(); }
    if (tg.options && !pick && !(tg.q && tg.q.other)) { TALK.log.push({ who: 'plai', text: 'I did not catch that one. Try one of the buttons\u2019 words.' }); say('I did not catch that. Try one of the options.'); paint(); return; }
    TALK.heard = pick || text; TALK.phase = 'confirm';
    var line = 'So it\u2019s ' + TALK.heard + ', right?';
    TALK.log.push({ who: 'plai', text: line }); paint(); say(line);
  }
  function confirmNo() { stopListen(); TALK.phase = 'ask'; TALK.heard = ''; TALK.log.push({ who: 'plai', text: 'No problem. Say it again.' }); paint(); say('No problem. Say it again.'); }
  function clickBtn(label) { var b = Array.prototype.find.call(root.querySelectorAll('button'), function (x) { return x.textContent.trim().indexOf(label) === 0; }); if (b && !b.disabled) { b.click(); return true; } return false; }
  function confirmYes() {
    stopListen(); var tg = talkTarget(); var v = TALK.heard; if (!tg || !v) return;
    TALK.phase = 'done'; TALK.log.push({ who: 'plai', text: 'Got it.' }); S.mood = 'gotit'; S.moodAt = Date.now();
    if (tg.pick) { paint(); if (!clickBtn(v)) paint(); return; }
    if (tg.tune) { if (v !== 'Skip') { S.tune[tg.tune] = v; S.tuneOpen = true; } TALK.tuneStep = (TALK.tuneStep || 0) + 1; paint(); return; }
    var q = tg.q;
    if (q.kind === 'chips') { if (tg.options.indexOf(v) !== -1) S.answers[q.key] = v; else { S.answers[q.key] = v; S.userWords = true; } }
    else if (q.kind === 'fields') {
      if (q.fields.length === 2) { var m = v.split(/\s+by\s+/i); S.answers[q.fields[0][0]] = m[0].trim(); if (m[1]) S.answers[q.fields[1][0]] = m[1].trim(); }
      else S.answers[q.fields[0][0]] = v;
    } else { S.answers[q.key] = v; S.userWords = true; }
    paint(); clickBtn('Next');
  }
  // Called after every paint: speak once per new question, or hand off on tap screens.
  function talkTick(w) {
    if (S.screen === 'home') TALK.tuneStep = 0;
    if (!TALK.on) return;
    var tg = talkTarget();
    var key = S.screen + ':' + S.qIndex + ':' + (S.type || '') + ':' + (S.sub || '') + ':' + (TALK.tuneStep || 0);
    var box = el('div', 'arc-talk'); box.setAttribute('aria-live', 'polite');
    var head = el('div', 'arc-talk-head');
    var pose = !tg ? 'side' : (TALK.phase === 'confirm' || TALK.phase === 'done' ? 'gotit' : (TALK.listening ? 'thinking' : 'hello'));
    var img = el('img', 'arc-talk-img'); img.src = '/for-david-fv/img/plai-' + pose + '.webp'; img.alt = ''; head.appendChild(img);
    head.appendChild(el('b', '', TALK.listening ? 'Plai is listening...' : 'Talk to Plai'));
    var mute = btn(TALK.muted ? 'Unmute' : 'Mute', 'arc-talk-mute', function () { TALK.muted = !TALK.muted; if (TALK.muted) try { speechSynthesis.cancel(); } catch (e) {} paint(); });
    mute.setAttribute('aria-pressed', TALK.muted ? 'true' : 'false'); head.appendChild(mute);
    box.appendChild(head);
    if (S.crisis) { box.appendChild(el('p', 'arc-talk-msg plai', 'I am right here. Take your time. Talk mode is paused.')); w.insertBefore(box, w.children[2] || null); return; }
    if (!tg) {
      if (TALK.key !== key) { TALK.key = key; TALK.phase = 'idle'; stopListen(); say('Your turn to tap. I will pick back up on the next question.'); }
      box.appendChild(el('p', 'arc-talk-msg plai', 'Your turn to tap here. I will pick back up on the next question.'));
      w.insertBefore(box, w.children[2] || null); return;
    }
    if (TALK.key !== key) { TALK.key = key; TALK.phase = 'ask'; TALK.heard = ''; TALK.log = [{ who: 'plai', text: tg.ask }]; stopListen(); setTimeout(function () { say(tg.ask); if (TALK.muted || !('speechSynthesis' in window)) listen(); }, 250); }
    var log = el('div', 'arc-talk-log');
    TALK.log.slice(-4).forEach(function (m) { log.appendChild(el('p', 'arc-talk-msg ' + m.who, m.text)); });
    box.appendChild(log);
    if (TALK.phase === 'confirm') {
      var row = el('div', 'arc-talk-row');
      row.appendChild(btn('Yes', 'v3-go arc-talk-yes', confirmYes)); row.appendChild(btn('No, redo', 'v3-mini', confirmNo));
      box.appendChild(row);
    } else {
      var row2 = el('div', 'arc-talk-row');
      if (!TALK.noMic) row2.appendChild(btn(TALK.listening ? 'Listening...' : '\uD83C\uDFA4 Speak', 'arc-talk-mic' + (TALK.listening ? ' on' : ''), function () { if (TALK.listening) stopListen(); else listen(); paint(); }));
      var t = el('input', 'arc-input arc-talk-type'); t.placeholder = tg.dictate ? 'Or type a line' : 'Or type your answer';
      t.onkeydown = function (e) { if (e.key === 'Enter' && t.value.trim()) { var v = t.value; t.value = ''; heard(v); } };
      row2.appendChild(t);
      row2.appendChild(btn('Send', 'v3-mini', function () { if (t.value.trim()) { var v = t.value; t.value = ''; heard(v); } }));
      if (tg.dictate) row2.appendChild(btn('Done', 'v3-mini', function () { stopListen(); clickBtn('Next'); }));
      box.appendChild(row2);
    }
    if (TALK.micNote || TALK.noMic) box.appendChild(el('p', 'arc-talk-note', TALK.micNote || 'Voice answers are not supported in this browser, so type. I will still talk.'));
    w.insertBefore(box, w.children[2] || null);
  }
  function talkToggle() {
    var b = btn(TALK.on ? 'Talk mode on' : 'Talk to Plai', 'arc-talk-toggle' + (TALK.on ? ' on' : ''), function () {
      TALK.on = !TALK.on; TALK.key = ''; TALK.micNote = '';
      if (!TALK.on) { stopListen(); try { speechSynthesis.cancel(); } catch (e) {} }
      paint();
    });
    b.setAttribute('aria-pressed', TALK.on ? 'true' : 'false');
    return b;
  }

  function paint() {
    root.innerHTML = '';
    var w = el('div', 'v3-wrap arc-wrap');
    var top = el('div', 'v3-top'); var word = el('a', 'v3-word', 'PLAIGROUND'); word.href = '/'; top.appendChild(word);
    top.appendChild(el('span', 'v3-credits', 'FREE TO PLAI'));
    top.appendChild(el('span', 'v3-points', String(S.points)));
    w.appendChild(top);
    w.appendChild(talkToggle());
        if (S.crisis) w.appendChild(crisisCard());
    if (S.screen !== 'home') w.appendChild(btn('Back', 'v3-link arc-back', back));
    var sb = stepBar(); if (sb) w.appendChild(sb);
    var slot = el('div', 'arc-host-slot'); w.appendChild(slot);
    var painting = S.screen;
    (SCREENS[S.screen] || SCREENS.home)(w);
    if (S.screen !== painting) return; // the screen moved on and already painted itself
    var hh = host(); if (hh) { if (S.screen === 'home') { var m = w.querySelector('.arc-marquee'); if (m) m.after(hh); else slot.appendChild(hh); } else slot.appendChild(hh); }
    talkTick(w);
    if (S.note) w.appendChild(el('p', 'arc-note', S.note));
    root.appendChild(w);
  }
  paint();
})();
