'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const dev = require('./artist-dev');

function read(name) {
  return fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
}

dev.resetStore();

const thin = dev.themesFromLines(['Only one line here', 'Another lone line']);
assert.deepStrictEqual(thin, []);

const lines = [
  'The porch light stayed on after you left',
  'I still set a plate when the porch light comes on',
  'You left your hoodie on my chair',
  'That hoodie still smells like the rain',
  'I talk to the empty chair at dinner',
  'The empty chair waits at dinner',
];
const themes = dev.themesFromLines(lines);
assert.ok(themes.length >= 3 && themes.length <= 5, 'Read Me returns 3 to 5 themes');
themes.forEach(function (theme) {
  assert.ok(lines.indexOf(theme.quote) !== -1, 'every theme quotes a saved line');
});
assert.deepStrictEqual(dev.genreSuggestions(lines), [], 'unmatched lines do not invent a genre');

const gospel = [
  'I pray in church when faith feels thin',
  'The church holds grace and I pray',
  'Faith and grace meet at the church door',
];
const gospelThemes = dev.themesFromLines(gospel);
assert.ok(gospelThemes.length >= 3);
const genres = dev.genreSuggestions(gospel);
assert.strictEqual(genres.length, 1);
assert.strictEqual(genres[0].genre, 'Gospel');
assert.strictEqual(genres[0].subgenre, 'choir gospel');
const mixed = gospel.concat([
  'Hold me in the slow soul tonight',
  'A slow soul hold in the night',
]);
const mixedGenres = dev.genreSuggestions(mixed);
assert.ok(mixedGenres.length >= 2 && mixedGenres.length <= 3);
assert.ok(mixedGenres.some(function (row) { return row.genre === 'Gospel'; }));
assert.ok(mixedGenres.some(function (row) { return row.genre === 'R&B'; }));
const reggaeHits = dev.genreSuggestions([
  'The skank sits on the offbeat while the riddim waits',
  'A backyard bassline and a skank on the offbeat',
]);
assert.ok(reggaeHits.some(function (row) { return row.genre === 'Reggae' && row.subgenre === 'one drop'; }));
const reggaeNote = dev.partNote({ kind: 'verse', text: 'The skank sits on the offbeat while the riddim waits' }, 'Reggae');
assert.ok(!/irie|bredren|mon\b|ya mon|patois/i.test(reggaeNote.works + reggaeNote.improve));

const readMe = { themes: gospelThemes, genres: genres };
const persona = dev.personaFromReadMe(readMe);
assert.strictEqual(persona.pov, 'first person');
assert.ok(persona.vocabulary.indexOf('church') !== -1);
assert.ok(persona.slang.length >= 1);
assert.ok(persona.do.join(' ').indexOf('first person') !== -1);
assert.ok(/100%/.test(persona.dont.join(' ')));
assert.ok(!/—|–/.test(JSON.stringify(persona)));

const off = dev.offVoice('The spreadsheet and the parking ticket sat there', persona);
assert.strictEqual(off.off, true);
const on = dev.offVoice(gospelThemes[0].quote, persona);
assert.strictEqual(on.off, false);
const named = dev.offVoice('Make it with su' + 'no tonight please', persona);
assert.strictEqual(named.off, true);
assert.ok(!/su/.test(named.reason) || !/no tool/i.test(named.reason));

const hook = dev.rewriteOnVoice('unrelated words in this part', persona, 'hook');
assert.strictEqual(hook.ok, true);
assert.ok(dev.hookOk(hook.text));
assert.ok(gospel.indexOf(hook.text) !== -1 || gospelThemes.some(function (row) { return row.quote === hook.text; }));
const verse = dev.rewriteOnVoice('unrelated words', persona, 'verse');
assert.strictEqual(verse.ok, true);
assert.ok(verse.text.split('\n').length <= 4);
assert.ok(!verse.text.split('\n').some(function (line, index, all) {
  return all.filter(function (row) { return row.toLowerCase() === line.toLowerCase(); }).length >= 4;
}));

