(function (root, factory) {
  var destination = typeof module === 'object' && module.exports
    ? require('../destination')
    : (root.DestinationCore || {});
  var api = factory(destination);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PlaigroundGuide = api;
})(typeof window !== 'undefined' ? window : globalThis, function (destination) {
  var root = typeof window !== 'undefined' ? window : globalThis;
  var FLAG_KEY = 'plaigroundGuide';
  var GUIDE_HREF = '/guide';

  var SONG_CHOICES = [
    { id: 'idea', label: 'Just an idea' },
    { id: 'made', label: 'Made it' },
    { id: 'out', label: "It's out" }
  ];

  var WANTS = {
    release: { id: 'release', label: 'Get it out there', goal: 'release' },
    heard: { id: 'heard', label: 'Get it heard', goal: 'fanbase' },
    paid: { id: 'paid', label: 'Get paid', goal: 'money' },
    team: { id: 'team', label: 'Let Plai handle it', goal: 'fanbase' }
  };

  function storage() {
    try {
      return root.localStorage || null;
    } catch (err) {
      return null;
    }
  }

  function readFlag(store) {
    var box = store || storage();
    if (!box || !box.getItem) return null;
    try {
      var raw = box.getItem(FLAG_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || (parsed.status !== 'completed' && parsed.status !== 'skipped')) return null;
      return parsed;
    } catch (err) {
      return null;
    }
  }

  function isDone(store) {
    return !!readFlag(store);
  }

  var PRICE = {
    distro: { cents: 249, label: '$2.49 a song' },
    sync: { cents: 2900, label: '$29/mo or 20% of the placement' }
  };

  var DIRECT = {
    release: ['distro', 'persona', 'check', 'cover'],
    heard: ['pitch', 'marketing', 'billboard'],
    paid: ['royalties', 'publishing', 'sync'],
    team: ['shows', 'persona']
  };

  function mark(status, answers, store) {
    var box = store || storage();
    var picked = wantsFrom({
      want: answers && answers.want,
      wants: answers && answers.wants,
      allowEmpty: true
    });
    var flag = {
      status: status === 'skipped' ? 'skipped' : 'completed',
      song: answers && answers.song ? answers.song : '',
      want: picked[0] || '',
      wants: picked,
      pace: paceOf(answers),
      at: new Date().toISOString()
    };
    if (!box || !box.setItem) return flag;
    try {
      box.setItem(FLAG_KEY, JSON.stringify(flag));
    } catch (err) {}
    return flag;
  }

  function isDefaultHome(href) {
    var value = String(href || '').split('?')[0].split('#')[0];
    if (value.charAt(0) === '/') value = value.slice(1);
    return value === 'dashboard.html' || value === 'admin' || value === 'admin.html';
  }

  function hrefAfterAuth(fallback, account, extras) {
    var home = fallback || 'dashboard.html';
    var extra = extras || {};
    var member = extra.membership || root.PlaigroundMembership || null;
    if (member && typeof member.isOwner === 'function') {
      try {
        if (member.isOwner(account)) return home;
      } catch (err) {}
    }
    if (isDone(extra.store)) return home;
    if (!isDefaultHome(home)) return home;
    return GUIDE_HREF;
  }

  function stopHref(id) {
    if (!id || !destination.explain) return '/destination';
    var info = destination.explain(id, 'release');
    if (info && info.href) return info.href;
    if (id === 'helper') return '/song-helper';
    if (id === 'cover') return '/cover-art';
    return '/destination';
  }

  function wantsFrom(answers) {
    answers = answers || {};
    var raw = answers.wants != null ? answers.wants : answers.want;
    var list = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    var out = [];
    list.forEach(function (id) {
      if (WANTS[id] && out.indexOf(id) === -1) out.push(id);
    });
    if (!out.length && !(answers && answers.allowEmpty)) out.push('release');
    return out;
  }

  function paceOf(answers) {
    var pace = answers && answers.pace;
    return pace === 'fast' || pace === 'cheap' ? pace : '';
  }

  function uniqueStops(lists) {
    var seen = {};
    var out = [];
    (lists || []).forEach(function (list) {
      (list || []).forEach(function (id) {
        if (!destination.STOPS || !destination.STOPS[id] || seen[id]) return;
        seen[id] = true;
        out.push(id);
      });
    });
    return out;
  }

  function byStopOrder(ids) {
    var on = {};
    (ids || []).forEach(function (id) { on[id] = true; });
    return (destination.STOP_ORDER || []).filter(function (id) { return on[id]; });
  }

  function priceLabel(id) {
    return PRICE[id] ? PRICE[id].label : '';
  }

  function cheapStops(ids) {
    var free = [];
    var paid = [];
    var ask = [];
    byStopOrder(ids).forEach(function (id) {
      var stop = destination.STOPS[id];
      if (PRICE[id]) paid.push(id);
      else if (stop && (stop.status === 'ask' || stop.status === 'apply')) ask.push(id);
      else free.push(id);
    });
    paid.sort(function (a, b) { return PRICE[a].cents - PRICE[b].cents; });
    return free.concat(paid, ask);
  }

  function fastStops(ids, song, picked) {
    var on = {};
    (ids || []).forEach(function (id) { on[id] = true; });
    var short = [];
    function add(id) {
      if (on[id] && short.indexOf(id) === -1) short.push(id);
    }
    if (song === 'idea') add('helper');
    (picked || []).forEach(function (want) {
      var prefs = DIRECT[want] || [];
      var i;
      for (i = 0; i < prefs.length; i++) {
        if (on[prefs[i]]) {
          add(prefs[i]);
          break;
        }
      }
    });
    if (!short.length) return (ids || []).slice(0, 1);
    return byStopOrder(short);
  }

  function build(want, song) {
    if (want.id === 'release' && song === 'made') return destination.applyKit('release', song, 'release');
    if (want.id === 'heard' && song === 'out') return destination.applyKit('record', song, 'fanbase');
    if (want.id === 'team') return destination.applyKit('management', song, 'fanbase');
    return {
      kit: '',
      song: song,
      goal: want.goal,
      stops: destination.recommendedIds(song, want.goal),
      managed: false
    };
  }

  function routeFor(answers) {
    answers = answers || {};
    var song = destination.SONGS && destination.SONGS[answers.song] ? answers.song : 'idea';
    var picked = wantsFrom(answers);
    var pace = paceOf(answers);
    var built = picked.map(function (id) { return build(WANTS[id], song); });
    var single = picked.length === 1 ? built[0] : null;
    var stops = single
      ? uniqueStops([single.stops])
      : byStopOrder(uniqueStops(built.map(function (row) { return row.stops; })));
    var kit = '';
    var managed = false;
    var goal = WANTS[picked[0]].goal;
    var routeSong = song;
    if (single) {
      kit = single.kit || '';
      managed = !!single.managed;
      goal = single.goal;
      routeSong = single.song || song;
    } else {
      built.forEach(function (row) {
        if (row.managed) managed = true;
      });
    }
    if (pace === 'fast') stops = fastStops(stops, routeSong, picked);
    else if (pace === 'cheap') stops = cheapStops(stops);
    var first = stops[0] || '';
    return {
      want: picked[0],
      wants: picked.slice(),
      pace: pace,
      song: routeSong,
      goal: goal,
      kit: kit,
      managed: managed,
      stops: stops,
      artistCount: '1',
      note: '',
      firstStop: first,
      firstHref: stopHref(first)
    };
  }

  return {
    FLAG_KEY: FLAG_KEY,
    GUIDE_HREF: GUIDE_HREF,
    SONG_CHOICES: SONG_CHOICES,
    WANTS: WANTS,
    PRICE: PRICE,
    priceLabel: priceLabel,
    wantsFrom: wantsFrom,
    readFlag: readFlag,
    isDone: isDone,
    mark: mark,
    hrefAfterAuth: hrefAfterAuth,
    stopHref: stopHref,
    routeFor: routeFor
  };
});
