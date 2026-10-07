(function () {
  var api = window.PlaigroundClaim;
  var view = document.querySelector('[data-claim-view]');
  if (!api || !view) return;

  function text(tag, className, value) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    el.textContent = value || '';
    return el;
  }

  function selectedId() {
    try {
      return new URLSearchParams(window.location.search).get('id') || '';
    } catch (err) {
      return '';
    }
  }

  function showStatus(message) {
    view.textContent = '';
    view.appendChild(text('p', 'claim-note', message));
  }

  function addBlock(title, rows, render) {
    if (!rows || !rows.length) return;
    var block = document.createElement('section');
    block.className = 'claim-block';
    block.appendChild(text('h2', '', title));
    rows.forEach(function (row) { block.appendChild(render(row)); });
    view.appendChild(block);
  }

  function render(record, name) {
    var shown = Object.assign({}, record);
    if (!shown.userName && name) shown.userName = name;
    view.textContent = '';
    view.appendChild(text('p', 'eyebrow', 'Song Helper'));
    view.appendChild(text('h1', '', 'Claim my human parts'));
    view.appendChild(text('p', 'claim-lead', api.LEAD));
    view.appendChild(text('p', 'claim-note', api.DISCLAIMER));
    var meta = document.createElement('div');
    meta.className = 'claim-meta';
    meta.appendChild(text('p', '', shown.title || 'Untitled'));
    meta.appendChild(text('p', '', api.formatWhen(shown.createdAt)));
    if (shown.userName) meta.appendChild(text('p', '', shown.userName));
    meta.appendChild(text('p', '', 'Record ' + (shown.id || '')));
    view.appendChild(meta);
    addBlock('Your answers', shown.answers, function (row) {
      return text('p', 'claim-row', row.label + ': ' + row.value);
    });
    addBlock('Choices', shown.choices, function (row) {
      return text('p', 'claim-row', row.label + ': ' + row.value);
    });
    if (shown.stylePrompt) {
      var style = document.createElement('section');
      style.className = 'claim-block';
      style.appendChild(text('h2', '', 'Style prompt'));
      style.appendChild(text('p', 'claim-row', shown.stylePrompt));
      view.appendChild(style);
    }
    addBlock('Generations', shown.generations, function (row, index) {
      var pass = shown.generations.indexOf(row) + 1;
      return text('p', 'claim-edit', 'Pass ' + pass + ', ' + api.formatWhen(row.at) + '\n' + row.text);
    });
    addBlock('Edits', shown.edits, function (row) {
      var where = row.section ? row.section + '\n' : '';
      return text('p', 'claim-edit', where + 'Before: ' + row.before + '\nAfter: ' + row.after);
    });
    addBlock('Lines', shown.lines, function (row) {
      var item = document.createElement('p');
      item.className = 'claim-line';
      item.appendChild(text('span', '', row.section + ': ' + row.text));
      item.appendChild(document.createElement('br'));
      item.appendChild(text('span', 'claim-tag', row.tag));
      return item;
    });
    var actions = document.createElement('div');
    actions.className = 'claim-actions';
    var download = document.createElement('button');
    download.type = 'button';
    download.className = 'btn btn-purple btn-md';
    download.textContent = 'Download PDF';
    download.addEventListener('click', function () {
      (window.PlaigroundEventQueue = window.PlaigroundEventQueue || []).push({ name: 'claim_pdf_downloaded', payload: {} });
      var bytes = api.pdfBytes(shown);
      var blob = new Blob([bytes], { type: 'application/pdf' });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = 'plaiground-authorship-' + (shown.id || 'record') + '.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    });
    var official = document.createElement('a');
    official.className = 'btn btn-ghost btn-md';
    official.textContent = 'Make it official';
    official.setAttribute('href', api.officialHref(shown));
    actions.appendChild(download);
    actions.appendChild(official);
    view.appendChild(actions);
  }

  function pickSong(songs, id) {
    var rows = Array.isArray(songs) ? songs : [];
    var match = null;
    rows.forEach(function (song) {
      if (match || !song || !song.claim) return;
      if (!id || song.claim.id === id) match = song;
    });
    return match;
  }

  function load() {
    var id = selectedId();
    var pending = window.PlaigroundLyricsAccount && window.PlaigroundLyricsAccount.readPending
      ? window.PlaigroundLyricsAccount.readPending()
      : null;
    return fetch('/api/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } }).then(function (meRes) {
      return meRes.json().catch(function () { return {}; }).then(function (me) {
        var name = me && (me.artist || me.username) ? String(me.artist || me.username) : '';
        return fetch('/api/me/lyrics', { credentials: 'same-origin', headers: { Accept: 'application/json' } }).then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (data) {
            var song = res.ok ? pickSong(data.songs, id) : null;
            if (song && song.claim) {
              render(song.claim, name);
              return;
            }
            if (pending && pending.claim && (!id || pending.claim.id === id)) {
              render(pending.claim, name);
              var note = text('p', 'claim-note', 'This record is still on this device. The account save did not go through yet.');
              view.appendChild(note);
              return;
            }
            showStatus('That record is not on this account yet.');
          });
        });
      });
    }).catch(function () {
      if (pending && pending.claim) {
        render(pending.claim, '');
        return;
      }
      showStatus('Your record did not load. Try again in a moment.');
    });
  }

  function boot() {
    var account = window.PlaigroundLyricsAccount;
    var claim = account && account.claim ? account.claim() : Promise.resolve(null);
    claim.then(function () { return load(); }, function () { return load(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
