/**
 * Browser hop: mint a short-lived PUT, send the file there, then hand the
 * object key to our API. Never reads server keys. Never puts the file on a
 * Vercel audio/artwork POST body.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PlaigroundObjectHop = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var UPLOADS_URL = '/api/tonegrid/uploads';
  var STEP_FAIL = 'We could not finish this step.';
  var AUDIO_FAIL = 'We could not send the audio.';
  var AUDIO_TIMEOUT = 'The audio upload timed out. Try again.';
  var PUT_MS = 90000;
  var PUT_HARD_MS = 15 * 60 * 1000;

  function failCopy(kind) {
    return kind === 'audio' ? AUDIO_FAIL : STEP_FAIL;
  }

  function timeoutCopy(kind) {
    return kind === 'audio' ? AUDIO_TIMEOUT : STEP_FAIL;
  }

  function putTimeoutMs(opts) {
    var n = Number(opts && opts.timeoutMs);
    if (n > 0 && isFinite(n)) return n;
    try {
      var root = typeof globalThis !== 'undefined' ? globalThis : null;
      if (root && root.PlaigroundHopTimeoutMs != null) {
        var hopMs = Number(root.PlaigroundHopTimeoutMs);
        if (hopMs > 0 && isFinite(hopMs)) return hopMs;
      }
    } catch (ignore) {}
    return PUT_MS;
  }

  function putHardMs(opts) {
    var n = Number(opts && opts.hardTimeoutMs);
    if (n > 0 && isFinite(n)) return n;
    var stall = putTimeoutMs(opts);
    return stall > PUT_HARD_MS ? stall : PUT_HARD_MS;
  }

  function fetchFn(opts) {
    if (opts && typeof opts.fetch === 'function') return opts.fetch;
    if (typeof fetch === 'function') return fetch;
    return null;
  }

  function xhrFn(opts) {
    if (opts && opts.XMLHttpRequest) return opts.XMLHttpRequest;
    if (typeof XMLHttpRequest === 'function') return XMLHttpRequest;
    return null;
  }

  function parseJson(response) {
    return response.json().then(function (data) {
      return { ok: response.ok, status: response.status, data: data || {} };
    }).catch(function () {
      return { ok: false, status: response.status, data: {} };
    });
  }

  function resultError(result, kind) {
    var data = result && result.data;
    var message = (data && (data.error || data.message)) || failCopy(kind);
    var err = new Error(message);
    err.result = result || { ok: false, status: 0, data: { error: message } };
    return err;
  }

  function mint(kind, file, opts) {
    var doFetch = fetchFn(opts);
    if (!doFetch || !file) {
      return Promise.reject(resultError({ data: { error: failCopy(kind) } }, kind));
    }
    return doFetch(UPLOADS_URL, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: kind,
        filename: file.name || '',
        content_type: file.type || '',
        size: file.size || 0,
      }),
    }).then(parseJson).then(function (result) {
      var data = result && result.data;
      if (!result || !result.ok || !data || !data.upload_url || !data.object_key) {
        throw resultError(result, kind);
      }
      return data;
    });
  }

  function putBytes(url, file, headers, onProgress, opts) {
    var XHR = xhrFn(opts);
    var headerMap = headers || {};
    var kind = opts && opts.kind;
    var stallMs = putTimeoutMs(opts);
    var hardMs = putHardMs(opts);
    var timedOutResult = {
      ok: false,
      status: 0,
      timedOut: true,
      uploadTimedOut: true,
      data: { error: timeoutCopy(kind) },
    };
    if (XHR) {
      return new Promise(function (resolve, reject) {
        var xhr = new XHR();
        var settled = false;
        var stallTimer = null;
        var hardTimer = null;
        function finish(err, value) {
          if (settled) return;
          settled = true;
          if (stallTimer) clearTimeout(stallTimer);
          if (hardTimer) clearTimeout(hardTimer);
          if (err) reject(err);
          else resolve(value);
        }
        function timeoutFail() {
          try { xhr.abort(); } catch (ignore) {}
          finish(resultError(timedOutResult, kind));
        }
        function armStall() {
          if (stallTimer) clearTimeout(stallTimer);
          stallTimer = setTimeout(timeoutFail, stallMs);
        }
        xhr.open('PUT', url);
        Object.keys(headerMap).forEach(function (name) {
          xhr.setRequestHeader(name, headerMap[name]);
        });
        // iOS often ignores xhr.timeout; the timers below abort() for real.
        xhr.timeout = hardMs;
        if (xhr.upload) {
          xhr.upload.onprogress = function (event) {
            armStall();
            if (typeof onProgress === 'function' && event && event.lengthComputable && event.total) {
              onProgress(Math.round((event.loaded / event.total) * 100));
            }
          };
        }
        xhr.onload = function () {
          if (xhr.status >= 200 && xhr.status < 300) finish(null, { ok: true, status: xhr.status });
          else finish(resultError({ ok: false, status: xhr.status, data: {} }, kind));
        };
        xhr.onerror = function () {
          finish(resultError({ ok: false, status: 0, data: { error: failCopy(kind) } }, kind));
        };
        xhr.ontimeout = function () {
          timeoutFail();
        };
        hardTimer = setTimeout(timeoutFail, hardMs + 250);
        stallTimer = setTimeout(timeoutFail, stallMs + 250);
        xhr.send(file);
      });
    }
    var doFetch = fetchFn(opts);
    if (!doFetch) {
      return Promise.reject(resultError({ data: { error: failCopy(kind) } }, kind));
    }
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    return new Promise(function (resolve, reject) {
      var settled = false;
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        try { if (controller) controller.abort(); } catch (ignore) {}
        reject(resultError(timedOutResult, kind));
      }, stallMs + 250);
      var fetchOpts = {
        method: 'PUT',
        headers: headerMap,
        body: file,
      };
      if (controller) fetchOpts.signal = controller.signal;
      doFetch(url, fetchOpts).then(function (response) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (response && response.ok) {
          resolve({ ok: true, status: response.status });
          return;
        }
        reject(resultError({ ok: false, status: response && response.status, data: {} }, kind));
      }, function () {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(resultError({ ok: false, status: 0, data: { error: failCopy(kind) } }, kind));
      });
    });
  }

  function put(kind, file, opts) {
    var options = opts || {};
    return mint(kind, file, options).then(function (minted) {
      return putBytes(minted.upload_url, file, minted.headers || {}, options.onProgress, Object.assign({}, options, { kind: kind })).then(function () {
        return minted.object_key;
      });
    });
  }

  function previewUrl(key, opts) {
    var doFetch = fetchFn(opts);
    var objectKey = String(key || '').trim();
    if (!doFetch || !objectKey) return Promise.resolve('');
    return doFetch(UPLOADS_URL + '?key=' + encodeURIComponent(objectKey), {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    }).then(parseJson).then(function (result) {
      if (!result || !result.ok || !result.data || !result.data.url) return '';
      return String(result.data.url);
    }).catch(function () {
      return '';
    });
  }

  return {
    UPLOADS_URL: UPLOADS_URL,
    AUDIO_TIMEOUT: AUDIO_TIMEOUT,
    PUT_HARD_MS: PUT_HARD_MS,
    PUT_MS: PUT_MS,
    mint: mint,
    previewUrl: previewUrl,
    put: put,
  };
});
