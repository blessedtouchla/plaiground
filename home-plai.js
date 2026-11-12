/* Signed-out homepage host. Plai poses are the existing Song Lab files. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) api.mount(root.document, root);
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var POSES = {
    hello: '/for-david-fv/img/plai-hello.webp',
    thinking: '/for-david-fv/img/plai-thinking.webp',
    gotit: '/for-david-fv/img/plai-gotit.webp',
    dancing: '/for-david-fv/img/plai-dancing.webp'
  };

  var ANSWERS = {
    write: {
      id: 'write',
      pose: 'dancing',
      line: 'Song Lab can start that draft. No account until you save it.',
      href: '/song-helper',
      label: 'Open Song Lab',
      cta: 'write_song'
    },
    release: {
      id: 'release',
      pose: 'gotit',
      line: 'Releasing to stores asks you to sign in. Finish the song first.',
      href: 'login.html?next=%2Fdistribution',
      label: 'Sign in to release',
      cta: 'release'
    },
    protect: {
      id: 'protect',
      pose: 'gotit',
      line: 'Publishing and rights are separate from streaming. Sign in to register.',
      href: 'publishing.html',
      label: 'Sign in to publish',
      cta: 'publish'
    },
    artist: {
      id: 'artist',
      pose: 'hello',
      line: 'Your EPK is the public page with your bio, songs, and how to reach you.',
      href: '/epk',
      label: 'Open the EPK',
      cta: 'artist_profile'
    }
  };

  var GREET = 'Where are you with your music?';

  function answerById(id) {
    return ANSWERS[id] || null;
  }

  function routeText(text) {
    var raw = String(text || '').replace(/\s+/g, ' ').trim();
    var folded = raw.toLowerCase();
    if (!folded) return null;
    if (/releas|distribut|upload|spotify|stores/.test(folded)) return answerById('release');
    if (/protect|rights|publish|royalt|paid/.test(folded)) return answerById('protect');
    if (/\bartist\b|profile|\bepk\b|persona|press kit/.test(folded)) return answerById('artist');
    var song = answerById('write');
    var href = '/song-helper?idea=' + encodeURIComponent(raw.slice(0, 280));
    return {
      id: 'custom',
      pose: song.pose,
      line: song.line,
      href: href,
      label: song.label,
      cta: song.cta
    };
  }

  function reduced(win) {
    try {
      return !!(win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (err) {
      return false;
    }
  }

  function track(win, name, data) {
    var analytics = win.PlaigroundAnalytics;
    if (analytics && typeof analytics.track === 'function') {
      analytics.track(name, data);
      return;
    }
    win.va = win.va || function () { (win.vaq = win.vaq || []).push(arguments); };
    try { win.va('event', { name: name, data: data || {} }); } catch (err) {}
  }

  function mount(doc, win) {
    var hero = doc.querySelector('[data-plai-hero]');
    if (!hero) return;
    var pose = doc.querySelector('[data-plai-pose]');
    var line = doc.querySelector('[data-plai-line]');
    var go = doc.querySelector('[data-plai-go]');
    var wave = doc.querySelector('[data-plai-wave]');
    var hear = doc.querySelector('[data-plai-hear]');
    var own = doc.querySelector('[data-plai-own]');
    var field = doc.querySelector('[data-plai-own-text]');
    var voiceOn = false;
    var timer = 0;
    var voice = win.PlaigroundPlaiVoice;

    function setPose(name) {
      var poseName = name || 'hello';
      if (pose) {
        pose.src = POSES[poseName] || POSES.hello;
        pose.setAttribute('data-pose', poseName);
      }
      if (hero && hero.setAttribute) hero.setAttribute('data-mood', poseName);
    }

    function setTalking(on) {
      if (hero.classList) hero.classList.toggle('is-talking', !!on);
      if (wave) wave.hidden = !on;
    }

    function say(text) {
      if (!voiceOn || !voice || typeof voice.speak !== 'function') return;
      setTalking(true);
      var ok = voice.speak(text, {
        onBoundary: function () { setTalking(true); },
        onEnd: function () { setTalking(false); }
      });
      if (!ok) setTalking(false);
    }

    function show(spec) {
      if (line) line.textContent = spec.line;
      setPose(spec.pose);
      if (go) {
        if (spec.href) {
          go.hidden = false;
          go.href = spec.href;
          go.textContent = spec.label;
          go.setAttribute('data-track-cta', spec.cta);
        } else {
          go.hidden = true;
          go.removeAttribute('href');
        }
      }
      say(spec.line);
    }

    function ask(spec) {
      if (!spec) return;
      if (timer) win.clearTimeout(timer);
      if (voice && voice.stop) voice.stop();
      setTalking(false);
      show({ pose: 'thinking', line: 'One second.', href: '', label: '', cta: '' });
      var wait = reduced(win) ? 0 : 700;
      timer = win.setTimeout(function () {
        show(spec);
        track(win, 'plai_answer', {
          answer: spec.id,
          cta: spec.cta,
          surface: 'homepage'
        });
        track(win, 'primary_cta', { cta: spec.cta, surface: 'homepage' });
      }, wait);
    }

    var buttons = hero.querySelectorAll('[data-plai-answer]');
    Array.prototype.forEach.call(buttons, function (button) {
      button.addEventListener('click', function () {
        ask(answerById(button.getAttribute('data-plai-answer')));
      });
    });

    if (own) {
      own.addEventListener('submit', function (event) {
        if (event && event.preventDefault) event.preventDefault();
        var typed = field ? field.value : '';
        ask(routeText(typed));
      });
    }

    if (hear) {
      hear.addEventListener('click', function () {
        voiceOn = !voiceOn;
        hear.setAttribute('aria-pressed', voiceOn ? 'true' : 'false');
        hear.textContent = voiceOn ? 'Sound on' : 'Hear Plai';
        if (!voiceOn && voice && voice.stop) {
          voice.stop();
          setTalking(false);
          return;
        }
        if (voiceOn && line) say(line.textContent);
      });
    }

    setPose('hello');
    if (line && !line.textContent) line.textContent = GREET;
    function pauseAttract() {
      if (doc.documentElement && doc.documentElement.classList) {
        doc.documentElement.classList.toggle('ax-paused', !!doc.hidden);
      }
    }
    if (doc.addEventListener) doc.addEventListener('visibilitychange', pauseAttract);
  }

  return {
    POSES: POSES,
    GREET: GREET,
    answerById: answerById,
    routeText: routeText,
    mount: mount
  };
});
