'use strict';

/**
 * Press-kit PDF from data already on the kit.
 * JPEG data URLs already stored on the artist can be drawn.
 * https images are named in text only. This file does not fetch them.
 */

const { Buffer } = require('buffer');

function ascii(value) {
  return String(value == null ? '' : value).replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim();
}

function escapePdf(value) {
  return ascii(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function jpegFromDataUrl(value) {
  const text = String(value || '').replace(/\s/g, '');
  const match = text.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) return null;
  let buf;
  try { buf = Buffer.from(match[1], 'base64'); } catch (err) { return null; }
  if (!buf || buf.length < 32 || buf.length > 1500000) return null;
  if (buf[0] !== 0xFF || buf[1] !== 0xD8) return null;
  let i = 2;
  let width = 0;
  let height = 0;
  while (i < buf.length - 9) {
    if (buf[i] !== 0xFF) break;
    const marker = buf[i + 1];
    if (marker === 0xD8 || marker === 0x01) { i += 2; continue; }
    if (marker === 0xD9) break;
    const size = buf.readUInt16BE(i + 2);
    if (size < 2) break;
    if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
      height = buf.readUInt16BE(i + 5);
      width = buf.readUInt16BE(i + 7);
      break;
    }
    i += 2 + size;
  }
  if (!width || !height || width > 4000 || height > 4000) return null;
  return { buf: buf, width: width, height: height };
}

