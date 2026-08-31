'use strict';

/**
 * Meta pixel id from META_PIXEL_ID only. Empty unless the env is a real id.
 * Do not hardcode. Do not invent. Do not ship Upload or Purchase events.
 */

function pixelId(env) {
  const raw = String(((env || process.env).META_PIXEL_ID) || '').trim();
  if (!/^\d{5,20}$/.test(raw)) return '';
  return raw;
}

const PUBLIC_PAGES = {
  '': true,
  'index.html': true,
  'about.html': true,
  'how.html': true,
  'how-it-works.html': true,
  'faq.html': true,
  'contact.html': true,
  'basic.html': true,
  'creator.html': true,
  'pro.html': true,
  'signup.html': true,
  'login.html': true,
  'forgot.html': true,
  'magic.html': true,
  'confirm.html': true,
  'confirmed.html': true,
  'terms.html': true,
  'privacy.html': true,
  'rights.html': true,
  'boost.html': true,
  'cowriter.html': true,
  'publishing.html': true,
  'publishing-confirm.html': true,
};

function isPublicPage(pathname) {
  const file = String(pathname || '').split('/').pop() || 'index.html';
  const name = !file || file === '/' ? 'index.html' : file.toLowerCase();
  return Boolean(PUBLIC_PAGES[name]);
}

module.exports = {
  PUBLIC_PAGES,
  isPublicPage,
  pixelId,
};
