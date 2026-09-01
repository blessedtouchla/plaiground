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
  var PUT_MS = 90000;

  function failCopy(kind) {
    return kind === 'audio' ? AUDIO_FAIL : STEP_FAIL;
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
    if (XHR) {
      return new Promise(function (resolve, reject) {
        var xhr = new XHR();
        xhr.open('PUT', url);
        Object.keys(headerMap).forEach(function (name) {
          xhr.setRequestHeader(name, headerMap[name]);
        });
        xhr.timeout = (opts && opts.timeoutMs) || PUT_MS;
        if (xhr.upload && typeof onProgress === 'function') {
          xhr.upload.onprogress = function (event) {
            if (event && event.lengthComputable && event.total) {
              onProgress(Math.round((event.loaded / event.total) * 100));
            }
          };
        }
        xhr.onload = function () {
          if (xhr.status >= 200 && xhr.status < 300) resolve({ ok: true, status: xhr.status });
          else reject(resultError({ ok: false, status: xhr.status, data: {} }, opts && opts.kind));
        };
        xhr.onerror = function () {
          reject(resultError({ ok: false, status: 0, data: { error: failCopy(opts && opts.kind) } }, opts && opts.kind));
        };
        xhr.ontimeout = function () {
          reject(resultError({ ok: false, status: 0, timedOut: true, data: { error: failCopy(opts && opts.kind) } }, opts && opts.kind));
        };
        xhr.send(file);
      });
    }
    var doFetch = fetchFn(opts);
    if (!doFetch) {
      return Promise.reject(resultError({ data: { error: failCopy(opts && opts.kind) } }, opts && opts.kind));
    }
    return doFetch(url, {
      method: 'PUT',
      headers: headerMap,
      body: file,
    }).then(function (response) {
      if (response && response.ok) return { ok: true, status: response.status };
      throw resultError({ ok: false, status: response && response.status, data: {} }, opts && opts.kind);
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
    mint: mint,
    previewUrl: previewUrl,
    put: put,
  };
});
