(function (root, factory) {
  var api = factory(root || globalThis);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PlaigroundClaim = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  var LEAD = 'A record of your creative process that helps show your human contributions.';
  var DISCLAIMER = 'This is not a copyright registration or guarantee. General info, not legal advice.';
  var TAG_YOU = 'Written by you';
  var TAG_AI = 'AI-generated';
  var TAG_EDITED = 'Edited by you';
  var LOG_KEY = 'plaiground.songHelper.claimLog';

  function clip(value, max) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max || 280);
  }

  function storage() {
    try {
      return root.sessionStorage || null;
    } catch (err) {
      return null;
    }
  }

  function emptyLog() {
    return { generations: [], edits: [] };
  }

  function readLog() {
    var store = storage();
    if (!store) return emptyLog();
    try {
      var parsed = JSON.parse(store.getItem(LOG_KEY) || 'null');
      if (!parsed || typeof parsed !== 'object') return emptyLog();
      return {
        generations: Array.isArray(parsed.generations) ? parsed.generations : [],
        edits: Array.isArray(parsed.edits) ? parsed.edits : [],
      };
    } catch (err) {
      return emptyLog();
    }
  }

  function writeLog(log) {
    var store = storage();
    if (!store) return;
    try { store.setItem(LOG_KEY, JSON.stringify(log)); } catch (err) {}
  }

  function draftText(draft) {
    var blocks = [];
    (draft && draft.sections || []).forEach(function (section) {
      var rows = (section.lines || []).map(function (row) {
        return clip(row && row.text, 400);
      }).filter(Boolean);
      if (!rows.length) return;
      blocks.push('[' + clip(section.label, 40) + ']\n' + rows.join('\n'));
    });
    return blocks.join('\n\n').slice(0, 4000);
  }

  function noteGeneration(draft) {
    var text = draftText(draft);
    if (!text) return;
    var log = readLog();
    var last = log.generations[log.generations.length - 1];
    if (last && last.text === text) return;
    log.generations.push({
      at: new Date().toISOString(),
      title: clip(draft && draft.title, 80),
      text: text,
    });
    if (log.generations.length > 8) log.generations = log.generations.slice(-8);
    writeLog(log);
  }

  function noteEdit(edit) {
    var before = clip(edit && edit.before, 400);
    var after = clip(edit && edit.after, 400);
    if (!after || before === after) return;
    var log = readLog();
    log.edits.push({
      at: new Date().toISOString(),
      section: clip(edit && edit.section, 40),
      before: before,
      after: after,
    });
    if (log.edits.length > 40) log.edits = log.edits.slice(-40);
    writeLog(log);
  }

  function tagLine(line) {
    var text = String(line && line.text || '').trim();
    var original = line && line.original != null ? String(line.original).trim() : '';
    var changed = Boolean(line && line.edited) || Boolean(original && original !== text);
    if (line && line.source === 'user' && !changed) return TAG_YOU;
    if (changed) return TAG_EDITED;
    return TAG_AI;
  }

  function pair(label, value) {
    var text = clip(value, 400);
    if (!text) return null;
    return { label: clip(label, 80), value: text };
  }

  function linesFromDraft(draft) {
    var rows = [];
    (draft && draft.sections || []).forEach(function (section) {
      (section.lines || []).forEach(function (line) {
        var text = String(line && line.text || '').trim();
        if (!text) return;
        rows.push({
          section: clip(section.label, 40) || 'Section',
          text: text.slice(0, 400),
          source: line && line.source === 'user' ? 'user' : 'generated',
          original: line && line.original != null ? String(line.original).slice(0, 400) : '',
          edited: Boolean(line && line.edited),
        });
      });
    });
    return rows;
  }

  function newId() {
    var cryptoObj = root.crypto;
    if (cryptoObj && cryptoObj.getRandomValues) {
      var buf = new Uint8Array(6);
      cryptoObj.getRandomValues(buf);
      var hex = '';
      for (var i = 0; i < buf.length; i += 1) hex += ('0' + buf[i].toString(16)).slice(-2);
      return 'pg-' + hex;
    }
    return 'pg-' + Math.random().toString(16).slice(2, 14);
  }

  function formatWhen(iso) {
    var date = new Date(iso || Date.now());
    if (Number.isNaN(date.getTime())) return '';
    try {
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch (err) {
      return date.toISOString();
    }
  }

  function ensureEdits(lines, edits) {
    var extra = (edits || []).map(function (edit) {
      return {
        at: edit.at || '',
        section: clip(edit.section, 40),
        before: clip(edit.before, 400),
        after: clip(edit.after, 400),
      };
    }).filter(function (edit) { return edit.after && edit.before !== edit.after; });
    (lines || []).forEach(function (line) {
      var original = String(line.original || '').trim();
      var text = String(line.text || '').trim();
      if (!original || original === text) return;
      var seen = extra.some(function (edit) {
        return edit.before === original && edit.after === text && edit.section === line.section;
      });
      if (!seen) extra.push({ at: '', section: line.section, before: original, after: text });
    });
    return extra.slice(0, 40);
  }

  function build(input) {
    var data = input || {};
    var rawLines = Array.isArray(data.lines) ? data.lines : linesFromDraft(data.draft);
    var lines = rawLines.map(function (line) {
      var text = clip(line && line.text, 400);
      if (!text) return null;
      var row = {
        section: clip(line.section, 40) || 'Section',
        text: text,
        source: line.source === 'user' ? 'user' : 'generated',
        original: line.original != null ? String(line.original).slice(0, 400) : '',
        edited: Boolean(line.edited),
      };
      row.tag = tagLine(row);
      return row;
    }).filter(Boolean);
    var log = readLog();
    var record = {
      id: clip(data.id, 40) || newId(),
      createdAt: data.createdAt || new Date().toISOString(),
      title: clip(data.title, 80) || 'Untitled',
      userName: clip(data.userName, 80),
      lead: LEAD,
      disclaimer: DISCLAIMER,
      answers: (data.answers || []).map(function (row) { return pair(row.label, row.value); }).filter(Boolean).slice(0, 24),
      choices: (data.choices || []).map(function (row) { return pair(row.label, row.value); }).filter(Boolean).slice(0, 24),
      generations: (data.generations || log.generations).map(function (row) {
        var text = String(row && row.text || '').trim().slice(0, 4000);
        if (!text) return null;
        return { at: row.at || '', title: clip(row.title, 80), text: text };
      }).filter(Boolean).slice(0, 8),
      edits: ensureEdits(lines, data.edits || log.edits),
      lines: lines.slice(0, 120),
      stylePrompt: clip(data.stylePrompt, 240),
    };
    delete record.percent;
    delete record.score;
    delete record.yours;
    return record;
  }

  function lyricText(record) {
    var blocks = [];
    var section = '';
    var rows = [];
    function flush() {
      if (!rows.length) return;
      blocks.push('[' + (section || 'Section') + ']\n' + rows.join('\n'));
      rows = [];
    }
    (record.lines || []).forEach(function (line) {
      if (line.section !== section) {
        flush();
        section = line.section;
      }
      rows.push(line.text);
    });
    flush();
    return blocks.join('\n\n').slice(0, 12000);
  }

  function songFromRecord(record) {
    return {
      title: record.title || 'Untitled',
      text: lyricText(record),
      mode: 'claim',
      mood: '',
      claim: record,
    };
  }

  function officialHref(record) {
    var params = new URLSearchParams();
    params.set('type', 'split');
    params.set('declare', '1');
    if (record && record.userName) params.set('you', record.userName);
    if (record && record.title) params.set('work', record.title);
    if (record && record.id) params.set('record', record.id);
    return '/contracts/create?' + params.toString();
  }

  function declarationText(meta) {
    var info = meta || {};
    var you = clip(info.you, 80) || 'You';
    var work = clip(info.work, 80) || 'this song';
    var lines = [
      'Authorship declaration',
      you + ' is writing down the human parts of ' + work + '.',
    ];
    if (info.record) lines.push('Record ' + clip(info.record, 40) + '.');
    lines.push('Lines this person wrote or edited are the human parts. Untouched generated lines stay labeled as generated.');
    lines.push(DISCLAIMER);
    return lines.join('\n');
  }

  function plainLines(record) {
    var when = formatWhen(record.createdAt);
    var lines = [
      'Claim my human parts',
      LEAD,
      DISCLAIMER,
      '',
      'Song: ' + (record.title || 'Untitled'),
      'Name: ' + (record.userName || ''),
      'Date: ' + when,
      'Record: ' + (record.id || ''),
    ];
    function block(title, rows, render) {
      if (!rows || !rows.length) return;
      lines.push('');
      lines.push(title);
      rows.forEach(function (row) { lines.push(render(row)); });
    }
    block('Your answers', record.answers, function (row) { return row.label + ': ' + row.value; });
    block('Choices', record.choices, function (row) { return row.label + ': ' + row.value; });
    if (record.stylePrompt) {
      lines.push('');
      lines.push('Style prompt');
      lines.push(record.stylePrompt);
    }
    block('Generations', record.generations, function (row, index) {
      return 'Pass ' + (record.generations.indexOf(row) + 1) + ' (' + formatWhen(row.at) + '): ' + row.text.replace(/\n/g, ' / ');
    });
    block('Edits', record.edits, function (row) {
      var where = row.section ? row.section + '. ' : '';
      return where + 'Before: ' + row.before + ' After: ' + row.after;
    });
    block('Lines', record.lines, function (row) {
      return row.section + ': ' + row.text + ' (' + row.tag + ')';
    });
    return lines;
  }

  function latin1(text) {
    var map = {
      '\u2014': '-',
      '\u2013': '-',
      '\u2018': "'",
      '\u2019': "'",
      '\u201c': '"',
      '\u201d': '"',
      '\u00a0': ' ',
    };
    return String(text || '').replace(/[^\x00-\xff]/g, function (ch) {
      return Object.prototype.hasOwnProperty.call(map, ch) ? map[ch] : '?';
    });
  }

  function pdfLiteral(text) {
    var value = latin1(text).replace(/[\r\n]+/g, ' ');
    var out = '';
    for (var i = 0; i < value.length; i += 1) {
      var code = value.charCodeAt(i);
      if (code === 40 || code === 41 || code === 92) out += '\\' + value.charAt(i);
      else if (code < 32 || code > 126) out += '\\' + ('000' + code.toString(8)).slice(-3);
      else out += value.charAt(i);
    }
    return '(' + out + ')';
  }

  function wrapLine(text, width) {
    var words = latin1(text).split(/\s+/).filter(Boolean);
    if (!words.length) return [''];
    var lines = [];
    var line = '';
    words.forEach(function (word) {
      var next = line ? (line + ' ' + word) : word;
      if (line && next.length > width) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    });
    if (line) lines.push(line);
    return lines;
  }

  function pdfBytes(record) {
    var wrapped = [];
    plainLines(record || {}).forEach(function (line) {
      wrapLine(line, 86).forEach(function (row) { wrapped.push(row); });
    });
    if (!wrapped.length) wrapped.push('');
    var perPage = 42;
    var pages = [];
    for (var i = 0; i < wrapped.length; i += perPage) pages.push(wrapped.slice(i, i + perPage));
    var objects = [];
    function add(body) {
      objects.push(body);
      return objects.length;
    }
    var fontId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    var pageIds = [];
    var contentIds = [];
    pages.forEach(function (rows) {
      var commands = ['BT', '/F1 11 Tf'];
      rows.forEach(function (row, index) {
        var y = 760 - (index * 16);
        commands.push('1 0 0 1 48 ' + y + ' Tm ' + pdfLiteral(row) + ' Tj');
      });
      commands.push('ET');
      var stream = commands.join('\n');
      contentIds.push(add('<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream'));
      pageIds.push(null);
    });
    var pagesId = add('<< /Type /Pages /Count ' + pages.length + ' /Kids [' + pageIds.map(function () { return '0 0 R'; }).join(' ') + '] >>');
    pages.forEach(function (rows, index) {
      var id = add('<< /Type /Page /Parent ' + pagesId + ' 0 R /MediaBox [0 0 612 792] /Contents ' + contentIds[index] + ' 0 R /Resources << /Font << /F1 ' + fontId + ' 0 R >> >> >>');
      pageIds[index] = id;
    });
    objects[pagesId - 1] = '<< /Type /Pages /Count ' + pages.length + ' /Kids [' + pageIds.map(function (id) { return id + ' 0 R'; }).join(' ') + '] >>';
    var catalogId = add('<< /Type /Catalog /Pages ' + pagesId + ' 0 R >>');
    var chunks = ['%PDF-1.4\n'];
    var offsets = [0];
    objects.forEach(function (body, index) {
      offsets.push(chunks.join('').length);
      chunks.push(String(index + 1) + ' 0 obj\n' + body + '\nendobj\n');
    });
    var xrefAt = chunks.join('').length;
    var xref = ['xref', '0 ' + (objects.length + 1), '0000000000 65535 f '];
    for (var n = 1; n < offsets.length; n += 1) {
      xref.push(('0000000000' + offsets[n]).slice(-10) + ' 00000 n ');
    }
    chunks.push(xref.join('\n') + '\n');
    chunks.push('trailer\n<< /Size ' + (objects.length + 1) + ' /Root ' + catalogId + ' 0 R >>\nstartxref\n' + xrefAt + '\n%%EOF');
    var raw = chunks.join('');
    var bytes = new Uint8Array(raw.length);
    for (var c = 0; c < raw.length; c += 1) bytes[c] = raw.charCodeAt(c) & 255;
    return bytes;
  }

  function submit(record) {
    var song = songFromRecord(record);
    var account = root.PlaigroundLyricsAccount;
    if (account && account.hold) account.hold(song);
    var fetchFn = root.fetch;
    if (typeof fetchFn !== 'function') return Promise.resolve({ ok: false, error: 'The account save did not go through. Your record stays on this device.' });
    return fetchFn('/api/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } }).then(function (res) {
      if (res.status === 401) return { ok: false, needsAuth: true };
      if (!res.ok) return { ok: false, error: 'The account save did not go through. Your record stays on this device.' };
      return res.json().then(function (me) {
        var name = me && (me.artist || me.username) ? String(me.artist || me.username) : '';
        if (name && !record.userName) record.userName = clip(name, 80);
        song = songFromRecord(record);
        if (account && account.hold) account.hold(song);
        return fetchFn('/api/me/lyrics', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ song: song }),
        }).then(function (saveRes) {
          return saveRes.json().catch(function () { return {}; }).then(function (data) {
            if (saveRes.ok && data && data.ok && data.song) {
              if (account && account.clearPending) account.clearPending();
              return { ok: true, id: record.id, songId: data.song.id };
            }
            return { ok: false, error: (data && data.error) || 'The account save did not go through. Your record stays on this device.' };
          });
        });
      });
    }).catch(function () {
      return { ok: false, error: 'The account save did not go through. Your record stays on this device.' };
    });
  }

  return {
    DISCLAIMER: DISCLAIMER,
    LEAD: LEAD,
    LOG_KEY: LOG_KEY,
    TAG_AI: TAG_AI,
    TAG_EDITED: TAG_EDITED,
    TAG_YOU: TAG_YOU,
    build: build,
    declarationText: declarationText,
    formatWhen: formatWhen,
    linesFromDraft: linesFromDraft,
    lyricText: lyricText,
    noteEdit: noteEdit,
    noteGeneration: noteGeneration,
    officialHref: officialHref,
    pdfBytes: pdfBytes,
    plainLines: plainLines,
    readLog: readLog,
    songFromRecord: songFromRecord,
    submit: submit,
    tagLine: tagLine,
  };
});
