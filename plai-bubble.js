(function () {
  'use strict';

  var SAMPLE_RATE = 24000;
  var AGENT_ID = 'agent_BDVzp3Ar3ABtyov5';
  var SESSION_URL = '/api/plai-session';
  var WS_BASE = 'wss://api.x.ai/v1/realtime?agent_id=' + encodeURIComponent(AGENT_ID);
  var DISMISS_KEY = 'plai-bubble-dismissed';
  var STATE_KEY = 'plai-bubble-state';
  var CHUNK_MS = 100;
  var MAX_TURNS = 8;
  var MAX_TEXT = 400;
  var RESUME_TTL_MS = 30 * 60 * 1000;
  var SEED_PREFIX = 'We were already talking on this site.';

  var root;
  var talkPill;
  var textPill;
  var panel;
  var statusEl;
  var endBtn;
  var logEl;
  var inputEl;
  var sendBtn;
  var configured = false;
  var state = 'idle';
  var open = false;
  var micOn = false;
  var wantMic = false;
  var wantRestoreTalk = false;

  var ws = null;
  var sessionReady = false;
  var talkGen = 0;
  var conversationId = '';
  var conversationAt = 0;
  var usedResume = false;
  var seededHistory = false;
  var pendingText = '';
  var transcript = [];
  var assistantStreamKind = '';

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

  function storageGet(key) {
    try { return sessionStorage.getItem(key); } catch (e) { return null; }
  }

  function storageSet(key, value) {
    try { sessionStorage.setItem(key, value); } catch (e) {}
  }

  function storageRemove(key) {
    try { sessionStorage.removeItem(key); } catch (e) {}
  }

  function normalizeTranscript(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.slice(-MAX_TURNS).map(function (row) {
      var role = row && row.role === 'user' ? 'user' : 'plai';
      return {
        role: role,
        text: String(row && row.text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT),
        streaming: false,
      };
    }).filter(function (row) { return row.text; });
  }

  function persistState() {
    if (storageGet(DISMISS_KEY) === '1') return;
    var clean = normalizeTranscript(transcript);
    storageSet(STATE_KEY, JSON.stringify({
      open: open,
      wantMic: wantMic,
      conversationId: conversationId || '',
      conversationAt: conversationId ? (conversationAt || Date.now()) : 0,
      transcript: clean,
    }));
  }

  function loadState() {
    var raw = storageGet(STATE_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function usableConversationId(saved) {
    if (!saved || !saved.conversationId) return '';
    var at = Number(saved.conversationAt) || 0;
    if (!at || (Date.now() - at) > RESUME_TTL_MS) return '';
    return String(saved.conversationId);
  }

  function sameLine(row, role, text) {
    return row && row.role === role && String(row.text || '').trim() === String(text || '').trim();
  }

  function renderLog() {
    if (!logEl) return;
    logEl.innerHTML = '';
    if (!transcript.length) {
      logEl.appendChild(el('p', {
        className: 'plai-bubble-empty',
        text: wantMic
          ? 'Talk to PLAI. Her name sounds like PLAY.'
          : 'Text PLAI. Type only — the mic stays off.',
      }));
      return;
    }
    transcript.forEach(function (row) {
      logEl.appendChild(el('div', {
        className: 'plai-bubble-msg is-' + row.role + (row.streaming ? ' is-streaming' : ''),
        text: row.text,
      }));
    });
    logEl.scrollTop = logEl.scrollHeight;
  }

  function addLine(role, text) {
    var clean = String(text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
    if (!clean) return;
    var last = transcript[transcript.length - 1];
    if (sameLine(last, role, clean)) {
      last.streaming = false;
      renderLog();
      persistState();
      return;
    }
    transcript.push({ role: role, text: clean, streaming: false });
    if (transcript.length > MAX_TURNS) transcript = transcript.slice(-MAX_TURNS);
    renderLog();
    persistState();
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
    persistState();
  }

  function finishStreaming(role) {
    var last = transcript[transcript.length - 1];
    if (last && last.role === role && last.streaming) {
      last.streaming = false;
      last.text = last.text.replace(/\s+/g, ' ').trim();
      if (!last.text) transcript.pop();
      renderLog();
      persistState();
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

  function setComposerEnabled(on) {
    if (!inputEl || !sendBtn) return;
    inputEl.disabled = !on;
    sendBtn.disabled = !on;
  }

  function syncPills() {
    if (talkPill) {
      talkPill.setAttribute('aria-expanded', open && wantMic ? 'true' : 'false');
      talkPill.classList.toggle('is-on', open && wantMic && state !== 'not-configured');
    }
    if (textPill) {
      textPill.setAttribute('aria-expanded', open && !wantMic ? 'true' : 'false');
      textPill.classList.toggle('is-on', open && !wantMic && state !== 'not-configured');
    }
  }

  function setState(next, message) {
    state = next;
    root.dataset.state = next;
    root.classList.toggle('is-closed', !open);
    var copy = {
      idle: { title: 'Ready', body: 'Talk to PLAI uses the mic. Text PLAI never turns the mic on.' },
      reconnecting: { title: 'Still here', body: 'PLAI is reconnecting…' },
      listening: { title: 'Listening', body: 'Speak or type. PLAI is on the line. Her name sounds like PLAY.' },
      talking: { title: 'Talking', body: 'PLAI is answering. Pronounced PLAY.' },
      text: { title: 'Text PLAI', body: 'Mic is off. Type a message. PLAI is pronounced PLAY.' },
      error: { title: 'Could not connect', body: message || 'Try again in a moment.' },
      'not-configured': {
        title: 'Coming soon',
        body: 'PLAI is not live on this site yet.',
      },
    };
    var row = copy[next] || copy.idle;
    statusEl.innerHTML = '';
    statusEl.appendChild(el('strong', { text: row.title }));
    statusEl.appendChild(document.createTextNode(row.body));
    endBtn.hidden = !open || next === 'not-configured';
    setComposerEnabled(configured && next !== 'not-configured');
    syncPills();
  }

  function dismiss() {
    stopTalk();
    open = false;
    storageSet(DISMISS_KEY, '1');
    storageRemove(STATE_KEY);
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
      if (state === 'talking') setState(wantMic ? 'listening' : 'text');
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

  function socketUrl() {
    if (conversationId) {
      return WS_BASE + '&conversation_id=' + encodeURIComponent(conversationId);
    }
    return WS_BASE;
  }

  function configureSession() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    // Audio + VAD + official TTS replace. Never set instructions (keeps Voice Agent Builder persona).
    // replace: spoken audio says PLAY; transcript the user sees stays PLAI.
    // Matching is case-insensitive. We still list PLAI / Plai / plai plus common misspellings.
    // Do not put the FAQ intro or a long voice-agent hello in this session.
    // https://docs.x.ai/developers/model-capabilities/audio/voice-agent#pronunciation-replacements
    ws.send(JSON.stringify({
      type: 'session.update',
      session: {
        turn_detection: { type: 'server_vad' },
        audio: {
          input: { format: { type: 'audio/pcm', rate: SAMPLE_RATE } },
          output: { format: { type: 'audio/pcm', rate: SAMPLE_RATE } },
        },
        resumption: { enabled: true },
        replace: {
          PLAI: 'PLAY',
          Plai: 'PLAY',
          plai: 'PLAY',
          "I'm PLAI": "I'm PLAY",
          'I am PLAI': 'I am PLAY',
          'P.L.A.I.': 'PLAY',
          PLAIE: 'PLAY',
          Plei: 'PLAY',
          Plae: 'PLAY',
          Plie: 'PLAY',
        },
      },
    }));
  }

  function seedHistory() {
    if (!ws || ws.readyState !== WebSocket.OPEN || !sessionReady) return;
    if (usedResume || seededHistory) return;
    var turns = normalizeTranscript(transcript);
    if (pendingText) {
      var last = turns[turns.length - 1];
      if (last && last.role === 'user' && last.text === pendingText) {
        turns = turns.slice(0, -1);
      }
    }
    if (!turns.length) {
      seededHistory = true;
      return;
    }
    seededHistory = true;
    var lines = turns.map(function (row) {
      return (row.role === 'user' ? 'User: ' : 'PLAI: ') + row.text;
    }).join('\n');
    ws.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{
          type: 'input_text',
          text: SEED_PREFIX + ' Continue the same conversation. Recent turns:\n' + lines,
        }],
      },
    }));
  }

  function flushPendingText() {
    if (!pendingText) return;
    var text = pendingText;
    pendingText = '';
    sendTextToSocket(text);
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

  function sendTyped() {
    if (!configured) return;
    var text = inputEl && inputEl.value ? inputEl.value.replace(/\s+/g, ' ').trim() : '';
    if (!text) return;
    inputEl.value = '';
    addLine('user', text);
    if (sessionReady) {
      sendTextToSocket(text);
      return;
    }
    pendingText = text;
    if (!open) openMode(false);
    else if (!ws) startTalk();
  }

  function rememberConversation(id) {
    if (!id || typeof id !== 'string') return;
    conversationId = id;
    conversationAt = Date.now();
    persistState();
  }

  function handleConversationItem(event) {
    var item = event.item || (event.conversation && event.conversation.item) || null;
    if (!item) return;
    var text = itemText(item);
    if (!text || text.indexOf(SEED_PREFIX) === 0) return;
    var role = item.role === 'user' ? 'user' : 'plai';
    if (usedResume) {
      // Server is replaying cached turns. UI already restored from sessionStorage.
      return;
    }
    addLine(role, text);
  }

  function handleEvent(event) {
    if (!event || !event.type) return;

    if (event.type === 'conversation.created' && event.conversation && event.conversation.id) {
      rememberConversation(event.conversation.id);
      return;
    }

    if (event.type === 'session.updated') {
      sessionReady = true;
      seedHistory();
      flushPendingText();
      if (state !== 'talking' && state !== 'error') {
        setState(wantMic ? 'listening' : 'text');
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
      setState('listening');
      return;
    }

    if (event.type === 'response.created') {
      assistantStreamKind = '';
      return;
    }

    if (
      event.type === 'response.output_text.delta' ||
      event.type === 'response.text.delta' ||
      event.type === 'response.output_audio_transcript.delta'
    ) {
      appendDelta('plai', event.delta || event.text || '', event.type);
      return;
    }

    if (
      event.type === 'response.output_text.done' ||
      event.type === 'response.text.done' ||
      event.type === 'response.output_audio_transcript.done'
    ) {
      finishStreaming('plai');
      return;
    }

    if (event.type === 'response.output_audio.delta' || event.type === 'response.audio.delta') {
      if (!wantMic) return;
      setState('talking');
      playDelta(event.delta);
      return;
    }

    if (event.type === 'response.done') {
      finishStreaming('plai');
      if (!playing) setState(wantMic ? 'listening' : 'text');
      return;
    }

    if (event.type === 'error') {
      var message = event.error && event.error.message ? String(event.error.message) : 'Session error.';
      var safe = message.replace(/[A-Za-z0-9_\-]{24,}/g, '[redacted]');
      if (usedResume && /conversation|resum|expired|not found/i.test(message)) {
        conversationId = '';
        conversationAt = 0;
        usedResume = false;
        persistState();
        startTalk();
        return;
      }
      setState('error', safe);
      stopTalk();
    }
  }

  function stopTalk() {
    sessionReady = false;
    talkGen += 1;
    seededHistory = false;
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
    var gen = talkGen;
    var restoring = wantRestoreTalk;
    wantRestoreTalk = false;
    usedResume = Boolean(conversationId);
    seededHistory = false;
    sessionReady = false;
    setState(restoring ? 'reconnecting' : (wantMic ? 'idle' : 'text'));

    if (wantMic) {
      try {
        await startCapture();
      } catch (e) {
        micOn = false;
        if (gen !== talkGen) return;
        setState('error', 'Allow the microphone to Talk to PLAI.');
        return;
      }
    } else {
      stopCapture();
      stopPlayback();
    }
    if (gen !== talkGen) return;

    var response;
    try {
      response = await fetch(SESSION_URL, { method: 'POST', headers: { Accept: 'application/json' } });
    } catch (e) {
      if (gen !== talkGen) return;
      stopCapture();
      setState('error', 'Could not reach the PLAI session route.');
      return;
    }
    if (gen !== talkGen) return;

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
      ws = new WebSocket(socketUrl(), ['xai-client-secret.' + token]);
    } catch (e) {
      stopCapture();
      setState('error', 'Browser could not open the voice socket.');
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
      setState('error', 'The voice socket failed.');
    };
    ws.onclose = function () {
      if (gen !== talkGen) return;
      sessionReady = false;
      stopCapture();
      stopPlayback();
      if (open && (state === 'listening' || state === 'talking' || state === 'text' || state === 'reconnecting')) {
        setState('idle');
      }
    };
  }

  function isLive() {
    return open && (state === 'listening' || state === 'talking' || state === 'text' || state === 'reconnecting');
  }

  function openMode(useMic) {
    if (!configured) {
      wantMic = useMic;
      open = true;
      root.classList.remove('is-closed');
      persistState();
      setState('not-configured');
      return;
    }
    if (isLive() && wantMic === useMic) {
      closePanel();
      return;
    }
    wantMic = useMic;
    open = true;
    root.classList.remove('is-closed');
    persistState();
    if (ws && sessionReady) {
      if (useMic) {
        if (!micOn) {
          startCapture().then(function () {
            if (state !== 'talking') setState('listening');
          }).catch(function () {
            micOn = false;
            setState('error', 'Allow the microphone to Talk to PLAI.');
          });
        } else if (state !== 'talking') {
          setState('listening');
        }
      } else {
        stopCapture();
        stopPlayback();
        setState('text');
      }
      return;
    }
    startTalk();
  }

  function closePanel() {
    open = false;
    wantRestoreTalk = false;
    pendingText = '';
    stopTalk();
    persistState();
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
    logEl = el('div', {
      className: 'plai-bubble-log',
      role: 'log',
      'aria-live': 'polite',
      'aria-relevant': 'additions',
    });
    inputEl = el('input', {
      className: 'plai-bubble-input',
      type: 'text',
      maxlength: '400',
      autocomplete: 'off',
      enterkeyhint: 'send',
      'aria-label': 'Message PLAI',
      placeholder: 'Type to PLAI…',
    });
    sendBtn = el('button', {
      className: 'plai-bubble-send',
      type: 'submit',
      text: 'Send',
    });
    var form = el('form', { className: 'plai-bubble-composer' }, [inputEl, sendBtn]);
    panel = el('div', { className: 'plai-bubble-panel' }, [
      el('div', { className: 'plai-bubble-head' }, [
        el('div', { className: 'plai-bubble-brand' }, [
          el('div', { className: 'plai-bubble-title', text: 'PLAI' }),
          el('p', { className: 'plai-bubble-hint', text: 'sounds like PLAY' }),
        ]),
        xPanel,
      ]),
      statusEl,
      logEl,
      form,
      el('div', { className: 'plai-bubble-actions' }, [endBtn]),
    ]);
    talkPill = el('button', {
      className: 'plai-bubble-pill is-talk',
      type: 'button',
      'data-mode': 'talk',
      'aria-expanded': 'false',
      'aria-controls': 'plai-bubble-panel',
      'aria-label': 'Talk to PLAI, pronounced PLAY',
      title: 'Talk to PLAI — pronounced PLAY',
    }, [
      el('span', { className: 'plai-bubble-dot', 'aria-hidden': 'true' }),
      el('span', { className: 'plai-bubble-label', text: 'Talk to PLAI' }),
    ]);
    textPill = el('button', {
      className: 'plai-bubble-pill is-text',
      type: 'button',
      'data-mode': 'text',
      'aria-expanded': 'false',
      'aria-controls': 'plai-bubble-panel',
      'aria-label': 'Text PLAI, text only, microphone stays off',
      title: 'Text PLAI — type only, no microphone',
    }, [
      el('span', { className: 'plai-bubble-label', text: 'Text PLAI' }),
    ]);
    panel.id = 'plai-bubble-panel';
    root.appendChild(el('div', { className: 'plai-bubble-shell' }, [
      panel,
      el('div', { className: 'plai-bubble-row' }, [talkPill, textPill, xPill]),
    ]));
    document.body.appendChild(root);

    xPanel.addEventListener('click', dismiss);
    xPill.addEventListener('click', dismiss);
    endBtn.addEventListener('click', closePanel);
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      sendTyped();
    });
    function onPillClick(event) {
      var mode = event.currentTarget.getAttribute('data-mode');
      // Talk to PLAI = mic + speaker. Text PLAI = type only — never flip these.
      openMode(mode === 'talk');
    }
    talkPill.addEventListener('click', onPillClick);
    textPill.addEventListener('click', onPillClick);
    window.addEventListener('pagehide', persistState);
    setState('idle');
    renderLog();
  }

  function applySavedState() {
    var saved = loadState();
    if (!saved) return;
    transcript = normalizeTranscript(saved.transcript);
    conversationId = usableConversationId(saved);
    conversationAt = conversationId ? (Number(saved.conversationAt) || Date.now()) : 0;
    wantMic = Boolean(saved.wantMic);
    renderLog();
    if (saved.open) {
      open = true;
      wantRestoreTalk = true;
      root.classList.remove('is-closed');
      setState('reconnecting');
    }
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
      setState('not-configured');
      setComposerEnabled(false);
      return;
    }
    setComposerEnabled(true);
    if (wantRestoreTalk && open) startTalk();
    else setState('idle');
  }

  function init() {
    if (storageGet(DISMISS_KEY) === '1') return;
    if (document.getElementById('plai-bubble')) return;
    mount();
    applySavedState();
    checkConfigured();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
