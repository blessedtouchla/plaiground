// Plai reads the summary aloud with the browser's own speech engine. No server call.
(function () {
  var play = document.querySelector('[data-hw-play]');
  var stop = document.querySelector('[data-hw-stop]');
  var text = document.querySelector('[data-hw-summary]');
  if (!play || !text) return;
  if (!('speechSynthesis' in window)) { play.hidden = true; return; }
  var synth = window.speechSynthesis;
  var state = 'idle';
  function setUi() {
    play.innerHTML = state === 'playing' ? '&#10074;&#10074; Pause' : (state === 'paused' ? '&#9654; Resume' : '&#9654; Play');
    stop.hidden = state === 'idle';
  }
  play.addEventListener('click', function () {
    if (state === 'playing') { synth.pause(); state = 'paused'; setUi(); return; }
    if (state === 'paused') { synth.resume(); state = 'playing'; setUi(); return; }
    synth.cancel();
    var u = new SpeechSynthesisUtterance(text.textContent.trim());
    u.rate = 1; u.pitch = 1.05;
    var voices = synth.getVoices().filter(function (v) { return /^en/i.test(v.lang); });
    if (voices.length) u.voice = voices[0];
    u.onend = u.onerror = function () { state = 'idle'; setUi(); };
    synth.speak(u); state = 'playing'; setUi();
  });
  stop.addEventListener('click', function () { synth.cancel(); state = 'idle'; setUi(); });
  window.addEventListener('pagehide', function () { synth.cancel(); });
})();
