'use strict';

/**
 * Signup email domain policy. No network calls.
 *
 * Rejects:
 *   - reserved and special-use domains (RFC 2606 / 6761)
 *   - hostnames on the bundled disposable-email-domains snapshot
 *   - domains whose TLD is not in the bundled IANA snapshot, or that are
 *     not a hostname (empty label, bad punycode, trailing hyphen)
 *
 * Mainstream providers are allowed even if a future list snapshot names them.
 * The public signup error stays generic; callers log the specific reason.
 */

const fs = require('fs');
const path = require('path');
const { domainToASCII } = require('url');

const DATA_DIR = path.join(__dirname, 'data');

// Exact domains only. Subdomains of these are not treated as the provider.
const MAINSTREAM_DOMAINS = [
  'gmail.com', 'googlemail.com',
  'outlook.com', 'hotmail.com', 'live.com', 'msn.com',
  'outlook.co.uk', 'hotmail.co.uk', 'live.co.uk',
  'icloud.com', 'me.com', 'mac.com',
  'yahoo.com', 'ymail.com', 'rocketmail.com',
  'yahoo.co.uk', 'yahoo.ca', 'yahoo.com.au', 'yahoo.fr', 'yahoo.de', 'yahoo.co.jp',
  'yahoo.it', 'yahoo.es', 'yahoo.com.br', 'yahoo.com.mx', 'yahoo.co.in',
  'proton.me', 'protonmail.com', 'protonmail.ch', 'pm.me',
  'aol.com', 'aim.com',
  'hey.com', 'fastmail.com', 'fastmail.fm',
  'zoho.com', 'gmx.com', 'gmx.net', 'gmx.de', 'mail.com',
  'tutanota.com', 'tuta.com', 'tuta.io', 'mailbox.org',
  'qq.com', '163.com', '126.com', 'yeah.net',
  'naver.com', 'daum.net', 'hanmail.net',
  'yandex.com', 'yandex.ru', 'mail.ru',
  'duck.com',
  'comcast.net', 'verizon.net', 'att.net', 'sbcglobal.net', 'cox.net',
];

const RESERVED_TLDS = ['example', 'invalid', 'test', 'localhost', 'local'];
const RESERVED_DOMAINS = ['example.com', 'example.net', 'example.org'];

function loadNameSet(fileName) {
  const text = fs.readFileSync(path.join(DATA_DIR, fileName), 'utf8');
  const out = new Set();
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const value = lines[i].trim().toLowerCase();
    if (!value || value.charAt(0) === '#') continue;
    out.add(value);
  }
  return out;
}

const MAINSTREAM = new Set(MAINSTREAM_DOMAINS);
const DISPOSABLE = loadNameSet('disposable-email-domains.txt');
const TLDS = loadNameSet('iana-tlds.txt');

MAINSTREAM_DOMAINS.forEach((domain) => {
  DISPOSABLE.delete(domain);
});

function domainOf(email) {
  const value = String(email || '').replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '').trim().toLowerCase();
  const at = value.lastIndexOf('@');
  if (at <= 0 || at === value.length - 1) return '';
  let domain = value.slice(at + 1).replace(/\.+$/, '');
  if (!domain || domain.indexOf(' ') !== -1) return '';
  let ascii = '';
  try {
    ascii = domainToASCII(domain);
  } catch {
    return '';
  }
  ascii = String(ascii || '').replace(/\.+$/, '').toLowerCase();
  return ascii;
}

function labelsOf(domain) {
  return String(domain || '').split('.');
}

function badHostname(domain) {
  if (!domain || domain.length > 253 || domain.indexOf('..') !== -1) return true;
  const labels = labelsOf(domain);
  if (labels.length < 2) return true;
  for (let i = 0; i < labels.length; i += 1) {
    const label = labels[i];
    if (!label || label.length > 63) return true;
    if (label.indexOf('xn--') === 0) {
      if (!/^xn--[a-z0-9-]{1,59}$/.test(label)) return true;
      continue;
    }
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) return true;
  }
  return false;
}

function isReserved(domain) {
  const labels = labelsOf(domain);
  const tld = labels[labels.length - 1];
  if (RESERVED_TLDS.indexOf(tld) !== -1) return true;
  for (let i = 0; i < RESERVED_DOMAINS.length; i += 1) {
    const exact = RESERVED_DOMAINS[i];
    if (domain === exact || domain.endsWith('.' + exact)) return true;
  }
  return false;
}

function isDisposable(domain) {
  const labels = labelsOf(domain);
  // Walk up, but never match a single label (that would be a TLD).
  for (let i = 0; i <= labels.length - 2; i += 1) {
    if (DISPOSABLE.has(labels.slice(i).join('.'))) return true;
  }
  return false;
}

/**
 * '' when the address may be used.
 * Otherwise reserved_domain, disposable_domain, or bad_domain.
 */
function emailRejectReason(email) {
  const domain = domainOf(email);
  if (!domain) return 'bad_domain';
  if (MAINSTREAM.has(domain)) return '';
  if (isReserved(domain)) return 'reserved_domain';
  if (badHostname(domain)) return 'bad_domain';
  const tld = labelsOf(domain).pop();
  if (!TLDS.has(tld)) return 'bad_domain';
  if (isDisposable(domain)) return 'disposable_domain';
  return '';
}

module.exports = {
  MAINSTREAM_DOMAINS,
  domainOf,
  emailRejectReason,
};
