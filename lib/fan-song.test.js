'use strict';
const assert = require('assert');
const F = require('./fan-song');
const musician = F.normalize({ name: 'Taylor Swift', type: 'Musician', affect: ['Got me through something hard'], did: 'your songs got me through my parents divorce', moment: 'I heard Fearless on the bus home in 2009', confession: 'I made my dog wear a cardigan', tenSeconds: 'thank you for the bridge that saved me', genre: 'Pop', tempo: 'Mid', voice: 'Female vocal' });
assert.ok(F.validate(musician).ok);
assert.strictEqual(F.arc(F.depthOf(musician)), 'heavy');
const light = F.normalize({ name: 'Ryan Reynolds', type: 'Actor', affect: ['Made me laugh'], confession: 'I quote him at work daily lol', did: 'you made me laugh on my worst Mondays', tenSeconds: 'you are hilarious' });
assert.strictEqual(F.arc(F.depthOf(light)), 'light');
// filter
['you are mine forever', 'I know where you live', 'official tribute song', 'sing it in the voice of Taylor', 'he is a fraud'].forEach((t) => assert.strictEqual(F.check(t).ok, false, t));
assert.strictEqual(F.check('you made me brave').ok, true);
// style prompt names no artists, no em dash
const st = F.stylePrompt(musician);
assert.ok(!/taylor|swift/i.test(st) && !/\u2014/.test(st));
// research facts: lyric lines dropped
assert.strictEqual(F.safeFact('Her lyrics include many lines about love', 'Musician'), '');
assert.strictEqual(F.safeFact('She sang "and I will always remember the way you looked that night"', 'Musician'), '');
assert.ok(F.safeFact('Her 2008 album Fearless won Album of the Year at the Grammys.', 'Musician'));
// crisis keeps gentle tone
const c = F.normalize({ name: 'X', did: 'you kept me from wanting to die', moment: 'last winter' });
assert.ok(F.crisis(c) && /gentle/.test(F.plaiRead(c)));
// letter path
const x = F.extractFromLetter('The first time I saw you I was 12. You helped me stop being so shy. I once cried at your show lol. Thank you for everything.', 'Zendaya');
assert.ok(x.moment && x.did && x.confession && x.tenSeconds);
assert.ok(!/\u2014/.test(F.polishLetter(F.normalize(Object.assign({ name: 'Zendaya' }, x)))));
// release block
const song = F.sampleSong(musician);
assert.ok(F.matchesFanSong(song, [F.fanRecord(musician, song, st, '')]));
assert.ok(!F.matchesFanSong('totally different words here about my own life and my own dog and the sea and the sky tonight', [F.fanRecord(musician, song, st, '')]));
assert.ok(!/suno|tonegrid|\u2014/i.test(song));
console.log('fan-song.test.js ok');
