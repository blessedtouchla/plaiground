// Genre-aware EPK defaults: palette, photo style, section order, platform priority, bio tone, hashtags.
// Used by /epk-builder in the browser (window.GenrePresence) and by Node tests (module.exports).
//
// Sources (pulled Oct 22, 2026):
// [L-YE25] Luminate 2025 Year-End Music Report: DSP over-index by genre (Rock: Apple Music; R&B/hip-hop: Apple Music + YouTube tie;
//          Pop: Spotify; Country: Amazon Music; Latin: YouTube; EDM: Spotify + YouTube tie). 36% of weekly US rock fans discovered
//          music via short-form video in 2025, up 20% YoY. https://luminatedata.com/wp-content/uploads/2026/01/2025-Year-End-Music-Report-1.14.26.pdf
// [L-MY25] Luminate 2025 Midyear Report: Discord over-indexes Electronic/Dance; WhatsApp over-indexes Afrobeats + Latin; Reddit Electronic/Dance.
//          https://luminatedata.com/wp-content/uploads/2025/07/Luminate-2025-Midyear-Music-Report.pdf
// [ADOBE]  Adobe Express survey of 1,010 US fans: share who regularly discover music on TikTok: hip-hop/rap 59%, R&B/soul 52%,
//          country 38%, pop 38%, rock 32%, indie 26%. Rock, country, indie fans most likely to shop TikTok Shop.
//          https://www.adobe.com/express/learn/blog/music-impact-on-social-engagement
// [MIDIA]  MIDiA Research: YouTube leads discovery (52% top-3), streaming 40%, TikTok 37%; TikTok follow-to-listen conversion lowest (26% vs 45%).
//          https://www.midiaresearch.com/blog/new-midia-research-data-shows-why-virality-is-not-building-fandom
// [TT-LUM] TikTok x Luminate Music Impact Report: 84% of 2024 Billboard Global 200 entries went viral on TikTok first.
//          https://newsroom.tiktok.com/en-us/tiktok-and-luminate-release-latest-music-impact-report
// Where a genre has no direct platform data in these sources, the entry says so in `basis` and leans on the
// overall finding that YouTube leads discovery [MIDIA]. Palettes, photo styles and bio tones are genre conventions, not survey data.
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GenrePresence = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var GENRES = {
    'Hip hop': {
      basis: 'TikTok discovery highest of any genre, 59% [ADOBE]; DSP over-index Apple Music + YouTube [L-YE25].',
      platforms: ['TikTok', 'YouTube', 'Instagram', 'Apple Music', 'Spotify'],
      palette: { bg: '#0b0b0f', ink: '#ffffff', accent: '#F5C542', accent2: '#FF3C8E' },
      theme: 'street', photo: 'Low-angle street portrait, hard flash, real location from your city.',
      order: ['hero', 'oneLiner', 'tracks', 'links', 'bio', 'story', 'forFansOf'],
      tone: 'Confident, first-person energy, short punchy lines, real places and real grind.',
      hashtags: ['#hiphop', '#newmusic', '#rap', '#independentartist', '#comeplai'],
    },
    'R&B': {
      basis: 'TikTok discovery 52%, second highest [ADOBE]; DSP over-index Apple Music + YouTube (R&B/hip-hop) [L-YE25].',
      platforms: ['TikTok', 'Instagram', 'YouTube', 'Apple Music', 'Spotify'],
      palette: { bg: '#1a0b14', ink: '#fbeee6', accent: '#d98a6a', accent2: '#7D3CFF' },
      theme: 'velvet', photo: 'Warm low-light portrait, soft focus, close crop on the face.',
      order: ['hero', 'oneLiner', 'bio', 'tracks', 'links', 'story', 'forFansOf'],
      tone: 'Intimate, warm, sensory words, feelings over flexes.',
      hashtags: ['#rnb', '#rnbsoul', '#newmusic', '#singer', '#comeplai'],
    },
    'Pop': {
      basis: 'TikTok discovery 38% [ADOBE]; DSP over-index Spotify [L-YE25]; viral-first chart path [TT-LUM].',
      platforms: ['TikTok', 'Instagram', 'Spotify', 'YouTube'],
      palette: { bg: '#fff0f7', ink: '#1a1033', accent: '#FF3C8E', accent2: '#7D3CFF' },
      theme: 'arcade', photo: 'Bright, clean color backdrop, playful pose, bold styling.',
      order: ['hero', 'oneLiner', 'tracks', 'bio', 'links', 'forFansOf', 'story'],
      tone: 'Bright, hooky, fan-facing, one big idea per line.',
      hashtags: ['#pop', '#newmusic', '#popmusic', '#singersongwriter', '#comeplai'],
    },
    'Synth pop': {
      basis: 'Treated as pop + electronic: pop over-indexes Spotify [L-YE25]; electronic fans over-index Discord/Reddit [L-MY25].',
      platforms: ['Spotify', 'TikTok', 'Instagram', 'YouTube', 'Discord'],
      palette: { bg: '#0a0620', ink: '#e9e6ff', accent: '#2FE6FF', accent2: '#FF3C8E' },
      theme: 'space', photo: 'Neon gel lighting, chrome or retro-future styling, night city.',
      order: ['hero', 'oneLiner', 'story', 'tracks', 'bio', 'links', 'forFansOf'],
      tone: 'Cinematic, retro-future, mood and color words.',
      hashtags: ['#synthpop', '#synthwave', '#electropop', '#newmusic', '#comeplai'],
    },
    'Rock': {
      basis: 'DSP over-index Apple Music [L-YE25]; 36% of weekly rock fans found music via short-form video in 2025 [L-YE25]; TikTok discovery 32% [ADOBE].',
      platforms: ['YouTube', 'Instagram', 'TikTok', 'Apple Music', 'Spotify'],
      palette: { bg: '#111111', ink: '#f2f2f2', accent: '#E0302A', accent2: '#c9c9c9' },
      theme: 'press', photo: 'Live shot or gritty black and white band photo, real stage.',
      order: ['hero', 'oneLiner', 'bio', 'tracks', 'story', 'links', 'forFansOf'],
      tone: 'Raw, direct, live-show energy, no fluff.',
      hashtags: ['#rock', '#newmusic', '#rockband', '#livemusic', '#comeplai'],
    },
    'Country': {
      basis: 'DSP over-index Amazon Music [L-YE25]; TikTok discovery 38%, high TikTok Shop use [ADOBE].',
      platforms: ['TikTok', 'YouTube', 'Facebook', 'Amazon Music', 'Spotify'],
      palette: { bg: '#f6efe3', ink: '#2b1d10', accent: '#b5651d', accent2: '#3c6e47' },
      theme: 'press', photo: 'Natural daylight, outdoors, hometown landmark, honest styling.',
      order: ['hero', 'oneLiner', 'story', 'bio', 'tracks', 'links', 'forFansOf'],
      tone: 'Storytelling, hometown roots, plain-spoken and warm.',
      hashtags: ['#country', '#countrymusic', '#newcountry', '#songwriter', '#comeplai'],
    },
    'EDM': {
      basis: 'DSP over-index Spotify + YouTube tie [L-YE25]; Electronic/Dance fans over-index Discord and Reddit [L-MY25].',
      platforms: ['YouTube', 'Spotify', 'TikTok', 'Discord', 'Instagram'],
      palette: { bg: '#050510', ink: '#ffffff', accent: '#39FF14', accent2: '#2FA8FF' },
      theme: 'space', photo: 'Booth or crowd shot with lasers and strobes, wide frame.',
      order: ['hero', 'oneLiner', 'tracks', 'links', 'bio', 'forFansOf', 'story'],
      tone: 'High energy, BPM and drop language, community and scene.',
      hashtags: ['#edm', '#electronicmusic', '#dancemusic', '#producer', '#comeplai'],
    },
    'Latin': {
      basis: 'DSP over-index YouTube [L-YE25]; Latin fans over-index WhatsApp [L-MY25].',
      platforms: ['YouTube', 'Instagram', 'TikTok', 'WhatsApp', 'Spotify'],
      palette: { bg: '#1c0a05', ink: '#fff4e8', accent: '#ff7a00', accent2: '#F5C542' },
      theme: 'arcade', photo: 'Saturated color, movement and dance, music video still.',
      order: ['hero', 'oneLiner', 'tracks', 'bio', 'links', 'story', 'forFansOf'],
      tone: 'Warm, rhythmic, proud of roots; bilingual lines welcome.',
      hashtags: ['#musicalatina', '#latinmusic', '#reggaeton', '#nuevamusica', '#comeplai'],
    },
    'Gospel': {
      basis: 'No genre-specific platform data in these sources; leans on YouTube leading discovery overall (52%) [MIDIA].',
      platforms: ['YouTube', 'Facebook', 'Instagram', 'Spotify'],
      palette: { bg: '#fbf7ef', ink: '#1d1630', accent: '#b8912a', accent2: '#5a3d9a' },
      theme: 'press', photo: 'Bright, hopeful light, choir or worship setting, joyful expression.',
      order: ['hero', 'oneLiner', 'bio', 'story', 'tracks', 'links', 'forFansOf'],
      tone: 'Uplifting, testimony-driven, community and faith.',
      hashtags: ['#gospel', '#gospelmusic', '#worship', '#newmusic', '#comeplai'],
    },
  };
  var ALIAS = { 'hip-hop': 'Hip hop', 'rap': 'Hip hop', 'rnb': 'R&B', 'r&b': 'R&B', 'soul': 'R&B', 'electronic': 'EDM', 'dance': 'EDM', 'synthpop': 'Synth pop', 'reggaeton': 'Latin', 'worship': 'Gospel' };
  function find(genre) {
    var g = String(genre || '').trim();
    if (GENRES[g]) return g;
    var low = g.toLowerCase();
    for (var k in GENRES) if (k.toLowerCase() === low) return k;
    for (var a in ALIAS) if (low.indexOf(a) !== -1) return ALIAS[a];
    for (var k2 in GENRES) if (low.indexOf(k2.toLowerCase()) !== -1) return k2;
    return '';
  }
  function forGenre(genre) {
    var key = find(genre);
    return key ? Object.assign({ genre: key }, GENRES[key]) : null;
  }
  return { GENRES: GENRES, find: find, forGenre: forGenre };
});
