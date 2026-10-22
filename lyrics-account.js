(function (root, factory) {
  var api = factory(root || globalThis);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PlaigroundLyricsAccount = api;
  if (typeof document !== 'undefined') api.boot();
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  var PENDING_KEY = 'plaiground.songHelper.pendingSong';

  function storage() {
    try {
      return root.localStorage;
    } catch (err) {
      return null;
    }
  }

  function readPending() {
    var store = storage();
    if (!store) return null;
    try {
      var parsed = JSON.parse(store.getItem(PENDING_KEY) || 'null');
      if (!parsed || typeof parsed !== 'object' || !String(parsed.text || '').trim()) return null;
      return parsed;
    } catch (err) {
      return null;
    }
  }

  function hold(song) {
    var store = storage();
    if (!store || !song || !String(song.text || '').trim()) return false;
    try {
      var pending = {
        title: String(song.title || '').slice(0, 80),
        text: String(song.text || '').slice(0, 12000),
        mode: String(song.mode || '').slice(0, 40),
        mood: String(song.mood || '').slice(0, 40),
        sparkTitle: String(song.sparkTitle || '').slice(0, 80),
        sparkAngle: String(song.sparkAngle || '').slice(0, 3000),
      };
      if (song.claim && typeof song.claim === 'object') pending.claim = song.claim;
      store.setItem(PENDING_KEY, JSON.stringify(pending));
      keepLocal(pending);
      return true;
    } catch (err) {
      return false;
    }
  }

  var LOCAL_KEY = 'plaiground.songHelper.localSongs';

  var ARCADE_KEY = 'plaiground.arcade.saved';

  function readArcade() {
    var store = storage();
    if (!store) return [];
    try {
      var list = JSON.parse(store.getItem(ARCADE_KEY) || '[]');
      return Array.isArray(list) ? list : [];
    } catch (err) {
      return [];
    }
  }

  function readLocal() {
    var store = storage();
    if (!store) return [];
    var own = [];
    try {
      var list = JSON.parse(store.getItem(LOCAL_KEY) || '[]');
      own = Array.isArray(list) ? list.filter(function (s) { return s && String(s.text || '').trim(); }) : [];
    } catch (err) {
      own = [];
    }
    var arcade = readArcade().filter(function (x) { return x && !x.accountId && String(x.lyrics || '').trim(); }).map(function (x) {
      return { title: String(x.title || '').slice(0, 80), text: String(x.lyrics || '').slice(0, 12000), mode: String(x.card || '').slice(0, 40), mood: String(x.type || '').slice(0, 40), localAt: x.at, arcadeAt: x.at || '' };
    });
    return own.concat(arcade);
  }

  function markArcade(song) {
    var store = storage();
    if (!store || !song.arcadeAt) return;
    var list = readArcade();
    list.forEach(function (x) { if (x.at === song.arcadeAt) x.accountId = 'imported'; });
    try { store.setItem(ARCADE_KEY, JSON.stringify(list)); } catch (err) {}
  }

  function keepLocal(song) {
    var store = storage();
    if (!store) return;
    var list = readLocal().filter(function (s) { return !s.arcadeAt && !(s.text === song.text && s.title === song.title); });
    var copy = JSON.parse(JSON.stringify(song));
    copy.localAt = new Date().toISOString();
    list.unshift(copy);
    try { store.setItem(LOCAL_KEY, JSON.stringify(list.slice(0, 30))); } catch (err) {}
  }

  function clearLocal() {
    var store = storage();
    if (!store) return;
    try { store.removeItem(LOCAL_KEY); } catch (err) {}
  }

  function importLocal() {
    var list = readLocal();
    var fetchFn = root.fetch;
    if (!list.length || typeof fetchFn !== 'function') return Promise.resolve({ imported: 0, failed: 0 });
    var done = 0, failed = 0, left = [];
    return list.reverse().reduce(function (p, song) {
      return p.then(function () {
        var body = Object.assign({}, song);
        delete body.localAt;
        delete body.arcadeAt;
        return fetchFn('/api/me/lyrics', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ song: body }),
        }).then(function (res) {
          if (res.ok) { done++; markArcade(song); } else { failed++; if (!song.arcadeAt) left.push(song); }
        }).catch(function () { failed++; left.push(song); });
      });
    }, Promise.resolve()).then(function () {
      var store = storage();
      if (store) {
        try {
          if (left.length) store.setItem(LOCAL_KEY, JSON.stringify(left.reverse()));
          else store.removeItem(LOCAL_KEY);
        } catch (err) {}
      }
      if (!left.length) clearPending();
      return { imported: done, failed: failed };
    });
  }

  function clearPending() {
    var store = storage();
    if (!store) return;
    var was = readPending();
    if (was) {
      var rest = readLocal().filter(function (x) { return !x.arcadeAt && !(x.text === was.text && (x.title || '') === (was.title || '')); });
      try {
        if (rest.length) store.setItem(LOCAL_KEY, JSON.stringify(rest));
        else store.removeItem(LOCAL_KEY);
      } catch (err) {}
    }
    try { store.removeItem(PENDING_KEY); } catch (err) {}
  }

  function pendingHome() {
    var pending = readPending();
    if (!pending) return '';
    if (pending.claim && pending.claim.id) {
      return '/claim?id=' + encodeURIComponent(pending.claim.id);
    }
    return '/my-lyrics';
  }

  function claim() {
    var pending = readPending();
    if (!pending) return Promise.resolve(null);
    var fetchFn = root.fetch;
    if (typeof fetchFn !== 'function') return Promise.resolve(null);
    return fetchFn('/api/me/lyrics', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ song: pending }),
    }).then(function (res) {
      return res.json().then(function (data) {
        if (res.ok && data && data.ok) clearPending();
        return data || null;
      }).catch(function () { return null; });
    }).catch(function () { return null; });
  }

  function boot() {
    if (!root.document || !readPending()) return;
    var links = root.document.querySelectorAll('a[href="login.html"], a[href="login.html?"], a.login');
    Array.prototype.forEach.call(links, function (link) {
      var href = link.getAttribute('href') || '';
      if (href.indexOf('login') === -1 || href.indexOf('next=') !== -1) return;
      var join = href.indexOf('?') === -1 ? '?' : '&';
      link.setAttribute('href', href + join + 'next=' + encodeURIComponent(pendingHome() || '/my-lyrics'));
    });
  }

  return {
    PENDING_KEY: PENDING_KEY,
    boot: boot,
    claim: claim,
    clearLocal: clearLocal,
    clearPending: clearPending,
    importLocal: importLocal,
    keepLocal: keepLocal,
    readLocal: readLocal,
    hold: hold,
    pendingHome: pendingHome,
    readPending: readPending,
  };
});
