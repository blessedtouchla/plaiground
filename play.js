/**
 * One shared hook game. No account. Words fall, or sit still when motion is reduced.
 */
(function (root) {
  var state = {
    slug: '',
    game: null,
    level: 1,
    next: 0,
    score: 0,
    combo: 0,
    hearts: 3,
    done: false,
    played: false,
    toBeat: 0,
  };

  function $(sel) {
    return root.document.querySelector(sel);
  }

  function reduced() {
    return root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function slugFromLocation() {
    var params;
    try { params = new URLSearchParams(root.location.search || ''); } catch (err) { params = new URLSearchParams(); }
    var slug = params.get('song') || params.get('slug') || '';
    if (!slug && root.location && root.location.pathname) {
      var parts = String(root.location.pathname).split('/').filter(Boolean);
      if (parts[0] === 'play' && parts[1] && parts[1] !== 'play.html') slug = decodeURIComponent(parts[1]);
    }
    return slug;
  }

  function fanId() {
    var key = 'plaiground.stage.fan';
    try {
      var existing = root.localStorage.getItem(key) || '';
      existing = existing.replace(/[^a-zA-Z0-9]/g, '').slice(0, 40);
      if (existing) return existing;
      var next = 'fan' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      root.localStorage.setItem(key, next);
      return next;
    } catch (err) {
      return '';
    }
  }

  function scoreTools() {
    return root.PlaigroundSongGame || null;
  }

  function formatScore(value) {
    var tools = scoreTools();
    if (tools && tools.formatScore) return tools.formatScore(value);
    var num = Math.max(0, Math.min(100000, Math.round(Number(value) || 0)));
    return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function playerName() {
    var input = $('[data-player-name]');
    var tools = scoreTools();
    var raw = input ? input.value : '';
    if (tools && tools.challengeName) return tools.challengeName(raw);
    var name = String(raw || '').replace(/[^A-Za-z0-9 .'-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
    return name || 'Friend';
  }

  function shareUrl() {
    var origin = root.location && root.location.origin ? root.location.origin : '';
    var hash = 'score=' + encodeURIComponent(String(state.score || 0)) + '&name=' + encodeURIComponent(playerName());
    return origin + '/play/' + encodeURIComponent(state.slug) + '#' + hash;
  }

  function currentLevel() {
    var levels = state.game && Array.isArray(state.game.levels) ? state.game.levels : [];
    var found = null;
    levels.forEach(function (level) {
      if (Number(level.id) === state.level) found = level;
    });
    if (found && found.words && found.words.length) return found;
    return {
      id: 1,
      label: 'Level 1',
      name: 'The hook',
      words: state.game.hookWords || [],
      wordLines: state.game.wordLines || [],
      lines: state.game.hookLines || [],
      hook: state.game.hook || '',
      decoys: state.game.decoys || [],
    };
  }

  function paintHud() {
    var score = $('[data-score]');
    var combo = $('[data-combo]');
    var hearts = $('[data-hearts]');
    if (score) score.textContent = 'Score ' + state.score;
    if (combo) combo.textContent = 'Combo ' + state.combo;
    if (hearts) hearts.textContent = 'Hearts ' + (state.hearts > 0 ? new Array(state.hearts + 1).join('♥') : 'none');
  }

  function postEvent(event, extra) {
    if (!state.slug) return;
    root.fetch('/api/play', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        slug: state.slug,
        event: event,
        score: extra && extra.score || state.score,
        line: extra && extra.line || '',
        level: state.level,
        fan: fanId(),
      }),
    }).catch(function () {});
  }

  function lineFor(index) {
    var level = currentLevel();
    var lines = level.wordLines || [];
    if (lines[index]) return lines[index];
    return level.lines && level.lines[0] ? level.lines[0] : '';
  }

  function paintLevel() {
    var level = currentLevel();
    var label = $('[data-level]');
    if (label) label.textContent = (level.label || 'Level 1') + '. ' + (level.name || 'The hook');
    var buttons = root.document.querySelectorAll('[data-level-pick]');
    Array.prototype.forEach.call(buttons, function (button) {
      var on = Number(button.getAttribute('data-level-pick')) === state.level;
      button.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function finish() {
    state.done = true;
    state.toBeat = Math.max(state.toBeat || 0, state.score);
    var level = currentLevel();
    var panel = $('[data-play-done]');
    var hook = $('[data-hook]');
    var scoreLine = $('[data-level-score]');
    var next = $('[data-next-level]');
    if (hook) hook.textContent = level.hook || (level.words || []).join(' ');
    if (scoreLine) scoreLine.textContent = (level.label || 'Level 1') + ' score ' + formatScore(state.score);
    if (next) {
      var upcoming = state.level < 3;
      next.hidden = !upcoming;
      if (upcoming) next.textContent = state.level === 1 ? 'Play level 2' : 'Play level 3';
    }
    if (panel) panel.hidden = false;
    postEvent('finish', { score: state.score });
  }

  function fail() {
    state.done = true;
    var panel = $('[data-play-fail]');
    if (panel) panel.hidden = false;
  }

  function onTap(piece, el) {
    if (state.done || piece.used) return;
    if (piece.kind === 'hook' && piece.index === state.next) {
      piece.used = true;
      el.disabled = true;
      el.classList.add('is-caught');
      state.next += 1;
      state.combo += 1;
      state.score += 50 * state.combo;
      paintHud();
      if (state.next >= currentLevel().words.length) finish();
      return;
    }
    state.combo = 0;
    state.hearts -= 1;
    el.classList.add('is-miss');
    root.setTimeout(function () { el.classList.remove('is-miss'); }, reduced() ? 0 : 280);
    paintHud();
    postEvent('miss', { line: lineFor(state.next) });
    if (state.hearts <= 0) fail();
  }

  function shuffle(list) {
    var arr = list.slice();
    var n = 17;
    for (var i = 0; i < state.slug.length; i += 1) n += state.slug.charCodeAt(i);
    for (var j = arr.length - 1; j > 0; j -= 1) {
      n = (n * 9301 + 49297) % 233280;
      var k = n % (j + 1);
      var tmp = arr[j];
      arr[j] = arr[k];
      arr[k] = tmp;
    }
    return arr;
  }

  function paintWords() {
    var sky = $('[data-sky]');
    if (!sky) return;
    sky.textContent = '';
    var still = reduced();
    sky.classList.toggle('is-still', still);
    var pieces = [];
    var level = currentLevel();
    (level.words || []).forEach(function (word, index) {
      pieces.push({ text: word, kind: 'hook', index: index, used: false });
    });
    (level.decoys || state.game.decoys || []).forEach(function (word, index) {
      pieces.push({ text: word, kind: 'decoy', index: index, used: false });
    });
    shuffle(pieces).forEach(function (piece, index) {
      var el = root.document.createElement('button');
      el.type = 'button';
      el.className = 'play-word' + (piece.kind === 'decoy' ? ' is-decoy' : '');
      el.textContent = piece.text;
      el.setAttribute('data-play-word', piece.kind);
      el.setAttribute('data-word-index', String(piece.index));
      if (!still) {
        el.style.left = (8 + ((index * 17) % 72)) + '%';
        el.style.animationDuration = (7 + (index % 4)) + 's';
        el.style.animationDelay = (-1 * (index % 5)) + 's';
      }
      el.addEventListener('click', function () { onTap(piece, el); });
      sky.appendChild(el);
    });
  }

  function paintHeader(payload) {
    var artist = payload.artist || {};
    var colors = Array.isArray(artist.colors) && artist.colors.length ? artist.colors : (payload.game.colors || ['#7D3CFF', '#FF3C8E', '#F5C542']);
    var head = $('[data-play-head]');
    var photo = $('[data-play-photo]');
    var name = $('[data-play-artist]');
    var title = $('[data-play-title]');
    if (name) name.textContent = artist.name || 'Artist';
    if (title) title.textContent = payload.game.title || 'Untitled';
    if (photo) {
      if (artist.photo) {
        photo.hidden = false;
        photo.style.backgroundImage = 'url(' + JSON.stringify(artist.photo) + ')';
      } else {
        photo.hidden = true;
      }
    }
    if (head) {
      if (artist.photo) {
        head.style.backgroundImage = 'linear-gradient(90deg, rgba(0,0,0,0.62), rgba(0,0,0,0.28)), url(' + JSON.stringify(artist.photo) + ')';
        head.style.backgroundSize = 'cover';
        head.style.backgroundPosition = 'center';
      } else {
        head.style.background = 'linear-gradient(120deg, ' + colors[0] + ', ' + (colors[1] || colors[0]) + ' 70%, ' + (colors[2] || '#F5C542') + ')';
      }
    }
  }

  function resetRound() {
    state.next = 0;
    state.score = 0;
    state.combo = 0;
    state.hearts = 3;
    state.done = false;
    var done = $('[data-play-done]');
    var fail = $('[data-play-fail]');
    if (done) done.hidden = true;
    if (fail) fail.hidden = true;
    paintLevel();
    paintHud();
    paintWords();
  }

  function playAgain() {
    var target = state.toBeat || state.score;
    resetRound();
    var line = $('[data-your-score]');
    if (line) {
      line.hidden = false;
      line.textContent = 'Beat your score: ' + formatScore(target);
    }
  }

  function pickLevel(level) {
    state.level = level;
    var line = $('[data-your-score]');
    if (line) line.hidden = true;
    resetRound();
  }

  function showError(message) {
    var status = $('[data-play-status]');
    if (status) status.textContent = message;
  }

  function bindShare() {
    var share = $('[data-share]');
    var note = $('[data-share-note]');
    if (!share) return;
    share.addEventListener('click', function () {
      var url = shareUrl();
      var done = function () {
        if (note) {
          note.hidden = false;
          note.textContent = 'Link copied. Send it to a friend.';
        }
      };
      if (root.navigator && root.navigator.share) {
        root.navigator.share({ title: state.game && state.game.title, url: url }).then(done).catch(function () {
          if (root.navigator.clipboard && root.navigator.clipboard.writeText) {
            root.navigator.clipboard.writeText(url).then(done).catch(done);
          } else done();
        });
        return;
      }
      if (root.navigator && root.navigator.clipboard && root.navigator.clipboard.writeText) {
        root.navigator.clipboard.writeText(url).then(done).catch(done);
        return;
      }
      done();
    });
  }

  function showChallenge() {
    var banner = $('[data-challenge]');
    if (!banner) return;
    var hash = String(root.location.hash || '').replace(/^#/, '');
    var params;
    try { params = new URLSearchParams(hash); } catch (err) { params = new URLSearchParams(); }
    var score = params.get('score');
    if (!score) return;
    var tools = scoreTools();
    banner.hidden = false;
    banner.textContent = tools && tools.challengeLine
      ? tools.challengeLine(params.get('name'), score)
      : 'Beat ' + playerName() + "'s score: " + formatScore(score);
  }

  function showStageNote(note) {
    var banner = $('[data-stage-note]');
    if (!banner || !note) return;
    banner.hidden = false;
    banner.textContent = note;
  }

  function paintLevelPicks() {
    var host = $('[data-levels]');
    if (!host) return;
    host.textContent = '';
    var levels = state.game && state.game.levels && state.game.levels.length
      ? state.game.levels
      : [{ id: 1, label: 'Level 1', name: 'The hook' }];
    levels.forEach(function (level) {
      var button = root.document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-ghost btn-sm';
      button.setAttribute('data-level-pick', String(level.id));
      button.textContent = (level.label || 'Level') + ' ' + (level.name || '');
      button.addEventListener('click', function () { pickLevel(Number(level.id) || 1); });
      host.appendChild(button);
    });
  }

  function start(payload) {
    state.game = payload.game;
    state.level = 1;
    paintHeader(payload);
    paintLevelPicks();
    showChallenge();
    showStageNote(payload.note);
    paintLevel();
    paintHud();
    paintWords();
    bindShare();
    var again = $('[data-try-again]');
    if (again) again.addEventListener('click', resetRound);
    var replay = $('[data-play-again]');
    if (replay) replay.addEventListener('click', playAgain);
    var next = $('[data-next-level]');
    if (next) next.addEventListener('click', function () { pickLevel(Math.min(3, state.level + 1)); });
    if (!state.played) {
      state.played = true;
      postEvent('play', {});
    }
  }

  function boot() {
    if (root.PlaigroundFeatures && !root.PlaigroundFeatures.enabled('SONG_GAME_ENABLED')) {
      showError('This game is turned off right now.');
      return;
    }
    state.slug = slugFromLocation();
    if (!state.slug) {
      showError('This game is not ready yet.');
      return;
    }
    root.fetch('/api/play?slug=' + encodeURIComponent(state.slug) + '&fan=' + encodeURIComponent(fanId()) + '&surface=play', { headers: { Accept: 'application/json' } })
      .then(function (response) {
        return response.json().then(function (data) {
          return { ok: response.ok, data: data || {} };
        });
      })
      .then(function (result) {
        if (!result.ok || !result.data.game) {
          showError((result.data && result.data.error) || 'This game is not ready yet.');
          return;
        }
        var status = $('[data-play-status]');
        if (status) status.hidden = true;
        start(result.data);
      })
      .catch(function () {
        showError('This game is not ready yet.');
      });
  }

  if (root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
