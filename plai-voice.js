/* PLACEHOLDER mouth.
   Hear Plai uses browser speechSynthesis only. Sound stays off until the visitor opts in.
   Boundary events pulse a CSS waveform in place of a real mouth.
   Replace this module later with a lip-synced video of Plai. Keep the same speak/stop/supported names. */
(function (root) {
  'use strict';

  function synth() {
    return root.speechSynthesis || null;
  }

  function supported() {
    return !!(synth() && root.SpeechSynthesisUtterance);
  }

  function stop() {
    var voice = synth();
    if (voice && voice.cancel) voice.cancel();
  }

  function speak(text, hooks) {
    var voice = synth();
    if (!supported()) return false;
    var line = String(text || '').replace(/\s+/g, ' ').trim();
    if (!line) return false;
    stop();
    var uttered = new root.SpeechSynthesisUtterance(line);
    uttered.rate = 1;
    uttered.onboundary = function () {
      if (hooks && hooks.onBoundary) hooks.onBoundary();
    };
    uttered.onend = function () {
      if (hooks && hooks.onEnd) hooks.onEnd();
    };
    uttered.onerror = function () {
      if (hooks && hooks.onEnd) hooks.onEnd();
    };
    voice.speak(uttered);
    return true;
  }

  root.PlaigroundPlaiVoice = { speak: speak, stop: stop, supported: supported };
})(typeof window !== 'undefined' ? window : globalThis);
