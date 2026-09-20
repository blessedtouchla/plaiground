'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

function visibleCopy(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ');
}

function run() {
  const html = read('blog-plai-plus-collab.html');
  const hub = read('blog.html');
  const vercel = read('vercel.json');
  const visible = visibleCopy(html);
  const post20 = read('blog-push-the-button.html');

  assert.ok(html.includes('The beat stays locked until both of you say'), 'title stays sticky');
  assert.ok(html.includes('Sep 20, 2026'), 'date is Sep 20, 2026');
  assert.ok(html.includes('https://www.plainow.com/plai'), 'links the PLAI+ room');
  assert.ok(html.includes('https://www.plainow.com'), 'links PLAInow');
  assert.ok(/signup\.html">Release when ready</.test(html), 'soft CTA stays on wannaplai');
  assert.ok(/plainow\.com is listen and collab/.test(visible), 'listen house stays on plainow');
  assert.ok(/wannaplai\.com is release/.test(visible), 'distribution stays on wannaplai');
  assert.ok(/credits and the splits before the full stems/.test(visible), 'credits land before stems');
  assert.ok(/stamp that is not on the page yet/.test(visible), 'does not invent a signing product on plainow');
  assert.ok(/A generator will not hunt down a stolen copy/.test(visible), 'does not promise a generator will catch theft');
  assert.ok(/not a flyer that promises a royalty fortune/.test(visible), 'soft-stops get-rich flyer copy');
  assert.ok(!/SignWell|ToneGrid|DistroKid|TuneCore|CD Baby|InterSpace|Flossy|hop\.put/i.test(visible), 'no partner / hop names');
  assert.ok(!/Suno will|auto-catch|automatically catch/i.test(visible), 'does not promise Suno will auto-catch copies');
  assert.ok(!/Introducing Our New Feature/i.test(visible), 'no corporate launch headline');
  assert.ok(!/Twenty-one posts|Launch calendar done/i.test(hub), 'hub does not invent a fake post-21 thesis');
  assert.ok(/Twenty-nine posts/.test(hub), 'hub count is honest');
  assert.ok(hub.includes('blog-plai-plus-collab.html'), 'hub lists the live card');
  assert.ok(hub.indexOf('blog-plai-plus-collab.html') < hub.indexOf('blog-plainow-is-live.html'), 'new card sits on top');
  assert.ok(vercel.includes('/blog/plai-plus-collab'), 'pretty path is rewritten');
  assert.ok(post20.includes('lick the stamp'), 'post 20 is not rewritten');

  console.log('lib/blog-plai-plus-collab.test.js ok');
}

run();
