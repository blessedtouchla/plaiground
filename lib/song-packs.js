'use strict';

/**
 * Genre packs for PLAIGROUND Song Helper.
 * Data only. Add a pack here and the page picks it up without a code change.
 * Never put real artist names in this file.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SongPacks = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var LOOKS = ['photo', 'painted', 'illustrated', 'collage', 'minimal'];
  var ERAS = ['90s', '2000s', '2010s', 'now', 'timeless'];
  var ENERGIES = ['low', 'medium', 'high', 'building'];
  var INSTRUMENTS = ['piano', 'electric piano', 'acoustic guitar', 'electric guitar', '808s', 'live drums', 'bass', 'synth', 'strings', 'brass', 'organ'];

  var COMEDY_TYPES = [
    { id: 'roast', label: 'Birthday roast (friendly)', short: 'birthday roast' },
    { id: 'food', label: 'Ode to a food or snack', short: 'food ode' },
    { id: 'pet', label: 'Pet anthem', short: 'pet anthem' },
    { id: 'breakup', label: 'Petty breakup song', short: 'petty breakup' },
    { id: 'work', label: 'Work or school rant', short: 'work rant' },
    { id: 'family', label: 'Family chaos', short: 'family chaos' },
    { id: 'tiny', label: 'Over-dramatic song about something tiny', short: 'tiny disaster' },
  ];

  var COMEDY_MUSIC = [
    { id: 'country', label: 'Country comedy', genre: 'country comedy', era: 'timeless', energy: 'medium', instruments: ['acoustic guitar', 'bass'] },
    { id: 'rap', label: 'Rap comedy', genre: 'rap comedy', era: 'now', energy: 'high', instruments: ['808s', 'bass', 'synth'] },
    { id: 'ballad', label: 'Power ballad', genre: 'power ballad', era: '2000s', energy: 'building', instruments: ['piano', 'electric guitar', 'live drums'] },
    { id: 'pop', label: 'Pop', genre: 'pop comedy', era: 'now', energy: 'high', instruments: ['synth', 'live drums', 'bass'] },
    { id: 'rnb', label: 'R&B', genre: 'R&B comedy', era: '2010s', energy: 'medium', instruments: ['electric piano', 'bass'] },
    { id: 'rock', label: 'Rock', genre: 'rock comedy', era: '2000s', energy: 'high', instruments: ['electric guitar', 'live drums', 'bass'] },
  ];

  function prompt(key, hint, kind, variants) {
    return { key: key, hint: hint, kind: kind, variants: variants };
  }

  function pair(label, placeholder, label2, placeholder2) {
    return [
      { label: label, placeholder: placeholder },
      { label: label2, placeholder: placeholder2 },
    ];
  }

  var PACKS = [
    {
      id: 'hiphop',
      name: 'Hip-hop',
      wordHelp: 'Pictures from your block. A short phrase or a full line. It shows up in the draft exactly as you write it.',
      coverLook: 'collage',
      style: { genre: 'Hip-hop', era: 'now', energy: 'high', instruments: ['808s', 'bass', 'synth'] },
      prompts: [
        prompt('cameup', 'A block, a building, a kitchen table.', 'place', pair(
          'Where you came up', 'second floor, end of the avenue',
          'The block that raised you', 'a two-bedroom off the main street'
        )),
        prompt('prove', 'The doubt you had to answer.', 'tone', pair(
          'The thing you had to prove', 'that I would finish what I started',
          'What they said you could not do', 'stay in school and still eat'
        )),
        prompt('flex', 'Only a win you can stand on.', 'tone', pair(
          'A flex that is actually true', 'I paid the light bill on time',
          'The win you can back up', 'three jobs and I still made the show'
        )),
        prompt('blocksound', 'What the street sounds like.', 'image', pair(
          'The sound of your block', 'a bass from a parked car',
          'What the street sounds like at night', 'dice, a laugh, a screen door'
        )),
        prompt('changeday', 'The day the story turned.', 'time', pair(
          'The day it changed', 'the morning the letter came',
          'The morning everything shifted', 'a Tuesday I still remember'
        )),
        prompt('nickname', 'What your people yell.', 'tone', pair(
          'The name they call you', 'Junior, even now',
          'What your people yell from the stoop', 'ay, you made it'
        )),
        prompt('pocket', 'Something you actually carry.', 'object', pair(
          'Something in your pocket', 'a folded bus transfer',
          'What you keep on you', 'my house key on a shoestring'
        )),
        prompt('night', 'When the city gets honest.', 'time', pair(
          'A time of night', 'after the last bus',
          'When the block gets quiet', 'just past one'
        )),
      ],
    },
    {
      id: 'rnb',
      name: 'R&B',
      wordHelp: 'Keep it close. Describe a sound if a song was playing, and leave the title out. Your phrase stays word for word.',
      coverLook: 'photo',
      style: { genre: 'R&B', era: '2010s', energy: 'medium', instruments: ['electric piano', 'bass'] },
      prompts: [
        prompt('night', 'The hour, not the date.', 'time', pair(
          'The time of night', '2:14 and the lamp is still on',
          'How late it got', 'blue numbers on the stove'
        )),
        prompt('smell', 'Their skin, the room, the pillow.', 'image', pair(
          'What they smelled like', 'cocoa butter and cold air',
          'The scent they left', 'warm cologne on a coat'
        )),
        prompt('unsent', 'The text, as you would have typed it.', 'tone', pair(
          'A text you never sent', 'come back, the door is unlocked',
          'The message still in drafts', 'I was not done talking'
        )),
        prompt('playing', 'Describe the sound. Leave the song title out.', 'image', pair(
          'The sound that was playing', 'a slow drum and a soft vocal',
          'What the speaker was doing', 'low piano, barely there'
        )),
        prompt('color', 'On them, or in the room.', 'color', pair(
          'A color on them or in the room', 'gold hoop, dim red',
          'The color you still see', 'burgundy on the sheet'
        )),
        prompt('left', 'An object, not a speech.', 'object', pair(
          'Something they left behind', 'one earring on the sink',
          'What is still in the room', 'a glass with the ice melted'
        )),
        prompt('after', 'The quiet, or the noise.', 'image', pair(
          'What the room sounded like after', 'the fridge and my own breath',
          'The sound once the door shut', 'keys, then nothing'
        )),
      ],
    },
    {
      id: 'country',
      name: 'Country',
      wordHelp: 'Hometown details. A road, a porch, a habit. Write it the way you would tell it.',
      coverLook: 'photo',
      style: { genre: 'Country', era: 'timeless', energy: 'medium', instruments: ['acoustic guitar', 'bass'] },
      prompts: [
        prompt('road', 'The road you can drive with your eyes closed.', 'place', pair(
          'Your hometown road', 'county road 6, past the silo',
          'The stretch you know by heart', 'two lanes and a blinking light'
        )),
        prompt('porch', 'Truck bed or porch, whichever holds the story.', 'object', pair(
          'What is in the truck bed or on the porch', 'a cooler and a busted chair',
          'What is sitting out there', 'muddy boots by the step'
        )),
        prompt('drink', 'The one that belongs in the song.', 'object', pair(
          'The drink', 'sweet tea in a gas-station cup',
          'What is in the cup', 'black coffee from the diner'
        )),
        prompt('sunday', 'A habit, not a sermon.', 'tone', pair(
          'The Sunday habit', 'calling home after the dishes',
          'What Sundays look like', 'the same booth, the same pie'
        )),
        prompt('weather', 'The sky that day.', 'weather', pair(
          'The weather that day', 'heat sitting on the gravel',
          'What the sky was doing', 'a storm you could smell coming'
        )),
        prompt('passenger', 'A nickname is plenty.', 'tone', pair(
          'Who was in the passenger seat', 'my old man, window down',
          'Who rode with you', 'her, barefoot on the dash'
        )),
        prompt('saying', 'Something people at home actually say.', 'tone', pair(
          'A saying from home', 'it will hold if you mean it',
          'What they always told you', 'lock the gate on your way out'
        )),
      ],
    },
    {
      id: 'pop',
      name: 'Pop',
      wordHelp: 'The bright details. A moment, an outfit, one feeling. Your words stay as you typed them.',
      coverLook: 'illustrated',
      style: { genre: 'Pop', era: 'now', energy: 'high', instruments: ['synth', 'live drums', 'bass'] },
      prompts: [
        prompt('knew', 'The second, not the whole month.', 'time', pair(
          'The moment you knew', 'when the chorus hit and you looked over',
          'The second it clicked', 'halfway through the second song'
        )),
        prompt('outfit', 'What you or they had on.', 'object', pair(
          'The outfit', 'silver jacket, scuffed shoes',
          'What they were wearing', 'a red top and borrowed earrings'
        )),
        prompt('dance', 'A room, a street, a kitchen.', 'place', pair(
          'The place you would dance', 'the parking lot behind the venue',
          'Where you would dance it out', 'your bedroom with the door shut'
        )),
        prompt('feeling', 'One word if you have it. A short phrase is fine.', 'tone', pair(
          'The one-word feeling', 'electric',
          'The feeling in one word', 'reckless'
        )),
        prompt('color', 'A color you can point at.', 'color', pair(
          'A color', 'hot pink light',
          'The color of that night', 'white strobe'
        )),
        prompt('time', 'When it happened.', 'time', pair(
          'A time', 'just before midnight',
          'What time it was', 'the last song of the set'
        )),
        prompt('shout', 'The line you would yell back.', 'tone', pair(
          'The line you would shout', 'I am still here',
          'The chorus you would yell', 'say it again, louder'
        )),
      ],
    },
    {
      id: 'latin',
      name: 'Latin',
      wordHelp: 'Reggaeton, corrido, or bachata — your call. English, Spanish, or both. A family saying can stay in the language you heard it.',
      coverLook: 'collage',
      style: { genre: 'Latin', era: 'now', energy: 'high', instruments: ['bass', 'brass', 'live drums'] },
      prompts: [
        prompt('barrio', 'The barrio, the town, the block.', 'place', pair(
          'The barrio or the town', 'la esquina where the lights stay on',
          'Where the story lives', 'un pueblo with one main street'
        )),
        prompt('saying', 'What the family actually says.', 'tone', pair(
          'The family saying', 'échale ganas, mijo',
          'What they repeat at the table', 'primero la familia'
        )),
        prompt('dance', 'The dance, named or described.', 'image', pair(
          'The dance', 'a bachata in the kitchen',
          'How the room moves', 'two steps and a turn'
        )),
        prompt('fiesta', 'The car, the fiesta, the patio.', 'place', pair(
          'The car or the fiesta', 'a white car with the doors open',
          'Where everybody ended up', 'the patio with the string lights'
        )),
        prompt('kitchen', 'A smell from somebody’s kitchen.', 'image', pair(
          'A smell from the kitchen', 'sofrito and coffee',
          'What the house smelled like', 'plátanos and clean soap'
        )),
        prompt('night', 'The hour the night got good.', 'time', pair(
          'A time of night', 'después de las diez',
          'When the fiesta really started', 'once the kids were asleep'
        )),
        prompt('tell', 'Spanish, English, or both.', 'tone', pair(
          'What you would say, in Spanish or English', 'te lo digo de frente',
          'The line you would actually say', 'I am not leaving the dance'
        )),
      ],
    },
    {
      id: 'rock',
      name: 'Rock',
      wordHelp: 'Rock or punk. What you are done with, and where you would say it. Keep it a song.',
      coverLook: 'painted',
      style: { genre: 'Rock', era: '2000s', energy: 'high', instruments: ['electric guitar', 'live drums', 'bass'] },
      prompts: [
        prompt('done', 'The thing you are finished with.', 'tone', pair(
          'The thing you are done with', 'being the quiet one in the back',
          'What you are finished explaining', 'why I needed the night off'
        )),
        prompt('rule', 'A rule you would break out loud.', 'tone', pair(
          'The rule you would break', 'no loud music after ten',
          'The rule that never fit', 'sit still and look grateful'
        )),
        prompt('scream', 'A room, a roof, a parking lot.', 'place', pair(
          'Where you would scream it', 'the parking garage, top level',
          'Where it would echo', 'an empty rehearsal room'
        )),
        prompt('noise', 'The noise in the song.', 'image', pair(
          'The noise', 'a feedback squeal and a kicked door',
          'What the room sounds like', 'sticks on a snare, too fast'
        )),
        prompt('yell', 'A nickname. Somebody you know.', 'tone', pair(
          'Who you are yelling at', 'hey, boss',
          'The nickname in the shout', 'Captain, you missed it'
        )),
        prompt('night', 'Which night.', 'time', pair(
          'The night', 'a Thursday that ran too late',
          'When it boiled over', 'last call, still outside'
        )),
        prompt('object', 'An object in the room. Keep it a song.', 'object', pair(
          'An object in the room', 'a cracked guitar pick',
          'The thing on the table', 'a set list with the last song crossed out'
        )),
      ],
    },
    {
      id: 'gospel',
      name: 'Gospel',
      wordHelp: 'What you got through, who carried you, and the promise. Plain speech is enough.',
      coverLook: 'painted',
      style: { genre: 'Gospel', era: 'timeless', energy: 'building', instruments: ['organ', 'piano'] },
      prompts: [
        prompt('through', 'The hard thing, in your words.', 'tone', pair(
          'What you got through', 'a year I did not think I would finish',
          'The night you made it past', 'the hospital hallway at dawn'
        )),
        prompt('carried', 'A person, by a name you use.', 'tone', pair(
          'Who carried you', 'my auntie, on the phone every morning',
          'The person who held you up', 'Mama, humming in the kitchen'
        )),
        prompt('promise', 'The promise you are standing on.', 'tone', pair(
          'The promise', 'I will not go back to that silence',
          'What you are holding onto', 'morning still comes'
        )),
        prompt('morning', 'A morning you remember.', 'time', pair(
          'A morning', 'Sunday, light on the pews',
          'The hour it got quiet', 'just before sunrise'
        )),
        prompt('breathe', 'A place you pray, or just breathe.', 'place', pair(
          'A place you pray or breathe', 'the back step, hands open',
          'Where you go to get still', 'a parked car with the radio off'
        )),
        prompt('singback', 'A line you would sing back.', 'tone', pair(
          'A line you would sing back', 'I am still standing',
          'The line that answers you', 'keep going, I am here'
        )),
        prompt('light', 'A color of light.', 'color', pair(
          'A color of light', 'gold through dusty glass',
          'The light in the room', 'warm white, almost amber'
        )),
      ],
    },
    {
      id: 'lofi',
      name: 'Lo-fi',
      wordHelp: 'Small on purpose. Weather, a room, a ritual. Short phrases work.',
      coverLook: 'minimal',
      style: { genre: 'Lo-fi', era: 'now', energy: 'low', instruments: ['electric piano', 'piano'] },
      prompts: [
        prompt('weather', 'Outside the window.', 'weather', pair(
          'The weather', 'rain on a bus window',
          'What is happening outside', 'gray sky, no hurry'
        )),
        prompt('room', 'The room you are actually in.', 'place', pair(
          'The room', 'a desk by a small window',
          'Where you are sitting', 'the corner with the plant'
        )),
        prompt('ritual', 'The small thing you repeat.', 'tone', pair(
          'The small ritual', 'boiling water before I answer anyone',
          'The little thing you repeat', 'rewinding the same four bars'
        )),
        prompt('sound', 'A quiet sound.', 'image', pair(
          'A sound', 'a radiator ticking',
          'What you can hear', 'pages and a distant train'
        )),
        prompt('time', 'A time of day.', 'time', pair(
          'A time of day', 'late afternoon',
          'When this happens', 'the hour before dinner'
        )),
        prompt('drink', 'Whatever is in the mug.', 'object', pair(
          'The drink', 'tea that went cold',
          'What is in the cup', 'oat milk, too much'
        )),
        prompt('light', 'The light, not a metaphor yet.', 'color', pair(
          'The light', 'a lamp with a warm bulb',
          'How the room is lit', 'one screen and the streetlight'
        )),
      ],
    },
    {
      id: 'comedy',
      name: 'Comedy',
      wordHelp: 'Silly on purpose. You still type every answer. Original jokes only, and roasts stay kind.',
      coverLook: 'illustrated',
      style: { genre: 'pop comedy', era: 'now', energy: 'high', instruments: ['synth', 'live drums', 'bass'] },
      prompts: [
        prompt('habit', 'Weird, specific, and harmless.', 'tone', pair(
          'A weird habit', 'names every pigeon on the block',
          'The odd thing they always do', 'apologizes to the microwave'
        )),
        prompt('embarrass', 'The story they will never live down.', 'tone', pair(
          'An embarrassing moment', 'waved back at a mannequin',
          'The moment you still bring up', 'replied-all to the whole office'
        )),
        prompt('phrase', 'Something they actually say.', 'tone', pair(
          'A catchphrase', 'that is a tomorrow problem',
          'The line they repeat', 'we are not doing this today'
        )),
        prompt('object', 'Any object. The sillier the better.', 'object', pair(
          'A random object', 'a single uncooked noodle',
          'The prop in the song', 'a loyalty card with one stamp'
        )),
        prompt('villain', 'Someone you know, or an object. Leave celebrities out.', 'tone', pair(
          'The exaggerated villain', 'the group chat, named Brenda',
          'Who or what is the villain', 'a houseplant that judges me'
        )),
        prompt('tiny', 'The small thing that became the whole song.', 'object', pair(
          'The tiny thing that became huge', 'the last slice of pizza',
          'The small disaster', 'a crumb in the butter'
        )),
        prompt('star', 'A snack, a pet, or a coworker nickname.', 'tone', pair(
          'The snack, pet, or coworker', 'a goldfish named Payroll',
          'Who this anthem is really for', 'the office granola bar'
        )),
      ],
    },
  ];

  var GENERIC = {
    id: 'generic',
    name: 'Song',
    wordHelp: 'Short phrases or full lines. They show up in the draft exactly as you write them.',
    coverLook: 'photo',
    style: { genre: '', era: '', energy: '', instruments: [] },
    prompts: [
      prompt('place', 'A short phrase or a full line.', 'place', pair(
        'A place', 'the kitchen at 2am',
        'Where it happened', 'the hallway with the bad light'
      )),
      prompt('room', 'Something you could point at.', 'object', pair(
        'Something in the room', 'your hoodie on the chair',
        'An object that matters', 'a chipped mug'
      )),
      prompt('color', 'A color you can see.', 'color', pair(
        'A color', 'faded red',
        'The color in the picture', 'neon on wet pavement'
      )),
      prompt('smell', 'A smell, plain as you can.', 'image', pair(
        'A smell', 'cold coffee',
        'What it smelled like', 'rain on concrete'
      )),
      prompt('sound', 'A sound in the room.', 'image', pair(
        'A sound', 'the fridge humming',
        'What you heard', 'a bus pulling off'
      )),
      prompt('time', 'A time of day.', 'time', pair(
        'A time of day', 'just after midnight',
        'When it was', 'blue hour'
      )),
      prompt('says', 'Something they always say.', 'tone', pair(
        'Something that person always says', 'we will figure it out',
        'Their line', 'call me when you get there'
      )),
    ],
  };

  var BY_ID = {};
  PACKS.forEach(function (pack) { BY_ID[pack.id] = pack; });
  BY_ID[GENERIC.id] = GENERIC;

  var ALIASES = {
    'r&b': 'rnb',
    rnb: 'rnb',
    'neo soul': 'rnb',
    'hip-hop': 'hiphop',
    'hip hop': 'hiphop',
    rap: 'hiphop',
    pop: 'pop',
    latin: 'latin',
    'latin pop': 'latin',
    reggaeton: 'latin',
    corrido: 'latin',
    corridos: 'latin',
    bachata: 'latin',
    country: 'country',
    rock: 'rock',
    punk: 'rock',
    gospel: 'gospel',
    inspirational: 'gospel',
    'lo-fi': 'lofi',
    lofi: 'lofi',
    chill: 'lofi',
    comedy: 'comedy',
  };

  function get(id) {
    return BY_ID[String(id || '').toLowerCase()] || null;
  }

  function list() {
    return PACKS.slice();
  }

  function matchGenre(name) {
    var key = String(name || '').trim().toLowerCase();
    if (!key) return '';
    if (ALIASES[key]) return ALIASES[key];
    if (BY_ID[key] && key !== 'generic') return key;
    return '';
  }

  function promptsFor(id, roll) {
    var pack = get(id) || GENERIC;
    var n = Math.abs(Number(roll) || 0);
    return pack.prompts.map(function (item) {
      var variants = item.variants && item.variants.length ? item.variants : [{ label: item.key, placeholder: '' }];
      var chosen = variants[n % variants.length];
      return {
        key: item.key,
        label: chosen.label,
        placeholder: chosen.placeholder || '',
        hint: item.hint || '',
        kind: item.kind || '',
      };
    });
  }

  function musicById(id) {
    var key = String(id || '').toLowerCase();
    for (var i = 0; i < COMEDY_MUSIC.length; i += 1) {
      if (COMEDY_MUSIC[i].id === key) return COMEDY_MUSIC[i];
    }
    return null;
  }

  function typeById(id) {
    var key = String(id || '').toLowerCase();
    for (var i = 0; i < COMEDY_TYPES.length; i += 1) {
      if (COMEDY_TYPES[i].id === key) return COMEDY_TYPES[i];
    }
    return null;
  }

  function styleFor(id, musicId) {
    var pack = get(id);
    if (!pack || pack.id === 'generic') return { genre: '', era: '', energy: '', instruments: [] };
    if (pack.id === 'comedy') {
      var music = musicById(musicId) || COMEDY_MUSIC[2];
      return {
        genre: music.genre,
        era: music.era,
        energy: music.energy,
        instruments: music.instruments.slice(),
      };
    }
    return {
      genre: pack.style.genre,
      era: pack.style.era,
      energy: pack.style.energy,
      instruments: pack.style.instruments.slice(),
    };
  }

  function genreLabel(id, musicId, typeId) {
    var pack = get(id);
    if (!pack || pack.id === 'generic') return '';
    if (pack.id !== 'comedy') return pack.style.genre;
    var type = typeById(typeId);
    var music = musicById(musicId);
    var text = 'Comedy';
    if (type) text += ', ' + type.short;
    if (music) text += ', ' + music.genre;
    return text.slice(0, 40);
  }

  function coverLookFor(id) {
    var pack = get(id);
    if (!pack || LOOKS.indexOf(pack.coverLook) < 0) return '';
    return pack.coverLook;
  }

  return {
    LOOKS: LOOKS,
    ERAS: ERAS,
    ENERGIES: ENERGIES,
    INSTRUMENTS: INSTRUMENTS,
    COMEDY_TYPES: COMEDY_TYPES,
    COMEDY_MUSIC: COMEDY_MUSIC,
    GENERIC: GENERIC,
    get: get,
    list: list,
    matchGenre: matchGenre,
    promptsFor: promptsFor,
    styleFor: styleFor,
    genreLabel: genreLabel,
    coverLookFor: coverLookFor,
    typeIds: function () { return COMEDY_TYPES.map(function (item) { return item.id; }); },
    musicIds: function () { return COMEDY_MUSIC.map(function (item) { return item.id; }); },
    typeById: typeById,
    musicById: musicById,
  };
}));
