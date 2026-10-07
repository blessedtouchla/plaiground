(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SunoStyle = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  // Current style box is 1000 characters. Older boxes stop at 200.
  // Stay at 200 so the prompt fits either box.
  var LIMIT = 200;
  var VOCALS = [
    { id: 'female', label: 'Female' },
    { id: 'male', label: 'Male' },
    { id: 'duet', label: 'Duet' }
  ];
  var TEMPOS = [
    { id: 'slow', label: 'Slow' },
    { id: 'mid', label: 'Mid' },
    { id: 'fast', label: 'Fast' }
  ];
  var GENRES = ['R&B', 'Pop', 'Hip-hop', 'Country', 'Latin', 'Rock', 'Afrobeats', 'Gospel', 'Lo-fi'];
  var POOL = ['piano', 'electric piano', 'acoustic guitar', 'electric guitar', '808s', 'live drums', 'bass', 'synth', 'strings'];
  var TEMPO_FROM_ENERGY = { low: 'slow', medium: 'mid', high: 'fast', building: 'mid' };
  var ENERGY_FROM_TEMPO = { slow: 'low', mid: 'medium', fast: 'high' };
  var UP = { low: 'medium', medium: 'high', building: 'high', high: 'high' };
  var DOWN = { high: 'medium', building: 'medium', medium: 'low', low: 'low' };

  function clip(value, max) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max || 80);
  }

  function copyBag(bag) {
    var src = bag || {};
    var region = clip(src.region, 40);
    if (/^no region$/i.test(region)) region = '';
    return {
      genre: clip(src.genre, 40),
      mood: clip(src.mood, 40),
      region: region,
      energy: clip(src.energy, 20),
      tempo: clip(src.tempo, 20),
      vocal: clip(src.vocal, 20),
      texture: clip(src.texture, 20),
      era: clip(src.era, 20),
      instruments: (Array.isArray(src.instruments) ? src.instruments : []).map(function (item) {
        return clip(item, 40);
      }).filter(Boolean).slice(0, 4)
    };
  }

  function missing(bag) {
    var data = copyBag(bag);
    var asks = [];
    if (!data.genre) {
      asks.push({
        id: 'genre',
        ask: 'What genre?',
        options: GENRES.map(function (name) { return { id: name, label: name }; })
      });
    }
    if (!data.vocal) {
      asks.push({ id: 'vocal', ask: 'What vocal?', options: VOCALS });
    }
    if (!data.tempo && !data.energy) {
      asks.push({ id: 'tempo', ask: 'Slow, mid, or fast?', options: TEMPOS });
    }
    return asks.slice(0, 2);
  }

  function applyAnswers(bag, extra) {
    var next = copyBag(bag);
    var add = extra || {};
    if (add.genre) next.genre = clip(add.genre, 40);
    if (add.vocal) next.vocal = clip(add.vocal, 20);
    if (add.tempo) {
      next.tempo = clip(add.tempo, 20);
      next.energy = ENERGY_FROM_TEMPO[next.tempo] || next.energy;
    }
    return next;
  }

  function cleaned(value, strip) {
    var text = clip(value, 80);
    if (!text || typeof strip !== 'function') return text;
    var out = strip(text);
    if (out && typeof out === 'object') return clip(out.text, 80);
    return clip(out, 80);
  }

  function tempoPhrase(data) {
    var tempo = data.tempo || TEMPO_FROM_ENERGY[data.energy] || '';
    if (tempo === 'slow') return 'slow tempo';
    if (tempo === 'mid') return 'mid tempo';
    if (tempo === 'fast') return 'fast tempo';
    return tempo;
  }

  function energyPhrase(energy) {
    if (!energy) return '';
    if (/energy/i.test(energy)) return energy;
    return energy + ' energy';
  }

  function vocalPhrase(data) {
    var bits = [data.texture, data.vocal].filter(Boolean).join(' ');
    if (!bits) return '';
    if (!/vocal/i.test(bits)) bits += ' vocal';
    return bits;
  }

  function prompt(bag, strip) {
    var data = copyBag(bag);
    var parts = [
      cleaned(data.genre, strip),
      cleaned(data.mood, strip),
      cleaned(data.instruments.join(', '), strip),
      cleaned(vocalPhrase(data), strip),
      cleaned(data.era, strip),
      cleaned(tempoPhrase(data), strip),
      cleaned(energyPhrase(data.energy), strip),
      cleaned(data.region ? data.region + ' feel' : '', strip)
    ].filter(Boolean);
    var text = parts.join(', ');
    while (text.length > LIMIT && parts.length > 1) {
      parts.pop();
      text = parts.join(', ');
    }
    if (text.length > LIMIT) text = text.slice(0, LIMIT).replace(/,\s*[^,]*$/, '').trim();
    return text;
  }

  function tweak(bag, id) {
    var next = copyBag(bag);
    if (id === 'energy') {
      next.energy = UP[next.energy] || 'medium';
      next.tempo = TEMPO_FROM_ENERGY[next.energy] || next.tempo;
    }
    if (id === 'softer') {
      next.energy = DOWN[next.energy] || 'low';
      next.tempo = TEMPO_FROM_ENERGY[next.energy] || 'slow';
      if (!next.texture) next.texture = 'soft';
    }
    if (id === 'vocal') {
      var vocals = VOCALS.map(function (row) { return row.id; });
      var index = vocals.indexOf(next.vocal);
      next.vocal = vocals[(index + 1) % vocals.length];
    }
    if (id === 'instruments') {
      var add = POOL.filter(function (name) { return next.instruments.indexOf(name) === -1; })[0];
      if (add && next.instruments.length < 4) next.instruments.push(add);
    }
    return next;
  }

  function copyText(text, button) {
    function done() {
      var previous = button.textContent;
      button.textContent = 'Copied';
      setTimeout(function () { button.textContent = previous; }, 1400);
      var host = typeof window !== 'undefined' ? window : null;
      if (!host) return;
      (host.PlaigroundEventQueue = host.PlaigroundEventQueue || []).push({ name: 'song_helper_style_copied', payload: {} });
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () {
        fallback(text);
        done();
      });
      return;
    }
    fallback(text);
    done();
  }

  function fallback(text) {
    if (typeof document === 'undefined') return;
    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'absolute';
    area.style.left = '-9999px';
    document.body.appendChild(area);
    area.select();
    try { document.execCommand('copy'); } catch (err) {}
    area.remove();
  }

  function renderAsk(host, asks, onUse) {
    if (!host) return;
    host.hidden = false;
    host.textContent = '';
    var chosen = {};
    (asks || []).forEach(function (ask) {
      var title = document.createElement('p');
      title.className = 'sh-answers-title';
      title.textContent = ask.ask;
      host.appendChild(title);
      var row = document.createElement('div');
      row.className = 'sh-chips';
      (ask.options || []).forEach(function (opt) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'sh-chip';
        button.textContent = opt.label;
        button.setAttribute('aria-pressed', 'false');
        button.addEventListener('click', function () {
          var turningOff = button.classList.contains('on');
          if (turningOff) delete chosen[ask.id];
          else chosen[ask.id] = opt.id;
          row.querySelectorAll('.sh-chip').forEach(function (chip) {
            var on = !turningOff && chip === button;
            chip.classList.toggle('on', on);
            chip.setAttribute('aria-pressed', on ? 'true' : 'false');
          });
        });
        row.appendChild(button);
      });
      host.appendChild(row);
    });
    var use = document.createElement('button');
    use.type = 'button';
    use.className = 'btn btn-purple btn-md';
    use.textContent = 'Use these';
    use.addEventListener('click', function () { if (onUse) onUse(chosen); });
    host.appendChild(use);
  }

  function renderPrompt(host, text, onTweak) {
    if (!host) return;
    host.hidden = false;
    host.textContent = '';
    var title = document.createElement('p');
    title.className = 'sh-answers-title';
    title.textContent = 'Your style prompt';
    host.appendChild(title);
    var box = document.createElement('textarea');
    box.className = 'sh-style-box';
    box.readOnly = true;
    box.rows = 3;
    box.value = text || '';
    box.setAttribute('aria-label', 'Style prompt');
    host.appendChild(box);
    var copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'btn btn-ghost btn-md';
    copy.textContent = 'Copy';
    copy.addEventListener('click', function () { copyText(box.value, copy); });
    host.appendChild(copy);
    var tweakTitle = document.createElement('p');
    tweakTitle.className = 'sh-answers-title';
    tweakTitle.textContent = 'Tweak it';
    host.appendChild(tweakTitle);
    var row = document.createElement('div');
    row.className = 'sh-chips';
    [
      { id: 'energy', label: 'More energy' },
      { id: 'softer', label: 'Softer' },
      { id: 'vocal', label: 'Different vocal' },
      { id: 'instruments', label: 'More instruments' }
    ].forEach(function (chip) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'sh-chip';
      button.textContent = chip.label;
      button.addEventListener('click', function () { if (onTweak) onTweak(chip.id); });
      row.appendChild(button);
    });
    host.appendChild(row);
  }

  return {
    LIMIT: LIMIT,
    missing: missing,
    applyAnswers: applyAnswers,
    prompt: prompt,
    tweak: tweak,
    renderAsk: renderAsk,
    renderPrompt: renderPrompt
  };
});
