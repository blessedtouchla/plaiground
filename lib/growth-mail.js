'use strict';

/**
 * Lifecycle mail on growth events. Uses the existing Resend mailer.
 * From stays confirm@wannaplai.com (already the verified sender in this repo).
 * Never hello@. Never invent store links, pay, or royalty numbers.
 * Artist notes are HTML with a plain-text fallback. A copy goes to the owner inbox.
 */

const {
  CONTACT_EMAIL,
  DEFAULT_FROM,
  SITE_ORIGIN,
  fromAddress,
  isMailConfigured,
  normalizeEmail,
  postResend: mailPostResend,
} = require('./mail');
const { recordMailFailure } = require('./mail-failures');

const NEW_RELEASE_URL = SITE_ORIGIN + '/upload.html';
const DASHBOARD_URL = SITE_ORIGIN + '/dashboard.html';
const FAQ_URL = SITE_ORIGIN + '/faq.html';
const SIQA_URL = SITE_ORIGIN + '/charts';
const CREATOR_URL = SITE_ORIGIN + '/creator.html';
const PRO_URL = SITE_ORIGIN + '/pro.html';
const PROFILE_URL = SITE_ORIGIN + '/artists.html';
const EPK_URL = SITE_ORIGIN + '/epk';
const DESTINATION_URL = SITE_ORIGIN + '/destination';
const LOGO_URL = SITE_ORIGIN + '/assets/plaiground-logo.png';
const AVATAR_URL = SITE_ORIGIN + '/assets/plai-avatar.png';
const WORDMARK_URL = SITE_ORIGIN + '/assets/plaiground-wordmark-live.png';

const PROGRESS_STEPS = [
  'Submitted',
  'In QC review',
  'Released to stores (on release date)',
  'Live and growing',
];

const WAIT_LEAD = 'While you wait, do this for your song';
const WAIT_ACTIONS = [
  { label: 'Finish your artist profile', href: PROFILE_URL },
  { label: 'Finish your EPK', href: EPK_URL },
  { label: 'Plan your release', href: DESTINATION_URL },
  { label: 'See the charts', href: SIQA_URL },
];

