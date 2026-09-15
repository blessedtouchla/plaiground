'use strict';

const assert = require('assert');
const roster = require('./artist-roster');

function victoriaMe(extra) {
  return {
    artist: 'VEXA',
    profile: {
      artists: [
        { id: 'a1', name: 'Herman Watson', source: 'created' },
        { id: 'a2', name: 'Amplify', source: 'created' },
        { id: 'a3', name: 'Vicki G', source: 'created' },
        { id: 'a4', name: 'The kid', source: 'created' },
        { id: 'a5', name: 'Vickilicious', source: 'created' },
        { id: 'a6', name: 'VEXA', source: 'created' },
      ].concat(extra || []),
    },
  };
}

function run() {
  const owned = roster.fromMe(victoriaMe());
  assert.deepStrictEqual(roster.namesOf(owned), [
    'Herman Watson',
    'Amplify',
    'Vicki G',
    'The kid',
    'Vickilicious',
    'VEXA',
  ]);

  const withLeftover = roster.fromMe(victoriaMe([
    { id: 'mock', name: 'John ham', source: 'created' },
  ]));
  assert.strictEqual(roster.namesOf(withLeftover).indexOf('John ham'), -1);

  const rememberedOrphans = [
    { id: 'orphan-1', name: 'Vikilicious', source: 'created', tonegrid_artist_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
    { id: 'orphan-2', name: 'Vikilicioux', source: 'created', tonegrid_artist_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
  ];
  assert.deepStrictEqual(
    roster.namesOf(roster.fromMe(victoriaMe())),
    roster.namesOf(roster.fromMe(victoriaMe())),
    'Your Artists roster is the only selectable set'
  );
  assert.ok(roster.fromMe({ profile: { artists: rememberedOrphans } }).length === 2, 'real owned typo profiles still list if they are on the roster');
  assert.ok(!roster.namesOf(owned).includes('Vikilicious'));
  assert.ok(!roster.namesOf(owned).includes('Vikilicioux'));

  const dupes = roster.fromMe({
    profile: {
      artists: [
        { id: '1', name: 'VEXA', source: 'created' },
        { id: '2', name: 'vexa', source: 'created' },
      ],
    },
  });
  assert.deepStrictEqual(roster.namesOf(dupes), ['VEXA']);

  assert.strictEqual(roster.fromMe({ artist: 'John ham', profile: { artists: [] } }).length, 0);
  console.log('lib/artist-roster.test.js ok');
}

run();
