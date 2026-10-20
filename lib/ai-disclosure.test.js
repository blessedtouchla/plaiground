'use strict';
const assert = require('assert');
const ai = require('./ai-disclosure');
const profile = require('./profile');
const mail = require('./mail');

const body = {
  made_how: 'fully_ai', human_elements: ['Lead vocals performed'], rights_confirmed: true, ai_service: 'Suno',
  plaiground_disclosure: {
    made_how: 'fully_ai', auto_switched: true, switched_from: 'ai_assisted', ai_used: true,
    human_elements: ['Original lyrics', 'Prompt authorship', 'Mixed by a person'],
    human_contribution: 'I wrote the words.', ai_service: '', ai_service_other: 'Udio',
    rights_confirmed: true, rights_confirmed_at: '2026-10-19T20:00:00.000Z',
    legal_first: 'Vic', legal_last: 'Test', lyrics: 'la la la', track_lyrics: [{ track_id: 't1', title: 'A', lyrics: 'oh' }],
  },
};
const rec = ai.fromSubmit(body, { at: new Date('2026-10-19T21:00:00Z') });
assert.strictEqual(rec.made_how, 'fully_ai');
assert.strictEqual(rec.auto_switched, true);
assert.deepStrictEqual(rec.human_elements, ['Original lyrics', 'Prompt authorship', 'Mixed by a person']);
assert.strictEqual(rec.ai_service_other, 'Udio');
assert.strictEqual(rec.rights_confirmed_at, '2026-10-19T20:00:00.000Z');
assert.strictEqual(rec.lyrics, 'la la la');
assert.strictEqual(rec.track_lyrics.length, 1);

// flat fallback when old client sends no nested object
const flat = ai.fromSubmit({ made_how: 'no_ai', rights_confirmed: true, legal_first: 'A' }, { at: new Date('2026-10-19T21:00:00Z'), legal_last: 'B' });
assert.strictEqual(flat.made_how, 'no_ai');
assert.strictEqual(flat.auto_switched, false);
assert.strictEqual(flat.rights_confirmed_at, '2026-10-19T21:00:00.000Z');
assert.strictEqual(flat.legal_last, 'B');

// profile keeps it on the release and survives later upserts without it
let p = profile.upsertRelease({}, { id: '11111111-1111-1111-1111-111111111111', title: 'Song', plaiground_ai_disclosure: rec });
assert.strictEqual(p.releases[0].plaiground_ai_disclosure.human_contribution, 'I wrote the words.');
p = profile.upsertRelease(p, { id: '11111111-1111-1111-1111-111111111111', title: 'Song', upc: '123' });
assert.strictEqual(p.releases[0].plaiground_ai_disclosure.auto_switched, true);

const lines = ai.emailLines(rec).join('\n');
assert.ok(lines.includes('Fully AI (auto-switched from AI-assisted)'));
assert.ok(lines.includes('Prompt authorship'));
assert.ok(lines.includes('by Vic Test'));
assert.ok(ai.summary(rec).includes('rights OK'));
assert.strictEqual(typeof mail.sendQcReleaseAlert, 'function');
console.log('ai-disclosure ok');

// artist-facing line
const made = ai.howItWasMade({ made_how: 'ai_assisted', human_elements: ['Lead vocals performed', 'Prompt authorship'], human_contribution: 'I sang it.', ai_service: 'Suno', plaiground_artist_id: 'a1' });
assert.strictEqual(made.text, 'How it was made: AI-assisted. A person did: Lead vocals performed, Prompt authorship.');
assert.strictEqual(made.description, 'I sang it.');
assert.ok(!/suno/i.test(made.text));
assert.strictEqual(ai.normalize({ made_how: 'no_ai', plaiground_artist_id: 'a1' }).plaiground_artist_id, 'a1');
console.log('how-it-was-made ok');