const GO_LINKS = [
  { label: 'Dashboard', href: DASHBOARD_URL },
  { label: 'FAQ', href: FAQ_URL },
  { label: 'SIQA Charts', href: SIQA_URL },
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const QC_NEXT = 'What happens next: we review it in QC. Then it goes out to the stores on the release date. We email you when it is live.';
const LIVE_NEXT = 'What happens next: share the link, open your dashboard, and watch the charts.';

const COPY = {
  signup: {
    subject: 'You’re in. One song is free.',
    body: 'One song. No card. Fully AI, assisted, or human.',
    button: { label: 'Upload', href: NEW_RELEASE_URL },
  },
  first_upload: {
    subject: 'Your FIRST song! Submitted, in QC',
    headline: 'Your FIRST song!',
    kicker: 'Submitted, in QC',
    body: 'Woo-hoo! Your first song has been submitted! We are now going through QC and will email you as soon as it’s Live!',
    celebrate: 'This is the one that starts it.',
    linksLead: WAIT_LEAD,
    links: WAIT_ACTIONS,
    signoff: 'Sincerely,\nPlaiground Team',
    ps: 'PS, any questions or concerns at all don’t hesitate to email us directly at emailplaiground@gmail.com',
  },
  song_submitted: {
    subject: 'Submitted, in QC',
    headline: 'Submitted, in QC',
    kicker: 'PLAIGROUND',
    body: 'Your song has been submitted. We are going through QC and will email you when it is live.',
    celebrate: '',
    signoff: 'Sincerely,\nPlaiground Team',
    ps: 'PS, any questions or concerns at all don’t hesitate to email us directly at emailplaiground@gmail.com',
  },
  first_store_live: {
    subject: 'It’s up.',
    headline: 'It’s up.',
    kicker: 'Live',
    lead: 'Your first song is live.',
    body: 'Here’s the link. Post it, share it, and start your next one.',
    button: { label: 'Add track 2', href: NEW_RELEASE_URL },
    missingLink: 'We’ll add the store link when it’s public.',
    upsell: 'Creator and Pro unlock more than one song. Basic is one song for life.',
  },
  song_live: {
    subject: 'It’s up.',
    headline: 'It’s up.',
    kicker: 'Live',
    lead: 'Your song is live.',
    body: 'Here’s the link. Post it, share it, and start your next one.',
    button: { label: 'Add track 2', href: NEW_RELEASE_URL },
    missingLink: 'We’ll add the store link when it’s public.',
    upsell: 'Creator and Pro unlock more than one song. Basic is one song for life.',
  },
};

const BANNED = /monetize instantly|95\s*%|hello@|suno|[—–]/i;

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

function clipDetail(value, max) {
  return String(value || '')
    .replace(/[\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function formatReleaseDate(value) {
  const raw = clipDetail(value, 40);
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!match) return raw;
  const month = MONTHS[Number(match[2]) - 1];
  const day = Number(match[3]);
  if (!month || day < 1 || day > 31) return raw;
  return month + ' ' + day + ', ' + match[1];
}

function songFacts(payload) {
  const title = clipDetail(payload && payload.title, 180);
  const releaseId = clipDetail(payload && (payload.release_id || payload.releaseId), 80);
  const pretty = formatReleaseDate(payload && (payload.release_date || payload.releaseDate));
  return {
    title: title || 'Your song',
    releaseId: releaseId || 'Not on file yet',
    releaseDate: pretty || 'Not set yet',
  };
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

function progressStates(mode) {
  if (mode === 'live') return ['done', 'done', 'done', 'next'];
  return ['done', 'here', 'next', 'next'];
}

function progressLabel(state) {
  if (state === 'done') return 'Done';
  if (state === 'here') return 'You are here';
  return '';
}

function progressLines(mode) {
  const states = progressStates(mode);
  return PROGRESS_STEPS.map(function (title, index) {
    const label = progressLabel(states[index]);
    return (index + 1) + '. ' + title + (label ? '. ' + label + '.' : '.');
  });
}

function progressText(mode) {
  return ['Where your song is'].concat(progressLines(mode));
}

function progressHtml(mode) {
  const states = progressStates(mode);
  const rows = PROGRESS_STEPS.map(function (title, index) {
    const state = states[index];
    const label = progressLabel(state);
    const mark = state === 'done' ? '&#10003;' : (state === 'here' ? '&#9679;' : '&#9675;');
    const color = state === 'here' ? '#F3CB47' : (state === 'done' ? '#3FE07A' : '#9A9AA8');
    return '<tr>'
      + '<td style="padding:6px 10px 6px 0;font-weight:700;color:' + color + ';width:28px;">' + mark + '</td>'
      + '<td style="padding:6px 0;color:#ffffff;"><strong>' + escapeHtml(title) + '</strong>'
      + (label ? '. ' + escapeHtml(label) + '.' : '')
      + '</td></tr>';
  }).join('');
  return '<p style="margin:18px 0 8px;color:#F3CB47;font-weight:700;">Where your song is</p>'
    + '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse">'
    + rows + '</table>';
}

function waitLines() {
  return [WAIT_LEAD].concat(WAIT_ACTIONS.map(function (item) {
    return item.label + ' → ' + item.href;
  }));
}

function waitHtml() {
  const links = WAIT_ACTIONS.map(function (item) {
    return '<a href="' + escapeHtml(item.href) + '" style="color:#ffffff;">' + escapeHtml(item.label) + '</a>';
  }).join('<br>');
  return '<p style="margin:18px 0 0;"><strong style="color:#F3CB47;">' + escapeHtml(WAIT_LEAD) + '</strong><br>' + links + '</p>';
}

function goLines() {
  return GO_LINKS.map(function (item) {
    return item.label + ' → ' + item.href;
  });
}

function goHtml() {
  return '<p style="margin:18px 0 0;">' + GO_LINKS.map(function (item) {
    return '<a href="' + escapeHtml(item.href) + '" style="display:inline-block;background:#7D3CFF;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;line-height:1.2;padding:12px 16px;border-radius:999px;margin:6px 6px 0 0;">' + escapeHtml(item.label) + '</a>';
  }).join('') + '</p>';
}

function buttonHtml(button) {
  if (!button || !button.href || !button.label) return '';
  return '<p style="margin:18px 0 0;"><a href="' + escapeHtml(button.href) + '" style="display:inline-block;background:#F3CB47;color:#000000;text-decoration:none;font-weight:700;font-size:15px;line-height:1.2;padding:12px 16px;border-radius:999px;">' + escapeHtml(button.label) + '</a></p>';
}

function buttonText(button) {
  if (!button || !button.href || !button.label) return [];
  return [button.label + ' → ' + button.href];
}

function factLines(facts) {
  return [
    'Song: ' + facts.title,
    'Release ID: ' + facts.releaseId,
    'Release date: ' + facts.releaseDate,
  ];
}

function factsHtml(facts) {
  function row(label, value) {
    return '<tr>'
      + '<td style="padding:8px 12px 8px 0;color:#F3CB47;font-weight:700;vertical-align:top;width:110px;">' + escapeHtml(label) + '</td>'
      + '<td style="padding:8px 0;color:#ffffff;">' + escapeHtml(value) + '</td>'
      + '</tr>';
  }
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background:#16161C;border-radius:12px;">'
    + row('Song', facts.title)
    + row('Release ID', facts.releaseId)
    + row('Release date', facts.releaseDate)
    + '</table>';
}

function brandDocument(preheader, inner) {
  return [
    '<!DOCTYPE html><html><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<title>PLAIGROUND</title></head>',
    '<body style="margin:0;padding:0;background:#000000;">',
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#000000;">' + escapeHtml(preheader) + '</div>',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#000000;">',
    '<tr><td align="center" style="padding:20px 12px;">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#111111;border-radius:18px;">',
    '<tr><td align="center" style="padding:28px 20px 4px;">',
    '<img src="' + LOGO_URL + '" width="72" alt="PLAIGROUND" style="display:block;margin:0 auto 12px;border:0;width:72px;height:auto;">',
    '<img src="' + AVATAR_URL + '" width="96" alt="Plai" style="display:block;margin:0 auto 12px;border:0;width:96px;height:auto;border-radius:48px;">',
    '<img src="' + WORDMARK_URL + '" width="220" alt="PLAIGROUND" style="display:block;margin:0 auto;border:0;width:220px;max-width:80%;height:auto;">',
    '</td></tr>',
    '<tr><td style="padding:12px 22px 32px;font-family:Arial,Helvetica,sans-serif;color:#ffffff;font-size:16px;line-height:1.5;">',
    inner,
    '</td></tr></table></td></tr></table></body></html>',
  ].join('');
}

function headlineHtml(copy) {
  return '<p style="margin:8px 0 4px;color:#F3CB47;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">' + escapeHtml(copy.kicker) + '</p>'
    + '<h1 style="margin:0 0 12px;font-size:28px;line-height:1.2;color:#ffffff;">' + escapeHtml(copy.headline) + '</h1>';
}

function nextHtml(line) {
  return '<p style="margin:0;padding:12px 14px;background:#16161C;border-radius:12px;">' + escapeHtml(line) + '</p>';
}

function signoffHtml(copy) {
  return '<p style="margin:18px 0 0;">Sincerely,<br>Plaiground Team</p>'
    + '<p style="margin:12px 0 0;">PS, any questions or concerns at all don’t hesitate to email us directly at <a href="mailto:emailplaiground@gmail.com" style="color:#F3CB47;">emailplaiground@gmail.com</a></p>';
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

function buildSubmission(copy, payload) {
  const facts = songFacts(payload);
  const text = [copy.headline, copy.body]
    .concat(copy.celebrate ? [copy.celebrate] : [])
    .concat([''])
    .concat(factLines(facts))
    .concat(['', QC_NEXT, ''])
    .concat(progressText('qc'))
    .concat([''])
    .concat(waitLines())
    .concat([''])
    .concat(goLines())
    .concat(['', copy.signoff, '', copy.ps])
    .join('\n');
  const html = brandDocument(copy.headline + ' ' + copy.body, [
    headlineHtml(copy),
    '<p style="margin:0 0 8px;">' + escapeHtml(copy.body) + '</p>',
    copy.celebrate ? '<p style="margin:0 0 8px;color:#F3CB47;font-weight:700;">' + escapeHtml(copy.celebrate) + '</p>' : '',
    factsHtml(facts),
    nextHtml(QC_NEXT),
    progressHtml('qc'),
    waitHtml(),
    goHtml(),
    signoffHtml(copy),
  ].join(''));
  return { subject: copy.subject, text: text, html: html };
}

function buildFirstUpload(payload) {
  return buildSubmission(COPY.first_upload, payload);
}

function buildSongSubmitted(payload) {
  return buildSubmission(COPY.song_submitted, payload);
}

function buildStoreLive(copy, user, payload) {
  const facts = songFacts(payload);
  const links = cleanLinks(payload && payload.links);
  const lines = [copy.lead, copy.body, ''].concat(factLines(facts)).concat(['', LIVE_NEXT, '']);
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
  const text = lines.concat(['']).concat(progressText('live')).concat(['']).concat(buttonText(copy.button)).concat(['']).concat(goLines()).concat(['', 'PLAIGROUND']).join('\n');
  const htmlParts = [
    headlineHtml(copy),
    '<p style="margin:0 0 8px;color:#F3CB47;font-weight:700;">' + escapeHtml(copy.lead) + '</p>',
    '<p style="margin:0 0 8px;">' + escapeHtml(copy.body) + '</p>',
    factsHtml(facts),
    nextHtml(LIVE_NEXT),
  ];
  if (links.length) {
    links.forEach((item) => {
      htmlParts.push(
        '<p style="margin:12px 0 0;">' + escapeHtml(item.name) + ': <a href="' + escapeHtml(item.open) + '" style="color:#ffffff;">' + escapeHtml(item.open) + '</a></p>'
      );
    });
  } else {
    htmlParts.push('<p style="margin:12px 0 0;">' + escapeHtml(copy.missingLink) + '</p>');
  }
  if (upsell) {
    htmlParts.push('<p style="margin:12px 0 0;">' + escapeHtml(copy.upsell) + '</p>');
    htmlParts.push(
      '<p style="margin:8px 0 0;"><a href="' + escapeHtml(CREATOR_URL) + '" style="color:#F3CB47;">Creator</a> · <a href="' + escapeHtml(PRO_URL) + '" style="color:#F3CB47;">Pro</a></p>'
    );
  }
  htmlParts.push(progressHtml('live'));
  htmlParts.push(buttonHtml(copy.button));
  htmlParts.push(goHtml());
  return {
    subject: copy.subject,
    text: text,
    html: brandDocument(copy.lead + ' ' + copy.body, htmlParts.join('')),
  };
}

function buildLifecycle(eventName, user, payload) {
  const name = String(eventName || '').trim().toLowerCase();
  if (name === 'signup') return buildSignup();
  if (name === 'first_upload') return buildFirstUpload(payload);
  if (name === 'song_submitted') return buildSongSubmitted(payload);
  if (name === 'first_store_live') return buildStoreLive(COPY.first_store_live, user, payload);
  if (name === 'song_live') return buildStoreLive(COPY.song_live, user, payload);
  return null;
}

const TEST_NOTE = 'TEST email. This went only to the owner inbox. It was not sent to an artist.';
const TEST_EVENTS = [
  { name: 'first_upload', label: 'First song submitted' },
  { name: 'song_submitted', label: 'Later submitted' },
  { name: 'first_store_live', label: 'First live' },
  { name: 'song_live', label: 'Later live' },
];

function testPayload() {
  return {
    title: 'TEST song. Not a real release.',
    release_id: 'test-not-a-release',
    release_date: '2026-01-01',
    links: [{ name: 'Test page', open: DASHBOARD_URL }],
  };
}

function stampTest(mail) {
  const html = String(mail.html || '').replace(
    '<h1 ',
    '<p style="margin:0 0 12px;color:#F3CB47;font-weight:700;">' + escapeHtml(TEST_NOTE) + '</p><h1 '
  );
  return {
    subject: '[TEST] ' + mail.subject,
    text: TEST_NOTE + '\n\n' + mail.text,
    html: html,
  };
}

async function sendOneTest(eventName, label) {
  const user = { email: CONTACT_EMAIL, plan: 'basic', artist_name: 'TEST' };
  const payload = testPayload();
  const built = buildLifecycle(eventName, user, payload);
  if (!built) {
    const error = 'Could not build the test email.';
    await noteFailure(eventName, user, payload, null, error);
    return { event: eventName, label: label, mail_sent: false, subject: '', error: error };
  }
  const mail = stampTest(built);
  const blob = mail.subject + mail.text + mail.html;
  if (BANNED.test(blob)) {
    const error = 'Lifecycle copy failed the lock.';
    await noteFailure(eventName, user, payload, mail, error);
    return { event: eventName, label: label, mail_sent: false, subject: mail.subject, error: error };
  }
  if (!isMailConfigured()) {
    const error = 'Mail is not configured.';
    await noteFailure(eventName, user, payload, mail, error);
    return { event: eventName, label: label, mail_sent: false, subject: mail.subject, error: error };
  }
  const sent = await postResend({
    from: lifecycleFrom(),
    to: [CONTACT_EMAIL],
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  });
  if (!sent.mail_sent) {
    const error = sent.error || 'Could not send the lifecycle email.';
    await noteFailure(eventName, user, payload, mail, error);
    return { event: eventName, label: label, mail_sent: false, subject: mail.subject, error: error };
  }
  return { event: eventName, label: label, mail_sent: true, subject: mail.subject, error: '' };
}

async function sendOwnerTestEmails() {
  const emails = [];
  for (let i = 0; i < TEST_EVENTS.length; i += 1) {
    emails.push(await sendOneTest(TEST_EVENTS[i].name, TEST_EVENTS[i].label));
  }
  return { emails: emails };
}

function artistBcc(email) {
  if (!email || email === CONTACT_EMAIL) return [];
  return [CONTACT_EMAIL];
}

async function postResend(payload) {
  if (typeof mailPostResend === 'function') {
    return mailPostResend(payload, 'Could not send the lifecycle email.');
  }
  return { mail_sent: false, error: 'Mail is not configured.' };
}

async function noteFailure(eventName, user, payload, mail, error) {
  try {
    await recordMailFailure({
      kind: 'artist',
      event_name: eventName,
      to_email: (user && user.email) || '',
      subject: mail && mail.subject,
      error: error,
      release_id: payload && (payload.release_id || payload.releaseId),
    });
  } catch (err) {
    /* a failure list must not block the send result */
  }
}

async function sendLifecycleEmail(eventName, user, payload) {
  try {
    const mail = buildLifecycle(eventName, user, payload);
    if (!mail) return { mail_sent: false, skipped: true };
    const blob = mail.subject + mail.text + mail.html;
    if (BANNED.test(blob)) {
      const error = 'Lifecycle copy failed the lock.';
      await noteFailure(eventName, user, payload, mail, error);
      return { mail_sent: false, error: error };
    }
    const email = normalizeEmail(user && user.email);
    if (!email) {
      const error = 'A valid email is required.';
      await noteFailure(eventName, user, payload, mail, error);
      return { mail_sent: false, error: error };
    }
    if (!isMailConfigured()) {
      const error = 'Mail is not configured.';
      await noteFailure(eventName, user, payload, mail, error);
      return { mail_sent: false, error: error };
    }
    const from = lifecycleFrom();
    const bcc = artistBcc(email);
    const body = {
      from: from,
      to: [email],
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    };
    if (bcc.length) body.bcc = bcc;
    const sent = await postResend(body);
    if (!sent.mail_sent) {
      const error = sent.error || 'Could not send the lifecycle email.';
      await noteFailure(eventName, user, payload, mail, error);
      return { mail_sent: false, error: error };
    }
    return { mail_sent: true, email: email, from: from, subject: mail.subject };
  } catch (err) {
    const error = 'Could not send the lifecycle email.';
    await noteFailure(eventName, user, payload, null, error);
    return { mail_sent: false, error: error };
  }
}

module.exports = {
  COPY,
  CREATOR_URL,
  DASHBOARD_URL,
  DESTINATION_URL,
  EPK_URL,
  FAQ_URL,
  NEW_RELEASE_URL,
  PROFILE_URL,
  PRO_URL,
  SIQA_URL,
  buildLifecycle,
  lifecycleFrom,
  sendLifecycleEmail,
  sendOwnerTestEmails,
  showLiveUpsell,
};
