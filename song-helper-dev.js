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
      ? (state.credits + ' credits left. Read Me, Persona Lock, and an on-voice rewrite each use 1.')
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
      title.textContent = item.kind === 'title' ? 'Title' : (item.kind === 'memo' ? 'Voice memo' : 'Line');
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

  function boot() {
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
