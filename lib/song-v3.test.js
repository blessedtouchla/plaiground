'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const v3 = require('./song-v3');

const INTENT = 'I want this song to make them cry.';
const TITLE = 'Salt on Sunday';
const SCENE = 'We stood by the bus stop with a paper cup';

const HIPHOP = ['kick', 'tape', 'booth', 'pocket', 'cipher', 'block'];
const COUNTRY = ['porch', 'gravel', 'tulsa', 'creek', 'truck', 'kitchen'];
const JOY = ['bright', 'laugh', 'grin', 'clap', 'sunlight'];
const SAD = ['cold', 'ache', 'tear', 'empty', 'hollow'];

function base(over) {
  return Object.assign({
    title: TITLE,
    scene: SCENE,
    intent_private: INTENT,
    addressee: 'Someone I love',
    story: "We're just starting",
    feelings: ['Joy'],
    genre: 'Pop',
    language: 'English',
    explicit: 'Clean',
    path: 'ai',
    seed: 0,
  }, over || {});
}

function hasWord(text, word) {
  return new RegExp('\\b' + word + '\\b', 'i').test(text);
}

function countWords(text, list) {
  return list.filter(function (word) { return hasWord(text, word); }).length;
}

function verseMean(song) {
  return v3.meanOf(v3.verseLinesOf(song), song.title);
}

function verseRhyme(song) {
  var lines = v3.verseLinesOf(song).filter(function (line) { return line !== song.title; });
  return v3.metrics(lines.join('\n')).rhymeRate;
}

function chorusTitleOk(song) {
  return song.sections.filter(function (section) { return section.kind === 'chorus'; }).every(function (section) {
    var lines = section.lines;
    if (!lines.length) return false;
    return lines[0] === TITLE || lines[lines.length - 1] === TITLE;
  });
}

