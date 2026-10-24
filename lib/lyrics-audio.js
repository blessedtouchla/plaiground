/**
 * Pack uploaded song audio into a short WAV the transcribe route can accept.
 * Browser and tests share this. No network, no keys.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PlaigroundLyricsAudio = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var MAX_BYTES = 3800000;

  function mixDown(buffer) {
    var channels = buffer && buffer.numberOfChannels ? buffer.numberOfChannels : 1;
    var length = buffer && buffer.length ? buffer.length : 0;
    var rate = buffer && buffer.sampleRate ? buffer.sampleRate : 44100;
    var out = new Float32Array(length);
    var c;
    var i;
    for (c = 0; c < channels; c += 1) {
      var data = buffer.getChannelData(c);
      for (i = 0; i < length; i += 1) out[i] += data[i] / channels;
    }
    return { samples: out, rate: rate };
  }

  function resample(samples, fromRate, toRate) {
    if (!samples || !samples.length || fromRate === toRate) return samples;
    var outLen = Math.max(1, Math.round(samples.length * toRate / fromRate));
    var out = new Float32Array(outLen);
    var i;
    for (i = 0; i < outLen; i += 1) {
      var src = i * fromRate / toRate;
      var i0 = Math.floor(src);
      if (i0 >= samples.length) i0 = samples.length - 1;
      var i1 = Math.min(samples.length - 1, i0 + 1);
      var frac = src - Math.floor(src);
      out[i] = samples[i0] * (1 - frac) + samples[i1] * frac;
    }
    return out;
  }

  function encodeWav(samples, rate) {
    var count = samples ? samples.length : 0;
    var dataSize = count * 2;
    var buffer = new ArrayBuffer(44 + dataSize);
    var view = new DataView(buffer);
    function writeStr(offset, str) {
      var n;
      for (n = 0; n < str.length; n += 1) view.setUint8(offset + n, str.charCodeAt(n));
    }
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, rate, true);
    view.setUint32(28, rate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, dataSize, true);
    var offset = 44;
    var i;
    for (i = 0; i < count; i += 1) {
      var s = samples[i];
      if (s > 1) s = 1;
      if (s < -1) s = -1;
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
    return new Uint8Array(buffer);
  }

  function packWav(samples, rate, maxBytes) {
    var limit = maxBytes > 44 ? maxBytes : MAX_BYTES;
    var target = 16000;
    var audio = resample(samples, rate || 44100, target);
    var trimmed = false;
    var bytes = encodeWav(audio, target);
    if (bytes.length > limit) {
      target = 8000;
      audio = resample(samples, rate || 44100, target);
      bytes = encodeWav(audio, target);
    }
    if (bytes.length > limit) {
      var maxSamples = Math.floor((limit - 44) / 2);
      if (maxSamples < 1) maxSamples = 1;
      audio = audio.subarray(0, maxSamples);
      bytes = encodeWav(audio, target);
      trimmed = true;
    }
    return {
      bytes: bytes,
      mime: 'audio/wav',
      filename: 'lyrics.wav',
      trimmed: trimmed,
      rate: target,
    };
  }

  return {
    MAX_BYTES: MAX_BYTES,
    encodeWav: encodeWav,
    mixDown: mixDown,
    packWav: packWav,
    resample: resample,
  };
}));
