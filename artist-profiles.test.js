'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const core = require('./artist-profiles.js');

function read(name) {
  return fs.readFileSync(path.join(__dirname, name), 'utf8');
}

function memoryStore(seed) {
  const data = Object.assign({}, seed || {});
  return {
    getItem(key) { return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null; },
    setItem(key, value) { data[key] = String(value); },
    dump() { return data; }
  };
}

function runModel() {
  const seeded = core.normalize(core.seedFromPlan({
    song: 'made',
    goal: 'money',
    note: '  rap in LA  ',
    stops: ['check']
  }));
  assert.strictEqual(seeded.artists.length, 1);
  assert.strictEqual(seeded.artists[0].stage, 'made');
  assert.strictEqual(seeded.artists[0].picked, true);
  assert.strictEqual(seeded.artists[0].name, '');
  assert.strictEqual(seeded.artists[0].genre, '');
  assert.strictEqual(seeded.note, '  rap in LA  '.slice(0, 240));
  assert.strictEqual(seeded.count, '');

  const long = core.normalize(core.seedFromPlan({ song: 'nope', note: 'x'.repeat(300) }));
  assert.strictEqual(long.note.length, 240);
  assert.strictEqual(long.artists[0].stage, '');

  const store = memoryStore();
  store.setItem('plaigroundDestinationPlan', JSON.stringify({ song: 'out', note: 'already out', goal: 'fanbase' }));
  const loaded = core.loadRecord(store);
  assert.strictEqual(loaded.persist, true);
  assert.strictEqual(loaded.record.artists[0].stage, 'out');
  assert.strictEqual(loaded.record.note, 'already out');

  store.setItem(core.STORAGE_KEY, JSON.stringify({
    count: '2-5',
    note: 'kept',
    artists: [{ id: 'keep', name: 'North', stage: 'idea', picked: true }]
  }));
  const again = core.loadRecord(store);
  assert.strictEqual(again.persist, false);
  assert.strictEqual(again.record.artists[0].name, 'North');
  assert.strictEqual(again.record.artists[0].stage, 'idea');
  assert.strictEqual(again.record.note, 'kept');

  assert.strictEqual(core.pickedStage({
    artists: [
      { stage: 'idea', picked: false },
      { stage: 'out', picked: true }
    ]
  }), 'out');
  assert.strictEqual(core.pickedStage({ artists: [{ stage: 'made', picked: false }] }), 'made');
  assert.strictEqual(core.pickedStage({
    artists: [
      { stage: 'idea', picked: false },
      { stage: 'made', picked: false }
    ]
  }), '');
  assert.strictEqual(core.pickedStage({ artists: [{ stage: '', picked: true }] }), '');

  const cleaned = core.normalize({
    count: 'label',
    note: 'hi',
    artists: [{
      id: 'one',
      name: '  Ada  ',
      genre: 'Not A Genre',
      genres: ['Pop', 'Pop', 'Hip-Hop', 'Invented'],
      genreOther: 'bedroom pop',
      city: 'Oakland',
      stage: 'idea',
      madeBy: 'both',
      links: { spotify: ' https://open.spotify.com/artist/abc ', tiktok: 'tiktok.com/@ada' },
      picked: true
    }]
  });
  assert.strictEqual(cleaned.count, 'label');
  assert.strictEqual(cleaned.artists[0].genre, '');
  assert.deepStrictEqual(cleaned.artists[0].genres, ['Pop', 'Hip-Hop']);
  assert.strictEqual(cleaned.artists[0].links.spotify, 'https://open.spotify.com/artist/abc');
  assert.strictEqual(cleaned.artists[0].links.tiktok, 'tiktok.com/@ada');
  assert.strictEqual(core.isFullUrl('https://open.spotify.com/artist/abc'), true);
  assert.strictEqual(core.isFullUrl('http://example.com/a'), true);
  assert.strictEqual(core.isFullUrl(''), true);
  assert.strictEqual(core.isFullUrl('tiktok.com/@ada'), false);
  assert.strictEqual(core.isFullUrl('javascript:alert(1)'), false);
  assert.ok(core.GENRES.indexOf('Hip-Hop') !== -1);
  assert.ok(core.GENRES.indexOf('R&B/Soul') !== -1);
  assert.strictEqual(core.STORAGE_KEY, 'plaigroundArtistProfiles');
}

function runPage() {
  const artists = read('artists.html');
  const destination = read('destination.html');
  const destJs = read('destination.js');
  const js = read('artist-profiles.js');
  const css = read('artist-profiles.css');
  const start = artists.indexOf('id="plai-about"');
  const end = artists.indexOf('id="artist-create-panel"');
  const sectionEnd = artists.indexOf('<details class="artists-act-edu">');
  assert.ok(start !== -1 && end !== -1 && start < end, 'Tell Plai sits above the release-artist form');
  assert.ok(sectionEnd !== -1 && start < sectionEnd && sectionEnd < end);
  const section = artists.slice(start, sectionEnd);
  assert.ok(section.includes('Tell Plai about you'));
  assert.ok(section.includes('How many artist profiles do you run?'));
  assert.ok(section.includes('data-plai-count="1"'));
  assert.ok(section.includes('data-plai-count="2-5"'));
  assert.ok(section.includes('data-plai-count="6+"'));
  assert.ok(section.includes('data-plai-count="label"'));
  assert.ok(section.includes('Label or manager'));
  assert.ok(section.includes('id="plai-about-add"'));
  assert.ok(section.includes('>Add artist<'));
  assert.ok(section.includes('maxlength="240"'));
  assert.ok(!section.includes('data-artist-add'));
  assert.ok(!section.includes('id="artist-spotify"'));
  assert.ok(artists.includes('artist-profiles.js'));
  assert.ok(artists.includes('artist-profiles.css'));
  assert.ok(artists.includes('artists.js?v=20260922ar3'));
  assert.ok(destination.includes('artist-profiles.js'));
  assert.ok(destJs.includes('ArtistProfiles') && destJs.includes('pickedStage'));
  const added = section + '\n' + js + '\n' + css;
  assert.ok(!added.includes('\u2014'));
  assert.ok(!/fetch\s*\(/.test(js));
  assert.ok(!/\$\d/.test(added));
}

runModel();
runPage();
console.log('artist-profiles.test.js ok');
