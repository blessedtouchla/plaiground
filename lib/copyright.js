(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PlaigroundCopyright = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  var MAP_KEY = 'plaigroundCopyrightByRelease';
  var DRAFT_KEY = 'plaiground.store.draft';
  var DISCLAIMER = 'General info, not legal advice.';
  var LANE_ASK = 'Was this song fully human, or did you use AI?';
  var SUMMARY_TITLE = 'These are the parts we can protect.';

  var PARTS = [
    { id: 'lyrics', ask: 'Did you write the lyrics?', yes: 'Lyrics you wrote' },
    { id: 'sing', ask: 'Did you sing it yourself?', yes: 'Vocals you sang' },
    { id: 'instruments', ask: 'Did you play any instruments?', yes: 'Instruments you played' },
    { id: 'melody', ask: 'Did you write the melody?', yes: 'Melody or topline you made' },
    { id: 'arrange', ask: 'Did you arrange or edit it?', yes: 'Arrangement, selection, and edits you made' }
  ];

  var HUMAN_STEPS = [
    {
      id: 'keep',
      title: 'Keep the proof',
      body: 'Save the recording, the lyrics, and the date you finished them. A human-made song can be registered with the US Copyright Office. You do that yourself.'
    },
    {
      id: 'splits',
      title: 'Name the writers',
      body: 'Write who made what, and the shares. A split sheet keeps that clear for this song.',
      href: 'splits.html',
      link: 'Open split sheets'
    },
    {
      id: 'publish',
      title: 'Register publishing',
      body: 'Publishing is separate from distribution. Every artist can register this song.',
      href: 'publishing-register.html',
      link: 'Register publishing'
    }
  ];

  var BENEFITS = [
    {
      id: 'pro',
      title: 'Performance royalties (PRO)',
      body: 'When the song is played in public, on the radio, or live, a PRO can collect that money for the writers.'
    },
    {
      id: 'mech',
      title: 'Mechanical royalties',
      body: 'Streams and downloads of the composition can earn mechanical royalties.'
    },
    {
      id: 'sync',
      title: 'Sync licensing',
      body: 'A film, show, or ad can license the song. No placement promise.'
    },
    {
      id: 'proof',
      title: 'Proof of ownership',
      body: 'A dated note of what a person made helps show this song is yours.'
    },
    {
      id: 'extra',
      title: 'Extra income',
      body: 'Those payments can sit beside whatever the stores already pay you.'
    }
  ];

  var AI_EXPLAINER = {
    title: 'The human parts can',
    body: 'Under current US Copyright Office guidance, purely AI-generated material can\'t be copyrighted, but the human parts can. That can include lyrics you wrote, a melody or topline you made, arrangement and selection choices, real recorded vocals or instruments, and edits.'
  };

  var EMPTY_SUMMARY = 'Purely AI-generated material can\'t be copyrighted under current US Copyright Office guidance. Nothing here is a human part yet.';

  function emptyParts() {
    return { lyrics: null, sing: null, instruments: null, melody: null, arrange: null };
  }

  function blank() {
    return { lane: '', parts: emptyParts(), at: '' };
  }

  function storageBox(store) {
    return store || null;
  }

  function readJson(store, key) {
    var box = storageBox(store);
    if (!box || !box.getItem) return null;
    try {
      var raw = box.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (err) {
      return null;
    }
  }

  function writeJson(store, key, value) {
    var box = storageBox(store);
    if (!box || !box.setItem) return;
    try {
      box.setItem(key, JSON.stringify(value));
    } catch (err) {}
  }

  function readMap(store) {
    var parsed = readJson(store, MAP_KEY);
    var releases = parsed && parsed.releases && typeof parsed.releases === 'object' ? parsed.releases : {};
    return { releases: releases };
  }

  function readDraft(store) {
    var parsed = readJson(store, DRAFT_KEY);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed;
  }

  function normalize(record) {
    var parts = emptyParts();
    var src = record && record.parts ? record.parts : {};
    PARTS.forEach(function (part) {
      if (src[part.id] === true || src[part.id] === false) parts[part.id] = src[part.id];
    });
    var lane = '';
    if (record && record.lane === 'human') lane = 'human';
    if (record && record.lane === 'ai') lane = 'ai';
    return {
      lane: lane,
      parts: parts,
      at: record && record.at ? String(record.at) : ''
    };
  }

  function summary(parts) {
    var list = [];
    PARTS.forEach(function (part) {
      if (parts && parts[part.id] === true) list.push(part.yes);
    });
    return list;
  }

  function isComplete(record) {
    var next = normalize(record);
    if (next.lane === 'human') return true;
    if (next.lane !== 'ai') return false;
    return PARTS.every(function (part) {
      return typeof next.parts[part.id] === 'boolean';
    });
  }

  function save(store, releaseId, record) {
    var next = normalize(record);
    next.at = next.at || new Date().toISOString();
    var id = String(releaseId || '').trim();
    if (id) {
      var map = readMap(store);
      map.releases[id] = next;
      writeJson(store, MAP_KEY, map);
    }
    var draft = readDraft(store);
    var draftId = draft && draft.release_id ? String(draft.release_id) : '';
    if (!id) {
      if (!draft) draft = {};
      draft.protect = next;
      writeJson(store, DRAFT_KEY, draft);
    } else if (draft && draftId === id) {
      draft.protect = next;
      writeJson(store, DRAFT_KEY, draft);
    }
    return next;
  }

  function load(store, releaseId) {
    var id = String(releaseId || '').trim();
    var draft = readDraft(store);
    if (!id && draft && draft.release_id) id = String(draft.release_id);
    if (!id) {
      if (draft && draft.protect) return normalize(draft.protect);
      return blank();
    }
    var map = readMap(store);
    if (map.releases[id]) return normalize(map.releases[id]);
    if (draft && String(draft.release_id || '') === id && draft.protect) return normalize(draft.protect);
    return blank();
  }

  function releaseIdFromQuery(search) {
    var raw = String(search || '');
    if (raw.charAt(0) === '?') raw = raw.slice(1);
    try {
      var params = new URLSearchParams(raw);
      return String(params.get('release') || params.get('id') || '').trim();
    } catch (err) {
      return '';
    }
  }

  function screens(record) {
    var lane = record && record.lane;
    var list = [{ id: 'lane', kind: 'lane', title: LANE_ASK }];
    if (lane === 'human') {
      HUMAN_STEPS.forEach(function (step) {
        list.push({ id: step.id, kind: 'step', title: step.title, body: step.body, href: step.href || '', link: step.link || '' });
      });
      list.push({ id: 'benefits', kind: 'benefits', title: 'What this can do for you' });
    } else if (lane === 'ai') {
      list.push({ id: 'explain', kind: 'explain', title: AI_EXPLAINER.title, body: AI_EXPLAINER.body });
      PARTS.forEach(function (part) {
        list.push({ id: part.id, kind: 'part', title: part.ask });
      });
      list.push({ id: 'summary', kind: 'summary', title: SUMMARY_TITLE });
      list.push({
        id: 'paths',
        kind: 'paths',
        title: 'Next for this song',
        links: [
          { href: '/qualify', label: 'Qualify my song' },
          { href: '/make-human', label: 'Make it human' }
        ]
      });
      list.push({ id: 'benefits', kind: 'benefits', title: 'What this can do for you' });
    }
    return list;
  }

  return {
    MAP_KEY: MAP_KEY,
    DRAFT_KEY: DRAFT_KEY,
    DISCLAIMER: DISCLAIMER,
    LANE_ASK: LANE_ASK,
    SUMMARY_TITLE: SUMMARY_TITLE,
    EMPTY_SUMMARY: EMPTY_SUMMARY,
    PARTS: PARTS,
    HUMAN_STEPS: HUMAN_STEPS,
    BENEFITS: BENEFITS,
    AI_EXPLAINER: AI_EXPLAINER,
    summary: summary,
    isComplete: isComplete,
    save: save,
    load: load,
    normalize: normalize,
    screens: screens,
    releaseIdFromQuery: releaseIdFromQuery,
    blank: blank,
    readDraft: readDraft
  };
});