function wrapLines(text, size, maxLines) {
  const clean = ascii(text);
  const out = [];
  if (!clean) return out;
  let rest = clean;
  const limit = maxLines || 12;
  while (rest && out.length < limit) {
    if (rest.length <= size) {
      out.push(rest);
      break;
    }
    let cut = rest.lastIndexOf(' ', size);
    if (cut < 12) cut = size;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  return out;
}

function paintText(lines, x, y, size, leading, r, g, b) {
  if (!lines.length) return '';
  let body = r + ' ' + g + ' ' + b + ' rg\nBT /F1 ' + size + ' Tf ' + x + ' ' + y + ' Td ' + leading + ' TL\n';
  lines.forEach(function (line, index) {
    if (index) body += 'T*\n';
    body += '(' + escapePdf(line) + ') Tj\n';
  });
  return body + 'ET\n';
}

function build(view) {
  const kit = view || {};
  const photo = jpegFromDataUrl(kit.photo);
  const name = ascii(kit.name || 'Artist').slice(0, 48) || 'Artist';
  const short = wrapLines((kit.bios && kit.bios.short) || '', photo ? 34 : 72, 4);
  const narrative = wrapLines((kit.bios && (kit.bios.long || kit.bios.medium)) || kit.story || '', 82, 12);
  const releases = (Array.isArray(kit.releases) ? kit.releases : []).slice(0, 6);
  const contact = [];
  if (kit.booking && kit.booking.name) contact.push('Booking: ' + ascii(kit.booking.name));
  if (kit.booking && kit.booking.email) contact.push('Email: ' + ascii(kit.booking.email));
  if (kit.booking && kit.booking.url) contact.push('Booking site: ' + ascii(kit.booking.url));
  const socials = kit.socials || {};
  if (socials.website) contact.push('Website: ' + ascii(socials.website));
  if (socials.instagram) contact.push('Instagram: ' + ascii(socials.instagram));
  if (socials.tiktok) contact.push('TikTok: ' + ascii(socials.tiktok));
  if (socials.youtube) contact.push('YouTube: ' + ascii(socials.youtube));
  if (kit.spotify_artist) contact.push('Spotify: ' + ascii(kit.spotify_artist));
  if (kit.apple_artist) contact.push('Apple Music: ' + ascii(kit.apple_artist));

  let cover = '0 0 0 rg\n0 0 612 792 re f\n0.89 0.71 0.34 rg\n48 742 88 3 re f\n';
  cover += paintText(['ELECTRONIC PRESS KIT'], 48, 708, 11, 14, '0.89', '0.71', '0.34');
  cover += paintText([name], 48, 662, 26, 30, '1', '1', '1');
  if (short.length) cover += paintText(short, 48, 620, 12, 16, '0.86', '0.84', '0.78');
  cover += paintText([ascii(kit.credit || 'Human + AI.')], 48, 56, 9, 12, '0.62', '0.6', '0.56');
  if (photo) {
    const maxW = 250;
    const maxH = 520;
    const scale = Math.min(maxW / photo.width, maxH / photo.height);
    const w = Math.round(photo.width * scale);
    const h = Math.round(photo.height * scale);
    const x = 612 - 40 - w;
    const y = Math.round((792 - h) / 2);
    cover += 'q\n' + w + ' 0 0 ' + h + ' ' + x + ' ' + y + ' cm\n/Im0 Do\nQ\n';
  }

  const covers = [];
  releases.forEach(function (row) {
    const img = jpegFromDataUrl(row && row.artwork_url);
    if (img && covers.length < 3) covers.push({ name: 'Im' + (covers.length + 1), img: img });
  });

  let inside = '0.06 0.06 0.07 rg\n0 0 612 792 re f\n';
  let y = 730;
  if (narrative.length) {
    inside += paintText(['BIOGRAPHY'], 48, y, 11, 14, '0.89', '0.71', '0.34');
    y -= 26;
    inside += paintText(narrative, 48, y, 11, 15, '0.93', '0.91', '0.86');
    y -= 15 * narrative.length + 28;
  }
  if (covers.length && y > 380) {
    covers.forEach(function (coverArt, index) {
      const side = 120;
      const scale = Math.min(side / coverArt.img.width, side / coverArt.img.height);
      const w = Math.round(coverArt.img.width * scale);
      const h = Math.round(coverArt.img.height * scale);
      const x = 48 + index * 140;
      inside += 'q\n' + w + ' 0 0 ' + h + ' ' + x + ' ' + (y - h) + ' cm\n/' + coverArt.name + ' Do\nQ\n';
    });
    y -= 136;
  }
  if (releases.length && y > 250) {
    inside += paintText(['MUSIC'], 48, y, 11, 14, '0.89', '0.71', '0.34');
    y -= 28;
    releases.forEach(function (row) {
      if (y < 240) return;
      inside += paintText([ascii(row && row.title) || 'Untitled'], 48, y, 13, 16, '1', '1', '1');
      y -= 18;
      const link = row && row.links && row.links[0];
      if (link && link.url && y > 230) {
        inside += paintText([ascii(link.label || 'Listen') + '  ' + ascii(link.url)], 48, y, 10, 12, '0.89', '0.71', '0.34');
        y -= 20;
      } else {
        y -= 8;
      }
    });
  }
  if (contact.length) {
    inside += '0.89 0.71 0.34 rg\n0 0 612 196 re f\n';
    inside += paintText(['CONTACT'].concat(contact.slice(0, 8)), 48, 156, 12, 16, '0.09', '0.09', '0.09');
  }

  const pages = [{ stream: cover, image: photo ? 'Im0' : '' }];
  if (narrative.length || releases.length || contact.length) pages.push({ stream: inside, image: '' });

  const objects = [];
  function add(body) {
    objects.push(Buffer.isBuffer(body) ? body : Buffer.from(body));
    return objects.length;
  }

  const fontId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const imageIds = {};
  function addImage(name, img) {
    const dict = '<< /Type /XObject /Subtype /Image /Width ' + img.width + ' /Height ' + img.height
      + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + img.buf.length + ' >>\nstream\n';
    imageIds[name] = add(Buffer.concat([Buffer.from(dict), img.buf, Buffer.from('\nendstream')]));
  }
  if (photo) addImage('Im0', photo);
  covers.forEach(function (coverArt) { addImage(coverArt.name, coverArt.img); });
  const contentIds = pages.map(function (page) {
    return add('<< /Length ' + Buffer.byteLength(page.stream) + ' >>\nstream\n' + page.stream + 'endstream');
  });
  const pageIds = pages.map(function (page, index) {
    let resources = '<< /Font << /F1 ' + fontId + ' 0 R >>';
    const names = [];
    if (index === 0 && photo) names.push('Im0');
    if (index === 1) covers.forEach(function (coverArt) { names.push(coverArt.name); });
    if (names.length) {
      resources += ' /XObject << ' + names.map(function (name) {
        return '/' + name + ' ' + imageIds[name] + ' 0 R';
      }).join(' ') + ' >>';
    }
    resources += ' >>';
    return add('<< /Type /Page /Parent PAGES 0 R /MediaBox [0 0 612 792] /Contents ' + contentIds[index] + ' 0 R /Resources ' + resources + ' >>');
  });
  const kids = pageIds.map(function (id) { return id + ' 0 R'; }).join(' ');
  const pagesId = add('<< /Type /Pages /Count ' + pageIds.length + ' /Kids [' + kids + '] >>');
  const catalogId = add('<< /Type /Catalog /Pages ' + pagesId + ' 0 R >>');
  objects[pagesId - 1] = Buffer.from(objects[pagesId - 1].toString('latin1').replace('Parent PAGES 0 R', 'Parent ' + pagesId + ' 0 R'));
  pageIds.forEach(function (id) {
    objects[id - 1] = Buffer.from(objects[id - 1].toString('latin1').replace('/Parent PAGES 0 R', '/Parent ' + pagesId + ' 0 R'));
  });

  let body = Buffer.from('%PDF-1.4\n');
  const offsets = [0];
  objects.forEach(function (object, index) {
    offsets.push(body.length);
    const head = Buffer.from((index + 1) + ' 0 obj\n');
    const tail = Buffer.from('\nendobj\n');
    body = Buffer.concat([body, head, object, tail]);
  });
  const xrefAt = body.length;
  let xref = 'xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n';
  offsets.slice(1).forEach(function (offset) {
    xref += String(offset).padStart(10, '0') + ' 00000 n \n';
  });
  xref += 'trailer << /Size ' + (objects.length + 1) + ' /Root ' + catalogId + ' 0 R >>\nstartxref\n' + xrefAt + '\n%%EOF';
  return Buffer.concat([body, Buffer.from(xref)]);
}

module.exports = { build: build, jpegFromDataUrl: jpegFromDataUrl };
