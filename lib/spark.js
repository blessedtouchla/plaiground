'use strict';

/**
 * What's hot spark. Sample items are original prompts, not news reports.
 * A live feed is used only when SPARK_FEEDS is set. No counts are invented.
 *
 * Browse levels: category, then a short topic, then a headline.
 * Spark ideas (flip, answer song, cause) open only after a headline.
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
  var GROUPS = [
    { id: 'trending', label: 'Trending', lanes: ['trending'] },
    { id: 'news', label: 'News', lanes: ['news-world', 'news-music', 'news-movies', 'news-regional'] },
    { id: 'causes', label: 'Causes', lanes: ['causes'] },
    { id: 'mindset', label: 'Mindset', lanes: ['mindset'] },
  ];
  var BROWSE = {
    pickTopic: 'Pick a topic. Headlines show up after that, not a finished song idea.',
    pickHeadline: 'Pick a headline. Then the song ideas open, like flip the angle or an answer song.',
    topics: 'Topics',
    headlines: 'Headlines',
    daily: 'Daily spark',
    empty: 'Nothing in this lane right now.',
  };
  var ASK = {
    lead: 'You can start writing now, or answer a few questions first.',
    optional: 'These questions are optional. The more you put in, the more human the draft feels. Leave one blank and it stays out of the lyric.',
    feel: 'How do you feel about this?',
    feelHint: 'Mad, tender, curious, done with it',
    story: 'Any personal experience with it?',
    storyHint: 'A real moment, if you have one',
    keep: 'What do you want the song to hold onto?',
    keepHint: 'A detail, a name, a sound',
    start: 'Start writing',
    startAway: 'Start writing in Song Helper',
  };

  var TRAGEDY_RE = /\b(killed|killing|murder|shot dead|shooting|suicide|overdose|funeral|massacre|bombing|war crime|died|death toll|tragedy|earthquake)\b/i;

  var SAMPLES = [
    {
      id: 'trend-phone',
      lane: 'trending',
      topic: 'The group chat',
      headline: 'Chat goes quiet',
      title: 'The group chat went quiet',
      detail: 'A sample angle about a chat that used to buzz and now just shows who is typing.',
      flip: 'Write it from the person who muted the chat, not the one who got left on read.',
      answer: 'An answer song from the friend who is still typing.',
      cause: '',
    },
    {
      id: 'trend-typing',
      lane: 'trending',
      topic: 'The group chat',
      headline: 'Still typing',
      title: 'The typing bubble will not quit',
      detail: 'A sample angle about the one person who keeps the bubble going after everyone else left.',
      flip: 'Make the song the sound of typing, not the argument that started it.',
      answer: 'An answer song from someone who already put the phone face down.',
      cause: '',
    },
    {
      id: 'trend-scroll',
      lane: 'trending',
      topic: 'The late scroll',
      headline: 'One more video',
      title: 'One more video before the lights',
      detail: 'A sample angle about promising to stop and then letting the next clip start.',
      flip: 'Write it from the thumb, not from a lecture about screen time.',
      answer: 'An answer song from the person in the bed next to the glow.',
      cause: '',
    },
    {
      id: 'trend-tab',
      lane: 'trending',
      topic: 'The late scroll',
      headline: 'The open tab',
      title: 'The tab you meant to close',
      detail: 'A sample angle about a tab left open because closing it would mean deciding.',
      flip: 'Skip the app. Put the song in the hand hovering over the X.',
      answer: 'An answer song from tomorrow morning, when the tab is still there.',
      cause: '',
    },
    {
      id: 'world-market',
      lane: 'news-world',
      topic: 'Shop hours',
      headline: 'Corner store closes early',
      title: 'The corner store changed its hours',
      detail: 'A sample world-desk angle: a familiar place now closes before people get off work.',
      flip: 'Make the song about the walk home, not about a headline.',
      answer: 'An answer song from the owner who had to lock the door early.',
      cause: '',
    },
    {
      id: 'world-walk',
      lane: 'news-world',
      topic: 'Shop hours',
      headline: 'Walk home in the dark',
      title: 'The sidewalk after close',
      detail: 'A sample world-desk angle about the block once the gate is down.',
      flip: 'Start with the dark window, not with a complaint about the city.',
      answer: 'An answer song from a neighbor who still has the spare key.',
      cause: '',
    },
    {
      id: 'world-bench',
      lane: 'news-world',
      topic: 'A familiar block',
      headline: 'The bench got moved',
      title: 'Someone moved the bench',
      detail: 'A sample world-desk angle. No paper is quoted, because no city feed is connected.',
      flip: 'Write from the person who sat there after work, not from a planning memo.',
      answer: 'An answer song from whoever bolted the bench to the new spot.',
      cause: '',
    },
    {
      id: 'world-paint',
      lane: 'news-world',
      topic: 'A familiar block',
      headline: 'Fresh paint on the corner',
      title: 'The corner got a new coat',
      detail: 'A sample world-desk angle about paint on a wall people use as a landmark.',
      flip: 'Make it about finding the door, not about who paid for the paint.',
      answer: 'An answer song from the kid who liked the old color.',
      cause: '',
    },
    {
      id: 'music-room',
      lane: 'news-music',
      topic: 'The practice room',
      headline: 'One working amp',
      title: 'A practice room with one working amp',
      detail: 'A sample music-desk angle. No chart position is attached, because none was counted.',
      flip: 'Flip it to the person who lent the cable, not the person on the mic.',
      answer: 'An answer song that thanks the borrowed amp without naming a real artist.',
      cause: '',
    },
    {
      id: 'music-cable',
      lane: 'news-music',
      topic: 'The practice room',
      headline: 'A borrowed cable',
      title: 'The cable that made it to rehearsal',
      detail: 'A sample music-desk angle about one working cable and a room full of quiet gear.',
      flip: 'Put the song in the handoff, not in a gear review.',
      answer: 'An answer song from the person who wants the cable back tonight.',
      cause: '',
    },
    {
      id: 'music-check',
      lane: 'news-music',
      topic: 'The small stage',
      headline: 'Soundcheck runs long',
      title: 'Soundcheck ate the afternoon',
      detail: 'A sample music-desk angle. No venue is named, and no ticket count is attached.',
      flip: 'Write from the person holding the setlist, not from the board.',
      answer: 'An answer song from the opener who is still in the hallway.',
      cause: '',
    },
    {
      id: 'music-opener',
      lane: 'news-music',
      topic: 'The small stage',
      headline: "The opener's set",
      title: 'Three songs before the room fills',
      detail: 'A sample music-desk angle about the set that happens while people are still outside.',
      flip: 'Make it about the empty chairs, not about a lineup announcement.',
      answer: 'An answer song from a friend who came early on purpose.',
      cause: '',
    },
    {
      id: 'movie-credits',
      lane: 'news-movies',
      topic: 'After the movie',
      headline: 'Staying for the credits',
      title: 'Staying through the credits',
      detail: 'A sample movie-desk angle about the names that scroll after the room empties.',
      flip: 'Write from a name in the credits the audience did not wait for.',
      answer: 'An answer song from someone in the audience who stayed.',
      cause: '',
    },
    {
      id: 'movie-lights',
      lane: 'news-movies',
      topic: 'After the movie',
      headline: 'Lights up, seats empty',
      title: 'The lights come up on empty seats',
      detail: 'A sample movie-desk angle about the room once people head for the door.',
      flip: 'Skip the plot. Put the song in the walk up the aisle.',
      answer: 'An answer song from the person sweeping the row.',
      cause: '',
    },
    {
      id: 'movie-name',
      lane: 'news-movies',
      topic: 'The names at the end',
      headline: 'A name in the crawl',
      title: 'One name in the long crawl',
      detail: 'A sample movie-desk angle. No film is named, and no box office figure is attached.',
      flip: 'Write the job, not the premiere.',
      answer: 'An answer song from a relative who paused the screen to read it.',
      cause: '',
    },
    {
      id: 'movie-wait',
      lane: 'news-movies',
      topic: 'The names at the end',
      headline: 'Nobody waited',
      title: 'The room did not wait for the names',
      detail: 'A sample movie-desk angle about credits that play to the back of a crowd.',
      flip: 'Tell it from the last person still seated.',
      answer: 'An answer song from the name that scrolled anyway.',
      cause: '',
    },
    {
      id: 'regional-bus',
      lane: 'news-regional',
      topic: 'The bus route',
      headline: 'Last bus at the bridge',
      title: 'The last bus before the bridge',
      detail: 'A sample city angle. No paper is quoted, because no city feed is connected.',
      flip: 'Tell it from the driver, then from the person running for the door.',
      answer: 'An answer song set on the same route the next morning.',
      cause: '',
    },
    {
      id: 'regional-door',
      lane: 'news-regional',
      topic: 'The bus route',
      headline: 'Running for the door',
      title: 'Almost missed the door',
      detail: 'A sample city angle about a run that ends at a closing bus door.',
      flip: 'Make the song the breath, not a transit announcement.',
      answer: 'An answer song from the driver who held the door one extra second.',
      cause: '',
    },
    {
      id: 'regional-morning',
      lane: 'news-regional',
      topic: 'The same stop',
      headline: 'Same route, next morning',
      title: 'The stop looks different in daylight',
      detail: 'A sample city angle about riding the route again after missing it once.',
      flip: 'Start with the bench, not with being late.',
      answer: 'An answer song from someone who catches this bus every day.',
      cause: '',
    },
    {
      id: 'regional-driver',
      lane: 'news-regional',
      topic: 'The same stop',
      headline: 'The driver knows the stop',
      title: 'The driver already knows your stop',
      detail: 'A sample city angle. No agency is named, because no feed is connected.',
      flip: 'Write the nod between driver and rider, not a route map.',
      answer: 'An answer song from a new rider who does not have a nod yet.',
      cause: '',
    },
    {
      id: 'cause-library',
      lane: 'causes',
      topic: 'The public room',
      headline: 'Shorter library hours',
      title: 'Library hours got shorter',
      detail: 'A sample cause: a room kids use after school is open fewer days.',
      flip: 'Skip the speech. Put the song in the parking lot at closing time.',
      answer: 'An answer song from a librarian who wants the lights back on.',
      cause: 'A cause drop about keeping a public room open. Do not invent a donation total.',
    },
    {
      id: 'cause-lot',
      lane: 'causes',
      topic: 'The public room',
      headline: 'Kids at closing time',
      title: 'The parking lot at close',
      detail: 'A sample cause about where people wait once the doors lock.',
      flip: 'Name the backpack on the curb, not a campaign.',
      answer: 'An answer song from a kid who needed one more hour.',
      cause: 'A cause drop about after-school hours. No fake goal amount.',
    },
    {
      id: 'cause-instruments',
      lane: 'causes',
      topic: 'The youth room',
      headline: 'Empty pegs on the wall',
      title: 'The youth room needs instruments',
      detail: 'A sample cause about a music room with empty pegs on the wall.',
      flip: 'Name one missing instrument, not a whole campaign.',
      answer: 'An answer song from a student who is waiting on a guitar.',
      cause: 'A cause drop about instruments in a youth room. No fake goal amount.',
    },
    {
      id: 'cause-guitar',
      lane: 'causes',
      topic: 'The youth room',
      headline: 'One guitar short',
      title: 'The room is one guitar short',
      detail: 'A sample cause about a circle that has a seat and no instrument for it.',
      flip: 'Write the empty chair, not a pledge drive.',
      answer: 'An answer song from the person who brought strings and nothing to put them on.',
      cause: 'A cause drop about one missing guitar. Do not invent a price.',
    },
    {
      id: 'mind-phone',
      lane: 'mindset',
      topic: 'Phone down',
      headline: 'Phone in the other room',
      title: 'The phone sleeps in the other room',
      detail: 'A sample mindset prompt: dinner without a screen. Not a study, and not a percentage.',
      flip: 'Write the itch to check it, then the quiet after you do not.',
      answer: 'An answer song from the phone, stuck in the drawer.',
      cause: '',
    },
    {
      id: 'mind-itch',
      lane: 'mindset',
      topic: 'Phone down',
      headline: 'The itch to check',
      title: 'The hand still reaches',
      detail: 'A sample mindset prompt about the reach for a phone that is not on the table.',
      flip: 'Stay with the hand. Leave the lesson out.',
      answer: 'An answer song from the pocket that is empty on purpose.',
      cause: '',
    },
    {
      id: 'mind-walk',
      lane: 'mindset',
      topic: 'The long way',
      headline: 'Around the block',
      title: 'The long way around the block',
      detail: 'A sample mindset prompt about walking the long way on purpose.',
      flip: 'Start with the shoes, not the lesson.',
      answer: 'An answer song that refuses the shortcut.',
      cause: '',
    },
    {
      id: 'mind-shortcut',
      lane: 'mindset',
      topic: 'The long way',
      headline: 'Skip the shortcut',
      title: 'The shortcut is right there',
      detail: 'A sample mindset prompt about seeing the short way and not taking it.',
      flip: 'Count the extra blocks in footsteps, not in advice.',
      answer: 'An answer song from the corner you could have turned.',
      cause: '',
    },
  ];

  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function dayIndex(now) {
    var t = now ? new Date(now) : new Date();
    var start = Date.UTC(t.getUTCFullYear(), 0, 0);
    var day = Math.floor((Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()) - start) / 86400000);
    return ((day % SAMPLES.length) + SAMPLES.length) % SAMPLES.length;
  }

  function decorate(row) {
    var title = clean(row.title);
    return {
      id: row.id,
      lane: row.lane,
      topic: clean(row.topic),
      headline: clean(row.headline || title),
      title: title,
      detail: row.detail,
      flip: row.flip,
      answer: row.answer,
      cause: row.cause || '',
      sourceLabel: row.sourceLabel || SAMPLE_LABEL,
      sourceUrl: row.sourceUrl || '',
      sample: row.sample !== false,
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

  function itemText(item) {
    if (!item) return '';
    return [item.topic, item.headline, item.title, item.detail, item.flip, item.answer, item.cause].join(' ');
  }

  function inLanes(items, lanes) {
    var list = (items || []).filter(function (item) {
      return item && !tragedy(itemText(item));
    });
    if (!lanes || !lanes.length) return list;
    return list.filter(function (item) { return lanes.indexOf(item.lane) !== -1; });
  }

  function topicsFor(items, lanes) {
    var seen = {};
    var out = [];
    inLanes(items, lanes).forEach(function (item) {
      var label = clean(item.topic);
      if (!label || seen[label]) return;
      seen[label] = true;
      out.push({ id: label, label: label, lane: item.lane });
    });
    return out;
  }

  function headlinesFor(items, lanes, topic) {
    var want = clean(topic);
    if (!want) return [];
    var seen = {};
    var out = [];
    inLanes(items, lanes).forEach(function (item) {
      if (clean(item.topic) !== want) return;
      var label = clean(item.headline || item.title);
      if (!label || seen[label]) return;
      seen[label] = true;
      out.push({ id: label, label: label, topic: want, lane: item.lane });
    });
    return out;
  }

  function sparksFor(items, lanes, topic, headline) {
    var wantTopic = clean(topic);
    var wantHeadline = clean(headline);
    if (!wantTopic || !wantHeadline) return [];
    return inLanes(items, lanes).filter(function (item) {
      return clean(item.topic) === wantTopic && clean(item.headline || item.title) === wantHeadline;
    });
  }

  function pack(now) {
    return {
      ok: true,
      demo: true,
      notice: SAMPLE_LABEL,
      lanes: LANES,
      groups: GROUPS,
      daily: dailySpark(now),
      items: samples(),
    };
  }

  return {
    ASK: ASK,
    BROWSE: BROWSE,
    GROUPS: GROUPS,
    LANES: LANES,
    SAMPLE_LABEL: SAMPLE_LABEL,
    byLane: byLane,
    dailySpark: dailySpark,
    headlinesFor: headlinesFor,
    pack: pack,
    samples: samples,
    sparksFor: sparksFor,
    topicsFor: topicsFor,
    tragedy: tragedy,
  };
}));
