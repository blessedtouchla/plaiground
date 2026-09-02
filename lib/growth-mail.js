'use strict';

/**
 * Lifecycle mail A/B/C on growth events. Uses the existing Resend mailer.
 * From stays confirm@wannaplai.com (already the verified sender in this repo).
 * Never hello@. Never invent store links, pay, or royalty numbers.
 */

const {
  DEFAULT_FROM,
  SITE_ORIGIN,
  fromAddress,
  isMailConfigured,
  normalizeEmail,
  postResend: mailPostResend,
} = require('./mail');

const NEW_RELEASE_URL = SITE_ORIGIN + '/upload.html';
const CREATOR_URL = SITE_ORIGIN + '/creator.html';
const PRO_URL = SITE_ORIGIN + '/pro.html';

const COPY = {
  signup: {
    subject: 'You’re in. One song is free.',
    body: 'One song. No card. Fully AI, assisted, or human.',
    button: { label: 'Upload', href: NEW_RELEASE_URL },
  },
  first_upload: {
    subject: 'Woo-hoo! Your song has been submitted!',
    body: 'Woo-hoo! Your song has been submitted! We are now going through QC and will email you as soon as it’s Live!',
    signoff: 'Sincerely,\nPlaiground Team',
    ps: 'PS, any questions or concerns at all don’t hesitate to email us directly at emailplaiground@gmail.com',
  },
  first_store_live: {
    subject: 'It’s up.',
    body: 'Here’s the link. Post it. Track 2 is how you keep 0% on more than one song.',
    button: { label: 'Add track 2', href: NEW_RELEASE_URL },
    missingLink: 'We’ll add the store link when it’s public.',
    upsell: 'Creator and Pro unlock more than one song. Basic is one song for life.',
  },
};

const BANNED = /monetize instantly|95\s*%|hello@/i;

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function lifecycleFrom() {
  const raw = fromAddress();
  if (/hello@/i.test(raw) || /gmail\.com/i.test(raw)) return DEFAULT_FROM;
  return raw;
}

function cleanLinks(input) {
  const rows = Array.isArray(input) ? input : [];
  const out = [];
  const seen = {};
  rows.forEach((item) => {
    const open = String((item && item.open) || '').trim();
    const name = String((item && item.name) || '').trim();
    if (!/^https:\/\//i.test(open)) return;
    if (seen[open]) return;
    seen[open] = true;
    out.push({ name: name || 'Store', open: open });
  });
  return out;
}

function showLiveUpsell(user) {
  const auth = require('./auth');
  if (auth.normalizePaidPlan(user && user.plan, user && user.email)) return false;
  const plan = String((user && user.plan) || 'basic').trim().toLowerCase();
  return plan !== 'creator' && plan !== 'pro';
}

function buttonHtml(button) {
  if (!button || !button.href || !button.label) return '';
  return '<p><a href="' + escapeHtml(button.href) + '">' + escapeHtml(button.label) + '</a></p>';
}

function buttonText(button) {
  if (!button || !button.href || !button.label) return [];
  return [button.label + ' → ' + button.href];
}

function buildSignup() {
  const copy = COPY.signup;
  const text = [copy.body, ''].concat(buttonText(copy.button)).concat(['', 'PLAIGROUND']).join('\n');
  const html = [
    '<p>' + escapeHtml(copy.body) + '</p>',
    buttonHtml(copy.button),
  ].join('');
  return { subject: copy.subject, text: text, html: html };
}

function buildFirstUpload() {
  const copy = COPY.first_upload;
  const text = [copy.body, '', copy.signoff, '', copy.ps].join('\n');
  const html = [
    '<p>' + escapeHtml(copy.body) + '</p>',
    '<p>Sincerely,<br>Plaiground Team</p>',
    '<p>PS, any questions or concerns at all don’t hesitate to email us directly at <a href="mailto:emailplaiground@gmail.com">emailplaiground@gmail.com</a></p>',
  ].join('');
  return { subject: copy.subject, text: text, html: html };
}

function buildFirstStoreLive(user, payload) {
  const copy = COPY.first_store_live;
  const links = cleanLinks(payload && payload.links);
  const lines = [copy.body];
  if (links.length) {
    links.forEach((item) => {
      lines.push(item.name + ': ' + item.open);
    });
  } else {
    lines.push(copy.missingLink);
  }
  const upsell = showLiveUpsell(user);
  if (upsell) {
    lines.push(copy.upsell);
    lines.push('Creator: ' + CREATOR_URL);
    lines.push('Pro: ' + PRO_URL);
  }
  const text = lines.concat(['']).concat(buttonText(copy.button)).concat(['', 'PLAIGROUND']).join('\n');
  const htmlParts = ['<p>' + escapeHtml(copy.body) + '</p>'];
  if (links.length) {
    links.forEach((item) => {
      htmlParts.push(
        '<p>' + escapeHtml(item.name) + ': <a href="' + escapeHtml(item.open) + '">' + escapeHtml(item.open) + '</a></p>'
      );
    });
  } else {
    htmlParts.push('<p>' + escapeHtml(copy.missingLink) + '</p>');
  }
  if (upsell) {
    htmlParts.push('<p>' + escapeHtml(copy.upsell) + '</p>');
    htmlParts.push(
      '<p><a href="' + escapeHtml(CREATOR_URL) + '">Creator</a> · <a href="' + escapeHtml(PRO_URL) + '">Pro</a></p>'
    );
  }
  htmlParts.push(buttonHtml(copy.button));
  return { subject: copy.subject, text: text, html: htmlParts.join('') };
}

function buildLifecycle(eventName, user, payload) {
  const name = String(eventName || '').trim().toLowerCase();
  if (name === 'signup') return buildSignup();
  if (name === 'first_upload') return buildFirstUpload();
  if (name === 'first_store_live') return buildFirstStoreLive(user, payload);
  return null;
}

async function postResend(payload) {
  if (typeof mailPostResend === 'function') {
    return mailPostResend(payload, 'Could not send the lifecycle email.');
  }
  return { mail_sent: false, error: 'Mail is not configured.' };
}

async function sendLifecycleEmail(eventName, user, payload) {
  const mail = buildLifecycle(eventName, user, payload);
  if (!mail) return { mail_sent: false, skipped: true };
  if (BANNED.test(mail.subject + mail.text + mail.html)) {
    return { mail_sent: false, error: 'Lifecycle copy failed the lock.' };
  }
  const email = normalizeEmail(user && user.email);
  if (!email) return { mail_sent: false, error: 'A valid email is required.' };
  if (!isMailConfigured()) {
    return { mail_sent: false, error: 'Mail is not configured.' };
  }
  const from = lifecycleFrom();
  const sent = await postResend({
    from: from,
    to: [email],
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });
  if (!sent.mail_sent) return sent;
  return { mail_sent: true, email: email, from: from, subject: mail.subject };
}

module.exports = {
  COPY,
  CREATOR_URL,
  NEW_RELEASE_URL,
  PRO_URL,
  buildLifecycle,
  lifecycleFrom,
  sendLifecycleEmail,
  showLiveUpsell,
};