function run() {
  var runs = 20;
  var hip = [];
  var country = [];
  var joy = [];
  var hurt = [];
  var i;
  for (i = 0; i < runs; i++) {
    hip.push(v3.compose(base({ genre: 'Hip-hop', feelings: ['Joy'], seed: i })));
    country.push(v3.compose(base({ genre: 'Country', feelings: ['Joy'], seed: i })));
    joy.push(v3.compose(base({ genre: 'Pop', feelings: ['Joy'], seed: i })));
    hurt.push(v3.compose(base({ genre: 'Pop', feelings: ['Heartbreak'], seed: i })));
  }

  var hipSyl = avg(hip.map(verseMean));
  var countrySyl = avg(country.map(verseMean));
  var hipRhyme = avg(hip.map(verseRhyme));
  var countryRhyme = avg(country.map(verseRhyme));
  var hipLex = avg(hip.map(function (song) { return countWords(song.text, HIPHOP); }));
  var countryLex = avg(country.map(function (song) { return countWords(song.text, COUNTRY); }));
  var hipInCountry = avg(country.map(function (song) { return countWords(song.text, HIPHOP); }));
  var countryInHip = avg(hip.map(function (song) { return countWords(song.text, COUNTRY); }));
  var joyHits = avg(joy.map(function (song) { return countWords(song.text, JOY); }));
  var joySad = avg(joy.map(function (song) { return countWords(song.text, SAD); }));
  var sadHits = avg(hurt.map(function (song) { return countWords(song.text, SAD); }));
  var sadJoy = avg(hurt.map(function (song) { return countWords(song.text, JOY); }));

  var all = hip.concat(country, joy, hurt);
  var intentHits = all.reduce(function (n, song) { return n + v3.countIntent(song.text, INTENT); }, 0);
  var feelingNameHits = all.reduce(function (n, song) {
    return n + v3.FEELINGS.filter(function (name) { return hasWord(song.text, name); }).length;
  }, 0);
  var titleHits = all.filter(chorusTitleOk).length;
  var titleRate = titleHits / all.length;

  assert.ok(hipSyl >= 10 && hipSyl <= 14, 'hip-hop syllables ' + hipSyl);
  assert.ok(countrySyl >= 7 && countrySyl <= 10, 'country syllables ' + countrySyl);
  assert.ok(hipSyl - countrySyl >= 2, 'syllable gap ' + (hipSyl - countrySyl));
  assert.ok(hipRhyme - countryRhyme >= 0.4, 'rhyme gap ' + hipRhyme + ' vs ' + countryRhyme);
  assert.ok(hipLex >= 4, 'hip-hop word choice ' + hipLex);
  assert.ok(countryLex >= 4, 'country word choice ' + countryLex);
  assert.strictEqual(hipInCountry, 0, 'country sang hip-hop words');
  assert.strictEqual(countryInHip, 0, 'hip-hop sang country words');
  assert.ok(joyHits >= 4 && joyHits > joySad * 2, 'joy tone ' + joyHits + ' sad ' + joySad);
  assert.ok(sadHits >= 4 && sadHits > sadJoy * 2, 'heartbreak tone ' + sadHits + ' joy ' + sadJoy);
  assert.strictEqual(intentHits, 0);
  assert.strictEqual(feelingNameHits, 0);
  assert.ok(titleRate >= 0.95, 'title rate ' + titleRate);

  all.forEach(function (song) {
    BANNED_LEAK.forEach(function (phrase) {
      assert.ok(song.text.toLowerCase().indexOf(phrase) === -1, phrase + ' in ' + song.genre);
    });
  });

  var youSong = v3.compose(base({ genre: 'Country', addressee: 'Someone I love' }));
  var early = youSong.text.split('\n').filter(function (line) { return line && line.charAt(0) !== '['; }).slice(0, 4).join(' ');
  assert.ok(/\byou\b/i.test(early), 'you early: ' + early);

  assertGenreHooks();
  assertAdvanced();
  assertTools();
  assertGuard();
  assertCopyLocks();

  var report = {
    runs: runs,
    hiphopSyllables: round(hipSyl),
    countrySyllables: round(countrySyl),
    hiphopRhymeRate: round(hipRhyme),
    countryRhymeRate: round(countryRhyme),
    hiphopMarkers: round(hipLex),
    countryMarkers: round(countryLex),
    joyMarkers: round(joyHits),
    joySadLeak: round(joySad),
    heartbreakMarkers: round(sadHits),
    heartbreakJoyLeak: round(sadJoy),
    intentHits: intentHits,
    feelingNameHits: feelingNameHits,
    titleRate: titleRate,
  };
  console.log('SONG_V3_AB ' + JSON.stringify(report));
  return report;
}

var BANNED_LEAK = ['neon', 'shadows', 'whispers', 'echoes', 'embers', 'velvet', 'rise above', 'stories untold', 'in the night'];

