// Song Helper Arcade (hidden preview). Three cards, one high score reveal.
(function () {
  'use strict';
  var A = window.Arcade;
  var root = document.getElementById('arc');
  var K = new URLSearchParams(location.search).get('k') || '';
  var WALLET = 'plaiground.v3.wallet';
  var BEST = 'plaiground.arcade.best';
  var SAVED = 'plaiground.arcade.saved';
  var S;
  function fresh() {
    return { screen: 'home', card: '', type: '', sub: '', qIndex: 0, answers: {}, aiLevel: 'assist', vibe: '', title: '', length: 'Song', language: 'English',
      explicit: 'off', ageOk: false, built: [], slotIndex: 0, options: [], research: null, styleOverride: false, soundOpen: false, advOpen: false,
      sound: { genre: '', sub: '', instruments: [], vocal: '', custom: '', fusion: [] }, result: null, userWords: false, keptPlai: false,
      fix: { text: '', off: [], before: '', history: [], picking: null, options: [], scoreBefore: 0 },
      flip: { text: '', from: '', fromPrompt: '', showPrompt: false, target: '', fusion: [], fusionOn: false, vibe: '', level: '', keep: [] },
      battle: { round: 1, log: [], charged: false, bars: '' }, points: 0, busy: false, note: '', notice: '', crisis: false, history: [] };
  }
  S = fresh();

  // ---------- helpers ----------
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function btn(label, cls, onClick, disabled) { var b = el('button', cls || 'v3-go', label); b.type = 'button'; b.disabled = !!disabled; b.onclick = onClick; return b; }
  function wallet() { try { var w = JSON.parse(localStorage.getItem(WALLET) || ''); if (w && typeof w.freeLeft === 'number') return w; } catch (e) {} return { freeLeft: 1, credits: 0 }; }
  function canSpend() { var w = wallet(); return w.freeLeft > 0 || w.credits > 0; }
  function spend() { var w = wallet(); if (w.freeLeft > 0) w.freeLeft -= 1; else if (w.credits > 0) w.credits -= 1; else return false; localStorage.setItem(WALLET, JSON.stringify(w)); return true; }
  function refund(before) { localStorage.setItem(WALLET, JSON.stringify(before)); }
  function priceTag(n) { if (!n) return 'free'; return wallet().freeLeft > 0 ? 'free write' : n + ' credit'; }
  function go(screen) { if (S.screen !== screen) { S.history.push(S.screen); S.points += 100; } S.screen = screen; S.note = ''; paint(); window.scrollTo(0, 0); }
  function back() { S.screen = S.history.pop() || 'home'; S.note = ''; paint(); }
  function post(action, extra) {
    var body = Object.assign({ action: action, company_website: '', k: K, state: stateForServer() }, extra || {});
    return fetch('/api/song-helper?action=' + action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'Something went wrong.' }; }).then(function (d) { d.__status = r.status; return d; }); })
      .catch(function () { return { ok: false, error: 'Connection hiccup. Try again.' }; });
  }
  function stateForServer() {
    return { card: S.card, type: S.type, sub: S.sub, answers: S.answers, aiLevel: S.aiLevel, vibe: S.vibe, title: S.title, length: S.length, language: S.language,
      explicit: S.explicit, ageOk: S.ageOk, built: S.built, research: S.research, styleOverride: S.styleOverride, flip: S.flip };
  }
  function soundForStyle() { var s = S.sound; return { genre: s.genre, sub: s.sub, instruments: s.instruments, vocal: s.vocal, custom: s.custom, fusion: S.card === 'flip' && S.flip.fusionOn ? S.flip.fusion : s.fusion }; }
  function style() {
    var st = stateForServer();
    var snd = soundForStyle();
    if (S.card === 'flip' && !snd.genre && S.flip.target) snd.genre = S.flip.target;
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
    w.appendChild(plai("Pick a machine. I'll host."));
    var grid = el('div', 'arc-cards');
    A.CARDS.forEach(function (c) {
      var b = btn('', 'v3-cabinet arc-card cab-' + c.id, function () {
        var keepWallet = true; S = fresh(); S.card = c.id; if (keepWallet) {}
        go(c.id === 'scratch' ? 's-type' : (c.id === 'fix' ? 'f-paste' : 'x-paste'));
      });
      b.appendChild(el('b', '', c.label)); b.appendChild(el('small', '', c.small)); grid.appendChild(b);
    });
    w.appendChild(grid);
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
      var box = el('div', 'flow-card arc-research'); box.appendChild(el('h3', '', "Here's what that song is about"));
      var ul = el('ul'); (S.research.topics || []).forEach(function (t) { ul.appendChild(el('li', '', t)); }); box.appendChild(ul);
      if (S.researchNotice) box.appendChild(el('p', 'hint', S.researchNotice));
      w.appendChild(box);
    }
    if (q.kind === 'chips') {
      var opts = q.options.slice();
      if (q.fromResearch && S.research && S.research.angles) opts = S.research.angles.concat(opts);
      w.appendChild(chips(opts, function (v) { return S.answers[q.key] === v; }, function (v) { S.answers[q.key] = v; }));
      if (q.other) w.appendChild(input(opts.indexOf(S.answers[q.key]) === -1 ? (S.answers[q.key] || '') : '', 'Something else? Type it', function (v) { S.answers[q.key] = v; S.userWords = true; }));
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
  SCREENS['s-basics'] = function (w) {
    w.appendChild(plai('Set the vibe.'));
    if (!S.title) S.title = A.suggestTitle(stateForServer());
    w.appendChild(chips(A.VIBES, function (v) { return S.vibe === v; }, function (v) { S.vibe = v; }));
    w.appendChild(el('p', 'arc-q', 'Title'));
    w.appendChild(input(S.title, 'Title', function (v) { S.title = v; }));
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
    w.appendChild(btn(S.aiLevel === 'full' ? 'Write it (' + priceTag(1) + ')' : 'Start building', 'v3-go', function () {
      if (S.explicit === 'ok' && !S.ageOk) { S.note = 'Tick the 18+ box, or switch Explicit off.'; paint(); return; }
      if (S.aiLevel === 'full') writeSong(); else { S.slotIndex = 0; S.built = []; go('s-build'); if (S.aiLevel === 'assist') fetchLines(); }
    }));
  };
  var SLOTS = ['Chorus line 1', 'Chorus line 2', 'Chorus line 3', 'Chorus line 4', 'Verse line 1', 'Verse line 2', 'Verse line 3', 'Verse line 4'];
  function fetchLines(one) {
    S.busy = true; paint();
    post('arcade-lines', { slot: SLOTS[S.slotIndex].split(' ')[0].toLowerCase() }).then(function (d) {
      S.busy = false;
      if (!d.ok) { S.note = d.error || 'Plai is stuck. Write your own.'; paint(); return; }
      S.options = one ? [d.lines[0]].concat(S.options.slice(1)) : d.lines; S.notice = d.notice || ''; paint();
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
      S.options.forEach(function (o) {
        var b = btn('', 'v3-tile arc-option', function () { S.built.push(o); S.keptPlai = true; nextSlot(); });
        b.appendChild(syl(o)); b.appendChild(document.createTextNode(' ' + o)); w.appendChild(b);
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
    w.appendChild(btn('Use my line', 'v3-go', function () { var v = String(S.ownLine || '').trim(); if (!v) return; S.built.push(v); S.userWords = true; S.ownLine = ''; nextSlot(); }));
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
      if (!d.ok) { if (!human) refund(before); S.note = d.error || 'Could not write that. You were not charged.'; paint(); return; }
      finish(d.lyrics, d, 0);
    }).catch(function () { if (!human) refund(before); S.busy = false; S.note = 'Plai lost the words. You were not charged.'; paint(); });
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
    var plaiFirst = S.answers.first === 'Plai first';
    if (b.round > 3) { w.appendChild(btn('See the battle', 'v3-go', endBattle)); return; }
    var needUser = !(plaiFirst && b.log.length === 0);
    if (needUser) {
      w.appendChild(plai(b.log.length ? 'Your turn. Flip my last line back at me.' : 'Spit 8 bars. Use your 3 facts.'));
      w.appendChild(input(b.bars, 'Your bars, one per line', function (v) { b.bars = v; S.userWords = true; }, 8));
    } else {
      w.appendChild(plai('I go first. Brace yourself.'));
    }
    w.appendChild(btn(S.busy ? 'Plai is writing...' : (b.charged ? 'Fire' : 'Fire (' + priceTag(1) + ' for all 3 rounds)'), 'v3-go', function () {
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

  // ---------- Reveal ----------
  SCREENS.reveal = function (w) {
    var r = S.result || { lyrics: '' };
    var best = Number(localStorage.getItem(BEST) || 0);
    var score = S.card === 'fix' ? A.songScore(r.lyrics) : S.points + A.songScore(r.lyrics);
    var high = score > best;
    if (high) localStorage.setItem(BEST, String(score));
    w.appendChild(el('p', 'arc-kicker', high ? 'New high score!' : 'High score'));
    w.appendChild(el('h2', 'arc-marquee', S.title || A.suggestTitle(stateForServer())));
    if (S.card === 'fix' && r.scoreBefore) w.appendChild(el('p', 'arc-jump', 'Score ' + r.scoreBefore + ' to ' + score + (score > r.scoreBefore ? '. Look at that jump!' : '')));
    else w.appendChild(el('p', 'arc-jump', 'Score: ' + score.toLocaleString('en-US')));
    if (high) w.appendChild(el('div', 'arc-confetti', '\u2728 \u2728 \u2728'));
    if (r.notice) w.appendChild(el('p', 'hint', r.notice));
    w.appendChild(el('span', 'arc-label', r.label || A.aiLabel(S)));
    if (S.sub === 'battle') w.appendChild(chips(['You won', 'Plai won', 'Tie'], function (v) { return S.vote === v; }, function (v) { S.vote = v; }));
    var pre = el('pre', 'lyrics-preview arc-lyrics', r.lyrics || ''); w.appendChild(pre);
    if (!r.style) r.style = style();
    w.appendChild(el('p', 'arc-q', 'Style prompt'));
    w.appendChild(el('pre', 'arc-style', r.style));
    var row = el('div', 'arc-actions');
    var b1 = btn('Copy lyrics', 'v3-mini', function () { copy(r.lyrics, b1); });
    var b2 = btn('Copy style', 'v3-mini', function () { copy(r.style, b2); });
    var b3 = btn('Copy both', 'v3-mini', function () { copy(r.lyrics + '\n\nStyle prompt\n' + r.style, b3); });
    var b4 = btn('Save', 'v3-mini', function () {
      try { var list = JSON.parse(localStorage.getItem(SAVED) || '[]'); list.push({ title: S.title, lyrics: r.lyrics, style: r.style, label: r.label, card: S.card, type: S.type, sub: S.sub, fanSong: S.sub === 'fan', at: new Date().toISOString() }); localStorage.setItem(SAVED, JSON.stringify(list.slice(-50))); b4.textContent = 'Saved'; } catch (e) { b4.textContent = 'Could not save'; }
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
    w.appendChild(btn('Read it', 'v3-go', function () { S.fix.scoreBefore = A.songScore(S.fix.text); go('f-read'); }));
  };
  function readLine() {
    var flags = A.syllableFlags(S.fix.text); var n = flags.filter(function (f) { return f.flag; }).length;
    var bits = [];
    if (n) bits.push(n + ' line' + (n > 1 ? 's are' : ' is') + ' off-beat next to ' + (n > 1 ? 'their partners' : 'its partner'));
    else bits.push('The rhythm lines up well');
    if (S.fix.off.length) bits.push('you flagged ' + S.fix.off.join(', ').toLowerCase());
    return bits.join(', and ') + '. Tap a line for 3 rewrites, or fix it all.';
  }
  SCREENS['f-read'] = function (w) {
    w.appendChild(plai(readLine()));
    var list = el('div', 'flow-card arc-read');
    A.splitLyrics(S.fix.text).forEach(function (sec) {
      list.appendChild(el('p', 'arc-tag', '[' + sec.label + ']'));
      sec.lines.forEach(function (line) {
        var f = A.syllableFlags(S.fix.text).filter(function (x) { return x.line === line; })[0];
        var b = btn('', 'arc-readline' + (f && f.flag ? ' amber' : '') + (S.fix.picking === line ? ' on' : ''), function () { pickLine(line); });
        b.appendChild(syl(line)); b.appendChild(document.createTextNode(' ' + line)); list.appendChild(b);
        if (S.fix.picking === line) {
          if (S.busy) list.appendChild(el('p', 'hint', 'Thinking...'));
          S.fix.options.forEach(function (o) { var ob = btn('', 'v3-tile arc-option', function () { S.fix.history.push(S.fix.text); S.fix.text = S.fix.text.replace(line, o); S.fix.picking = null; S.fix.options = []; S.points += 50; paint(); }); ob.appendChild(syl(o)); ob.appendChild(document.createTextNode(' ' + o)); list.appendChild(ob); });
        }
      });
    });
    w.appendChild(list);
    if (S.fix.history.length) w.appendChild(btn('Undo last change', 'v3-link', function () { S.fix.text = S.fix.history.pop(); paint(); }));
    w.appendChild(btn('Fix it all (' + priceTag(1) + ')', 'v3-go', fixAll, S.busy));
    w.appendChild(btn('Done, show my score', 'v3-link', function () { S.result = { lyrics: S.fix.text, scoreBefore: S.fix.scoreBefore, label: S.fix.history.length ? 'AI-assisted' : 'Human' }; go('reveal'); }));
  };
  function pickLine(line) {
    S.fix.picking = line; S.fix.options = []; S.busy = true; paint();
    post('arcade-fix', { text: S.fix.text, line: line, off: S.fix.off }).then(function (d) { S.busy = false; if (!d.ok) { S.note = d.error; paint(); return; } S.fix.options = d.options || []; paint(); });
  }
  function fixAll() {
    var before = wallet(); if (!spend()) { S.note = 'That takes 1 credit.'; paint(); return; }
    S.busy = true; paint();
    post('arcade-fix', { text: S.fix.text, off: S.fix.off }).then(function (d) {
      S.busy = false;
      if (!d.ok) { refund(before); S.note = (d.error || 'Could not fix that.') + ' You were not charged.'; paint(); return; }
      S.fix.before = S.fix.text; S.fix.after = d.lyrics; S.fix.notice = d.notice || ''; if (d.crisis) S.crisis = true; go('f-compare');
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
      if (!d.ok) { refund(before); S.note = (d.error || 'Could not flip that.') + ' You were not charged.'; paint(); return; }
      S.userWords = true; S.aiLevel = 'assist';
      if (!S.title) S.title = 'The Flip';
      finish(d.lyrics, d, 0);
    });
  }

  // ---------- paint ----------
  function paint() {
    root.innerHTML = '';
    var w = el('div', 'v3-wrap arc-wrap');
    var top = el('div', 'v3-top'); var word = el('a', 'v3-word', 'PLAIGROUND'); word.href = '/'; top.appendChild(word);
    var wl = wallet(); top.appendChild(el('span', 'v3-credits', wl.freeLeft > 0 ? 'FREE WRITE' : ('CREDITS ' + wl.credits)));
    top.appendChild(el('span', 'v3-points', String(S.points)));
    w.appendChild(top);
    w.appendChild(el('p', 'v3-preview', 'Arcade preview. The live Song Helper stays put.'));
    if (S.crisis) w.appendChild(crisisCard());
    if (S.screen !== 'home') w.appendChild(btn('Back', 'v3-link arc-back', back));
    (SCREENS[S.screen] || SCREENS.home)(w);
    if (S.note) w.appendChild(el('p', 'arc-note', S.note));
    root.appendChild(w);
  }
  paint();
})();
