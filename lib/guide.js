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

  var ROLES = {
    artist: { id: 'artist', label: 'Artist', artistCount: '1' },
    producer: { id: 'producer', label: 'Producer', artistCount: '1' },
    songwriter: { id: 'songwriter', label: 'Songwriter', artistCount: '1' },
    manager: { id: 'manager', label: 'Manager', artistCount: 'label' }
  };

  var SONG_CHOICES = [
    { id: 'idea', label: 'Just an idea' },
    { id: 'made', label: 'Made it' },
    { id: 'out', label: "It's out" }
  ];

  var WANTS = {
    release: { id: 'release', label: 'Get it out there', goal: 'release' },
    heard: { id: 'heard', label: 'Get it heard', goal: 'fanbase' },
    paid: { id: 'paid', label: 'Get paid', goal: 'money' },
    team: { id: 'team', label: 'Get a team', goal: 'fanbase' }
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

  function mark(status, answers, store) {
    var box = store || storage();
    var flag = {
      status: status === 'skipped' ? 'skipped' : 'completed',
      role: answers && answers.role ? answers.role : '',
      song: answers && answers.song ? answers.song : '',
      want: answers && answers.want ? answers.want : '',
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
    var role = ROLES[answers.role] || ROLES.artist;
    var song = destination.SONGS && destination.SONGS[answers.song] ? answers.song : 'idea';
    var want = WANTS[answers.want] || WANTS.release;
    var built = build(want, song);
    var stops = [];
    (built.stops || []).forEach(function (id) {
      if (destination.STOPS && destination.STOPS[id] && stops.indexOf(id) === -1) stops.push(id);
    });
    var first = stops[0] || '';
    return {
      role: role.id,
      want: want.id,
      song: built.song || song,
      goal: built.goal,
      kit: built.kit || '',
      managed: !!built.managed,
      stops: stops,
      artistCount: role.artistCount,
      note: '',
      firstStop: first,
      firstHref: stopHref(first)
    };
  }

  return {
    FLAG_KEY: FLAG_KEY,
    GUIDE_HREF: GUIDE_HREF,
    ROLES: ROLES,
    SONG_CHOICES: SONG_CHOICES,
    WANTS: WANTS,
    readFlag: readFlag,
    isDone: isDone,
    mark: mark,
    hrefAfterAuth: hrefAfterAuth,
    stopHref: stopHref,
    routeFor: routeFor
  };
});