const caption = dev.madeCaption({
  made_how: 'ai_assisted',
  ai_used: true,
  human_elements: ['Original lyrics'],
  human_contribution: 'I wrote the lyric.',
});
assert.ok(caption.indexOf('How this song was made:') === 0);
assert.ok(caption.indexOf('AI assisted') !== -1);
assert.ok(caption.indexOf('Original lyrics') !== -1);
assert.ok(!/—|–|Suno|ToneGrid/i.test(caption));
assert.strictEqual(dev.madeCaption({ made_how: 'no_ai' }).indexOf('written, played, and performed by people') > 0, true);
assert.strictEqual(dev.madeCaption({}), '');

(async function () {
  const user = 'user-dev-1';
  const saved = await dev.saveVault(user, { kind: 'title', title: 'Porch Light' });
  assert.strictEqual(saved.ok, true);
  for (let i = 0; i < lines.length; i += 1) {
    await dev.saveVault(user, { kind: 'line', body: lines[i] });
  }
  const memo = await dev.saveVault(user, {
    kind: 'memo',
    body: 'hummed on the porch',
    mime: 'audio/webm',
    audio: Buffer.from('memo').toString('base64'),
  });
  assert.strictEqual(memo.item.has_audio, true);
  const before = await dev.status(user);
  assert.strictEqual(before.credits, dev.ALLOWANCE);
  const readOut = await dev.readMe(user);
  assert.strictEqual(readOut.ok, true);
  assert.strictEqual(readOut.credit, 1);
  assert.strictEqual(readOut.credits, dev.ALLOWANCE - 1);
  assert.ok(readOut.read_me.themes.length >= 3);
  const locked = await dev.personaLock(user);
  assert.strictEqual(locked.ok, true);
  assert.strictEqual(locked.credits, dev.ALLOWANCE - 2);
  const rewritten = await dev.voiceRewrite(user, { kind: 'hook', text: 'The spreadsheet and the parking ticket' });
  assert.strictEqual(rewritten.ok, true);
  assert.ok(dev.hookOk(rewritten.text));
  assert.strictEqual(rewritten.credits, dev.ALLOWANCE - 3);

  dev.resetStore();
  const pasted = [
    'I left my keys on the porch again',
    'Dirt on my boots and a whiskey song',
    '',
    'The porch light stayed on for me',
    'I still see that porch light',
    '',
    'The highway took the last of the night',
    'Whiskey on the dashboard tonight',
  ].join('\n');
  const broken = await dev.songBreakdown('user-song', { text: pasted });
  assert.strictEqual(broken.ok, true);
  assert.strictEqual(broken.credit, 1);
  assert.strictEqual(broken.credits, dev.ALLOWANCE - 1);
  assert.strictEqual(broken.voice_source, 'lyrics');
  assert.ok(broken.parts.some(function (row) { return row.kind === 'hook' && row.inferred; }));
  const labeled = await dev.songBreakdown('user-song', {
    text: 'Verse 1\nI pray for grace in the church tonight\n\nChorus\nLord hold me when the night gets long\nAmen I still believe\n\nVerse 2\nHeaven knows I kept the faith today',
  });
  assert.strictEqual(labeled.ok, true);
  const gospelHook = labeled.parts.filter(function (row) { return row.kind === 'hook'; })[0];
  assert.strictEqual(gospelHook.label, 'Hook');
  assert.strictEqual(gospelHook.hook_ok, true);
  assert.ok(/Amen|Glory|Hallelujah/.test(gospelHook.works));
  assert.ok(!/—|–|Suno|ToneGrid/i.test(JSON.stringify(labeled.parts)));
  const emptySong = await dev.songBreakdown('user-song', { text: 'too short' });
  assert.strictEqual(emptySong.ok, false);
  const afterEmpty = await dev.status('user-song');
  assert.strictEqual(afterEmpty.credits, labeled.credits);
  const moved = dev.improvePart(
    'The truck sat by the highway\nI left my keys on the porch again',
    'verse',
    { vocabulary: ['porch', 'keys'], quotes: ['I left my keys on the porch again'], genre: 'Country', slang: ['reckon'] }
  );
  assert.strictEqual(moved.text.split('\n')[0], 'I left my keys on the porch again');
  assert.ok(moved.text.indexOf('truck') !== -1);
  assert.ok(!/reckon/.test(moved.text));
  const crowded = 'wait here\nwait here\nwait here\nwait here\nI still see the porch light on';
  const tightened = dev.improvePart(crowded, 'hook', { vocabulary: ['porch'], quotes: [], genre: 'Country' });
  assert.ok(dev.hookOk(tightened.text));
  tightened.text.split('\n').filter(Boolean).forEach(function (line) {
    assert.ok(crowded.indexOf(line) !== -1);
  });
  const full = await dev.songRewrite('user-song', { parts: labeled.parts });
  assert.strictEqual(full.ok, true);
  assert.strictEqual(full.credit, 1);
  assert.strictEqual(full.voice_source, 'lyrics');
  full.parts.forEach(function (part) {
    part.suggested.split('\n').filter(Boolean).forEach(function (line) {
      assert.ok(part.original.indexOf(line) !== -1);
    });
  });
  const savedOriginal = await dev.saveVault('user-song', { kind: 'song', title: 'Original draft', body: pasted });
  assert.strictEqual(savedOriginal.item.kind, 'song');
  assert.strictEqual(savedOriginal.item.title, 'Original draft');
  assert.ok(savedOriginal.item.body.indexOf('porch') !== -1);

  dev.resetStore();
  const empty = await dev.readMe('user-dev-2');
  assert.strictEqual(empty.ok, false);
  const still = await dev.status('user-dev-2');
  assert.strictEqual(still.credits, dev.ALLOWANCE);

  const html = read('song-helper.html');
  const attest = read('attest.html');
  const review = read('review.html');
  const page = read('song-helper-dev.js');
  assert.ok(html.includes('id="sh-dev"'));
  assert.ok(/id="sh-dev"[^>]*hidden/.test(html));
  assert.ok(html.includes('I already have a song'));
  assert.ok(html.includes('Paste your full song'));
  assert.ok(html.includes('src="/lib/artist-dev.js'));
  assert.ok(html.includes('Make the whole song better (1 credit)'));
  assert.ok(page.includes('Make it better'));
  assert.ok(page.includes('Keep mine'));
  assert.ok(page.includes('Use this'));
  assert.ok(page.includes('Original draft'));
  assert.ok(page.includes('authorship proof'));
  assert.ok(html.includes('data-apply-package="Social package"'));
  assert.ok(html.includes('Apply free'));
  assert.ok(html.includes('100% of your recording royalties. Publishing is optional, under a separate agreement.'));
  assert.ok(attest.includes('id="attest-ai-use"'));
  assert.ok(attest.includes('data-made-caption'));
  assert.ok(review.includes('data-review-made-caption'));
  assert.ok(page.includes('Rewrite on voice (1 credit)'));
  const haveStart = html.indexOf('id="sh-have"');
  const haveEnd = html.indexOf('id="sh-page"');
  [html.slice(haveStart, haveEnd), html.slice(html.indexOf('id="sh-dev"'), html.indexOf('id="sh-social-card"') + 400), page, read('lib/artist-dev.js')].forEach(function (blob) {
    assert.ok(!/—|–/.test(blob));
    assert.ok(!/Suno|ToneGrid/i.test(blob.replace(/su', 'no|tone', 'grid/g, '')));
  });
  console.log('lib/artist-dev.test.js ok');
}()).catch(function (err) {
  console.error(err);
  process.exit(1);
});
