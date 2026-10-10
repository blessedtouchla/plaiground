'use strict';

/**
 * Ads pixel ids from env only. Empty unless the env is a real id.
 * META_PIXEL_ID, TIKTOK_PIXEL_ID, GA4_MEASUREMENT_ID.
 * Do not hardcode. Do not invent. Do not send email or account ids.
 */

function pixelId(env) {
  const raw = String(((env || process.env).META_PIXEL_ID) || '').trim();
  if (!/^\d{5,20}$/.test(raw)) return '';
  return raw;
}

function tiktokPixelId(env) {
  const raw = String(((env || process.env).TIKTOK_PIXEL_ID) || '').trim();
  if (!/^[A-Za-z0-9]{10,32}$/.test(raw)) return '';
  return raw;
}

function ga4MeasurementId(env) {
  const raw = String(((env || process.env).GA4_MEASUREMENT_ID) || '').trim();
  if (!/^G-[A-Z0-9]{4,20}$/i.test(raw)) return '';
  return raw;
}

function pixelConsent(value) {
  const text = String(value || '').trim().toLowerCase();
  if (text === 'denied' || text === '0' || text === 'no') return 'denied';
  if (text === 'granted' || text === '1' || text === 'yes' || text === 'all') return 'granted';
  return '';
}

function adsAllowed(value) {
  return pixelConsent(value) !== 'denied';
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
  'song-helper.html': true,
  'song-helper': true,
  'cover-art.html': true,
  'cover-art': true,
};

function isPublicPage(pathname) {
  const file = String(pathname || '').split('/').pop() || 'index.html';
  const name = !file || file === '/' ? 'index.html' : file.toLowerCase();
  return Boolean(PUBLIC_PAGES[name]);
}

module.exports = {
  PUBLIC_PAGES,
  adsAllowed,
  ga4MeasurementId,
  isPublicPage,
  pixelConsent,
  pixelId,
  tiktokPixelId,
};
