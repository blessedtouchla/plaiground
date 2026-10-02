'use strict';

/**
 * What's hot spark. Sample items are original prompts, not news reports.
 * A live feed is used only when SPARK_FEEDS is set. No counts are invented.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SparkCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var SAMPLE_LABEL = 'Sample. No live source is connected.';
  var LANES = [
    { id: 'trending', label: 'Trending' },
    { id: 'news-world', label: 'News · world' },
    { id: 'news-music', label: 'News · music' },
    { id: 'news-movies', label: 'News · movies' },
    { id: 'news-regional', label: 'News · regional' },
    { id: 'causes', label: 'Causes' },
    { id: 'mindset', label: 'Mindset' },
  ];

  var TRAGEDY_RE = /\b(killed|killing|murder|shot dead|shooting|suicide|overdose|funeral|massacre|bombing|war crime|died|death toll|tragedy|earthquake)\b/i;

  var SAMPLES = [
    {
      id: 'trend-phone',
      lane: 'trending',
      title: 'The group chat went quiet',
      detail: 'A sample angle about a chat that used to buzz and now just shows who is typing.',
      flip: 'Write it from the person who muted the chat, not the one who got left on read.',
      answer: 'An answer song from the friend who is still typing.',
      cause: '',
    },
    {
      id: 'world-market',
      lane: 'news-world',
      title: 'The corner store changed its hours',
      detail: 'A sample world-desk angle: a familiar place now closes before people get off work.',
      flip: 'Make the song about the walk home, not about a headline.',
      answer: 'An answer song from the owner who had to lock the door early.',
      cause: '',
    },
    {
      id: 'music-room',
      lane: 'news-music',
      title: 'A practice room with one working amp',
      detail: 'A sample music-desk angle. No chart position is attached, because none was counted.',
      flip: 'Flip it to the person who lent the cable, not the person on the mic.',
      answer: 'An answer song that thanks the borrowed amp without naming a real artist.',
      cause: '',
    },
    {
      id: 'movie-credits',
      lane: 'news-movies',
      title: 'Staying through the credits',
      detail: 'A sample movie-desk angle about the names that scroll after the room empties.',
      flip: 'Write from a name in the credits the audience did not wait for.',
      answer: 'An answer song from someone in the audience who stayed.',
      cause: '',
    },
    {
      id: 'regional-bus',
      lane: 'news-regional',
      title: 'The last bus before the bridge',
      detail: 'A sample city angle. No paper is quoted, because no city feed is connected.',
      flip: 'Tell it from the driver, then from the person running for the door.',
      answer: 'An answer song set on the same route the next morning.',
      cause: '',
    },
    {
      id: 'cause-library',
      lane: 'causes',
      title: 'Library hours got shorter',
      detail: 'A sample cause: a room kids use after school is open fewer days.',
      flip: 'Skip the speech. Put the song in the parking lot at closing time.',
      answer: 'An answer song from a librarian who wants the lights back on.',
      cause: 'A cause drop about keeping a public room open. Do not invent a donation total.',
    },
    {
      id: 'cause-instruments',
      lane: 'causes',
      title: 'The youth room needs instruments',
      detail: 'A sample cause about a music room with empty pegs on the wall.',
      flip: 'Name one missing instrument, not a whole campaign.',
      answer: 'An answer song from a student who is waiting on a guitar.',
      cause: 'A cause drop about instruments in a youth room. No fake goal amount.',
    },
    {
      id: 'mind-phone',
      lane: 'mindset',
      title: 'The phone sleeps in the other room',
      detail: 'A sample mindset prompt: dinner without a screen. Not a study, and not a percentage.',
      flip: 'Write the itch to check it, then the quiet after you do not.',
      answer: 'An answer song from the phone, stuck in the drawer.',
      cause: '',
    },
    {
      id: 'mind-walk',
      lane: 'mindset',
      title: 'The long way around the block',
      detail: 'A sample mindset prompt about walking the long way on purpose.',
      flip: 'Start with the shoes, not the lesson.',
      answer: 'An answer song that refuses the shortcut.',
      cause: '',
    },
  ];

  function dayIndex(now) {
    var t = now ? new Date(now) : new Date();
    var start = Date.UTC(t.getUTCFullYear(), 0, 0);
    var day = Math.floor((Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()) - start) / 86400000);
    return ((day % SAMPLES.length) + SAMPLES.length) % SAMPLES.length;
  }

  function decorate(row) {
    return {
      id: row.id,
      lane: row.lane,
      title: row.title,
      detail: row.detail,
      flip: row.flip,
      answer: row.answer,
      cause: row.cause || '',
      sourceLabel: SAMPLE_LABEL,
      sourceUrl: '',
      sample: true,
    };
  }

  function samples() {
    return SAMPLES.map(decorate);
  }

  function dailySpark(now) {
    var row = decorate(SAMPLES[dayIndex(now)]);
    row.daily = true;
    row.dailyNote = 'Daily spark. This pick is a sample rotation, not a live chart.';
    return row;
  }

  function byLane(lane) {
    var id = String(lane || '').trim();
    return samples().filter(function (row) { return !id || row.lane === id; });
  }

  function tragedy(text) {
    return TRAGEDY_RE.test(String(text || ''));
  }

  function pack(now) {
    return {
      ok: true,
      demo: true,
      notice: SAMPLE_LABEL,
      lanes: LANES,
      daily: dailySpark(now),
      items: samples(),
    };
  }

  return {
    LANES: LANES,
    SAMPLE_LABEL: SAMPLE_LABEL,
    byLane: byLane,
    dailySpark: dailySpark,
    pack: pack,
    samples: samples,
    tragedy: tragedy,
  };
}));
