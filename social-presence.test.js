'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'social.html'), 'utf8');
const vercel = JSON.parse(fs.readFileSync(path.join(__dirname, 'vercel.json'), 'utf8'));

assert.ok(html.includes('Social Media Presence'));
assert.ok(html.includes('class="coming-soon">Coming soon / join waitlist</span>'));
assert.ok(html.includes('Not charged on this page'));
assert.ok(html.includes('Content engine'));
assert.ok(html.includes('$199'));
assert.ok(html.includes('Starter'));
assert.ok(html.includes('$59/mo'));
assert.ok(html.includes('Grow'));
assert.ok(html.includes('$179/mo'));
assert.ok(html.includes('Full management'));
assert.ok(html.includes('$449/mo'));
assert.ok(html.includes('No follower count is promised.'));
assert.ok(html.includes('No virality or chart position is promised.'));
assert.ok(html.includes('href="contact.html">Join the waitlist</a>'));
assert.ok(html.includes('href="/destination">Roadmap</a>'));
assert.ok(html.includes('Release Now'));
assert.ok(html.includes('Autopilot for your music career.'));
assert.ok(html.includes('class="socials"'));
assert.ok(!html.includes('noindex'));
assert.ok(!/\bSuno\b/.test(html));
assert.ok(!/—/.test(html));
assert.ok(!/\b(Basic|Creator|Pro)\b/.test(html));
assert.ok(!/guaranteed followers|will go viral|hit song/i.test(html));
assert.ok(!html.includes('href="/battle"') && !html.includes('battle.html'));
assert.ok((vercel.rewrites || []).some(function (row) {
  return row.source === '/social' && row.destination === '/social.html';
}));

console.log('social-presence.test.js ok');