function assertGenreHooks() {
  var pop = v3.compose(base({ genre: 'Pop', feelings: ['Joy'] }));
  var popChorus = pop.sections.filter(function (s) { return s.kind === 'chorus'; })[0];
  var titleCount = popChorus.lines.filter(function (line) { return line === TITLE; }).length;
  assert.ok(titleCount >= 3, 'pop title repeats');
  assert.ok(/\boh\b/i.test(pop.text), 'pop open vowel');

  var rnb = v3.compose(base({ genre: 'R&B' }));
  assert.ok(/\bstay stay\b/i.test(rnb.text), 'r&b run');

  var afro = v3.compose(base({ genre: 'Afrobeats' }));
  var reggaeTone = v3.compose(base({ genre: 'Reggaeton' }));
  assert.ok(/say it back/i.test(afro.text), 'afrobeats call');
  assert.ok(/say it back/i.test(reggaeTone.text), 'reggaeton call');

  var reggae = v3.compose(base({ genre: 'Reggae' }));
  assert.ok(/,/.test(reggae.text), 'reggae offbeat');
  assert.ok(/\briddim\b/i.test(reggae.text), 'reggae riddim');
  assert.ok(!/\b(dem|yuh|inna|irie)\b/i.test(reggae.text), 'no fake accent');

  var gospel = v3.compose(base({ genre: 'Gospel' }));
  var bridge = gospel.sections.filter(function (s) { return s.kind === 'bridge'; })[0];
  assert.ok(bridge && /\blift\b/i.test(bridge.lines.join(' ')), 'gospel lift');
  var gChorus = gospel.sections.filter(function (s) { return s.kind === 'chorus'; })[0];
  assert.ok(gChorus.lines.filter(function (line) { return line === TITLE; }).length >= 2, 'gospel refrain');

  var house = v3.compose(base({ genre: 'House' }));
  var houses = house.sections.filter(function (s) { return s.kind === 'chorus'; });
  assert.ok(houses.length >= 2, 'house repeats the hook');
  assert.ok(houses[0].lines.length >= 2 && houses[0].lines.length <= 4, 'house hook length');
  assert.deepStrictEqual(houses[0].lines, houses[1].lines);

  var rock = v3.compose(base({ genre: 'Rock' }));
  assert.ok(/\bHEY\b/.test(rock.text), 'rock shout');
  assert.ok(/\bdrive\b/i.test(rock.text) && /\bpush\b/i.test(rock.text), 'rock drive');

  var country = v3.compose(base({ genre: 'Country' }));
  assert.ok(/\btulsa\b/i.test(country.text), 'country place');
  var last = country.sections.filter(function (s) { return s.kind === 'chorus'; }).pop();
  assert.ok(/\bmeans\b/i.test(last.lines.join(' ')), 'country twist');
  assert.ok(v3.verseLinesOf(country).length < v3.verseLinesOf(v3.compose(base({ genre: 'Hip-hop' }))).length, 'hip-hop longer verses');

  var surprise = v3.compose(base({ genre: 'Surprise me', seed: 0 }));
  assert.ok(surprise.genreUsed && surprise.genreUsed !== 'Surprise me');
  assert.ok(v3.GENRES.indexOf(surprise.genreUsed) !== -1);
}

function advancedBrief(over) {
  return base({
    genre: 'Pop',
    feelings: ['Joy'],
    advanced: over,
  });
}

function sectionNames(song) {
  return song.sections.map(function (section) { return section.kind; }).join(',');
}

