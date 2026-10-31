/**
 * Upload page, album mode: "Apply to all tracks" card plus per-track
 * "Applied from album" / "Edit this track" and each track's own check.
 * Needs lib/album-apply.js and store-client.js (window.PlaiStoreDraft).
 */
(function () {
  'use strict';
  var A = window.PlaiAlbumApply;
  if (!A || !document.querySelector) return;

  function draftApi() { return window.PlaiStoreDraft || null; }
  function readDraft() { var d = draftApi(); return d ? d.read() : {}; }
  function writeDraft(patch) { var d = draftApi(); return d ? d.write(patch) : {}; }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function parseWriters(text) {
    return String(text || '').split(/\n+/).map(function (line) {
      var m = line.trim().match(/^(.*?)[\s,]+(\d+(?:\.\d+)?)\s*%?$/);
      return m ? { name: m[1].trim(), share: Number(m[2]) } : null;
    }).filter(Boolean);
  }
  function writersText(list) {
    return (list || []).map(function (w) { return w.name + ' ' + w.share; }).join('\n');
  }
  function parseCredits(text) {
    return String(text || '').split(/\n+/).map(function (line) {
      var parts = line.split(/\s+-\s+|,\s*/);
      if (parts.length < 2) return null;
      return { name: parts[0].trim(), role: parts[parts.length - 1].trim().toLowerCase() };
    }).filter(function (c) { return c && c.name && c.role; });
  }
  function creditsText(list) {
    return (list || []).map(function (c) { return c.name + ' - ' + c.role; }).join('\n');
  }

  function labelButtons(attr, current) {
    return Object.keys(A.MADE_HOW).map(function (key) {
      return '<a href="#made-how" class="' + (current === key ? 'on' : '') + '" ' + attr + '="' + key + '">' + A.MADE_HOW[key] + '</a>';
    }).join('');
  }

  function artistName() {
    var sel = document.getElementById('tg-artist-select');
    if (sel && sel.value && sel.options && sel.selectedIndex > -1) return sel.options[sel.selectedIndex].text;
    var d = readDraft();
    return d.name || d.artist || '';
  }

  function albumDefaults() {
    var d = readDraft();
    return {
      artist: artistName(),
      made_how: d.made_how || '',
      ai_service: d.ai_service || d.ai_service_other || '',
      contributors: Array.isArray(d.contributors) ? d.contributors : [],
      writers: Array.isArray(d.album_writers) ? d.album_writers : [],
      explicit: d.explicit === true || d.explicit === 'true',
    };
  }

  function rows() { return Array.prototype.slice.call(document.querySelectorAll('[data-track-row]')); }

  function rowTrack(row, i) {
    var raw = row.getAttribute('data-track-override');
    var over;
    try { over = raw ? JSON.parse(raw) : undefined; } catch (e) { over = undefined; }
    var title = row.querySelector('[data-track-title]');
    var input = row.querySelector('[data-audio-input]');
    var hasFile = !!(input && ((input.files && input.files[0]) || input._plaigroundFile));
    return {
      title: title ? title.value : '',
      position: i + 1,
      override: over,
      has_audio: hasFile || row.getAttribute('data-audio-uploaded') === 'true',
    };
  }

  function saveOverride(row, over) {
    if (over && Object.keys(over).length) row.setAttribute('data-track-override', JSON.stringify(over));
    else row.removeAttribute('data-track-override');
    var list = document.querySelector('[data-track-list]');
    if (list && typeof Event === 'function') list.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function ensureCard() {
    var section = document.querySelector('[data-album-tracks]');
    if (!section || section.querySelector('[data-album-apply]')) return;
    var card = document.createElement('div');
    card.className = 'album-apply';
    card.setAttribute('data-album-apply', '');
    var list = section.querySelector('[data-track-list]');
    section.insertBefore(card, list);
    paintCard();
    card.addEventListener('click', function (event) {
      var how = event.target.closest && event.target.closest('[data-album-made-how]');
      if (how) {
        event.preventDefault();
        writeDraft({ made_how: how.getAttribute('data-album-made-how') });
        refresh();
      }
      var all = event.target.closest && event.target.closest('[data-album-apply-all]');
      if (all) {
        event.preventDefault();
        rows().forEach(function (row) { saveOverride(row, null); });
        refresh();
      }
    });
    card.addEventListener('change', function (event) {
      if (event.target.matches && event.target.matches('[data-album-writers]')) {
        writeDraft({ album_writers: parseWriters(event.target.value) });
        refresh();
      }
    });
  }

  function paintCard() {
    var card = document.querySelector('[data-album-apply]');
    if (!card) return;
    var base = albumDefaults();
    card.innerHTML = ''
      + '<h4>Apply to all tracks</h4>'
      + '<p class="hint">Set it once. Every track uses these until you edit that track.</p>'
      + '<p class="album-apply-line"><b>Artist profile</b> <span data-album-artist>' + esc(base.artist || 'Pick an artist profile below') + '</span></p>'
      + '<p class="hint" style="margin:10px 0 4px">How it was made</p>'
      + '<div class="auth-toggle" data-album-made-how-toggle>' + labelButtons('data-album-made-how', base.made_how) + '</div>'
      + '<div class="field" style="margin-top:12px"><label for="album-writers">Writers and splits</label>'
      + '<textarea id="album-writers" rows="3" data-album-writers placeholder="One writer per line, name then percent">' + esc(writersText(base.writers)) + '</textarea>'
      + '<p class="hint">Leave empty to use your split sheet for every track.</p></div>'
      + '<p class="album-apply-line"><b>Credits</b> ' + (base.contributors.length ? esc(creditsText(base.contributors).replace(/\n/g, ', ')) : 'From your credits step') + '</p>'
      + '<p><button class="btn btn-purple btn-sm" type="button" data-album-apply-all>Apply to all tracks</button></p>'
      + '<p class="hint" data-album-check></p>';
  }

  function decorateRow(row, i, base) {
    var t = rowTrack(row, i);
    var box = row.querySelector('[data-track-apply]');
    if (!box) {
      box = document.createElement('div');
      box.className = 'track-apply';
      box.setAttribute('data-track-apply', '');
      row.appendChild(box);
      box.addEventListener('click', function (event) { onRowClick(row, event); });
      box.addEventListener('change', function (event) { onRowChange(row, event); });
    }
    var opts = { requireTool: false, requireWriters: base.writers.length > 0 };
    var res = A.verifyTrack(base, t, opts);
    var r = res.resolved;
    var editing = row.getAttribute('data-track-editing') === 'true';
    var chip = r.applied_from_album
      ? '<span class="chip" data-applied-from-album>Applied from album</span>'
      : '<span class="chip chip-edit" data-track-edited>Edited for this track</span>';
    var html = '<p class="track-apply-line">' + chip
      + ' <span class="hint">' + esc(A.MADE_HOW[r.made_how] || 'No label yet') + '</span> '
      + '<button class="btn btn-ghost btn-sm" type="button" data-track-edit>' + (editing ? 'Done' : 'Edit this track') + '</button>'
      + (r.applied_from_album ? '' : ' <button class="btn btn-ghost btn-sm" type="button" data-track-use-album>Use album settings</button>')
      + '</p>';
    if (editing) {
      html += '<div class="auth-toggle" data-track-made-how-toggle>' + labelButtons('data-track-made-how', r.made_how) + '</div>'
        + '<div class="field"><label>AI tool for this track</label><input type="text" data-track-ai-tool value="' + esc(r.source.ai_service === 'track' ? r.ai_service : '') + '" placeholder="Name of the tool" autocomplete="off" /></div>'
        + '<div class="field"><label>Writers and splits for this track</label><textarea rows="3" data-track-writers placeholder="One writer per line, name then percent">' + esc(r.source.writers === 'track' ? writersText(r.writers) : '') + '</textarea></div>'
        + '<div class="field"><label>Credits for this track</label><textarea rows="3" data-track-credits placeholder="Name - role">' + esc(r.source.contributors === 'track' ? creditsText(r.contributors) : '') + '</textarea>'
        + '<p class="hint">Roles: ' + A.ROLES.join(', ') + '.</p></div>';
    }
    html += '<p class="hint" data-track-check>' + (res.ok ? 'Track check passed.' : esc(res.problems.join(' '))) + '</p>';
    box.innerHTML = html;
    row.setAttribute('data-track-check-ok', res.ok ? 'true' : 'false');
    return res;
  }

  function currentOver(row) {
    try { return JSON.parse(row.getAttribute('data-track-override') || '{}') || {}; } catch (e) { return {}; }
  }

  function onRowClick(row, event) {
    var t = event.target;
    if (!t.closest) return;
    if (t.closest('[data-track-edit]')) {
      event.preventDefault();
      row.setAttribute('data-track-editing', row.getAttribute('data-track-editing') === 'true' ? 'false' : 'true');
    } else if (t.closest('[data-track-use-album]')) {
      event.preventDefault();
      saveOverride(row, null);
    } else if (t.closest('[data-track-made-how]')) {
      event.preventDefault();
      var over = currentOver(row);
      over.made_how = t.closest('[data-track-made-how]').getAttribute('data-track-made-how');
      saveOverride(row, over);
    } else return;
    refresh();
  }

  function onRowChange(row, event) {
    var t = event.target;
    var over = currentOver(row);
    function set(key, value, empty) { if (empty) delete over[key]; else over[key] = value; }
    if (t.matches('[data-track-ai-tool]')) set('ai_service', t.value.trim(), !t.value.trim());
    else if (t.matches('[data-track-writers]')) set('writers', parseWriters(t.value), !t.value.trim());
    else if (t.matches('[data-track-credits]')) set('contributors', parseCredits(t.value), !t.value.trim());
    else return;
    saveOverride(row, over);
    refresh();
  }

  var painting = false;
  function refresh() {
    if (painting) return;
    painting = true;
    try {
      ensureCard();
      var base = albumDefaults();
      var card = document.querySelector('[data-album-apply]');
      if (card) {
        var artist = card.querySelector('[data-album-artist]');
        if (artist) artist.textContent = base.artist || 'Pick an artist profile below';
        Array.prototype.forEach.call(card.querySelectorAll('[data-album-made-how]'), function (el) {
          el.classList.toggle('on', el.getAttribute('data-album-made-how') === base.made_how);
        });
      }
      var list = rows();
      var tracks = list.map(rowTrack);
      list.forEach(function (row, i) { decorateRow(row, i, base); });
      var album = A.verifyAlbum(base, tracks, { requireTool: false, requireWriters: base.writers.length > 0 });
      document.documentElement.setAttribute('data-album-check-ok', album.ok ? 'true' : 'false');
      var check = card && card.querySelector('[data-album-check]');
      if (check) {
        var kindName = { single: 'single', ep: 'EP', album: 'album' }[album.kind];
        check.textContent = album.ok
          ? 'All ' + tracks.length + ' tracks passed their checks. This goes out as one ' + kindName + '.'
          : album.problems.length + ' to fix before this album can go out.';
      }
    } finally {
      painting = false;
    }
  }

  function albumMode() {
    var d = readDraft();
    return d.type === 'album' || /(?:^\?|&)type=album(?:&|$)/.test(location.search || '');
  }

  function start() {
    if (!albumMode()) return;
    refresh();
    var list = document.querySelector('[data-track-list]');
    if (list && window.MutationObserver) {
      new MutationObserver(function (muts) {
        var structural = muts.some(function (m) { return m.type === 'childList' && m.target === list; });
        if (structural) refresh();
      }).observe(list, { childList: true });
      list.addEventListener('input', function (e) {
        if (e.target && e.target.matches && e.target.matches('[data-track-title]')) refresh();
      });
      list.addEventListener('click', function (e) {
        if (e.target && e.target.closest && e.target.closest('[data-track-up], [data-track-down]')) setTimeout(refresh, 0);
      });
    }
    var sel = document.getElementById('tg-artist-select');
    if (sel) sel.addEventListener('change', refresh);
    // Album goes out only when every track passed its own check.
    var go = document.querySelector('[data-store-continue]');
    if (go) {
      go.addEventListener('click', function (event) {
        if (!albumMode()) return;
        refresh();
        if (document.documentElement.getAttribute('data-album-check-ok') !== 'true') {
          event.preventDefault();
          event.stopImmediatePropagation();
          var section = document.querySelector('[data-album-tracks]');
          if (section && section.scrollIntoView) section.scrollIntoView({ behavior: 'smooth' });
        }
      }, true);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 0); });
  else setTimeout(start, 0);
})();
