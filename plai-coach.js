(function () {
  'use strict';

  var SAMPLE_RATE = 24000;
  var SESSION_URL = '/api/plai-session';
  var CHUNK_MS = 100;
  var MAX_TURNS = 8;
  var MAX_TEXT = 400;

  var form = document.querySelector('[data-plai-coach-form]');
  var logEl = document.querySelector('.plai-coach-log');
  var inputEl = document.getElementById('plai-coach-input');
  var talkBtn = document.querySelector('[data-plai-coach-talk]');
  var statusEl = document.querySelector('[data-plai-coach-status]');
  if (!form || !logEl || !inputEl) return;

  var sendBtn = form.querySelector('button[type="submit"]');
  var configured = false;
  var state = 'idle';
  var wantMic = false;
  var sessionReady = false;
  var pendingText = '';
  var transcript = [];
  var assistantStreamKind = '';
  var realtimeUrl = '';
  var ws = null;
  var talkGen = 0;

  var audioContext = null;
  var mediaStream = null;
  var processorNode = null;
  var sourceNode = null;
  var playbackQueue = [];
  var playing = false;
  var currentSource = null;
  var micOn = false;

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text || '';
  }

  function setComposerEnabled(on) {
    inputEl.disabled = !on;
    if (sendBtn) sendBtn.disabled = !on;
    if (talkBtn) talkBtn.disabled = !on;
  }

  function readToken(data) {
    if (!data || typeof data !== 'object') return '';
    if (typeof data.value === 'string' && data.value) return data.value;
    if (data.client_secret && typeof data.client_secret.value === 'string') {
      return data.client_secret.value;
    }
    return '';
  }

  function renderLog() {
    logEl.innerHTML = '';
    if (!transcript.length) return;
    transcript.forEach(function (row) {
      var bubble = document.createElement('div');
      bubble.className = 'plai-coach-msg is-' + row.role;
      bubble.textContent = row.text;
      logEl.appendChild(bubble);
    });
    logEl.scrollTop = logEl.scrollHeight;
  }

  function sameLine(row, role, text) {
    return row && row.role === role && String(row.text || '').trim() === String(text || '').trim();
  }

  function addLine(role, text) {
    var clean = String(text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
    if (!clean) return;
    var last = transcript[transcript.length - 1];
    if (sameLine(last, role, clean)) {
      last.streaming = false;
      renderLog();
      return;
    }
    transcript.push({ role: role, text: clean, streaming: false });
    if (transcript.length > MAX_TURNS) transcript = transcript.slice(-MAX_TURNS);
    renderLog();
  }

  function appendDelta(role, delta, kind) {
    var piece = String(delta || '');
    if (!piece) return;
    if (role === 'plai') {
      if (assistantStreamKind && assistantStreamKind !== kind) return;
      assistantStreamKind = kind;
    }
    var last = transcript[transcript.length - 1];
    if (last && last.role === role && last.streaming) {
      last.text = (last.text + piece).slice(0, MAX_TEXT);
    } else {
      transcript.push({ role: role, text: piece.slice(0, MAX_TEXT), streaming: true });
      if (transcript.length > MAX_TURNS) transcript = transcript.slice(-MAX_TURNS);
    }
    renderLog();
  }

  function finishStreaming(role) {
    var last = transcript[transcript.length - 1];
    if (last && last.role === role && last.streaming) {
      last.streaming = false;
      last.text = last.text.replace(/\s+/g, ' ').trim();
      if (!last.text) transcript.pop();
      renderLog();
    }
    if (role === 'plai') assistantStreamKind = '';
  }

  function itemText(item) {
    if (!item || typeof item !== 'object') return '';
    if (typeof item.transcript === 'string' && item.transcript.trim()) return item.transcript;
    var content = item.content;
    if (!Array.isArray(content)) return '';
    var parts = [];
    content.forEach(function (part) {
      if (!part || typeof part !== 'object') return;
      if (typeof part.text === 'string' && part.text.trim()) parts.push(part.text);
      else if (typeof part.transcript === 'string' && part.transcript.trim()) parts.push(part.transcript);
    });
    return parts.join(' ').replace(/\s+/g, ' ').trim();
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
      if (state === 'talking') setLive(wantMic ? 'listening' : 'text');
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
    if (!wantMic || !base64) return;
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
    micOn = false;
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
    micOn = true;
  }

  function setLive(next, message) {
    state = next;
    if (talkBtn) talkBtn.classList.toggle('is-on', wantMic && (next === 'listening' || next === 'talking'));
    var copy = {
      idle: 'Type or talk. PLAI is pronounced PLAY.',
      listening: 'Listening. Speak or type.',
      talking: 'PLAI is answering.',
      text: 'Mic is off. Type a message.',
      error: message || 'Could not connect. Try again.',
      'not-configured': 'PLAI is not live on this site yet.',
    };
    setStatus(copy[next] || copy.idle);
    setComposerEnabled(configured && next !== 'not-configured');
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
        replace: {
          PLAI: 'PLAY',
          Plai: 'PLAY',
          plai: 'PLAY',
          "I'm PLAI": "I'm PLAY",
          'I am PLAI': 'I am PLAY',
          'P.L.A.I.': 'PLAY',
        },
      },
    }));
  }

  function sendTextToSocket(text) {
    if (!ws || ws.readyState !== WebSocket.OPEN || !sessionReady) return false;
    stopPlayback();
    ws.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: text }],
      },
    }));
    ws.send(JSON.stringify({ type: 'response.create' }));
    return true;
  }

  function handleConversationItem(event) {
    var item = event.item || (event.conversation && event.conversation.item) || null;
    if (!item) return;
    var text = itemText(item);
    if (!text) return;
    addLine(item.role === 'user' ? 'user' : 'plai', text);
  }

  function handleEvent(event) {
    if (!event || !event.type) return;

    if (event.type === 'session.updated') {
      sessionReady = true;
      if (pendingText) {
        var queued = pendingText;
        pendingText = '';
        sendTextToSocket(queued);
      }
      if (state !== 'talking' && state !== 'error') {
        setLive(wantMic ? 'listening' : 'text');
      }
      return;
    }

    if (event.type === 'conversation.item.created' || event.type === 'conversation.item.added') {
      handleConversationItem(event);
      return;
    }

    if (event.type === 'conversation.item.input_audio_transcription.completed') {
      var spoken = event.transcript || itemText(event.item) || '';
      if (spoken) addLine('user', spoken);
      return;
    }

    if (event.type === 'input_audio_buffer.speech_started') {
      if (!wantMic) return;
      stopPlayback();
      finishStreaming('plai');
      setLive('listening');
      return;
    }

    if (event.type === 'response.created') {
      assistantStreamKind = '';
      return;
    }

    if (event.type === 'response.output_text.delta' || event.type === 'response.output_audio_transcript.delta') {
      var kind = event.type.indexOf('audio_transcript') !== -1 ? 'audio' : 'text';
      appendDelta('plai', event.delta || event.text || '', kind);
      return;
    }

    if (event.type === 'response.output_audio.delta') {
      if (!wantMic) return;
      setLive('talking');
      playDelta(event.delta);
      return;
    }

    if (event.type === 'response.done') {
      finishStreaming('plai');
      if (state === 'talking' && !playing) setLive(wantMic ? 'listening' : 'text');
    }
  }

  function stopTalk() {
    talkGen += 1;
    sessionReady = false;
    if (ws) {
      try { ws.close(); } catch (e) {}
      ws = null;
    }
    stopCapture();
    stopPlayback();
  }

  async function startSession() {
    if (!configured) {
      setLive('not-configured');
      return;
    }
    stopTalk();
    var gen = talkGen;
    sessionReady = false;
    setLive(wantMic ? 'idle' : 'text');

    if (wantMic) {
      try {
        await startCapture();
      } catch (e) {
        micOn = false;
        if (gen !== talkGen) return;
        setLive('error', 'Allow the microphone to talk to PLAI.');
        return;
      }
    } else {
      stopCapture();
      stopPlayback();
    }
    if (gen !== talkGen) return;

    var response;
    try {
      response = await fetch(SESSION_URL, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: 'coach' }),
      });
    } catch (e) {
      if (gen !== talkGen) return;
      stopCapture();
      setLive('error', 'Could not reach the PLAI session route.');
      return;
    }
    if (gen !== talkGen) return;

    var data = {};
    try { data = await response.json(); } catch (e) { data = {}; }

    if (response.status === 503 || data.configured === false) {
      configured = false;
      stopCapture();
      setLive('not-configured');
      return;
    }
    if (!response.ok) {
      stopCapture();
      setLive('error', data.error || 'Session route could not mint a token.');
      return;
    }

    var token = readToken(data);
    realtimeUrl = typeof data.realtime_url === 'string' ? data.realtime_url : '';
    if (!token || !realtimeUrl || realtimeUrl.indexOf('wss://api.x.ai/v1/realtime') !== 0) {
      stopCapture();
      setLive('error', 'Session route did not return a coach socket.');
      return;
    }

    try {
      ws = new WebSocket(realtimeUrl, ['xai-client-secret.' + token]);
    } catch (e) {
      stopCapture();
      setLive('error', 'Browser could not open the voice socket.');
      return;
    }

    ws.onopen = function () {
      if (gen !== talkGen) return;
      configureSession();
    };
    ws.onmessage = function (message) {
      if (gen !== talkGen) return;
      if (typeof message.data !== 'string') return;
      var event;
      try { event = JSON.parse(message.data); } catch (e) { return; }
      handleEvent(event);
    };
    ws.onerror = function () {
      if (gen !== talkGen) return;
      setLive('error', 'The voice socket failed.');
    };
    ws.onclose = function () {
      if (gen !== talkGen) return;
      sessionReady = false;
      stopCapture();
      stopPlayback();
      if (state === 'listening' || state === 'talking' || state === 'text') setLive('idle');
    };
  }

  function sendTyped() {
    if (!configured) return;
    var text = inputEl.value ? inputEl.value.replace(/\s+/g, ' ').trim() : '';
    if (!text) return;
    inputEl.value = '';
    addLine('user', text);
    wantMic = false;
    if (sessionReady) {
      sendTextToSocket(text);
      return;
    }
    pendingText = text;
    startSession();
  }

  function toggleTalk() {
    if (!configured) return;
    if (wantMic && (state === 'listening' || state === 'talking')) {
      wantMic = false;
      stopTalk();
      setLive('idle');
      return;
    }
    wantMic = true;
    startSession();
  }

  async function checkConfigured() {
    try {
      var response = await fetch(SESSION_URL, { method: 'GET', headers: { Accept: 'application/json' } });
      var data = await response.json();
      configured = Boolean(response.ok && data && data.configured);
    } catch (e) {
      configured = false;
    }
    if (!configured) {
      setLive('not-configured');
      return;
    }
    setLive('idle');
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    sendTyped();
  });
  if (talkBtn) talkBtn.addEventListener('click', toggleTalk);
  checkConfigured();
})();
