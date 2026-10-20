#!/usr/bin/env node
// Build guardrail: stops a deploy if key files are broken. Reads only; writes nothing.
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const errors = [];
const warnings = [];
const MIN_BLOG_BYTES = 500;
const MAX_FUNCTIONS = 12;
const REQUIRED_KEYS = ['redirects', 'rewrites', 'headers'];
// Placeholder posts already on main before this guard existed. Warn only; replace with real posts, then remove from this list.
const KNOWN_PLACEHOLDERS = new Set(['blog-distrokid-ai-numbers.html', 'blog-siqa-ai-music-awards.html']);

// 1. vercel.json
const vjPath = path.join(root, 'vercel.json');
try {
  const vj = JSON.parse(fs.readFileSync(vjPath, 'utf8'));
  for (const k of REQUIRED_KEYS) {
    if (!Array.isArray(vj[k]) || vj[k].length === 0) errors.push(`vercel.json: "${k}" is missing or empty`);
  }
} catch (e) {
  errors.push(`vercel.json is missing or not valid JSON (${e.message})`);
}

// 2. top-level html not empty; blog pages at least MIN_BLOG_BYTES
const top = fs.readdirSync(root);
for (const f of top) {
  if (!f.endsWith('.html')) continue;
  const size = fs.statSync(path.join(root, f)).size;
  const isBlog = f === 'blog.html' || f.startsWith('blog-');
  if (size === 0) errors.push(`${f} is empty (0 bytes)`);
  else if (isBlog && size < MIN_BLOG_BYTES) {
    if (KNOWN_PLACEHOLDERS.has(f)) warnings.push(`${f} is only ${size} bytes (known placeholder)`);
    else errors.push(`${f} is only ${size} bytes (blog pages need ${MIN_BLOG_BYTES}+)`);
  }
}
if (!top.includes('blog.html')) errors.push('blog.html is missing');
const blogDir = path.join(root, 'blog');
if (fs.existsSync(blogDir) && fs.statSync(blogDir).isDirectory()) {
  for (const f of fs.readdirSync(blogDir)) {
    if (!f.endsWith('.html')) continue;
    const size = fs.statSync(path.join(blogDir, f)).size;
    if (size < MIN_BLOG_BYTES) errors.push(`blog/${f} is only ${size} bytes (blog pages need ${MIN_BLOG_BYTES}+)`);
  }
}

// 3. serverless function count (Vercel: files in api/, skipping names/folders starting with _ or .)
function countFns(dir) {
  let n = 0; const list = [];
  if (!fs.existsSync(dir)) return { n, list };
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('_') || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { const r = countFns(p); n += r.n; list.push(...r.list); }
    else if (/\.(js|mjs|cjs|ts)$/.test(e.name) && !e.name.endsWith('.d.ts')) { n++; list.push(path.relative(root, p)); }
  }
  return { n, list };
}
const fns = countFns(path.join(root, 'api'));
if (fns.n > MAX_FUNCTIONS) errors.push(`api/ has ${fns.n} function files (limit ${MAX_FUNCTIONS}): ${fns.list.join(', ')}. Move tests/helpers out of api/.`);

for (const w of warnings) console.warn('guard-build warning: ' + w);
if (errors.length) {
  console.error('guard-build FAILED, deploy stopped:\n - ' + errors.join('\n - '));
  process.exit(1);
}
console.log(`guard-build OK (vercel.json valid, blog pages fine, ${fns.n}/${MAX_FUNCTIONS} functions)`);
