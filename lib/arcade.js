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
    { id: 'story', label: 'Storyteller', small: 'Diary to song' },
    { id: 'hype', label: 'Hype Anthem', small: 'Chant it loud' },
    { id: 'holiday', label: 'Holiday Hits', small: 'The holiday sets the sound' },
    { id: 'kids', label: 'Kids Song', small: 'Clean, catchy, and moves' },
  ];
  var SUBS = {
    occasion: 'Special Occasion', memory: 'In Memory Of', fan: 'Fan Song',
    friend: 'My friend', self: 'Myself', celeb: 'A celeb or public figure', battle: 'Battle the Bot',
  };

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
    'Tiny (0 to 2)': { genre: 'Kids', sub: 'Lullaby', bpm: 65, inst: 'music box', vocal: 'soft female vocal' },
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
    if (s.type === 'story' && STORY_SOUND[a.ending]) base = clone(STORY_SOUND[a.ending]);
    if (s.type === 'kids') {
      if (KIDS_AGE[a.age]) base = clone(KIDS_AGE[a.age]);
      if (a.about === 'Bedtime') { base.bpm = 66; base.sub = 'Lullaby'; base.inst = 'music box, soft strings'; }
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
    'Electronic': { sub: 'UK garage', era: 'late 90s', bpm: 134, texture: 'chopped pitched vocal, shuffled 2-step hats, warm reese bass', inst: 'organ stabs, sub bass, chopped vocal', production: 'sidechain on the bass, short gated reverb, sub-bass felt under 60 Hz', arrangement: 'build and switch up, vocal chop as the hook', kick: 'syncopated 2-step kick, off the downbeat', vocal: 'chopped vocal hooks' },
    'Latin': { sub: 'Reggaeton', era: 'modern', bpm: 94, texture: 'dembow snare pattern, nylon guitar plucks', inst: 'dembow drums, deep bass, nylon guitar', production: 'tight compressed vocal, reverb snaps, wide percussion', arrangement: 'call and response hook, perreo breakdown', kick: 'dembow kick and snare pattern', vocal: 'smooth sing-rap, call outs' },
    'Gospel': { sub: 'Contemporary gospel', era: 'modern', bpm: 72, texture: 'Hammond organ with Leslie swirl, choir swells', inst: 'Hammond, choir, live drums, piano', production: 'big church hall reverb, choir panned wide, lead up front', arrangement: 'vamp section, key change lift, call and response with the choir', kick: 'live kick, half time feel', vocal: 'powerful lead with choir answers' },
    'Acoustic': { sub: 'Singer songwriter', era: 'timeless', bpm: 68, texture: 'fingerpicked guitar with string squeaks left in', inst: 'fingerpicked guitar, soft piano, cello', production: 'close ribbon mic, no compression feel, small room reverb, vocal intimate and dry', arrangement: 'no drums until the last chorus, melody stays low then lifts', kick: 'no kick', vocal: 'intimate breathy vocal' },
    'Reggae': { sub: 'Roots reggae', era: '70s', bpm: 74, texture: 'off-beat skank guitar, organ bubble, deep dub bass', inst: 'skank guitar, dub bass, one drop drums, organ', production: 'spring reverb, tape echo throws, bass loud and round', arrangement: 'dub breakdown with echo throws', kick: 'one drop kick on beat three', vocal: 'laid back melodic vocal' },
    'Kids': { sub: 'Kids pop', era: 'modern', bpm: 112, texture: 'ukulele strums, glockenspiel sparkles, handclaps', inst: 'ukulele, glockenspiel, handclaps', production: 'bright, clean, close vocals', arrangement: 'call and response, chorus returns three times', kick: 'simple bouncy kick', vocal: 'cheerful group vocal' }
  };
  // Unusual techniques seeded per song, so prompts do not collapse into pop defaults.
  var SEEDS = ['shoegaze reverb tails on the backing vocals', 'breakbeat drums chopped under the verse', 'tape stop before the hook', 'detuned music box countermelody', 'reverse reverb swells into each section', 'field recording texture under the intro', 'pitched down vocal doubling the lead', 'bitcrushed percussion in the bridge', 'choir pad sampled and stretched', 'drum machine and live kit trading bars'];

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
    { inst: 'chiptune 8 bit leads', vocal: 'robotic talkbox', arr: 'video game level up key change', mood: 'retro arcade twist', bpm: 12 },
    { inst: 'barbershop quartet, upright bass', vocal: 'four part harmony', arr: 'a cappella intro', mood: 'old timey twist', bpm: -10 },
    { inst: 'sitar, tabla, synth bass', vocal: 'dreamy chant', arr: 'psychedelic breakdown', mood: 'trippy twist' }
  ];
  function vibeKey(s) {
    var f = s.flip || {};
    if (s.card === 'flip' && f.vibe) return f.vibe === 'surprise' ? 'surprise' : (f.level ? f.vibe + '-' + f.level : (f.vibe === 'funny' ? 'funny-Silly' : (f.vibe === 'dirty' ? 'dirty-Flirty' : f.vibe)));
    var a = s.answers || {};
    if (s.type === 'roast' && (a.spice === 'Spicy' || a.spice === 'Medium')) return 'roast-' + a.spice;
    return s.vibe || '';
  }
  function hashStr(t) { var h = 0; String(t || '').split('').forEach(function (c) { h = (h * 31 + c.charCodeAt(0)) >>> 0; }); return h; }
  function vibeShape(s) {
    var k = vibeKey(s);
    if (k === 'surprise') { var a = s.answers || {}; return SURPRISE[hashStr((a.song || '') + (a.name || '') + (s.title || '') + ((s.flip && s.flip.text) || '').slice(0, 40)) % SURPRISE.length]; }
    return VIBE_SHAPE[k] || null;
  }

  // Optional Fine-tune panel. Words, not numbers, unless the user types a BPM.
  var TUNE = {
    speed: ['Slow', 'Mid', 'Upbeat', 'Fast'],
    vocals: ['Solo', 'Duet', 'Band with backing vocals', 'Choir'],
    gender: ['Male', 'Female', 'Any'],
    tone: ['Raspy', 'Smooth', 'Airy'],
    must: ['Piano', 'Acoustic guitar', 'Electric guitar', '808s', 'Strings', 'Horns', 'Synths', 'Live drums', 'Bass guitar', 'Organ'],
    energy: ['Steady', 'Slow build', 'Big drop', 'Quiet to loud']
  };
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

  function stylePrompt(s, sound) {
    var p = sound || {};
    var b = Object.assign(baseSound(s), p.base || {});
    if (p.genre && p.genre !== b.genre && GENRE_KIT[p.genre] && !(p.fusion && p.fusion.length === 2)) b = Object.assign({ genre: p.genre }, GENRE_KIT[p.genre], b.key ? { key: b.key } : {});
    var v = vibeShape(s) || {};
    var a0 = s.answers || {};
    var seed = SEEDS[hashStr((a0.song || '') + (a0.artist || '') + (a0.name || '') + (s.title || '') + vibeKey(s)) % SEEDS.length];
    var genre = p.fusion && p.fusion.length === 2 ? (p.fusion[0] + ' meets ' + p.fusion[1] + ' fusion') : (p.genre || b.genre);
    var sub = p.sub || (p.genre && p.genre !== b.genre && !GENRE_KIT[p.genre] ? '' : b.sub);
    var bpm = Math.max(55, Math.min(190, (Number(p.bpm) || Number(b.bpm) || 100) + (Number(v.bpm) || 0)));
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
    var tempo = tb.bpm ? tb.bpm + ' bpm' : (tb.speed || ('BPM ' + bpm));
    var head = [
      t.must && t.must.length ? 'must have ' + t.must.join(', ').toLowerCase() : '',
      b.texture || '',
      inst,
      kick,
      b.production || '',
      sublow,
      tb.voice,
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
    return out;
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
      return true;
    });
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
      built.length ? 'Lines the user already picked or wrote. Keep them exactly:\n' + built.join('\n') : '',
      'Return lyrics only.',
    ].filter(Boolean).join('\n');
  }

  function linesPrompt(s, slot) {
    return songPrompt(s) + '\n\nNow write exactly 3 different options for the next single line of the ' + slot + '. One per line, no numbering, no tags.';
  }

  function fixPrompt(text, off, line) {
    if (line) return 'Here is a song:\n' + text + '\n\nRewrite only this line 3 different ways. Keep the meaning, match the syllable count of nearby lines, keep any rhyme spot. One per line, no numbering:\n' + line;
    return 'Fix this song. What feels off: ' + (off.join(', ') || 'general polish') + '.\nKeep the writer\'s voice, their best lines, and the hook. Fix syllable balance between matching lines. Keep section tags. Return the full fixed song only.\n\n' + text;
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
    var facts = firstBits(a.facts || a.memories || a.detail || a.happened || a.moment || a.newTopic || '', 4);
    while (facts.length < 4) facts.push(['We keep it moving', 'Every single day', 'Turn the volume up', 'This one is for you'][facts.length]);
    var name = a.name || a.chant || a.nick || '';
    var hook = name ? cap(title) + ', ' + name : cap(title);
    var built = (s.built || []).filter(Boolean);
    var verse1 = built.length ? built.slice(0, 4) : [facts[0], facts[1], 'I remember every part', 'Held it close inside my heart'];
    var out = ['[Verse 1]'].concat(verse1, ['', '[Chorus]', hook, cap(a.saying || a.love || 'This one is for you'), hook, 'Sing it back to me', '', '[Verse 2]', facts[2], facts[3], 'Still the same old melody', 'Playing loud for you and me', '', '[Chorus]', hook, cap(a.saying || a.love || 'This one is for you'), hook, 'Sing it back to me']);
    return scrubOutput(out.join('\n'), s);
  }
  function sampleLines(s, slot) {
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
  var PRICES = { song: 1, battle: 1, fixAll: 1, flip: 1, lines: 0, fixLine: 0, sound: 0, human: 0 };

  return {
    CARDS: CARDS, TYPES: TYPES, SUBS: SUBS, QUESTIONS: QUESTIONS, GENRES: GENRES, INSTRUMENTS: INSTRUMENTS, VOCALS: VOCALS, VIBES: VIBES,
    AI_LEVELS: AI_LEVELS, OFF_CHIPS: OFF_CHIPS, FLIP_VIBES: FLIP_VIBES, CRISIS: CRISIS, SAMPLE_NOTICE: SAMPLE_NOTICE, PRICES: PRICES, HOLIDAY_SOUND: HOLIDAY_SOUND,
    questionsFor: questionsFor, baseSound: baseSound, stylePrompt: stylePrompt, stripNames: stripNames,
    syllables: syllables, lineSyllables: lineSyllables, splitLyrics: splitLyrics, syllableFlags: syllableFlags, songScore: songScore,
    crisis: crisis, explicitAllowed: explicitAllowed, needsExplicit: needsExplicit, checkInput: checkInput, scrubOutput: scrubOutput, aiLabel: aiLabel,
    BASE_RULES: BASE_RULES, songPrompt: songPrompt, linesPrompt: linesPrompt, fixPrompt: fixPrompt, flipPrompt: flipPrompt, battlePrompt: battlePrompt, researchPrompt: researchPrompt, TUNE: TUNE, tuneBits: tuneBits, normalizeSound: normalizeSound, vibeShape: vibeShape, GENRE_KIT: GENRE_KIT, celebResearchPrompt: celebResearchPrompt, roastAmmo: roastAmmo, baseRules: baseRules, roastExplicit: roastExplicit, parodyAngles: parodyAngles, normalizeAngles: normalizeAngles, tiedToOriginal: tiedToOriginal,
    sampleSong: sampleSong, sampleLines: sampleLines, sampleBattle: sampleBattle, sampleFlip: sampleFlip, suggestTitle: suggestTitle,
  };
});