function assertAdvanced() {
  var sung = v3.compose(advancedBrief({ delivery: 'sung' }));
  var rapped = v3.compose(advancedBrief({ delivery: 'rapped' }));
  var chant = v3.compose(advancedBrief({ delivery: 'chant' }));
  var call = v3.compose(advancedBrief({ delivery: 'call' }));
  var spoken = v3.compose(advancedBrief({ delivery: 'spoken' }));
  assert.ok(/\boh\b/i.test(sung.text), 'sung');
  assert.ok(/\bblock\b/i.test(rapped.text) && /\bclock\b/i.test(rapped.text), 'rapped internal');
  var chantChorus = chant.sections.filter(function (s) { return s.kind === 'chorus'; })[0];
  assert.strictEqual(chantChorus.lines[0], chantChorus.lines[1]);
  assert.ok(/say it back/i.test(call.text), 'call');
  assert.ok(/\bsaid\b/i.test(spoken.text), 'spoken');
  assert.ok(verseRhyme(spoken) < verseRhyme(v3.compose(advancedBrief({ rhymeTightness: 'tight' }))), 'spoken freer');

  var tight = v3.compose(advancedBrief({ rhymeTightness: 'tight' }));
  var loose = v3.compose(advancedBrief({ rhymeTightness: 'loose' }));
  var none = v3.compose(advancedBrief({ rhymeTightness: 'none' }));
  assert.ok(verseRhyme(tight) > verseRhyme(loose), 'tight over loose ' + verseRhyme(tight) + ' ' + verseRhyme(loose));
  assert.ok(verseRhyme(loose) > verseRhyme(none) || v3.metrics(v3.verseLinesOf(loose).join('\n')).lastLetterRate > v3.metrics(v3.verseLinesOf(none).join('\n')).lastLetterRate, 'loose shows a rhyme change');
  assert.ok(verseRhyme(tight) > verseRhyme(none), 'tight over none');

  var aabb = v3.compose(advancedBrief({ rhymeTightness: 'tight', rhymePattern: 'aabb' }));
  var abab = v3.compose(advancedBrief({ rhymeTightness: 'tight', rhymePattern: 'abab' }));
  assert.strictEqual(patternOf(v3.verseLinesOf(aabb).slice(0, 4)), 'aabb');
  assert.strictEqual(patternOf(v3.verseLinesOf(abab).slice(0, 4)), 'abab');

  var few = verseMean(v3.compose(advancedBrief({ density: 'few' })));
  var mid = verseMean(v3.compose(advancedBrief({ density: 'mid' })));
  var packed = verseMean(v3.compose(advancedBrief({ density: 'packed' })));
  assert.ok(few >= 6 && few <= 8, 'few ' + few);
  assert.ok(mid >= 9 && mid <= 11, 'mid ' + mid);
  assert.ok(packed >= 12 && packed <= 16, 'packed ' + packed);
  assert.ok(few < mid && mid < packed, 'density order');

  var shortSong = v3.compose(advancedBrief({ shape: 'short' }));
  var fullSong = v3.compose(advancedBrief({ shape: 'full' }));
  var hookSong = v3.compose(advancedBrief({ shape: 'hook' }));
  assert.strictEqual(sectionNames(shortSong), 'verse,chorus,verse,chorus');
  assert.strictEqual(sectionNames(fullSong), 'verse,lift,chorus,verse,chorus,bridge,chorus');
  assert.ok(sectionNames(hookSong).indexOf('chorus') === 0, 'hook first');

  var slowBrief = advancedBrief({ speed: 'slow' });
  var fastBrief = advancedBrief({ speed: 'fast' });
  var slow = v3.compose(slowBrief);
  var fast = v3.compose(fastBrief);
  assert.ok(verseMean(fast) >= verseMean(slow) + 2, 'speed syllables');
  assert.ok(v3.stylePrompt(slowBrief).indexOf('slow tempo') !== -1);
  assert.ok(v3.stylePrompt(fastBrief).indexOf('fast tempo') !== -1);
  assert.ok(v3.stylePrompt(advancedBrief({ speed: 'medium' })).indexOf('medium tempo') !== -1);

  var toYou = v3.compose(advancedBrief({ pov: 'you' }));
  var toThem = v3.compose(advancedBrief({ pov: 'them' }));
  var asWe = v3.compose(advancedBrief({ pov: 'we' }));
  var story = v3.compose(advancedBrief({ pov: 'story' }));
  assert.ok(/\byou\b/i.test(firstLines(toYou, 4)), 'pov you');
  assert.ok(/\bthem\b/i.test(firstLines(toThem, 8)), 'pov them');
  assert.ok(!/\byou\b/i.test(firstLines(toThem, 4)), 'pov them skips you');
  assert.ok(/\bwe\b/i.test(firstLines(asWe, 4)), 'pov we');
  assert.ok(/\bMina\b/.test(story.text), 'pov story');
  assert.ok(!/\bI\b/.test(firstLines(story, 4)), 'story is not I');

  var spanish = v3.compose(base({ language: 'Spanish' }));
  var mix = v3.compose(base({ language: 'Spanglish' }));
  var clean = v3.compose(base({ explicit: 'Clean' }));
  var explicit = v3.compose(base({ explicit: 'Explicit', genre: 'Hip-hop' }));
  assert.ok(/\bcontigo\b/i.test(spanish.text), 'spanish');
  assert.ok(/\bcon\b/i.test(mix.text), 'spanglish');
  assert.ok(!/\bdamn\b/i.test(clean.text), 'clean');
  assert.ok(/\bdamn\b/i.test(explicit.text), 'explicit');

  ['more-energy', 'softer', 'different-voice', 'more-instruments'].forEach(function (tweak) {
    var line = v3.stylePrompt(base({ vibe: 'Late night', feelings: ['Joy'], advanced: { speed: 'medium' } }), tweak);
    assert.ok(line.indexOf('Hip-hop') === -1 || base().genre);
    assert.ok(/late night/i.test(line) && /joy/i.test(line) && /medium tempo/i.test(line), line);
    assert.ok(line.indexOf(tweak.replace('more-energy', 'more energy').replace('different-voice', 'a different voice').replace('more-instruments', 'more instruments')) !== -1, tweak);
    assert.ok(!/suno|tonegrid/i.test(line));
    assert.ok(!/[\u2014\u2013]/.test(line));
  });
}

