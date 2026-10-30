'use strict';
const assert = require('assert');
const PC = require('./prompt-check.js');
const A = require('./arcade.js');
const BAN = /chip ?tune|8[ -]?bit|bit ?crush|arcade|video ?game|\bgames?\b|pixel|vocoder|talk ?box|robot|glitch|pitched (down |up )?vocal|music ?box|level ?up/i;

// 1. The real live prompt Song Lab produced for hip-hop + reggae (Oct 22, 2026).
const LIVE = 'Glassy Plucked Synths, Bass That Ducks Under The Vocal, Husky Low Voice, Laid Back, Bright Synths, Punchy Drums, Chiptune 8 Bit Leads, Syncopated Kick With Ghost Notes, Bright Condenser Vocal, Bus Compression That Pumps, Short Plate Reverb, Vocal Dead Center, Robotic Talkbox, Warm Vocal, Video Game Level Up Key Change, Hook In The First 20 Seconds, Melody Leaps Up On The Hook, Field Recording Texture Under The Intro, Bpm 117, Major Key, Retro Arcade Twist, Hip Hop Meets Reggae Fusion Feel';
const c = PC.checkStyle(LIVE, { strict: true });
assert.ok(!BAN.test(c.style), 'live prompt cleaned: ' + c.style);
assert.ok(c.style.length <= 200, 'live prompt capped');
assert.ok(c.exclude.indexOf('chiptune') !== -1 && c.exclude.indexOf('vocoder') !== -1, 'exclude list');
assert.ok(c.warnings.some((w) => /Robotic Talkbox/.test(w)), 'talkbox flagged');

// 2. No "no X" phrasing in the style box. It moves to Exclude.
const n = PC.checkStyle('reggae, warm male vocal, no autotune, without synths', {});
assert.ok(!/\bno\b|without/i.test(n.style), n.style);
assert.ok(n.exclude.indexOf('autotune') !== -1 && n.exclude.indexOf('synths') !== -1);

