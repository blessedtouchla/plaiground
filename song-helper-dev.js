(function () {
  var state = { signedIn: false, credits: 0, read_me: null, persona: null, items: [] };

  function $(id) { return document.getElementById(id); }

  function devError(message) {
    var el = $('sh-dev-error');
    if (!el) return;
    el.textContent = message || '';
    el.hidden = !message;
  }

  function post(action, body) {
    return fetch('/api/song-helper?action=' + encodeURIComponent(action), {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ action: action }, body || {})),
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        data.status = res.status;
        return data;
      });
    });
  }

  function paintCredits() {
    var el = $('sh-dev-credits');
    if (!el) return;
    el.textContent = state.signedIn
      ? (state.credits + ' credits left. A song breakdown, a full rewrite, Read Me, Persona Lock, and an on-voice rewrite each use 1.')
      : '';
  }

  function paintVault() {
    var host = $('sh-dev-vault');
    if (!host) return;
    host.textContent = '';
    var form = document.createElement('div');
    form.className = 'sh-dev-form';
    form.innerHTML = ''
      + '<label class="sh-field"><span>Title</span><input class="sh-input" id="sh-vault-title" maxlength="80" autocomplete="off" /></label>'
      + '<div class="sh-side-actions"><button type="button" class="btn btn-ghost btn-md" id="sh-vault-title-save">Save title</button></div>'
      + '<label class="sh-field"><span>Line</span><textarea class="sh-area" id="sh-vault-line" rows="3" maxlength="400" placeholder="A line in your own words."></textarea></label>'
      + '<div class="sh-side-actions"><button type="button" class="btn btn-ghost btn-md" id="sh-vault-line-save">Save line</button></div>'
      + '<label class="sh-field"><span>Voice memo</span><input class="sh-input" id="sh-vault-audio" type="file" accept="audio/*" /></label>'
      + '<label class="sh-field"><span>Note for the memo</span><input class="sh-input" id="sh-vault-note" maxlength="400" autocomplete="off" placeholder="Optional. Read Me quotes typed lines, not the audio." /></label>'
      + '<div class="sh-side-actions"><button type="button" class="btn btn-ghost btn-md" id="sh-vault-memo-save">Save voice memo</button></div>';
    host.appendChild(form);
    var list = document.createElement('div');
    list.className = 'sh-dev-list';
    (state.items || []).forEach(function (item) {
      var row = document.createElement('article');
      row.className = 'sh-part';
      var title = document.createElement('h3');
      title.textContent = item.kind === 'title' ? 'Title' : (item.kind === 'memo' ? 'Voice memo' : (item.kind === 'song' ? (item.title || 'Song draft') : 'Line'));
      var body = document.createElement('p');
      body.textContent = item.kind === 'title' ? (item.title || '') : (item.body || item.title || '');
      row.appendChild(title);
      row.appendChild(body);
      if (item.audio && item.mime) {
        var audio = document.createElement('audio');
        audio.controls = true;
        audio.src = 'data:' + item.mime + ';base64,' + item.audio;
        row.appendChild(audio);
      }
      var remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'btn btn-ghost btn-md';
      remove.textContent = 'Delete';
      remove.addEventListener('click', function () {
        post('vault-delete', { id: item.id }).then(applyResult);
      });
      row.appendChild(remove);
      list.appendChild(row);
    });
    host.appendChild(list);
    var titleBtn = $('sh-vault-title-save');
    var lineBtn = $('sh-vault-line-save');
    var memoBtn = $('sh-vault-memo-save');
    if (titleBtn) titleBtn.addEventListener('click', function () {
      post('vault-save', { kind: 'title', title: $('sh-vault-title').value }).then(applyResult);
    });
    if (lineBtn) lineBtn.addEventListener('click', function () {
      post('vault-save', { kind: 'line', body: $('sh-vault-line').value }).then(applyResult);
    });
    if (memoBtn) memoBtn.addEventListener('click', function () { saveMemo(); });
  }

  function saveMemo() {
    var fileInput = $('sh-vault-audio');
    var file = fileInput && fileInput.files && fileInput.files[0];
    var note = $('sh-vault-note') ? $('sh-vault-note').value : '';
    if (!file) {
      post('vault-save', { kind: 'memo', body: note }).then(applyResult);
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      var raw = String(reader.result || '');
      var mime = file.type || 'audio/webm';
      post('vault-save', { kind: 'memo', body: note, mime: mime, audio: raw }).then(applyResult);
    };
    reader.readAsDataURL(file);
  }

  function paintRead() {
    var host = $('sh-dev-readout');
    if (!host) return;
    host.textContent = '';
    var read = state.read_me;
    if (!read) return;
    var head = document.createElement('h3');
    head.className = 'sh-subhead';
    head.textContent = 'Read me';
    host.appendChild(head);
    (read.themes || []).forEach(function (theme) {
      var block = document.createElement('article');
      block.className = 'sh-part';
      var name = document.createElement('h3');
      name.textContent = theme.name || 'Theme';
      var quote = document.createElement('p');
      quote.textContent = theme.quote || '';
      block.appendChild(name);
      block.appendChild(quote);
      host.appendChild(block);
    });
    var genres = document.createElement('p');
    genres.className = 'sh-help';
    if (read.genres && read.genres.length) {
      genres.textContent = 'Genre suggestions: ' + read.genres.map(function (row) {
        return row.genre + ' / ' + row.subgenre;
      }).join(', ') + '.';
    } else {
      genres.textContent = read.genreNote || 'No genre suggestion yet.';
    }
    host.appendChild(genres);
  }

  function paintPersona() {
    var host = $('sh-dev-persona');
    if (!host) return;
    host.textContent = '';
    var persona = state.persona;
    if (!persona) return;
    var head = document.createElement('h3');
    head.className = 'sh-subhead';
    head.textContent = 'Persona lock';
    host.appendChild(head);
    [
      ['Point of view', persona.pov],
      ['Vocabulary', (persona.vocabulary || []).join(', ')],
      ['Slang', (persona.slang || []).join(', ')],
      ['Slang note', persona.slangNote],
      ['Do', (persona.do || []).join(' ')],
      ['Do not', (persona.dont || []).join(' ')],
    ].forEach(function (row) {
      if (!row[1]) return;
      var p = document.createElement('p');
      p.className = 'sh-help';
      p.textContent = row[0] + ': ' + row[1];
      host.appendChild(p);
    });
    (persona.themes || []).forEach(function (theme) {
      var p = document.createElement('p');
      p.className = 'sh-help';
      p.textContent = (theme.name || 'Theme') + ': ' + (theme.quote || '');
      host.appendChild(p);
    });
  }

  function paintVoice(sections) {
    var core = window.PlaigroundArtistDev;
    if (!core || !core.offVoice) return;
    (sections || []).forEach(function (row) {
      var slot = document.querySelector('[data-voice="' + row.id + '"]');
      if (!slot) return;
      slot.textContent = '';
      slot.hidden = true;
      if (!state.persona) return;
      var verdict = core.offVoice(row.text, state.persona);
      if (!verdict.off) return;
      var note = document.createElement('p');
      note.className = 'sh-help sh-voice-warn';
      note.textContent = verdict.reason;
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-purple btn-md';
      button.textContent = 'Rewrite on voice (1 credit)';
      button.addEventListener('click', function () { rewritePart(row, button); });
      slot.appendChild(note);
      slot.appendChild(button);
      slot.hidden = false;
    });
  }

  function rewritePart(row, button) {
    if (button) button.disabled = true;
    post('voice-rewrite', { id: row.id, kind: row.kind, text: row.text, section: row.label }).then(function (data) {
      if (button) button.disabled = false;
      if (!data || !data.ok || !data.text) {
        devError((data && data.error) || 'That rewrite did not come back.');
        return;
      }
      var area = document.querySelector('[data-part-text="' + row.id + '"]');
      if (area) {
        area.value = data.text;
        area.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (typeof data.credits === 'number') state.credits = data.credits;
      paintCredits();
      devError('');
    }).catch(function () {
      if (button) button.disabled = false;
      devError('That rewrite did not come back.');
    });
  }

  function applyResult(data) {
    if (!data || data.ok === false) {
      devError((data && data.error) || 'That did not save.');
      return;
    }
    devError('');
    if (Array.isArray(data.items)) state.items = data.items;
    if (typeof data.credits === 'number') state.credits = data.credits;
    if (data.read_me) state.read_me = data.read_me;
    if (data.persona) state.persona = data.persona;
    if (data.persona === null) state.persona = null;
    paintCredits();
    paintVault();
    paintRead();
    paintPersona();
    window.dispatchEvent(new CustomEvent('plaiground-sections-refresh'));
  }

  function showPanel() {
    var panel = $('sh-dev');
    if (panel) panel.hidden = false;
  }

  function bootHave() {
    var breakBtn = $('sh-have-break');
    var rewriteBtn = $('sh-have-rewrite');
    var saveBtn = $('sh-have-save');
    if (breakBtn) breakBtn.addEventListener('click', breakSong);
    if (rewriteBtn) rewriteBtn.addEventListener('click', rewriteSong);
    if (saveBtn) saveBtn.addEventListener('click', saveSong);
  }

  var haveState = { original: '', parts: [], voice: null };
  var HAVE_LABELS = [
    ['Hook', 'hook'],
    ['Verse 1', 'verse'],
    ['Verse 2', 'verse'],
    ['Verse 3', 'verse'],
    ['Pre-chorus', 'prechorus'],
    ['Bridge', 'bridge'],
    ['Intro', 'intro'],
    ['Outro', 'outro'],
  ];

  function haveError(message) {
    var el = $('sh-have-error');
    if (!el) return;
    el.textContent = message || '';
    el.hidden = !message;
  }

  function haveNote(message) {
    var el = $('sh-have-note');
    if (!el) return;
    el.textContent = message || '';
    el.hidden = !message;
  }

  function finalText(part) {
    if (part.pick === 'suggested' && part.suggested) return part.suggested;
    return part.text || '';
  }

  function assembleFinal() {
    return haveState.parts.map(function (part) {
      return part.label + '\n' + finalText(part);
    }).join('\n\n');
  }

  function refreshPartNote(part) {
    var core = window.PlaigroundArtistDev;
    var genre = haveState.voice && haveState.voice.genre ? haveState.voice.genre : '';
    var note = core && core.partNote ? core.partNote(part, genre) : { works: '', improve: '', hook_ok: null, hook_note: '' };
    part.works = note.works;
    part.improve = note.improve;
    part.hook_ok = note.hook_ok;
    part.hook_note = note.hook_note;
  }

  function compareCol(heading, text, buttonLabel, pressed, click) {
    var col = document.createElement('div');
    var headingNode = document.createElement('h3');
    headingNode.textContent = heading;
    var body = document.createElement('p');
    body.textContent = text || '';
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-ghost btn-md';
    button.textContent = buttonLabel;
    button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    button.addEventListener('click', click);
    col.appendChild(headingNode);
    col.appendChild(body);
    col.appendChild(button);
    return col;
  }

  function renderHave() {
    var host = $('sh-have-parts');
    var actions = $('sh-have-actions');
    if (!host) return;
    host.textContent = '';
    if (actions) actions.hidden = !haveState.parts.length;
    haveState.parts.forEach(function (part, index) {
      var card = document.createElement('article');
      card.className = 'sh-part';
      var title = document.createElement('h3');
      title.textContent = part.label;
      var field = document.createElement('label');
      field.className = 'sh-field';
      var span = document.createElement('span');
      span.textContent = 'Part label';
      var select = document.createElement('select');
      select.className = 'sh-input';
      var options = HAVE_LABELS.slice();
      if (!options.some(function (row) { return row[0] === part.label; })) options.push([part.label, part.kind]);
      options.forEach(function (row) {
        var option = document.createElement('option');
        option.value = row[0];
        option.textContent = row[0];
        option.setAttribute('data-kind', row[1]);
        if (row[0] === part.label) option.selected = true;
        select.appendChild(option);
      });
      select.addEventListener('change', function () {
        var chosen = select.options[select.selectedIndex];
        part.label = chosen.value;
        part.kind = chosen.getAttribute('data-kind') || 'verse';
        part.suggested = '';
        part.pick = 'mine';
        refreshPartNote(part);
        renderHave();
      });
      field.appendChild(span);
      field.appendChild(select);
      card.appendChild(title);
      card.appendChild(field);
      if (part.inferred) {
        var inferred = document.createElement('p');
        inferred.className = 'sh-help';
        inferred.textContent = 'Label inferred. Fix it if this part is something else.';
        card.appendChild(inferred);
      }
      if (part.hook_note) {
        var score = document.createElement('p');
        score.className = 'sh-help';
        score.textContent = part.hook_note;
        card.appendChild(score);
      }
      var works = document.createElement('p');
      works.className = 'sh-help';
      works.textContent = 'What works: ' + (part.works || '');
      var move = document.createElement('p');
      move.className = 'sh-help';
      move.textContent = part.improve || '';
      var original = document.createElement('p');
      original.textContent = part.text || '';
      var better = document.createElement('button');
      better.type = 'button';
      better.className = 'btn btn-ghost btn-md';
      better.textContent = 'Make it better';
      better.addEventListener('click', function () { improveOne(index); });
      card.appendChild(works);
      card.appendChild(move);
      card.appendChild(original);
      card.appendChild(better);
      if (part.suggested) {
        var compare = document.createElement('div');
        compare.className = 'sh-have-compare';
        compare.appendChild(compareCol('Your words', part.text, 'Keep mine', part.pick !== 'suggested', function () {
          part.pick = 'mine';
          renderHave();
        }));
        compare.appendChild(compareCol('Suggested', part.suggested, 'Use this', part.pick === 'suggested', function () {
          part.pick = 'suggested';
          renderHave();
        }));
        card.appendChild(compare);
        var using = document.createElement('p');
        using.className = 'sh-help';
        using.textContent = part.pick === 'suggested'
          ? 'Using the suggestion. Every line is still yours.'
          : 'Keeping your words.';
        card.appendChild(using);
      }
      host.appendChild(card);
    });
  }

  function improveOne(index) {
    var core = window.PlaigroundArtistDev;
    var part = haveState.parts[index];
    if (!core || !core.improvePart || !part) {
      haveError('That rewrite did not come back.');
      return;
    }
    var better = core.improvePart(part.text, part.kind, haveState.voice || {});
    part.suggested = better.text || part.text;
    haveError('');
    renderHave();
  }

  function breakSong() {
    var area = $('sh-have-paste');
    var text = area ? area.value : '';
    haveError('');
    haveNote('');
    post('song-breakdown', { text: text }).then(function (data) {
      if (!data || !data.ok) {
        haveError((data && data.error) || 'Sign in to use artist tools.');
        return;
      }
      haveState.original = text;
      haveState.voice = data.voice || null;
      haveState.parts = (data.parts || []).map(function (part) {
        part.pick = 'mine';
        part.suggested = '';
        return part;
      });
      if (typeof data.credits === 'number') {
        state.credits = data.credits;
        state.signedIn = true;
        paintCredits();
      }
      haveNote(data.voice_source === 'persona'
        ? 'Using your Persona Lock voice sheet.'
        : 'No Persona Lock yet, so this pass reads the voice in the lyrics you pasted.');
      renderHave();
    }).catch(function () {
      haveError('That breakdown did not come back.');
    });
  }

  function rewriteSong() {
    haveError('');
    post('song-rewrite', {
      parts: haveState.parts.map(function (part) {
        return { id: part.id, kind: part.kind, label: part.label, text: part.text };
      }),
    }).then(function (data) {
      if (!data || !data.ok) {
        haveError((data && data.error) || 'That rewrite did not come back.');
        return;
      }
      var byId = {};
      (data.parts || []).forEach(function (part) { byId[part.id] = part; });
      haveState.parts.forEach(function (part) {
        var next = byId[part.id];
        if (!next) return;
        part.suggested = next.suggested || part.text;
      });
      if (typeof data.credits === 'number') {
        state.credits = data.credits;
        paintCredits();
      }
      haveNote(data.voice_source === 'persona'
        ? 'Full rewrite used your Persona Lock. Pick Keep mine or Use this on each part.'
        : 'Full rewrite used the voice in your lyrics. Pick Keep mine or Use this on each part.');
      renderHave();
    }).catch(function () {
      haveError('That rewrite did not come back.');
    });
  }

  function saveSong() {
    if (!haveState.original || !haveState.parts.length) {
      haveError('Break the song down before you save it.');
      return;
    }
    post('vault-save', { kind: 'song', title: 'Original draft', body: haveState.original }).then(function (data) {
      if (!data || !data.ok) {
        haveError((data && data.error) || 'The original draft did not save.');
        return null;
      }
      applyResult(data);
      return post('vault-save', { kind: 'song', title: 'Final version', body: assembleFinal() });
    }).then(function (data) {
      if (!data) return;
      if (!data.ok) {
        haveError(data.error || 'The original saved. The final version did not.');
        return;
      }
      applyResult(data);
      haveError('');
      haveNote('Saved. The original draft is your authorship proof. The final version is saved beside it.');
    }).catch(function () {
      haveError('That save did not come through.');
    });
  }

  function boot() {
    bootHave();
    var panel = $('sh-dev');
    if (!panel) return;
    fetch('/api/song-helper?action=dev-status', { credentials: 'same-origin' })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data || !data.signedIn) return;
        state.signedIn = true;
        state.credits = data.credits;
        state.read_me = data.read_me || null;
        state.persona = data.persona || null;
        state.items = data.items || [];
        showPanel();
        paintCredits();
        paintVault();
        paintRead();
        paintPersona();
      })
      .catch(function () {});
    var read = $('sh-dev-read');
    var lock = $('sh-dev-lock');
    if (read) read.addEventListener('click', function () { post('read-me', {}).then(applyResult); });
    if (lock) lock.addEventListener('click', function () { post('persona-lock', {}).then(applyResult); });
    window.addEventListener('plaiground-sections', function (event) {
      paintVoice(event && event.detail);
    });
    window.addEventListener('plaiground-sections-refresh', function () {
      var areas = document.querySelectorAll('[data-part-text]');
      var sections = [];
      Array.prototype.forEach.call(areas, function (area) {
        sections.push({
          id: area.getAttribute('data-part-text'),
          kind: '',
          text: area.value,
        });
      });
      paintVoice(sections);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}());