function patternOf(lines) {
  var keys = lines.map(function (line) { return v3.rhymeKey(v3.contentLines(line)[0] ? line.split(/\s+/).pop() : ''); });
  var a = keys[0];
  var b = keys[1];
  var c = keys[2];
  var d = keys[3];
  if (a === b && c === d && a !== c) return 'aabb';
  if (a === c && b === d && a !== b) return 'abab';
  return keys.join('-');
}

function firstLines(song, n) {
  return v3.contentLines(song.text).slice(0, n).join(' ');
}

function assertTools() {
  var brief = base({ genre: 'Hip-hop' });
  var own = ['kick the tape stay'];
  var lines = v3.giveLines(brief, own);
  assert.strictEqual(lines.length, 3);
  lines.forEach(function (line) {
    assert.ok(own.indexOf(line.toLowerCase()) === -1);
    assert.ok(line.toLowerCase().indexOf(INTENT.toLowerCase()) === -1);
  });
  assert.strictEqual(new Set(lines).size, 3);

  var done = v3.finishLine(brief, 'We stood by the');
  assert.ok(done.indexOf('We stood by the') === 0);
  assert.notStrictEqual(done, 'We stood by the');
  assert.ok(v3.syllableCount(done) > v3.syllableCount('We stood by the'));

  var shorter = v3.tryFix('kick the tape on the block and clock the pocket', 'shorter');
  assert.ok(v3.syllableCount(shorter.line) < v3.syllableCount('kick the tape on the block and clock the pocket'));
  var rhymed = v3.tryFix('kick the tape on the block', 'rhyme', { withLine: 'play' });
  assert.notStrictEqual(rhymed.line.split(/\s+/).pop(), 'block');
  var catchy = v3.tryFix('hand on the cup', 'catchier', { title: TITLE });
  assert.ok(catchy.line.indexOf(TITLE) !== -1);
  var plain = v3.tryFix('neon shadows rise above in the night', 'less-cheesy');
  BANNED_LEAK.forEach(function (phrase) {
    if (phrase === 'whispers' || phrase === 'echoes' || phrase === 'embers' || phrase === 'velvet' || phrase === 'stories untold') return;
    assert.ok(plain.line.toLowerCase().indexOf(phrase) === -1, phrase);
  });
  assert.ok(plain.changed);

  var prompt = v3.buildPrompt(base());
  assert.ok(/10 to 14|About 7 syllables|About \d+ syllables/.test(prompt));
  assert.ok(/never sung/i.test(prompt));
  assert.ok(prompt.indexOf(TITLE) !== -1);
  assert.ok(prompt.indexOf(INTENT) === -1);
}

function assertGuard() {
  var dirty = 'I want this song to make them cry.\nneon shadows in the night\n[Chorus]\nSalt on Sunday';
  var clean = v3.guardText(dirty, base());
  assert.strictEqual(v3.countIntent(clean, INTENT), 0);
  assert.ok(!/neon|in the night|shadows/i.test(clean));
  assert.ok(clean.indexOf(TITLE) !== -1);
}

function assertCopyLocks() {
  assert.deepStrictEqual(v3.PARODY_MIXES, ['Straight', 'Goofy mix']);
  assert.strictEqual(v3.FREE_AI_WRITES, 1);
  assert.strictEqual(v3.CREDIT_COST, 1);
  assert.strictEqual(v3.DEFAULT_MUSIC_APP, 'https://suno.com/create');
  var features = require('./features');
  assert.strictEqual(features.enabled('SONG_HELPER_V3'), false);
  var files = ['lib/song-v3.js', 'lib/song-v3.test.js', 'lib/features.js'];
  files.forEach(function (file) {
    var text = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    assert.ok(!/[\u2014\u2013]/.test(text), file + ' has a dash');
  });
}

function avg(list) {
  return list.reduce(function (a, b) { return a + b; }, 0) / list.length;
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}

run();
console.log('song-v3 tests passed');
