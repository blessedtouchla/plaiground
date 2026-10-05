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
      store.setItem(PENDING_KEY, JSON.stringify({
        title: String(song.title || '').slice(0, 80),
        text: String(song.text || '').slice(0, 12000),
        mode: String(song.mode || '').slice(0, 40),
        mood: String(song.mood || '').slice(0, 40),
        sparkTitle: String(song.sparkTitle || '').slice(0, 80),
        sparkAngle: String(song.sparkAngle || '').slice(0, 280),
      }));
      return true;
    } catch (err) {
      return false;
    }
  }

  function clearPending() {
    var store = storage();
    if (!store) return;
    try { store.removeItem(PENDING_KEY); } catch (err) {}
  }

  function pendingHome() {
    return readPending() ? '/my-lyrics' : '';
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
      link.setAttribute('href', href + join + 'next=' + encodeURIComponent('/my-lyrics'));
    });
  }

  return {
    PENDING_KEY: PENDING_KEY,
    boot: boot,
    claim: claim,
    clearPending: clearPending,
    hold: hold,
    pendingHome: pendingHome,
    readPending: readPending,
  };
});
