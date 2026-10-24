(function () {
  // Template parts: strings are fixed text, objects are fill-ins.
  var T = [
    {k:'bpm',l:'BPM'}, ' BPM, ', {k:'key',l:'key/mode'}, ', ', {k:'feel',l:'feel: swung / straight / half-time',o:['swung','straight','half-time']},
    '. Analog tape saturation, dry close-mic drums, swung sixteenth-note hats, kick and bass locked, bass ducks under the vocal, no reverb tail on the lead. ',
    {k:'lead',l:'Lead instrument'}, ' played ', {k:'verb',l:'verb: plucked / bowed / stabbed / muted',o:['plucked','bowed','stabbed','muted']}, ', ',
    {k:'texture',l:"unusual texture: detuned, bit-crushed, room-mic'd"}, '. Intro: ', {k:'intro',l:'one element alone'},
    '. Verse: sparse, ', {k:'verse',l:'one element'}, ' carries it. Pre: drums thin, tension riser. Chorus: ', {k:'chorus',l:'new element enters'},
    ', vocals doubled. Breakdown: ', {k:'breakdown',l:'4 bars, drums out, one texture left'}, '. Last chorus: key lift or new countermelody. Ending: ',
    {k:'ending',l:'hard stop / single held note / tape slowdown',o:['hard stop','single held note','tape slowdown']}, '. Vocal: ',
    {k:'gender',l:'gender'}, ', ', {k:'age',l:'age'}, ', ', {k:'accent',l:'accent'}, ', ', {k:'grain',l:'grain: raspy / smoky / nasal / clear',o:['raspy','smoky','nasal','clear']}, ', ',
    {k:'delivery',l:'delivery: talk-sung / chanted / crooned',o:['talk-sung','chanted','crooned']},
    '. Not auto-tuned, not breathy pop-star, not belted, not generic. No country, no twang, no pedal steel, no Nashville, no stock four-chord loop, no EDM build-drop clich\u00e9.'
  ];
  var labels = {bpm:'BPM',key:'Key / mode',feel:'Feel',lead:'Lead instrument',verb:'Played how',texture:'Unusual texture',intro:'Intro: one element alone',verse:'Verse: what carries it',chorus:'Chorus: new element',breakdown:'Breakdown',ending:'Ending',gender:'Vocal gender',age:'Vocal age',accent:'Vocal accent',grain:'Vocal grain',delivery:'Vocal delivery'};
  var ph = {bpm:'92',key:'D minor',lead:'Nylon guitar',texture:'room-mic\'d',intro:'muted guitar alone',verse:'bass',chorus:'organ stabs',breakdown:'4 bars, drums out, tape hiss left',gender:'female',age:'late 30s',accent:'Southern California'};
  var $ = function (id) { return document.getElementById(id); };
  function esc(s){return s.replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];});}
  function build(vals, html) {
    return T.map(function (p) {
      if (typeof p === 'string') return html ? esc(p) : p;
      var v = (vals[p.k] || '').trim();
      var txt = v || '[' + p.l + ']';
      return html ? '<mark' + (v ? ' class="filled"' : '') + '>' + esc(txt) + '</mark>' : txt;
    }).join('');
  }
  function copy(text, btn) {
    var done = function () { var o = btn.textContent; btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = o; }, 1500); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    else fallback();
    function fallback(){var t=document.createElement('textarea');t.value=text;document.body.appendChild(t);t.select();try{document.execCommand('copy');done();}catch(e){}t.remove();}
  }
  var raw = build({}, false);
  $('spt-raw').innerHTML = build({}, true);
  $('spt-raw-count').textContent = 'The blank template is ' + raw.length + ' characters.';
  $('spt-copy-raw').addEventListener('click', function () { copy(raw, this); });
  var form = $('spt-form'), vals = {};
  T.forEach(function (p) {
    if (typeof p === 'string') return;
    var lab = document.createElement('label'); lab.textContent = labels[p.k];
    var el;
    if (p.o) { el = document.createElement('select'); el.innerHTML = '<option value="">Pick one</option>' + p.o.map(function (o) { return '<option>' + o + '</option>'; }).join(''); }
    else { el = document.createElement('input'); el.type = 'text'; el.placeholder = 'e.g. ' + (ph[p.k] || ''); if (p.k === 'bpm') el.inputMode = 'numeric'; }
    el.dataset.k = p.k; el.addEventListener('input', render); el.addEventListener('change', render);
    lab.appendChild(el); form.appendChild(lab);
  });
  function render() {
    form.querySelectorAll('[data-k]').forEach(function (el) { vals[el.dataset.k] = el.value; });
    $('spt-out').innerHTML = build(vals, true);
    var n = build(vals, false).length, c = $('spt-count');
    c.textContent = n + ' / 1000 characters' + (n > 1000 ? ', trim it down' : '');
    c.classList.toggle('over', n > 1000);
  }
  $('spt-copy').addEventListener('click', function () { copy(build(vals, false), this); });
  $('spt-reset').addEventListener('click', function () { form.querySelectorAll('[data-k]').forEach(function (el) { el.value = ''; }); render(); });
  render();
})();
