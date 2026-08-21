(function () {
  'use strict';

  var SAMPLE_RATE = 24000;
  var AGENT_ID = 'agent_BDVzp3Ar3ABtyov5';
  var SESSION_URL = '/api/plai-session';
  var WS_URL = 'wss://api.x.ai/v1/realtime?agent_id=' + encodeURIComponent(AGENT_ID);
  var DISMISS_KEY = 'plai-bubble-dismissed';
  var CHUNK_MS = 100;

  var root;
  var pill;
  var panel;
  var statusEl;
  var endBtn;
  var configured = false;
  var state = 'idle';
  var open = false;

  var ws = null;
  var sessionReady = false;
  var audioContext = null;
  var mediaStream = null;
  var processorNode = null;
  var sourceNode = null;
  var playbackQueue = [];
  var playing = false;
  var currentSource = null;

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      if (key === 'className') node.className = attrs[key];
      else if (key === 'text') node.textContent = attrs[key];
      else node.setAttribute(key, attrs[key]);
    });
    (children || []).forEach(function (child) {
      node.appendChild(child);
    });
    return node;
  }

  function setState(next, message) {
    state = next;
    root.dataset.state = next;
    root.classList.toggle('is-closed', !open);
    var copy = {
      idle: { title: 'Ready', body: 'Tap Talk to PLAI. Your mic starts only after you do.' },
      listening: { title: 'Listening', body: 'Speak when you are ready. PLAI is on the line.' },
      talking: { title: 'Talking', body: 'PLAI is answering.' },
      error: { title: 'Could not connect', body: message || 'Try again in a moment.' },
      'not-configured': {
        title: 'Coming soon',
        body: 'PLAI voice is not live on this site yet.',
      },
    };
    var row = copy[next] || copy.idle;
    statusEl.innerHTML = '';
    statusEl.appendChild(el('strong', { text: row.title }));
    statusEl.appendChild(document.createTextNode(row.body));
    pill.querySelector('.plai-bubble-label').textContent =
      next === 'not-configured' ? 'Coming soon' :
      next === 'listening' ? 'Listening' :
      next === 'talking' ? 'Talking' :
      next === 'error' ? 'Try again' : 'Talk to PLAI';
    endBtn.hidden = next !== 'listening' && next !== 'talking';
  }

  function dismiss() {
    stopTalk();
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch (e) {}
    root.classList.add('is-dismissed');
    root.hidden = true;
  }

  function readToken(data) {
    if (!data || typeof data !== 'object') return '';
    if (typeof data.value === 'string' && data.value) return data.value;
    if (data.client_secret && typeof data.client_secret.value === 'string') {
      return data.client_secret.value;
    }
    return '';
  }

  function float32ToPCM16Base64(float32Array) {
    var pcm16 = new Int16Array(float32Array.length);
    var i;
    for (i = 0; i < float32Array.length; i += 1) {
      var sample = Math.max(-1, Math.min(1, float32Array[i]));
      pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }
    var bytes = new Uint8Array(pcm16.buffer);
    var binary = '';
    for (i = 0; i < bytes.byteLength; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  function base64PCM16ToFloat32(base64) {
    var binary = atob(base64);
    var bytes = new Uint8Array(binary.length);
    var i;
    for (i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    var pcm16 = new Int16Array(bytes.buffer);
    var float32 = new Float32Array(pcm16.length);
    for (i = 0; i < pcm16.length; i += 1) {
      float32[i] = pcm16[i] / 32768;
    }
    return float32;
  }

  function resample(input, fromRate, toRate) {
    if (fromRate === toRate) return input;
    var ratio = fromRate / toRate;
    var out = new Float32Array(Math.max(1, Math.round(input.length / ratio)));
    var i;
    for (i = 0; i < out.length; i += 1) {
      var src = i * ratio;
      var i0 = Math.floor(src);
      var i1 = Math.min(i0 + 1, input.length - 1);
      var t = src - i0;
      out[i] = input[i0] * (1 - t) + input[i1] * t;
    }
    return out;
  }

  function getAudioContext() {
    if (audioContext) return audioContext;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    try {
      audioContext = new Ctx({ sampleRate: SAMPLE_RATE });
    } catch (e) {
      audioContext = new Ctx();
    }
    return audioContext;
  }

  function stopPlayback() {
    if (currentSource) {
      try { currentSource.stop(); } catch (e) {}
      try { currentSource.disconnect(); } catch (e) {}
      currentSource = null;
    }
    playbackQueue = [];
    playing = false;
  }

  function playNext(ctx) {
    if (!playbackQueue.length) {
      playing = false;
      currentSource = null;
      if (state === 'talking') setState('listening');
      return;
    }
    var chunk = playbackQueue.shift();
    var buffer = ctx.createBuffer(1, chunk.length, SAMPLE_RATE);
    buffer.getChannelData(0).set(chunk);
    var source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    currentSource = source;
    source.onended = function () {
      if (currentSource === source) currentSource = null;
      playNext(ctx);
    };
    source.start();
  }

  function playDelta(base64) {
    if (!base64) return;
    var ctx = getAudioContext();
    playbackQueue.push(base64PCM16ToFloat32(base64));
    if (!playing) {
      playing = true;
      if (ctx.state === 'suspended') ctx.resume();
      playNext(ctx);
    }
  }

  function sendAppend(base64Audio) {
    if (!ws || ws.readyState !== WebSocket.OPEN || !sessionReady) return;
    ws.send(JSON.stringify({
      type: 'input_audio_buffer.append',
      audio: base64Audio,
    }));
  }

  function stopCapture() {
    if (processorNode) {
      try { processorNode.disconnect(); } catch (e) {}
      processorNode = null;
    }
    if (sourceNode) {
      try { sourceNode.disconnect(); } catch (e) {}
      sourceNode = null;
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach(function (track) { track.stop(); });
      mediaStream = null;
    }
  }

  async function startCapture() {
    var ctx = getAudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    sourceNode = ctx.createMediaStreamSource(mediaStream);
    processorNode = ctx.createScriptProcessor(4096, 1, 1);
    var chunks = [];
    var total = 0;
    var chunkSamples = Math.round((ctx.sampleRate * CHUNK_MS) / 1000);
    processorNode.onaudioprocess = function (event) {
      var input = event.inputBuffer.getChannelData(0);
      chunks.push(new Float32Array(input));
      total += input.length;
      while (total >= chunkSamples) {
        var native = new Float32Array(chunkSamples);
        var offset = 0;
        while (offset < chunkSamples && chunks.length) {
          var head = chunks[0];
          var need = chunkSamples - offset;
          if (head.length <= need) {
            native.set(head, offset);
            offset += head.length;
            total -= head.length;
            chunks.shift();
          } else {
            native.set(head.subarray(0, need), offset);
            chunks[0] = head.subarray(need);
            offset += need;
            total -= need;
          }
        }
        sendAppend(float32ToPCM16Base64(resample(native, ctx.sampleRate, SAMPLE_RATE)));
      }
    };
    var mute = ctx.createGain();
    mute.gain.value = 0;
    sourceNode.connect(processorNode);
    processorNode.connect(mute);
    mute.connect(ctx.destination);
  }

  function configureSession() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({
      type: 'session.update',
      session: {
        turn_detection: { type: 'server_vad' },
        audio: {
          input: { format: { type: 'audio/pcm', rate: SAMPLE_RATE } },
          output: { format: { type: 'audio/pcm', rate: SAMPLE_RATE } },
        },
      },
    }));
  }

  function handleEvent(event) {
    if (!event || !event.type) return;
    if (event.type === 'session.updated') {
      sessionReady = true;
      if (state !== 'talking') setState('listening');
      return;
    }
    if (event.type === 'input_audio_buffer.speech_started') {
      stopPlayback();
      setState('listening');
      return;
    }
    if (event.type === 'response.output_audio.delta' || event.type === 'response.audio.delta') {
      setState('talking');
      playDelta(event.delta);
      return;
    }
    if (event.type === 'response.done') {
      if (!playing) setState('listening');
      return;
    }
    if (event.type === 'error') {
      var message = event.error && event.error.message ? String(event.error.message) : 'Session error.';
      setState('error', message.replace(/[A-Za-z0-9_\-]{24,}/g, '[redacted]'));
      stopTalk();
    }
  }

  function stopTalk() {
    sessionReady = false;
    if (ws) {
      try { ws.close(); } catch (e) {}
      ws = null;
    }
    stopCapture();
    stopPlayback();
  }

  async function startTalk() {
    if (!configured) {
      setState('not-configured');
      return;
    }
    stopTalk();
    setState('idle');
    try {
      await startCapture();
    } catch (e) {
      setState('error', 'Microphone permission is needed to talk.');
      return;
    }

    var response;
    try {
      response = await fetch(SESSION_URL, { method: 'POST', headers: { Accept: 'application/json' } });
    } catch (e) {
      stopCapture();
      setState('error', 'Could not reach the PLAI session route.');
      return;
    }

    var data = {};
    try { data = await response.json(); } catch (e) { data = {}; }

    if (response.status === 503 || data.configured === false) {
      configured = false;
      stopCapture();
      setState('not-configured');
      return;
    }
    if (!response.ok) {
      stopCapture();
      setState('error', data.error || 'Session route could not mint a token.');
      return;
    }

    var token = readToken(data);
    if (!token) {
      stopCapture();
      setState('error', 'Session route did not return a token.');
      return;
    }

    try {
      ws = new WebSocket(WS_URL, ['xai-client-secret.' + token]);
    } catch (e) {
      stopCapture();
      setState('error', 'Browser could not open the voice socket.');
      return;
    }

    ws.onopen = function () {
      configureSession();
    };
    ws.onmessage = function (message) {
      if (typeof message.data !== 'string') return;
      var event;
      try { event = JSON.parse(message.data); } catch (e) { return; }
      handleEvent(event);
    };
    ws.onerror = function () {
      setState('error', 'The voice socket failed.');
    };
    ws.onclose = function () {
      sessionReady = false;
      stopCapture();
      stopPlayback();
      if (state === 'listening' || state === 'talking') setState('idle');
    };
  }

  function openPanel() {
    open = true;
    root.classList.remove('is-closed');
    if (!configured) {
      setState('not-configured');
      return;
    }
    startTalk();
  }

  function closePanel() {
    open = false;
    stopTalk();
    if (configured) setState('idle');
    else setState('not-configured');
    root.classList.add('is-closed');
  }

  function mount() {
    root = el('div', {
      id: 'plai-bubble',
      className: 'plai-bubble is-closed',
      'data-state': 'idle',
    });
    var xPanel = el('button', { className: 'plai-bubble-x', type: 'button', 'aria-label': 'Dismiss PLAI' });
    xPanel.textContent = '×';
    var xPill = el('button', { className: 'plai-bubble-x', type: 'button', 'aria-label': 'Dismiss PLAI' });
    xPill.textContent = '×';
    statusEl = el('p', { className: 'plai-bubble-status' });
    endBtn = el('button', { className: 'plai-bubble-end', type: 'button', text: 'End' });
    endBtn.hidden = true;
    panel = el('div', { className: 'plai-bubble-panel', hidden: 'true' }, [
      el('div', { className: 'plai-bubble-head' }, [
        el('div', { className: 'plai-bubble-title', text: 'PLAI' }),
        xPanel,
      ]),
      statusEl,
      el('div', { className: 'plai-bubble-actions' }, [endBtn]),
    ]);
    panel.removeAttribute('hidden');
    pill = el('button', {
      className: 'plai-bubble-pill',
      type: 'button',
      'aria-expanded': 'false',
      'aria-controls': 'plai-bubble-panel',
    }, [
      el('span', { className: 'plai-bubble-dot', 'aria-hidden': 'true' }),
      el('span', { className: 'plai-bubble-label', text: 'Talk to PLAI' }),
    ]);
    panel.id = 'plai-bubble-panel';
    root.appendChild(el('div', { className: 'plai-bubble-shell' }, [
      panel,
      el('div', { className: 'plai-bubble-row' }, [pill, xPill]),
    ]));
    document.body.appendChild(root);

    xPanel.addEventListener('click', dismiss);
    xPill.addEventListener('click', dismiss);
    endBtn.addEventListener('click', closePanel);
    pill.addEventListener('click', function () {
      if (!configured) {
        open = true;
        root.classList.remove('is-closed');
        setState('not-configured');
        return;
      }
      if (open && (state === 'listening' || state === 'talking')) {
        closePanel();
        return;
      }
      openPanel();
    });
    setState('idle');
  }

  async function checkConfigured() {
    try {
      var response = await fetch(SESSION_URL, { method: 'GET', headers: { Accept: 'application/json' } });
      var data = await response.json();
      configured = Boolean(response.ok && data && data.configured);
    } catch (e) {
      configured = false;
    }
    if (!configured) setState('not-configured');
    else setState('idle');
  }

  function init() {
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === '1') return;
    } catch (e) {}
    if (document.getElementById('plai-bubble')) return;
    mount();
    checkConfigured();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
