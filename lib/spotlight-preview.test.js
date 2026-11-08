'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const preview = require('./spotlight-preview');

const root = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function good(extra) {
  return Object.assign({
    name: 'Sample North',
    email: 'north@example.com',
    link: 'https://example.com/sample-north',
    story: 'We met after the set and I want an editor to hear how the room felt.',
    updates: false,
    company: ''
  }, extra || {});
}

const ok = preview.check(good());
assert.strictEqual(ok.ok, true);
assert.strictEqual(ok.stored, false);
assert.strictEqual(ok.emailed, false);
assert.strictEqual(ok.subscribed, false);
assert.strictEqual(ok.updatesChecked, false);
assert.strictEqual(ok.preview.updates, false);
assert.strictEqual(ok.preview.email, 'north@example.com');

const opted = preview.check(good({ updates: 'yes' }));
assert.strictEqual(opted.ok, true);
assert.strictEqual(opted.updatesChecked, true);
assert.strictEqual(opted.subscribed, false, 'a checked box still does not subscribe');
assert.strictEqual(opted.stored, false);

const missing = preview.check({});
assert.strictEqual(missing.ok, false);
assert.strictEqual(missing.stored, false);
assert.ok(missing.errors.name);
assert.ok(missing.errors.email);
assert.ok(missing.errors.link);
assert.ok(missing.errors.story);

assert.ok(preview.check(good({ email: 'not-an-email' })).errors.email);
assert.ok(preview.check(good({ email: 'a@b' })).errors.email);
assert.ok(preview.check(good({ name: 'A' })).errors.name);
assert.ok(preview.check(good({ name: 'N'.repeat(81) })).errors.name);
assert.ok(preview.check(good({ story: 'Too short.' })).errors.story);
assert.ok(preview.check(good({ story: 'S'.repeat(801) })).errors.story);
assert.ok(preview.check(good({ link: 'example.com/song' })).errors.link);
assert.ok(preview.check(good({ link: 'javascript:alert(1)' })).errors.link);
assert.ok(preview.check(good({ link: 'https://example.com/a https://example.com/b' })).errors.link);
assert.ok(preview.check(good({ link: 'https://user:secret@example.com/song' })).errors.link);
assert.strictEqual(preview.check(good({ link: 'http://example.com/song' })).ok, true);

const trapped = preview.check(good({ company: 'filled by a bot' }));
assert.strictEqual(trapped.ok, false);
assert.strictEqual(trapped.stored, false);
assert.ok(trapped.errors.form);
assert.strictEqual(JSON.stringify(trapped).indexOf('north@example.com'), -1, 'honeypot result does not echo the email');
assert.strictEqual(JSON.stringify(missing).indexOf('@'), -1, 'errors do not echo the address');

const html = read('spotlight-preview.html');
const css = read('spotlight-preview.css');
const client = read('spotlight-preview.js');
const vercel = JSON.parse(read('vercel.json'));
const sitemap = read('sitemap.xml');
const visible = html.replace(/<script\b[\s\S]*?<\/script>/gi, ' ');

assert.ok(html.includes('name="robots" content="noindex, nofollow"'));
assert.ok(html.includes('Met us at SIQA?'));
assert.ok(html.includes('Nothing you type is saved'));
assert.ok(client.includes('Not saved.'));
assert.ok(/type="checkbox"/.test(html));
assert.ok(!/type="checkbox"[^>]*checked/.test(html), 'newsletter box is not prechecked');
assert.ok(!/type="file"/.test(html));
assert.ok(!/birthdate|date of birth|home address|phone|tel/i.test(visible));
assert.ok(!/SIQA logo|Spotify logo|official partner|guaranteed feature|prize|testimonial/i.test(visible));
assert.ok(html.includes('independent publication'));
assert.ok(html.includes('does not subscribe'));
assert.ok(html.includes('method="post"'));
assert.ok(html.includes('event.preventDefault()'));
assert.ok(client.includes('https://wannaplai.com/song-helper'));
assert.ok(client.includes('https://wannaplai.com/destination'));
assert.ok(html.includes('href="https://wannaplai.com"'));
assert.ok(!/href="[^"]*\/song-lab"/i.test(html + client));
assert.ok(!/href="[^"]*\/songlab"/i.test(html + client));
assert.ok(!/href="[^"]*\/roadmap"/i.test(html + client));
assert.ok(!/starter credit|free credit/i.test(visible + client));
assert.ok(/signed-out copy/.test(client));
assert.ok(/Signup is free if you want to save a route/.test(client));
assert.ok(!html.includes('https://www.wannaplai.com/siqa-spotlight-preview'));
assert.ok(css.includes('prefers-reduced-motion'));
assert.ok(css.includes('[hidden] { display: none !important; }'));
assert.ok(!/fetch\s*\(|localStorage|sessionStorage|XMLHttpRequest|sendBeacon|WebSocket/.test(client));
assert.ok(client.includes('textContent'));
assert.ok(!/innerHTML/.test(client));

assert.ok(vercel.rewrites.some(function (row) {
  return row.source === '/siqa-spotlight-preview' && row.destination === '/spotlight-preview.html';
}));
assert.ok(vercel.headers.some(function (row) {
  return row.source === '/siqa-spotlight-preview' && row.headers.some(function (header) {
    return header.key === 'X-Robots-Tag' && header.value === 'noindex, nofollow';
  });
}));
assert.ok(!/siqa-spotlight-preview/.test(sitemap), 'preview stays out of the sitemap');
assert.ok(!/spotlight-preview/.test(read('blog.html')), 'preview is not added to the blog index');
assert.ok(!/spotlight-preview/.test(read('robots.txt')));

console.log('lib/spotlight-preview.test.js ok');
