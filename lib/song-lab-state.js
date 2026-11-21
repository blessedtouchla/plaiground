'use strict';

/**
 * One state object for the Street Notebook, plus the sample songs.
 * Sample lines show only when live writing is off.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SongLabState = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var GENRES = ['Pop', 'Hip hop', 'R&B', 'Soul', 'Country', 'Reggae', 'Latin', 'Rock', 'Electronic'];
  var ERAS = ['70s', '90s', '00s', '10s', 'Now'];
  var REGIONS = ['Bay', 'Atlanta', 'East Coast', 'UK', 'Jamaica', 'Puerto Rico'];
  var LANGUAGES = ['English', 'Spanish', 'Spanglish'];
  var TIPS = {
    Pop: 'Pop: land the title on the downbeat, then say it again.',
    'Hip hop': 'Hip hop: stack the stress on the last two words.',
    'R&B': 'R&B: leave one open vowel you can stretch.',
    Soul: 'Soul: one plain picture beats two clever ones.',
    Country: 'Country: name a real thing in a real place.',
    Reggae: 'Reggae: ride the offbeat, keep the words plain.',
    Latin: 'Latin: short phrases that sit on the dembow.',
    Rock: 'Rock: end on a hard sound you can shout.',
    Electronic: 'Electronic: fewer words, one phrase that loops.'
  };
  var STAMPS = [
    { key: 'no_ai', label: 'Human' },
    { key: 'ai_assisted', label: 'AI-assisted' },
    { key: 'fully_ai', label: 'Fully AI' }
  ];
  var PRESETS = [
    { label: 'pop, now, kitchen', genre: 'Pop', era: 'Now', topic: 'Kitchen' },
    { label: '90s hip hop, the block', genre: 'Hip hop', era: '90s', topic: 'The block' },
    { label: '70s soul, sunday table', genre: 'Soul', era: '70s', topic: 'Sunday table' }
  ];
  var TAGWORD = {
    Bay: 'fa sho',
    Atlanta: 'no cap',
    'East Coast': 'word',
    UK: 'blud',
    Jamaica: 'zeen',
    'Puerto Rico': 'acho'
  };

  function line(text, rhyme, flow, slang) {
    return { text: text, rw: { rhyme: rhyme, flow: flow, slang: slang || null } };
  }

  var SONGS = {
    kitchen: {
      title: 'Kitchen light',
      secs: [
        { tag: 'Verse 1', target: 8, lines: [
          line('The plates are still warm from Saturday night', 'Warm plates left from Saturday night', 'Warm plates, Saturday night', {
            Bay: ['The plates still hella warm from Saturday night', 'hella'],
            Atlanta: ['No cap, the plates still warm from Saturday night', 'no cap'],
            'East Coast': ['The plates still mad warm from Saturday night', 'mad'],
            UK: ['The plates still bare warm from Saturday night', 'bare'],
            Jamaica: ['Big up the plates still warm from Saturday night', 'big up'],
            'Puerto Rico': ['Acho, the plates still warm from Saturday night', 'acho']
          }),
          line('I left a cup beside the window light', 'A cup still waits in the window light', 'Cup by the window, catching light', {
            Bay: ['Left a cup for my potna by the window light', 'potna'],
            Atlanta: ['Left a cup for my patna nem by the window light', 'patna nem'],
            'East Coast': ['Props to the cup by the window light', 'props'],
            UK: ['Left a cup for the mandem by the window light', 'mandem'],
            Jamaica: ['Left a cup for the massive by the window light', 'massive'],
            'Puerto Rico': ['Left a cup for the corillo by the window light', 'corillo']
          })
        ]},
        { tag: 'Hook', target: 7, lines: [
          line('I kept the kitchen light on', 'I left the porch light on', 'Kept the kitchen light on', {
            Bay: ['Fa sho, I kept the kitchen light on', 'fa sho'],
            Atlanta: ['No cap, I kept the kitchen light on', 'no cap'],
            'East Coast': ['Word, I kept the kitchen light on', 'word'],
            UK: ['Blud, I kept the kitchen light on', 'blud'],
            Jamaica: ['Zeen, I kept the kitchen light on', 'zeen'],
            'Puerto Rico': ['Mera, I kept the kitchen light on', 'mera']
          }),
          line('Till the whole block was gone', 'Till the whole block moved on', 'Till the block was gone', {
            Bay: ['Till the whole Town was gone', 'the Town'],
            Atlanta: ['Till the whole A was gone', 'the A'],
            'East Coast': ['Till the block was mad gone', 'mad'],
            UK: ['Till the whole ends was gone', 'ends'],
            Jamaica: ['Till the whole massive was gone', 'massive'],
            'Puerto Rico': ['Till the whole jangueo was gone', 'jangueo']
          })
        ]},
        { tag: 'Bridge', target: 7, lines: [
          line('Say it once, then leave the room', 'Say it once beneath the moon', 'Say it once, leave the room', {
            Bay: ['Say it once, potna, leave the room', 'potna'],
            Atlanta: ['Say it once, then slide out the room', 'slide'],
            'East Coast': ['Say it once, word, then leave the room', 'word'],
            UK: ['Say it once, blud, then leave the room', 'blud'],
            Jamaica: ['Say it once, forward, leave the room', 'forward'],
            'Puerto Rico': ['Say it once, acho, then leave the room', 'acho']
          }),
          line('The kettle clicks and the house goes soon', 'The kettle clicks, the silence looms', 'Kettle clicks, the house goes soon', {
            Bay: ['The kettle clicks, the Town goes quiet soon', 'the Town'],
            Atlanta: ['The kettle clicks, the A goes quiet soon', 'the A'],
            'East Coast': ['The kettle clicks, mad quiet, the house goes soon', 'mad'],
            UK: ['The kettle clicks, the ends goes quiet soon', 'ends'],
            Jamaica: ['The kettle clicks, zeen, the house goes soon', 'zeen'],
            'Puerto Rico': ['The kettle clicks, the corillo gone soon', 'corillo']
          })
        ]}
      ]
    },
    quiet: {
      title: 'Invisible in my own idea',
      secs: [
        { tag: 'Verse 1', target: 10, lines: [
          line('Two seats down with my coffee going cold', 'Two seats down, my coffee getting cold', 'Two seats down, coffee going cold'),
          line('You said I was thinking like the thought was yours to hold', 'You said it like that thought was yours to hold', 'You said it like the thought was yours')
        ]},
        { tag: 'Hook', target: 9, lines: [
          line('Invisible in my own idea', 'Invisible inside my idea', 'Invisible in my idea'),
          line("Say it again, it's still my idea", "Say it twice, it's still my idea", 'Still my idea')
        ]}
      ]
    },
    loud: {
      title: 'I told you at lunch',
      secs: [
        { tag: 'Verse 1', target: 10, lines: [
          line('Group call, you unmute like the thought was new', 'Group call, you unmute, act brand new', 'Group call, you unmute, act new'),
          line('Two seats down, I got the receipts, I knew', 'Two seats down with the receipts, I knew', 'Got the receipts, I knew')
        ]},
        { tag: 'Hook', target: 6, lines: [
          line('I told you at lunch', 'I told you that at lunch', 'Told you at lunch'),
          line('Now you read my words like a hunch', 'Now you read it back like a hunch', "Now it's your hunch")
        ]}
      ]
    }
  };

  var DIRECTIONS = {
    quiet: { name: 'Quiet burn', tag: 'R&B · slow', genre: 'R&B' },
    loud: { name: 'Loud receipt', tag: 'Hip hop · punchy', genre: 'Hip hop' }
  };

  var CHAT = [
    { p: 'Couch is open. What happened?' },
    { u: 'My friend pitched my idea in the team meeting like it was his.', pins: { feel: ['burned'] } },
    { p: 'Oof. Where were you sitting?' },
    { u: 'Two seats down. Holding my coffee. I just froze.', pins: { detail: ['two seats down', 'holding my coffee', 'froze'] } },
    { p: 'What did he say, exactly?' },
    { u: '"I was thinking we could..." Like it was his thought. I told him at lunch.', pins: { phrase: ['"I was thinking we could"', '"I told you at lunch"'] } },
    { p: 'How did it feel, right then?' },
    { u: 'Hot face. Like I was invisible in my own idea.', pins: { feel: ['invisible', 'hot face'], title: 'Invisible in my own idea' } },
    { p: "That last line is a song. Want to take it to the writers' room?" },
    { u: "Yeah. Let's go.", pins: { sound: 'R&B · 10s · slow, sitting back' } }
  ];

  function blank() {
    return {
      screen: 'home',
      genre: 'Pop',
      era: 'Now',
      region: 'Bay',
      language: 'English',
      topic: 'Kitchen',
      songId: 'kitchen',
      line: -1,
      justPicked: -1,
      stamp: 1,
      tab: 'lyrics',
      rackOpen: false,
      chatStep: 0,
      roomPick: null,
      mic: false,
      presetIdx: 0,
      step: 0,
      credits: null,
      signedIn: false,
      liveCouch: false
    };
  }

  function cloneSongs() {
    return JSON.parse(JSON.stringify(SONGS));
  }

  function tip(genre) {
    return TIPS[genre] || TIPS.Pop;
  }

  return {
    GENRES: GENRES,
    ERAS: ERAS,
    REGIONS: REGIONS,
    LANGUAGES: LANGUAGES,
    TIPS: TIPS,
    STAMPS: STAMPS,
    PRESETS: PRESETS,
    TAGWORD: TAGWORD,
    SONGS: SONGS,
    DIRECTIONS: DIRECTIONS,
    CHAT: CHAT,
    IMAGES: ['plates', 'cup', 'window', 'kitchen', 'kettle', 'block', 'house', 'room', 'coffee', 'seats', 'lunch', 'receipts', 'call'],
    FILLERS: ['still', 'just', 'really', 'that', 'the', 'and', 'so'],
    blank: blank,
    cloneSongs: cloneSongs,
    tip: tip
  };
}));
