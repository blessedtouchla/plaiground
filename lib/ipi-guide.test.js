// Tests for the free "Get your IPI" guide (lib/ipi-guide.js, ipi-guide.js, ipi-guide.html).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const G = require('./ipi-guide');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'ipi-guide.html'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'ipi-guide.js'), 'utf8');
const lib = fs.readFileSync(path.join(__dirname, 'ipi-guide.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'ipi-guide.css'), 'utf8');
const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const copy = JSON.stringify(G.STEPS);
const all = [html, ui, lib, css, copy].join('\n');

// 9 screens: Get ready, steps 1 to 7 on bmi.com, then I got my IPI.
assert.strictEqual(G.STEPS.length, 9);
assert.strictEqual(G.STEPS[0].kind, 'ready');
assert.deepStrictEqual(G.STEPS.filter((s) => s.kind === 'bmi').map((s) => s.n), [1, 2, 3, 4, 5, 6, 7]);
assert.strictEqual(G.STEPS[8].kind, 'ipi');
G.STEPS.forEach((s) => {
  assert.ok(s.say && s.tip && s.next && s.pose, 'step ' + s.id + ' has Plai text, a tip and a next label');
  assert.ok(fs.existsSync(path.join(root, 'for-david-fv/img/plai-' + s.pose + '.webp')), 'Plai image exists for ' + s.pose);
  if (s.kind === 'bmi') assert.ok(s.card && s.card.heading && s.addr, 'bmi step ' + s.n + ' has a preview card');
});

// Link-out to BMI opens in a new tab.
assert.strictEqual(G.BMI_JOIN_URL, 'https://www.bmi.com/join');
assert.ok(/a\.target = '_blank'/.test(ui) && /noopener/.test(ui), 'bmi.com/join opens in a new tab with noopener');

// Copy rules.
assert.ok(!/\u2014/.test(all), 'no em dashes');
assert.ok(!/suno|tonegrid|distrokid|tunecore|cdbaby|routenote|amuse/i.test(all), 'no partner or distributor names');
assert.ok(!/\b9\s*(to|-|\u2013)\s*11\s*digit/i.test(all), 'no unverified IPI length hint');
assert.ok(!/guarantee|you will earn|get paid more|maximi[sz]e your/i.test(all), 'no payout overclaims');

// Never collects SSN, DOB, bank details or BMI login. Only one input: the IPI.
assert.strictEqual((ui.match(/createElement\('input'|el\('input'/g) || []).length, 1, 'exactly one input');
assert.ok(!/<input|<form|type\s*=\s*['"]password/i.test(html), 'no form fields in the page markup');
assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon/.test(ui + lib), 'no network calls');
assert.ok(!/membership\.js/.test(html), 'public page, no membership gate');
assert.ok(copy.includes(G.MASKED_SSN) && !/\d{3}-\d{2}-\d{4}/.test(copy), 'SSN only ever shown masked');
assert.ok(!/Victoria|Imtanes|Herman/i.test(all), 'sample data only');

// IPI helpers and localStorage.
function mem() { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, _m: m }; }
assert.strictEqual(G.cleanIpi(' 00 123-456.789 '), '00123456789');
assert.ok(G.isValidIpi('00123456789'));
assert.ok(!G.isValidIpi(''));
assert.ok(!G.isValidIpi('abc123'));
const s = mem();
assert.strictEqual(G.saveIpi(s, 'nope').ok, false);
assert.strictEqual(s.getItem(G.STORAGE_KEY), null, 'invalid IPI is not saved');
const r = G.saveIpi(s, '00 1234 5678', new Date('2026-10-23T12:00:00Z'));
assert.ok(r.ok);
assert.deepStrictEqual(G.load(s), { ipi: '0012345678', ipiSavedAt: '2026-10-23T12:00:00.000Z' });
G.save(s, { step: 4 });
assert.strictEqual(G.load(s).ipi, '0012345678', 'saving progress keeps the IPI');
assert.strictEqual(G.load(s).step, 4);
const broken = { getItem: () => '{bad json', setItem: () => { throw new Error('full'); } };
assert.deepStrictEqual(G.load(broken), {});
assert.ok(G.saveIpi(broken, '123').ok, 'storage errors do not throw');
assert.deepStrictEqual([G.clampStep(-1), G.clampStep('x'), G.clampStep(3), G.clampStep(99)], [0, 0, 3, 8]);

// Routes and entry points.
const rw = vercel.rewrites.filter((x) => x.destination === '/ipi-guide.html').map((x) => x.source).sort();
assert.deepStrictEqual(rw, ['/ipi-guide', '/ipi-guide/', '/publishing/ipi-guide']);
['index.html', 'publishing.html'].forEach((f) => {
  assert.ok(fs.readFileSync(path.join(root, f), 'utf8').includes('href="/ipi-guide">Free IPI guide</a>'), f + ' links to the guide');
});

console.log('ipi-guide tests passed');
