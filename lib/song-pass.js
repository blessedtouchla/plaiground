(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SongPass = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  var GENERIC = {
    love: true,
    heartbreak: true,
    life: true,
    pain: true,
    feelings: true,
    sad: true,
    happy: true,
    song: true,
    music: true,
    vibes: true,
    'a girl': true,
    'a guy': true,
    'a boy': true,
    'missing you': true,
    'i miss you': true,
    heart: true,
    breakup: true,
    lonely: true,
    alone: true,
    you: true,
    her: true,
    him: true,
    us: true,
    relationship: true,
    drama: true,
    emotions: true
  };

  var CHIPS = [
    { id: 'cheesy', label: 'Too cheesy', change: 'Make the generated lines less cheesy.' },
    { id: 'story', label: 'Not enough story', change: 'Add one concrete story beat to the generated lines.' },
    { id: 'more-slang', label: 'More slang', change: 'Use more everyday slang in the generated lines.' },
    { id: 'less-slang', label: 'Less slang', change: 'Use less slang in the generated lines.' },
    { id: 'long', label: 'Too long', change: 'Shorten the draft by cutting generated lines.' },
    { id: 'short', label: 'Too short', change: 'Add a few generated lines.' },
    { id: 'hook', label: 'Hook not catchy', change: 'Rewrite only the generated hook so it is easier to sing.' },
    { id: 'emotion', label: 'More emotion', change: 'Put more feeling in the generated lines.' },
    { id: 'rhyme', label: "Doesn't rhyme enough", change: 'Rhyme the generated line endings more.' }
  ];

  var CHIP_BY_ID = {};
  CHIPS.forEach(function (chip) { CHIP_BY_ID[chip.id] = chip; });

  var STORY_MAX = 1500;

  function clip(value, max) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max || 180);
  }

  function storyText(value) {
    return String(value == null ? '' : value).replace(/^\s+/, '').replace(/\s+$/, '');
  }

  function isGeneric(text) {
    var value = clip(text, 80).toLowerCase().replace(/[.!?]+$/g, '');
    if (!value) return true;
    if (GENERIC[value]) return true;
    var words = value.split(' ').filter(Boolean);
    return words.length === 1 && value.length < 12;
  }

  function summary(bag) {
    var data = bag || {};
    var rows = [];
    function add(id, label, value, story) {
      var text = story ? storyText(value) : clip(value, 180);
      if (!text) return;
      rows.push({ id: id, label: label, value: text });
    }
    var topic = storyText(data.topic);
    var happened = storyText(data.happened);
    if (topic && topic !== happened) add('idea', 'Idea', topic, true);
    add('mood', 'Feeling', data.mood);
    add('genre', 'Genre', data.genre);
    if (data.mode && data.mode !== 'write' && data.mode !== 'Write') add('mode', 'Mode', data.mode);
    add('happened', 'What happened', happened, true);
    add('who', 'Who', data.who);
    add('why', 'What changed', data.why, true);
    add('line', 'Hook line', data.line, true);
    (data.words || []).forEach(function (row) {
      add('words', (row && row.label) || 'Picture', row && row.text, true);
    });
    add('place', 'Place', data.place, true);
    add('object', 'Object', data.object, true);
    add('quote', 'What they said', data.quote, true);
    (data.live || []).forEach(function (row) {
      add('live', (row && row.ask) || 'Answer', row && row.text, true);
    });
    var filters = [];
    if (data.region) filters.push(clip(data.region, 40));
    if (data.language && data.language !== 'english') filters.push(clip(data.language, 20));
    if (data.explicit === 'explicit') filters.push('Explicit');
    if (data.length === 'short') filters.push('Short');
    if (data.rhyme && data.rhyme !== 'slant') filters.push(clip(data.rhyme, 20) + ' rhyme');
    if (data.vocabulary && data.vocabulary !== 'plain') filters.push(clip(data.vocabulary, 20));
    if (filters.length) add('filters', 'Filters', filters.join(', '));
    return rows;
  }

  function followups(bag) {
    var data = bag || {};
    var story = storyText(data.happened || data.topic);
    var topic = storyText(data.topic || data.happened);
    var thin = isGeneric(topic) || isGeneric(story);
    var words = story.split(' ').filter(Boolean).length;
    var noDetails = !clip(data.place, 120) && !clip(data.object, 80) && !clip(data.quote, 160);
    if (!thin && noDetails && words > 0 && words < 6) thin = true;
    if (!thin) return [];
    var asks = [];
    if (!clip(data.place, 120) && (thin || !clip(data.object, 80))) {
      asks.push({
        id: 'place',
        ask: 'Where were you?',
        hint: 'Skip if you want.',
        placeholder: 'the kitchen at 2am'
      });
    }
    if (!clip(data.object, 80) && asks.length < 2 && (thin || !clip(data.place, 120))) {
      asks.push({
        id: 'object',
        ask: 'Name one thing you can point at.',
        hint: 'Skip if you want.',
        placeholder: 'a chipped mug'
      });
    }
    if (!asks.length && thin && !clip(data.quote, 160)) {
      asks.push({
        id: 'quote',
        ask: 'What did someone say?',
        hint: 'Skip if you want.',
        placeholder: 'we will figure it out'
      });
    }
    return asks.slice(0, 2);
  }

  function instruction(chips, note) {
    var lines = [];
    (chips || []).forEach(function (id) {
      if (CHIP_BY_ID[id]) lines.push(CHIP_BY_ID[id].change);
    });
    var text = clip(note, 240);
    if (text) lines.push('Also do this, and only this: ' + text);
    if (!lines.length) return '';
    return 'Revise the draft. Change only what this asks. Keep every other line, and keep the user lines word for word. ' + lines.join(' ');
  }

  function lengthAsk() {
    return {
      clear: false,
      empty: false,
      ask: 'Shorter or longer?',
      options: [
        { id: 'long', label: 'Shorter' },
        { id: 'short', label: 'Longer' }
      ]
    };
  }

  function slangAsk() {
    return {
      clear: false,
      empty: false,
      ask: 'More slang or less?',
      options: [
        { id: 'more-slang', label: 'More slang' },
        { id: 'less-slang', label: 'Less slang' }
      ]
    };
  }

  function feedbackPlan(input) {
    var raw = input || {};
    var chips = [];
    (raw.chips || []).forEach(function (id) {
      if (CHIP_BY_ID[id] && chips.indexOf(id) === -1) chips.push(id);
    });
    var note = clip(raw.note, 240);
    var set = {};
    chips.forEach(function (id) { set[id] = true; });
    if (!chips.length && !note) return { clear: false, empty: true, ask: '', options: [], instruction: '' };
    if (set.long && set.short) return lengthAsk();
    if (set['more-slang'] && set['less-slang']) return slangAsk();
    if (note && set.long && /longer|too short|add more/i.test(note)) return lengthAsk();
    if (note && set.short && /shorter|too long|\bcut\b/i.test(note)) return lengthAsk();
    if (note && set['more-slang'] && /less slang|no slang/i.test(note)) return slangAsk();
    if (note && set['less-slang'] && /more slang/i.test(note)) return slangAsk();
    var vague = /^(better|fix it|fix this|idk|i don't know|change it|make it better|meh|whatever|ok|okay)\.?$/i.test(note);
    if (vague && !chips.length) {
      return {
        clear: false,
        empty: false,
        ask: 'What should change?',
        options: [
          { id: 'hook', label: 'The hook' },
          { id: 'story', label: 'The story' },
          { id: 'short', label: 'Make it shorter' }
        ]
      };
    }
    return {
      clear: true,
      empty: false,
      ask: '',
      options: [],
      instruction: instruction(chips, vague ? '' : note)
    };
  }

  return {
    STORY_MAX: STORY_MAX,
    CHIPS: CHIPS,
    summary: summary,
    followups: followups,
    feedbackPlan: feedbackPlan,
    isGeneric: isGeneric
  };
});
