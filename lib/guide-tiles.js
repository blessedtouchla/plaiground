/**
 * Local guide tiles for Song Helper parts.
 * Questions and topic picks stay on the page. No model call lives here.
 * Browser and server. No secrets.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PlaigroundGuideTiles = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  function tile(id, label, prompt, example) {
    return { id: id, label: label, prompt: prompt, example: example, kind: 'question' };
  }

  function topic(id, label, prompt, example) {
    var row = tile(id, label, prompt, example);
    row.kind = 'topic';
    return row;
  }

  var QUESTIONS = {
    'verse-1': [
      tile('where', 'Where were you?', 'Name the place and one thing you could point at.', 'The kitchen light was still on.'),
      tile('said', 'What did they say?', 'Use their words, even a short piece.', 'You said stay, then you did not.'),
      tile('see', 'What did you see?', 'One picture. A color, an object, or a face.', 'Your coat on the back of the chair.'),
      tile('who', 'Who was with you?', 'A name, or what their hands were doing.', 'She kept the keys in her fist.'),
    ],
    'verse-2': [
      tile('next', 'What happened next?', 'Move one step past the first verse. A new picture.', 'I kept the window down the whole way home.'),
      tile('held', 'What did you hold back?', 'The sentence you did not say out loud.', 'I almost called you from the car.'),
      tile('sound', 'What did it sound like?', 'A sound from that moment, not a summary.', 'The fridge hummed and nobody talked.'),
    ],
    hook: [
      tile('shout', "What's the one line you'd shout?", 'One or two lines people can sing back. Keep it short enough to shout.', 'I am still here.'),
      tile('feel', 'What do you want them to feel?', 'Name the feeling, then say it in a line they can repeat.', 'Stay with me until the light.'),
      tile('repeat', "What's the line that repeats?", 'The hook is one or two full lines. The same line should not stack four times.', 'Leave a light on for me.'),
    ],
    bridge: [
      tile('changed', 'What changed?', 'Say what is different now, in one picture.', 'The same street, but I do not look back.'),
      tile('truth', "What's the truth you haven't said?", 'One honest line you have not put in the verses.', 'I was scared, and I still went.'),
      tile('know', 'What do you know now?', 'The turn. One truth the verses have not said yet.', 'I was the one who left the door open.'),
    ],
  };

  var TOPICS = {
    first: topic('first', 'The first moment', 'Start where it began. One place, one detail.', 'We met by the door in the rain.'),
    fight: topic('fight', 'The fight', 'The moment it turned. What was said, not a speech.', 'You raised your voice and I went quiet.'),
    back: topic('back', 'Looking back', 'What you see now that you missed then.', 'I can still hear the song from that kitchen.'),
    next: topic('next', "What's next", 'Where you want the song to land.', 'I am walking toward the light I left on.'),
  };

  function partKey(row) {
    var id = String(row && row.id || '');
    var kind = String(row && row.kind || '');
    var label = String(row && row.label || '');
    if (kind === 'hook' || id === 'hook') return 'hook';
    if (kind === 'bridge' || id === 'bridge') return 'bridge';
    if (id === 'verse-1' || /verse\s*1\b/i.test(label)) return 'verse-1';
    if (kind === 'verse' || /verse/i.test(label)) return 'verse-2';
    return '';
  }

  function list(value) {
    if (!value) return [];
    var rows = Array.isArray(value) ? value : [value];
    return rows.map(function (item) { return String(item || '').toLowerCase(); }).filter(Boolean);
  }

  function topicTiles(ctx) {
    var data = ctx || {};
    var kinds = list(data.kinds);
    var aims = list(data.aims);
    var mood = String(data.mood || '').toLowerCase();
    var story = String(data.story || '').toLowerCase();
    var out = [];
    function add(row) {
      if (out.length >= 4) return;
      if (out.some(function (item) { return item.id === row.id; })) return;
      out.push(row);
    }
    var hasStory = !!(data.opener || data.moment || data.place || data.forText || story.trim());
    if (hasStory) add(TOPICS.first);
    if (kinds.indexOf('angry') !== -1 || kinds.indexOf('petty') !== -1 || kinds.indexOf('heartbreak') !== -1 || aims.indexOf('clapback') !== -1 || /fight|argument|broke/.test(story) || /angry|petty|heartbreak/.test(mood)) {
      add(TOPICS.fight);
    }
    if (kinds.indexOf('nostalgic') !== -1 || kinds.indexOf('grateful') !== -1 || aims.indexOf('heal') !== -1 || /remember|looking back|used to|back then/.test(story) || /nostalg/.test(mood)) {
      add(TOPICS.back);
    }
    if (data.keep || data.wisdom || aims.indexOf('inspire') !== -1 || aims.indexOf('hype') !== -1 || kinds.indexOf('hype') !== -1 || kinds.indexOf('mindset') !== -1) {
      add(TOPICS.next);
    }
    return out;
  }

  function tilesFor(row, ctx) {
    var key = partKey(row);
    var questions = key && QUESTIONS[key] ? QUESTIONS[key].slice() : [];
    var topics = topicTiles(ctx);
    return {
      key: key,
      questions: questions,
      topics: topics,
      tiles: questions.concat(topics),
    };
  }

  return {
    QUESTIONS: QUESTIONS,
    TOPICS: TOPICS,
    partKey: partKey,
    topicTiles: topicTiles,
    tilesFor: tilesFor,
  };
});
