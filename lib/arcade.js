/*
 * Song Helper Arcade (hidden preview). Shared by the page (window.Arcade) and the server.
 * Three cards: Start From Scratch, Fix My Song, Flip My Song.
 * Rules: no em dashes, never name the music engine or distributor, no payout claims,
 * style prompts never name a real artist or song, no copied lyrics.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.Arcade = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  // ---------- Types for Start From Scratch ----------
  var TYPES = [
    { id: 'jam', label: 'My Own Jam', small: 'Your story, your song', sound: 'pop' },
    { id: 'tribute', label: 'Tribute Song', small: 'Special day, in memory, or a fan song', sub: ['occasion', 'memory', 'fan'] },
    { id: 'parody', label: 'Parody', small: 'Flip a famous song', sound: 'match' },
    { id: 'roast', label: 'Roast', small: 'Friends, yourself, or Battle the Bot', sub: ['friend', 'self', 'celeb', 'battle'] },
    { id: 'story', label: 'Storyteller', small: 'Diary or trip report to song', sub: ['diary', 'trip'] },
    { id: 'hype', label: 'Hype Anthem', small: 'Chant it loud' },
    { id: 'holiday', label: 'Holiday Hits', small: 'The holiday sets the sound' },
    { id: 'kids', label: 'Kids Song', small: 'Clean, catchy, and moves' },
  ];
  var SUBS = {
    occasion: 'Special Occasion', memory: 'In Memory Of', fan: 'Fan Song',
    friend: 'My friend', self: 'Myself', celeb: 'A celeb or public figure', battle: 'Battle the Bot',
    diary: 'Diary to song', trip: 'Trip report to song',
  };

  // Storyteller trip report: ways to tell it.
  var TRIP_DEVICES = ['Clock-time narrator', 'Dose-counter refrain', 'Call and response with a skeptic', 'Rebuild the night from evidence', 'Two genres as two realities'];

  // Questions per type (or sub). kind: chips | text | fields
  var QUESTIONS = {
    jam: [
      { key: 'topic', q: "What's it about?", kind: 'chips', options: ['Love', 'Heartbreak', 'Glow-up', 'Party', 'Real life'], other: true },
      { key: 'detail', q: 'Give me one real detail.', kind: 'text', ph: 'the car, the city, the thing they said' },
      { key: 'to', q: 'Who are you singing to?', kind: 'chips', options: ['Them', 'Me', 'Everybody'] },
    ],
    occasion: [
      { key: 'day', q: "What's the big day?", kind: 'chips', options: ['Birthday', 'Anniversary', 'Wedding', 'Graduation', 'Just because', 'Thank you'] },
      { key: 'name', q: 'Their name, and what you call them.', kind: 'fields', fields: [['name', 'Their name'], ['nick', 'What you call them']] },
      { key: 'memories', q: 'Give me 2 or 3 memories or inside jokes.', kind: 'text', ph: 'the road trip, the burnt pancakes, the dance move' },
      { key: 'feel', q: 'How should it feel?', kind: 'chips', options: ['Sweet', 'Funny', 'Both'] },
    ],
    memory: [
      { key: 'name', q: 'Who are we honoring?', kind: 'fields', fields: [['name', 'Their name']] },
      { key: 'rel', q: 'Who were they to you?', kind: 'chips', options: ['Mom', 'Dad', 'Grandparent', 'Friend', 'Partner', 'Pet', 'Other'] },
      { key: 'saying', q: "What's one thing they always said or did?", kind: 'text', ph: 'the thing you can still hear them say' },
      { key: 'memories', q: 'Pick 1 to 3 memories.', kind: 'text', ph: 'a place, a smell, a sound, a habit' },
      { key: 'feel', q: 'How should it feel?', kind: 'chips', options: ['Gentle', 'Celebrate their life', 'Both'] },
    ],
    fan: [
      { key: 'name', q: "Who's your fave?", kind: 'fields', fields: [['name', 'Artist, athlete, creator, or character']] },
      { key: 'love', q: 'What do you love about them?', kind: 'chips', options: ['Their music', 'Their story', 'How they make me feel', 'Their style'] },
      { key: 'moment', q: 'One moment that made you a fan.', kind: 'text', ph: 'where you were, what happened' },
    ],
    parody: [
      { key: 'original', q: 'What song are we flipping?', kind: 'fields', fields: [['song', 'Song title'], ['artist', 'Artist']], research: true },
      { key: 'angle', q: "What's the angle?", kind: 'chips', options: ['Poke at what the song says', 'Spoof how the song says it', 'Roast what the artist is known for'], other: true, fromResearch: true, otherPh: 'your angle on this song or artist' },
      { key: 'newTopic', q: "What's your new topic?", kind: 'text', ph: 'what the new words are about', prefillFrom: 'angle' },
    ],
    friend: [
      { key: 'name', q: 'Their name or nickname.', kind: 'fields', fields: [['name', 'Name or nickname']] },
      { key: 'facts', q: 'Give me 3 to 5 facts to roast.', kind: 'text', ph: 'always late, owns 40 sneakers, thinks he can sing' },
      { key: 'spice', q: 'How spicy?', kind: 'chips', options: ['Mild', 'Medium', 'Spicy'] },
      { key: 'love', q: 'End with love?', kind: 'chips', options: ['Yes, end with love', 'No, keep it roasting'] },
    ],
    self: [
      { key: 'facts', q: 'Give me 3 to 5 facts about you to roast.', kind: 'text', ph: 'snooze button champion, 47 open tabs' },
      { key: 'spice', q: 'How spicy?', kind: 'chips', options: ['Mild', 'Medium', 'Spicy'] },
    ],
    celeb: [
      { key: 'name', q: 'Who is it?', kind: 'fields', fields: [['name', 'Public figure']], research: true },
      { key: 'facts', q: 'Anything to add? Public stuff only.', kind: 'text', ph: 'optional: a moment or bit you want hit (no rumors)', fromResearch: true },
      { key: 'spice', q: 'How spicy?', kind: 'chips', options: ['Mild', 'Medium', 'Spicy'] },
    ],
    battle: [
      { key: 'facts', q: 'Step up. Give me 3 facts about you.', kind: 'text', ph: 'Plai only uses these as ammo' },
      { key: 'first', q: 'Round 1. Who goes first?', kind: 'chips', options: ['Me first', 'Plai first'] },
      { key: 'spice', q: 'How spicy?', kind: 'chips', options: ['Mild', 'Medium', 'Spicy'] },
    ],
    story: [
      { key: 'happened', q: 'What happened?', kind: 'text', ph: 'tell it like a text to your best friend', rows: 6 },
      { key: 'where', q: 'Where did it happen?', kind: 'text', ph: 'the place matters' },
      { key: 'ending', q: "What's the feeling at the end?", kind: 'chips', options: ['I learned', "I'm still mad", "I'm free", 'I miss it'], other: true },
    ],
    diary: [
      { key: 'happened', q: 'What happened?', kind: 'text', ph: 'tell it like a text to your best friend', rows: 6 },
      { key: 'where', q: 'Where did it happen?', kind: 'text', ph: 'the place matters' },
      { key: 'ending', q: "What's the feeling at the end?", kind: 'chips', options: ['I learned', "I'm still mad", "I'm free", 'I miss it'], other: true },
    ],
    trip: [
      { key: 'report', q: 'Paste the trip report.', kind: 'text', ph: 'the true story, yours or a report you are allowed to use', rows: 8 },
      { key: 'drug', q: 'What was taken, how much, and when?', kind: 'fields', fields: [['drug', 'What it was, plainly'], ['dose', 'How much'], ['timing', 'When, and when it hit']] },
      { key: 'expect', q: 'What did they expect to happen?', kind: 'text', ph: 'the plan, before it went sideways' },
      { key: 'device', q: 'Pick a way to tell it.', kind: 'chips', options: TRIP_DEVICES },
      { key: 'fusion', q: 'One genre, or two that cut back and forth?', kind: 'chips', options: ['One genre', 'Two genres, hard cuts'] },
      { key: 'genres', q: 'Two genres? Name them. Skip for one.', kind: 'fields', fields: [['genreA', 'Genre for the real world'], ['genreB', 'Genre for the trip']] },
      { key: 'verdict', q: 'What was the author\'s own verdict at the end?', kind: 'text', ph: 'in their words: worth it, never again, it changed me' },
    ],
    hype: [
      { key: 'for', q: 'Hype for what?', kind: 'chips', options: ['Game day', 'Workout', 'Big day', 'My team', 'My city', 'Me'] },
      { key: 'chant', q: 'Give me the name to chant.', kind: 'fields', fields: [['chant', 'Team, city, person, or crew']] },
      { key: 'move', q: 'Pick a crowd move.', kind: 'chips', options: ['Clap', 'Stomp', 'Call and response', 'Countdown'] },
    ],
    holiday: [
      { key: 'holiday', q: 'Which holiday?', kind: 'chips', options: ['Christmas', 'Halloween', "Valentine's", 'New Year', 'Thanksgiving', "Mother's or Father's Day", 'Hanukkah', 'Día de los Muertos'], other: true },
      { key: 'who', q: "Who's it for?", kind: 'chips', options: ['Everyone', 'My family', 'My partner', 'My kids', 'Just me'] },
      { key: 'twist', q: 'Classic or twist?', kind: 'chips', options: ['Classic', 'Funny twist', 'Sad and cozy'] },
    ],
    kids: [
      { key: 'age', q: 'How old are the listeners?', kind: 'chips', options: ['Tiny (0 to 2)', 'Little (3 to 5)', 'Big kid (6 to 8)', 'Tween (9 to 11)'] },
      { key: 'about', q: "What's it about?", kind: 'chips', options: ['Animals', 'Bedtime', 'Brush teeth and routines', 'Learning', 'Birthday', 'Feelings', 'Their name'] },
      { key: 'moves', q: 'Give it moves?', kind: 'chips', options: ['Clap', 'Jump', 'Dance', 'None (bedtime)'] },
    ],
  };

  function questionsFor(typeId, subId) { return QUESTIONS[subId || typeId] || []; }

  // ---------- Sound panel (shared by all cards, 0 credits) ----------
  var GENRES = {
    'Pop': ['Dance pop', 'Synth pop', 'Pop ballad', 'Bedroom pop', 'K-pop style'],
    'Hip hop': ['Trap', 'Boom bap', 'Drill', '808s', 'Lo-fi'],
    'R&B': ['Slow jam', 'Neo soul', 'Alt R&B', '90s R&B'],
    'Rock': ['Classic', 'Alt', 'Punk', 'Indie', 'Pop-punk'],
    'Country': ['Modern country', 'Outlaw', 'Country pop', 'Bluegrass'],
    'Electronic': ['House', 'EDM', 'Drum and bass', 'Synthwave'],
    'Latin': ['Reggaeton', 'Bachata', 'Cumbia', 'Mariachi'],
    'Gospel': ['Choir', 'Contemporary', 'Soul gospel'],
    'Acoustic': ['Folk', 'Singer-songwriter', 'Unplugged'],
    'Reggae': ['Roots', 'Dancehall', 'Lovers rock'],
    'Funk': ['Slap bass', 'Disco funk', 'Funk rock', 'Modern funk'],
    'Blues': ['Electric blues', 'Delta blues', 'Blues rock', 'Soul blues'],
    'Cali Reggae': ['Laid back', 'Reggae rock', 'Surf reggae', 'Beach groove'],
    'Kids': ['Lullaby', 'Bouncy kids pop', 'Sing-along'],
  };
  var INSTRUMENTS = ['Trumpet', 'Choir', 'Strings', 'Guitar solo', 'Piano', 'Sax', '808s', 'Synths', 'Sleigh bells', 'Ukulele', 'Organ', 'Hand claps'];
  var VOCALS = ['Female vocal', 'Male vocal', 'Duet', 'Kid choir', 'Group vocals'];
  var VIBES = ['Happy', 'Hype', 'Chill', 'Sad', 'Funny', 'Love', 'Dark'];
  var AI_LEVELS = [
    { id: 'human', label: 'Me, all me', small: 'Human. Syllables and rhymes only.' },
    { id: 'assist', label: 'Me + Plai', small: 'AI-assisted. Plai suggests, you pick.' },
    { id: 'full', label: 'All Plai', small: 'Full AI. Plai writes it.' },
  ];
  var OFF_CHIPS = ['Too wordy', 'Rhymes feel forced', 'Chorus is weak', 'Lines feel off-beat', 'Too generic', 'Story is unclear', 'Ending falls flat'];
  var FLIP_VIBES = {
    funny: { label: 'Make it funny', levels: ['Light', 'Silly', 'Unhinged'] },
    dirty: { label: 'Make it dirty', levels: ['Flirty', 'Spicy', 'Filthy'] },
    sad: { label: 'Make it sad' },
    hype: { label: 'Make it hype' },
    surprise: { label: 'Surprise me' },
  };

  var DEFAULT_SOUND = {
    jam: { genre: 'Pop', bpm: 105, inst: 'bright synths, punchy drums', vocal: 'warm vocal' },
    occasion: { genre: 'Pop', bpm: 112, inst: 'claps, acoustic guitar', vocal: 'group vocal' },
    memory: { genre: 'Acoustic', bpm: 72, inst: 'soft piano, light strings', vocal: 'warm intimate vocal' },
    fan: { genre: 'Pop', bpm: 100, inst: 'piano, punchy drums', vocal: 'heartfelt vocal' },
    parody: { genre: 'Pop', bpm: 110, inst: 'tight drums, bright synths', vocal: 'playful vocal' },
    friend: { genre: 'Hip hop', sub: 'Boom bap', bpm: 90, inst: 'punchy drums, vinyl crackle', vocal: 'confident playful rap vocal' },
    self: { genre: 'Hip hop', sub: 'Boom bap', bpm: 90, inst: 'punchy drums, vinyl crackle', vocal: 'confident playful rap vocal' },
    celeb: { genre: 'Hip hop', sub: 'Boom bap', bpm: 90, inst: 'punchy drums, vinyl crackle', vocal: 'confident playful rap vocal' },
    battle: { genre: 'Hip hop', sub: 'Boom bap', bpm: 92, inst: 'sparse drums, vinyl crackle', vocal: 'two contrasting rap vocals' },
    story: { genre: 'Country', bpm: 96, inst: 'acoustic guitar, brushed drums', vocal: 'storytelling vocal' },
    diary: { genre: 'Country', bpm: 96, inst: 'acoustic guitar, brushed drums', vocal: 'storytelling vocal' },
    trip: { genre: 'Hip hop', bpm: 96, inst: 'hard drums, deep bass, melodic synth hook', vocal: 'clear storytelling vocal' },
    hype: { genre: 'Rock', bpm: 120, inst: 'stomp-clap drums, big drums', vocal: 'gang vocals' },
    kids: { genre: 'Kids', sub: 'Bouncy kids pop', bpm: 110, inst: 'ukulele, xylophone, claps', vocal: 'bright vocal, simple singable melody, small range' },
  };
  var HOLIDAY_SOUND = {
    'Christmas': { genre: 'Pop', bpm: 115, inst: 'sleigh bells, glockenspiel, choir, swing feel', vocal: 'warm crooner vocal', key: 'major key' },
    'Halloween': { genre: 'Rock', bpm: 110, inst: 'pipe organ, staccato strings, whispers, march feel', vocal: 'spooky playful vocal', key: 'minor key' },
    "Valentine's": { genre: 'R&B', sub: 'Slow jam', bpm: 70, inst: 'Rhodes, soft drums', vocal: 'soft vocal' },
    'New Year': { genre: 'Pop', sub: 'Dance pop', bpm: 124, inst: 'synths, countdown chant', vocal: 'party vocal' },
    'Thanksgiving': { genre: 'Acoustic', sub: 'Folk', bpm: 90, inst: 'acoustic guitar, family singalong', vocal: 'warm vocal' },
    "Mother's or Father's Day": { genre: 'R&B', sub: 'Neo soul', bpm: 80, inst: 'acoustic guitar, soft keys', vocal: 'tender vocal' },
    'Hanukkah': { genre: 'Acoustic', sub: 'Folk', bpm: 110, inst: 'clarinet, hand claps', vocal: 'bright vocal' },
    'Día de los Muertos': { genre: 'Latin', sub: 'Mariachi', bpm: 100, inst: 'trumpets, guitarrón, violins', vocal: 'warm celebratory vocal' },
  };
  var JAM_TOPIC_SOUND = {
    'Love': { genre: 'R&B', bpm: 75, inst: 'soft keys', vocal: 'warm vocal' },
    'Heartbreak': { genre: 'Pop', sub: 'Pop ballad', bpm: 80, inst: 'piano', vocal: 'breathy vocal', key: 'minor key' },
    'Party': { genre: 'Pop', sub: 'Dance pop', bpm: 120, inst: 'synth, claps', vocal: 'bright vocal' },
    'Glow-up': { genre: 'Hip hop', bpm: 92, inst: '808s', vocal: 'confident vocal' },
  };
  var STORY_SOUND = {
    'I learned': { genre: 'Country', bpm: 96, inst: 'acoustic guitar', vocal: 'storytelling vocal' },
    "I'm still mad": { genre: 'Rock', sub: 'Alt', bpm: 120, inst: 'driving guitars', vocal: 'gritty vocal' },
    "I'm free": { genre: 'Rock', sub: 'Indie', bpm: 115, inst: 'jangly guitars', vocal: 'open vocal' },
    'I miss it': { genre: 'Acoustic', sub: 'Folk', bpm: 78, inst: 'piano', vocal: 'soft vocal' },
  };
  var KIDS_AGE = {
    'Tiny (0 to 2)': { genre: 'Kids', sub: 'Lullaby', bpm: 65, inst: 'soft celesta', vocal: 'soft female vocal' },
    'Big kid (6 to 8)': { genre: 'Kids', sub: 'Sing-along', bpm: 120, inst: 'guitar, drums', vocal: 'group kid vocals' },
    'Tween (9 to 11)': { genre: 'Pop', bpm: 100, inst: 'synths, light beat', vocal: 'bright vocal' },
  };

  function clone(o) { return JSON.parse(JSON.stringify(o || {})); }

  // Base sound from the type answers. The sound panel overrides on top.
  function baseSound(s) {
    var key = s.sub || s.type;
    var a = s.answers || {};
    var base = clone(DEFAULT_SOUND[key] || DEFAULT_SOUND.jam);
    if (s.type === 'holiday') base = clone(HOLIDAY_SOUND[a.holiday] || HOLIDAY_SOUND.Christmas);
    if (s.type === 'jam' && JAM_TOPIC_SOUND[a.topic]) base = clone(JAM_TOPIC_SOUND[a.topic]);
    if (s.type === 'story' && s.sub !== 'trip' && STORY_SOUND[a.ending]) base = clone(STORY_SOUND[a.ending]);
    if (s.type === 'kids') {
      if (KIDS_AGE[a.age]) base = clone(KIDS_AGE[a.age]);
      if (a.about === 'Bedtime') { base.bpm = 66; base.sub = 'Lullaby'; base.inst = 'soft celesta, soft strings'; }
      base.vocal = (base.vocal || '') + ', simple singable melody, small range';
    }
    if ((s.sub === 'friend' || s.sub === 'self' || s.sub === 'celeb' || s.sub === 'battle') && (a.spice === 'Medium' || a.spice === 'Spicy')) { base.sub = 'Trap'; base.bpm = 140; base.inst = 'booming 808s, sparse hats'; }
    if (s.sub === 'memory' && a.feel === 'Celebrate their life') { base.genre = 'R&B'; base.sub = 'Neo soul'; base.bpm = 90; }
    if ((s.type === 'parody' || s.sub === 'celeb') && s.research && s.research.sound && !s.styleOverride) base = clone(s.research.sound);
    return base;
  }

  // Strip any name the user typed (fave, roast target, original artist/song) from a style prompt.
  function stripNames(text, names) {
    var out = String(text || '');
    (names || []).forEach(function (n) {
      String(n || '').split(/\s+/).concat([n]).forEach(function (w) {
        w = String(w || '').trim();
        if (w.length < 3) return;
        out = out.replace(new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'ig'), '');
      });
    });
    return out.replace(/\s*,\s*(,\s*)+/g, ', ').replace(/\s{2,}/g, ' ').replace(/^[,\s]+|[,\s]+$/g, '');
  }

  function namesIn(s) {
    var a = s.answers || {};
    return [a.name, a.nick, a.song, a.artist, a.chant].filter(Boolean);
  }

  // style: [genre], [feel], [tempo] BPM, [key], [instruments], [vocal], [mood]. Max ~200 chars.
  // Real starting points when a target genre is picked (Flip, sound panel).
  var GENRE_KIT = {
    'Pop': { sub: 'Dance pop', era: 'modern', bpm: 122, texture: 'glassy plucked synths, bass that ducks under the vocal', inst: 'plucked synths, claps, rubbery bass', production: 'bright condenser vocal, bus compression that pumps, short plate reverb, vocal dead center', arrangement: 'hook in the first 20 seconds, melody leaps up on the hook', kick: 'syncopated kick with ghost notes', vocal: 'bright lead vocal, stacked harmonies' },
    'Hip hop': { sub: 'Boom bap', era: '90s', bpm: 88, texture: 'dusty sampled drum break, swung sixteenth-note hats, vinyl crackle', inst: 'chopped soul loop, upright bass sample, scratches', production: 'SP-1200 grit, punchy compressed drums, dry vocal up front, short room reverb', arrangement: 'no chorus, scratched hook between verses', kick: 'kick off the grid, lazy swing', vocal: 'rap flow that lands behind the beat' },
    'R&B': { sub: 'Neo soul', era: 'late 90s', bpm: 76, texture: 'warm Rhodes chords with tape wobble, brushed snare', inst: 'Rhodes, round bass, brushed snare', production: 'tube preamp warmth, soft opto compression, long hall reverb tail on vocal stacks', arrangement: 'loose groove, melody bends into blue notes, ad lib outro', kick: 'laid back kick, dragged behind the beat', vocal: 'silky falsetto, behind the beat phrasing' },
    'Rock': { sub: 'Garage rock', era: '2000s', bpm: 148, texture: 'fuzzed guitars through a cranked amp, trashy cymbals', inst: 'electric guitars, live drums, driving bass', production: 'room mics up loud, tape saturation on the drum bus, short slapback on the vocal', arrangement: 'quiet verse, loud chorus, abrupt ending', kick: 'straight driving kick', vocal: 'gritty shouted vocal' },
    'Country': { sub: 'Modern country', era: '2010s', bpm: 98, texture: 'twangy telecaster, pedal steel swells, banjo roll', inst: 'acoustic guitar, pedal steel, banjo, fiddle', production: 'clean ribbon mic vocal, gentle compression, spring reverb on steel', arrangement: 'story verses, singalong chorus, fiddle solo bridge', kick: 'train beat shuffle', vocal: 'warm drawl, storytelling delivery' },
    'Electronic': { sub: 'UK garage', era: 'late 90s', bpm: 134, texture: 'chopped vocal samples, shuffled 2-step hats, warm reese bass', inst: 'organ stabs, sub bass, chopped vocal', production: 'sidechain on the bass, short gated reverb, sub-bass felt under 60 Hz', arrangement: 'build and switch up, vocal chop as the hook', kick: 'syncopated 2-step kick, off the downbeat', vocal: 'chopped vocal hooks' },
    'Latin': { sub: 'Reggaeton', era: 'modern', bpm: 94, texture: 'dembow snare pattern, nylon guitar plucks', inst: 'dembow drums, deep bass, nylon guitar', production: 'tight compressed vocal, reverb snaps, wide percussion', arrangement: 'call and response hook, perreo breakdown', kick: 'dembow kick and snare pattern', vocal: 'smooth sing-rap, call outs' },
    'Gospel': { sub: 'Contemporary gospel', era: 'modern', bpm: 72, texture: 'Hammond organ with Leslie swirl, choir swells', inst: 'Hammond, choir, live drums, piano', production: 'big church hall reverb, choir panned wide, lead up front', arrangement: 'vamp section, key change lift, call and response with the choir', kick: 'live kick, half time feel', vocal: 'powerful lead with choir answers' },
    'Acoustic': { sub: 'Singer songwriter', era: 'timeless', bpm: 68, texture: 'fingerpicked guitar with string squeaks left in', inst: 'fingerpicked guitar, soft piano, cello', production: 'close ribbon mic, no compression feel, small room reverb, vocal intimate and dry', arrangement: 'no drums until the last chorus, melody stays low then lifts', kick: 'no kick', vocal: 'intimate breathy vocal' },
    'Reggae': { sub: 'Roots reggae', era: '70s', bpm: 74, texture: 'off-beat skank guitar, organ bubble, deep dub bass', inst: 'skank guitar, dub bass, one drop drums, organ', production: 'spring reverb, tape echo throws, bass loud and round', arrangement: 'dub breakdown with echo throws', kick: 'one drop kick on beat three', vocal: 'laid back melodic vocal' },
    'Funk': { sub: 'Modern funk', era: '70s', bpm: 104, texture: 'syncopated guitar scratch, clavinet stabs, slap bass pops', inst: 'slap bass, clavinet, horn stabs, wah guitar', production: 'dry punchy drums, bass up front, short room on the horns', arrangement: 'groove locks in early, horn hits on the hook, bass break before the last chorus', kick: 'syncopated funk kick on the one, ghost snares', vocal: 'rhythmic sung vocal, call and response' },
    'Blues': { sub: 'Electric blues', era: '60s', bpm: 78, texture: 'bent electric guitar, walking bass, slow shuffle drums', inst: 'electric guitar, walking bass, harmonica, shuffle drums', production: 'amp grit, close vocal, small club room reverb', arrangement: 'twelve bar form, guitar solo in the middle, turnaround into the last chorus', kick: 'shuffle kick, behind the beat', vocal: 'gritty storytelling vocal' },
    'Cali Reggae': { sub: 'Reggae rock', era: 'modern', bpm: 88, texture: 'offbeat skank guitar, surf-tinged electric guitar, easy rock drums, warm round bass', inst: 'skank guitar, surf electric guitar, easy drums, round bass', production: 'sunlit room reverb, relaxed compression, guitars wide, vocal close and dry', arrangement: 'easy intro groove, singalong chorus, laid back guitar break', kick: 'relaxed rock kick with reggae offbeats', vocal: 'laid back sung vocal, sunny and conversational', key: 'major key' },
    'Kids': { sub: 'Kids pop', era: 'modern', bpm: 112, texture: 'ukulele strums, glockenspiel sparkles, handclaps', inst: 'ukulele, glockenspiel, handclaps', production: 'bright, clean, close vocals', arrangement: 'call and response, chorus returns three times', kick: 'simple bouncy kick', vocal: 'cheerful group vocal' }
  };
  // Unusual techniques seeded per song, so prompts do not collapse into pop defaults.
  var SEEDS = ['shoegaze reverb tails on the backing vocals', 'breakbeat drums chopped under the verse', 'tape stop before the hook', 'celesta countermelody', 'reverse reverb swells into each section', 'field recording texture under the intro', 'low harmony doubling the lead', 'tape saturated percussion in the bridge', 'choir pad sampled and stretched', 'drum machine and live kit trading bars'];

  // Each vibe reshapes the whole sound, not one word.
  var VIBE_SHAPE = {
    'funny-Light': { bpm: 4, inst: 'kazoo accents, pizzicato strings', vocal: 'wry deadpan delivery', arr: 'playful stop time breaks', mood: 'tongue in cheek' },
    'funny-Silly': { bpm: 10, inst: 'slide whistle, tuba bass, cartoon boings', vocal: 'goofy character voice, exaggerated', arr: 'sudden tempo changes for gags', mood: 'silly and bouncy', key: 'major key' },
    'funny-Unhinged': { bpm: 22, inst: 'distorted kazoo, airhorns, chaotic drum fills', vocal: 'manic shouted delivery, ad lib chaos', arr: 'genre whiplash mid song, false endings', mood: 'unhinged comedy energy' },
    'dirty-Flirty': { bpm: -8, inst: 'muted guitar, finger snaps, soft synth pad', vocal: 'breathy teasing whisper vocal', arr: 'slow build, sparse verses', mood: 'flirty and coy' },
    'dirty-Spicy': { bpm: -14, inst: 'slinky bass, sax licks, slow 808', vocal: 'sultry low register, wink in the voice', arr: 'half time chorus, sensual groove', mood: 'sultry and cheeky', key: 'minor key' },
    'dirty-Filthy': { bpm: 6, inst: 'heavy club 808s, wobbly synth bass, moan-like synth leads', vocal: 'raunchy chant hook, cheeky spoken asides', arr: 'twerk breakdown, club drop', mood: 'raunchy club energy' },
    'sad': { bpm: -26, inst: 'solo piano, swelling strings, distant reverb guitar', vocal: 'aching fragile vocal, cracks on the high notes', arr: 'stripped verses, lonely bridge', mood: 'melancholy', key: 'minor key' },
    'hype': { bpm: 18, inst: 'stadium drums, distorted 808s, brass stabs', vocal: 'shouted chant hook, crowd gang vocals', arr: 'big build, double time drop', mood: 'high energy anthem', key: 'major key' },
    'Happy': { bpm: 6, inst: 'handclaps, bright synth', vocal: 'smiling vocal', mood: 'joyful' },
    'Hype': { bpm: 16, inst: 'stadium drums, brass stabs', vocal: 'chant hook, gang vocals', arr: 'big drop', mood: 'anthemic', key: 'major key' },
    'Chill': { bpm: -14, inst: 'lo-fi keys, soft drums', vocal: 'relaxed low vocal', arr: 'loose groove', mood: 'laid back' },
    'Sad': { bpm: -22, inst: 'piano, strings', vocal: 'tender fragile vocal', arr: 'stripped back', mood: 'melancholy', key: 'minor key' },
    'Funny': { bpm: 8, inst: 'comedic horn stabs, bouncy bass', vocal: 'cheeky comic timing', arr: 'punchline pauses', mood: 'playful' },
    'Love': { bpm: -6, inst: 'warm Rhodes, soft strings', vocal: 'tender romantic vocal', mood: 'romantic', key: 'major key' },
    'Dark': { bpm: -6, inst: 'low drones, eerie bells', vocal: 'menacing half whisper', arr: 'tense build', mood: 'brooding', key: 'minor key' },
    'roast-Medium': { bpm: 4, inst: 'hard snare, taunting synth riff', vocal: 'cocky battle rap delivery', arr: 'beat drops out for punchlines', mood: 'savage' },
    'roast-Spicy': { bpm: 10, inst: 'distorted 808s, air raid siren, menacing piano', vocal: 'aggressive diss track delivery, crowd oohs', arr: 'beat cuts on every punchline, rewind effect', mood: 'ruthless roast energy', key: 'minor key' }
  };
  var SURPRISE = [
    { inst: 'mariachi trumpets', vocal: 'operatic flourish', arr: 'polka breakdown in the bridge', mood: 'absurd twist' },
    { inst: 'steel drums, marimba', vocal: 'bright call and response vocal', arr: 'island breakdown in the bridge', mood: 'sunny twist', bpm: 6 },
    { inst: 'barbershop quartet, upright bass', vocal: 'four part harmony', arr: 'a cappella intro', mood: 'old timey twist', bpm: -10 },
    { inst: 'sitar, tabla, synth bass', vocal: 'dreamy chant', arr: 'psychedelic breakdown', mood: 'trippy twist' }
  ];
  function vibeKey(s) {
    var f = s.flip || {};
    if (s.card === 'flip' && f.vibe) return f.vibe === 'surprise' ? 'surprise' : (f.level ? f.vibe + '-' + f.level : (f.vibe === 'funny' ? 'funny-Silly' : (f.vibe === 'dirty' ? 'dirty-Flirty' : f.vibe)));
    var a = s.answers || {};
    return s.vibe || '';
  }
  function hashStr(t) { var h = 0; String(t || '').split('').forEach(function (c) { h = (h * 31 + c.charCodeAt(0)) >>> 0; }); return h; }
  function vibeShape(s) {
    var k = vibeKey(s);
    if (k === 'surprise') { var a = s.answers || {}; return SURPRISE[hashStr((a.song || '') + (a.name || '') + (s.title || '') + ((s.flip && s.flip.text) || '').slice(0, 40)) % SURPRISE.length]; }
    var main = VIBE_SHAPE[k] || null;
    // Roast: the spice level layers on top of the picked vibe, so both chips change the sound.
    var a2 = s.answers || {};
    if (s.type === 'roast' && s.card !== 'flip' && (a2.spice === 'Spicy' || a2.spice === 'Medium')) {
      var spice = VIBE_SHAPE['roast-' + a2.spice];
      var mood = VIBE_SHAPE[s.vibe] || {};
      main = {
        bpm: (Number(spice.bpm) || 0) + (Number(mood.bpm) || 0),
        inst: [mood.inst, spice.inst].filter(Boolean).join(', '),
        vocal: [mood.vocal, spice.vocal].filter(Boolean).join(', '),
        arr: [mood.arr, spice.arr].filter(Boolean).join(', '),
        mood: [mood.mood, spice.mood].filter(Boolean).join(', '),
        key: mood.key || spice.key
      };
    }
    return main;
  }


  // Optional Fine-tune panel. Words, not numbers, unless the user types a BPM.
  var TUNE = {
    speed: ['Slow', 'Mid', 'Upbeat', 'Fast'],
    vocals: ['Solo', 'Duet', 'Band with backing vocals', 'Choir'],
    gender: ['Male', 'Female', 'Surprise me'],
    shape: {
      range: ['Low', 'Mid', 'High', 'Baritone', 'Tenor', 'Alto', 'Soprano'],
      texture: ['Raspy', 'Smooth', 'Airy', 'Breathy', 'Gritty', 'Nasal', 'Husky', 'Crystal clear'],
      delivery: ['Belted', 'Whispered', 'Crooned', 'Rapped', 'Spoken word', 'Talk-sung', 'Falsetto'],
      age: ['Young bright', 'Mature weathered'],
      flavor: ['Southern drawl', 'UK', 'Caribbean', 'Latin', 'Gospel church'],
      emotion: ['Vulnerable', 'Cocky', 'Playful', 'Aching', 'Fierce'],
      effects: ['Dry close-mic', 'Big reverb', 'Auto-tune', 'Lo-fi phone', 'Doubled'],
      arrangement: ['Solo', 'Duet', 'Call and response', 'Choir', 'Gang vocals']
    },
    tone: ['Raspy', 'Smooth', 'Airy'],
    must: ['Piano', 'Acoustic guitar', 'Electric guitar', '808s', 'Strings', 'Horns', 'Synths', 'Live drums', 'Bass guitar', 'Organ'],
    energy: ['Steady', 'Slow build', 'Big drop', 'Quiet to loud']
  };
  var SHAPE_LABEL = { range: 'Range', texture: 'Texture', delivery: 'Delivery', age: 'Age feel', flavor: 'Flavor', emotion: 'Emotion', effects: 'Effects', arrangement: 'Arrangement' };
  var VOICE_DEFAULT = {
    Happy: [['bright', 'airy', 'smooth'], ['tenor', 'alto', 'mid'], ['playful', 'grinning', 'bouncy']],
    Hype: [['gritty', 'raspy', 'punchy'], ['baritone', 'tenor', 'low'], ['cocky', 'fierce', 'shouted']],
    Chill: [['breathy', 'smooth', 'husky'], ['low', 'alto', 'mid'], ['laid back', 'crooned', 'hazy']],
    Sad: [['breathy', 'fragile', 'husky'], ['alto', 'tenor', 'low'], ['aching', 'vulnerable', 'hushed']],
    Funny: [['nasal', 'bright', 'cartoonish'], ['high', 'tenor', 'mid'], ['cheeky', 'playful', 'deadpan']],
    Love: [['silky', 'smooth', 'warm'], ['tenor', 'alto', 'mid'], ['tender', 'crooned', 'intimate']],
    Dark: [['gritty', 'husky', 'smoky'], ['baritone', 'low', 'alto'], ['menacing', 'whispered', 'cold']]
  };
  // Compact voice descriptor (60 chars max). Picks win; Surprise me fills every row; nothing picked still varies by vibe and seed.
  function voiceDescriptor(s, t) {
    t = t || {}; var vs = t.voiceShape || {}; var SH = TUNE.shape;
    var gender = t.gender === 'Male' || t.gender === 'Female' ? t.gender.toLowerCase() : '';
    var picks = {};
    Object.keys(SH).forEach(function (k) { if (vs[k] && SH[k].indexOf(vs[k]) !== -1) picks[k] = vs[k].toLowerCase(); });
    if (t.tone && !picks.texture) picks.texture = String(t.tone).toLowerCase();
    var seed = Math.abs(Number(t.surprise) || hashStr((s.type || '') + (s.sub || '') + (s.vibe || '') + (s.title || '') + JSON.stringify(s.answers || {}))) >>> 0;
    if (t.gender === 'Surprise me') {
      gender = gender || (seed % 2 ? 'female' : 'male');
      ['range', 'texture', 'delivery', 'emotion', 'flavor', 'effects'].forEach(function (k, i) { if (!picks[k]) picks[k] = SH[k][(seed >>> (i * 3)) % SH[k].length].toLowerCase(); });
    }
    var any = gender || Object.keys(picks).length;
    if (!any) {
      var fv = s.card === 'flip' && s.flip && s.flip.vibe ? String(s.flip.vibe).replace(/^\w/, function (c) { return c.toUpperCase(); }) : '';
      var d = VOICE_DEFAULT[fv] || VOICE_DEFAULT[s.vibe] || VOICE_DEFAULT.Chill;
      return d[0][seed % 3] + ' ' + d[1][(seed >>> 2) % 3] + ' voice, ' + d[2][(seed >>> 4) % 3];
    }
    var order = ['range', 'texture', 'delivery', 'emotion', 'flavor', 'age', 'effects', 'arrangement'];
    var core = [picks.texture, picks.range, gender].filter(Boolean).join(' ') + ' voice';
    var rest = order.filter(function (k) { return k !== 'texture' && k !== 'range' && picks[k]; }).map(function (k) { return picks[k]; });
    var out = core;
    rest.forEach(function (r) { if ((out + ', ' + r).length <= 60) out += ', ' + r; });
    return out.slice(0, 60);
  }
  function tuneBits(t, names) {
    t = t || {};
    var bpm = Number(t.bpm); bpm = bpm >= 40 && bpm <= 220 ? Math.round(bpm) : 0;
    var extra = stripNames(String(t.extra || ''), names).replace(/https?:\/\/\S+/g, '').replace(/[<>{}\[\]]/g, '').replace(/\u2014|\u2013/g, ', ').replace(/\bsuno\b|\btonegrid\b/ig, '').replace(/\s+/g, ' ').trim().slice(0, 120);
    var voice = [t.tone, t.gender && t.gender !== 'Any' ? t.gender : ''].filter(Boolean).join(' ').toLowerCase();
    return {
      bpm: bpm,
      speed: { Slow: 'slow tempo', Mid: 'mid tempo', Upbeat: 'upbeat tempo', Fast: 'fast tempo' }[t.speed] || '',
      vocals: { Solo: 'solo lead vocal', Duet: 'duet, two voices trading lines', 'Band with backing vocals': 'full band with backing vocals', Choir: 'choir vocals' }[t.vocals] || '',
      voice: voice ? voice + ' voice' : '',
      energy: { Steady: 'steady energy throughout', 'Slow build': 'slow build to a big final chorus', 'Big drop': 'big drop after the build', 'Quiet to loud': 'starts quiet, ends loud' }[t.energy] || '',
      extra: extra
    };
  }

  // Each vibe swaps the texture, groove and mix chain, not just a mood word.
  var VIBE_PROD = {
    Happy: { texture: 'sparkly plucked synths, bright ukulele strums', kick: 'bouncy syncopated kick with offbeat claps', production: 'sidechain pump on the chords, crisp transient snap, wide stereo shakers', groove: 'skipping swung groove', fast: true },
    Hype: { texture: 'distorted 808 stabs, siren synth risers', kick: 'pounding half-time kick into double-time drops', production: 'hard clipped master bus, gang vocal stacks panned wide, white noise sweeps', groove: 'stomping festival groove', fast: true },
    Chill: { texture: 'dusty Rhodes chords, vinyl crackle, muted guitar', kick: 'lazy behind-the-beat kick, brushed snare', production: 'tape wobble, low-pass filtered drums, soft room reverb', groove: 'laid back head-nod groove', fast: false },
    Sad: { texture: 'felt piano with pedal noise, bowed cello swells', kick: 'sparse heartbeat kick, no hats', production: 'long hall reverb, close breathy vocal mic, gentle tape hiss', groove: 'slow rubato sway', fast: false },
    Funny: { texture: 'boinging slide whistle, tuba bass, kazoo hook', kick: 'oompah bounce kick with snare rolls', production: 'cartoon foley hits, dry upfront vocal, sudden stops for punchlines', groove: 'bouncy polka shuffle', fast: true },
    Love: { texture: 'warm nylon guitar, soft string pads, glassy keys', kick: 'gentle syncopated kick with rimshot', production: 'velvet compression, intimate double-tracked vocal, slow chorus on keys', groove: 'swaying slow jam groove', fast: false },
    Dark: { texture: 'detuned drones, creaking metallic hits, low choir', kick: 'half-time trap kick with sliding sub', production: 'gritty tape saturation, reversed reverb tails, sub-bass felt under 60 Hz', groove: 'menacing half-time crawl', fast: true }
  };
  // ---------- Fusion (Flip: mix two) ----------
  // Built from both genres' kits, genre first, one vocal line up front, 120 to 200 chars.
  // The Arcade theme is the UI only. It never adds sound words.
  var FUSION_KIT = {
    'Pop': { name: 'pop', drums: 'punchy pop drums', inst: ['bright piano', 'rubbery bass'], delivery: 'sung pop hook', range: { male: 'tenor', female: 'mezzo' } },
    'Hip hop': { name: 'hip-hop', drums: 'boom bap drums', inst: ['chopped soul sample', 'vinyl crackle'], delivery: 'melodic rap verses', range: { male: 'baritone', female: 'alto' } },
    'R&B': { name: 'R&B', drums: 'laid back neo soul drums', inst: ['warm Rhodes', 'round bass'], delivery: 'smooth sung hook', range: { male: 'tenor', female: 'alto' } },
    'Rock': { name: 'rock', drums: 'live rock drums', inst: ['fuzzed electric guitar', 'driving bass'], delivery: 'gritty sung hook', range: { male: 'tenor', female: 'mezzo' } },
    'Country': { name: 'country', drums: 'train beat drums', inst: ['twangy telecaster', 'pedal steel'], delivery: 'storytelling sung verses', range: { male: 'baritone', female: 'alto' } },
    'Electronic': { name: 'electronic', drums: 'shuffled 2-step drums', inst: ['warm reese bass', 'organ stabs'], delivery: 'sung hook', range: { male: 'tenor', female: 'mezzo' } },
    'Latin': { name: 'Latin', drums: 'dembow drums', inst: ['nylon guitar', 'deep bass'], delivery: 'sing-rap verses', range: { male: 'tenor', female: 'mezzo' } },
    'Gospel': { name: 'gospel', drums: 'live church drums', inst: ['Hammond organ', 'choir swells'], delivery: 'soulful sung hook', range: { male: 'tenor', female: 'alto' } },
    'Acoustic': { name: 'acoustic', drums: 'brushed drums', inst: ['fingerpicked guitar', 'cello'], delivery: 'intimate sung verses', range: { male: 'baritone', female: 'alto' } },
    'Reggae': { name: 'reggae', drums: 'one drop drums', inst: ['offbeat skank guitar', 'deep dub bass', 'organ bubble'], delivery: 'sung reggae hook', range: { male: 'baritone', female: 'alto' } },
    'Funk': { name: 'funk', drums: 'syncopated funk drums', inst: ['slap bass', 'clavinet', 'horn stabs'], delivery: 'rhythmic sung hook', range: { male: 'tenor', female: 'mezzo' } },
    'Blues': { name: 'blues', drums: 'shuffle drums', inst: ['walking bass', 'bent electric guitar', 'harmonica'], delivery: 'gritty sung verses', range: { male: 'baritone', female: 'alto' } },
    'Cali Reggae': { name: 'Cali reggae', drums: 'laid back rock drums', inst: ['skank guitar', 'surf electric guitar', 'round bass'], delivery: 'sunny sung hook', range: { male: 'baritone', female: 'mezzo' } },
    'Kids': { name: 'kids pop', drums: 'bouncy drums', inst: ['ukulele', 'glockenspiel'], delivery: 'cheerful sung hook', range: { male: 'tenor', female: 'mezzo' } }
  };
  // Hand-written pairings, tested by ear and by the balance check. Rhythm genre leads (drums + delivery first),
  // because early words weigh most. Each genre gets about the same number of words.
  var FUSION_PAIRS = {
    'Hip hop|Reggae': { genre: 'Hip-hop reggae fusion', lead: 'Hip hop', verse: 'rap verses', hook: 'sung reggae hook', drums: 'hard boom bap drums', a: ['808 bass', 'chopped soul sample'], b: ['offbeat skank guitar', 'deep dub bass'], bpm: 90, words: { 'Hip hop': ['rap', 'boom bap', '808', 'chopped soul sample', 'hip-hop'], 'Reggae': ['reggae', 'skank', 'dub bass', 'one drop', 'organ bubble'] } },
    'Country|Hip hop': { genre: 'Country hip-hop fusion', lead: 'Hip hop', verse: 'rap verses', hook: 'sung country chorus', drums: 'trap drums', a: ['808 bass', 'rolling hi-hats'], b: ['twangy telecaster', 'banjo roll'], bpm: 96, words: { 'Hip hop': ['rap', 'trap', '808', 'hi-hats', 'hip-hop'], 'Country': ['country', 'telecaster', 'banjo', 'pedal steel'] } },
    'Latin|R&B': { genre: 'R&B Latin fusion', lead: 'Latin', verse: 'sing-rap verses', hook: 'silky R&B hook', drums: 'dembow drums', a: ['nylon guitar', 'congas'], b: ['warm Rhodes', 'round bass'], bpm: 92, words: { 'Latin': ['latin', 'sing-rap', 'dembow', 'nylon guitar', 'congas'], 'R&B': ['r&b', 'silky', 'rhodes', 'round bass'] } }
  };
  function fusionPair(g) { return FUSION_PAIRS[g.slice().sort().join('|')] || null; }
  var FUSION_MOOD = { funny: 'playful', dirty: 'flirty', sad: 'melancholy', hype: 'high energy', surprise: 'sunny' };
  function fusionStyle(s, p) {
    p = p || {};
    var g = (p.fusion || []).slice(0, 2);
    var k1 = FUSION_KIT[g[0]] || FUSION_KIT.Pop, k2 = FUSION_KIT[g[1]] || FUSION_KIT.Pop;
    var t = p.tune || {}; var vs = t.voiceShape || {};
    var seed = hashStr(String(s.title || '') + JSON.stringify(s.answers || {}) + g.join('+'));
    var gender = t.gender === 'Male' || t.gender === 'Female' ? t.gender.toLowerCase() : (/female/i.test(p.vocal || '') ? 'female' : (/male/i.test(p.vocal || '') ? 'male' : (seed % 2 ? 'female' : 'male')));
    var texture = String(vs.texture || t.tone || ['warm', 'smooth', 'raspy'][seed % 3]).toLowerCase();
    var range = String(vs.range || k1.range[gender]).toLowerCase();
    var pair = fusionPair(g);
    var verse = /rap/.test(k1.delivery) ? k1.delivery : (/rap/.test(k2.delivery) ? k2.delivery : k1.delivery);
    var hook = verse === k1.delivery ? k2.delivery : k1.delivery;
    if (hook === verse) hook = 'sung hook';
    hook = hook.replace(/ verses$/, ' chorus');
    var genre = (k1.name + ' ' + k2.name + ' fusion').replace(/^\w/, function (c) { return c.toUpperCase(); });
    var voice = texture + ' ' + range + ' ' + gender + ' vocal with ' + verse + ' and ' + hook;
    var must = t.must && t.must.length ? t.must.slice(0, 2).map(function (x) { return String(x).toLowerCase(); }) : [];
    var picked = p.instruments && p.instruments.length ? p.instruments.slice(0, 2).map(function (x) { return String(x).toLowerCase(); }) : [];
    var inst = must.concat(picked, [k2.inst[0], k1.inst[0], k2.inst[1]]).filter(Boolean);
    var k1d = FUSION_KIT[g[0]] && GENRE_KIT[g[0]] ? GENRE_KIT[g[0]].bpm : 100, k2d = FUSION_KIT[g[1]] && GENRE_KIT[g[1]] ? GENRE_KIT[g[1]].bpm : 100;
    var tb = tuneBits(t, namesIn(s));
    var bpm = tb.bpm || Math.round((k1d + k2d) / 2 + ((s.flip && s.flip.vibe === 'hype') ? 12 : (s.flip && s.flip.vibe === 'sad') ? -10 : 0));
    var mood = FUSION_MOOD[(s.flip || {}).vibe] || 'laid back';
    var list = [genre, voice, k1.drums].concat(inst, [bpm + ' BPM', mood, 'natural live band']);
    var words = null;
    if (pair) {
      voice = texture + ' ' + range + ' ' + gender + ' vocal with ' + pair.verse + ' and ' + pair.hook;
      if (!tb.bpm) bpm = pair.bpm + ((s.flip && s.flip.vibe === 'hype') ? 10 : (s.flip && s.flip.vibe === 'sad') ? -10 : 0);
      // Interleave so neither genre owns the tail when the length cap trims.
      var mix = must.concat(picked, [pair.a[0], pair.b[0], pair.b[1], pair.a[1]]).filter(Boolean);
      list = [pair.genre, voice, pair.drums].concat(mix, [bpm + ' BPM', mood]);
      words = pair.words;
      verse = pair.verse;
    }
    var hy = hyphySound(s);
    if (hy) {
      // Hyphy sound (Both badge): delivery joins the one vocal line, 2 kit words after the drums, tempo from the level.
      // Keep both genres: rap verses become chant-rap, the other genre's hook stays. One kit word only, so balance holds.
      if (hy.delivery) list[1] = list[1].replace(/\b(melodic |hard )?rap verses\b/, 'chant-rap verses');
      list.splice(3, 0, hy.terms[0]);
      var bi = list.findIndex(function (x) { return /^\d+ BPM$/.test(x); });
      if (bi > 5) list.splice(bi - 1, 1);
      if (hy.bpm) list.push('hand claps');
      list = list.filter(Boolean);
      if (hy.bpm && !tb.bpm) { var nb = hy.bpm[0] + (seed % (hy.bpm[1] - hy.bpm[0] + 1)); list = list.map(function (x) { return /^\d+ BPM$/.test(x) ? nb + ' BPM' : x; }); }
    }
    if (tb.extra) list.push(tb.extra);
    var raw = stripNames(list.join(', '), namesIn(s)).replace(/\bsuno\b/ig, '');
    var PC = promptCheck();
    var checked = PC ? PC.checkStyle(raw, { strict: true, gender: gender, keepFirst: 3, genreWords: words }) : { style: raw, exclude: [], warnings: [], sliders: { weirdness: 25, styleInfluence: 65 } };
    checked.voice = { gender: gender === 'female' ? 'Female' : 'Male', verse: /rap/.test(verse) ? 'Rap' : 'Sung', chorus: 'Sung' };
    return checked;
  }
  function hyphySound(s) {
    var f = (s && s.card === 'flip' && s.flip) || {};
    var SM = slangMode();
    return f.slang && SM && SM.soundFor ? SM.soundFor(f.slang, f.hyphy) : null;
  }
  function slangMode() {
    if (typeof module === 'object' && module.exports && typeof require === 'function') { try { return require('./slang-mode.js'); } catch (e) { /* browser */ } }
    return (typeof window !== 'undefined' && window.SlangMode) || null;
  }
  function promptCheck() {
    if (typeof module === 'object' && module.exports && typeof require === 'function') { try { return require('./prompt-check.js'); } catch (e) { /* browser */ } }
    return (typeof window !== 'undefined' && window.PromptCheck) || (typeof globalThis !== 'undefined' && globalThis.PromptCheck) || null;
  }
  // Flip result: style plus Exclude, slider hints and lyric voice tags.
  function flipStyle(s, sound) {
    var p = sound || {};
    if (p.fusion && p.fusion.length === 2) return fusionStyle(s, p);
    var style = stylePrompt(s, p);
    var PC = promptCheck();
    var c = PC ? PC.checkStyle(style, {}) : { style: style, exclude: [], warnings: [], sliders: { weirdness: 25, styleInfluence: 65 } };
    c.voice = null;
    return c;
  }
  function stylePrompt(s, sound) {
    var p = sound || {};
    if (p.fusion && p.fusion.length === 2) return fusionStyle(s, p).style;
    var b = Object.assign(baseSound(s), p.base || {});
    if (p.genre && p.genre !== b.genre && GENRE_KIT[p.genre] && !(p.fusion && p.fusion.length === 2)) b = Object.assign({ genre: p.genre }, GENRE_KIT[p.genre], b.key ? { key: b.key } : {});
    // Fill missing texture, chain, arrangement and kick from the genre kit so every mode follows the same rules.
    var kit = GENRE_KIT[b.genre] || GENRE_KIT[String(b.genre || '').replace(/^\w/, function (c) { return c.toUpperCase(); })] || {};
    ['texture', 'production', 'arrangement', 'kick'].forEach(function (f) { if (!b[f] && kit[f]) b[f] = kit[f]; });
    if (/trap/i.test(b.sub || '')) { b.texture = '808 slides, rattling triplet hats'; b.kick = 'syncopated trap kick'; b.production = 'hard clipped 808s, dry upfront vocal, short plate on ad libs'; b.arrangement = 'beat drops out before each punchline'; }
    var v = vibeShape(s) || {};
    var vp = !(sound && sound.base) && VIBE_PROD[s.vibe] && s.card !== 'flip' ? VIBE_PROD[s.vibe] : null;
    if (vp) { b = Object.assign({}, b, { texture: vp.texture, kick: vp.kick, production: vp.production, arrangement: [vp.groove, b.arrangement].filter(Boolean).join(', ') }); }
    var a0 = s.answers || {};
    var seed = SEEDS[hashStr((a0.song || '') + (a0.artist || '') + (a0.name || '') + (s.title || '') + vibeKey(s)) % SEEDS.length];
    var genre = p.fusion && p.fusion.length === 2 ? (p.fusion[0] + ' meets ' + p.fusion[1] + ' fusion') : (p.genre || b.genre);
    var sub = p.sub || (p.genre && p.genre !== b.genre && !GENRE_KIT[p.genre] ? '' : b.sub);
    var bpm = Math.max(55, Math.min(190, (Number(p.bpm) || Number(b.bpm) || 100) + (Number(v.bpm) || 0)));
    if (vp && !p.bpm && bpm >= 90 && bpm <= 120) bpm = vp.fast ? 124 + (bpm % 17) : 72 + (bpm % 14);
    var key = v.key || b.key || (/(Sad|Dark)/.test(s.vibe || '') ? 'minor key' : 'major key');
    var inst = p.instruments && p.instruments.length ? p.instruments.join(', ').toLowerCase() : [b.inst, v.inst].filter(Boolean).join(', ');
    var vocal = (p.vocal || [v.vocal, b.vocal].filter(Boolean).join(', ')).toLowerCase();
    var electronic = /electronic|house|edm|techno|garage|dance/i.test(genre + ' ' + (sub || ''));
    var kick = b.kick || (electronic ? 'syncopated off-beat kick placement' : '');
    if (electronic && /four on the floor/i.test(kick) && !/house|techno|disco/i.test(sub || '')) kick = 'syncopated off-beat kick placement';
    var sublow = /808|sub bass|dub bass|reese/i.test(inst + ' ' + (b.texture || '')) && !/60 Hz/.test(b.production || '') ? 'sub-bass felt under 60 Hz' : '';
    var genreTag = sub && new RegExp('\\b' + String(genre).split(' ')[0].replace(/[^a-z&]/ig, '') + '\\b', 'i').test(sub) ? sub : (sub ? sub + ' ' : '') + String(genre).toLowerCase();
    // Texture and process first, then the chain, then arrangement, then numbers. Genre is a light tag at the end.
    // Fine-tune choices (optional) are kept in the tail so the length cap never drops them.
    var t = p.tune || {};
    var tb = tuneBits(t, namesIn(s));
    var hy = hyphySound(s);
    if (hy && hy.bpm && !tb.bpm) bpm = hy.bpm[0] + (hashStr(String(s.title || '') + JSON.stringify(s.answers || {})) % (hy.bpm[1] - hy.bpm[0] + 1));
    if (hy && hy.delivery) vocal = [hy.delivery, vocal].filter(Boolean).join(', ');
    var tempo = tb.bpm ? tb.bpm + ' bpm' : (hy && hy.bpm ? bpm + ' BPM' : (tb.speed || ('BPM ' + bpm)));
    var head = [
      hy ? hy.terms.join(', ') : '',
      t.must && t.must.length ? 'must have ' + t.must.join(', ').toLowerCase() : '',
      b.texture || '',
      voiceDescriptor(s, t),
      inst,
      kick,
      b.production || '',
      sublow,
      vocal,
      [v.arr, b.arrangement].filter(Boolean).join(', '),
      seed,
    ];
    var tail = [
      tempo,
      key,
      tb.vocals,
      tb.energy,
      v.mood || moodWords(s),
      (b.era ? b.era + ' ' : '') + genreTag + ' feel',
      p.custom ? String(p.custom).slice(0, 60) : '',
      tb.extra,
    ];
    var clean = function (list) { return stripNames(list.filter(Boolean).join(', '), namesIn(s)).replace(/\u2014|\u2013/g, ', ').replace(/\bsuno\b/ig, '').replace(/(,\s*){2,}/g, ', ').replace(/\s{2,}/g, ' ').trim(); };
    var hs = clean(head), ts = clean(tail);
    if (ts.length > 360) ts = ts.slice(0, 360).replace(/,[^,]*$/, '');
    if (hs.length + ts.length + 2 > 520) hs = hs.slice(0, Math.max(120, 518 - ts.length)).replace(/,[^,]*$/, '');
    var out = hs && ts ? hs + ', ' + ts : (hs || ts);
    var PC = promptCheck();
    return PC ? PC.checkStyle(out, {}).style : out;
  }
  function moodWords(s) {
    var v = s.vibe || '';
    var f = s.flip || {};
    if (f.vibe === 'funny') return { Light: 'playful, tongue in cheek', Silly: 'silly, comedic, bouncy', Unhinged: 'unhinged comedy, chaotic energy' }[f.level] || 'playful';
    if (f.vibe === 'dirty') return { Flirty: 'flirty, teasing', Spicy: 'sultry, cheeky', Filthy: 'raunchy club energy, cheeky' }[f.level] || 'flirty';
    if (f.vibe === 'sad') return 'melancholy, aching';
    if (f.vibe === 'hype') return 'high energy, chant hook';
    return { Happy: 'joyful, bright', Hype: 'high energy, anthemic', Chill: 'laid back, smooth', Sad: 'melancholy, tender', Funny: 'playful, comedic', Love: 'romantic, warm', Dark: 'moody, brooding' }[v] || 'uplifting';
  }

  // ---------- Syllables and score ----------
  function syllables(word) {
    var w = String(word || '').toLowerCase().replace(/[^a-z]/g, '');
    if (!w) return 0;
    if (w.length <= 3) return 1;
    w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
    var m = w.match(/[aeiouy]{1,2}/g);
    return Math.max(1, m ? m.length : 1);
  }
  function lineSyllables(line) {
    return String(line || '').replace(/\[[^\]]*\]/g, '').split(/\s+/).reduce(function (n, w) { return n + syllables(w); }, 0);
  }
  function splitLyrics(text) {
    var sections = []; var cur = null;
    String(text || '').replace(/\r/g, '').split('\n').forEach(function (raw) {
      var line = raw.trim();
      var tag = line.match(/^\[([^\]]+)\]$/);
      if (tag) { cur = { label: tag[1], lines: [] }; sections.push(cur); return; }
      if (!line) return;
      if (!cur) { cur = { label: 'Verse 1', lines: [] }; sections.push(cur); }
      cur.lines.push(line);
    });
    return sections;
  }
  // Amber flag: line more than 2 syllables off its matching line in a sibling section (verse 1 line 2 vs verse 2 line 2).
  function syllableFlags(text) {
    var secs = splitLyrics(text);
    var out = [];
    secs.forEach(function (sec, si) {
      var kind = sec.label.replace(/\s*\d+$/, '').toLowerCase();
      sec.lines.forEach(function (line, li) {
        var n = lineSyllables(line);
        var flag = false;
        secs.forEach(function (o, oi) {
          if (oi === si || o.label.replace(/\s*\d+$/, '').toLowerCase() !== kind || !o.lines[li]) return;
          if (Math.abs(lineSyllables(o.lines[li]) - n) > 2) flag = true;
        });
        if (!flag && li > 0 && Math.abs(lineSyllables(sec.lines[li - 1]) - n) > 6) flag = true;
        out.push({ section: sec.label, index: li, line: line, syllables: n, flag: flag });
      });
    });
    return out;
  }
  function songScore(text) {
    var flags = syllableFlags(text);
    if (!flags.length) return 0;
    var good = flags.filter(function (f) { return !f.flag; }).length;
    var secs = splitLyrics(text);
    var hasChorus = secs.some(function (s) { return /chorus|hook/i.test(s.label); }) ? 1 : 0;
    var rhymes = 0;
    secs.forEach(function (s) { for (var i = 1; i < s.lines.length; i += 1) if (rhymeKey(s.lines[i]) && rhymeKey(s.lines[i]) === rhymeKey(s.lines[i - 1])) rhymes += 1; });
    return Math.round(400 + (good / flags.length) * 400 + hasChorus * 150 + Math.min(rhymes, 6) * 25);
  }
  function rhymeKey(line) {
    var w = String(line || '').toLowerCase().replace(/[^a-z\s]/g, '').trim().split(/\s+/).pop() || '';
    var m = w.match(/[aeiouy]+[^aeiouy]*$/);
    return m ? m[0] : '';
  }

  // ---------- Safety ----------
  var CRISIS_RE = /\b(suicid\w*|kill myself|end it all|want(ed|ing)? to die|self[- ]?harm|cutting myself|no reason to live|overdos\w*|(didn'?t|don'?t) want to (be here|live))\b/i;
  var CRISIS = { text: "You matter. If you're hurting, call or text 988 (US) or visit 988lifeline.org", href: 'https://988lifeline.org' };
  var IDENTITY_RE = /\b(race|racist|religion|muslim|jewish|christian|disabled|disability|retard\w*|fat|ugly|gay|lesbian|trans|tranny|gender|black people|white people|immigrant)\b/i;
  var HARASS_RE = /\b(ruin (her|him|them)|send (it|this) to (my ex|her|him)|make (her|him) cry|expose (her|him)|dox\w*)\b/i;
  var MINOR_RE = /\b(underage|minor|child|kid|kids|teen(ager)?|\d{1,2} ?(yo|years? old)|school ?girl|school ?boy|little girl|little boy)\b/i;
  var NONCONSENT_RE = /\b(drunk|passed out|asleep|unconscious|roofie\w*|force(d)?|didn'?t say yes|no means yes|against (her|his|their) will)\b/i;
  // Roast output never leans on identity, even when the public figure jokes about it themselves.
  var ROAST_IDENTITY_OUT = /\b(jew\w*|bar mitzvah|bat mitzvah|kosher|rabbi|synagogue|muslim\w*|islam\w*|christian\w*|hindu\w*|catholic\w*|black (guy|man|woman|people)|white (boy|guy|man|people|rappers?|kids?)|black rappers?|asian\w*|mexican\w*|latino\w*|gay|lesbian|queer|trans\w*|tranny|retard\w*|autis\w*|crippl\w*|disabled|immigrant\w*)\b/i;
  var GRAPHIC_RE = /\b(cock|pussy|dick|cum|penetrat\w*|blowjob|anal|genital\w*)\b/i;

  function crisis(text) { return CRISIS_RE.test(String(text || '')); }

  // Explicit gate: 'off' default. 'ok' needs ageOk. Only Roast and Make it dirty may use it.
  function explicitAllowed(s) {
    var where = (s.type === 'roast') || (s.card === 'flip' && s.flip && s.flip.vibe === 'dirty');
    return Boolean(where && s.explicit === 'ok' && s.ageOk === true);
  }
  function needsExplicit(s) {
    return s.card === 'flip' && s.flip && s.flip.vibe === 'dirty' && (s.flip.level === 'Spicy' || s.flip.level === 'Filthy');
  }

  function checkInput(s, text) {
    var t = String(text || '');
    if (s.type === 'kids' || s.sub === 'memory') {
      if (/\b(sex\w*|naked|horny|kill|blood|gore)\b/i.test(t)) return { ok: false, error: 'This one stays clean and gentle.' };
    }
    if (s.type === 'roast') {
      if (IDENTITY_RE.test(t)) return { ok: false, error: 'Roast choices, not who someone is. Try habits, style, fails, or brags.' };
      if (HARASS_RE.test(t)) return { ok: false, error: 'Roasts are for laughs, not to hurt someone. Roast yourself instead?' };
    }
    if (s.card === 'flip' && s.flip && s.flip.vibe === 'dirty') {
      if (MINOR_RE.test(t)) return { ok: false, error: 'Make it dirty never involves anyone under 18.' };
      if (NONCONSENT_RE.test(t)) return { ok: false, error: 'Everyone in a dirty song is into it. No non-consent.' };
      if (needsExplicit(s) && !explicitAllowed(s)) return { ok: false, error: 'Spicy and Filthy need Explicit OK and the 18+ check.' };
    }
    if (s.sub === 'fan' && root_fan()) {
      var f = root_fan().check(t);
      if (!f.ok) return f;
    }
    return { ok: true };
  }
  var fanLib = null;
  function root_fan() {
    if (fanLib) return fanLib;
    try { fanLib = (typeof window !== 'undefined' && window.FanSong) || require('./fan-song'); } catch (e) { fanLib = null; }
    return fanLib;
  }

  // Output scrub: no em dashes, engine name, graphic words (dirty stays innuendo), real names in dirty.
  function scrubOutput(text, s) {
    var t = String(text || '').replace(/\u2014|\u2013/g, ', ').replace(/\bsuno\b/ig, '').replace(/\btonegrid\b/ig, '');
    var lines = t.split('\n').filter(function (line) {
      if (GRAPHIC_RE.test(line)) return false;
      if (s && s.type === 'roast' && ROAST_IDENTITY_OUT.test(line)) return false;
      if (s && s.flip && s.flip.vibe === 'dirty' && MINOR_RE.test(line)) return false;
      if (s && (s.type === 'kids' || s.sub === 'memory') && /\b(damn|hell|shit|fuck\w*|bitch)\b/i.test(line)) return false;
      if (s && !explicitAllowed(s) && /\b(fuck\w*|shit\w*|bitch\w*|motherf\w*)\b/i.test(line)) return false;
      if (s && !explicitAllowed(s) && s.flip && s.flip.slang && /\bthizz/i.test(line)) return false;
      return true;
    });
    if (s && s.sub === 'trip') lines = lines.map(function (line) { return /^\[/.test(line) ? line.replace(/\bskank(ing)?( guitar)?\b/ig, 'offbeat chop guitar') : tripClean(line); });
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  // ---------- AI label ----------
  // human: no Plai line kept. full: user typed nothing and edited nothing. else assisted.
  function aiLabel(s) {
    if (s.aiLevel === 'human' && !s.keptPlai) return 'Human';
    if (s.aiLevel === 'full' && !s.userWords) return 'Full AI';
    return 'AI-assisted';
  }

  // ---------- Prompts ----------
  var BASE_RULES = [
    'Write original song lyrics. Never copy real song lyrics beyond three words in a row.',
    'Do not use em dashes. Use section tags like [Verse 1], [Chorus], [Bridge].',
    'Never name a music app or a distributor. No promises about money or streams.',
    'No slurs, no hate, no threats. Nothing sexual about minors ever. No sexual content about real named people.',
  ].join('\n');

  function spiceNote(sp) {
    return sp === 'Spicy' ? ' Intensity: maximum. No mercy, every bar a knockout.' : (sp === 'Mild' ? ' Intensity: playful jabs, still specific.' : ' Intensity: sharp and savage.');
  }
  function roastExplicit(s) { return s.type === 'roast' && explicitAllowed(s); }
  // Writer rules. An adult celebrity roast with Explicit OK and the 18+ check may be raunchy, still never graphic.
  function baseRules(s) {
    if (!s || !roastExplicit(s)) return BASE_RULES;
    return BASE_RULES.replace('No sexual content about real named people.', 'Adult roast: raunchy, crude sexual innuendo and profanity are welcome as obvious joke exaggeration of their public persona. No graphic sex acts, never claim a real sexual act as fact, never non-consent.');
  }
  function roastAmmo(s) {
    var r = s.research; if (!r || s.sub !== 'celeb') return '';
    var out = ['Roast ammo (real public info, use specific details, never quote lyrics):'];
    [['Persona', r.persona], ['Songs (titles only)', r.songs], ['Image and brand', r.brand], ['Famous public moments', r.moments], ['Running jokes and memes', r.jokes], ['Career facts', r.career]].forEach(function (p) {
      var v = Array.isArray(p[1]) ? p[1].filter(Boolean) : (p[1] ? [p[1]] : []);
      if (v.length) out.push(p[0] + ': ' + v.join('; '));
    });
    return out.length > 1 ? out.join('\n') : '';
  }
  function celebResearchPrompt(name) {
    return 'Public figure: ' + name + '. Build a comedy roast dossier from widely reported public info only. Do not quote any lyrics. No rumors, no allegations, no health claims. Leave out race, ethnicity, religion, sexual orientation and disability entirely, even if they joke about it themselves. Return JSON only: {"persona":"one line on their public persona","songs":["3 to 6 signature song or work titles, titles only, with the theme in 3 words"],"brand":["2 to 4 points about their image, look, brand"],"moments":["3 to 5 famous public moments"],"jokes":["3 to 5 well known running jokes or memes about them"],"career":["3 to 5 career facts, including flops or pivots"],"sound":' + SOUND_JSON + '}. Describe their typical music in sound, never naming them or their songs there.';
  }

  // Storyteller, trip report to song. A true report, told in order, as a real song.
  function tripFusion(s) {
    var a = s.answers || {};
    var g1 = String(a.genreA || '').trim(), g2 = String(a.genreB || '').trim();
    var on = a.fusion === 'Two genres, hard cuts' || a.device === 'Two genres as two realities';
    return on ? [g1 || 'Boom bap hip hop', g2 || 'Psychedelic rock'] : null;
  }
  function tripRules(s) {
    var a = s.answers || {};
    var f = tripFusion(s);
    var dose = [a.drug, a.dose, a.timing].filter(Boolean).join(', ');
    return [
      'Storyteller, trip report. Turn this true trip report into a song.',
      '1. Name the drug in the first 20 seconds, plainly, with the dose and the timing' + (dose ? ': ' + dose : '') + '. Say it like information, not a disclaimer or a warning.',
      '2. Tell it in order, one beat per section: setup (who, where, what, how much, what they expected), come-up, peak, twist, comedown, aftermath and moral.',
      '3. Use this narration device: ' + (a.device || 'pick one: a clock-time narrator, a dose-counter refrain, call and response with a skeptic, dispatcher or detective, rebuilding the night from evidence, or two genres as two realities') + '.',
      '4. Expectations versus results drive the song. Plant the expectation early and pay it off with the opposite. Use one repeated line that flips its meaning by the end.',
      '5. The wit comes from the real details in the report. Stay true to the report. Never invent events, doses, or people.',
      '6. The hook carries the story and gains new meaning each time it returns.',
      '7. It is still a real song: a strong beat, a melodic hook, builds, and tempo slams at the turns.',
      f ? '8. Fusion: ' + f[0] + ' and ' + f[1] + ' alternate with hard cuts, never blended. Every section tag names its genre and a full voice description, like [Verse 1, ' + f[0] + ', warm baritone male voice, dry and close].' : '8. One genre. Keep it consistent.',
      '9. No artist names. No parentheses. No words in all caps. Never use the word skank; say offbeat chop guitar.',
      '10. Land the last section on the author\'s own verdict' + (a.verdict ? ': ' + a.verdict : '') + '.',
    ].join('\n');
  }
  // Trip style: alternate, never blend. Exclude carries genre blending. House words cleaned.
  function tripClean(t) {
    return String(t || '').replace(/\bskank(ing)?( guitar)?\b/ig, 'offbeat chop guitar').replace(/[()]/g, '').replace(/\b[A-Z]{2,}\b/g, function (w) { return /^(BPM|AI|DJ|MC|TV|LA|NYC|LSD|MDMA|DMT|THC|CBD|PCP)$/.test(w) ? w : w.toLowerCase(); }).replace(/\s{2,}/g, ' ').trim();
  }
  function tripStyle(s, sound) {
    var f = tripFusion(s);
    var base = stylePrompt(s, sound || {});
    if (f) base = base.split(', ').filter(function (x) { return !/ feel$/.test(x); }).join(', ');
    var style = f ? [f[0] + ' and ' + f[1] + ' alternate section by section with hard cuts, never blend', 'strong beat', 'melodic hook', 'builds', 'tempo slams at the twist', base].join(', ') : [base, 'strong beat', 'melodic hook', 'builds', 'tempo slams at the twist'].join(', ');
    style = tripClean(stripNames(style, namesIn(s)).replace(/\bsuno\b/ig, ''));
    var PC = promptCheck();
    var c = PC ? PC.checkStyle(style, {}) : { style: style, exclude: [], warnings: [], sliders: { weirdness: 25, styleInfluence: 65 } };
    c.style = tripClean(c.style);
    c.exclude = (c.exclude || []).slice();
    if (f && c.exclude.indexOf('genre blending') === -1) c.exclude.push('genre blending');
    c.voice = null;
    return c;
  }

  function typeRules(s) {
    var a = s.answers || {};
    var r = {
      jam: 'Title early. Put the real detail in verse 1. Each verse adds something new. Chorus words stay the same each time.' + (a.to === 'Them' ? ' Sing to them directly (you).' : ''),
      occasion: 'Build on one true scene and their actual phrases. Name in the chorus. Funny stays kind.',
      memory: 'Gentle. One defining quality and 2 or 3 specific memories. Chorus is their saying or a short still-here line. Never invent details or cause of death. Close with what they leave behind. No jokes.',
      fan: 'About the fan\'s feelings and real moments, not private facts. No quoting their lyrics. Never write as if the fave is singing.',
      parody: 'Parody. Fair use parody must comment on the original work, so every joke targets the original song or its artist: what the song says, how it says it, or what the artist is publicly known for. Never drift into mocking a general topic that is not tied back to the song. Aim jokes at the original song\'s real topics, moments, and hypocrisy listed below. Two-edged, bizarre juxtaposition, glorify the mundane. Keep the hook rhythm with new words. Never copy more than three words in a row from the original.',
      friend: 'Roast choices, not identity. Setup, misdirection, twist. One trait hit from several angles. Strongest line last.' + (a.love && /Yes/.test(a.love) ? ' The very last line flips to a real compliment.' : ''),
      self: 'Self roast. Choices, not identity. Strongest line last. End on a wink.',
      celeb: 'Comedy roast of a public figure, roast-dais style. Every line hits one specific, known thing about them from the roast ammo: a song title, their image or brand, a famous public moment, a running joke, a career fact. No generic insults that could fit anyone. Setup and punchline, short and savage, escalate, best burn last. Exaggeration is fine when it is obviously a joke. Never invent crimes, abuse, diseases, or false factual claims. Never joke about race, ethnicity, religion, sexual orientation, or disability, even if the person jokes about it themselves. No minors.' + (spiceNote(a.spice)),
      story: 'Three growing parts: before, the moment, after. Each verse moves time forward. Include the place. Past tense verses, present tense chorus.',
      diary: 'Three growing parts: before, the moment, after. Each verse moves time forward. Include the place. Past tense verses, present tense chorus.',
      trip: tripRules(s),
      hype: 'Chant hook of 2 to 4 words with the name, repeated at least 4 times. Call and response. Brag about effort, never violence toward rivals.',
      holiday: 'Fit the holiday. Respectful of faiths. Halloween is spooky fun, no gore.',
      kids: 'One topic, everyday words, short lines ending on open vowels, chorus of 2 to 4 lines that returns 3 times, an action in the lines. Clean, nothing scary or romantic. First names only.',
    };
    return r[s.sub || s.type] || r.jam;
  }

  function answersText(s) {
    var a = s.answers || {};
    return Object.keys(a).filter(function (k) { return a[k]; }).map(function (k) { return k + ': ' + a[k]; }).join('\n');
  }

  function songPrompt(s) {
    var t = TYPES.filter(function (x) { return x.id === s.type; })[0] || TYPES[0];
    var research = s.sub !== 'celeb' && s.research && s.research.topics ? '\nOriginal song topics (for aim only):\n- ' + s.research.topics.join('\n- ') : '';
    var built = (s.built || []).filter(Boolean);
    return [
      'Song type: ' + t.label + (s.sub ? ' (' + SUBS[s.sub] + ')' : '') + '.',
      typeRules(s),
      'Vibe: ' + (s.vibe || 'Happy') + '. Title: ' + (s.title || 'make one up') + '. Length: ' + (s.length || 'Song') + '.',
      roastExplicit(s) ? 'Explicit OK (18+): rude mode. Unhinged, no filter, maximum savage. Genuinely raunchy, crude and profane, swear freely, like a real adult roast with zero mercy. The guardrails above still hold. Still no slurs.' : (explicitAllowed(s) ? 'Explicit language allowed, still no slurs.' : (s.type === 'roast' ? 'Keep it clean: no profanity or sexual jokes, but stay sharp and specific.' : 'Keep it clean.')),
      'Answers from the user (use their exact words where you can):',
      answersText(s) || '-',
      research,
      roastAmmo(s),
      (s.ideas || []).length ? 'Ideas the user picked (weave these in as images, not a list):\n- ' + s.ideas.slice(0, 8).join('\n- ') : '',
      built.length ? 'Lines the user already picked or wrote. Keep them exactly, word for word, in order:\n' + built.join('\n') : '',
      'Return lyrics only.',
    ].filter(Boolean).join('\n');
  }

  function linesPrompt(s, slot) {
    return songPrompt(s) + '\n\nNow write exactly 3 different options for the next single line of the ' + slot + '. One per line, no numbering, no tags.';
  }

  // Each "what feels off" chip names the part of the song it is about. Read it highlights those
  // lines, the chip gets its own fix button, and Fix it all only rewrites those sections.
  var CHIP_FOCUS = {
    'Chorus is weak': { part: 'chorus', action: 'Fix my chorus', say: 'Your chorus is lit up.', rule: 'Rewrite the [Chorus] (the hook) so it is catchier: short, singable, easy to repeat, with one strong title line. Every repeat of the chorus must be identical. Copy every verse word for word.' },
    'Ending falls flat': { part: 'ending', action: 'Fix my ending', say: 'Your last section is lit up.', rule: 'Rewrite only the last section so the song lands: pay off the story and the hook in the final lines. Copy every other section word for word.' },
    'Story is unclear': { part: 'verses', action: 'Fix my story', say: 'Your verses are lit up.', rule: 'Rewrite the verses so the story is clear: who, what happened, and how it feels, in order. Copy the chorus word for word.' },
    'Rhymes feel forced': { part: 'rhymes', action: 'Fix my rhymes', say: 'Lines with forced rhymes are lit up.', rule: 'Fix forced rhymes: rewrite the lines whose end words are forced or repeated so they rhyme naturally. Keep the meaning.' },
    'Lines feel off-beat': { part: 'offbeat', action: 'Fix the off-beat lines', say: 'Off-beat lines are lit up.', rule: 'Fix syllable balance: make each line match the syllable count of its partner line in the other verse.' },
    'Too generic': { part: 'generic', action: 'Make it less generic', say: 'Lines that feel generic are lit up.', rule: 'Swap cliches and vague lines for concrete, specific details from the writer\'s own world. Keep the hook.' },
  };
  var GENERIC_WORDS = /\b(heart|soul|fire|light|tonight|forever|alright|dream|road|life is good|night and day|baby)\b/i;
  function sectionKind(label) { var l = String(label || '').toLowerCase(); return /chorus|hook|refrain/.test(l) ? 'chorus' : /verse/.test(l) ? 'verse' : l; }
  function chipFocus(chip) { return CHIP_FOCUS[chip] || null; }
  // Lines a chip is about, as a list of exact line strings.
  function focusLines(text, chip) {
    var f = chipFocus(chip); if (!f) return [];
    var secs = splitLyrics(text), out = [];
    var add = function (l) { if (out.indexOf(l) === -1) out.push(l); };
    if (f.part === 'chorus') secs.forEach(function (sc) { if (sectionKind(sc.label) === 'chorus') sc.lines.forEach(add); });
    else if (f.part === 'verses') secs.forEach(function (sc) { if (sectionKind(sc.label) === 'verse') sc.lines.forEach(add); });
    else if (f.part === 'ending') { if (secs.length) secs[secs.length - 1].lines.forEach(add); }
    else if (f.part === 'offbeat') syllableFlags(text).forEach(function (x) { if (x.flag) add(x.line); });
    else if (f.part === 'generic') secs.forEach(function (sc) { sc.lines.forEach(function (l) { if (GENERIC_WORDS.test(l)) add(l); }); });
    else if (f.part === 'rhymes') secs.forEach(function (sc) {
      var ends = sc.lines.map(function (l) { var w = l.toLowerCase().replace(/[^a-z' ]/g, '').trim().split(/\s+/); return w[w.length - 1] || ''; });
      sc.lines.forEach(function (l, i) { var e = ends[i]; var pair = i % 2 ? ends[i - 1] : ends[i + 1]; if (e && pair && (e === pair || e.slice(-2) !== pair.slice(-2))) add(l); });
    });
    return out;
  }
  // Which section kinds Fix it all may change. Null means the whole song.
  function fixTargets(off) {
    var parts = (off || []).map(function (c) { var f = chipFocus(c); return f ? f.part : 'all'; });
    if (!parts.length || parts.some(function (p) { return ['chorus', 'verses', 'ending'].indexOf(p) === -1; })) return null;
    return parts;
  }
  // Puts back every section the chips did not name, word for word from the original.
  function keepUntouched(original, fixed, off) {
    var t = fixTargets(off); if (!t) return fixed;
    var a = splitLyrics(original), b = splitLyrics(fixed), seen = {};
    if (!b.length) return fixed;
    // Match each original section to the same-numbered section of its kind in the fix (2nd chorus to 2nd chorus).
    return a.map(function (sc, i) {
      var k = sectionKind(sc.label), n = seen[k] = (seen[k] || 0) + 1;
      var same = b.filter(function (x) { return sectionKind(x.label) === k; });
      var hit = (t.indexOf('chorus') !== -1 && k === 'chorus') || (t.indexOf('verses') !== -1 && k === 'verse') || (t.indexOf('ending') !== -1 && i === a.length - 1);
      var pick = i === a.length - 1 && t.indexOf('ending') !== -1 ? b[b.length - 1] : (same[n - 1] || same[same.length - 1]);
      return '[' + sc.label + ']\n' + (hit && pick ? pick : sc).lines.join('\n');
    }).join('\n\n');
  }
  function fixPrompt(text, off, line) {
    var rules = (off || []).map(function (c) { var f = chipFocus(c); return f ? f.rule : ''; }).filter(Boolean);
    if (line) return 'Rewrite ONE lyric line 3 different ways.\nThe line: "' + line + '"\n' + (rules.length ? 'What the writer wants: ' + off.join(', ') + '.\n' : '') + 'Keep the meaning and the same number of syllables, give it a natural rhyme with the line next to it. Each rewrite must be new words, not a copy of any line in the song.\nReturn exactly 3 lines, numbered 1. 2. 3. and nothing else. Do not return the song.\n\nThe song, for context only:\n' + text;
    return 'Fix this song. What feels off: ' + ((off || []).join(', ') || 'general polish') + '.\n' + (rules.length ? rules.join('\n') + '\n' : '') + 'Keep the writer\'s voice, their best lines, and the hook. Keep section tags. Return the full fixed song only.\n\n' + text;
  }
  // The 3 rewrites of one line. Drops anything that is just a line already in the song.
  function parseLineOptions(raw, text, line) {
    var norm = function (x) { return String(x || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim(); };
    var have = {}; String(text || '').split('\n').forEach(function (l) { have[norm(l)] = 1; }); have[norm(line)] = 1;
    var out = [];
    String(raw || '').split('\n').forEach(function (l) {
      var numbered = /^\s*\d+[.)]\s+/.test(l);
      l = l.replace(/^[\d\-*.)\s]+/, '').replace(/^["\u201c]|["\u201d]$/g, '').trim();
      if (!l || isTag(l) || have[norm(l)] || out.some(function (o) { return norm(o) === norm(l); })) return;
      out.push({ l: l, n: numbered });
    });
    var nums = out.filter(function (o) { return o.n; });
    return (nums.length ? nums : out).map(function (o) { return o.l; }).slice(0, 3);
  }

  // ---------- Too wordy: real cuts, never new words ----------
  // The model only picks line breaks, tags and which words go. The words shown always come
  // from the writer's original text, so nothing is invented and nothing gets lost by accident.
  var TRIM_LEVELS = [
    { id: 'little', label: 'Trim a little', small: 'About 10% shorter', pct: 10 },
    { id: 'tighten', label: 'Tighten', small: 'About 25% shorter', pct: 25 },
    { id: 'bone', label: 'Cut to the bone', small: 'About 40% shorter', pct: 40 },
  ];
  function trimLevel(id) { return TRIM_LEVELS.filter(function (l) { return l.id === id; })[0] || TRIM_LEVELS[1]; }
  function isTag(line) { return /^\s*\[[^\]]{1,40}\]\s*$/.test(line); }
  function rawWords(text) { return String(text || '').split('\n').filter(function (l) { return !isTag(l); }).join(' ').split(/\s+/).filter(Boolean); }
  function normWord(w) { return String(w || '').toLowerCase().replace(/[\u2018\u2019']/g, '').replace(/[^a-z0-9]/g, ''); }
  function countWords(text) { return rawWords(text).filter(function (w) { return normWord(w); }).length; }
  var STRUCTURE_RULES = 'Break the lyrics into lines of about 4 to 10 words, one bar per line, so rhyming words land at the end of lines. Group lines into sections with tags like [Verse 1], [Chorus], [Verse 2]. If a group of lines repeats, or there is a clear hook, tag it [Chorus], but never repeat or copy lines to fill a section. Do not fix spelling or slang.';
  function cleanupPrompt(text) {
    return 'Clean up the structure of these lyrics only.\n' + STRUCTURE_RULES + '\nDo not change, add, remove, or reorder any words. Every word must appear exactly once, in the same order. Return the lyrics only.\n\n' + text;
  }
  // The model ranks which of the writer's words can go; code picks exactly enough to hit the level.
  function trimPrompt(lines, levelId, cutCount) {
    var lv = trimLevel(levelId);
    var n = countWords(lines);
    var cutN = cutCount || Math.round(n * lv.pct / 100);
    var rows = String(lines).split('\n'), k = 0;
    var numbered = rows.map(function (l) { return isTag(l) || !l.trim() ? l : (++k) + ': ' + l; }).join('\n');
    return [
      'These lyrics are too wordy. The writer wants them about ' + lv.pct + '% shorter, so about ' + cutN + ' of the ' + n + ' words must go.',
      'List the ' + Math.round(cutN * 1.5) + ' words that can be deleted with the least damage, least needed first. Only words that are already in the line. Never the last word of a line (that is the rhyme). Never so many from one line that it stops making sense. Never cut no, not, never, don\'t or any word that flips the meaning.',
      'Good cuts: filler (like, just, so, really, that, gotta, even, cause, because, truly, some), doubled pronouns, helper words, articles, words that repeat an idea. ' + (lv.pct >= 40 ? 'Cutting hard is fine: whole side phrases can go if the line keeps its core image. Do not cut slang or swear words just for being explicit.' : 'Keep the meaning, slang, and voice. Do not cut slang or swear words just for being explicit.'),
      'Format: one per row as line number, colon, the exact word. Example:\n3: really\n1: just\nReturn the list only.',
      '',
      numbered,
    ].join('\n');
  }
  function parseCutList(txt) {
    return String(txt || '').split('\n').map(function (r) { var m = r.match(/^\s*(\d+)\s*[:.)-]\s*(\S+)/); return m ? { line: Number(m[1]), w: normWord(m[2]) } : null; }).filter(function (x) { return x && x.w; });
  }
  // Apply ranked cuts until the goal. Last word of a line stays; every line keeps at least 3 words (or half).
  // Words that flip the meaning if cut. Never removed.
  var KEEP_WORDS = { no: 1, not: 1, never: 1, dont: 1, cant: 1, wont: 1, aint: 1, nothing: 1, nobody: 1, without: 1, didnt: 1, doesnt: 1, isnt: 1, wasnt: 1, couldnt: 1, wouldnt: 1, shouldnt: 1, nor: 1, with: 1 };
  function applyCutList(items, list, goal, floor) {
    var lines = items.filter(function (it) { return it.words; }), done = cutCount(items);
    list.forEach(function (c) {
      if (done >= goal) return;
      var it = lines[c.line - 1]; if (!it) return;
      var real = it.words.filter(function (w) { return normWord(w.w); });
      var kept = real.filter(function (w) { return w.keep; });
      if (KEEP_WORDS[c.w] || kept.length <= Math.max(3, Math.ceil(real.length * (floor || 0.5)))) return;
      for (var i = 0; i < real.length - 1; i++) { if (real[i].keep && normWord(real[i].w) === c.w) { real[i].keep = false; done++; return; } }
    });
    return items;
  }
  // Cut flags over a fixed set of lines. Model output only decides which words go.
  // Rules enforced here: last word of each line stays, every line keeps at least 2 words.
  function applyCuts(items, draft) {
    var flat = [];
    items.forEach(function (it) { if (it.words) it.words.forEach(function (w) { if (w.keep) flat.push(w); }); });
    var b = rawWords(draft).map(normWord);
    var hit = {}; lcsPairs(flat.map(function (w) { return normWord(w.w); }), b).forEach(function (p) { hit[p[0]] = 1; });
    flat.forEach(function (w, i) { if (normWord(w.w) && !hit[i]) w.keep = false; });
    items.forEach(function (it) {
      if (!it.words) return;
      var real = it.words.filter(function (w) { return normWord(w.w); });
      if (!real.length) return;
      real[real.length - 1].keep = true;
      if (real.filter(function (w) { return w.keep; }).length < 2 && real.length >= 2) real[real.length - 2].keep = true;
    });
    return items;
  }
  function cutCount(items) { var n = 0; items.forEach(function (it) { if (it.words) it.words.forEach(function (w) { if (!w.keep && normWord(w.w)) n++; }); }); return n; }
  // Longest common subsequence over normalized words. Returns pairs [origIndex, outIndex].
  function lcsPairs(a, b) {
    var n = a.length, m = b.length, i, j, dp = [];
    for (i = 0; i <= n; i++) { dp.push(new Array(m + 1).fill(0)); }
    for (i = n - 1; i >= 0; i--) for (j = m - 1; j >= 0; j--) dp[i][j] = a[i] && a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    var out = []; i = 0; j = 0;
    while (i < n && j < m) {
      if (a[i] && a[i] === b[j]) { out.push([i, j]); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++;
    }
    return out;
  }
  // Map a model draft back onto the writer's own words. Each result line is a list of
  // { w: original word, keep: bool }. keepAll makes it a pure structure pass (no cuts).
  function alignDraft(original, draft, keepAll) {
    var orig = rawWords(original), on = orig.map(normWord);
    var lines = String(draft || '').replace(/\r/g, '').split('\n').map(function (l) { return l.trim(); });
    var outWords = [], outLine = [];
    lines.forEach(function (l, li) { if (isTag(l) || !l) return; l.split(/\s+/).forEach(function (w) { outWords.push(normWord(w)); outLine.push(li); }); });
    var pairs = lcsPairs(on, outWords);
    var origToLine = {}; pairs.forEach(function (p) { origToLine[p[0]] = outLine[p[1]]; });
    var items = [], lineOf = {}, cursor = 0, last = -1;
    // Each draft line ends at its last matched original word; skipped words between attach to the next line.
    var lineEnds = {};
    pairs.forEach(function (p) { lineEnds[outLine[p[1]]] = p[0]; });
    lines.forEach(function (l, li) {
      if (isTag(l)) { items.push({ tag: '[' + l.replace(/^\s*\[|\]\s*$/g, '').replace(/[^A-Za-z0-9 ]/g, '').trim().slice(0, 24) + ']' }); return; }
      if (lineEnds[li] == null) { if (!l) items.push({ gap: true }); return; }
      var end = lineEnds[li], words = [];
      for (var k = cursor; k <= end; k++) words.push({ w: orig[k], keep: keepAll || origToLine[k] === li || !on[k] });
      cursor = end + 1; last = items.length; items.push({ words: words });
      lineOf[li] = last;
    });
    if (cursor < orig.length) {
      var rest = [];
      for (var r = cursor; r < orig.length; r++) rest.push({ w: orig[r], keep: !!keepAll });
      if (last >= 0 && !keepAll) items[last].words = items[last].words.concat(rest); else items.push({ words: rest.map(function (x) { x.keep = true; return x; }) });
    }
    // Tidy gaps: only keep one blank between sections.
    return items.filter(function (it, i) { return !it.gap || (items[i - 1] && !items[i - 1].gap && !items[i - 1].tag); });
  }
  // ---------- Tighten and Cut to the bone: per-line rewrite, validated in code ----------
  // Deleting more than about 10% breaks grammar, so heavier levels rewrite each line shorter.
  // Code checks every line; any line that fails keeps its delete-only version instead.
  var SWEARS = { shit: 1, fuck: 1, fucking: 1, bitch: 1, bitches: 1, damn: 1, ass: 1, hell: 1, nigga: 1, niggas: 1, hoe: 1, hoes: 1, dick: 1, pussy: 1, motherfucker: 1, shitty: 1, bullshit: 1 };
  var GLUE = { a: 1, an: 1, the: 1, i: 1, im: 1, its: 1, is: 1, to: 1, and: 1, but: 1, my: 1, me: 1, it: 1, in: 1, of: 1, on: 1, at: 1, for: 1, am: 1, are: 1, be: 1 };
  function isRewriteLevel(id) { return trimLevel(id).pct >= 25; }
  function itemWords(it) { return it.words.filter(function (w) { return normWord(w.w); }); }
  function lastWord(t) { var w = rawWords(t).filter(function (x) { return normWord(x); }); return w.length ? normWord(w[w.length - 1]) : ''; }
  // Word target per line so the whole song lands on the level. Short lines lose less.
  function lineTargets(items, pct) {
    var lines = items.filter(function (it) { return it.words; });
    return lines.map(function (it) { var n = itemWords(it).length; return Math.max(Math.min(n, 3), Math.round(n * (1 - pct / 100))); });
  }
  function rewritePrompt(items, levelId, targets, retry) {
    var lv = trimLevel(levelId), k = 0;
    var rows = [];
    items.forEach(function (it) {
      if (it.tag) { rows.push(it.tag); return; }
      if (!it.words) return;
      var t = targets[k]; k++;
      rows.push(k + ' (now ' + itemWords(it).length + ' words, aim ' + t + '): ' + lineText(it, true));
    });
    return [
      'These lyrics are too wordy. The writer wants the song about ' + lv.pct + '% shorter. Rewrite each line shorter.',
      'For every line give 3 versions: a is about 1 word over the aim, b hits the aim, c is 1 or 2 words under the aim.',
      'Rules for every version:',
      '- Use mainly the writer\'s own words from that line. You may change small glue words (a, the, I\'m, it\'s) so it reads right.',
      '- End with the exact same last word as the line. That is the rhyme.',
      '- Keep the meaning, the slang, and the writer\'s voice. Keep any swear words that are in the line.',
      '- Plain, grammatical English that a person would actually say or rap. No choppy word salad.',
      '- Cut whole side phrases or filler (like, just, so, truly, some, gotta, because) instead of dropping little words the grammar needs. "Humble to the neck" stays, never "Humble to neck".',
      '- Keep every no, not, never, don\'t.',
      '- Never add new ideas or images. Never merge lines.',
      'Example. Row: 3 (now 10 words, aim 6): I really just been feeling like I lost my mind',
      '3a: Been feeling like I lost my mind',
      '3b: Feeling like I lost my mind',
      '3c: Like I lost my mind',
      (retry ? 'Your last try was too long on: ' + retry + '. Count the words.' : ''),
      'Return 3 rows per line (' + k + ' lines), format line number plus a, b or c, colon, the new line. No tags, no notes.',
      '',
      rows.join('\n'),
    ].join('\n');
  }
  // Returns { lineNumber: [versions...] }.
  function parseRewrites(txt) {
    var out = {};
    String(txt || '').split('\n').forEach(function (r) {
      var m = r.match(/^\s*(\d+)\s*[a-c]?\s*(?:\([^)]*\))?\s*[:.)-]\s*(.+)$/i);
      if (!m) return;
      var n = Number(m[1]); (out[n] = out[n] || []).push(m[2].replace(/^["\u201c]|["\u201d]$/g, '').replace(/\s+/g, ' ').trim());
    });
    return out;
  }
  // Second opinion: the model flags versions that read broken or change the meaning. Code drops them.
  function judgePrompt(items, variants) {
    var rows = [], lines = items.filter(function (it) { return it.words; });
    lines.forEach(function (it, i) {
      (variants[i + 1] || []).forEach(function (v, j) { rows.push((i + 1) + String.fromCharCode(97 + j) + ': ' + v + '   (original: ' + lineText(it, true) + ')'); });
    });
    return 'Each row is a shortened lyric line with its original. Slang, dropped g\'s and casual rap grammar are fine. List the ids of rows that read as broken English (missing a word the sentence needs, word salad) or that change what the original means. One id per row, like 3b. If none, return NONE.\n\n' + rows.join('\n');
  }
  function dropJudged(variants, txt) {
    var bad = {};
    String(txt || '').split(/[\s,]+/).forEach(function (t) { var m = t.match(/^(\d+)([a-z])$/i); if (m) bad[m[1] + m[2].toLowerCase()] = 1; });
    var out = {};
    Object.keys(variants).forEach(function (k) { out[k] = variants[k].filter(function (v, j) { return !bad[k + String.fromCharCode(97 + j)]; }); });
    return out;
  }
  // Picks one passing version per line so the song lands closest to its word goal.
  // Starts from the longest passing version of each line, then shortens the line furthest over its aim.
  function chooseRewrites(items, variants, targets, goal) {
    var lines = items.filter(function (it) { return it.words; });
    var opts = lines.map(function (it, i) {
      var orig = lineText(it, true);
      return (variants[i + 1] || []).filter(function (v) { return !checkRewrite(orig, v, targets[i]); })
        .map(function (v) { return { t: v, n: countWords(v) }; }).sort(function (a, b) { return b.n - a.n; });
    });
    var pick = opts.map(function (o) { return o.length ? 0 : -1; });
    var total = function () { return lines.reduce(function (sum, it, i) { return sum + (pick[i] >= 0 ? opts[i][pick[i]].n : itemWords(it).length); }, 0); };
    for (var guard = 0; guard < 200 && total() > goal; guard++) {
      var bestI = -1, bestOver = -99;
      opts.forEach(function (o, i) { if (pick[i] >= 0 && pick[i] < o.length - 1) { var over = o[pick[i]].n - targets[i]; if (over > bestOver) { bestOver = over; bestI = i; } } });
      if (bestI < 0) break;
      var before = total(); pick[bestI]++;
      if (Math.abs(total() - goal) > Math.abs(before - goal)) { pick[bestI]--; break; }
    }
    var map = {}; pick.forEach(function (p, i) { if (p >= 0) map[i + 1] = opts[i][p].t; });
    return map;
  }
  // Checks one rewritten line against its original. Returns '' when it passes, or the reason.
  function checkRewrite(orig, line, target) {
    if (!line) return 'missing';
    if (/[\u2014\u2013]/.test(line)) return 'dash';
    var ow = rawWords(orig).map(normWord).filter(Boolean), nw = rawWords(line).map(normWord).filter(Boolean);
    if (!nw.length) return 'empty';
    if (lastWord(line) !== ow[ow.length - 1]) return 'rhyme word changed';
    if (nw.length >= ow.length) return 'not shorter';
    if (nw.length < Math.max(2, Math.floor(ow.length * 0.4))) return 'cut too far';
    var own = {}; ow.forEach(function (w) { own[w] = 1; });
    var fresh = nw.filter(function (w) { return !own[w] && !GLUE[w]; });
    if (fresh.length > Math.max(1, Math.floor(nw.length * 0.25))) return 'too many new words';
    // The writer's spellings and slang stay: a near-copy of one of their words (heavin to heaven) is a respelling.
    for (var f = 0; f < fresh.length; f++) if (fresh[f].length >= 3 && ow.some(function (o) { return o.length >= 3 && nearSpelling(o, fresh[f]); })) return 'spelling changed';
    var have = {}; nw.forEach(function (w) { have[w] = 1; });
    for (var i = 0; i < ow.length; i++) if (SWEARS[ow[i]] && !have[ow[i]]) return 'dropped explicit word';
    var negs = function (ws) { return ws.filter(function (w) { return KEEP_WORDS[w] && w !== 'with'; }).length; };
    if (negs(nw) < negs(ow)) return 'meaning flipped';
    return '';
  }
  // True when two different words are one or two letters apart (edit distance), like heavin and heaven.
  function nearSpelling(a, b) {
    if (a === b || Math.abs(a.length - b.length) > 2) return false;
    var prev = [], i, j;
    for (j = 0; j <= b.length; j++) prev.push(j);
    for (i = 1; i <= a.length; i++) {
      var cur = [i];
      for (j = 1; j <= b.length; j++) cur.push(Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)));
      prev = cur;
    }
    var d = prev[b.length];
    return d > 0 && d <= (Math.min(a.length, b.length) <= 4 ? 1 : 2);
  }
  // Section tags come from the writer, not the model. If the original has tags, those exact tags go back
  // at the same spots. If it has none, each paragraph is a section: a paragraph that repeats is [Chorus],
  // the rest are [Verse 1], [Verse 2]... in order. Same input, same tags, every time.
  // No tags and no blank lines: a run of 2+ lines that shows up again is [Chorus], the rest are verses.
  function lineSections(original) {
    var rows = String(original || '').replace(/\r/g, '').split('\n').map(function (l) { return rawWords(l); }).filter(function (w) { return w.length; });
    var key = rows.map(function (w) { return w.map(normWord).join(' '); });
    var rep = key.map(function (k, i) {
      var count = function (x) { return key.filter(function (y) { return y === x; }).length; };
      return count(k) > 1 && ((i > 0 && count(key[i - 1]) > 1) || (i < key.length - 1 && count(key[i + 1]) > 1));
    });
    var out = [], at = 0, v = 0;
    rows.forEach(function (w, i) {
      if (i === 0 || rep[i] !== rep[i - 1]) out.push({ at: at, tag: rep[i] ? '[Chorus]' : '[Verse ' + (++v) + ']' });
      at += w.length;
    });
    return out.length ? out : [{ at: 0, tag: '[Verse 1]' }];
  }
  function originalSections(original) {
    var rows = String(original || '').replace(/\r/g, '').split('\n'), out = [], at = 0, hasTags = rows.some(isTag);
    if (hasTags) {
      rows.forEach(function (l) { if (isTag(l)) out.push({ at: at, tag: '[' + l.trim().replace(/^\[|\]$/g, '').trim().slice(0, 24) + ']' }); else at += rawWords(l).length; });
      return out;
    }
    var paras = String(original || '').replace(/\r/g, '').split(/\n\s*\n/).map(function (p) { return rawWords(p); }).filter(function (w) { return w.length; });
    if (paras.length < 2) return lineSections(original);
    var key = paras.map(function (w) { return w.map(normWord).join(' '); }), v = 0;
    paras.forEach(function (w, i) {
      var rep = key.filter(function (k) { return k === key[i]; }).length > 1;
      out.push({ at: at, tag: rep ? '[Chorus]' : '[Verse ' + (++v) + ']' }); at += w.length;
    });
    return out;
  }
  function fixTags(original, items) {
    var secs = originalSections(original), lines = [], out = [];
    items.forEach(function (it) { if (it.words) lines.push(it); });
    var at = 0, si = 0;
    lines.forEach(function (it) {
      var start = at, words = it.words.slice();
      at += words.length;
      // Split a line if a section starts inside it.
      while (si < secs.length && secs[si].at < at) {
        var cut = Math.max(0, secs[si].at - start);
        if (cut > 0) { out.push({ words: words.slice(0, cut) }); words = words.slice(cut); start += cut; }
        if (out.length) out.push({ gap: true });
        out.push({ tag: secs[si].tag }); si++;
      }
      if (words.length) out.push({ words: words });
    });
    return out;
  }
  // Puts passing rewrites onto items (item.rewrite), and marks which original words survive for the strikethrough.
  // fallback: items from the delete-only pass, same line order. Lines that fail use those words.
  function applyRewrites(items, fallback, map, targets) {
    var lines = items.filter(function (it) { return it.words; }), fb = fallback.filter(function (it) { return it.words; });
    var report = [];
    lines.forEach(function (it, i) {
      var orig = lineText(it, true), why = checkRewrite(orig, map[i + 1], targets[i]);
      if (!why) {
        var nw = rawWords(map[i + 1]).map(normWord), hit = {};
        lcsPairs(it.words.map(function (w) { return normWord(w.w); }), nw).forEach(function (p) { hit[p[0]] = 1; });
        it.words.forEach(function (w, j) { w.keep = !!hit[j] || !normWord(w.w); });
        it.rewrite = cap1(map[i + 1].replace(/[,;]+$/, ''));
        report.push({ line: i + 1, ok: true });
      } else {
        delete it.rewrite;
        if (fb[i]) it.words.forEach(function (w, j) { w.keep = fb[i].words[j] ? fb[i].words[j].keep : true; });
        it.fallback = true;
        report.push({ line: i + 1, ok: false, why: why });
      }
    });
    return report;
  }
  // Whole-song checks: same line count, every rhyme word kept, total within 5 points of the level.
  function checkSong(items, wordsBefore, pct) {
    var lines = items.filter(function (it) { return it.words; });
    var after = countWords(draftText(items)), goal = Math.round(wordsBefore * (1 - pct / 100)), slack = Math.round(wordsBefore * 0.05);
    var rhymes = lines.every(function (it) { var o = itemWords(it); return lastWord(it.rewrite || lineText(it)) === normWord(o[o.length - 1].w); });
    return { lines: lines.length, after: after, goal: goal, low: goal - slack, high: goal + slack, onTarget: Math.abs(after - goal) <= slack, rhymes: rhymes };
  }
  function lineText(item, full) { return item.words.filter(function (x) { return full || x.keep; }).map(function (x) { return x.w; }).join(' ').replace(/[,;]+$/, ''); }
  function draftText(items, undone) {
    var out = [];
    items.forEach(function (it, i) {
      if (it.tag) { if (out.length && out[out.length - 1] !== '') out.push(''); out.push(it.tag); return; }
      if (it.gap) { if (out.length && out[out.length - 1] !== '') out.push(''); return; }
      var t = it.rewrite && !(undone && undone[i]) ? it.rewrite : lineText(it, undone && undone[i]); if (t) out.push(cap1(t));
    });
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  function cap1(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
  // Offline fallback: split on natural bar starts, then drop filler by level. Never touches the last word of a line.
  var FILLER = {
    little: ['just', 'really', 'very', 'like', 'even', 'that'],
    tighten: ['just', 'really', 'very', 'like', 'even', 'that', 'so', 'gotta', 'cause', 'because', 'truly', 'some', 'it\'s', 'i\'m'],
    bone: ['just', 'really', 'very', 'like', 'even', 'that', 'so', 'gotta', 'cause', 'because', 'truly', 'some', 'it\'s', 'i\'m', 'i', 'know', 'and', 'the', 'these', 'don\'t', 'never', 'when', 'out'],
  };
  function localLines(text) {
    var starts = { i: 1, so: 1, cause: 1, because: 1, but: 1, when: 1, and: 1, you: 1, youll: 1, its: 1 };
    var out = [];
    String(text || '').replace(/\r/g, '').split(/\n\s*\n/).forEach(function (para, pi) {
      var words = rawWords(para); if (!words.length) return;
      out.push('[Verse ' + (pi + 1) + ']');
      var cur = [];
      words.forEach(function (w) {
        if (cur.length >= 4 && starts[normWord(w)] && !(normWord(w) === 'i' && cur.length < 4)) { out.push(cur.join(' ')); cur = []; }
        if (cur.length >= 10) { out.push(cur.join(' ')); cur = []; }
        cur.push(w);
      });
      if (cur.length) out.push(cur.join(' '));
      out.push('');
    });
    return out.join('\n').trim();
  }
  function localTrimDraft(text, levelId) {
    var lv = trimLevel(levelId), cut = {};
    (FILLER[lv.id] || FILLER.tighten).forEach(function (w) { cut[normWord(w)] = 1; });
    var total = countWords(text), budget = Math.round(total * lv.pct / 100), used = 0;
    return String(text).split('\n').map(function (l) {
      if (isTag(l) || !l.trim()) return l;
      var w = l.split(/\s+/);
      return w.filter(function (x, i) { if (i === w.length - 1 || used >= budget || !cut[normWord(x)]) return true; used++; return false; }).join(' ');
    }).join('\n');
  }

  function flipPrompt(text, s) {
    var f = s.flip || {};
    var to = f.fusion && f.fusion.length === 2 ? f.fusion.join(' and ') + ' fusion' : (f.target || 'a new genre');
    var vibe = {
      funny: 'Make it funny (' + (f.level || 'Light') + '): exaggerate, twist, add punchlines, keep the hook.',
      dirty: 'Make it dirty (' + (f.level || 'Flirty') + '): innuendo and double meanings, never graphic. Never minors, never real named people, only clear consent.',
      sad: 'Make it sad: same story, heavier heart.',
      hype: 'Make it hype: bigger, chantable, energy up.',
      surprise: 'Surprise me: pick one fresh angle and commit.',
    }[f.vibe] || '';
    var SM = slangMode(); var slang = SM && f.slang ? SM.lyricRule(f.slang, explicitAllowed(s), f.hyphy) : '';
    if (slang && f.boost) slang += ' This is a step up from the last version: keep every line\'s meaning and its last rhyme word, only add Bay flavor.';
    if (slang) vibe = (vibe ? vibe + ' ' : '') + slang;
    return 'Flip this song to ' + to + (f.from ? ' (it was ' + f.from + ')' : '') + '. ' + vibe + '\nKeep these lines exactly as written:\n' + ((f.keep || []).join('\n') || '(keep the hook)') + '\nRewrite the rest to fit the new sound. Keep section tags. Return the full song only.\n\n' + text;
  }

  function battlePrompt(s, round, userBars, history) {
    var a = s.answers || {};
    return 'Battle rap, round ' + round + ' of 3. Spice: ' + (a.spice || 'Mild') + '. Never go harder than the user. Choices, not identity. No slurs.\nThe user gave these facts about themselves, the only ammo you may use:\n' + (a.facts || '-') + '\n' + (history ? 'Battle so far:\n' + history + '\n' : '') + (userBars ? 'Their last bars:\n' + userBars + '\nFlip their last punchline back at them.' : 'You go first.') + '\nWrite 8 bars, one per line, no tags.';
  }

  var SOUND_JSON = '{"genre":"","sub":"subgenre","era":"decade or era of the sound, like late 2010s","bpm":0,"bpmLow":0,"bpmHigh":0,"inst":"3 to 4 signature instruments","texture":"2 to 3 texture and process details, like analog tape saturation or swung sixteenth-note hats","production":"production chain: mic and preamp character, tape or console saturation, reverb type and tail, compression feel, mix placement","arrangement":"arrangement and melody shape, like no chorus, call and response, melody leaps up a sixth on the hook","kick":"kick placement, like syncopated off-beat kick or four on the floor","vocal":"vocal style and delivery, like nasal sing-rap with ad libs","key":"major key or minor key"}';
  // Clean a researched sound. Never let a name through.
  function normalizeSound(d, names) {
    if (!d || typeof d !== 'object') return null;
    var t = function (v, n) { return stripNames(String(v || ''), names).replace(/\s{2,}/g, ' ').trim().slice(0, n || 80); };
    var bpm = Math.max(50, Math.min(190, Number(d.bpm) || Math.round(((Number(d.bpmLow) || 0) + (Number(d.bpmHigh) || 0)) / 2) || 100));
    return { genre: t(d.genre, 30) || 'Pop', sub: t(d.sub, 40), era: t(d.era, 30), bpm: bpm,
      bpmLow: Math.max(50, Math.min(190, Number(d.bpmLow) || bpm - 4)), bpmHigh: Math.max(50, Math.min(200, Number(d.bpmHigh) || bpm + 4)),
      inst: t(d.inst, 90), texture: t(d.texture, 90), production: t(d.production, 120), arrangement: t(d.arrangement, 90), kick: t(d.kick, 50), vocal: t(d.vocal, 70), key: /minor/i.test(String(d.key || '')) ? 'minor key' : 'major key' };
  }

  // Fair use parody comments on the original work. All three angles target the song or its artist.
  var ANGLE_KINDS = ['says', 'how', 'artist'];
  function parodyAngles(song, artist) {
    var t = song ? '"' + song + '"' : 'the song';
    var who = artist || 'the artist';
    return [
      'What it says: poke at the message of ' + t + ' and where it contradicts itself',
      'How it says it: spoof the style, cliches and delivery of ' + t,
      'The artist: roast what ' + who + ' is known for in public, through ' + t
    ];
  }
  function tiedToOriginal(text, song, artist) {
    var low = String(text || '').toLowerCase();
    var keys = [song, artist].filter(Boolean).map(function (x) { return String(x).toLowerCase(); });
    return keys.some(function (k) { return k && low.indexOf(k) !== -1; }) || /\b(the song|this song|the track|the hook|the chorus|the verse|the video|the artist|their|lyrics?)\b/.test(low);
  }
  function normalizeAngles(raw, song, artist) {
    var base = parodyAngles(song, artist);
    var label = ['What it says: ', 'How it says it: ', 'The artist: '];
    var list = Array.isArray(raw) ? raw : ANGLE_KINDS.map(function (k) { return raw && raw[k]; });
    return ANGLE_KINDS.map(function (k, i) {
      var v = String(list[i] || '').trim().replace(/^(what it says|how it says it|the artist)\s*:\s*/i, '');
      return v && tiedToOriginal(v, song, artist) ? label[i] + v : base[i];
    });
  }

  function researchPrompt(song, artist) {
    return ('Song: "' + song + '" by ' + artist + '. Do not quote any lyrics. Return JSON only: {"topics":["3 to 5 short bullets on what the song is really about and its big moments, including the video if famous"],"angles":{"says":"one parody angle on what the song says: its message or a hypocrisy in it","how":"one parody angle on how the song says it: its style, cliches, production or delivery","artist":"one parody angle on what the artist publicly did or is known for, tied to this song"},"sound":SOUND_JSON}. Never name the artist or song inside sound. Every angle must point at this song or this artist, never at a general topic.').replace('SOUND_JSON', SOUND_JSON);
  }

  // ---------- Samples (when the writer is not connected) ----------
  function cap(x) { x = String(x || '').trim().replace(/[.!?]+$/, ''); return x ? x.charAt(0).toUpperCase() + x.slice(1) : ''; }
  function firstBits(text, n) { return String(text || '').split(/[,.;\n]+/).map(cap).filter(Boolean).slice(0, n); }

  function sampleSong(s) {
    var a = s.answers || {};
    var title = s.title || suggestTitle(s);
    var facts = firstBits(a.report || a.facts || a.memories || a.detail || a.happened || a.moment || a.newTopic || '', 4);
    while (facts.length < 4) facts.push(['We keep it moving', 'Every single day', 'Turn the volume up', 'This one is for you'][facts.length]);
    var name = a.name || a.chant || a.nick || '';
    var hook = name ? cap(title) + ', ' + name : cap(title);
    var built = (s.built || []).filter(Boolean);
    var verse1 = built.length ? built.slice(0, 4) : [facts[0], facts[1], 'I remember every part', 'Held it close inside my heart'];
    var out = ['[Verse 1]'].concat(verse1, ['', '[Chorus]', hook, cap(a.saying || a.love || 'This one is for you'), hook, 'Sing it back to me', '', '[Verse 2]', facts[2], facts[3], 'Still the same old melody', 'Playing loud for you and me', '', '[Chorus]', hook, cap(a.saying || a.love || 'This one is for you'), hook, 'Sing it back to me']);
    return scrubOutput(out.join('\n'), s);
  }
  // ---------- Next line suggestions: read the previous line, offer rhyme, continue, twist ----------
  var RHYME_BANK = ('night light bright tonight sight flight fright white bite kite height right fight moonlight ' +
    'day way play stay away say okay sway gray parade display holiday ' +
    'ghost most toast coast boast post host roast ' +
    'vine line shine mine fine sign design wine spine divine ' +
    'stages pages places faces amazes ages cages ' +
    'show glow go know slow below snow ago tomorrow ' +
    'me free see tree be sea three degree jubilee ' +
    'home alone phone stone own zone bone moan ' +
    'heart start art apart part dark spark park mark ' +
    'sound around ground found crowned town down crown frown ' +
    'fire higher wire desire choir ' +
    'call all fall hall tall small ball wall ' +
    'sing ring thing bring king wing swing everything ' +
    'year here near clear cheer fear dear ' +
    'name game flame same frame blame ' +
    'cold gold old bold told hold ' +
    'beat street feet heat sweet seat treat ' +
    'love above glove enough ' +
    'loud crowd proud cloud allowed ' +
    'tree sky high fly why try goodbye alive ' +
    'scream dream team stream beam gleam ' +
    'treat sweets streets stars cars scars guitars jars bars ' +
    'faces traces spaces lights nights heights skies eyes').split(/\s+/);
  function lastWord(line) { return String(line || '').toLowerCase().replace(/[^a-z\s']/g, ' ').trim().split(/\s+/).pop() || ''; }
  function endSound(w) {
    w = String(w || '').toLowerCase();
    var m = w.match(/[aeiouy]+[^aeiouy]+e$/) || w.match(/[aeiouy]+[^aeiouy]*$/);
    return m ? m[0].replace(/^y/, '') : w;
  }
  function rhymesFor(word) {
    var w = String(word || '').toLowerCase(); if (!w) return [];
    var key = endSound(w);
    var out = RHYME_BANK.filter(function (x) { return x !== w && endSound(x) === key; });
    if (!out.length && w.length > 2) out = RHYME_BANK.filter(function (x) { return x !== w && x.slice(-2) === w.slice(-2); });
    if (!out.length && /[aeiou]s$/.test(w) && !/(ss|es)$/.test(w)) out = ['the stages', 'the faces', 'the places'];
    if (!out.length) { var v = (w.match(/[aeiou]+/g) || []).pop(); out = RHYME_BANK.filter(function (x) { return x !== w && (x.match(/[aeiou]+/g) || []).pop() === v && /[^aeiou]s$|es$/.test(x) === /s$/.test(w); }); }
    return out.filter(function (x, i, arr) { return arr.indexOf(x) === i; });
  }
  function lineNorm(t) { return String(t || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function nearDuplicate(a, b) {
    var x = lineNorm(a), y = lineNorm(b); if (!x || !y) return false; if (x === y) return true;
    var A1 = x.split(' '), B1 = y.split(' '); var setB = {}; B1.forEach(function (w) { setB[w] = 1; });
    var common = A1.filter(function (w) { return setB[w]; }).length;
    return common / Math.max(A1.length, B1.length) >= 0.7;
  }
  // Keep only distinct lines that do not repeat anything already in the song.
  function dedupeLines(cands, existing) {
    var out = [];
    (cands || []).forEach(function (c) {
      c = String(c || '').trim(); if (!c) return;
      if ((existing || []).some(function (e) { return nearDuplicate(c, e); })) return;
      if (out.some(function (o) { return nearDuplicate(c, o); })) return;
      out.push(c);
    });
    return out;
  }
  function fitSyllables(line, target) {
    if (!target) return line;
    var n = lineSyllables(line), guard = 0;
    while (n < target - 2 && guard++ < 3) { line = (guard === 1 ? 'Oh, ' : '') + line + (guard > 1 ? ', yeah' : ''); n = lineSyllables(line); }
    while (n > target + 3 && guard++ < 6) { var parts = line.split(' '); if (parts.length < 4) break; parts.splice(1, 1); line = parts.join(' '); n = lineSyllables(line); }
    return cap(line.replace(/^oh, ([a-z])/i, function (m, c) { return 'Oh, ' + c.toLowerCase(); }));
  }
  function seedWords(s) {
    var a = s.answers || {};
    var raw = [a.holiday, a.who, a.place, a.topic, a.detail, a.facts, a.memories, a.moment, a.happened, a.newTopic, a.name, a.chant, a.about].filter(Boolean).join(', ');
    return raw.split(/[,.;\n]+/).map(function (x) { return x.trim(); }).filter(function (x) { return x && x.length < 40; });
  }
  function sampleNextLines(s, slot) {
    var built = (s.built || []).filter(Boolean);
    var prev = built[built.length - 1] || '';
    var target = prev ? lineSyllables(prev) : 8;
    var seeds = seedWords(s);
    var who = /partner/i.test((s.answers || {}).who || '') ? 'my baby' : ((s.answers || {}).who && !/everyone|just me/i.test(s.answers.who) ? String(s.answers.who).toLowerCase() : 'all of us');
    var R = rhymesFor(lastWord(prev));
    var pick = function (list, n) { return list[(built.length * 7 + n) % list.length]; };
    var rhymeTpl = ['Our shadows spill like candle wax across ', 'The moon hangs low, a lantern over ', 'We wear the dark like velvet on '];
    var NOT_NOUN = /^(old|cold|bold|white|gray|sweet|loud|proud|small|tall|fine|bright|slow|dear|divine|mine|own|alone|tonight|away|okay|ago|below|alone|apart|around|down|high|why|goodbye|alive|enough|above|right|here|near|free|me|be|see|say|stay|go|know|try|fly|sing|bring|call|fall|start|hold|told|clear|own|found|most|amazes|everything|tomorrow|sway|play)$/;
    var nounish = R.filter(function (x) { return / /.test(x) || !NOT_NOUN.test(x); });
    var rhymeWord = nounish.length ? pick(nounish, 0) : '';
    if (rhymeWord && !/ /.test(rhymeWord)) rhymeWord = 'the ' + rhymeWord;
    var rhymeLine = rhymeWord ? pick(rhymeTpl, 1) + rhymeWord : 'We keep it going, ' + (R[0] || 'tonight');
    var holiday = /hallow/i.test((s.answers || {}).holiday || '') ? 'Halloween' : ((s.answers || {}).holiday || '');
    var contTpl = prev ? [(who === 'all of us' ? 'And we turn' : 'And ' + who + ' turns') + ' the ordinary into gold', 'Our laughter rises like sparks from a fire', 'Every heartbeat here becomes a drum', 'We hold the hour like a firefly in a jar'] : ['Here we go, the lights are coming on', 'Gather round, this is our song'];
    var twistTpl = holiday === 'Halloween' ? ['Then the lights went out and the sky put on a mask', 'A skeleton band strikes up the stars', 'The moon slips in wearing a borrowed face'] : ['Then the floor became an ocean and we learned to swim', 'The sky cracks open like a shaken bottle of light', 'Even the streetlights lean in to listen'];
    var cands = [
      fitSyllables(rhymeLine, target),
      fitSyllables(pick(contTpl, 2), target),
      fitSyllables(pick(twistTpl, 3), target)
    ];
    var out = dedupeLines(cands, built);
    var extra = [fitSyllables((nounish[1] ? 'All the way until we own ' + (/ /.test(nounish[1]) ? nounish[1] : 'the ' + nounish[1]) : 'All the way until the morning light'), target), fitSyllables('This is ours, ' + (seeds[0] ? seeds[0].toLowerCase() : 'we sing it loud'), target), fitSyllables('Say it one more time and make it count', target)];
    out = dedupeLines(out.concat(extra), built);
    // Pool running low: build more fresh follow-ons from the previous line.
    var leads = ['Hands up high, we are dancing in ', 'Every voice around us rising with ', 'Turn it up and let it carry through ', 'We will never lose ', 'Carry me back into ', 'Here we stand inside '];
    var more = [];
    nounish.concat(['the light', 'the night', 'the sound', 'the crowd', 'the fire']).forEach(function (n) { leads.forEach(function (l) { more.push(fitSyllables(l + (/ /.test(n) ? n : 'the ' + n), target)); }); });
    more = more.concat(['One more time, we let the feeling grow', 'Every story leads us right back here', 'No one saw this chapter coming', 'Then the whole world stopped to listen', 'Hold that thought and sing it louder', 'And the echo keeps on calling']);
    for (var mi = 0; out.length < 3 && mi < more.length; mi++) out = dedupeLines(out.concat([more[(mi + built.length * 5) % more.length]]), built);
    out = out.slice(0, 3);
    return out;
  }
  // ---------- Idea chips ----------
  function ideaSubject(s) {
    var a = s.answers || {};
    if (s.type === 'parody') return a.song ? ('the song "' + a.song + '"' + (a.artist ? ' by ' + a.artist : '')) : '';
    if (s.type === 'tribute' || s.type === 'roast') return a.name || a.who || '';
    return '';
  }
  function ideasPrompt(s) {
    var subj = ideaSubject(s);
    var real = /^(tribute|roast|parody)$/.test(s.type) && subj;
    return [
      real ? 'Subject: ' + subj + '.' : 'Song idea from the user: ' + (answersText(s) || '-'),
      real ? 'List 8 short idea chips (max 9 words each, do not start with the subject\'s name) of REAL, well-known, verifiable public facts about the subject: famous roles or works, famous quotes or catchphrases (paraphrase, never quote lyrics), iconic moments, eras, signature looks.' : 'List 8 short idea chips (max 9 words each) that enrich this idea with concrete images, places, sensory details and story beats.',
      real ? 'Only include facts you are confident are true and widely reported. If you are not sure, add " (unsure)" at the end. Never invent facts, crimes, illnesses or scandals.' : '',
      s.type === 'roast' ? 'Roast safety: nothing about race, ethnicity, religion, sexual orientation or disability; no minors; nothing about abuse or illness.' : '',
      'Return one chip per line, no numbering, no other text.'
    ].filter(Boolean).join('\n');
  }
  function sampleIdeas(s) {
    var subj = ideaSubject(s);
    if (subj && /^(tribute|roast)$/.test(s.type)) return ['Their most famous role', 'The catchphrase everyone repeats', 'The look people copy', 'The award night moment', 'Their early career era', 'The interview that went viral', 'What fans love most', 'The comeback chapter'];
    if (subj) return ['The big boast in the hook', 'The famous video scene', 'The era it came out in', 'The dance everyone did', 'The attitude in the verses', 'The surprise last chorus'];
    return ['A smell that brings it back', 'The light at that hour', 'Something someone said', 'A small object you kept', 'Where you were standing', 'The weather that day', 'A sound in the background', 'How it felt the morning after'];
  }
  function parseIdeas(text, s) {
    var subj = String(ideaSubject(s) || '').replace(/^the song "([^"]+)".*$/, '$1');
    var esc = subj.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return String(text || '').split('\n').map(function (l) { l = l.replace(/^[\d\-*.)\s]+/, '').replace(/^"|"$/g, '').trim(); if (esc) l = l.replace(new RegExp('^' + esc + '\\s+', 'i'), ''); return cap(l); })
      .filter(function (l) { return l && l.length <= 80; }).map(function (l) { return scrubOutput(l, s); }).filter(Boolean)
      .filter(function (l, i, arr) { return arr.indexOf(l) === i; }).slice(0, 8);
  }
  function sectionPrompt(s, section, idea, keep, song) {
    var n = String(section || '').split('\n').filter(function (l) { return l.trim(); }).length || 4;
    return songPrompt(Object.assign({}, s, { built: [] })) + '\n\n' + [
      'Full song so far:', song || '',
      'Rewrite only this section so it is built around a new idea: ' + idea + '.',
      'Section now:', section,
      keep && keep.length ? 'Keep these user lines exactly, word for word, in the same spots:\n' + keep.join('\n') : '',
      'Be poetic, not literal: metaphor and fresh images. Same number of lines (' + n + '), similar syllable counts, keep the rhyme scheme.',
      'Never repeat a line that appears elsewhere in the song. Return only the ' + n + ' lines.'
    ].filter(Boolean).join('\n');
  }
  function finishSection(text, s, section, keep, song) {
    var old = String(section || '').split('\n');
    var got = String(text || '').split('\n').map(function (l) { return l.replace(/^[\d\-*.)\s]+/, '').trim(); }).filter(function (l) { return l && !/^\[/.test(l); }).map(function (l) { return scrubOutput(l, s); }).filter(Boolean);
    var others = String(song || '').split('\n').filter(function (l) { return old.indexOf(l) === -1; });
    var out = [], pool = dedupeLines(got, others);
    old.forEach(function (l, i) {
      if ((keep || []).indexOf(l.trim()) !== -1) { out.push(l); return; }
      var next = pool.shift();
      if (!next) { var f = sampleNextLines(Object.assign({}, s, { built: others.concat(out) }), 'verse').filter(function (x) { return !out.some(function (o) { return nearDuplicate(o, x); }); }); next = f[0] || l; }
      out.push(next);
    });
    return out;
  }

  // ---------- Give me ideas: real stories turned into song angles ----------
  var IDEA_DOORS = [
    { id: 'news', label: 'In the news', small: 'Real stories from this week', tiles: [
      { id: 'top', label: 'Top stories', q: '' },
      { id: 'debate', label: 'Controversial / debated', q: '"sparks debate" OR backlash OR controversy -senate -campaign -candidate', debate: true },
      { id: 'expose', label: 'Whistleblowers & expos\u00e9s', q: 'whistleblower OR expos\u00e9 OR "conspiracy theory" OR investigation reveals', expose: true },
      { id: 'music', label: 'Music & AI music', q: '"AI music" OR musician OR "music industry"' }
    ] },
    { id: 'cause', label: 'What moves you', small: 'Pick a cause, get a real story', tiles: [
      { id: 'animals', label: 'Animals', q: 'animal rescue OR wildlife' },
      { id: 'kids', label: 'Kids & families', q: 'families OR parents OR children community' },
      { id: 'planet', label: 'The planet', q: 'climate OR environment OR conservation' },
      { id: 'justice', label: 'Justice & protest', q: 'protest OR civil rights OR court ruling', debate: true },
      { id: 'mind', label: 'Mental health', q: '"mental health"' },
      { id: 'love', label: 'Love & heartbreak', q: 'love story OR reunited OR wedding OR couple' },
      { id: 'money', label: 'Money & survival', q: 'rent OR wages OR "cost of living" OR layoffs' },
      { id: 'home', label: 'Hometown & community', q: 'neighbors OR "small town" OR community rallies' }
    ] }
  ];
  function ideaTile(id) {
    var out = null;
    IDEA_DOORS.forEach(function (d) { d.tiles.forEach(function (t) { if (t.id === id) out = Object.assign({ door: d.id }, t); }); });
    return out;
  }
  function newsIdeasPrompt(tile, stories) {
    return [
      'You turn real news stories into song ideas for indie songwriters. Category: ' + tile.label + '.',
      'Stories (headline, outlet, date). These are the ONLY facts you may use:',
      stories.map(function (st, i) { return i + '. ' + st.title + ' (' + st.source + ', ' + st.date + ')'; }).join('\n'),
      'Pick 3 stories on 3 different subjects with the strongest human feeling and write one idea for each.',
      'Rules:',
      '- Verified facts only. The story line must restate only what the headline says. Never add names, numbers, or details that are not in it.',
      '- The angle is a fresh, poetic song idea (max 14 words): a point of view, an image, a feeling. Not a news summary.',
      tile.debate ? '- This topic is debated. Give both sides fairly in "sides" (two short neutral lines). The artist picks the stance. Do not pick a side.' : '- If the story is debated, add both sides in "sides" and do not pick a side.',
      tile.expose ? '- Whistleblower and expos\u00e9 ideas use only documented, reported facts. Conspiracy theories are framed as questions, mystery or storytelling ("what if", "they say"), never stated as fact. Never accuse a real named person of a crime that is not on record.' : '',
      '- No attacks on religion or protected groups, no slurs, no minors as targets, no partisan cheerleading for any party or politician.',
      '- Skip stories about graphic violence, tragedy involving children, or anything that would exploit victims.',
      '- No em dashes.',
      'Return JSON only: [{"i": story number, "angle": "...", "story": "...", "sides": ["...", "..."] or []}]'
    ].filter(Boolean).join('\n');
  }
  function parseNewsIdeas(text, stories, tile) {
    var m = String(text || '').match(/\[[\s\S]*\]/); var arr;
    try { arr = m ? JSON.parse(m[0]) : []; } catch (e) { arr = []; }
    var used = {};
    var clean = function (x, n) { return String(x || '').replace(/\u2014|\u2013/g, ', ').replace(/\bsuno\b|\btonegrid\b/ig, '').replace(/\s+/g, ' ').trim().slice(0, n); };
    return (Array.isArray(arr) ? arr : []).map(function (o) {
      var i = Number(o && o.i); var st = stories[i];
      if (!st || used[i] || !o.angle) return null; used[i] = 1;
      var sides = Array.isArray(o.sides) ? o.sides.slice(0, 2).map(function (x) { return clean(x, 140); }).filter(Boolean) : [];
      if (tile && tile.debate && sides.length < 2) return null;
      return { angle: cap(clean(o.angle, 120).replace(/\bplay\b/ig, 'plai')), story: clean(o.story || st.title, 200), sides: sides.length === 2 ? sides : [], source: st.source, link: st.link, date: st.date };
    }).filter(Boolean).slice(0, 3);
  }
  var NO_STORIES = 'No fresh stories right now. Try again in a bit, or write from something in your own life.';
  function nextLinePrompt(s, slot, left) {
    var couplet = Number(left) >= 2;
    var built = (s.built || []).filter(Boolean);
    var prev = built[built.length - 1] || '';
    var gentle = s.sub === 'memory' || s.type === 'story';
    var head = songPrompt(s);
    return head + '\n\n' + [
      'Song so far (never repeat or closely echo any of these lines):', built.length ? built.map(function (l, i) { return (i + 1) + '. ' + l; }).join('\n') : '(nothing yet)',
      prev ? 'Previous line: "' + prev + '". Its last word is "' + lastWord(prev) + '". It has about ' + lineSyllables(prev) + ' syllables.' : 'This is the first line.',
      prev ? 'First, silently read the previous line on two levels: (1) concept: what it really means and the feeling under it; (2) aesthetic: its imagery, sound, rhythm, tone and word texture. Do not print this analysis.' : '',
      'Be poetic, not literal. Extend the concept and echo the aesthetic with metaphor and fresh concrete images. Never restate facts or list details.',
      'Write the next single line of the ' + slot + '. Give exactly 3 different options, each about the same syllable count as the previous line:',
      'RHYME: ends on a word that rhymes with "' + (lastWord(prev) || 'the title') + '"' + (gentle ? ' (a soft near rhyme or matching vowel sound is fine)' : '') + ' and follows the rhyme scheme (couplets).',
      (prev && rhymesFor(lastWord(prev)).length ? 'Rhyme endings that work for "' + lastWord(prev) + '": ' + rhymesFor(lastWord(prev)).slice(0, 6).join(', ') + ' (or any true rhyme of that exact word; do not end on the same word).' : ''),
      'CONTINUE: continues or answers the thought of the previous line (does not need to rhyme).',
      'TWIST: a surprising new image or turn that escalates the song (does not need to rhyme). All three must be clearly different from each other.',
      couplet ? 'Each option is a couplet: two lines that rhyme or flow together, joined with " / ". The first line follows the role above.' : 'Each option is a single line.',
      'Return exactly three lines, each starting with RHYME:, CONTINUE:, or TWIST:. No other text.'
    ].join('\n');
  }
  function parseNextLines(text) {
    var got = {};
    String(text || '').split('\n').forEach(function (l) { var m = l.match(/^\s*(RHYME|CONTINUE|TWIST)\s*:\s*(.+)$/i); if (m) got[m[1].toUpperCase()] = m[2].replace(/^"|"$/g, '').trim(); });
    return ['RHYME', 'CONTINUE', 'TWIST'].map(function (k) { return got[k] || ''; });
  }
  function coupletFor(first, s, used) {
    var R = rhymesFor(lastWord(first)).map(function (x) { return x.replace(/^the /, ''); }).filter(function (x) { return !/ /.test(x) && !/^(old|cold|bold|white|gray|sweet|loud|proud|small|tall|fine|bright|slow|dear|divine|mine|own|alone|tonight|away|okay|ago|below|apart|around|down|high|why|goodbye|alive|enough|above|right|here|near|free|me|be|see|say|stay|go|know|try|fly|sing|bring|call|fall|start|hold|told|clear|found|most|amazes|everything|tomorrow|sway|play|wire)$/.test(x); });
    var tails = ['And the night hums back across the ', 'Like a lantern lit inside the ', 'Where the echoes settle on the '];
    for (var i = 0; i < R.length * tails.length; i++) {
      var l = tails[i % tails.length] + R[Math.floor(i / tails.length) % R.length];
      if (!used.some(function (u) { return nearDuplicate(u, l); })) return l;
    }
    return '';
  }
  function finishNextLines(cands, s, slot, left) {
    var built = (s.built || []).filter(Boolean);
    var prev = built[built.length - 1] || '';
    var target = prev ? lineSyllables(prev) : 0;
    var couplet = Number(left) >= 2;
    var firsts = [], seconds = {};
    (cands || []).forEach(function (c) {
      if (!c) return; var parts = String(c).split(/\s+\/\s+/);
      if (target && Math.abs(lineSyllables(parts[0]) - target) > 5) return;
      firsts.push(parts[0]); if (parts[1]) seconds[parts[0]] = parts[1];
    });
    var out = dedupeLines(firsts, built);
    if (out.length < 3) out = dedupeLines(out.concat(sampleNextLines(s, slot)), built);
    out = out.slice(0, 3);
    if (!couplet) return out;
    var used = built.concat(out);
    return out.map(function (f) {
      var sec = seconds[f] && !used.some(function (u) { return nearDuplicate(u, seconds[f]); }) ? seconds[f] : coupletFor(f, s, used);
      if (!sec) return f; used.push(sec); return f + ' / ' + sec;
    });
  }

  function sampleLines(s, slot) { return sampleNextLines(s, slot); }
  function sampleLinesOld(s, slot) {
    var a = s.answers || {};
    var seed = firstBits(a.facts || a.memories || a.detail || a.happened || a.newTopic || s.title || 'tonight', 3);
    return [
      (seed[0] || 'Tonight') + ', yeah, we light it up',
      'Every time I think of ' + (a.name || 'you') + ', I smile',
      'Turn it up, this ' + (slot || 'line') + ' is ours',
    ];
  }
  function sampleBattle(s, round) {
    var facts = firstBits((s.answers || {}).facts, 3);
    var f = facts[round % Math.max(1, facts.length)] || 'your playlist';
    return ['You came here talking big, I hear it', cap(f) + '? Man, I can barely bear it', 'Round ' + round + ', and I am just warming', 'You hit snooze on bars like every morning', 'Plai on the beat, I keep it clean', 'Sharpest flow you ever seen', 'Take it easy, it is all in fun', 'But tally the score, I think I won'].join('\n');
  }
  function suggestTitle(s) {
    var a = s.answers || {};
    if (s.type === 'holiday') return (a.holiday || 'Holiday') + ' Lights';
    if (s.sub === 'occasion') return (a.day === 'Birthday' ? 'Happy Birthday, ' : 'For You, ') + (a.nick || a.name || 'Friend');
    if (s.sub === 'memory') return 'Still Here';
    if (s.sub === 'fan') return 'Thank You, ' + (a.name || 'You');
    if (s.type === 'roast') return 'Roast Session';
    if (s.type === 'hype') return (a.chant || 'Let\'s Go') + ' Anthem';
    if (s.type === 'kids') return (a.about || 'Sing') + ' Song';
    if (s.type === 'parody') return a.newTopic ? cap(a.newTopic).split(' ').slice(0, 4).join(' ') : 'The Flip Side';
    if (s.type === 'story') return 'The Day It Changed';
    return a.topic ? cap(a.topic) + ' Song' : 'My Jam';
  }
  function sampleFlip(text, s) {
    var f = s.flip || {};
    var keep = f.keep || [];
    if (f.slang === 'bay') { var bay = ['(get hyphy)', '(hella)', '(go dumb)']; var n = 0; return scrubOutput(String(text || '').split('\n').map(function (l) { if (!l.trim() || /^\[/.test(l.trim()) || keep.indexOf(l.trim()) !== -1) return l; return l + ' ' + bay[(n++) % 3]; }).join('\n'), s); }
    var add = { funny: '(okay but who asked)', dirty: '(if you know, you know)', sad: '(and it still hurts)', hype: '(let\'s go!)', surprise: '(plot twist)' }[f.vibe] || '';
    var lines = String(text || '').split('\n').map(function (l) {
      if (!l.trim() || /^\[/.test(l.trim()) || keep.indexOf(l.trim()) !== -1) return l;
      return add && Math.random() < 0.5 ? l + ' ' + add : l;
    });
    return scrubOutput(lines.join('\n'), s);
  }

  var CARDS = [
    { id: 'scratch', label: 'Start From Scratch', small: '8 games. Pick one and play.' },
    { id: 'fix', label: 'Fix My Song', small: 'Paste it. Plai tunes it up.' },
    { id: 'flip', label: 'Flip My Song', small: 'New genre, new vibe, same heart.' },
  ];
  var SAMPLE_NOTICE = 'Sample. The live writer is not connected here.';
  var PRICES = { song: 1, battle: 1, fixAll: 1, trim: 1, cleanup: 0, flip: 1, lines: 0, fixLine: 0, sound: 0, human: 0 };

  return {
    tripRules: tripRules, tripStyle: tripStyle, tripClean: tripClean, TRIP_DEVICES: TRIP_DEVICES,
    CARDS: CARDS, TYPES: TYPES, SUBS: SUBS, QUESTIONS: QUESTIONS, GENRES: GENRES, INSTRUMENTS: INSTRUMENTS, VOCALS: VOCALS, VIBES: VIBES,
    AI_LEVELS: AI_LEVELS, OFF_CHIPS: OFF_CHIPS, FLIP_VIBES: FLIP_VIBES, CRISIS: CRISIS, SAMPLE_NOTICE: SAMPLE_NOTICE, PRICES: PRICES, HOLIDAY_SOUND: HOLIDAY_SOUND,
    questionsFor: questionsFor, baseSound: baseSound, stylePrompt: stylePrompt, fusionStyle: fusionStyle, flipStyle: flipStyle, FUSION_KIT: FUSION_KIT, stripNames: stripNames,
    syllables: syllables, lineSyllables: lineSyllables, splitLyrics: splitLyrics, syllableFlags: syllableFlags, songScore: songScore,
    crisis: crisis, explicitAllowed: explicitAllowed, needsExplicit: needsExplicit, checkInput: checkInput, scrubOutput: scrubOutput, aiLabel: aiLabel,
    BASE_RULES: BASE_RULES, songPrompt: songPrompt, linesPrompt: linesPrompt, fixPrompt: fixPrompt, parseLineOptions: parseLineOptions, CHIP_FOCUS: CHIP_FOCUS, chipFocus: chipFocus, focusLines: focusLines, fixTargets: fixTargets, keepUntouched: keepUntouched, lineSections: lineSections, TRIM_LEVELS: TRIM_LEVELS, trimLevel: trimLevel, trimPrompt: trimPrompt, cleanupPrompt: cleanupPrompt, countWords: countWords, alignDraft: alignDraft, draftText: draftText, applyCuts: applyCuts, parseCutList: parseCutList, applyCutList: applyCutList, cutCount: cutCount, isRewriteLevel: isRewriteLevel, lineTargets: lineTargets, rewritePrompt: rewritePrompt, parseRewrites: parseRewrites, chooseRewrites: chooseRewrites, nearSpelling: nearSpelling, fixTags: fixTags, originalSections: originalSections, judgePrompt: judgePrompt, dropJudged: dropJudged, checkRewrite: checkRewrite, applyRewrites: applyRewrites, checkSong: checkSong, rawWords: rawWords, localLines: localLines, localTrimDraft: localTrimDraft, flipPrompt: flipPrompt, battlePrompt: battlePrompt, researchPrompt: researchPrompt, ideasPrompt: ideasPrompt, IDEA_DOORS: IDEA_DOORS, ideaTile: ideaTile, newsIdeasPrompt: newsIdeasPrompt, parseNewsIdeas: parseNewsIdeas, NO_STORIES: NO_STORIES, sectionPrompt: sectionPrompt, finishSection: finishSection, sampleIdeas: sampleIdeas, parseIdeas: parseIdeas, nextLinePrompt: nextLinePrompt, parseNextLines: parseNextLines, finishNextLines: finishNextLines, sampleNextLines: sampleNextLines, rhymesFor: rhymesFor, nearDuplicate: nearDuplicate, dedupeLines: dedupeLines, TUNE: TUNE, SHAPE_LABEL: SHAPE_LABEL, voiceDescriptor: voiceDescriptor, tuneBits: tuneBits, normalizeSound: normalizeSound, vibeShape: vibeShape, GENRE_KIT: GENRE_KIT, FUSION_PAIRS: FUSION_PAIRS, celebResearchPrompt: celebResearchPrompt, roastAmmo: roastAmmo, baseRules: baseRules, roastExplicit: roastExplicit, parodyAngles: parodyAngles, normalizeAngles: normalizeAngles, tiedToOriginal: tiedToOriginal,
    sampleSong: sampleSong, sampleLines: sampleLines, sampleBattle: sampleBattle, sampleFlip: sampleFlip, suggestTitle: suggestTitle,
  };
});
