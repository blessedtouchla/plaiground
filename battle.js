(function () {
  var core = window.BattleCore;
  var song = window.SongHelperCore;
  if (!core) return;

  var state = {
    rounds: 3,
    vibe: 'friendly',
    topic: '',
    starter: 'human',
    name: '',
    voice: '',
    beat: '',
    energy: '',
    instruments: [],
    verses: [],
    variant: 0,
    busy: false,
    notice: '',
    attribution: '',
    started: false,
  };
  var generation = 0;

  var form = document.getElementById('bt-form');
  if (!form) return;

  function $(id) { return document.getElementById(id); }

  function showError(message) {
    var el = $('bt-error');
    if (!el) return;
    if (!message) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    el.hidden = false;
    el.textContent = message;
  }

  function showSetupError(message) {
    var el = $('bt-setup-error');
    if (!el) return;
    if (!message) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    el.hidden = false;
    el.textContent = message;
  }

  function chipValue(group, fallback) {
    var selected = document.querySelector('[data-group="' + group + '"].on');
    return (selected && selected.getAttribute('data-value')) || fallback;
  }

  function setPressed(group, value) {
    document.querySelectorAll('[data-group="' + group + '"]').forEach(function (btn) {
      var on = btn.getAttribute('data-value') === value;
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function readSetup() {
    state.rounds = Number(chipValue('rounds', '3'));
    state.vibe = chipValue('vibe', 'friendly');
    state.starter = chipValue('starter', 'human');
    state.topic = $('bt-topic').value.trim();
    state.name = $('bt-name').value.trim();
    state.voice = chipValue('voice', '');
    state.beat = chipValue('beat', '');
    state.energy = chipValue('energy', '');
    state.instruments = [];
    document.querySelectorAll('[data-group="instrument"].on').forEach(function (btn) {
      if (state.instruments.length >= 3) return;
      state.instruments.push(btn.getAttribute('data-value'));
    });
  }

  function lastVerse() {
    return state.verses.length ? state.verses[state.verses.length - 1] : null;
  }

  function copyPlain(text, button) {
    function done() {
      var previous = button.textContent;
      button.textContent = 'Copied';
      setTimeout(function () { button.textContent = previous; }, 1400);
    }
    function fallbackCopy() {
      var area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'absolute';
      area.style.left = '-9999px';
      document.body.appendChild(area);
      area.select();
      try { document.execCommand('copy'); } catch (err) {}
      area.remove();
      done();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(fallbackCopy);
      return;
    }
    fallbackCopy();
  }

  function renderThread() {
    var host = $('bt-thread');
    host.textContent = '';
    if (!state.verses.length) {
      var empty = document.createElement('p');
      empty.className = 'sh-help';
      empty.textContent = state.starter === 'ai'
        ? 'The opening verse shows up here. Then you answer it.'
        : 'Your verse shows up here, then the reply under it.';
      host.appendChild(empty);
      return;
    }
    state.verses.forEach(function (verse) {
      var card = document.createElement('article');
      card.className = 'bt-turn is-' + (verse.role === 'ai' ? 'ai' : 'human');
      var who = document.createElement('p');
      who.className = 'bt-who';
      who.textContent = verse.role === 'ai' ? 'AI' : 'Human';
      var body = document.createElement('p');
      body.className = 'bt-verse';
      body.textContent = verse.text;
      card.appendChild(who);
      card.appendChild(body);
      host.appendChild(card);
    });
  }

  function renderExport() {
    var box = $('bt-export');
    var ready = core.exportReady(state.verses);
    box.hidden = !ready;
    if (!ready) return;
    var text = core.formatSunoLyrics(state.verses, {
      intro: $('bt-intro').checked,
      outro: $('bt-outro').checked,
    });
    $('bt-suno').value = text;
    var limit = core.SUNO_CHAR_LIMIT || 3000;
    var warn = $('bt-suno-warn');
    if (text.length > limit) {
      warn.hidden = false;
      warn.textContent = 'This is ' + text.length.toLocaleString('en-US') + ' characters. Suno works best under about ' + limit.toLocaleString('en-US') + '.';
    } else {
      warn.hidden = true;
      warn.textContent = '';
    }
    var style = core.buildStylePrompt(state.vibe, {
      voice: state.voice,
      beat: state.beat,
      energy: state.energy,
      instruments: state.instruments,
    });
    $('bt-style').value = style.prompt;
    $('bt-style-note').hidden = !style.note;
    $('bt-style-note').textContent = style.note || '';
    $('bt-credit').textContent = core.creditCounts(state.verses);
    var note = $('bt-export-note');
    note.textContent = core.battleFinished(state.verses, state.rounds)
      ? 'That is the last round. These lyrics are ready to paste.'
      : 'You can copy now, or keep trading until the last round.';
  }

  function render() {
    var finished = core.battleFinished(state.verses, state.rounds);
    var last = lastVerse();
    var needOpener = state.starter === 'ai' && !state.verses.length && !state.busy;
    var waitingOnHuman = !finished && !state.busy && !needOpener && (!last || last.role === 'ai');
    var replyMissing = !finished && !state.busy && last && last.role === 'human';
    $('bt-setup').hidden = state.started;
    $('bt-battle').hidden = !state.started;
    $('bt-shell').classList.toggle('is-compact', state.started);
    var banner = $('bt-banner');
    banner.hidden = !state.notice;
    banner.textContent = state.notice || '';
    var attr = $('bt-attr');
    attr.hidden = !state.attribution;
    attr.textContent = state.attribution || '';
    var status = $('bt-status');
    if (state.busy) status.textContent = 'Writing the next verse…';
    else if (finished) status.textContent = 'That is the last round. Copy the lyrics when you want the song.';
    else if (replyMissing) status.textContent = 'The reply did not come back yet.';
    else if (needOpener) status.textContent = 'The opening verse comes first.';
    else status.textContent = 'Your turn. Edit the verse, then send it.';
    $('bt-composer').hidden = !waitingOnHuman;
    if ($('bt-hint')) $('bt-hint').hidden = !waitingOnHuman;
    $('bt-open').hidden = !needOpener;
    $('bt-send').hidden = !waitingOnHuman;
    $('bt-retry').hidden = !replyMissing;
    $('bt-edit').hidden = !replyMissing;
    $('bt-undo').hidden = !(last && last.role === 'ai');
    $('bt-regen').hidden = !(last && last.role === 'ai');
    $('bt-open').disabled = state.busy;
    $('bt-send').disabled = state.busy;
    $('bt-retry').disabled = state.busy;
    $('bt-edit').disabled = state.busy;
    $('bt-undo').disabled = state.busy;
    $('bt-regen').disabled = state.busy;
    $('bt-start').disabled = state.busy;
    renderThread();
    renderExport();
  }

  function payload(transcript) {
    return {
      rounds: state.rounds,
      vibe: state.vibe,
      topic: state.topic,
      starter: state.starter,
      name: state.name,
      voice: state.voice,
      beat: state.beat,
      energy: state.energy,
      instruments: state.instruments,
      variant: state.variant,
      transcript: transcript.map(function (verse) {
        return { role: verse.role, text: verse.text, preview: Boolean(verse.preview) };
      }),
      company_website: $('bt-honey').value,
    };
  }

  async function fetchReply(replace) {
    if (state.busy) return;
    var gen = generation;
    state.busy = true;
    showError('');
    render();
    var transcript = replace ? core.withoutLastReply(state.verses) : state.verses.slice();
    try {
      var response = await fetch('/api/battle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload(transcript)),
      });
      var data = await response.json().catch(function () { return {}; });
      if (gen !== generation) return;
      if (!response.ok || !data.ok || !data.verse) {
        showError(data.error || 'The reply did not come back. Try again in a moment.');
        return;
      }
      var next = { role: 'ai', text: data.verse, preview: Boolean(data.preview) };
      if (replace && state.verses.length && state.verses[state.verses.length - 1].role === 'ai') {
        state.verses[state.verses.length - 1] = next;
      } else {
        state.verses.push(next);
      }
      state.notice = data.notice || '';
      state.attribution = data.attribution || '';
      showError('');
    } catch (err) {
      if (gen !== generation) return;
      showError('The reply did not come back. Check the connection and try again.');
    } finally {
      if (gen !== generation) return;
      state.busy = false;
      render();
      var verseBox = $('bt-verse');
      if (verseBox && !$('bt-composer').hidden) {
        try { verseBox.focus(); } catch (err) {}
      }
    }
  }

  function sendVerse() {
    if (state.busy) return;
    var text = $('bt-verse').value.replace(/\r\n/g, '\n').trim();
    if (!text) {
      showError('Write a verse first.');
      return;
    }
    state.verses.push({ role: 'human', text: text, preview: false });
    $('bt-verse').value = '';
    fetchReply(false);
  }

  function editLastHuman() {
    var last = lastVerse();
    if (!last || last.role !== 'human' || state.busy) return;
    state.verses.pop();
    $('bt-verse').value = last.text;
    showError('');
    render();
    try { $('bt-verse').focus(); } catch (err) {}
  }

  function undo() {
    if (state.busy || !lastVerse() || lastVerse().role !== 'ai') return;
    var composer = $('bt-verse').value.trim();
    if (composer && !window.confirm('Undo puts your last verse back in the box. The text you have not sent will be replaced.')) return;
    var result = core.undoLastReply(state.verses);
    state.verses = result.verses;
    if (result.restored) $('bt-verse').value = result.restored;
    state.notice = state.verses.some(function (verse) { return verse.preview; }) ? state.notice : '';
    if (!state.verses.some(function (verse) { return verse.role === 'ai' && !verse.preview; })) {
      state.attribution = '';
    }
    showError('');
    render();
  }

  function saveHelperSession() {
    if (!song || !song.SESSION_KEY) return;
    var prev = {};
    try { prev = JSON.parse(sessionStorage.getItem(song.SESSION_KEY) || '{}') || {}; } catch (err) { prev = {}; }
    var payloadSession = core.helperSession({
      verses: state.verses,
      topic: state.topic,
      name: state.name,
      vibe: state.vibe,
    });
    if (prev.cover) payloadSession.cover = prev.cover;
    if (prev.coverSessionId) payloadSession.coverSessionId = prev.coverSessionId;
    try { sessionStorage.setItem(song.SESSION_KEY, JSON.stringify(payloadSession)); } catch (err) {}
  }

  form.addEventListener('submit', function (event) { event.preventDefault(); });
  form.addEventListener('click', function (event) {
    var chip = event.target.closest ? event.target.closest('.sh-chip') : null;
    if (!chip || state.started) return;
    var group = chip.getAttribute('data-group');
    if (!group) return;
    showSetupError('');
    if (group === 'instrument') {
      var turningOn = !chip.classList.contains('on');
      if (turningOn && document.querySelectorAll('[data-group="instrument"].on').length >= 3) return;
      chip.classList.toggle('on', turningOn);
      chip.setAttribute('aria-pressed', turningOn ? 'true' : 'false');
      return;
    }
    setPressed(group, chip.getAttribute('data-value'));
  });

  if ($('bt-more')) {
    $('bt-more').addEventListener('click', function () {
      var panel = $('bt-more-panel');
      if (!panel) return;
      var open = panel.hidden;
      panel.hidden = !open;
      $('bt-more').setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  $('bt-start').addEventListener('click', function () {
    if (state.busy) return;
    readSetup();
    if (state.voice !== 'girl' && state.voice !== 'boy') {
      showSetupError('Pick boy or girl so the vocal is not guessed.');
      return;
    }
    showSetupError('');
    state.started = true;
    state.verses = [];
    state.variant = 0;
    state.notice = '';
    state.attribution = '';
    showError('');
    render();
    if (state.starter === 'ai') fetchReply(false);
    else {
      try { $('bt-verse').focus(); } catch (err) {}
    }
  });

  $('bt-open').addEventListener('click', function () { fetchReply(false); });
  $('bt-send').addEventListener('click', sendVerse);
  $('bt-retry').addEventListener('click', function () { fetchReply(false); });
  $('bt-edit').addEventListener('click', editLastHuman);
  $('bt-undo').addEventListener('click', undo);
  $('bt-regen').addEventListener('click', function () {
    if (state.busy) return;
    state.variant += 1;
    fetchReply(true);
  });
  $('bt-restart').addEventListener('click', function () {
    if (state.verses.length && !window.confirm('Start over? This battle stays in this tab only, so the verses here will clear.')) return;
    generation += 1;
    state.busy = false;
    state.started = false;
    state.verses = [];
    state.variant = 0;
    state.notice = '';
    state.attribution = '';
    $('bt-verse').value = '';
    showError('');
    render();
  });
  $('bt-intro').addEventListener('change', renderExport);
  $('bt-outro').addEventListener('change', renderExport);
  $('bt-suno-copy').addEventListener('click', function () {
    renderExport();
    var text = $('bt-suno').value;
    if (!text) return;
    copyPlain(text, $('bt-suno-copy'));
  });
  $('bt-style-copy').addEventListener('click', function () {
    var text = $('bt-style').value;
    if (!text) return;
    copyPlain(text, $('bt-style-copy'));
  });
  $('bt-helper').addEventListener('click', function (event) {
    event.preventDefault();
    saveHelperSession();
    window.location.href = '/song-helper?from=battle';
  });
  $('bt-cover').addEventListener('click', function (event) {
    event.preventDefault();
    saveHelperSession();
    window.location.href = '/cover-art';
  });

  render();
}());