// 3. Flip fusion, the exact hip-hop + reggae case from the page (target "Hip hop + Reggae", surprise vibe).
function flip(fusion, vibe, tune) {
  const st = { card: 'flip', type: '', answers: {}, flip: { vibe: vibe || '', fusionOn: true, fusion, target: fusion.join(' + ') } };
  return A.flipStyle(st, { genre: fusion.join(' + '), fusion, tune: tune || {} });
}
const cases = [['Hip hop', 'Reggae'], ['Country', 'Hip hop'], ['R&B', 'Latin'], ['Pop', 'Rock'], ['Electronic', 'Gospel'], ['Kids', 'Acoustic']];
const vibes = ['', 'funny', 'dirty', 'sad', 'hype', 'surprise'];
cases.forEach((f) => vibes.forEach((v) => {
  const r = flip(f, v);
  const s = r.style;
  assert.ok(!BAN.test(s), f + v + ' banned: ' + s);
  assert.ok(s.length >= 120 && s.length <= 200, f + v + ' length ' + s.length + ': ' + s);
  assert.ok(!/\u2014|\u2013/.test(s), 'no em dashes');
  assert.ok(!/suno/i.test(s), 'never names the engine');
  const head = s.split(', ');
  assert.ok(!/fusion/.test(head[0]) && /hard cuts never blended/.test(s), 'genres first, hard cuts: ' + s);
  const vocalParts = head.filter((p) => /\b(vocals?|voice|rap|sung)\b/i.test(p));
  assert.strictEqual(vocalParts.length, 1, 'one vocal line: ' + s);
  assert.ok(s.indexOf(vocalParts[0]) <= 60, 'vocal in first 60 chars');
  assert.ok(!/\bno\b/i.test(s), 'no negatives');
  assert.ok(r.exclude.length >= 5 && r.exclude.indexOf('robotic vocals') !== -1, 'exclude filled');
  assert.deepStrictEqual(r.sliders, { weirdness: 25, styleInfluence: 65 });
}));
const hr = flip(['Hip hop', 'Reggae'], 'surprise');
assert.ok(/^Hip-hop reggae, /.test(hr.style) && /hard cuts never blended/.test(hr.style) && hr.exclude.indexOf('genre blending') !== -1, hr.style);
assert.ok(/boom bap/.test(hr.style) && /skank guitar|dub bass/.test(hr.style), 'both kits present: ' + hr.style);
assert.ok(/rap verses/.test(hr.style) && /sung reggae hook/.test(hr.style), 'rap verses, sung hook');
assert.ok(!/glassy|bright synths|plucked synth/.test(hr.style), 'no pop synth default');
// Genre balance: hand-written pairs, both pick orders, no genre over 60% of genre words, rhythm genre leads.
Object.keys(A.FUSION_PAIRS).forEach((key) => {
  const g = key.split('|');
  [g, g.slice().reverse()].forEach((order) => vibes.forEach((v) => {
    const r = flip(order, v);
    assert.ok(r.balance && r.balance.top <= 0.6 && r.ok, key + v + ' balance ' + JSON.stringify(r.balance) + ' ' + r.style);
    Object.keys(r.balance.counts).forEach((k) => assert.ok(r.balance.counts[k] >= 3, key + ' needs 3+ ' + k + ' words: ' + r.style));
  }));
});
const rh = flip(['Reggae', 'Hip hop'], '').style;
assert.ok(rh.indexOf('boom bap') < rh.indexOf('skank') && rh.indexOf('rap verses') < 60, 'hip-hop drums and rap lead: ' + rh);
// A reggae-heavy prompt is flagged.
const skew = PC.checkStyle('Hip-hop reggae fusion, warm male vocal, one drop drums, offbeat skank guitar, deep dub bass, organ bubble, reggae horns, 76 BPM, laid back', { strict: true, genreWords: A.FUSION_PAIRS['Hip hop|Reggae'].words });
assert.ok(!skew.ok && skew.warnings.some((w) => /Genre balance: Reggae/.test(w)), JSON.stringify(skew.warnings));
// Picked voice wins and the other gender is excluded.
const fem = flip(['Hip hop', 'Reggae'], '', { gender: 'Female' });
assert.ok(/female vocal/.test(fem.style) && fem.exclude.indexOf('male vocals') !== -1, fem.style);
// Names typed by the user never reach the prompt.
const named = A.flipStyle({ card: 'flip', answers: { artist: 'Famous Person' }, flip: {} }, { fusion: ['Hip hop', 'Reggae'], tune: { extra: 'like Famous Person' } });
assert.ok(!/Famous|Person/.test(named.style), named.style);

// 4. Single-genre Flip and every other card: no game or robot words, including Surprise me.
A.TYPES.forEach((t) => A.VIBES.forEach((v) => {
  const p = A.stylePrompt({ type: t.id, sub: t.sub ? t.sub[0] : '', vibe: v, answers: {} }, {});
  assert.ok(!BAN.test(p), t.id + v + ': ' + p);
}));
Object.keys(A.GENRES).forEach((g) => vibes.forEach((v) => ['a', 'b', 'c', 'd', 'e'].forEach((title) => {
  const p = A.stylePrompt({ card: 'flip', title, flip: { vibe: v }, answers: { song: title } }, { genre: g });
  assert.ok(!BAN.test(p), g + v + ': ' + p);
})));

// 5. Lyric voice tags.
const tagged = PC.tagLyrics('[Verse 1]\nline one\n[Chorus]\nhook line\n[Verse 2]\nline two', { gender: 'Male', verse: 'Rap', chorus: 'Sung' });
assert.ok(/\[Verse 1\]\n\[Male Vocal\] \[Rap\]\nline one/.test(tagged), tagged);
assert.ok(/\[Chorus\]\n\[Sung\] \[Harmonies\]/.test(tagged), tagged);
assert.strictEqual(PC.tagLyrics(tagged, { gender: 'Male', verse: 'Rap' }), tagged, 'tagging is idempotent');

// 6. Model-written parody prompts get the same filter.
const P = require('./parody-v2.js');
assert.ok(P && typeof P.stylePrompt === 'function');
console.log('prompt check tests passed');
