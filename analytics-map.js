/* Dark world map for the signed-in analytics page.
   Countries and stores light only from the analytics payload already on the page.
   Geometry is a local Natural Earth simplification. No tile server. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document && typeof api.boot === 'function') api.boot(root);
})(typeof window !== 'undefined' ? window : globalThis, function () {
  var STORES = [
    { id: 'spotify', label: 'Spotify', names: ['spotify'] },
    { id: 'apple-music', label: 'Apple Music', names: ['apple music', 'applemusic', 'itunes'] },
    { id: 'youtube-music', label: 'YouTube Music', names: ['youtube music', 'youtubemusic', 'youtube-music'] },
    { id: 'tiktok', label: 'TikTok', names: ['tiktok'] },
    { id: 'deezer', label: 'Deezer', names: ['deezer'] },
    { id: 'amazon-music', label: 'Amazon Music', names: ['amazon music', 'amazonmusic', 'amazon'] }
  ];
  var EXTRAS = [
    { id: 'youtube', label: 'YouTube', names: ['youtube'] },
    { id: 'tiktok-music', label: 'TikTok Music', names: ['tiktok music', 'tiktokmusic', 'tiktok-music'] },
    { id: 'tidal', label: 'Tidal', names: ['tidal'] },
    { id: 'soundcloud', label: 'SoundCloud', names: ['soundcloud'] },
    { id: 'pandora', label: 'Pandora', names: ['pandora'] }
  ];
  var SKIP_ALIAS = { korea: 1, england: 1 };
  var EMPTY_NOTE = 'Your map lights up as your songs get played';
  var LOCK_NOTE = 'Location breakdown shows when stores send it.';

  function fold(value) {
    return String(value == null ? '' : value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\./g, '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function toNumber(value) {
    if (typeof value === 'number' && isFinite(value)) return value;
    if (typeof value === 'string') {
      var n = Number(String(value).replace(/[$,]/g, '').trim());
      return isFinite(n) ? n : 0;
    }
    return 0;
  }

  function rowLive(row) {
    if (!row || typeof row !== 'object') return false;
    if (toNumber(row.streams) > 0) return true;
    if (row.live === true) return true;
    var status = fold(row.status || row.state || '');
    return status === 'live';
  }

  function buildIndex(countries) {
    var index = { iso: {}, iso3: {}, name: {}, list: countries || [] };
    (countries || []).forEach(function (country) {
      if (!country || !country.iso) return;
      index.iso[fold(country.iso)] = country;
      if (country.iso3) index.iso3[fold(country.iso3)] = country;
      if (country.name) index.name[fold(country.name)] = country;
      (country.aliases || []).forEach(function (alias) {
        var key = fold(alias);
        if (!key || SKIP_ALIAS[key]) return;
        if (!index.name[key]) index.name[key] = country;
      });
    });
    return index;
  }

  function lookup(index, row) {
    var fields = [row && row.territory, row && row.country, row && row.code, row && row.country_name, row && row.name];
    for (var i = 0; i < fields.length; i += 1) {
      var key = fold(fields[i]);
      if (!key) continue;
      if (index.iso[key]) return index.iso[key];
      if (index.iso3[key]) return index.iso3[key];
      if (index.name[key]) return index.name[key];
    }
    return null;
  }

  function matchStore(raw) {
    var key = fold(raw);
    if (!key) return null;
    var all = STORES.concat(EXTRAS);
    var found = null;
    all.forEach(function (store) {
      store.names.forEach(function (name) {
        if (fold(name) === key) found = store;
      });
    });
    return found;
  }

  function cleanLabel(raw) {
    var text = String(raw == null ? '' : raw).replace(/\s+/g, ' ').trim();
    if (!text || text.length > 40) return '';
    if (!/^[A-Za-z0-9][A-Za-z0-9 .&+'/-]*$/.test(text)) return '';
    return text;
  }

  function shortName(country) {
    var best = country.name || country.iso;
    (country.aliases || []).forEach(function (alias) {
      var key = fold(alias);
      if (!key || SKIP_ALIAS[key] || key.length < 4) return;
      if (alias.length < best.length) best = alias;
    });
    return best;
  }

  function summarize(data, countries, opts) {
    var options = opts || {};
    var paid = options.paid !== false;
    var ready = options.ready !== false;
    var payload = data || {};
    if (!paid) {
      return {
        paid: false,
        locked: true,
        note: LOCK_NOTE,
        litCountries: {},
        litStores: {},
        extras: [],
        unmatched: [],
        streams: {}
      };
    }
    var index = buildIndex(countries || []);
    var litCountries = {};
    var streams = {};
    var unmatched = [];
    var seenUnmatched = {};
    (payload.territories || []).forEach(function (row) {
      if (!rowLive(row)) return;
      var hit = ready ? lookup(index, row) : null;
      if (!ready) return;
      if (!hit) {
        var label = String((row && (row.country_name || row.territory || row.name)) || '').replace(/\s+/g, ' ').trim();
        var labelKey = fold(label);
        if (label && !seenUnmatched[labelKey]) {
          seenUnmatched[labelKey] = 1;
          unmatched.push(label);
        }
        return;
      }
      litCountries[hit.iso] = hit;
      streams[hit.iso] = (streams[hit.iso] || 0) + toNumber(row.streams);
    });
    var litStores = {};
    var extras = [];
    var seenExtra = {};
    (payload.dsps || []).forEach(function (row) {
      if (!rowLive(row)) return;
      var name = row && (row.dsp || row.name || row.platform);
      var store = matchStore(name);
      if (store && STORES.some(function (core) { return core.id === store.id; })) {
        litStores[store.id] = store;
        return;
      }
      if (store) {
        if (!seenExtra[store.id]) {
          seenExtra[store.id] = 1;
          extras.push(store);
        }
        return;
      }
      var label = cleanLabel(name);
      if (!label || seenExtra[fold(label)]) return;
      seenExtra[fold(label)] = 1;
      extras.push({ id: 'extra-' + fold(label).replace(/ /g, '-'), label: label, extra: true });
    });
    var any = Object.keys(litCountries).length || Object.keys(litStores).length || extras.length;
    return {
      paid: true,
      locked: false,
      note: any ? '' : EMPTY_NOTE,
      litCountries: litCountries,
      litStores: litStores,
      extras: extras,
      unmatched: unmatched,
      streams: streams
    };
  }

  function svgEl(doc, name) {
    return doc.createElementNS('http://www.w3.org/2000/svg', name);
  }

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
  }

  function paint(doc, data, opts) {
    var options = opts || {};
    var summary = summarize(data, options.countries || [], options);
    if (!doc || typeof doc.querySelector !== 'function') return summary;
    var host = doc.querySelector('[data-analytics-map]');
    if (!host) return summary;
    var note = host.querySelector('[data-analytics-map-note]');
    if (note) {
      note.textContent = summary.note || '';
      note.hidden = !summary.note;
    }
    var stage = host.querySelector('[data-analytics-map-stage]');
    if (stage) {
      clear(stage);
      var svg = svgEl(doc, 'svg');
      svg.setAttribute('class', 'analytics-map-svg');
      svg.setAttribute('viewBox', '0 0 1000 500');
      svg.setAttribute('role', 'img');
      var litNames = Object.keys(summary.litCountries).map(function (iso) {
        return shortName(summary.litCountries[iso]);
      });
      svg.setAttribute('aria-label', litNames.length
        ? 'World map. Plays in ' + litNames.join(', ') + '.'
        : 'World map. ' + (summary.note || EMPTY_NOTE));
      var ocean = svgEl(doc, 'rect');
      ocean.setAttribute('class', 'analytics-map-ocean');
      ocean.setAttribute('x', '0');
      ocean.setAttribute('y', '0');
      ocean.setAttribute('width', '1000');
      ocean.setAttribute('height', '500');
      svg.appendChild(ocean);
      (options.countries || []).forEach(function (country) {
        if (!country || !country.d) return;
        var path = svgEl(doc, 'path');
        path.setAttribute('d', country.d);
        path.setAttribute('data-iso', country.iso);
        var lit = summary.litCountries[country.iso];
        path.setAttribute('class', lit ? 'land is-lit' : 'land');
        if (lit) {
          var title = svgEl(doc, 'title');
          var count = summary.streams[country.iso] || 0;
          title.textContent = shortName(country) + (count ? ' ' + count + ' streams' : '');
          path.appendChild(title);
        }
        svg.appendChild(path);
      });
      stage.appendChild(svg);
    }
    var list = host.querySelector('[data-analytics-map-stores]');
    if (list) {
      clear(list);
      STORES.forEach(function (store) {
        list.appendChild(storeItem(doc, store, Boolean(summary.litStores[store.id]), false));
      });
      summary.extras.forEach(function (store) {
        list.appendChild(storeItem(doc, store, true, true));
      });
    }
    var extra = host.querySelector('[data-analytics-map-extra]');
    if (extra) {
      if (summary.unmatched.length) {
        extra.hidden = false;
        extra.textContent = 'In the numbers, not drawn on the map: ' + summary.unmatched.join(', ') + '.';
      } else {
        extra.hidden = true;
        extra.textContent = '';
      }
    }
    if (host.classList) {
      host.classList.toggle('is-locked', Boolean(summary.locked));
      host.classList.toggle('is-empty', !summary.locked && summary.note === EMPTY_NOTE);
    }
    if (typeof options.onPaint === 'function') options.onPaint(summary);
    return summary;
  }

  function storeItem(doc, store, lit, extra) {
    var item = doc.createElement('li');
    item.setAttribute('data-store', store.id);
    if (extra) item.className = 'is-extra';
    var chip = doc.createElement('span');
    chip.className = lit ? 'map-store is-lit' : 'map-store';
    chip.setAttribute('data-store-label', store.label);
    chip.textContent = store.label;
    item.appendChild(chip);
    return item;
  }

  function drawArcs(doc, reduced) {
    var frame = doc.querySelector('[data-analytics-map-frame]');
    var mark = doc.querySelector('[data-analytics-map-mark]');
    if (!frame || !mark || !frame.getBoundingClientRect || !mark.getBoundingClientRect) return;
    var arcs = frame.querySelector('.analytics-map-arcs');
    if (!arcs) {
      arcs = svgEl(doc, 'svg');
      arcs.setAttribute('class', 'analytics-map-arcs');
      arcs.setAttribute('aria-hidden', 'true');
      frame.appendChild(arcs);
    }
    while (arcs.firstChild) arcs.removeChild(arcs.firstChild);
    var box = frame.getBoundingClientRect();
    if (!box.width || !box.height) return;
    arcs.setAttribute('viewBox', '0 0 ' + box.width + ' ' + box.height);
    arcs.setAttribute('width', String(box.width));
    arcs.setAttribute('height', String(box.height));
    var origin = mark.getBoundingClientRect();
    var x1 = origin.left + (origin.width / 2) - box.left;
    var y1 = origin.top + (origin.height / 2) - box.top;
    var chips = frame.querySelectorAll('.map-store.is-lit');
    Array.prototype.forEach.call(chips, function (chip) {
      var rect = chip.getBoundingClientRect();
      var x2 = rect.left + (rect.width / 2) - box.left;
      var y2 = rect.top + (rect.height / 2) - box.top;
      var path = svgEl(doc, 'path');
      var cx = (x1 + x2) / 2;
      var cy = Math.min(y1, y2) - Math.max(36, Math.abs(x2 - x1) * 0.18);
      path.setAttribute('d', 'M ' + x1.toFixed(1) + ' ' + y1.toFixed(1) + ' Q ' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ' ' + x2.toFixed(1) + ' ' + y2.toFixed(1));
      path.setAttribute('class', reduced ? 'arc' : 'arc is-motion');
      arcs.appendChild(path);
    });
  }

  function boot(view) {
    if (!view || !view.document || !view.document.querySelector('[data-analytics-map]')) return;
    var countries = [];
    var ready = false;
    var last = null;
    var reduced = false;
    try {
      reduced = !!(view.matchMedia && view.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (err) { reduced = false; }

    function paidNow() {
      var mem = view.PlaigroundMembership;
      if (mem && typeof mem.hasPaidAccess === 'function') return !!mem.hasPaidAccess();
      return true;
    }

    function show(data) {
      last = data || { territories: [], dsps: [] };
      paint(view.document, last, { countries: countries, paid: paidNow(), ready: ready, reducedMotion: reduced });
      if (view.requestAnimationFrame) {
        view.requestAnimationFrame(function () { drawArcs(view.document, reduced); });
      } else {
        drawArcs(view.document, reduced);
      }
    }

    function hook() {
      var current = view.PlaigroundAnalytics;
      if (!current || typeof current.render !== 'function') return false;
      if (current.render.__mapWrapped) return true;
      var prev = current.render;
      function wrapped(data) {
        var result;
        try { result = prev.apply(this, arguments); } catch (err) { result = undefined; }
        show(data);
        return result;
      }
      wrapped.__mapWrapped = true;
      current.render = wrapped;
      return true;
    }

    view.PlaigroundMap = { show: show };
    hook();
    if (typeof view.setInterval === 'function') {
      var tries = 0;
      var timer = view.setInterval(function () {
        tries += 1;
        hook();
        if (tries > 40 && typeof view.clearInterval === 'function') view.clearInterval(timer);
      }, 50);
    }

    var frame = view.document.querySelector('[data-analytics-map-frame]');
      if (view.ResizeObserver && frame) {
      var observer = new view.ResizeObserver(function () { drawArcs(view.document, reduced); });
      observer.observe(frame);
    } else if (view.addEventListener) {
      view.addEventListener('resize', function () { drawArcs(view.document, reduced); });
    }

    var fetchJson = view.fetch;
    if (typeof fetchJson !== 'function') return;
    fetchJson.call(view, '/assets/world-countries.json', { headers: { Accept: 'application/json' } })
      .then(function (response) { return response && response.ok ? response.json() : []; })
      .then(function (list) {
        countries = Array.isArray(list) ? list : [];
        ready = true;
        if (last) show(last);
      })
      .catch(function () {
        ready = true;
        if (last) show(last);
      });
  }

  return {
    EMPTY_NOTE: EMPTY_NOTE,
    LOCK_NOTE: LOCK_NOTE,
    STORES: STORES,
    fold: fold,
    summarize: summarize,
    paint: paint,
    drawArcs: drawArcs,
    shortName: shortName,
    boot: boot
  };
});
