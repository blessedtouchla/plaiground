/**
 * Store picker shared by upload and edit release.
 * Default: every store pre-selected, list collapsed.
 * "Pre-select all stores" stays on until Customize + uncheck.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PlaigroundStorePick = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var DEFAULT_STORES = [
    { slug: 'spotify', name: 'Spotify' },
    { slug: 'apple-music', name: 'Apple Music' },
    { slug: 'youtube-music', name: 'YouTube Music' },
    { slug: 'amazon-music', name: 'Amazon Music' },
    { slug: 'deezer', name: 'Deezer' },
    { slug: 'tidal', name: 'Tidal' },
    { slug: 'soundcloud', name: 'SoundCloud' },
    { slug: 'boomplay', name: 'Boomplay' },
    { slug: 'audiomack', name: 'Audiomack' },
    { slug: 'pandora', name: 'Pandora' },
    { slug: 'napster', name: 'Napster' },
    { slug: 'anghami', name: 'Anghami' },
    { slug: 'tiktok', name: 'TikTok' },
    { slug: 'tiktok-music', name: 'TikTok Music' },
    { slug: 'iheartradio', name: 'iHeartRadio' },
    { slug: 'kkbox', name: 'KKBOX' },
    { slug: 'jiosaavn', name: 'JioSaavn' },
    { slug: 'youtube', name: 'YouTube' },
  ];

  function prettySlug(slug) {
    return String(slug || '').replace(/[-_]+/g, ' ').replace(/\b\w/g, function (ch) {
      return ch.toUpperCase();
    });
  }

  function storeName(row) {
    if (!row) return '';
    if (typeof row === 'string') return prettySlug(row);
    var slug = row.slug || '';
    var name = row.name || '';
    if (name && String(name).toLowerCase() !== String(slug).toLowerCase()) return name;
    return prettySlug(slug || name);
  }

  function normalizeStores(list) {
    var out = [];
    var seen = {};
    (list || []).forEach(function (row) {
      var slug = typeof row === 'string' ? row : (row && (row.slug || row.dsp || row.name));
      slug = String(slug || '').trim().toLowerCase();
      if (!slug || seen[slug]) return;
      seen[slug] = true;
      out.push({ slug: slug, name: storeName(typeof row === 'string' ? slug : row) || prettySlug(slug) });
    });
    return out;
  }

  function q(root, sel) {
    return root && root.querySelector ? root.querySelector(sel) : null;
  }

  function setHidden(el, hidden) {
    if (!el) return;
    el.hidden = Boolean(hidden);
    if (el.classList && el.classList.toggle) el.classList.toggle('is-hidden', Boolean(hidden));
    else if (el.classList) {
      if (hidden && el.classList.add) el.classList.add('is-hidden');
      if (!hidden && el.classList.remove) el.classList.remove('is-hidden');
    }
  }

  function listBoxes(list) {
    if (!list || !list.querySelectorAll) return [];
    return Array.prototype.slice.call(list.querySelectorAll('input[type="checkbox"]'));
  }

  function slugsFrom(list, checkedOnly) {
    return listBoxes(list).filter(function (box) {
      return !checkedOnly || box.checked;
    }).map(function (box) { return box.value; });
  }

  function selected(root) {
    if (!root) return [];
    var list = q(root, '[data-store-list]') || q(root, '[data-edit-stores]');
    var allBox = q(root, '[data-store-all]');
    if (allBox && allBox.checked) return slugsFrom(list, false);
    return slugsFrom(list, true);
  }

  function ensureChrome(root, doc) {
    if (q(root, '[data-store-all]')) {
      if (!q(root, '[data-store-list]') && q(root, '[data-edit-stores]')) {
        q(root, '[data-edit-stores]').setAttribute('data-store-list', '');
      }
      return;
    }
    var bar = doc.createElement('div');
    bar.className = 'store-pick-bar';
    var toggle = doc.createElement('label');
    toggle.className = 'toggle-line';
    var box = doc.createElement('input');
    box.className = 'toggle-input';
    box.type = 'checkbox';
    box.setAttribute('data-store-all', '');
    box.checked = true;
    var knob = doc.createElement('span');
    knob.className = 'toggle on';
    knob.setAttribute('aria-hidden', 'true');
    var text = doc.createElement('span');
    text.textContent = 'Pre-select all stores';
    toggle.appendChild(box);
    toggle.appendChild(knob);
    toggle.appendChild(text);
    var customize = doc.createElement('button');
    customize.type = 'button';
    customize.className = 'btn btn-ghost btn-sm';
    customize.setAttribute('data-store-customize', '');
    customize.textContent = 'Customize';
    bar.appendChild(toggle);
    bar.appendChild(customize);
    var summary = doc.createElement('p');
    summary.className = 'hint';
    summary.setAttribute('data-store-summary', '');
    var list = q(root, '[data-store-list]') || q(root, '[data-edit-stores]');
    if (!list) {
      list = doc.createElement('div');
      list.className = 'store-pick is-hidden';
      list.setAttribute('data-store-list', '');
      list.setAttribute('data-edit-stores', '');
      list.hidden = true;
    } else {
      list.setAttribute('data-store-list', '');
    }
    root.appendChild(bar);
    root.appendChild(summary);
    if (!list.parentNode) root.appendChild(list);
  }

  function bind(root, opts) {
    if (!root) return null;
    opts = opts || {};
    var doc = (opts.document) || (typeof document !== 'undefined' ? document : null);
    if (!doc || !doc.createElement) return null;
    var stores = normalizeStores(opts.stores && opts.stores.length ? opts.stores : DEFAULT_STORES);
    var selectedSlugs = Array.isArray(opts.selected)
      ? opts.selected.map(function (slug) { return String(slug || '').toLowerCase(); }).filter(Boolean)
      : null;
    var allOn = !selectedSlugs || !selectedSlugs.length;
    if (selectedSlugs && selectedSlugs.length && stores.length && selectedSlugs.length < stores.length) {
      allOn = selectedSlugs.length === stores.length;
    }
    if (selectedSlugs && stores.length && selectedSlugs.length >= stores.length) allOn = true;

    ensureChrome(root, doc);
    var allBox = q(root, '[data-store-all]');
    var customize = q(root, '[data-store-customize]');
    var summary = q(root, '[data-store-summary]');
    var list = q(root, '[data-store-list]') || q(root, '[data-edit-stores]');
    var state = root._plaigroundStores || {};

    function emit() {
      var picked = selected(root);
      if (summary) {
        var total = slugsFrom(list, false).length || stores.length;
        if (allBox && allBox.checked) {
          summary.textContent = 'All ' + total + ' stores will receive this release.';
        } else {
          summary.textContent = picked.length + ' of ' + total + ' stores selected.';
        }
      }
      if (typeof opts.onChange === 'function') {
        opts.onChange(picked, Boolean(allBox && allBox.checked));
      }
    }

    function setAllChecked(on) {
      listBoxes(list).forEach(function (box) { box.checked = on; });
      if (allBox) allBox.checked = on;
      if (allBox && allBox.parentNode) {
        var knob = allBox.parentNode.querySelector ? allBox.parentNode.querySelector('.toggle') : null;
        if (knob && knob.classList && knob.classList.toggle) knob.classList.toggle('on', on);
      }
    }

    function fillList() {
      if (!list) return;
      list.textContent = '';
      if (Array.isArray(list.children)) list.children.length = 0;
      var picked = {};
      if (!allOn && selectedSlugs) {
        selectedSlugs.forEach(function (slug) { picked[slug] = true; });
      }
      stores.forEach(function (row) {
        var label = doc.createElement('label');
        var box = doc.createElement('input');
        box.type = 'checkbox';
        box.value = row.slug;
        box.checked = allOn || Boolean(picked[row.slug]);
        if (box.addEventListener) {
          box.addEventListener('change', function () {
            var every = listBoxes(list).every(function (item) { return item.checked; });
            if (allBox) allBox.checked = every;
            if (allBox && allBox.parentNode) {
              var knob = allBox.parentNode.querySelector ? allBox.parentNode.querySelector('.toggle') : null;
              if (knob && knob.classList && knob.classList.toggle) knob.classList.toggle('on', every);
            }
            emit();
          });
        }
        label.appendChild(box);
        if (doc.createTextNode) label.appendChild(doc.createTextNode(' ' + row.name));
        else label.textContent = (label.textContent || '') + ' ' + row.name;
        list.appendChild(label);
      });
    }

    fillList();
    setHidden(list, true);
    if (customize) customize.textContent = 'Customize';
    setAllChecked(allOn);
    if (!allOn && selectedSlugs) {
      listBoxes(list).forEach(function (box) {
        box.checked = selectedSlugs.indexOf(String(box.value).toLowerCase()) !== -1;
      });
      if (allBox) allBox.checked = false;
    }

    if (!state.bound) {
      if (allBox && allBox.addEventListener) {
        allBox.addEventListener('change', function () {
          if (allBox.checked) {
            setAllChecked(true);
            setHidden(list, true);
            if (customize) customize.textContent = 'Customize';
          } else {
            setHidden(list, false);
            if (customize) customize.textContent = 'Hide stores';
          }
          emit();
        });
      }
      if (customize && customize.addEventListener) {
        customize.addEventListener('click', function (event) {
          if (event && event.preventDefault) event.preventDefault();
          var open = !(list && list.hidden);
          setHidden(list, open);
          customize.textContent = open ? 'Customize' : 'Hide stores';
        });
      }
      state.bound = true;
      root._plaigroundStores = state;
    }

    emit();
    return {
      selected: function () { return selected(root); },
      stores: stores,
    };
  }

  return {
    DEFAULT_STORES: DEFAULT_STORES,
    normalizeStores: normalizeStores,
    bind: bind,
    selected: selected,
  };
});
