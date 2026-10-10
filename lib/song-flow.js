'use strict';

/**
 * Song Helper purpose interview.
 * Five craft questions. Style is inferred from the words, not asked.
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

  var STORY_MAX = 3000;
  var STORY_NEAR = 2700;
  var TOO_LONG = 'That is too long. Your story stayed as you wrote it.';

  function clip(value, max) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max || 280);
  }

  function storyTake(value, label) {
    var text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
    if (text.length > STORY_MAX) {
      var err = new Error(String(label || 'That answer') + ' is a little long. The limit is ' + STORY_MAX + ' characters. Shorten it and try again.');
      err.code = 'long';
      err.field = label || 'That answer';
      err.limit = STORY_MAX;
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
    var count = document.createElement('span');
    count.className = 'sh-count';
    count.setAttribute('aria-live', 'polite');
    var warn = document.createElement('span');
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
    base.forText = storyTake(row.forText, 'Who this is for');
    var aims = Array.isArray(row.aims) ? row.aims : [];
    aims.forEach(function (id) {
      var key = clip(id, 24);
      if (optionById(AIM_OPTIONS, key) && base.aims.indexOf(key) === -1) base.aims.push(key);
    });
    base.aimOther = clip(row.aimOther, 80);
    base.opener = storyTake(row.opener, 'What happened');
    base.wisdom = storyTake(row.wisdom, 'Wisdom');
    base.keep = storyTake(row.keep, 'Line to keep');
    REVEALS.forEach(function (item) {
      var bag = row.reveals || {};
      base.reveals[item.id] = storyTake(bag[item.id] != null ? bag[item.id] : row[item.id], item.label);
    });
    var sensory = row.sensory || {};
    Object.keys(sensory).forEach(function (key) {
      var id = clip(key, 24);
      if (!/^[a-z][a-z0-9]{0,16}$/.test(id)) return;
      base.sensory[id] = storyTake(sensory[key], 'Scene');
    });
    (Array.isArray(row.notes) ? row.notes : []).slice(0, 24).forEach(function (note) {
      var ask = clip(note && note.ask, 220);
      var text = storyTake(note && note.text, 'Follow-up');
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
    if (!Object.prototype.hasOwnProperty.call(row, 'starters')) {
      row.starters = STARTERS[id] ? STARTERS[id].slice() : [];
    }
    if (!Object.prototype.hasOwnProperty.call(row, 'follows')) {
      row.follows = FOLLOWS[id] ? FOLLOWS[id].slice() : [];
    }
    return row;
  }

  function craftStep(id, extra) {
    extra.starters = [];
    extra.follows = [];
    return attach(id, extra);
  }

  function steps(state) {
    var data = clean(state);
    return [
      craftStep('open', {
        group: 'story',
        kind: 'story',
        ask: 'What happened? Tell me one moment you were there for.',
        optional: true,
      }),
      craftStep('for', {
        group: 'purpose',
        kind: 'for',
        ask: 'Who is in it?',
        storyAsk: data.forId === 'someone' ? 'What do you call them?' : '',
        optional: true,
      }),
      craftStep('scene', {
        group: 'scene',
        kind: 'scene',
        ask: 'What did you see, hear, or hold?',
        optional: true,
        boxes: [{ id: 'object', ask: '' }],
      }),
      craftStep('keep', {
        group: 'purpose',
        kind: 'story',
        ask: 'What is the one line people should repeat?',
        optional: true,
      }),
      craftStep('aim', {
        group: 'purpose',
        kind: 'aim',
        ask: 'What should the listener feel?',
        optional: true,
      }),
    ];
  }

  function sceneAnswered(data) {
    var keys = Object.keys(data.sensory || {});
    for (var i = 0; i < keys.length; i += 1) {
      if (data.sensory[keys[i]]) return true;
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
    if (data.forId || data.forText || data.aims.length || data.opener || data.keep || data.wisdom) return true;
    if (sceneAnswered(data) || revealAnswered(data)) return true;
    return false;
  }

  function aimLine(state) {
    return aimLabels(clean(state).aims, clean(state).aimOther).join(', ');
  }

  function lyricPlain(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function isAimHook(text) {
    var value = lyricPlain(text).toLowerCase();
    if (!value) return false;
    var hit = false;
    AIM_OPTIONS.forEach(function (row) {
      if (hit) return;
      var label = String(row.label || '').trim().toLowerCase();
      if (!label || label === 'other') return;
      if (value === label) hit = true;
      if (value === 'i want this song to ' + label) hit = true;
      if (value === 'i want this song to ' + label + '.') hit = true;
    });
    if (hit) return true;
    if (value.indexOf(',') === -1) return false;
    var parts = value.split(',').map(function (part) { return part.trim(); }).filter(Boolean);
    if (!parts.length) return false;
    return parts.every(function (part) {
      return AIM_OPTIONS.some(function (row) {
        return String(row.label || '').trim().toLowerCase() === part;
      });
    });
  }

  function isMetaLyric(text) {
    var value = lyricPlain(text);
    if (!value) return false;
    var lower = value.toLowerCase();
    if (isAimHook(value)) return true;
    if (/\bsong\s*helper\b/.test(lower)) return true;
    if (/\bi(?:'|’)?m making this song\b/.test(lower) || /\bi am making this song\b/.test(lower)) return true;
    if (/\bmake them (laugh|cry|feel)\b/.test(lower)) return true;
    if (/\bthis song\b/.test(lower)) return true;
    if (/\b(writing|wrote|write|making|made) (this |the |a |my )?song\b/.test(lower)) return true;
    if (/\b(the point|the purpose) of (this |the )?song\b/.test(lower)) return true;
    if (/\b(supposed to|meant to|here to) make (them|you|people|us)\b/.test(lower)) return true;
    return false;
  }

  function usableLyric(text) {
    var value = lyricPlain(text);
    if (!value || isMetaLyric(value)) return '';
    if (value.length < 12 || value.indexOf(' ') === -1) return '';
    if (/the hook sentence, what happened, and why/i.test(value)) return '';
    if (/answers stay unseen/i.test(value)) return '';
    return value;
  }

  function lyricSeeds(state) {
    var star = northStar(state);
    var sensory = star.sensory || {};
    var reveals = star.reveals || {};
    function first(list) {
      var found = '';
      (list || []).forEach(function (item) {
        if (found) return;
        var next = usableLyric(item);
        if (next) found = next;
      });
      return found;
    }
    var who = '';
    var whoTry = usableLyric(sensory.who) || lyricPlain(star.forText);
    if (whoTry && !isMetaLyric(whoTry) && !isAimHook(whoTry)) {
      var forHit = FOR_OPTIONS.some(function (row) {
        return String(row.label || '').trim().toLowerCase() === whoTry.toLowerCase();
      });
      if (!forHit) who = whoTry;
    }
    return {
      line: first([
        star.keep,
        star.wisdomLine,
        star.wisdom,
        reveals.nobody,
        star.opener,
        reveals.never,
        reveals.scared,
        sensory.quote,
        sensory.moment,
      ]),
      happened: first([
        star.opener,
        sensory.moment,
        sensory.place,
        sensory.object,
        reveals.never,
      ]),
      why: first([
        star.wisdomLine,
        star.wisdom,
        reveals.scared,
        reveals.nobody,
        star.keep,
      ]),
      who: who,
    };
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

  function shownLyric(text) {
    var value = lyricPlain(text);
    if (!value || isMetaLyric(value)) return '';
    return value;
  }

  function promptText(state) {
    var star = northStar(state);
    if (!star.forId && !star.aims.length && !star.wisdom && !star.opener && !star.keep) return '';
    var reveals = [star.reveals.never, star.reveals.scared, star.reveals.nobody].map(shownLyric).filter(Boolean);
    var details = [];
    Object.keys(star.sensory || {}).forEach(function (key) {
      var bit = shownLyric(star.sensory[key]);
      if (bit) details.push(bit);
    });
    var told = [];
    (star.notes || []).forEach(function (note) {
      var bit = shownLyric(note && note.text);
      if (!bit) return;
      told.push('They answered "' + note.ask + '" with "' + bit + '"');
    });
    var whoBits = [star.forLabel, shownLyric(star.forText) || (!isMetaLyric(star.forText) ? lyricPlain(star.forText) : '')].filter(Boolean);
    return [
      'North star.',
      'Who it is for: ' + (whoBits.join('. ') || 'unnamed') + '.',
      'Aims: ' + (star.aimLabels.join(', ') || 'none named') + '.',
      'Opening story: ' + (shownLyric(star.opener) || 'none given') + '.',
      'Wisdom: ' + (shownLyric(star.wisdom) || 'none given') + '.',
      'Wisdom line for the last chorus: ' + (shownLyric(star.wisdomLine) || 'none given') + '.',
      'Line to shape into the hook: ' + (shownLyric(star.keep) || 'none given') + '.',
      'Personal reveals: ' + (reveals.join(' | ') || 'none given') + '.',
      'Sensory details: ' + (details.join(' | ') || 'none given') + '.',
      told.length ? ('Stories they told: ' + told.join(' ')) : '',
      'Every section serves this north star.',
      'The hook is for that person. An aim such as make them laugh, cry, or dance is a private note. Do not sing the aim. Do not write that the song or a part is supposed to make them laugh, cry, or feel something. Show it with the details they gave.',
      'If they wrote about Song Helper, about making this song, or about using a tool to write, leave that out of the lyrics. It can stay in their notes.',
      'Each verse uses only the sensory details they named.',
      'The bridge carries a personal reveal when they gave one.',
      'The last chorus lands on the wisdom line when they wrote one. Do not restate the aim as a lyric.',
      'If they named a line to keep, build the hook from that image and phrase. Do not paste the sentence as its own lyric line.',
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

  var HUMAN_MOSTLY = 800;
  var HUMAN_FULL = 2400;
  var GUIDE_START = 400;
  var GUIDE_VERSE2 = 1600;
  var GUIDE_BRIDGE = 2000;

  function nextFinishKind(text) {
    return repeatedHook(text) ? 'verse' : 'hook';
  }

  function repeatedHook(value) {
    var counts = {};
    var found = '';
    String(value == null ? '' : value).split('\n').forEach(function (line) {
      var key = String(line || '').toLowerCase().replace(/[^a-z0-9\s']/g, '').replace(/\s+/g, ' ').trim();
      if (key.length < 12) return;
      counts[key] = (counts[key] || 0) + 1;
      if (counts[key] >= 2 && !found) found = String(line).replace(/\s+/g, ' ').trim();
    });
    return found;
  }

  var PART_TARGETS = { verse: 400, hook: 200, bridge: 300, outro: 200 };

  function copyPart(row) {
    return {
      id: String(row && row.id || ''),
      kind: String(row && row.kind || 'verse'),
      label: String(row && row.label || 'Verse'),
      text: String(row && row.text || ''),
    };
  }

  function blankSections() {
    return [
      { id: 'verse-1', kind: 'verse', label: 'Verse 1', text: '' },
      { id: 'hook', kind: 'hook', label: 'Hook', text: '' },
      { id: 'verse-2', kind: 'verse', label: 'Verse 2', text: '' },
      { id: 'bridge', kind: 'bridge', label: 'Bridge', text: '' },
    ];
  }

  function sectionTotal(sections) {
    var total = 0;
    (sections || []).forEach(function (row) { total += String(row && row.text || '').length; });
    return total;
  }

  function sectionBody(sections) {
    return (sections || []).map(function (row) { return String(row && row.text || ''); }).join('');
  }

  function repeatChar(ch, count) {
    var out = '';
    var n = Math.max(0, Number(count) || 0);
    for (var i = 0; i < n; i += 1) out += ch;
    return out;
  }

  function normalizeMarks(text, marks) {
    var body = String(text || '');
    var flags = String(marks || '');
    if (flags.length !== body.length) return repeatChar('u', body.length);
    return flags;
  }

  function ownedLength(row) {
    var text = String(row && row.text || '');
    var marks = String(row && row.marks || '');
    if (marks.length !== text.length) return text.length;
    var n = 0;
    for (var i = 0; i < text.length; i += 1) if (marks.charAt(i) !== 'a') n += 1;
    return n;
  }

  function humanText(sections) {
    return (sections || []).map(function (row) {
      var text = String(row && row.text || '');
      var marks = String(row && row.marks || '');
      if (marks.length !== text.length) return text;
      var out = '';
      for (var i = 0; i < text.length; i += 1) if (marks.charAt(i) !== 'a') out += text.charAt(i);
      return out;
    }).join('');
  }

  function retagMarks(oldText, oldMarks, newText) {
    var prev = String(oldText || '');
    var next = String(newText || '');
    var marks = normalizeMarks(prev, oldMarks);
    var start = 0;
    var limit = Math.min(prev.length, next.length);
    while (start < limit && prev.charAt(start) === next.charAt(start)) start += 1;
    var prevEnd = prev.length;
    var nextEnd = next.length;
    while (prevEnd > start && nextEnd > start && prev.charAt(prevEnd - 1) === next.charAt(nextEnd - 1)) {
      prevEnd -= 1;
      nextEnd -= 1;
    }
    return marks.slice(0, start) + repeatChar('u', nextEnd - start) + marks.slice(prevEnd);
  }

  function previewMarks(kind, oldText, oldMarks, nextText, edited) {
    var next = String(nextText || '');
    var old = String(oldText || '');
    var marks = normalizeMarks(old, oldMarks);
    if (edited) return repeatChar('u', next.length);
    if ((kind === 'extend' || kind === 'tone') && next.indexOf(old) === 0) return marks + repeatChar('a', next.length - old.length);
    return repeatChar('a', next.length);
  }

  function sectionText(sections) {
    return (sections || []).map(function (row) {
      var body = String(row && row.text || '').replace(/^\n+|\n+$/g, '');
      if (!body.trim()) return '';
      return String(row.label || 'Part') + '\n' + body;
    }).filter(Boolean).join('\n\n');
  }

  function proposeSectionText(sections, id, text) {
    var rows = (sections || []).map(copyPart);
    var current = '';
    var found = false;
    rows.forEach(function (row) {
      if (row.id === id) {
        found = true;
        current = row.text;
      }
    });
    if (!found) return { ok: false, sections: rows, total: sectionTotal(rows), message: TOO_LONG };
    var next = String(text == null ? '' : text);
    var total = sectionTotal(rows) - current.length + next.length;
    if (total <= STORY_MAX || next.length < current.length) {
      return {
        ok: true,
        sections: rows.map(function (row) {
          if (row.id !== id) return row;
          return { id: row.id, kind: row.kind, label: row.label, text: next };
        }),
        total: total,
        message: '',
      };
    }
    return { ok: false, sections: rows, total: sectionTotal(rows), message: TOO_LONG };
  }

  function applySuggestion(sections, id, suggestion) {
    var extra = String(suggestion == null ? '' : suggestion).trim();
    var rows = (sections || []).map(copyPart);
    if (!extra) return { ok: false, sections: rows, total: sectionTotal(rows), message: 'Nothing to add.' };
    var current = '';
    rows.forEach(function (row) { if (row.id === id) current = row.text; });
    var next = current.trim() ? (current.replace(/\s+$/, '') + '\n' + extra) : extra;
    return proposeSectionText(rows, id, next);
  }

  function addSection(sections, kind) {
    var rows = (sections || []).map(copyPart);
    if (kind === 'outro') {
      if (rows.some(function (row) { return row.kind === 'outro'; })) return rows;
      rows.push({ id: 'outro', kind: 'outro', label: 'Outro', text: '' });
      return rows;
    }
    var max = 0;
    rows.forEach(function (row) {
      var match = /^Verse\s+(\d+)$/.exec(row.label);
      if (match) max = Math.max(max, Number(match[1]));
    });
    var n = max + 1;
    rows.push({ id: 'verse-' + n + '-' + rows.length, kind: 'verse', label: 'Verse ' + n, text: '' });
    return rows;
  }

  function insertSection(sections, afterId) {
    var rows = (sections || []).map(copyPart);
    var index = rows.length - 1;
    rows.forEach(function (row, i) { if (row.id === afterId) index = i; });
    var max = 0;
    rows.forEach(function (row) {
      var match = /^Verse\s+(\d+)$/.exec(row.label);
      if (match) max = Math.max(max, Number(match[1]));
    });
    var n = max + 1;
    rows.splice(index + 1, 0, { id: 'verse-' + n + '-' + rows.length, kind: 'verse', label: 'Verse ' + n, text: '' });
    return rows;
  }

  function removeSection(sections, id) {
    var rows = (sections || []).map(copyPart);
    var target = null;
    rows.forEach(function (row) { if (row.id === id) target = row; });
    if (!target) return { ok: false, sections: rows, message: '' };
    if (rows.length <= 1) return { ok: false, sections: rows, message: 'Keep at least one part.' };
    if (String(target.text || '').trim()) {
      return { ok: false, sections: rows, message: 'This part still has your words. Clear it first, then remove it.' };
    }
    return { ok: true, sections: rows.filter(function (row) { return row.id !== id; }), message: '' };
  }

  var PART_HEADER = /^\s*\[?\s*(verse|chorus|hook|bridge|outro)(?:\s+(\d+))?\s*\]?\s*:?\s*$/i;

  function splitLyrics(text) {
    var raw = String(text == null ? '' : text).replace(/\r\n/g, '\n');
    var lines = raw.split('\n');
    var headers = 0;
    lines.forEach(function (line) { if (PART_HEADER.test(String(line || '').trim())) headers += 1; });
    if (headers < 2) return null;
    var sections = [];
    var current = null;
    var preface = [];
    var verseN = 0;
    function pushCurrent() {
      if (!current) return;
      current.text = current.text.replace(/^\n+|\n+$/g, '');
      sections.push(current);
      current = null;
    }
    lines.forEach(function (line) {
      var match = String(line || '').trim().match(PART_HEADER);
      if (!match) {
        if (!current) preface.push(line);
        else current.text += (current.text ? '\n' : '') + line;
        return;
      }
      pushCurrent();
      var word = match[1].toLowerCase();
      var num = match[2] ? Number(match[2]) : 0;
      var kind = word === 'chorus' ? 'hook' : word;
      var label = 'Verse 1';
      var id = 'verse-1';
      if (kind === 'hook') {
        label = 'Hook';
        id = sections.some(function (row) { return row.id === 'hook'; }) ? ('hook-' + sections.length) : 'hook';
      } else if (kind === 'bridge') {
        label = 'Bridge';
        id = sections.some(function (row) { return row.id === 'bridge'; }) ? ('bridge-' + sections.length) : 'bridge';
      } else if (kind === 'outro') {
        label = 'Outro';
        id = sections.some(function (row) { return row.id === 'outro'; }) ? ('outro-' + sections.length) : 'outro';
      } else {
        verseN = num || (verseN + 1);
        label = 'Verse ' + verseN;
        id = 'verse-' + verseN;
      }
      current = { id: id, kind: kind, label: label, text: '' };
    });
    pushCurrent();
    var intro = preface.join('\n').replace(/^\n+|\n+$/g, '');
    if (intro.trim()) {
      if (sections[0] && sections[0].kind === 'verse') {
        sections[0].text = (intro + '\n' + sections[0].text).replace(/^\n+|\n+$/g, '');
      } else {
        sections.unshift({ id: 'verse-1', kind: 'verse', label: 'Verse 1', text: intro });
      }
    }
    return sections.length ? sections : null;
  }

  function lyricKey(line) {
    return String(line || '').toLowerCase().replace(/[^a-z0-9\s']/g, '').replace(/\s+/g, ' ').trim();
  }

  function songBlocks(text) {
    var headed = splitLyrics(text);
    if (headed && headed.length >= 2) {
      return {
        headed: true,
        blocks: headed.map(function (row) {
          return { text: row.text, kind: row.kind, label: row.label };
        }),
      };
    }
    var lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
    var blocks = [];
    var current = [];
    function pushBlock() {
      var body = current.join('\n').replace(/^\n+|\n+$/g, '');
      if (body.trim()) blocks.push(body);
      current = [];
    }
    lines.forEach(function (line) {
      if (!String(line).trim()) {
        if (current.length) pushBlock();
        return;
      }
      current.push(String(line).replace(/[ \t]+$/g, ''));
    });
    if (current.length) pushBlock();
    if (blocks.length === 1) {
      var all = blocks[0].split('\n');
      if (all.length >= 8) {
        var chunked = [];
        for (var i = 0; i < all.length; i += 4) chunked.push(all.slice(i, i + 4).join('\n'));
        blocks = chunked;
      }
    }
    return { headed: false, blocks: blocks.map(function (body) { return { text: body }; }) };
  }

  function blockIsHook(block, counts, headed) {
    if (headed && block.kind === 'hook') return true;
    var keys = String(block.text || '').split('\n').map(lyricKey).filter(function (key) { return key.length >= 12; });
    if (!keys.length) return false;
    var hits = keys.filter(function (key) { return counts[key] >= 2; });
    return hits.length > 0 && hits.length >= Math.ceil(keys.length / 2);
  }

  function withFormatId(sections) {
    var seen = {};
    return sections.map(function (row) {
      var base = row.kind === 'verse'
        ? ('verse-' + ((String(row.label).match(/\d+/) || ['1'])[0]))
        : (row.kind === 'prechorus' ? 'prechorus' : row.kind);
      var n = seen[base] || 0;
      seen[base] = n + 1;
      return {
        id: n ? (base + '-' + (n + 1)) : base,
        kind: row.kind,
        label: row.label,
        text: row.text,
        suggest: row.suggest || '',
      };
    });
  }

  function formatSong(text) {
    var parsed = songBlocks(text);
    var blocks = parsed.blocks;
    if (!blocks.length) return { headed: false, notes: ['Paste lyrics first.'], sections: [] };
    var counts = {};
    blocks.forEach(function (block) {
      String(block.text || '').split('\n').forEach(function (line) {
        var key = lyricKey(line);
        if (key.length < 12) return;
        counts[key] = (counts[key] || 0) + 1;
      });
    });
    var notes = [];
    var sections = [];
    if (parsed.headed) {
      notes.push('These labels were already in what you pasted. You can move, merge, or relabel them.');
      if (!blocks.some(function (block) { return blockIsHook(block, counts, true); })) {
        notes.push('No repeated line is marked as the hook yet. A hook is the line people will sing back.');
      } else notes.push('A repeated line can stay the hook. Your words stayed as you pasted them.');
      if (!blocks.some(function (block) { return block.kind === 'bridge'; })) notes.push('A bridge could go after Verse 2, as the turn in the song.');
      if (!blocks.some(function (block) { return block.kind === 'prechorus'; })) notes.push('A pre-chorus could sit just before the hook.');
      return {
        headed: true,
        notes: notes,
        sections: withFormatId(blocks.map(function (block) {
          return { kind: block.kind, label: block.label, text: block.text, suggest: '' };
        })),
      };
    }
    var splitBlocks = [];
    blocks.forEach(function (block) {
      var buf = [];
      var mode = '';
      function flushSplit() {
        if (!buf.length) return;
        splitBlocks.push({ text: buf.join('\n') });
        buf = [];
      }
      String(block.text || '').split('\n').forEach(function (line) {
        if (!String(line).trim()) return;
        var key = lyricKey(line);
        var hookLine = key.length >= 12 && counts[key] >= 2;
        var nextMode = hookLine ? 'hook' : 'body';
        if (mode && nextMode !== mode) flushSplit();
        mode = nextMode;
        buf.push(line);
      });
      flushSplit();
    });
    if (splitBlocks.length) blocks = splitBlocks;
    var verseN = 0;
    var seenHook = false;
    var seenVerseAfterHook = false;
    blocks.forEach(function (block, index) {
      var lines = String(block.text || '').split('\n').filter(function (line) { return String(line).trim(); });
      var next = blocks[index + 1];
      if (blockIsHook(block, counts, false)) {
        sections.push({ kind: 'hook', label: 'Hook', text: block.text, suggest: 'This part repeats, so it can be the hook.' });
        seenHook = true;
        return;
      }
      if (next && blockIsHook(next, counts, false) && lines.length <= 2 && String(block.text || '').length <= 48 && verseN >= 1) {
        sections.push({ kind: 'prechorus', label: 'Pre-chorus', text: block.text, suggest: 'This short part before the hook could be a pre-chorus.' });
        return;
      }
      if (verseN === 0) {
        verseN = 1;
        sections.push({ kind: 'verse', label: 'Verse 1', text: block.text, suggest: '' });
        return;
      }
      if (seenHook && !seenVerseAfterHook) {
        verseN += 1;
        seenVerseAfterHook = true;
        sections.push({ kind: 'verse', label: 'Verse ' + verseN, text: block.text, suggest: '' });
        return;
      }
      var isLast = index === blocks.length - 1;
      var hasBridge = sections.some(function (row) { return row.kind === 'bridge'; });
      if (isLast && lines.length <= 2 && seenHook && hasBridge) {
        sections.push({ kind: 'outro', label: 'Outro', text: block.text, suggest: 'These last lines could be an outro.' });
        return;
      }
      if (isLast && lines.length <= 2 && seenHook && seenVerseAfterHook) {
        sections.push({ kind: 'outro', label: 'Outro', text: block.text, suggest: 'These last lines could be an outro.' });
        return;
      }
      if (!hasBridge && sections.length >= 2) {
        sections.push({ kind: 'bridge', label: 'Bridge', text: block.text, suggest: 'This later part could be a bridge, the turn in the song.' });
        return;
      }
      verseN += 1;
      sections.push({ kind: 'verse', label: 'Verse ' + verseN, text: block.text, suggest: '' });
    });
    if (!seenHook) notes.push('No line repeats yet, so nothing is marked as the hook. A hook is the line people will sing back. You can relabel a part.');
    else notes.push('A repeated line is marked as the hook. Every word is still yours.');
    sections.forEach(function (row) { if (row.suggest) notes.push(row.suggest); });
    if (!sections.some(function (row) { return row.kind === 'prechorus'; })) notes.push('A pre-chorus could sit just before the hook.');
    if (!sections.some(function (row) { return row.kind === 'bridge'; })) notes.push('A bridge could go after Verse 2, as the turn in the song.');
    var seenNote = {};
    notes = notes.filter(function (note) {
      if (!note || seenNote[note]) return false;
      seenNote[note] = true;
      return true;
    });
    return { headed: false, notes: notes, sections: withFormatId(sections) };
  }

  function sameWords(source, sections) {
    function lines(value) {
      return String(value || '').split('\n').map(function (line) { return line.trim(); }).filter(function (line) {
        return line && !PART_HEADER.test(line);
      });
    }
    var from = lines(source);
    var got = [];
    (sections || []).forEach(function (row) { got = got.concat(lines(row && row.text)); });
    if (from.length !== got.length) return false;
    for (var i = 0; i < from.length; i += 1) if (from[i] !== got[i]) return false;
    return true;
  }

  function sameWordBag(source, sections) {
    function bag(value) {
      return String(value || '').split('\n').map(function (line) { return line.trim(); }).filter(function (line) {
        return line && !PART_HEADER.test(line);
      }).sort().join('\n');
    }
    var got = [];
    (sections || []).forEach(function (row) { got.push(String(row && row.text || '')); });
    return bag(source) === bag(got.join('\n'));
  }

  function moveFormat(sections, id, dir) {
    var rows = (sections || []).map(function (row) { return Object.assign({}, row); });
    var index = -1;
    rows.forEach(function (row, i) { if (row.id === id) index = i; });
    var next = index + (dir < 0 ? -1 : 1);
    if (index < 0 || next < 0 || next >= rows.length) return rows;
    var item = rows[index];
    rows.splice(index, 1);
    rows.splice(next, 0, item);
    return rows;
  }

  function mergeFormat(sections, id) {
    var rows = (sections || []).map(function (row) { return Object.assign({}, row); });
    var index = -1;
    rows.forEach(function (row, i) { if (row.id === id) index = i; });
    if (index < 0 || index >= rows.length - 1) return { ok: false, sections: rows, message: 'Nothing after this part to merge.' };
    rows[index].text = String(rows[index].text || '').replace(/\s+$/, '') + '\n' + String(rows[index + 1].text || '').replace(/^\s+/, '');
    rows.splice(index + 1, 1);
    return { ok: true, sections: rows, message: '' };
  }

  function relabelFormat(sections, id, kind) {
    var rows = (sections || []).map(function (row) { return Object.assign({}, row); });
    var label = 'Verse';
    if (kind === 'hook') label = 'Hook';
    else if (kind === 'bridge') label = 'Bridge';
    else if (kind === 'outro') label = 'Outro';
    else if (kind === 'prechorus') label = 'Pre-chorus';
    else {
      var used = {};
      rows.forEach(function (row) {
        if (row.id === id) return;
        var match = /^Verse\s+(\d+)$/.exec(row.label);
        if (match) used[match[1]] = true;
      });
      var n = 1;
      while (used[String(n)]) n += 1;
      label = 'Verse ' + n;
      kind = 'verse';
    }
    return rows.map(function (row) {
      if (row.id !== id) return row;
      return { id: row.id, kind: kind, label: label, text: row.text, suggest: row.suggest || '' };
    });
  }

  function sectionGuideLine(row, gap, repeated) {
    var name = row.label || 'this part';
    if (row.kind === 'hook') {
      return 'Good start. Write the ' + name + ' next. Add about ' + gap + ' more characters, the line people will repeat.';
    }
    if (row.kind === 'bridge') {
      return 'Write the ' + name + ' next. Add about ' + gap + ' more characters, the turn in the song.';
    }
    if (row.kind === 'outro') {
      return 'Write the ' + name + ' next. Add about ' + gap + ' more characters there.';
    }
    if (row.kind === 'verse' && row.label === 'Verse 1') {
      return 'Write Verse 1 next. Add about ' + gap + ' more characters there, and this is a good start.';
    }
    if (repeated) {
      return 'A repeated line in there can be your hook. Write ' + name + ' next. Add about ' + gap + ' more characters there.';
    }
    return 'Write ' + name + ' next. Add about ' + gap + ' more characters there.';
  }

  function guideSections(sections) {
    var rows = (sections && sections.length) ? sections : blankSections();
    var body = rows.map(function (row) { return String(row.text || ''); }).join('\n');
    var owned = 0;
    rows.forEach(function (row) { owned += ownedLength(row); });
    var repeated = !!repeatedHook(body);
    var hookBox = rows.some(function (row) { return row.kind === 'hook' && String(row.text || '').trim().length >= 12; });
    var i;
    for (i = 0; i < rows.length; i += 1) {
      var row = rows[i];
      var target = PART_TARGETS[row.kind] || 400;
      var have = ownedLength(row);
      if (have >= target) continue;
      if (row.kind === 'hook' && String(row.text || '').trim().length < 12 && (hookBox || repeated)) continue;
      var gap = target - have;
      return {
        count: owned,
        step: row.kind,
        section: row.label,
        gap: gap,
        hook: hookBox || repeated,
        line: sectionGuideLine(row, gap, repeated && !hookBox),
      };
    }
    if (owned < HUMAN_FULL) {
      return {
        count: owned,
        step: 'full',
        section: '',
        gap: HUMAN_FULL - owned,
        hook: hookBox || repeated,
        line: 'These parts have a start. Add about ' + (HUMAN_FULL - owned) + ' more characters in any part, and this page can count it as fully human.',
      };
    }
    return {
      count: owned,
      step: 'full',
      section: '',
      gap: 0,
      hook: hookBox || repeated,
      line: repeated
        ? 'A repeated line in there can be your hook. This page counts this length as fully human.'
        : 'This page counts this length as fully human.',
    };
  }

  function nextGuide(value) {
    if (Array.isArray(value)) return guideSections(value);
    var text = String(value == null ? '' : value);
    var count = text.length;
    var hook = !!repeatedHook(text);
    var step = 'verse';
    var gap = GUIDE_START;
    var line = 'Write the first verse in your own words. Add about ' + gap + ' more characters, and this is a good start.';
    if (count >= HUMAN_FULL) {
      step = 'full';
      gap = 0;
      line = hook
        ? 'A repeated line in there can be your hook. This page counts this length as fully human.'
        : 'This page counts this length as fully human. A verse, a hook, another verse, and a bridge can all fit in what you wrote.';
    } else if (count >= GUIDE_BRIDGE) {
      step = 'bridge';
      gap = HUMAN_FULL - count;
      line = (hook ? 'A repeated line in there can be your hook. ' : '') + 'Write a bridge, the turn in the song. Add about ' + gap + ' more characters and this page can count it as fully human.';
    } else if (count >= GUIDE_VERSE2) {
      step = 'verse2';
      gap = GUIDE_BRIDGE - count;
      line = (hook ? 'A repeated line in there can be your hook. ' : '') + 'Write the next verse. Add about ' + gap + ' more characters, then a bridge.';
    } else if (count >= HUMAN_MOSTLY) {
      step = hook ? 'verse2' : 'hook';
      gap = GUIDE_VERSE2 - count;
      line = hook
        ? 'A repeated line in there can be your hook. Add about ' + gap + ' more characters, then write the next verse.'
        : 'Write your hook, the line people will repeat. Add about ' + gap + ' more characters, then write the next verse.';
    } else if (count >= GUIDE_START) {
      step = hook ? 'verse2' : 'hook';
      gap = hook ? (GUIDE_VERSE2 - count) : (HUMAN_MOSTLY - count);
      line = hook
        ? 'A repeated line in there can be your hook. Add about ' + gap + ' more characters, then write the next verse.'
        : 'Good start. Add about ' + gap + ' more characters, then write your hook (the line people will repeat).';
    } else if (count > 0) {
      step = 'verse';
      gap = GUIDE_START - count;
      line = hook
        ? 'A repeated line in there can be your hook. Keep going on the first verse. Add about ' + gap + ' more characters, and this is a good start.'
        : 'Write the first verse in your own words. Add about ' + gap + ' more characters, and this is a good start.';
    }
    return { count: count, step: step, gap: gap, hook: hook, line: line };
  }

  function humanMeter(value) {
    var text = String(value == null ? '' : value);
    var count = text.length;
    var band = 'empty';
    if (count >= HUMAN_FULL) band = 'full';
    else if (count >= HUMAN_MOSTLY) band = 'mostly';
    else if (count >= 1) band = 'started';
    var gap = count >= HUMAN_FULL ? 0 : (HUMAN_FULL - count);
    var label = band === 'full' ? 'Fully human' : band === 'mostly' ? 'Mostly yours' : band === 'started' ? 'Started' : 'Not started';
    var line = band === 'full'
      ? 'This much of your song is yours. This page counts it as fully human.'
      : 'This much of your song is yours. Add about ' + gap + ' more characters to make it fully human.';
    return {
      count: count,
      max: STORY_MAX,
      band: band,
      label: label,
      gap: gap,
      line: line,
      note: 'This counts the characters you wrote. That is how this page measures how much of the text is your own words. AI-assisted lines stay out of this count until you edit them. It is not a copyright registration or a legal guarantee.',
    };
  }

  function cleanPageLyrics(value) {
    var text = String(value == null ? '' : value).replace(/\r\n/g, '\n');
    var lines = text.split('\n');
    var out = [];
    var blank = false;
    lines.forEach(function (line) {
      var kept = String(line).replace(/[ \t]+$/g, '');
      if (!kept.trim()) {
        if (!blank && out.length) out.push('');
        blank = true;
        return;
      }
      blank = false;
      out.push(kept);
    });
    while (out.length && out[out.length - 1] === '') out.pop();
    return out.join('\n');
  }

  var ANSWER_EMPTY = 'Write an answer first. It stays out of the song until you add it.';

  function appendAnswer(current, answer) {
    var extra = String(answer == null ? '' : answer).trim();
    var now = String(current == null ? '' : current);
    if (!extra) return { ok: false, value: now, message: ANSWER_EMPTY };
    var insert = (now.trim() ? '\n\n' : '') + extra;
    return proposeStory(now, now.length, now.length, insert);
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

  var SOUND_ROWS = {
    rnb: { tempo: 'slow and warm', instruments: ['electric piano', 'bass'], vocal: 'silky close vocal', era: 'now', mix: 'polished and close', verseLength: 'medium', hookPlacement: 'after verse', bridge: true, genre: 'R&B' },
    pop: { tempo: 'mid and bright', instruments: ['synth', 'bass'], vocal: 'clear vocal', era: 'now', mix: 'polished radio', verseLength: 'short', hookPlacement: 'after verse', bridge: true, genre: 'Pop' },
    hiphop: { tempo: 'mid and laid back', instruments: ['808s', 'live drums'], vocal: 'laid-back rap vocal', era: 'now', mix: 'dry and punchy', verseLength: 'medium', hookPlacement: 'early', bridge: false, genre: 'Hip-hop' },
    country: { tempo: 'mid and steady', instruments: ['acoustic guitar', 'bass'], vocal: 'warm vocal', era: 'timeless', mix: 'live room', verseLength: 'medium', hookPlacement: 'after verse', bridge: true, genre: 'Country' },
    latin: { tempo: 'mid and rhythmic', instruments: ['bass', 'hand percussion'], vocal: 'rhythmic vocal', era: 'now', mix: 'dry and punchy', verseLength: 'short', hookPlacement: 'early', bridge: false, genre: 'Latin' },
    afrobeats: { tempo: 'mid and bouncing', instruments: ['acoustic guitar', 'live drums'], vocal: 'warm vocal', era: 'now', mix: 'polished radio', verseLength: 'short', hookPlacement: 'early', bridge: false, genre: 'Afrobeats' },
    gospel: { tempo: 'slow and lifted', instruments: ['organ', 'piano'], vocal: 'powerful vocal', era: 'timeless', mix: 'live room', verseLength: 'medium', hookPlacement: 'after verse', bridge: true, genre: 'Gospel' },
    rock: { tempo: 'fast and driving', instruments: ['electric guitar', 'live drums'], vocal: 'powerful vocal', era: 'timeless', mix: 'live room', verseLength: 'medium', hookPlacement: 'after verse', bridge: true, genre: 'Rock' },
    indie: { tempo: 'mid and close', instruments: ['acoustic guitar', 'bass'], vocal: 'close vocal', era: 'now', mix: 'lo-fi tape', verseLength: 'medium', hookPlacement: 'late', bridge: true, genre: 'Indie' },
    lofi: { tempo: 'slow and hushed', instruments: ['electric piano', 'bass'], vocal: 'hushed vocal', era: 'now', mix: 'lo-fi tape', verseLength: 'short', hookPlacement: 'late', bridge: false, genre: 'Lo-fi' },
    eighties: { tempo: 'steady and bright', instruments: ['synth', 'drum machine'], vocal: 'bright vocal', era: '80s', mix: 'polished radio', verseLength: 'short', hookPlacement: 'after verse', bridge: true, genre: 'Pop' },
    nineties: { tempo: 'mid and warm', instruments: ['electric piano', 'live drums'], vocal: 'smooth vocal', era: '90s', mix: 'warm radio', verseLength: 'medium', hookPlacement: 'after verse', bridge: true, genre: 'R&B' },
    y2k: { tempo: 'mid and shiny', instruments: ['synth', 'bass'], vocal: 'bright vocal', era: '2000s', mix: 'polished radio', verseLength: 'short', hookPlacement: 'after verse', bridge: true, genre: 'Pop' },
    ballad: { tempo: 'slow and held', instruments: ['piano', 'strings'], vocal: 'close vocal', era: 'timeless', mix: 'wide and soft', verseLength: 'long', hookPlacement: 'late', bridge: true, genre: 'Pop' },
    dance: { tempo: 'fast and driving', instruments: ['synth', '808s'], vocal: 'bright vocal', era: 'now', mix: 'dry and punchy', verseLength: 'short', hookPlacement: 'early', bridge: false, genre: 'Pop' },
    reggae: { tempo: 'mid and swaying', instruments: ['bass', 'electric guitar'], vocal: 'warm vocal', era: '70s', mix: 'live room', verseLength: 'medium', hookPlacement: 'after verse', bridge: true, genre: '' },
    plain: { tempo: 'mid and steady', instruments: ['piano', 'bass'], vocal: 'clear vocal', era: 'now', mix: 'polished and close', verseLength: 'medium', hookPlacement: 'after verse', bridge: true, genre: 'Pop' }
  };

  var SOUND_ALIASES = [
    { id: 'rnb', names: ['sza', 'frank ocean', 'summer walker', 'alicia keys', 'chris brown', 'kali uchis', 'beyonce', 'the weeknd', 'weeknd', 'stevie wonder'] },
    { id: 'pop', names: ['taylor swift', 'rihanna', 'ariana grande', 'ed sheeran', 'dua lipa', 'olivia rodrigo', 'harry styles', 'lady gaga', 'doja cat', 'bruno mars', 'newjeans', 'anti hero', 'as it was'] },
    { id: 'hiphop', names: ['drake', 'kendrick lamar', 'kanye west', 'kanye', 'eminem', 'jay z', 'nicki minaj', 'cardi b', 'travis scott', 'metro boomin', 'lil wayne', 'playboi carti', 'lil baby', '21 savage', 'post malone', 'gods plan'] },
    { id: 'country', names: ['morgan wallen', 'luke combs', 'dolly parton', 'johnny cash', 'old town road'] },
    { id: 'latin', names: ['bad bunny', 'j balvin', 'shakira', 'daddy yankee', 'karol g', 'romeo santos', 'rosalia', 'peso pluma', 'fuerza regida', 'grupo frontera', 'natanael cano', 'junior h', 'ivan cornejo'] },
    { id: 'ballad', names: ['adele', 'whitney houston', 'mariah carey', 'sam smith', 'john legend', 'lana del rey', 'someone like you', 'halo', 'drivers license'] },
    { id: 'eighties', names: ['prince', 'madonna', 'michael jackson', 'billie jean', 'blinding lights'] },
    { id: 'rock', names: ['the beatles', 'beatles', 'fleetwood mac', 'coldplay', 'led zeppelin', 'pink floyd', 'the rolling stones', 'rolling stones', 'david bowie', 'freddie mercury', 'arctic monkeys', 'purple rain'] },
    { id: 'indie', names: ['radiohead', 'tame impala', 'bob dylan'] },
    { id: 'lofi', names: ['billie eilish'] },
    { id: 'dance', names: ['pharrell williams', 'pharrell', 'blackpink'] },
    { id: 'reggae', names: ['bob marley'] }
  ];

  var SOUND_KEEP = {
    pop: true, rock: true, soul: true, indie: true, latin: true, country: true, gospel: true,
    afrobeats: true, reggae: true, dance: true, ballad: true, lofi: true, 'lo-fi': true,
    slow: true, fast: true, warm: true, mid: true, bright: true, now: true, timeless: true,
    '50s': true, '60s': true, '70s': true, '80s': true, '90s': true, '2000s': true, '2010s': true,
    piano: true, guitar: true, vocal: true, vocals: true, drums: true, synth: true, bass: true,
    hook: true, verse: true, bridge: true, short: true, medium: true, long: true, early: true, late: true,
    style: true, sound: true, sounds: true, like: true, song: true, clear: true, close: true,
    soft: true, live: true, radio: true, tape: true, wide: true, dry: true, punchy: true, held: true
  };
  var SOUND_SKIP = { and: true, the: true, for: true, you: true, her: true, his: true, its: true, with: true, from: true, that: true, this: true, your: true };
  var SOUND_ERAS = { eighties: '80s', nineties: '90s', y2k: '2000s' };
  var SOUND_RULES = [
    { id: 'eighties', re: /\b(80s|eighties|synth pop|synthpop)\b/ },
    { id: 'nineties', re: /\b(90s|nineties)\b/ },
    { id: 'y2k', re: /\b(2000s|y2k)\b/ },
    { id: 'rnb', re: /\b(r and b|rnb|neo soul|soul)\b/ },
    { id: 'hiphop', re: /\b(hip hop|rap|trap|boom bap)\b/ },
    { id: 'country', re: /\b(country|nashville|twang)\b/ },
    { id: 'latin', re: /\b(latin|reggaeton|salsa)\b/ },
    { id: 'afrobeats', re: /\b(afrobeats|afrobeat)\b/ },
    { id: 'gospel', re: /\b(gospel|choir)\b/ },
    { id: 'rock', re: /\b(rock|guitar band)\b/ },
    { id: 'indie', re: /\b(indie|folk)\b/ },
    { id: 'lofi', re: /\b(lo fi|lofi|bedroom)\b/ },
    { id: 'reggae', re: /\breggae\b/ },
    { id: 'ballad', re: /\bballad\b/ },
    { id: 'dance', re: /\b(dance|club|house|edm)\b/ },
    { id: 'pop', re: /\bpop\b/ }
  ];

  function soundEscape(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function soundKey(value) {
    return String(value || '').toLowerCase()
      .replace(/['’]/g, '')
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function soundQuery(value) {
    return soundKey(value).replace(/^(sounds like|in the style of|style of|inspired by|channeling)\s+/, '').trim();
  }

  function aliasNames() {
    var names = [];
    SOUND_ALIASES.forEach(function (row) {
      row.names.forEach(function (name) { names.push(name); });
    });
    names.sort(function (a, b) { return b.length - a.length; });
    return names;
  }

  function findAlias(key) {
    var hay = ' ' + key + ' ';
    var best = null;
    SOUND_ALIASES.forEach(function (row) {
      row.names.forEach(function (name) {
        var needle = ' ' + name + ' ';
        if (hay.indexOf(needle) === -1) return;
        if (!best || name.length > best.name.length) best = { id: row.id, name: name };
      });
    });
    return best;
  }

  function genreChoice(key) {
    var eraId = '';
    var styleId = '';
    SOUND_RULES.forEach(function (rule) {
      if (!rule.re.test(key)) return;
      if (SOUND_ERAS[rule.id]) {
        if (!eraId) eraId = rule.id;
      } else if (!styleId) styleId = rule.id;
    });
    return { styleId: styleId || eraId, era: SOUND_ERAS[eraId] || '' };
  }

  function copySoundRow(row) {
    var src = row || SOUND_ROWS.plain;
    return {
      tempo: src.tempo,
      instruments: src.instruments.slice(),
      vocal: src.vocal,
      era: src.era,
      mix: src.mix,
      verseLength: src.verseLength,
      hookPlacement: src.hookPlacement,
      bridge: src.bridge,
      genre: src.genre
    };
  }

  function applyStructureWords(traits, key) {
    if (/\bno bridge\b|\bwithout a bridge\b/.test(key)) traits.bridge = false;
    else if (/\bbridge\b/.test(key)) traits.bridge = true;
    if (/\bshort verses?\b/.test(key)) traits.verseLength = 'short';
    if (/\blong verses?\b/.test(key)) traits.verseLength = 'long';
    if (/\b(hook up front|early hook)\b/.test(key)) traits.hookPlacement = 'early';
    if (/\b(late hook|hook after the verses)\b/.test(key)) traits.hookPlacement = 'late';
  }

  function normalizeHints(hints) {
    var src = hints || {};
    var verse = String(src.verseLength || '').toLowerCase();
    var hook = String(src.hookPlacement || '').toLowerCase();
    if (verse !== 'short' && verse !== 'long') verse = 'medium';
    if (hook !== 'early' && hook !== 'late') hook = 'after verse';
    var bridge = !(src.bridge === false || src.bridge === 'no' || src.bridge === 'false');
    return { verseLength: verse, hookPlacement: hook, bridge: bridge };
  }

  function structurePhrase(hints) {
    var h = normalizeHints(hints);
    var verse = h.verseLength === 'short' ? 'short verses' : h.verseLength === 'long' ? 'long verses' : 'medium verses';
    var hook = h.hookPlacement === 'early' ? 'hook up front' : h.hookPlacement === 'late' ? 'hook after the verses' : 'hook after the first verse';
    var bridge = h.bridge ? 'with a bridge' : 'no bridge';
    return verse + ', ' + hook + ', ' + bridge;
  }

  function scrubSoundText(text, query, via) {
    var out = String(text || '').replace(/\u2014/g, ', ').replace(/\bsuno\b/ig, ' ');
    out = out.replace(/["“”][^"“”\n]{8,}["“”]/g, ' ');
    aliasNames().forEach(function (name) {
      out = out.replace(new RegExp('(^|[^A-Za-z0-9])' + name.split(' ').map(soundEscape).join('\\s+') + '(?![A-Za-z0-9])', 'ig'), '$1');
    });
    if (via !== 'genre') {
      var phrase = soundKey(query);
      if (phrase.length >= 3) {
        out = out.replace(new RegExp(phrase.split(' ').map(soundEscape).join('\\s+'), 'ig'), ' ');
      }
    }
    soundQuery(query).split(' ').forEach(function (word) {
      if (word.length < 4 || SOUND_KEEP[word]) return;
      out = out.replace(new RegExp('(^|[^A-Za-z0-9])' + soundEscape(word) + '(?![A-Za-z0-9])', 'ig'), '$1');
    });
    return out.replace(/\s{2,}/g, ' ').replace(/\s+,/g, ',').replace(/^[,\s]+|[,\s]+$/g, '').trim();
  }

  function traitPrompt(traits) {
    var instruments = (traits.instruments || []).slice(0, 3).join(', ');
    return [traits.genre, traits.tempo, instruments, traits.vocal, traits.era, traits.mix, traits.structure || structurePhrase(traits)].filter(Boolean).join(', ');
  }

  function scrubSoundTraits(traits, query, via) {
    var src = traits || {};
    var next = {
      tempo: scrubSoundText(src.tempo, query, via),
      vocal: scrubSoundText(src.vocal, query, via),
      era: scrubSoundText(src.era, query, via),
      mix: scrubSoundText(src.mix, query, via),
      genre: scrubSoundText(src.genre, query, via),
      instruments: (Array.isArray(src.instruments) ? src.instruments : []).map(function (item) {
        return scrubSoundText(item, query, via);
      }).filter(Boolean).slice(0, 3),
      verseLength: src.verseLength,
      hookPlacement: src.hookPlacement,
      bridge: src.bridge
    };
    var hints = normalizeHints(next);
    next.verseLength = hints.verseLength;
    next.hookPlacement = hints.hookPlacement;
    next.bridge = hints.bridge;
    next.structure = structurePhrase(next);
    next.prompt = scrubSoundText(traitPrompt(next), query, via);
    next.via = via || 'plain';
    next.label = 'Influence, not copying.';
    return next;
  }

  function emptySound() {
    return {
      tempo: '',
      instruments: [],
      vocal: '',
      era: '',
      mix: '',
      genre: '',
      verseLength: 'medium',
      hookPlacement: 'after verse',
      bridge: true,
      structure: '',
      prompt: '',
      matched: false,
      via: 'plain',
      label: 'Influence, not copying.',
      note: 'Type an artist or a song.'
    };
  }

  function soundsLike(query) {
    var raw = String(query || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    var key = soundQuery(raw);
    if (!key) return emptySound();
    var alias = findAlias(key);
    var genre = genreChoice(key);
    var via = 'plain';
    var row = SOUND_ROWS.plain;
    if (alias) {
      via = 'alias';
      row = SOUND_ROWS[alias.id] || SOUND_ROWS.plain;
    } else if (genre.styleId) {
      via = 'genre';
      row = SOUND_ROWS[genre.styleId] || SOUND_ROWS.plain;
    }
    var traits = copySoundRow(row);
    if (genre.era) traits.era = genre.era;
    applyStructureWords(traits, key);
    var cleaned = scrubSoundTraits(traits, raw, via);
    cleaned.matched = via !== 'plain';
    cleaned.note = via === 'plain'
      ? 'No close match, so this is a plain starting point. Influence, not copying.'
      : 'Influence, not copying. These are sound traits, not lyrics.';
    cleaned.label = 'Influence, not copying.';
    return cleaned;
  }

  function clipPhrase(value, max) {
    return String(value == null ? '' : value).replace(/[\r\n]+/g, ' ').replace(/\u2014/g, ', ').replace(/["“”]/g, '').replace(/\s+/g, ' ').trim().slice(0, max || 80);
  }

  function looksLikeLyric(value) {
    var words = String(value || '').trim().split(/\s+/).filter(Boolean);
    if (words.length > 8) return true;
    if (words.length > 5 && /\b(i|i'm|im|we|you|she|he)\b/i.test(words.join(' '))) return true;
    return false;
  }

  function soundBlob(traits) {
    return [traits.tempo, traits.vocal, traits.era, traits.mix, traits.genre, traits.prompt, traits.structure, traits.note, (traits.instruments || []).join(' ')].join(' ');
  }

  function nameLeak(traits, query) {
    var blob = soundBlob(traits).toLowerCase();
    var leaked = false;
    soundQuery(query).split(' ').forEach(function (word) {
      if (word.length < 3 || SOUND_KEEP[word] || SOUND_SKIP[word]) return;
      var re = new RegExp('(^|[^a-z0-9])' + soundEscape(word) + '(?![a-z0-9])', 'i');
      if (re.test(blob)) leaked = true;
    });
    return leaked;
  }

  function parseSoundTraits(content, query) {
    var raw = String(content || '').replace(/```json|```/gi, '').trim();
    var start = raw.indexOf('{');
    var end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    var data;
    try { data = JSON.parse(raw.slice(start, end + 1)); } catch (err) { return null; }
    if (!data || typeof data !== 'object') return null;
    var tempo = clipPhrase(data.tempo, 80);
    var vocal = clipPhrase(data.vocal, 80);
    var era = clipPhrase(data.era, 40);
    var mix = clipPhrase(data.mix, 80);
    var genre = clipPhrase(data.genre, 40);
    var list = data.instruments;
    if (typeof list === 'string') list = list.split(',');
    if (!Array.isArray(list)) return null;
    var instruments = [];
    list.forEach(function (item) {
      var phrase = clipPhrase(item, 40);
      if (!phrase || looksLikeLyric(phrase)) return;
      instruments.push(phrase);
    });
    instruments = instruments.slice(0, 3);
    if (!tempo || !vocal || !instruments.length) return null;
    if ([tempo, vocal, era, mix, genre].some(looksLikeLyric)) return null;
    var hints = normalizeHints(data);
    var via = soundsLike(query).via;
    var cleaned = scrubSoundTraits({
      tempo: tempo,
      vocal: vocal,
      era: era,
      mix: mix,
      genre: genre,
      instruments: instruments,
      verseLength: hints.verseLength,
      hookPlacement: hints.hookPlacement,
      bridge: data.bridge
    }, query, via);
    if (!cleaned.tempo || !cleaned.vocal || !cleaned.instruments.length) return null;
    if (nameLeak(cleaned, query)) return null;
    cleaned.matched = true;
    cleaned.note = 'Influence, not copying. These are sound traits, not lyrics.';
    cleaned.label = 'Influence, not copying.';
    return cleaned;
  }

  function layoutFromSounds(sections, hints) {
    var rows = (sections || []).map(function (row) {
      return {
        id: String(row && row.id || ''),
        kind: String(row && row.kind || 'verse'),
        label: String(row && row.label || ''),
        text: String(row && row.text || '')
      };
    });
    var h = normalizeHints(hints);
    var notes = [];
    function hasText(row) { return String(row.text || '').trim().length > 0; }
    function verseNumber() {
      var max = 0;
      rows.forEach(function (row) {
        var match = /^Verse\s+(\d+)$/.exec(row.label);
        if (match) max = Math.max(max, Number(match[1]));
      });
      return max + 1;
    }
    if (h.bridge) {
      if (!rows.some(function (row) { return row.kind === 'bridge'; })) {
        rows.push({ id: 'bridge', kind: 'bridge', label: 'Bridge', text: '' });
      }
    } else {
      var keptBridge = rows.filter(function (row) { return row.kind !== 'bridge' || hasText(row); });
      if (keptBridge.length !== rows.length && rows.some(function (row) { return row.kind === 'bridge' && hasText(row); })) {
        notes.push('The bridge still has your words, so it stayed.');
      }
      if (keptBridge.length) rows = keptBridge;
    }
    var verseTarget = h.verseLength === 'short' ? 1 : h.verseLength === 'long' ? 3 : 2;
    var verseCount = rows.filter(function (row) { return row.kind === 'verse'; }).length;
    while (verseCount < verseTarget) {
      var n = verseNumber();
      rows.push({ id: 'verse-' + n + '-sound', kind: 'verse', label: 'Verse ' + n, text: '' });
      verseCount += 1;
    }
    if (verseCount > verseTarget) {
      var extras = rows.filter(function (row) { return row.kind === 'verse' && !hasText(row); });
      var drop = verseCount - verseTarget;
      var dropIds = {};
      for (var i = extras.length - 1; i >= 0 && drop > 0; i -= 1) {
        dropIds[extras[i].id] = true;
        drop -= 1;
      }
      if (rows.some(function (row) { return row.kind === 'verse' && hasText(row) && verseCount - Object.keys(dropIds).length > verseTarget; })) {
        notes.push('A verse still has your words, so it stayed.');
      }
      rows = rows.filter(function (row) { return !dropIds[row.id]; });
    }
    if (!rows.some(function (row) { return row.kind === 'hook'; })) {
      rows.push({ id: 'hook', kind: 'hook', label: 'Hook', text: '' });
    }
    var verses = rows.filter(function (row) { return row.kind === 'verse'; });
    var hooks = rows.filter(function (row) { return row.kind === 'hook'; });
    var pres = rows.filter(function (row) { return row.kind === 'prechorus'; });
    var bridges = rows.filter(function (row) { return row.kind === 'bridge'; });
    var outros = rows.filter(function (row) { return row.kind === 'outro'; });
    var others = rows.filter(function (row) {
      return ['verse', 'hook', 'prechorus', 'bridge', 'outro'].indexOf(row.kind) === -1;
    });
    var ordered;
    if (h.hookPlacement === 'early') ordered = pres.concat(hooks, verses, others, bridges, outros);
    else if (h.hookPlacement === 'late') ordered = verses.concat(pres, hooks, others, bridges, outros);
    else ordered = verses.slice(0, 1).concat(pres, hooks, verses.slice(1), others, bridges, outros);
    return {
      sections: ordered,
      note: notes.join(' ') || 'Layout updated. Your words stayed in their boxes.'
    };
  }

  var CONCRETE = /\b(porch|light|jacket|chair|key|keys|truck|phone|door|window|rain|coffee|mug|shirt|kitchen|street|car|room|bed|hand|hands|glass|bottle|ring|photo|radio|guitar|piano|coat|shoe|shoes|boot|boots|table|cup|letter|clock|mirror|lamp|candle|dress|hat|bag|book|wallet|watch|chain|hoodie|pillow|blanket|bench|pew|flower|rose|ticket|wheel|seat|necklace|earring|stairs|stoop|lamp)\b/i;
  var SENSE = /\b(saw|see|seen|seeing|hear|heard|hearing|sound|sounded|smell|smelled|scent|taste|tasted|touch|touched|held|hold|holding|warm|cold|loud|quiet|soft|bright|dark|whisper|whispered|shout|shouted|wet|dry|rough|smooth|bitter|sweet)\b/i;

  function coachTip(label, text) {
    var value = lyricPlain(text);
    if (!value) return '';
    var name = String(label || '');
    var words = value.split(/\s+/);
    var lines = String(text || '').split(/\n/).map(function (line) { return line.trim(); }).filter(Boolean);
    var longLine = lines.some(function (line) { return line.split(/\s+/).length > 14; }) || words.length > 18;
    var hookish = /hook|heart|repeat|keep/i.test(name);
    if (hookish && words.length > 12) {
      return 'This heart line is long. Make it one sentence people can repeat.';
    }
    if (longLine) return 'This runs long. Break it where you breathe, then keep going.';
    var thing = (value.match(CONCRETE) || [])[0] || '';
    if (!thing) return 'Name one object here. A chair, a light, a jacket. That picture is what a listener can hold.';
    if (!SENSE.test(value)) return 'You named ' + thing + '. Add one sense around it: what you saw, heard, or held.';
    return 'Keep ' + thing + '. Let the next line turn on that picture.';
  }

  var HEAR_CHOICES = {
    genre: ['plain', 'Pop', 'R&B', 'Hip-hop', 'Country', 'Rock', 'Gospel', 'Latin', 'Indie', 'Lo-fi'],
    era: ['now', '80s', '90s', '2000s', 'timeless'],
    tempo: ['mid', 'slow', 'fast'],
    mood: ['plain', 'tender', 'light', 'heated'],
    tone: ['storytelling', 'heartfelt', 'funny', 'fired'],
    vocal: ['clear vocal', 'close vocal', 'hushed vocal', 'powerful vocal', 'rap vocal'],
    instruments: ['piano', 'acoustic guitar', '808s', 'synth', 'organ'],
    rhyme: ['loose', 'tight', 'spoken'],
    hook: ['after the first verse', 'up front', 'at the end', 'on the repeated line'],
  };
  var HEAR_LABELS = {
    genre: 'Genre',
    era: 'Era',
    tempo: 'Tempo',
    mood: 'Mood',
    tone: 'Tone',
    vocal: 'Vocal',
    instruments: 'Instruments',
    rhyme: 'Rhyme and syllable feel',
    hook: 'Hook location',
  };

  function hearValueLabel(key, value) {
    var raw = String(value || '');
    if (key === 'tone' && raw === 'fired') return 'Fired up';
    if (key === 'tone' && raw === 'heartfelt') return 'Heartfelt';
    if (key === 'tone' && raw === 'funny') return 'Funny';
    if (key === 'tone' && raw === 'storytelling') return 'Storytelling';
    if (key === 'tone' && raw === 'hopeful') return 'Hopeful';
    if (raw === 'plain') return 'Plain';
    if (raw === 'mid') return 'Mid';
    if (raw === 'slow') return 'Slow';
    if (raw === 'fast') return 'Fast';
    if (raw === 'now') return 'Now';
    if (raw === 'on the repeated line') return 'On the repeated line';
    if (raw === 'on the short line') return 'On the short line';
    if (raw === 'after the first verse') return 'After the first verse';
    if (raw === 'up front') return 'Up front';
    if (raw === 'at the end') return 'At the end';
    if (!raw) return '';
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }

  function nextHear(key, current) {
    var list = HEAR_CHOICES[key] || [];
    if (!list.length) return current || '';
    var index = list.indexOf(current);
    return list[(index + 1) % list.length];
  }

  function countHear(key, re) {
    var found = String(key || '').match(re);
    return found ? found.length : 0;
  }

  function hearBit(text) {
    var line = String(text || '').split('\n').map(function (row) { return row.trim(); }).filter(Boolean)[0] || '';
    var bit = line.replace(/\s+/g, ' ').trim();
    if (bit.length > 48) bit = bit.slice(0, 45).replace(/\s+\S*$/, '');
    return bit;
  }

  function hearRow(value, reason) {
    return { value: value, reason: reason };
  }

  function hearStyle(text) {
    var raw = String(text || '');
    var key = raw.toLowerCase();
    var thin = lyricPlain(raw).length < 12;
    var cited = hearBit(raw);
    if (thin) {
      return {
        thin: true,
        picks: {
          genre: hearRow('plain', 'Your lines do not point at a scene or a pocket yet, so I am leaving this plain.'),
          era: hearRow('now', 'I am not hearing a decade in these lines, so I am leaving the era as now.'),
          tempo: hearRow('mid', 'I am leaving the tempo at mid until the lines show a pace.'),
          mood: hearRow('plain', 'I am not hearing a mood strong enough to name.'),
          tone: hearRow('storytelling', 'I am not hearing funny, heartfelt, or fired up yet, so I am leaving the tone open.'),
          vocal: hearRow('clear vocal', 'I am leaving the vocal plain until the lines show how it should be sung.'),
          instruments: hearRow('piano', 'I am not hearing a specific instrument, so I am leaving this as piano.'),
          rhyme: hearRow('loose', 'There is not enough line shape yet to hear a rhyme pocket.'),
          hook: hearRow('after the first verse', 'I am not hearing a repeated line yet, so I am leaving the hook after the first verse.'),
        },
      };
    }
    var genre = 'plain';
    var genreReason = 'I am not hearing a genre word in your lines, so I am leaving this plain.';
    var genreRules = [
      { re: /\b(808s?|trap|drill|hip hop|hip-hop|rap)\b/, value: 'Hip-hop', why: 'hip-hop' },
      { re: /\b(country|nashville|twang|tailgate|dirt road)\b/, value: 'Country', why: 'country' },
      { re: /\b(choir|hallelujah|gospel|pew)\b/, value: 'Gospel', why: 'gospel' },
      { re: /\b(reggaeton|salsa|bachata|cumbia)\b/, value: 'Latin', why: 'Latin' },
      { re: /\b(lo-fi|lofi|bedroom pop)\b/, value: 'Lo-fi', why: 'lo-fi' },
      { re: /\b(punk|mosh|distortion|rock band)\b/, value: 'Rock', why: 'rock' },
      { re: /\b(r&b|r and b|neo soul)\b/, value: 'R&B', why: 'R&B' },
      { re: /\b(synth pop|dance floor|club)\b/, value: 'Pop', why: 'pop' },
    ];
    for (var g = 0; g < genreRules.length; g += 1) {
      if (genreRules[g].re.test(key)) {
        genre = genreRules[g].value;
        genreReason = 'I am hearing ' + genreRules[g].why + ' because your lines say it.';
        break;
      }
    }
    var era = 'now';
    var eraReason = 'I am not hearing a decade in these lines, so I am leaving the era as now.';
    if (/\b(80s|eighties|cassette)\b/.test(key)) {
      era = '80s';
      eraReason = 'I am hearing the 80s from a decade or object you named.';
    } else if (/\b(90s|nineties)\b/.test(key)) {
      era = '90s';
      eraReason = 'I am hearing the 90s from the decade you named.';
    } else if (/\b(2000s|y2k)\b/.test(key)) {
      era = '2000s';
      eraReason = 'I am hearing the 2000s from the decade you named.';
    } else if (/\b(vinyl|rotary)\b/.test(key)) {
      era = 'timeless';
      eraReason = 'I am hearing something older than a current radio sound, so I am leaving the era timeless.';
    }
    var slowN = countHear(key, /\b(slow|still|stayed|quiet|whisper|whispered|night|waiting|held|porch)\b/g);
    var fastN = countHear(key, /\b(run|running|rush|dance|shout|shouted|racing|jump|fast|loud)\b/g);
    var tempo = 'mid';
    var tempoReason = 'I am leaving the tempo at mid. The lines do not rush or drag.';
    if (slowN > fastN && slowN > 0) {
      tempo = 'slow';
      tempoReason = cited ? 'I am hearing this slow because you wrote "' + cited + '".' : 'I am hearing this slow from the pace of the lines.';
    } else if (fastN > slowN && fastN > 0) {
      tempo = 'fast';
      tempoReason = cited ? 'I am hearing this fast because you wrote "' + cited + '".' : 'I am hearing this fast from the pace of the lines.';
    }
    var funnyN = countHear(key, /\b(laugh|laughed|laughing|joke|funny|ridiculous)\b/g);
    var firedN = countHear(key, /\b(angry|fire|fired|fight|scream|screamed|rage)\b/g);
    var heartN = countHear(key, /\b(miss|missed|love|loved|sorry|held|stayed|heart|cry|cried|jacket|quiet)\b/g);
    var tone = 'storytelling';
    var toneReason = 'I am not hearing funny, heartfelt, or fired up as the main color, so I am leaving the tone open.';
    if (funnyN > firedN && funnyN > heartN && funnyN > 0) {
      tone = 'funny';
      toneReason = 'I am hearing this as funny from the way you tell it.';
    } else if (firedN > funnyN && firedN >= heartN && firedN > 0) {
      tone = 'fired';
      toneReason = 'I am hearing this fired up from the heat in the lines.';
    } else if (heartN > 0) {
      tone = 'heartfelt';
      toneReason = cited ? 'I am hearing this heartfelt because you wrote "' + cited + '".' : 'I am hearing this heartfelt from the lines.';
    }
    var mood = 'plain';
    var moodReason = 'I am not hearing a mood strong enough to name, so I am leaving it plain.';
    if (tone === 'heartfelt') {
      mood = 'tender';
      moodReason = 'I am hearing a tender mood from the same lines. This is a tint, not a genre.';
    } else if (tone === 'funny') {
      mood = 'light';
      moodReason = 'I am hearing a light mood from the way you tell it.';
    } else if (tone === 'fired') {
      mood = 'heated';
      moodReason = 'I am hearing a heated mood from the lines. This is a tint, not a genre.';
    }
    var vocal = 'clear vocal';
    var vocalReason = 'I am leaving the vocal clear. The lines do not ask for a whisper or a shout.';
    if (/\b(whisper|whispered|hush|quiet|soft)\b/.test(key)) {
      vocal = 'hushed vocal';
      vocalReason = 'I am hearing a hushed vocal because the lines stay quiet.';
    } else if (/\b(shout|scream|belt|loud)\b/.test(key)) {
      vocal = 'powerful vocal';
      vocalReason = 'I am hearing a powerful vocal because the lines get loud.';
    } else if (genre === 'Hip-hop') {
      vocal = 'rap vocal';
      vocalReason = 'I am hearing a rap vocal because the lines point at hip-hop.';
    }
    var instruments = 'piano';
    var instReason = 'I am not hearing a specific instrument, so I am leaving this as piano.';
    if (/\b808s?\b/.test(key)) {
      instruments = '808s';
      instReason = 'I am hearing 808s because you named them.';
    } else if (/\bguitar\b/.test(key)) {
      instruments = 'acoustic guitar';
      instReason = 'I am hearing guitar because you named it.';
    } else if (/\bpiano\b/.test(key)) {
      instruments = 'piano';
      instReason = 'I am hearing piano because you named it.';
    } else if (/\bsynth\b/.test(key)) {
      instruments = 'synth';
      instReason = 'I am hearing synth because you named it.';
    } else if (/\b(organ|choir)\b/.test(key)) {
      instruments = 'organ';
      instReason = 'I am hearing organ because the lines point at a choir or an organ.';
    }
    var lineList = raw.split(/\n/).map(function (line) { return line.trim(); }).filter(Boolean);
    var totalWords = 0;
    lineList.forEach(function (line) { totalWords += line.split(/\s+/).length; });
    var avg = lineList.length ? totalWords / lineList.length : lyricPlain(raw).split(/\s+/).length;
    var ends = {};
    var tight = false;
    lineList.forEach(function (line) {
      var bits = line.toLowerCase().replace(/[^a-z0-9\s']/g, '').split(/\s+/);
      var word = bits[bits.length - 1] || '';
      if (word.length < 3) return;
      var tail = word.slice(-3);
      ends[tail] = (ends[tail] || 0) + 1;
      if (ends[tail] >= 2) tight = true;
    });
    var rhyme = 'loose';
    var rhymeReason = 'I am hearing a loose shape. The lines do not lock to one rhyme.';
    if (tight) {
      rhyme = 'tight';
      rhymeReason = 'I am hearing a tighter rhyme because some line endings sound alike.';
    } else if (avg >= 12) {
      rhyme = 'spoken';
      rhymeReason = 'I am hearing a spoken feel because the lines run long.';
    }
    var repeated = repeatedHook(raw);
    var hook = 'after the first verse';
    var hookReason = 'I am not hearing a repeated line yet, so I am leaving the hook after the first verse.';
    if (repeated) {
      hook = 'on the repeated line';
      hookReason = 'I am hearing the hook on the line you repeated: "' + repeated + '".';
    } else {
      var shortest = '';
      lineList.forEach(function (line) {
        if (!shortest || line.length < shortest.length) shortest = line;
      });
      if (shortest && shortest.length <= 42 && shortest.length >= 8 && lineList.length >= 2) {
        hook = 'on the short line';
        hookReason = 'I am hearing the hook on the short line: "' + shortest.replace(/\s+/g, ' ') + '".';
      }
    }
    return {
      thin: false,
      picks: {
        genre: hearRow(genre, genreReason),
        era: hearRow(era, eraReason),
        tempo: hearRow(tempo, tempoReason),
        mood: hearRow(mood, moodReason),
        tone: hearRow(tone, toneReason),
        vocal: hearRow(vocal, vocalReason),
        instruments: hearRow(instruments, instReason),
        rhyme: hearRow(rhyme, rhymeReason),
        hook: hearRow(hook, hookReason),
      },
    };
  }

  function mergeHear(heard, overrides) {
    var base = heard && heard.picks ? heard : hearStyle('');
    var picks = {};
    var changed = false;
    Object.keys(base.picks).forEach(function (key) {
      picks[key] = { value: base.picks[key].value, reason: base.picks[key].reason };
      if (overrides && overrides[key]) {
        changed = true;
        picks[key] = {
          value: String(overrides[key]),
          reason: 'You picked this. It replaces what I was hearing.',
        };
      }
    });
    return { thin: !!(base.thin && !changed), picks: picks };
  }

  var SHAPE_TAPS = [
    { id: 'funny', label: 'Make it funny', words: true, tone: 'funny' },
    { id: 'hopeful', label: 'Make it hopeful', words: true, tone: 'hopeful' },
    { id: 'harder', label: 'Make it hit harder', words: true, tone: 'fired', tempo: 'fast', mood: 'heated' },
    { id: 'style', label: 'Change the style', words: false, cycle: 'genre' },
    { id: 'sound', label: 'Keep my words and change only the sound', words: false, cycle: 'tempo' },
  ];

  function shapeTap(id) {
    var found = null;
    SHAPE_TAPS.forEach(function (tap) {
      if (tap.id === id) found = tap;
    });
    if (!found) return null;
    return {
      id: found.id,
      label: found.label,
      words: !!found.words,
      tone: found.tone || '',
      tempo: found.tempo || '',
      mood: found.mood || '',
      cycle: found.cycle || '',
    };
  }

  function shapeLine(toneId) {
    var lines = {
      funny: 'And I had to laugh.',
      hopeful: 'I can see the next morning.',
      fired: 'I am not letting that go.',
    };
    return lines[String(toneId || '')] || '';
  }

  function heardChips(heard) {
    var picks = (heard && heard.picks) || {};
    function chip(id, key) {
      var pick = picks[key] || {};
      return { id: id, label: id.charAt(0).toUpperCase() + id.slice(1), value: hearValueLabel(key, pick.value) };
    }
    return [chip('mood', 'mood'), chip('style', 'genre'), chip('feel', 'tone')];
  }

  function applyShape(heard, overrides, tapId) {
    var tap = shapeTap(tapId);
    var next = {};
    Object.keys(overrides || {}).forEach(function (key) {
      if (overrides[key]) next[key] = overrides[key];
    });
    if (!tap) return { overrides: next, words: false, line: '', note: '' };
    if (tap.tone) next.tone = tap.tone;
    if (tap.mood) next.mood = tap.mood;
    if (tap.tempo) next.tempo = tap.tempo;
    if (tap.cycle) {
      var current = next[tap.cycle];
      if (!current && heard && heard.picks && heard.picks[tap.cycle]) current = heard.picks[tap.cycle].value;
      next[tap.cycle] = nextHear(tap.cycle, current || '');
    }
    return {
      overrides: next,
      words: tap.words,
      line: tap.words ? shapeLine(tap.tone) : '',
      note: tap.words
        ? 'Your words stayed. The added line is AI-assisted.'
        : (tap.id === 'sound' ? 'Your words stayed. Only the sound changed.' : 'Your words stayed. The style changed.'),
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
    HUMAN_MOSTLY: HUMAN_MOSTLY,
    HUMAN_FULL: HUMAN_FULL,
    GUIDE_START: GUIDE_START,
    GUIDE_VERSE2: GUIDE_VERSE2,
    GUIDE_BRIDGE: GUIDE_BRIDGE,
    repeatedHook: repeatedHook,
    nextFinishKind: nextFinishKind,
    nextGuide: nextGuide,
    PART_TARGETS: PART_TARGETS,
    blankSections: blankSections,
    sectionTotal: sectionTotal,
    sectionBody: sectionBody,
    sectionText: sectionText,
    normalizeMarks: normalizeMarks,
    ownedLength: ownedLength,
    humanText: humanText,
    retagMarks: retagMarks,
    previewMarks: previewMarks,
    insertSection: insertSection,
    proposeSectionText: proposeSectionText,
    applySuggestion: applySuggestion,
    addSection: addSection,
    removeSection: removeSection,
    splitLyrics: splitLyrics,
    formatSong: formatSong,
    sameWords: sameWords,
    sameWordBag: sameWordBag,
    moveFormat: moveFormat,
    mergeFormat: mergeFormat,
    relabelFormat: relabelFormat,
    ANSWER_EMPTY: ANSWER_EMPTY,
    humanMeter: humanMeter,
    cleanPageLyrics: cleanPageLyrics,
    appendAnswer: appendAnswer,
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
    coachTip: coachTip,
    hearStyle: hearStyle,
    mergeHear: mergeHear,
    nextHear: nextHear,
    hearValueLabel: hearValueLabel,
    HEAR_LABELS: HEAR_LABELS,
    SHAPE_TAPS: SHAPE_TAPS,
    shapeTap: shapeTap,
    shapeLine: shapeLine,
    heardChips: heardChips,
    applyShape: applyShape,
    aimLine: aimLine,
    isAimHook: isAimHook,
    isMetaLyric: isMetaLyric,
    usableLyric: usableLyric,
    lyricSeeds: lyricSeeds,
    forLabel: forLabel,
    northStar: northStar,
    promptText: promptText,
    cardRows: cardRows,
    sensorySteps: sensorySteps,
    styleIds: styleIds,
    SOUND_ALIASES: SOUND_ALIASES,
    soundsLike: soundsLike,
    scrubSoundText: scrubSoundText,
    scrubSoundTraits: scrubSoundTraits,
    structurePhrase: structurePhrase,
    parseSoundTraits: parseSoundTraits,
    layoutFromSounds: layoutFromSounds,
  };
}));
