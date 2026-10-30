// Score the Moment: ladder, listening layer, thesis lock, templates, self score.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const SM = require('./score-moment');

assert.strictEqual(SM.QUESTIONS.length, 7);
assert.deepStrictEqual(SM.screensFor(true).map((q) => q.key), ['moment', 'truth', 'line']);
assert.strictEqual(SM.MAX_FOLLOWUPS, 3);
assert.ok(SM.isThin('sad'));
assert.ok(!SM.isThin('I sat in the car outside her place and could not go in'));
assert.ok(!SM.isThin('Still here', SM.QUESTIONS[5]));
assert.deepStrictEqual(['sense', 'body', 'feel'].map((_, i, a) => SM.nextAngle(a.slice(0, i))), ['sense', 'body', 'feel']);
assert.ok(SM.tears('I am crying writing this'));
assert.ok(SM.TEARS_LINE && /skip/i.test(SM.TEARS_LINE));
assert.strictEqual(SM.catchLine('I sat in the car and the porch light was still on, I never went in'), 'I sat in the car and the porch light was still on');
assert.ok(SM.repeats({ moment: 'the porch at night', detail: 'porch light' }).indexOf('porch') !== -1);

const answers = { moment: 'Leaving home', who: 'my mom', truth: 'I was scared to go and never told her', detail: 'the porch light left on', arc: 'Start: scared. End: proud', line: 'Porch light still on', sound: ['90s R&B'], avoid: 'country, autotune' };
const notes = SM.updateNotes({}, answers, []);
const lock = SM.lockThesis(notes, answers.line);
assert.ok(lock.thesis && lock.hook === 'Porch light still on');
assert.ok(SM.understanding(notes).length > 10);
const block = SM.lyricBlock(lock, ['Porch light still on'], answers);
assert.ok(/verse 1/i.test(block) && /porch light/i.test(block));
assert.ok(/second person|you/i.test(SM.povRule('my mom')));
const st = SM.applyStyle('warm soul ballad', lock, answers);
assert.ok(st.exclude.indexOf('country') !== -1 && st.exclude.length > 2);
assert.ok(!/suno/i.test(st.style));

const weak = '[Verse 1]\nbroken heart, set me free\nmeant to be, stars align\n[Chorus]\nnever let you go\nnever let you go';
const r = SM.selfScore(weak, lock, answers);
assert.ok(r.cliches.length >= 3 && r.low.length > 0);
assert.ok(SM.rewriteRule(r).length > 10 && SM.coachNote(r.scores).length > 5);
const good = '[Verse 1]\nThe porch light left on when I pulled away\nMom in the doorway, nothing to say\n[Chorus]\nPorch light still on\nPorch light still on, I was scared to go\n[Verse 2]\nNow I am proud, I call her on the road';
assert.ok(SM.selfScore(good, lock, answers).scores.fit >= SM.selfScore(weak, lock, answers).scores.fit);

const t = SM.parseTurn('{"reflect":"So it is the porch.","checkin":"","catch":"","guesses":["a","b"],"notes":{"message":"m"},"final":""}');
assert.strictEqual(t.reflect, 'So it is the porch.');
assert.ok(SM.parseTurn('not json').reflect !== undefined);
const lt = SM.localTurn({ key: 'line', answer: 'Porch light still on', final: true, answers, notes: {}, bank: [] });
assert.ok(lt.final.length > 0);

// No em dashes, and the engine never named in copy.
const src = fs.readFileSync(path.join(__dirname, 'score-moment.js'), 'utf8');
assert.ok(src.indexOf('\u2014') === -1);
const arcade = fs.readFileSync(path.join(__dirname, '..', 'arcade.js'), 'utf8');
assert.ok(arcade.indexOf('\u2014') === -1 && arcade.indexOf("SCREENS['m-q']") !== -1);
const server = require('./arcade-server');
assert.strictEqual(typeof server.ACTIONS['arcade-moment-turn'], 'function');
assert.ok(server.PAGE_HTML.indexOf('/lib/score-moment.js?v=20261030moment') !== -1);
console.log('score-moment tests passed');
