'use strict';

/**
 * Minimal client-side PDF for earnings / release statements.
 * Prints only the numbers and names passed in. Does not invent streams or dollars.
 */

function toText(value) {
  return String(value == null ? '' : value);
}

function pdfEscape(text) {
  var next = '';
  var raw = toText(text);
  var i;
  for (i = 0; i < raw.length; i += 1) {
    var ch = raw.charAt(i);
    var code = raw.charCodeAt(i);
    if (ch === '\\' || ch === '(' || ch === ')') next += '\\' + ch;
    else if (code === 10 || code === 13 || code === 9) next += ' ';
    else if (code < 32 || code > 255) next += '?';
    else next += ch;
  }
  return next;
}

function padRight(text, width) {
  var next = toText(text);
  while (next.length < width) next += ' ';
  return next.slice(0, width);
}

function wrapLine(text, width) {
  var raw = toText(text);
  var max = width || 86;
  if (raw.length <= max) return [raw];
  var out = [];
  var i = 0;
  while (i < raw.length) {
    out.push(raw.slice(i, i + max));
    i += max;
  }
  return out;
}

function fieldLines(fields) {
  var lines = [];
  (fields || []).forEach(function (row) {
    var label = toText(row && row.label);
    var value = toText(row && row.value);
    if (!label && !value) return;
    wrapLine((label ? label + ': ' : '') + value, 86).forEach(function (line) {
      lines.push(line);
    });
  });
  return lines;
}

function tableLines(columns, rows) {
  var lines = [];
  var cols = columns || [];
  if (!cols.length) return lines;
  var widths = cols.map(function (name, index) {
    var width = Math.max(toText(name).length, index === 0 ? 22 : 14);
    (rows || []).forEach(function (row) {
      width = Math.max(width, toText(row && row[index]).length);
    });
    return Math.min(width, index === 0 ? 36 : 18);
  });
  lines.push(cols.map(function (name, index) {
    return padRight(name, widths[index]);
  }).join('  '));
  (rows || []).forEach(function (row) {
    lines.push(cols.map(function (_, index) {
      return padRight(toText(row && row[index]), widths[index]);
    }).join('  '));
  });
  return lines;
}

function contentStream(lines) {
  var y = 720;
  var parts = ['BT', '/F2 18 Tf', '72 ' + y + ' Td'];
  var i;
  for (i = 0; i < lines.length; i += 1) {
    var line = lines[i];
    var font = line.bold ? 'F2' : 'F1';
    var size = line.size || 11;
    var text = pdfEscape(line.text);
    if (i === 0) {
      parts.push('/' + font + ' ' + size + ' Tf');
      parts.push('(' + text + ') Tj');
    } else {
      parts.push('0 -' + (line.gap || 18) + ' Td');
      parts.push('/' + font + ' ' + size + ' Tf');
      parts.push('(' + text + ') Tj');
    }
  }
  parts.push('ET');
  return parts.join('\n');
}

function objectBody(index, body) {
  return index + ' 0 obj\n' + body + '\nendobj\n';
}

function buildPdf(spec) {
  spec = spec || {};
  var lines = [];
  lines.push({ text: spec.title || 'PLAIGROUND', size: 18, bold: true, gap: 22 });
  if (spec.subtitle) lines.push({ text: spec.subtitle, size: 12, bold: true, gap: 20 });
  if (spec.generated) lines.push({ text: 'Generated: ' + spec.generated, size: 10, gap: 16 });
  fieldLines(spec.fields).forEach(function (text) {
    lines.push({ text: text, size: 11, gap: 16 });
  });
  var table = tableLines(spec.columns, spec.rows);
  if (table.length) {
    lines.push({ text: spec.tableTitle || 'Breakdown', size: 12, bold: true, gap: 22 });
    table.forEach(function (text) {
      lines.push({ text: text, size: 10, gap: 14 });
    });
  }
  var stream = contentStream(lines);
  var objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>',
    '<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
  ];
  var out = '%PDF-1.4\n';
  var offsets = [0];
  var i;
  for (i = 0; i < objects.length; i += 1) {
    offsets.push(out.length);
    out += objectBody(i + 1, objects[i]);
  }
  var xref = out.length;
  out += 'xref\n0 ' + (objects.length + 1) + '\n';
  out += '0000000000 65535 f \n';
  for (i = 1; i < offsets.length; i += 1) {
    var off = String(offsets[i]);
    while (off.length < 10) off = '0' + off;
    out += off + ' 00000 n \n';
  }
  out += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\n';
  out += 'startxref\n' + xref + '\n%%EOF\n';
  return out;
}

function toUint8(bytes) {
  if (bytes && bytes.buffer && typeof bytes.length === 'number' && bytes.constructor && bytes.constructor.name === 'Uint8Array') {
    return bytes;
  }
  var raw = toText(bytes);
  var out = new Uint8Array(raw.length);
  var i;
  for (i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i) & 0xff;
  return out;
}

function toBase64(bytes) {
  var raw = toText(bytes);
  if (typeof btoa === 'function') {
    try { return btoa(raw); } catch (err) {}
  }
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  var out = '';
  var i;
  for (i = 0; i < raw.length; i += 3) {
    var a = raw.charCodeAt(i) & 0xff;
    var b = i + 1 < raw.length ? raw.charCodeAt(i + 1) & 0xff : 0;
    var c = i + 2 < raw.length ? raw.charCodeAt(i + 2) & 0xff : 0;
    out += chars.charAt(a >> 2);
    out += chars.charAt(((a & 3) << 4) | (b >> 4));
    out += i + 1 < raw.length ? chars.charAt(((b & 15) << 2) | (c >> 6)) : '=';
    out += i + 2 < raw.length ? chars.charAt(c & 63) : '=';
  }
  return out;
}

var lastDownload = null;

function downloadPdf(filename, bytes) {
  var name = toText(filename) || 'plaiground-statement.pdf';
  var raw = toText(bytes);
  lastDownload = { filename: name, bytes: raw };
  var global = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : {});
  var doc = typeof document !== 'undefined' ? document : null;
  var blob = null;
  var url = '';
  try {
    if (typeof Blob === 'function') blob = new Blob([toUint8(raw)], { type: 'application/pdf' });
  } catch (err) {}
  try {
    if (blob && global.URL && typeof global.URL.createObjectURL === 'function') url = global.URL.createObjectURL(blob);
  } catch (err) {}
  if (!doc || typeof doc.createElement !== 'function') return lastDownload;
  var link = doc.createElement('a');
  link.href = url || ('data:application/pdf;base64,' + toBase64(raw));
  link.download = name;
  link.rel = 'noopener';
  if (doc.body && typeof doc.body.appendChild === 'function') {
    doc.body.appendChild(link);
    if (typeof link.click === 'function') link.click();
    if (link.parentNode && typeof link.parentNode.removeChild === 'function') link.parentNode.removeChild(link);
  } else if (typeof link.click === 'function') {
    link.click();
  }
  if (url && global.URL && typeof global.URL.revokeObjectURL === 'function') {
    try { global.URL.revokeObjectURL(url); } catch (err) {}
  }
  return lastDownload;
}

var api = {
  build: buildPdf,
  download: downloadPdf,
  lastDownload: function () { return lastDownload; },
};

if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') window.PlaigroundStatementPdf = api;
