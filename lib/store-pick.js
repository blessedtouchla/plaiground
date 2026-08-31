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

  var FAQ_DISPLAY_NAMES = {
    '7digital': '7digital',
    acrcloud: 'ACRCloud',
    'amazon-music': 'Amazon Music',
    anghami: 'Anghami',
    'apple-music': 'Apple Music',
    'apple-music-video': 'Apple Music Video',
    audiomack: 'Audiomack',
    'audiomack-video': 'Audiomack Video',
    awa: 'AWA',
    bandcamp: 'Bandcamp',
    beatport: 'Beatport',
    boomplay: 'Boomplay',
    'boomplay-video': 'Boomplay Video',
    canva: 'Canva',
    'claro-musica': 'Claro Música',
    deezer: 'Deezer',
    'facebook-audio-library': 'Facebook Audio Library',
    'facebook-rights-manager': 'Facebook Rights Manager',
    flo: 'FLO',
    gaana: 'Gaana',
    iheartradio: 'iHeartRadio',
    imusica: 'iMusica',
    'instagram-facebook': 'Instagram/Facebook',
    jiosaavn: 'JioSaavn',
    joox: 'JOOX',
    kkbox: 'KKBox',
    lickd: 'Lickd',
    melon: 'Melon',
    mixcloud: 'Mixcloud',
    napster: 'Napster',
    netease: 'NetEase Cloud Music',
    nuuday: 'Nuuday',
    pandora: 'Pandora',
    peloton: 'Peloton',
    pinterest: 'Pinterest',
    qobuz: 'Qobuz',
    roxi: 'Roxi',
    snapchat: 'Snapchat',
    soundcloud: 'SoundCloud',
    soundexchange: 'SoundExchange',
    'soundtrack-your-brand': 'Soundtrack Your Brand',
    spotify: 'Spotify',
    taobao: 'Taobao',
    'tencent-music': 'Tencent Music',
    tidal: 'Tidal',
    'tidal-video': 'TIDAL Video',
    tiktok: 'TikTok',
    'tiktok-music': 'TikTok Music',
    trace: 'Trace',
    trebel: 'Trebel',
    'tuned-global': 'Tuned Global',
    vevo: 'Vevo',
    youtube: 'YouTube',
    'youtube-content-id': 'YouTube Content ID',
    'youtube-music': 'YouTube Music',
  };

  var FAQ_GROUP_DEFS = [
    {
      key: 'streaming',
      title: 'Streaming',
      slugs: [
        'spotify', 'apple-music', 'youtube-music', 'amazon-music', 'deezer', 'tidal',
        'pandora', 'soundcloud', 'audiomack', 'boomplay', 'anghami', 'jiosaavn',
        'netease', 'tencent-music', 'kkbox', 'joox', 'melon', 'flo', 'gaana',
        'napster', 'qobuz', '7digital', 'awa', 'iheartradio', 'mixcloud', 'trebel',
        'nuuday', 'tuned-global', 'claro-musica', 'imusica', 'roxi', 'trace', 'peloton',
      ],
    },
    {
      key: 'social',
      title: 'Social / video',
      slugs: [
        'youtube', 'tiktok', 'tiktok-music', 'instagram-facebook', 'snapchat', 'vevo',
        'apple-music-video', 'audiomack-video', 'boomplay-video', 'tidal-video',
      ],
    },
    {
      key: 'rights',
      title: 'Rights / tools',
      note: 'Still delivered, not a listening app.',
      slugs: [
        'youtube-content-id', 'facebook-rights-manager', 'facebook-audio-library',
        'soundexchange', 'acrcloud', 'canva', 'pinterest', 'lickd',
        'soundtrack-your-brand', 'bandcamp', 'beatport', 'taobao',
      ],
    },
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

  function asCount(value) {
    var n = Number(value);
    return n > 0 ? n : 0;
  }

  function isAllStores(picked, total, allOn) {
    var n = asCount(total);
    var p = asCount(picked);
    if (allOn) return true;
    if (n > 0 && p >= n) return true;
    return false;
  }

  function formatReviewSummary(picked, total, allOn) {
    var n = asCount(total);
    var p = asCount(picked);
    if (isAllStores(p, n, allOn) && n) return 'All ' + n + ' stores will receive this release.';
    if (n) return p + ' of ' + n + ' stores selected.';
    return 'All stores will receive this release.';
  }

  function formatSubmitted(picked, total, allOn) {
    var n = asCount(total);
    var p = asCount(picked);
    if (!n && !p) return '';
    if (isAllStores(p, n, allOn)) return 'All ' + (n || p) + ' stores';
    return p + ' of ' + n + ' stores';
  }

  function faqFallbackStores() {
    var out = [];
    FAQ_GROUP_DEFS.forEach(function (def) {
      def.slugs.forEach(function (slug) {
        out.push({ slug: slug, name: FAQ_DISPLAY_NAMES[slug] || prettySlug(slug) });
      });
    });
    return out;
  }

  function faqLabel(row) {
    if (!row) return '';
    var slug = String(row.slug || '').toLowerCase();
    if (slug && FAQ_DISPLAY_NAMES[slug]) return FAQ_DISPLAY_NAMES[slug];
    return row.name || prettySlug(slug);
  }

  function groupFaqStores(list) {
    var stores = normalizeStores(list && list.length ? list : faqFallbackStores());
    var bySlug = {};
    stores.forEach(function (row) { bySlug[row.slug] = row; });
    var used = {};
    var groups = [];
    FAQ_GROUP_DEFS.forEach(function (def) {
      var items = [];
      def.slugs.forEach(function (slug) {
        if (!bySlug[slug]) return;
        used[slug] = true;
        items.push({ slug: slug, name: faqLabel(bySlug[slug]) });
      });
      if (!items.length) return;
      groups.push({
        key: def.key,
        title: def.title,
        note: def.note || '',
        names: items.map(function (item) { return item.name; }),
        stores: items,
      });
    });
    var extra = stores.filter(function (row) { return !used[row.slug]; });
    if (extra.length) {
      groups.push({
        key: 'also',
        title: 'Also delivered',
        note: '',
        names: extra.map(faqLabel),
        stores: extra.map(function (row) {
          return { slug: row.slug, name: faqLabel(row) };
        }),
      });
    }
    return groups;
  }

  function formatFaqStores(list) {
    var stores = normalizeStores(list && list.length ? list : faqFallbackStores());
    var groups = groupFaqStores(stores);
    var names = stores.map(faqLabel).filter(Boolean);
    var count = names.length;
    return {
      count: count,
      names: names,
      groups: groups,
      // User-facing copy is locked to 150. Do not paint stores.length or a live count.
      sentence: 'We deliver to 150 platforms.',
    };
  }

  function faqDoc(root) {
    return (root && root.ownerDocument)
      || (typeof document !== 'undefined' ? document : null);
  }

  function paintFaqStoreGroups(host, groups, doc) {
    if (!host) return;
    host.textContent = '';
    if (Array.isArray(host.children)) host.children.length = 0;
    groups.forEach(function (group) {
      var wrap = doc && doc.createElement ? doc.createElement('div') : { children: [] };
      wrap.className = 'faq-store-group';
      var heading = doc && doc.createElement ? doc.createElement('h3') : { textContent: '' };
      heading.textContent = group.title;
      if (wrap.appendChild) wrap.appendChild(heading);
      if (group.note) {
        var note = doc && doc.createElement ? doc.createElement('p') : { textContent: '' };
        note.className = 'faq-store-note';
        note.textContent = group.note;
        if (wrap.appendChild) wrap.appendChild(note);
      }
      var ul = doc && doc.createElement ? doc.createElement('ul') : { children: [] };
      group.names.forEach(function (name) {
        var item = doc && doc.createElement ? doc.createElement('li') : { textContent: '' };
        item.textContent = name;
        if (ul.appendChild) ul.appendChild(item);
      });
      if (wrap.appendChild) wrap.appendChild(ul);
      if (host.appendChild) host.appendChild(wrap);
    });
  }

  function paintFaqStores(root, list) {
    var info = formatFaqStores(list);
    if (!root) return info;
    var sentenceEls = root.querySelectorAll
      ? root.querySelectorAll('[data-faq-store-count]')
      : [];
    if ((!sentenceEls || !sentenceEls.length) && root.querySelector) {
      var one = root.querySelector('[data-faq-store-count]');
      sentenceEls = one ? [one] : [];
    }
    Array.prototype.forEach.call(sentenceEls, function (sentence) {
      sentence.textContent = info.sentence;
    });
    var doc = faqDoc(root);
    var groupsHost = root.querySelector ? root.querySelector('[data-faq-store-groups]') : null;
    if (groupsHost) paintFaqStoreGroups(groupsHost, info.groups, doc);
    var host = root.querySelector ? root.querySelector('[data-faq-store-list]') : null;
    if (host && !groupsHost) {
      host.textContent = '';
      if (Array.isArray(host.children)) host.children.length = 0;
      info.names.forEach(function (name) {
        var item = doc && doc.createElement ? doc.createElement('li') : { textContent: name };
        item.textContent = name;
        if (host.appendChild) host.appendChild(item);
      });
    }
    return info;
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
      var total = slugsFrom(list, false).length || stores.length;
      var allOn = Boolean(allBox && allBox.checked);
      if (summary) summary.textContent = formatReviewSummary(picked.length, total, allOn);
      if (typeof opts.onChange === 'function') {
        opts.onChange(picked, allOn, total);
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
        label.className = 'store-pick-item';
        var box = doc.createElement('input');
        box.type = 'checkbox';
        box.className = 'store-pick-box';
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
        var name = doc.createElement('span');
        name.className = 'store-pick-name';
        name.textContent = row.name;
        label.appendChild(box);
        label.appendChild(name);
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
    FAQ_FALLBACK_STORES: faqFallbackStores(),
    normalizeStores: normalizeStores,
    bind: bind,
    selected: selected,
    formatReviewSummary: formatReviewSummary,
    formatSubmitted: formatSubmitted,
    formatFaqStores: formatFaqStores,
    groupFaqStores: groupFaqStores,
    paintFaqStores: paintFaqStores,
  };
});
