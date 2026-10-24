'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = __dirname;

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function visibleFaqs(html) {
  const marker = html.split(/aria-label="Questions"|<h2>Quick answers<\/h2>/);
  assert.ok(marker.length > 1, 'missing visible FAQ block');
  const block = marker.pop().split(/<\/section>/)[0];
  const faqs = [];
  const re = /<strong>([\s\S]*?)<\/strong>\s*([\s\S]*?)<\/p>/g;
  let match;
  while ((match = re.exec(block))) {
    faqs.push({
      q: match[1].replace(/<[^>]+>/g, '').trim(),
      a: match[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    });
  }
  return faqs;
}

function jsonLdBlocks(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(function (match) {
    return JSON.parse(match[1]);
  });
}

function faqLd(html) {
  const block = jsonLdBlocks(html).find(function (item) { return item['@type'] === 'FAQPage'; });
  assert.ok(block, 'missing FAQPage JSON-LD');
  assert.strictEqual(block['@context'], 'https://schema.org');
  assert.ok(Array.isArray(block.mainEntity) && block.mainEntity.length > 0, 'FAQPage mainEntity is empty');
  return block.mainEntity.map(function (question) {
    assert.strictEqual(question['@type'], 'Question');
    assert.strictEqual(typeof question.name, 'string');
    assert.ok(question.name.length > 0);
    assert.ok(question.acceptedAnswer, 'Question is missing acceptedAnswer');
    assert.strictEqual(question.acceptedAnswer['@type'], 'Answer');
    assert.strictEqual(typeof question.acceptedAnswer.text, 'string');
    assert.ok(question.acceptedAnswer.text.length > 0);
    return { q: question.name, a: question.acceptedAnswer.text };
  });
}

const pages = {
  'distribution.html': '/distribution',
  'split-sheets.html': '/split-sheets',
  'get-on-spotify.html': '/guides/get-on-spotify',
  'ai-labels.html': '/ai-labels',
  'cover-art.html': '/album-cover-maker',
  'epk.html': '/epk-maker',
  'split-sheet-template.html': '/split-sheet-template',
  'song-helper.html': '/ai-lyrics-generator'
};

const related = [
  '/distribution',
  '/split-sheets',
  '/guides/get-on-spotify',
  '/ai-labels',
  '/album-cover-maker',
  '/epk-maker',
  '/split-sheet-template',
  '/ai-lyrics-generator',
  '/ipi-guide',
  '/how-it-works'
];

Object.keys(pages).forEach(function (file) {
  const html = read(file);
  const visible = visibleFaqs(html);
  const linked = faqLd(html);
  assert.strictEqual(visible.length, linked.length, file + ' FAQ count');
  visible.forEach(function (item, index) {
    assert.strictEqual(linked[index].q, item.q, file + ' question ' + index);
    assert.strictEqual(linked[index].a, item.a, file + ' answer ' + index);
  });
  const main = html.match(/<main[\s\S]*?<\/main>/)[0];
  const hits = related.filter(function (href) {
    return href !== pages[file] && main.includes('href="' + href + '"');
  });
  assert.ok(hits.length >= 2, file + ' related links ' + hits.join(', '));
});

const guide = read('split-sheets.html');
const template = read('split-sheet-template.html');
const guideTitle = guide.match(/<title>([^<]+)<\/title>/)[1];
const templateTitle = template.match(/<title>([^<]+)<\/title>/)[1];
const guideDesc = guide.match(/<meta name="description" content="([^"]+)"/)[1];
const templateDesc = template.match(/<meta name="description" content="([^"]+)"/)[1];
const guideH1 = guide.match(/<h1>([\s\S]*?)<\/h1>/)[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const templateH1 = template.match(/<h1>([\s\S]*?)<\/h1>/)[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

assert.notStrictEqual(guideTitle, templateTitle);
assert.notStrictEqual(guideDesc, templateDesc);
assert.notStrictEqual(guideH1, templateH1);
assert.strictEqual(guideTitle, 'What Is a Split Sheet and Why It Matters | PLAIGROUND');
assert.strictEqual(templateTitle, 'Split Sheet Template: Fill It Out and Get It Signed | PLAIGROUND');
assert.ok(guide.includes('<link rel="canonical" href="https://www.wannaplai.com/split-sheets"'));
assert.ok(template.includes('<link rel="canonical" href="https://www.wannaplai.com/split-sheet-template"'));
assert.ok(guide.includes('href="/split-sheet-template"'), 'guide links to the template');
assert.ok(template.includes('href="/split-sheets"'), 'template links to the guide');
assert.ok(guide.includes('Join free. Get starter credits to try every tool.'));
assert.ok(template.includes('Join free. Get starter credits to try every tool.'));
assert.ok(!/free starter credits/i.test(guide));
assert.ok(!/free starter credits/i.test(template));
assert.ok(!/—|–/.test(guide + template), 'split sheet pages use a hyphen, not a dash');
assert.ok(!/Suno|ToneGrid|distributor/i.test(guide + template));
assert.ok(!/distributor/i.test(read('cover-art.html').match(/aria-label="Questions"[\s\S]*?<\/section>/)[0]));

const vercel = JSON.parse(read('vercel.json'));
const templateRewrite = vercel.rewrites.find(function (row) { return row.source === '/split-sheet-template'; });
assert.strictEqual(templateRewrite.destination, '/split-sheet-template.html');
assert.ok(vercel.rewrites.some(function (row) {
  return row.source === '/split-sheets' && row.destination === '/split-sheets.html';
}));

const sitemap = read('sitemap.xml');
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(function (match) { return match[1]; });
assert.strictEqual(new Set(locs).size, locs.length, 'sitemap locs are unique');
[
  'https://www.wannaplai.com/',
  'https://www.wannaplai.com/distribution',
  'https://www.wannaplai.com/split-sheets',
  'https://www.wannaplai.com/guides/get-on-spotify',
  'https://www.wannaplai.com/ai-labels',
  'https://www.wannaplai.com/album-cover-maker',
  'https://www.wannaplai.com/epk-maker',
  'https://www.wannaplai.com/split-sheet-template',
  'https://www.wannaplai.com/ai-lyrics-generator',
  'https://www.wannaplai.com/blog/how-to-get-your-music-on-spotify',
  'https://www.wannaplai.com/blog/distributor-for-ai-assisted-music',
  'https://www.wannaplai.com/blog/what-is-an-ipi-number',
  'https://www.wannaplai.com/blog/free-split-sheet-template',
  'https://www.wannaplai.com/blog/register-with-bmi-as-a-songwriter',
  'https://www.wannaplai.com/blog/song-royalties-explained',
  'https://www.wannaplai.com/blog/epk-examples',
  'https://www.wannaplai.com/blog/how-to-label-ai-music',
  'https://www.wannaplai.com/battle',
  'https://www.wannaplai.com/destination'
].forEach(function (loc) {
  assert.ok(locs.includes(loc), 'sitemap missing ' + loc);
});

[
  'blog.html',
  'blog-split-sheets.html',
  'blog-first-release.html',
  'blog-ai-label-required.html',
  'blog-publishing-is-not-distribution.html',
  'blog-free-split-sheet-template.html',
  'blog-how-to-get-your-music-on-spotify.html',
  'blog-epk-examples.html'
].forEach(function (file) {
  const html = read(file);
  const toolHits = ['/distribution', '/split-sheets', '/split-sheet-template', '/guides/get-on-spotify', '/ai-labels', '/album-cover-maker', '/epk-maker', '/ai-lyrics-generator'].filter(function (href) {
    return html.includes('href="' + href + '"');
  });
  assert.ok(toolHits.length >= 2, file + ' should link back to tool pages');
});

console.log('seo-pages.test.js ok');
