// Fan Mail to Song (hidden preview). Two paths, one Songify button.
(function () {
  'use strict';
  var F = window.FanSong;
  var root = document.getElementById('fan');
  var K = new URLSearchParams(location.search).get('k') || '';
  var WALLET = 'plaiground.v3.wallet';
  var S = { path: '', name: '', type: 'Other', typeConfirmed: false, facts: [], picked: {}, affect: [], did: '', moment: '', confession: '', tenSeconds: '', letter: '', depth: null, genre: 'Pop', tempo: 'Mid', voice: 'Female vocal', busy: false, note: '', result: null, researched: false };

  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function wallet() { try { var w = JSON.parse(localStorage.getItem(WALLET) || ''); if (w && typeof w.freeLeft === 'number') return w; } catch (e) {} return { freeLeft: 1, credits: 0 }; }
  function spend() {
    var w = wallet();
    if (w.freeLeft > 0) w.freeLeft -= 1; else if (w.credits > 0) w.credits -= 1; else return false;
    localStorage.setItem(WALLET, JSON.stringify(w)); return true;
  }
  function price() { var w = wallet(); return w.freeLeft > 0 ? 'free' : '1 credit'; }
  function post(action, body) {
    return fetch('/api/song-helper?action=' + action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ k: K }, body)) })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'Something went wrong.' }; }); });
  }
  function intake() {
    return { name: S.name, type: S.type, affect: S.affect, did: S.did, moment: S.moment, confession: S.confession, tenSeconds: S.tenSeconds, letter: S.path === 'paste' ? S.letter : F.assembleLetter(F.normalize(S)), depth: S.depth, genre: S.genre, tempo: S.tempo, voice: S.voice,
      facts: S.facts.filter(function (f, i) { return S.picked[i]; }) };
  }
  function chips(list, isOn, onTap) {
    var row = el('div', 'fan-chips');
    list.forEach(function (v) { var b = el('button', 'fan-chip' + (isOn(v) ? ' on' : ''), v); b.type = 'button'; b.onclick = function () { onTap(v); paint(); }; row.appendChild(b); });
    return row;
  }
  function field(label, key, ph, rows) {
    var w = el('label', 'fan-field'); w.appendChild(el('span', '', label));
    var t = el(rows ? 'textarea' : 'input'); if (rows) t.rows = rows; t.placeholder = ph || ''; t.value = S[key] || '';
    t.oninput = function () { S[key] = t.value; };
    w.appendChild(t); return w;
  }
  function card(title) { var c = el('section', 'flow-card fan-card'); if (title) c.appendChild(el('h3', '', title)); return c; }
  function copyBtn(text, label) {
    var b = el('button', 'btn btn-ghost btn-sm', label || 'Copy'); b.type = 'button';
    b.onclick = function () { (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () { b.textContent = 'Copied'; }, function () { b.textContent = 'Select and copy'; }); };
    return b;
  }

  function research() {
    if (!S.name.trim()) { S.note = 'Who is the song for? Add their name.'; paint(); return; }
    S.busy = true; S.note = ''; paint();
    post('fan-research', { name: S.name }).then(function (r) {
      S.busy = false; S.researched = true;
      if (!r.ok) { S.note = r.error || 'Could not look that up.'; paint(); return; }
      S.type = r.type || 'Other'; S.facts = r.facts || []; S.picked = {};
      S.note = r.found ? '' : (r.note || '');
      paint();
    });
  }

  function songify() {
    var n = F.normalize(intake());
    var v = F.validate(n);
    if (!v.ok) { S.note = v.error; paint(); return; }
    if (!spend()) { S.note = 'That takes 1 credit.'; paint(); return; }
    S.busy = true; S.note = ''; paint();
    post('fan-write', intake()).then(function (r) {
      S.busy = false;
      if (!r.ok) { S.note = r.error || 'Could not write that.'; paint(); return; }
      S.result = r;
      try {
        var list = JSON.parse(localStorage.getItem(F.STORE_KEY) || '[]') || [];
        list.push(F.fanRecord(n, r.lyrics, r.style, r.letter));
        localStorage.setItem(F.STORE_KEY, JSON.stringify(list.slice(-50)));
      } catch (e) {}
      paint();
      root.querySelector('.fan-result') && root.querySelector('.fan-result').scrollIntoView({ behavior: 'smooth' });
    });
  }

  function paint() {
    root.innerHTML = '';
    var wrap = el('div', 'v3-wrap fan-wrap');
    var top = el('div', 'v3-top'); var word = el('a', 'v3-word', 'PLAIGROUND'); word.href = '/'; top.appendChild(word);
    var w = wallet(); top.appendChild(el('span', 'v3-credits', w.freeLeft > 0 ? 'FREE WRITE' : ('CREDITS ' + w.credits))); wrap.appendChild(top);
    wrap.appendChild(el('h1', 'fan-title', 'Fan Mail to Song'));
    wrap.appendChild(el('p', 'fan-sub', 'Turn your love for someone famous into a song and a letter to send with it. Share it, send it, or release it under your own name.'));

    var who = card('Who is it for?');
    who.appendChild(field('Their name', 'name', 'First name or full name'));
    var look = el('button', 'btn btn-purple btn-sm', S.busy && !S.researched ? 'Looking them up...' : 'Look them up'); look.type = 'button'; look.onclick = research; who.appendChild(look);
    if (S.researched) {
      who.appendChild(el('p', 'hint', 'We think they are a ' + S.type.toLowerCase() + '. Tap to fix it.'));
      who.appendChild(chips(F.TYPES, function (v) { return S.type === v; }, function (v) { S.type = v; S.typeConfirmed = true; }));
      if (S.facts.length) {
        who.appendChild(el('p', 'hint', 'Tick the facts you want in the song.'));
        S.facts.forEach(function (f, i) {
          var l = el('label', 'fan-fact'); var c = el('input'); c.type = 'checkbox'; c.checked = Boolean(S.picked[i]);
          c.onchange = function () { S.picked[i] = c.checked; };
          l.appendChild(c); l.appendChild(el('span', '', ' ' + f.text + ' '));
          var a = el('a', 'fan-src', 'source'); a.href = f.source; a.target = '_blank'; a.rel = 'noopener'; l.appendChild(a);
          who.appendChild(l);
        });
      }
    }
    wrap.appendChild(who);

    var paths = card('How do you want to start?');
    paths.appendChild(chips(['Paste your letter', 'Help me write it'], function (v) { return (v === 'Paste your letter' && S.path === 'paste') || (v === 'Help me write it' && S.path === 'guided'); }, function (v) { S.path = v === 'Paste your letter' ? 'paste' : 'guided'; }));
    wrap.appendChild(paths);

    if (S.path === 'paste') {
      var p = card('Paste your letter');
      p.appendChild(field('Your letter', 'letter', 'Dear ...', 8));
      var go = el('button', 'btn btn-ghost btn-sm', 'Pull out the good parts'); go.type = 'button';
      go.onclick = function () {
        var x = F.extractFromLetter(S.letter, S.name);
        S.did = x.did; S.moment = x.moment; S.confession = x.confession; S.tenSeconds = x.tenSeconds; S.affect = x.affect; S.depth = null;
        S.path = 'paste'; S.extracted = true; paint();
      };
      p.appendChild(go);
      wrap.appendChild(p);
    }
    if (S.path === 'guided' || (S.path === 'paste' && S.extracted)) {
      var q = card(S.path === 'paste' ? 'Here is what we heard. Fix anything.' : 'Tell us about them');
      q.appendChild(el('p', 'fan-q', 'How did they affect you?'));
      q.appendChild(chips(F.AFFECT, function (v) { return S.affect.indexOf(v) !== -1; }, function (v) { var i = S.affect.indexOf(v); if (i === -1) S.affect.push(v); else S.affect.splice(i, 1); S.depth = null; }));
      q.appendChild(field('What did they do for you?', 'did', 'Your words are the heart of the song', 3));
      q.appendChild(field('The moment you became a fan', 'moment', 'Where were you, what happened', 3));
      q.appendChild(field('A funny fan confession', 'confession', 'The embarrassing part. We love it.', 2));
      q.appendChild(field('If you had 10 seconds with them, you would say...', 'tenSeconds', 'This becomes the hook', 2));
      wrap.appendChild(q);

      var n = F.normalize(intake());
      var read = card('');
      var plai = el('p', 'fan-read'); plai.appendChild(el('b', '', 'Plai: ')); plai.appendChild(document.createTextNode(F.plaiRead(n))); read.appendChild(plai);
      if (F.crisis(n)) {
        var help = el('p', 'fan-help'); var a = el('a', '', F.CRISIS_LINK.label); a.href = F.CRISIS_LINK.href; a.target = '_blank'; a.rel = 'noopener';
        help.appendChild(a); help.appendChild(document.createTextNode(' (call or text 988 in the US). Outside the US: ')); var b = el('a', '', 'find a helpline'); b.href = F.CRISIS_INTL; b.target = '_blank'; b.rel = 'noopener'; help.appendChild(b);
        read.appendChild(help);
      }
      var sl = el('label', 'fan-slider'); sl.appendChild(el('span', '', 'Light'));
      var r = el('input'); r.type = 'range'; r.min = 0; r.max = 100; r.value = F.depthOf(n);
      r.onchange = function () { S.depth = Number(r.value); paint(); };
      sl.appendChild(r); sl.appendChild(el('span', '', 'Deep')); read.appendChild(sl);
      read.appendChild(el('p', 'fan-q', 'Genre')); read.appendChild(chips(F.GENRES, function (v) { return S.genre === v; }, function (v) { S.genre = v; }));
      read.appendChild(el('p', 'fan-q', 'Tempo')); read.appendChild(chips(F.TEMPOS, function (v) { return S.tempo === v; }, function (v) { S.tempo = v; }));
      read.appendChild(el('p', 'fan-q', 'Voice')); read.appendChild(chips(F.VOICES, function (v) { return S.voice === v; }, function (v) { S.voice = v; }));
      var sg = el('button', 'btn btn-gold btn-md fan-go', S.busy ? 'Songifying...' : 'Songify (' + price() + ')'); sg.type = 'button'; sg.disabled = S.busy; sg.onclick = songify;
      read.appendChild(sg);
      wrap.appendChild(read);
    }
    if (S.note) wrap.appendChild(el('p', 'fan-note', S.note));

    if (S.result) {
      var out = card('Your fan song'); out.className += ' fan-result';
      if (S.result.notice) out.appendChild(el('p', 'hint', S.result.notice));
      out.appendChild(el('pre', 'lyrics-preview', S.result.lyrics)); out.appendChild(copyBtn(S.result.lyrics, 'Copy lyrics'));
      out.appendChild(el('p', 'fan-q', 'Style prompt')); out.appendChild(el('pre', 'lyrics-preview', S.result.style)); out.appendChild(copyBtn(S.result.style, 'Copy style prompt'));
      out.appendChild(el('p', 'fan-q', 'A letter to send with it')); out.appendChild(el('pre', 'lyrics-preview', S.result.letter)); out.appendChild(copyBtn(S.result.letter, 'Copy letter'));
      out.appendChild(el('p', 'hint', 'Fan songs are for fun and sharing. You can release it under your own artist name, with no Official or featuring in the title and no photo of them on the cover.'));
      wrap.appendChild(out);
    }
    root.appendChild(wrap);
  }
  paint();
})();
