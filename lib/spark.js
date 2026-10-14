'use strict';

/**
 * What's hot spark. Sample items are original prompts, not news reports.
 * Trending on the live page comes from daily sources in lib/spark-feed.js.
 * These samples stay for News, Causes, and Mindset, and for offline checks.
 * No counts are invented.
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
  var REFRESH_NOTICE = 'Trending is refreshing, check back soon';
  var NEWS_REFRESH_NOTICE = 'News is refreshing, check back soon';
  var CAUSES_NOTICE = 'Writing prompts. Each one is a personal story, with a hopeful angle and a protest angle.';
  var MINDSET_NOTICE = 'Writing prompts for growth, motivation, healing, and confidence.';
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

  var TRAGEDY_RE = /\b(killed|killing|murder|shot dead|shooting|suicide|overdose|funeral|massacre|bombing|war crime|died|dies|dead|death toll|tragedy|earthquake|passed away|obituary)\b/i;

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
      id: 'cause-climate-hope',
      lane: 'causes',
      topic: 'Climate and environment',
      headline: 'The plant that made it',
      title: 'A plant on the windowsill made it through the heat',
      detail: 'A writing prompt about a plant that lived through a hot week on your block.',
      flip: 'Write the morning you noticed the plant was still green. Stay with what you saw.',
      answer: 'Write the heat on your block and who had to sit in it. Keep it about your street.',
      cause: 'This is your story, hopeful or protest. Leave officials and campaigns out of it.',
    },
    {
      id: 'cause-climate-protest',
      lane: 'causes',
      topic: 'Climate and environment',
      headline: 'The heat on our block',
      title: 'The heat sat on our block all afternoon',
      detail: 'A writing prompt about a hot afternoon on the block where you live.',
      flip: 'Write one cool place people shared, a porch or a store. Stay with that place.',
      answer: 'Write who had nowhere cool to go. Stay with their day, not a speech.',
      cause: 'This is your story, hopeful or protest. Leave officials and campaigns out of it.',
    },
    {
      id: 'cause-race-hope',
      lane: 'causes',
      topic: 'Racial justice',
      headline: 'Someone said my name right',
      title: 'Someone said my name the way I say it',
      detail: 'A writing prompt about your name being said the way you say it.',
      flip: 'Write the person who got your name right. Where were you standing?',
      answer: 'Write a moment your name was brushed off. Stay with that moment.',
      cause: 'This is your story, hopeful or protest. Leave officials and campaigns out of it.',
    },
    {
      id: 'cause-race-protest',
      lane: 'causes',
      topic: 'Racial justice',
      headline: 'The stop that was not fair',
      title: 'The stop on the way home was not fair',
      detail: 'A writing prompt about a stop on the way home that did not feel right.',
      flip: 'Write who waited with you after. What did they hand you?',
      answer: 'Write the stop from your own eyes. Stay with what you remember.',
      cause: 'This is your story, hopeful or protest. Leave officials and campaigns out of it.',
    },
    {
      id: 'cause-imm-hope',
      lane: 'causes',
      topic: 'Immigration',
      headline: 'The kitchen that kept a seat',
      title: 'The kitchen kept a seat for whoever got in late',
      detail: 'A writing prompt about a kitchen that kept a seat for someone who got in late.',
      flip: 'Write the seat, the plate, and who saved it. Stay in that kitchen.',
      answer: 'Write a night the seat was empty and why. Stay with the people at the table.',
      cause: 'This is your story, hopeful or protest. Leave officials and campaigns out of it.',
    },
    {
      id: 'cause-imm-protest',
      lane: 'causes',
      topic: 'Immigration',
      headline: 'The letter on the table',
      title: 'A letter sat on the table for a week',
      detail: 'A writing prompt about a letter that sat on the table and would not be ignored.',
      flip: 'Write who read it with you. What did they say first?',
      answer: 'Write what the letter asked of your family. Stay with your house.',
      cause: 'This is your story, hopeful or protest. Leave officials and campaigns out of it.',
    },
    {
      id: 'cause-mind-hope',
      lane: 'causes',
      topic: 'Mental health',
      headline: 'The day I asked for help',
      title: 'The day I asked for help out loud',
      detail: 'A writing prompt about the day you asked for help out loud.',
      flip: 'Write who answered, and where you were sitting.',
      answer: 'Write how long you had to wait before anyone answered. Stay with that wait.',
      cause: 'This is your story, hopeful or protest. Leave officials and campaigns out of it.',
    },
    {
      id: 'cause-mind-protest',
      lane: 'causes',
      topic: 'Mental health',
      headline: 'The wait for a real answer',
      title: 'I waited a long time for a real answer',
      detail: 'A writing prompt about waiting a long time for a real answer.',
      flip: 'Write the person who finally sat with you. What did the room sound like?',
      answer: 'Write the waiting room and the clock. Stay with how the day felt.',
      cause: 'This is your story, hopeful or protest. Leave officials and campaigns out of it.',
    },
    {
      id: 'cause-home-hope',
      lane: 'causes',
      topic: 'Housing and homelessness',
      headline: 'A key in my hand',
      title: 'A key was in my hand for the first time',
      detail: 'A writing prompt about a key in your hand and a door that opened.',
      flip: 'Write the first night with a key of your own. What did you set down?',
      answer: 'Write the nights before the key. Stay with where you slept.',
      cause: 'This is your story, hopeful or protest. Leave officials and campaigns out of it.',
    },
    {
      id: 'cause-home-protest',
      lane: 'causes',
      topic: 'Housing and homelessness',
      headline: 'The rent and the notice',
      title: 'The rent notice was taped to the door',
      detail: 'A writing prompt about a rent notice on the door and the night that followed.',
      flip: 'Write who helped you read it. What did they offer?',
      answer: 'Write the notice and what it changed that week. Stay with your door.',
      cause: 'This is your story, hopeful or protest. Leave officials and campaigns out of it.',
    },
    {
      id: 'cause-lgbtq-hope',
      lane: 'causes',
      topic: 'LGBTQ+ rights',
      headline: 'The room that used my name',
      title: 'The room finally used the name I use',
      detail: 'A writing prompt about a room that used the name you use.',
      flip: 'Write who said it first, and what you felt in your chest.',
      answer: 'Write a room that would not say it. Stay with that one room.',
      cause: 'This is your story, hopeful or protest. Leave officials and campaigns out of it.',
    },
    {
      id: 'cause-lgbtq-protest',
      lane: 'causes',
      topic: 'LGBTQ+ rights',
      headline: 'The form that left me out',
      title: 'The form had no box for me',
      detail: 'A writing prompt about a form that had no place for you.',
      flip: 'Write who handed you a pen and said to write it in anyway.',
      answer: 'Write the form and the box that was missing. Stay with your name.',
      cause: 'This is your story, hopeful or protest. Leave officials and campaigns out of it.',
    },
    {
      id: 'cause-gun-hope',
      lane: 'causes',
      topic: 'Gun violence',
      headline: 'We walked home together',
      title: 'We walked home together after the sirens faded',
      detail: 'A writing prompt about walking home with someone you trust.',
      flip: 'Write the walk home and who waited for you. Stay with the two of you.',
      answer: 'Write what your block asked for so the night could be quieter. Stay with the people who live there.',
      cause: 'This is your story, hopeful or protest. Leave officials and campaigns out of it.',
    },
    {
      id: 'cause-gun-protest',
      lane: 'causes',
      topic: 'Gun violence',
      headline: 'The block wants it quieter',
      title: 'The block asked for a quieter night',
      detail: 'A writing prompt about a block that wants a quieter night.',
      flip: 'Write a night the block was loud with music, not with fear.',
      answer: 'Write the ask your neighbors made. Stay on your street.',
      cause: 'This is your story, hopeful or protest. Leave officials and campaigns out of it.',
    },
    {
      id: 'cause-work-hope',
      lane: 'causes',
      topic: "Workers' rights",
      headline: 'The shift that ended on time',
      title: 'The shift ended when the clock said it should',
      detail: 'A writing prompt about a shift that ended when it was supposed to.',
      flip: 'Write the clock-out and who walked out with you.',
      answer: 'Write a shift that would not end. Stay with your feet and the clock.',
      cause: 'This is your story, hopeful or protest. Leave officials and campaigns out of it.',
    },
    {
      id: 'cause-work-protest',
      lane: 'causes',
      topic: "Workers' rights",
      headline: 'The hours they did not pay',
      title: 'The hours after close never showed up on the check',
      detail: 'A writing prompt about hours you worked that never showed up on the check.',
      flip: 'Write who counted the hours with you. What did you do next?',
      answer: 'Write the hours that went unpaid. Stay with the work you did.',
      cause: 'This is your story, hopeful or protest. Leave officials and campaigns out of it.',
    },
    {
      id: 'cause-peace-hope',
      lane: 'causes',
      topic: 'Peace and anti-war',
      headline: 'A quiet table at dinner',
      title: 'Dinner was quiet enough to hear the glasses',
      detail: 'A writing prompt about a quiet table and the glasses on it.',
      flip: 'Write the dinner and who was in the chairs. Stay at that table.',
      answer: 'Write why the table needed to be quiet. Stay with your family.',
      cause: 'This is your story, hopeful or protest. Leave officials and campaigns out of it.',
    },
    {
      id: 'cause-peace-protest',
      lane: 'causes',
      topic: 'Peace and anti-war',
      headline: 'The news on mute',
      title: 'The news stayed on mute through the meal',
      detail: 'A writing prompt about leaving the news on mute so the room could talk.',
      flip: 'Write what you talked about once the sound was off.',
      answer: 'Write what the muted screen was showing and why you could not watch. Stay in the room.',
      cause: 'This is your story, hopeful or protest. Leave officials and campaigns out of it.',
    },
    {
      id: 'cause-animal-hope',
      lane: 'causes',
      topic: 'Animal rights',
      headline: 'The dog at the door',
      title: 'The dog waited at the door like it knew the hour',
      detail: 'A writing prompt about a dog that waited at the door.',
      flip: 'Write the dog and the person who let it in. Stay at the door.',
      answer: 'Write an animal that had no door. Stay with what you saw.',
      cause: 'This is your story, hopeful or protest. Leave officials and campaigns out of it.',
    },
    {
      id: 'cause-animal-protest',
      lane: 'causes',
      topic: 'Animal rights',
      headline: 'The crate by the road',
      title: 'A crate sat by the road in the heat',
      detail: 'A writing prompt about a crate by the road and what you did next.',
      flip: 'Write who stopped with you and what you carried.',
      answer: 'Write the crate and the heat. Stay with the choice you made.',
      cause: 'This is your story, hopeful or protest. Leave officials and campaigns out of it.',
    },
    {
      id: 'cause-vote-hope',
      lane: 'causes',
      topic: 'Voting',
      headline: 'I stood in the line',
      title: 'I stood in the line with my neighbor',
      detail: 'A writing prompt about standing in line with a neighbor.',
      flip: 'Write the line and what you and your neighbor talked about.',
      answer: 'Write a line that was too long for the people who work late. Stay with those people.',
      cause: 'This is your story, hopeful or protest. Leave officials and campaigns out of it.',
    },
    {
      id: 'cause-vote-protest',
      lane: 'causes',
      topic: 'Voting',
      headline: 'The poll was already closed',
      title: 'The poll was already closed when I got off work',
      detail: 'A writing prompt about getting to the poll after it had closed.',
      flip: 'Write who told you when to come back. Stay with that conversation.',
      answer: 'Write the closed door and the shift you had just finished.',
      cause: 'This is your story, hopeful or protest. Leave officials and campaigns out of it.',
    },
    {
      id: 'cause-women-hope',
      lane: 'causes',
      topic: "Women's rights",
      headline: 'She took the mic',
      title: 'She took the mic and finished the sentence',
      detail: 'A writing prompt about her taking the mic and finishing the sentence.',
      flip: 'Write the sentence she finished and who listened.',
      answer: 'Write a room that would not pass the mic. Stay with her hands.',
      cause: 'This is your story, hopeful or protest. Leave officials and campaigns out of it.',
    },
    {
      id: 'cause-women-protest',
      lane: 'causes',
      topic: "Women's rights",
      headline: 'The meeting talked over her',
      title: 'The meeting talked over her until she stood up',
      detail: 'A writing prompt about a meeting that talked over her until she stood up.',
      flip: 'Write the moment the room got quiet for her.',
      answer: 'Write the voices that talked over her. Stay in that meeting.',
      cause: 'This is your story, hopeful or protest. Leave officials and campaigns out of it.',
    },
    {
      id: 'cause-youth-hope',
      lane: 'causes',
      topic: 'Community and youth',
      headline: 'The gym stayed open',
      title: 'The gym stayed open after the last bell',
      detail: 'A writing prompt about a gym that stayed open after the last bell.',
      flip: 'Write who kept the door open and what the room sounded like.',
      answer: 'Write a night the gym was locked. Stay with the kids outside.',
      cause: 'This is your story, hopeful or protest. Leave officials and campaigns out of it.',
    },
    {
      id: 'cause-youth-protest',
      lane: 'causes',
      topic: 'Community and youth',
      headline: 'The lights went out early',
      title: 'The lights in the youth room went out early',
      detail: 'A writing prompt about lights in the youth room going out early.',
      flip: 'Write who brought the kids somewhere else that night.',
      answer: 'Write the dark room and who needed it open. Stay with them.',
      cause: 'This is your story, hopeful or protest. Leave officials and campaigns out of it.',
    },
    {
      id: 'mind-growth-step',
      lane: 'mindset',
      topic: 'Growth',
      headline: 'The next small step',
      title: 'The next small step was the one I took',
      detail: 'A growth prompt. Write one step you actually took, not a speech about becoming better.',
      flip: 'Start with where your feet were. What did you do next?',
      answer: 'An answer song from the version of you that was scared to start.',
      cause: '',
    },
    {
      id: 'mind-growth-skill',
      lane: 'mindset',
      topic: 'Growth',
      headline: 'A skill I kept',
      title: 'I kept one skill when other things slipped',
      detail: 'A growth prompt about a skill you kept practicing.',
      flip: 'Name the skill and the room where you practice it.',
      answer: 'An answer song from the messy early tries.',
      cause: '',
    },
    {
      id: 'mind-motive-ready',
      lane: 'mindset',
      topic: 'Motivation',
      headline: 'Before I felt ready',
      title: 'I started before I felt ready',
      detail: 'A motivation prompt about starting while you still felt unsure.',
      flip: 'Write the first minute, not the pep talk.',
      answer: 'An answer song from the clock that was already running.',
      cause: '',
    },
    {
      id: 'mind-motive-back',
      lane: 'mindset',
      topic: 'Motivation',
      headline: 'The reason I came back',
      title: 'I came back because the work still mattered',
      detail: 'A motivation prompt about why you returned to something.',
      flip: 'Write the door you walked back through. Who was still there?',
      answer: 'An answer song from the day you stayed home, and the day you did not.',
      cause: '',
    },
    {
      id: 'mind-heal-morning',
      lane: 'mindset',
      topic: 'Healing',
      headline: 'A softer morning',
      title: 'The morning I let myself be softer',
      detail: 'A healing prompt about a morning you stopped pushing.',
      flip: 'Write the light in the room and what you let wait.',
      answer: 'An answer song from the part of you that wanted to rush.',
      cause: '',
    },
    {
      id: 'mind-heal-quiet',
      lane: 'mindset',
      topic: 'Healing',
      headline: 'I let the day be quiet',
      title: 'I let the day stay quiet on purpose',
      detail: 'A healing prompt about choosing a quiet day.',
      flip: 'Write one sound you kept, and the rest you turned down.',
      answer: 'An answer song from the quiet itself.',
      cause: '',
    },
    {
      id: 'mind-conf-aloud',
      lane: 'mindset',
      topic: 'Confidence',
      headline: 'I said it out loud',
      title: 'I said the true thing out loud',
      detail: 'A confidence prompt about saying something true in your own voice.',
      flip: 'Write the sentence and where you were standing.',
      answer: 'An answer song from the breath before you spoke.',
      cause: '',
    },
    {
      id: 'mind-conf-room',
      lane: 'mindset',
      topic: 'Confidence',
      headline: 'The room I walked into',
      title: 'I walked into the room before I felt brave',
      detail: 'A confidence prompt about entering a room that mattered to you.',
      flip: 'Write the door, the light, and what you did with your hands.',
      answer: 'An answer song from the person who saved you a seat.',
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
    if (!lanes || !lanes.length) return [];
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

  function withoutTrending(source) {
    var base = source || pack();
    return {
      ok: true,
      demo: true,
      notice: REFRESH_NOTICE,
      newsNotice: NEWS_REFRESH_NOTICE,
      asOf: '',
      newsAsOf: '',
      lanes: base.lanes || LANES,
      groups: base.groups || GROUPS,
      daily: null,
      newsDaily: null,
      items: (base.items || []).filter(function (item) {
        return item.lane === 'causes' || item.lane === 'mindset';
      }),
    };
  }

  return {
    ASK: ASK,
    BROWSE: BROWSE,
    GROUPS: GROUPS,
    LANES: LANES,
    CAUSES_NOTICE: CAUSES_NOTICE,
    MINDSET_NOTICE: MINDSET_NOTICE,
    NEWS_REFRESH_NOTICE: NEWS_REFRESH_NOTICE,
    REFRESH_NOTICE: REFRESH_NOTICE,
    SAMPLE_LABEL: SAMPLE_LABEL,
    byLane: byLane,
    dailySpark: dailySpark,
    headlinesFor: headlinesFor,
    pack: pack,
    samples: samples,
    sparksFor: sparksFor,
    topicsFor: topicsFor,
    tragedy: tragedy,
    withoutTrending: withoutTrending,
  };
}));
