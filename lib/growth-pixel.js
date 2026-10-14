'use strict';

/**
 * Ads pixel ids. A set env var wins. Empty GA4 and Meta env vars use the
 * public wannaplai.com ids. TikTok stays off until TIKTOK_PIXEL_ID is set.
 * Do not send email or account ids.
 */

const GA4_FALLBACK = 'G-3033FJLNC7';
const META_FALLBACK = '1646654180170753';

function pixelId(env) {
  const raw = String(((env || process.env).META_PIXEL_ID) || '').trim();
  if (!raw) return META_FALLBACK;
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
  if (!raw) return GA4_FALLBACK;
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
  GA4_FALLBACK,
  META_FALLBACK,
  PUBLIC_PAGES,
  adsAllowed,
  ga4MeasurementId,
  isPublicPage,
  pixelConsent,
  pixelId,
  tiktokPixelId,
};
