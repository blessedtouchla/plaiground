// Browser helper for the writer IPI saved on a PLAIGROUND account.
// Talks only to /api/me/ipi (same origin, session cookie). Stores only the IPI and PRO.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PlaigroundWriterIpi = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var API = '/api/me/ipi';
  var GUIDE_KEY = 'plaiground_ipi_guide_v1';
  var PROS = ['BMI', 'ASCAP', 'SESAC', 'Other'];

  function cleanIpi(value) {
    return String(value == null ? '' : value).trim().replace(/[\s.\-]/g, '');
  }

  function readJson(res) {
    return res.json().catch(function () { return {}; });
  }

  // Resolves { signedIn: boolean, writer: object|null, error?: string }.
  function fetchWriter(fetchFn) {
    var f = fetchFn || (typeof fetch === 'function' ? fetch : null);
    if (!f) return Promise.resolve({ signedIn: false, writer: null });
    return f(API, { method: 'GET', credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (res) {
        if (res.status === 401 || res.status === 403) return { signedIn: false, writer: null };
        return readJson(res).then(function (data) {
          if (!res.ok) return { signedIn: false, writer: null, error: data.error || 'Could not load your IPI.' };
          return { signedIn: true, writer: data.writer || null };
        });
      })
      .catch(function () { return { signedIn: false, writer: null, error: 'Could not reach PLAIGROUND.' }; });
  }

  // Resolves { ok: true, writer } or { ok: false, status, error }.
  function saveWriter(fetchFn, writer) {
    var f = fetchFn || fetch;
    var body = {
      ipi: cleanIpi(writer && writer.ipi),
      pro: (writer && writer.pro) || 'BMI',
      pro_other: (writer && writer.pro_other) || '',
    };
    return f(API, {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    })
      .then(function (res) {
        return readJson(res).then(function (data) {
          if (res.ok) return { ok: true, writer: data.writer || null };
          return { ok: false, status: res.status, error: data.error || 'Could not save your IPI.' };
        });
      })
      .catch(function () { return { ok: false, status: 0, error: 'Could not reach PLAIGROUND. Your IPI is still saved on this device.' }; });
  }

  function readLocal(storage) {
    try {
      var raw = storage && storage.getItem(GUIDE_KEY);
      var data = raw ? JSON.parse(raw) : {};
      return data && typeof data === 'object' ? data : {};
    } catch (err) {
      return {};
    }
  }

  function markMigrated(storage, data, now) {
    try {
      var next = Object.assign({}, data, { accountSavedAt: (now || new Date()).toISOString() });
      if (storage) storage.setItem(GUIDE_KEY, JSON.stringify(next));
    } catch (err) { /* ignore */ }
  }

  // After login: if this browser has an IPI from the guide and the account has none,
  // copy it to the account. The account copy wins when both exist.
  // Resolves { signedIn, writer, migrated }.
  function migrateLocal(fetchFn, storage, known) {
    var start = known ? Promise.resolve(known) : fetchWriter(fetchFn);
    return start.then(function (acct) {
      if (!acct.signedIn) return { signedIn: false, writer: null, migrated: false };
      var local = readLocal(storage);
      var ipi = cleanIpi(local.ipi);
      if (acct.writer || !ipi || !/^\d+$/.test(ipi)) {
        return { signedIn: true, writer: acct.writer, migrated: false };
      }
      return saveWriter(fetchFn, { ipi: ipi, pro: local.pro || 'BMI' }).then(function (r) {
        if (r.ok) markMigrated(storage, local);
        return { signedIn: true, writer: r.ok ? r.writer : null, migrated: r.ok, error: r.ok ? '' : r.error };
      });
    });
  }

  function proLabel(writer) {
    if (!writer) return '';
    return writer.pro === 'Other' ? (writer.pro_other || 'Other') : writer.pro;
  }

  return {
    API: API,
    GUIDE_KEY: GUIDE_KEY,
    PROS: PROS,
    cleanIpi: cleanIpi,
    fetchWriter: fetchWriter,
    saveWriter: saveWriter,
    readLocal: readLocal,
    migrateLocal: migrateLocal,
    proLabel: proLabel,
  };
});
