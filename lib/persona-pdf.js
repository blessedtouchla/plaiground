'use strict';

/**
 * One-page press kit PDF. Plain text only. No remote images.
 */

function ascii(value) {
  return String(value == null ? '' : value).replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim();
}

function escapePdf(value) {
  return ascii(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function build(view) {
  const kit = view || {};
  const lines = [];
  lines.push(kit.name || 'Artist');
  lines.push('Press kit');
  if (kit.bios && kit.bios.medium) lines.push(kit.bios.medium);
  else if (kit.bios && kit.bios.short) lines.push(kit.bios.short);
  if (kit.story) lines.push('Story: ' + kit.story);
  if (kit.vibe && kit.vibe.length) lines.push('Vibe: ' + kit.vibe.join(', '));
  if (kit.voice && kit.voice.length) lines.push('Voice: ' + kit.voice.join(', '));
  const city = kit.audience && kit.audience.city;
  if (city) lines.push('From: ' + city);
  (Array.isArray(kit.releases) ? kit.releases : []).slice(0, 8).forEach(function (row) {
    if (row && row.title) lines.push('Release: ' + row.title + (row.upc ? '  UPC ' + row.upc : ''));
  });
  if (kit.booking && (kit.booking.email || kit.booking.name)) {
    lines.push('Booking: ' + [kit.booking.name, kit.booking.email].filter(Boolean).join(', '));
  }
  lines.push(kit.credit || 'Human + AI.');
  const wrapped = [];
  lines.forEach(function (line) {
    const text = ascii(line);
    if (!text) return;
    for (let i = 0; i < text.length && wrapped.length < 42; i += 90) wrapped.push(text.slice(i, i + 90));
  });
  let commands = 'BT /F1 12 Tf 54 760 Td 14 TL\n';
  wrapped.forEach(function (line, index) {
    if (index) commands += 'T*\n';
    commands += '(' + escapePdf(line) + ') Tj\n';
  });
  commands += 'ET';
  const objects = [];
  objects.push('1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n');
  objects.push('2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj\n');
  objects.push('3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n');
  objects.push('4 0 obj << /Length ' + commands.length + ' >> stream\n' + commands + '\nendstream endobj\n');
  objects.push('5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n');
  let body = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach(function (object) {
    offsets.push(body.length);
    body += object;
  });
  const xref = body.length;
  body += 'xref\n0 ' + (objects.length + 1) + '\n';
  body += '0000000000 65535 f \n';
  offsets.slice(1).forEach(function (offset) {
    body += String(offset).padStart(10, '0') + ' 00000 n \n';
  });
  body += 'trailer << /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF';
  return body;
}

module.exports = { build: build };
