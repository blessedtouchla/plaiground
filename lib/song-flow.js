'use strict';

/**
 * Song Helper purpose interview.
 * Seven screens. Stories first, one deep question near the end.
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

  var FOR_STORIES = {
    someone: 'Tell me about a moment with them that still makes you smile.',
    myself: 'Tell me about a day you were proud of yourself, even a small one.',
    everyone: 'Picture someone singing this back to you. What just happened in their day?',
  };

  var OPENERS = {
    heal: 'Tell me about a time before it got hard, when things felt right.',
    hype: "Tell me about the moment you knew you'd pulled it off. Where were you standing?",
    inspire: 'Tell me about someone who made you believe you could do it. What did they do?',
    confess: 'Tell me about a good moment with the person this is for, back before there was anything to confess.',
    celebrate: "Tell me about the best part of the day you're celebrating.",
    laugh: 'Tell me the story you always end up telling at the cookout.',
    cry: "Tell me about a moment you'd give anything to live one more time.",
    clapback: 'Tell me about a time you knew your worth, before anyone tried to test it.',
    comfort: 'Tell me about a time someone made you feel safe. What did they do?',
    dance: "Tell me about the best night out you've ever had. What song came on?",
    other: 'Tell me the story that made you want to write this.',
  };

  var REVEALS = [
    { id: 'never', label: 'Never told', ask: "Tell me about a moment you've kept to yourself until now." },
    { id: 'scared', label: 'Scared truth', ask: 'Tell me about a time you almost said it out loud. What stopped you?' },
    { id: 'nobody', label: 'Nobody says', ask: 'Tell me something about this that happens all the time, but nobody talks about.' },
  ];

  var STARTERS = {
    for: [
      'The first time I saw them...',
      'There was this one night when...',
      'I knew I was going to be okay when...',
    ],
    open: [
      'It was a regular day, and then...',
      'I remember walking in and...',
      'The best part was when...',
    ],
    scene: [
      'I can still smell...',
      'The radio was playing...',
      'They looked at me and said...',
    ],
    wisdom: [
      "I didn't get it until...",
      'My grandma used to tell me...',
      'It hit me when...',
    ],
    reveal: [
      'I never told anyone, but...',
      'I almost said it when...',
      'Everybody acts like...',
    ],
    keep: [
      'Keep this line:',
      'The hook should say...',
    ],
  };

  var FOLLOWS = {
    for: [
      'What were they doing with their hands right then?',
      'What did they call you?',
    ],
    open: [
      'What happened right after that?',
      'Who else was there, and what did they say?',
    ],
    scene: [
      'What did it smell like?',
      'What was the weather doing?',
    ],
    wisdom: [
      'If you could say it to them in one sentence, what would it be?',
      'Who taught you that, and how?',
    ],
    reveal: [
      'How did your body feel right then?',
    ],
    keep: [],
  };

  var SENSORY = {
    love: [
      { id: 'who', ask: "Who's in the room with you? Tell me what they're doing." },
      { id: 'place', ask: 'Take me there. What did that place look and sound like?' },
      { id: 'object', ask: "What's something of theirs you still have? Tell me how you ended up keeping it." },
      { id: 'quote', ask: "What's something they said that stuck with you? Tell me when they said it." },
    ],
    heartbreak: [
      { id: 'who', ask: 'Tell me about a good day with them, before it broke.' },
      { id: 'moment', ask: 'Tell me about the last regular moment you had together.' },
      { id: 'object', ask: 'What did they leave behind? Tell me where it is now.' },
      { id: 'quote', ask: 'Tell me about the text you typed and never sent.' },
    ],
    hype: [
      { id: 'who', ask: 'Tell me about the person who believed in you first.' },
      { id: 'place', ask: 'Take me to the moment it turned.' },
      { id: 'object', ask: 'Tell me how you got the thing that proves it.' },
      { id: 'quote', ask: 'What did someone say when it landed? Tell me the face they made.' },
    ],
    petty: [
      { id: 'who', ask: 'Tell me how you met this person.' },
      { id: 'moment', ask: 'Walk me through what they did, step by step.' },
      { id: 'place', ask: 'Take me to where it went down.' },
      { id: 'object', ask: "What's still sitting there? Tell me why you haven't moved it." },
    ],
    grateful: [
      { id: 'who', ask: 'Tell me about the day they showed up for you.' },
      { id: 'moment', ask: "What did they do that you'll never forget?" },
      { id: 'place', ask: 'Take me to the room they walked into.' },
      { id: 'object', ask: 'Tell me about something they gave you.' },
    ],
    nostalgic: [
      { id: 'who', ask: 'Tell me about the funniest person in this memory.' },
      { id: 'place', ask: "Walk me through that place like I'm seeing it." },
      { id: 'object', ask: 'What sound takes you right back there? Tell me about it.' },
      { id: 'quote', ask: 'Tell your younger self what happens next.' },
    ],
    angry: [
      { id: 'who', ask: 'Tell me what things were like before the line got crossed.' },
      { id: 'moment', ask: 'Walk me through what happened.' },
      { id: 'place', ask: 'Take me to where you were.' },
      { id: 'quote', ask: 'What do you want them to finally hear? Tell me when you first felt it.' },
    ],
    mindset: [
      { id: 'who', ask: 'Tell me about one real person this touches.' },
      { id: 'place', ask: "Take me to where it's happening." },
      { id: 'object', ask: 'Tell me a small thing you saw that made it real for you.' },
      { id: 'quote', ask: 'What would you say to them face to face?' },
    ],
  };

  var STORY_MAX = 1500;
  var STORY_NEAR = 1350;
  var TOO_LONG = 'That is too long. Your story stayed as you wrote it.';

  function clip(value, max) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max || 280);
  }

  function storyTake(value) {
    var text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
    if (text.length > STORY_MAX) {
      var err = new Error('long');
      err.code = 'long';
      throw err;
    }
    return text;
  }

  function countLabel(value) {
    return String(value == null ? '' : value).length + ' / ' + STORY_MAX;
  }

  function nearLimit(value) {
    return String(value == null ? '' : value).length >= STORY_NEAR;
  }

  function proposeStory(current, start, end, insert) {
    var now = String(current == null ? '' : current);
    var from = Math.max(0, Number(start) || 0);
    var to = Math.max(from, Number(end) || 0);
    var next = now.slice(0, from) + String(insert == null ? '' : insert) + now.slice(to);
    if (next.length <= STORY_MAX || next.length < now.length) {
      return { ok: true, value: next, message: '' };
    }
    return { ok: false, value: now, message: TOO_LONG };
  }

  function mountStoryBox(input) {
    if (!input || !input.parentNode || input.getAttribute('data-story-box') === '1') return;
    input.setAttribute('data-story-box', '1');
    input.removeAttribute('maxlength');
    try { input.maxLength = -1; } catch (err) {}
    var count = document.createElement('p');
    count.className = 'sh-count';
    count.setAttribute('aria-live', 'polite');
    var warn = document.createElement('p');
    warn.className = 'sh-count-warn';
    warn.setAttribute('role', 'alert');
    warn.hidden = true;
    if (input.nextSibling) input.parentNode.insertBefore(warn, input.nextSibling);
    else input.parentNode.appendChild(warn);
    input.parentNode.insertBefore(count, warn);
    var described = input.getAttribute('aria-describedby');
    var countId = input.id ? (input.id + '-count') : '';
    if (countId) {
      count.id = countId;
      input.setAttribute('aria-describedby', described ? (described + ' ' + countId) : countId);
    }
    var lastOk = input.value;
    function show(message) {
      if (warn.textContent !== message) warn.textContent = message;
      warn.hidden = false;
    }
    function hide() {
      warn.hidden = true;
      warn.textContent = '';
    }
    function paint() {
      count.textContent = countLabel(input.value);
      if (nearLimit(input.value)) count.classList.add('is-near');
      else count.classList.remove('is-near');
    }
    function reject() {
      var caret = input.selectionStart;
      input.value = lastOk;
      try {
        var at = Math.min(typeof caret === 'number' ? caret : lastOk.length, lastOk.length);
        input.setSelectionRange(at, at);
      } catch (err) {}
      show(TOO_LONG);
      paint();
    }
    function guard(startAt, endAt, insert) {
      return proposeStory(input.value, startAt, endAt, insert);
    }
    input.addEventListener('beforeinput', function (event) {
      var type = event.inputType || '';
      if (type === 'insertFromPaste' || type.indexOf('insert') !== 0) return;
      var data = event.data;
      if (data == null && type === 'insertLineBreak') data = '\n';
      if (data == null) return;
      var verdict = guard(input.selectionStart, input.selectionEnd, data);
      if (!verdict.ok) {
        event.preventDefault();
        show(verdict.message);
      }
    });
    input.addEventListener('paste', function (event) {
      var text = event.clipboardData ? event.clipboardData.getData('text') : '';
      var verdict = guard(input.selectionStart, input.selectionEnd, text);
      if (!verdict.ok) {
        event.preventDefault();
        show(verdict.message);
      }
    });
    input.addEventListener('input', function () {
      if (input.value === lastOk) {
        paint();
        return;
      }
      var verdict = proposeStory(lastOk, 0, lastOk.length, input.value);
      if (!verdict.ok) {
        reject();
        return;
      }
      lastOk = input.value;
      hide();
      paint();
    });
    input._paintStory = function () {
      if (input.value.length <= STORY_MAX || input.value.length < lastOk.length) lastOk = input.value;
      paint();
    };
    paint();
  }

  function paintStoryBox(input) {
    if (input && input._paintStory) input._paintStory();
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
      opener: '',
      wisdom: '',
      reveals: { never: '', scared: '', nobody: '' },
      sensory: {},
      keep: '',
      notes: [],
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
    base.forText = storyTake(row.forText);
    var aims = Array.isArray(row.aims) ? row.aims : [];
    aims.forEach(function (id) {
      var key = clip(id, 24);
      if (optionById(AIM_OPTIONS, key) && base.aims.indexOf(key) === -1) base.aims.push(key);
    });
    base.aimOther = clip(row.aimOther, 80);
    base.opener = storyTake(row.opener);
    base.wisdom = storyTake(row.wisdom);
    base.keep = storyTake(row.keep);
    REVEALS.forEach(function (item) {
      var bag = row.reveals || {};
      base.reveals[item.id] = storyTake(bag[item.id] != null ? bag[item.id] : row[item.id]);
    });
    var sensory = row.sensory || {};
    Object.keys(sensory).forEach(function (key) {
      var id = clip(key, 24);
      if (!/^[a-z][a-z0-9]{0,16}$/.test(id)) return;
      base.sensory[id] = storyTake(sensory[key]);
    });
    (Array.isArray(row.notes) ? row.notes : []).slice(0, 24).forEach(function (note) {
      var ask = clip(note && note.ask, 220);
      var text = storyTake(note && note.text);
      if (!ask || !text) return;
      base.notes.push({ ask: ask, text: text });
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

  function sceneBoxes(kinds) {
    var list = sensorySteps(kinds);
    if (list.length <= 3) return list;
    var head = list.slice(0, 3);
    var tint = kinds && kinds[1] && SENSORY[kinds[1]] && SENSORY[kinds[1]][0];
    if (tint && head.every(function (step) { return step.id !== tint.id; })) head[2] = tint;
    return head;
  }

  function openerAsk(aims) {
    var aim = (aims && aims[0]) || 'other';
    return OPENERS[aim] || OPENERS.other;
  }

  function attach(id, extra) {
    var row = extra || {};
    row.id = id;
    row.starters = STARTERS[id] ? STARTERS[id].slice() : [];
    row.follows = FOLLOWS[id] ? FOLLOWS[id].slice() : [];
    return row;
  }

  function steps(state) {
    var data = clean(state);
    var confess = data.aims.indexOf('confess') !== -1;
    return [
      attach('for', {
        group: 'purpose',
        kind: 'for',
        ask: "Who's this song for?",
        storyAsk: FOR_STORIES[data.forId] || '',
      }),
      attach('aim', {
        group: 'purpose',
        kind: 'aim',
        ask: 'What do you aim to do with your song?',
      }),
      attach('open', {
        group: 'story',
        kind: 'story',
        ask: openerAsk(data.aims),
        optional: true,
        recommended: true,
      }),
      attach('scene', {
        group: 'scene',
        kind: 'scene',
        ask: 'Tell me the scene, the way you remember it.',
        optional: true,
        boxes: sceneBoxes(data.kinds),
      }),
      attach('wisdom', {
        group: 'purpose',
        kind: 'story',
        ask: 'Tell me about the moment you learned the thing you want this song to pass on.',
        optional: true,
      }),
      attach('reveal', {
        group: 'reveal',
        kind: 'reveal',
        ask: 'Pick the one that feels right, or skip it.',
        optional: true,
        recommended: confess,
        choices: REVEALS,
      }),
      attach('keep', {
        group: 'purpose',
        kind: 'story',
        ask: 'Out of everything you told me, is there one sentence you want in the song word for word?',
        optional: true,
      }),
    ];
  }

  function sceneAnswered(data) {
    var boxes = sceneBoxes(data.kinds);
    for (var i = 0; i < boxes.length; i += 1) {
      if (data.sensory[boxes[i].id]) return true;
    }
    return false;
  }

  function revealAnswered(data) {
    return !!(data.reveals.never || data.reveals.scared || data.reveals.nobody);
  }

  function answered(state, step) {
    var data = clean(state);
    if (!step) return false;
    if (data.skipped.indexOf(step.id) !== -1) return true;
    if (step.id === 'for') return !!data.forId;
    if (step.id === 'aim') return data.aims.length > 0;
    if (step.id === 'open') return !!data.opener;
    if (step.id === 'scene') return sceneAnswered(data);
    if (step.id === 'wisdom') return !!data.wisdom;
    if (step.id === 'reveal') return revealAnswered(data);
    if (step.id === 'keep') return !!data.keep;
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

  function chorusLine(notes) {
    var line = '';
    (notes || []).forEach(function (note) {
      if (line || !note || !note.text) return;
      if (/one sentence/i.test(note.ask || '')) line = note.text;
    });
    return line;
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
      opener: data.opener,
      wisdom: data.wisdom,
      wisdomLine: chorusLine(data.notes),
      keep: data.keep,
      reveals: {
        never: data.reveals.never,
        scared: data.reveals.scared,
        nobody: data.reveals.nobody,
      },
      sensory: data.sensory,
      notes: data.notes.map(function (note) { return { ask: note.ask, text: note.text }; }),
      kinds: data.kinds.slice(),
    };
  }

  function promptText(state) {
    var star = northStar(state);
    if (!star.forId && !star.aims.length && !star.wisdom && !star.opener && !star.keep) return '';
    var reveals = [star.reveals.never, star.reveals.scared, star.reveals.nobody].filter(Boolean);
    var details = [];
    Object.keys(star.sensory || {}).forEach(function (key) {
      if (star.sensory[key]) details.push(star.sensory[key]);
    });
    var told = (star.notes || []).map(function (note) {
      return 'They answered "' + note.ask + '" with "' + note.text + '"';
    });
    return [
      'North star.',
      'Who it is for: ' + [star.forLabel, star.forText].filter(Boolean).join('. ') + '.',
      'Aims: ' + (star.aimLabels.join(', ') || 'none named') + '.',
      'Opening story: ' + (star.opener || 'none given') + '.',
      'Wisdom: ' + (star.wisdom || 'none given') + '.',
      'Wisdom line for the last chorus: ' + (star.wisdomLine || 'none given') + '.',
      'Line to keep word for word: ' + (star.keep || 'none given') + '.',
      'Personal reveals: ' + (reveals.join(' | ') || 'none given') + '.',
      'Sensory details: ' + (details.join(' | ') || 'none given') + '.',
      told.length ? ('Stories they told: ' + told.join(' ')) : '',
      'Every section serves this north star.',
      'The hook is aimed at that person and does those aims in plain language.',
      'Each verse uses only the sensory details they named.',
      'The bridge carries a personal reveal when they gave one.',
      'The last chorus pays the aims off, and lands on the wisdom line when they wrote one.',
      'If they named a line to keep, put that sentence in the song word for word.',
      'Their own words come first in the lyrics.',
      'Rank their wisdom and their reveals first, then their sensory details, then a plain restatement of who the song is for.',
      'Do not add a story they did not tell.',
      'Do not add wisdom they did not write.',
      'Do not replace a reveal with a smoother general line.',
      'When a detail is missing, write less.',
      'Leave out stock lines and cliches.',
    ].filter(Boolean).join(' ');
  }

  function cardRows(state) {
    var star = northStar(state);
    var rows = [];
    if (star.forLabel || star.forText) {
      rows.push({ id: 'for', label: 'For', value: [star.forLabel, star.forText].filter(Boolean).join('. ') });
    }
    if (star.aimLabels.length) rows.push({ id: 'aim', label: 'Aim', value: star.aimLabels.join(', ') });
    if (star.wisdom) rows.push({ id: 'wisdom', label: 'Wisdom', value: star.wisdom });
    if (star.keep) rows.push({ id: 'keep', label: 'Keep', value: star.keep });
    if (star.opener) rows.push({ id: 'open', label: 'Opening', value: star.opener });
    if (star.reveals.never) rows.push({ id: 'never', label: 'Never told', value: star.reveals.never });
    if (star.reveals.scared) rows.push({ id: 'scared', label: 'Scared truth', value: star.reveals.scared });
    if (star.reveals.nobody) rows.push({ id: 'nobody', label: 'Nobody says', value: star.reveals.nobody });
    Object.keys(star.sensory).forEach(function (key) {
      if (!star.sensory[key]) return;
      rows.push({ id: key, label: key.charAt(0).toUpperCase() + key.slice(1), value: star.sensory[key] });
    });
    return rows;
  }

  function styleIds(state) {
    var data = clean(state);
    var scene = [];
    Object.keys(data.sensory || {}).forEach(function (key) {
      if (data.sensory[key]) scene.push(data.sensory[key]);
    });
    return {
      forId: data.forId,
      aimId: data.aims[0] || '',
      kindId: data.kinds[0] || '',
      opener: data.opener,
      scene: scene.join(' '),
      object: data.sensory.object || ''
    };
  }

  return {
    FOR_OPTIONS: FOR_OPTIONS,
    AIM_OPTIONS: AIM_OPTIONS,
    FOR_STORIES: FOR_STORIES,
    OPENERS: OPENERS,
    REVEALS: REVEALS,
    STARTERS: STARTERS,
    FOLLOWS: FOLLOWS,
    SENSORY: SENSORY,
    STORY_MAX: STORY_MAX,
    STORY_NEAR: STORY_NEAR,
    TOO_LONG: TOO_LONG,
    blank: blank,
    clean: clean,
    countLabel: countLabel,
    mountStoryBox: mountStoryBox,
    nearLimit: nearLimit,
    paintStoryBox: paintStoryBox,
    proposeStory: proposeStory,
    toggle: toggle,
    steps: steps,
    sceneBoxes: sceneBoxes,
    nextStep: nextStep,
    answered: answered,
    readyForDraft: readyForDraft,
    aimLine: aimLine,
    forLabel: forLabel,
    northStar: northStar,
    promptText: promptText,
    cardRows: cardRows,
    sensorySteps: sensorySteps,
    styleIds: styleIds,
  };
}));
