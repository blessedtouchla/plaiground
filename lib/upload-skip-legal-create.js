(function (global) {
  if (global.__plaigroundSkipLegalCreate) return;
  global.__plaigroundSkipLegalCreate = true;
  var raw = global.fetch;
  if (typeof raw !== 'function') return;
  global.fetch = function (url, opts) {
    var href = String(url || '');
    var method = String((opts && opts.method) || 'GET').toUpperCase();
    if (method === 'POST' && /\/api\/me\/artists(?:\?|$)/.test(href)) {
      var body = {};
      try {
        body = opts && opts.body ? JSON.parse(opts.body) : {};
      } catch (err) {
        body = {};
      }
      var first = String(body.legal_first || '').trim();
      var last = String(body.legal_last || '').trim();
      if (body.action === 'create' && (!first || !last)) {
        var name = String(body.name || '').trim();
        return Promise.resolve({
          ok: true,
          status: 200,
          json: function () {
            return Promise.resolve({
              created: { name: name, id: '', source: 'created' },
              check: { level: 'green' },
              continued: true,
            });
          },
        });
      }
    }
    return raw.apply(this, arguments);
  };
})(window);
