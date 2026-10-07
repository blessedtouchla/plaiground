'use strict';

/**
 * Song Helper purpose, reveals, and sensory ladder.
 * Shared by the page and the draft prompt. No API key lives here.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SongFlow = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var FOR_OPTIONS = [
    { id: 'everyone', label: 'Everyone' },
    { id: 'someone', label: 'Someone specific' },
    { id: 'myself', label: 'Myself' },
  ];

  var AIM_OPTIONS = [
    { id: 'heal', label: 'Heal' },
    { id: 'hype', label: 'Hype up' },
    { id: 'laugh', label: 'Make them laugh' },
    { id: 'cry', label: 'Make them cry' },
    { id: 'inspire', label: 'Inspire' },
    { id: 'confess', label: 'Confess' },
    { id: 'celebrate', label: 'Celebrate' },
    { id: 'clapback', label: 'Get revenge/clap back' },
    { id: 'comfort', label: 'Comfort' },
    { id: 'dance', label: 'Make them dance' },
    { id: 'other', label: 'Other' },
  ];

  var REVEALS = [
    { id: 'never', ask: 'What have you never told anyone?' },
    { id: 'scared', ask: "What's the truth you're scared to say?" },
    { id: 'nobody', ask: "What's something nobody says about this?" },
  ];

  var SENSORY = {
    love: [
      { id: 'who', ask: 'Who is in this scene with you?' },
      { id: 'place', ask: 'Where were you together?' },
      { id: 'object', ask: 'What object of theirs is still in the room?' },
      { id: 'quote', ask: 'What did they say?' },
    ],
    heartbreak: [
      { id: 'who', ask: 'Who broke it, or who did you lose?' },
      { id: 'moment', ask: 'What was the last ordinary thing they did?' },
      { id: 'object', ask: 'What did they leave behind?' },
      { id: 'quote', ask: 'What text is still unsent?' },
    ],
    hype: [
      { id: 'who', ask: 'Who is in your corner?' },
      { id: 'place', ask: 'Where were you when it turned?' },
      { id: 'object', ask: 'What object proves the win?' },
      { id: 'quote', ask: 'What did someone say when it landed?' },
    ],
    petty: [
      { id: 'who', ask: 'Who is this petty song about?' },
      { id: 'moment', ask: 'What did they actually do?' },
      { id: 'place', ask: 'Where were you when they did it?' },
      { id: 'object', ask: 'What object is still sitting there?' },
    ],
    grateful: [
      { id: 'who', ask: 'Who are you thanking?' },
      { id: 'moment', ask: 'What did they do?' },
      { id: 'place', ask: 'Where did they show up?' },
      { id: 'object', ask: 'What object holds that thanks?' },
    ],
    nostalgic: [
      { id: 'who', ask: 'Who is in the memory?' },
      { id: 'place', ask: 'Where does the memory live?' },
      { id: 'object', ask: 'What object or sound is from then?' },
      { id: 'quote', ask: 'What would you say to the you from then?' },
    ],
    angry: [
      { id: 'who', ask: 'Who crossed the line?' },
      { id: 'moment', ask: 'What happened that set it off?' },
      { id: 'place', ask: 'Where were you?' },
      { id: 'quote', ask: 'What sentence do you want heard?' },
    ],
    mindset: [
      { id: 'who', ask: 'Who is affected, up close?' },
      { id: 'place', ask: 'Where is it happening?' },
      { id: 'object', ask: 'What detail keeps it human?' },
      { id: 'quote', ask: 'What would you say to them?' },
    ],
  };

  function clip(value, max) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max || 280);
  }

  function optionById(list, id) {
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function toggle(list, id, max) {
    var next = (list || []).slice();
    var at = next.indexOf(id);
    if (at >= 0) next.splice(at, 1);
    else if (!max || next.length < max) next.push(id);
    return next;
  }

  function blank() {
    return {
      forId: '',
      forText: '',
      aims: [],
      aimOther: '',
      wisdom: '',
      reveals: { never: '', scared: '', nobody: '' },
      sensory: {},
      skipped: [],
      kinds: [],
      title: '',
      talk: '',
      turns: [],
    };
  }

  function clean(src) {
    var base = blank();
    var row = src || {};
    var forId = clip(row.forId, 24);
    base.forId = optionById(FOR_OPTIONS, forId) ? forId : '';
    base.forText = clip(row.forText, 160);
    var aims = Array.isArray(row.aims) ? row.aims : [];
    aims.forEach(function (id) {
      var key = clip(id, 24);
      if (optionById(AIM_OPTIONS, key) && base.aims.indexOf(key) === -1) base.aims.push(key);
    });
    base.aimOther = clip(row.aimOther, 80);
    base.wisdom = clip(row.wisdom, 280);
    REVEALS.forEach(function (item) {
      var bag = row.reveals || {};
      base.reveals[item.id] = clip(bag[item.id] != null ? bag[item.id] : row[item.id], 280);
    });
    var sensory = row.sensory || {};
    Object.keys(sensory).forEach(function (key) {
      var id = clip(key, 24);
      if (!/^[a-z][a-z0-9]{0,16}$/.test(id)) return;
      base.sensory[id] = clip(sensory[key], 280);
    });
    (Array.isArray(row.skipped) ? row.skipped : []).forEach(function (id) {
      var key = clip(id, 24);
      if (key && base.skipped.indexOf(key) === -1) base.skipped.push(key);
    });
    (Array.isArray(row.kinds) ? row.kinds : []).slice(0, 2).forEach(function (id) {
      var key = clip(id, 24);
      if (key && base.kinds.indexOf(key) === -1) base.kinds.push(key);
    });
    base.title = clip(row.title, 80);
    base.talk = row.talk === 'plai' ? 'plai' : (row.talk === 'form' ? 'form' : '');
    return base;
  }

  function forLabel(id) {
    var row = optionById(FOR_OPTIONS, id);
    return row ? row.label : '';
  }

  function aimLabels(ids, other) {
    var labels = [];
    (ids || []).forEach(function (id) {
      if (id === 'other') {
        if (other) labels.push(other);
        return;
      }
      var row = optionById(AIM_OPTIONS, id);
      if (row) labels.push(row.label);
    });
    return labels;
  }

  function sensorySteps(kinds) {
    var primary = (kinds && kinds[0]) || 'love';
    var list = (SENSORY[primary] || SENSORY.love).slice();
    var tint = kinds && kinds[1];
    var extra = tint && SENSORY[tint] && SENSORY[tint][0];
    if (extra && !list.some(function (step) { return step.id === extra.id; })) list.push(extra);
    return list;
  }

  function steps(state) {
    var data = clean(state);
    var list = [
      { id: 'for', group: 'purpose', kind: 'for', ask: "Who's this song for?" },
      { id: 'aim', group: 'purpose', kind: 'aim', ask: 'What do you aim to do with your song?' },
      { id: 'wisdom', group: 'purpose', kind: 'text', ask: 'What wisdom, truth or insight do you want to pass on?', optional: true },
    ];
    REVEALS.forEach(function (item) {
      list.push({ id: item.id, group: 'reveal', kind: 'text', ask: item.ask, optional: true });
    });
    sensorySteps(data.kinds).forEach(function (item) {
      list.push({ id: item.id, group: 'sensory', kind: 'text', ask: item.ask, optional: true });
    });
    return list;
  }

  function answered(state, step) {
    var data = clean(state);
    if (data.skipped.indexOf(step.id) !== -1) return true;
    if (step.id === 'for') return !!data.forId;
    if (step.id === 'aim') return data.aims.length > 0;
    if (step.id === 'wisdom') return !!data.wisdom;
    if (data.reveals[step.id]) return true;
    if (data.sensory[step.id]) return true;
    return false;
  }

  function nextStep(state) {
    var list = steps(state);
    for (var i = 0; i < list.length; i += 1) {
      if (!answered(state, list[i])) return list[i];
    }
    return null;
  }

  function readyForDraft(state) {
    var data = clean(state);
    return !!(data.forId || data.aims.length);
  }

  function aimLine(state) {
    return aimLabels(clean(state).aims, clean(state).aimOther).join(', ');
  }

  function northStar(state) {
    var data = clean(state);
    return {
      title: data.title,
      forId: data.forId,
      forLabel: forLabel(data.forId),
      forText: data.forText,
      aims: data.aims.slice(),
      aimLabels: aimLabels(data.aims, data.aimOther),
      aimOther: data.aimOther,
      wisdom: data.wisdom,
      reveals: {
        never: data.reveals.never,
        scared: data.reveals.scared,
        nobody: data.reveals.nobody,
      },
      sensory: data.sensory,
      kinds: data.kinds.slice(),
    };
  }

  function promptText(state) {
    var star = northStar(state);
    if (!star.forId && !star.aims.length && !star.wisdom) return '';
    var reveals = [star.reveals.never, star.reveals.scared, star.reveals.nobody].filter(Boolean);
    var details = [];
    Object.keys(star.sensory || {}).forEach(function (key) {
      if (star.sensory[key]) details.push(star.sensory[key]);
    });
    return [
      'North star.',
      'Who it is for: ' + [star.forLabel, star.forText].filter(Boolean).join('. ') + '.',
      'Aims: ' + (star.aimLabels.join(', ') || 'none named') + '.',
      'Wisdom: ' + (star.wisdom || 'none given') + '.',
      'Personal reveals: ' + (reveals.join(' | ') || 'none given') + '.',
      'Sensory details: ' + (details.join(' | ') || 'none given') + '.',
      'Every section serves this north star.',
      'The hook is aimed at that person and does those aims in plain language.',
      'Each verse uses only the sensory details they named.',
      'The bridge carries a personal reveal when they gave one.',
      'The last chorus pays the aims off, and lands on the wisdom line when they wrote one.',
      'Rank their wisdom and their reveals first, then their sensory details, then a plain restatement of who the song is for.',
      'Do not add wisdom they did not write.',
      'Do not replace a reveal with a smoother general line.',
      'When a detail is missing, write less.',
      'Leave out stock lines and cliches.',
    ].join(' ');
  }

  function cardRows(state) {
    var star = northStar(state);
    var rows = [];
    if (star.forLabel || star.forText) {
      rows.push({ id: 'for', label: 'For', value: [star.forLabel, star.forText].filter(Boolean).join('. ') });
    }
    if (star.aimLabels.length) rows.push({ id: 'aim', label: 'Aim', value: star.aimLabels.join(', ') });
    if (star.wisdom) rows.push({ id: 'wisdom', label: 'Wisdom', value: star.wisdom });
    if (star.reveals.never) rows.push({ id: 'never', label: 'Never told', value: star.reveals.never });
    if (star.reveals.scared) rows.push({ id: 'scared', label: 'Scared truth', value: star.reveals.scared });
    if (star.reveals.nobody) rows.push({ id: 'nobody', label: 'Nobody says', value: star.reveals.nobody });
    Object.keys(star.sensory).forEach(function (key) {
      if (!star.sensory[key]) return;
      rows.push({ id: key, label: key.charAt(0).toUpperCase() + key.slice(1), value: star.sensory[key] });
    });
    return rows;
  }

  return {
    FOR_OPTIONS: FOR_OPTIONS,
    AIM_OPTIONS: AIM_OPTIONS,
    REVEALS: REVEALS,
    SENSORY: SENSORY,
    blank: blank,
    clean: clean,
    toggle: toggle,
    steps: steps,
    nextStep: nextStep,
    answered: answered,
    readyForDraft: readyForDraft,
    aimLine: aimLine,
    forLabel: forLabel,
    northStar: northStar,
    promptText: promptText,
    cardRows: cardRows,
    sensorySteps: sensorySteps,
  };
}));
