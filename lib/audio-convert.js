'use strict';

/**
 * Incoming upload audio may be WAV, FLAC, or MP3.
 * ToneGrid POST /tracks/:uuid/audio accepts WAV or FLAC only.
 * MP3 is decoded here with mpg123 WASM (~77 KiB) to 16-bit PCM WAV
 * at the source sample rate. No ffmpeg. No M4A/AAC (cannot convert cleanly).
 */

const audioAccept = require('./audio-accept');

const AUDIO_FIELD = 'audio';
const WAV_MIME = 'audio/wav';
const BOUNDARY = '----PlaigroundAudioBoundary7MA4YWxkTrZu0gW';

function headerText(buf, max) {
  return buf.slice(0, Math.min(buf.length, max || 8192)).toString('latin1');
}

function looksLikeMp3Name(name, mime) {
  return audioAccept.isMp3Name(name, mime);
}

function looksLikeWavName(name, mime) {
  const n = String(name || '').toLowerCase();
  const t = String(mime || '').toLowerCase();
  return /\.wav$/i.test(n) || t === 'audio/wav' || t === 'audio/x-wav' || t === 'audio/wave';
}

function looksLikeFlacName(name, mime) {
  const n = String(name || '').toLowerCase();
  const t = String(mime || '').toLowerCase();
  return /\.flac$/i.test(n) || t === 'audio/flac' || t === 'audio/x-flac';
}

function sniffKind(data, filename, mime) {
  if (!data || !data.length) return '';
  if (data.length >= 12 && data.slice(0, 4).toString('ascii') === 'RIFF' && data.slice(8, 12).toString('ascii') === 'WAVE') {
    return 'wav';
  }
  if (data.length >= 4 && data.slice(0, 4).toString('ascii') === 'fLaC') return 'flac';
  if (looksLikeWavName(filename, mime)) return 'wav';
  if (looksLikeFlacName(filename, mime)) return 'flac';
  if (looksLikeMp3Name(filename, mime)) return 'mp3';
  if (data.slice(0, 3).toString('ascii') === 'ID3') return 'mp3';
  if (data.length >= 2 && data[0] === 0xff && (data[1] & 0xe0) === 0xe0) return 'mp3';
  return '';
}

function parseMultipartAudio(buf) {
  if (!Buffer.isBuffer(buf) || !buf.length) return null;
  const head = headerText(buf);
  const hasDisposition = /content-disposition:/i.test(head);
  const filenameMatch = head.match(/filename="([^"]*)"/i);
  const typeMatch = head.match(/content-type:\s*([^\r\n]+)/i);
  const nameMatch = head.match(/name="([^"]+)"/i);

  if (!hasDisposition) {
    return {
      filename: '',
      mime: '',
      data: buf,
      raw: true,
    };
  }

  const headerEnd = buf.indexOf('\r\n\r\n');
  if (headerEnd < 0) return null;
  const firstLineEnd = buf.indexOf('\r\n');
  const firstLine = firstLineEnd > 0 ? buf.slice(0, firstLineEnd).toString('utf8') : '';
  const boundary = firstLine.indexOf('--') === 0 ? firstLine : '';
  const dataStart = headerEnd + 4;
  let dataEnd = buf.length;
  if (boundary) {
    const closer = Buffer.from('\r\n' + boundary);
    const found = buf.indexOf(closer, dataStart);
    if (found >= 0) dataEnd = found;
  }
  if (nameMatch && nameMatch[1] && nameMatch[1] !== AUDIO_FIELD) {
    return null;
  }
  return {
    filename: filenameMatch ? filenameMatch[1] : '',
    mime: typeMatch ? typeMatch[1].trim() : '',
    data: buf.slice(dataStart, dataEnd),
    raw: false,
  };
}

function incomingAudioAllowed(buf) {
  const part = parseMultipartAudio(buf);
  if (part) {
    return audioAccept.incomingPartAllowed({
      filename: part.filename,
      type: part.mime,
      data: part.data,
    });
  }
  const head = headerText(buf);
  const filenameMatch = head.match(/filename="([^"]*)"/i);
  const typeMatch = head.match(/content-type:\s*([^\r\n]+)/i);
  return audioAccept.incomingPartAllowed({
    filename: filenameMatch ? filenameMatch[1] : '',
    type: typeMatch ? typeMatch[1].trim() : '',
    data: null,
  });
}

function pcmToWav(channelData, sampleRate) {
  const channels = channelData.length;
  if (!channels || !channelData[0] || !channelData[0].length) {
    throw new Error('MP3 decoded to empty audio.');
  }
  const samples = channelData[0].length;
  const rate = Number(sampleRate) || 0;
  if (!rate) {
    throw new Error('Could not decode MP3.');
  }
  const blockAlign = channels * 2;
  const dataSize = samples * blockAlign;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * blockAlign, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);
  let offset = 44;
  for (let i = 0; i < samples; i += 1) {
    for (let c = 0; c < channels; c += 1) {
      let sample = channelData[c][i];
      if (sample > 1) sample = 1;
      if (sample < -1) sample = -1;
      buf.writeInt16LE(Math.round(sample * 32767), offset);
      offset += 2;
    }
  }
  return buf;
}

async function mp3ToWav(mp3Buf) {
  const mod = await import('mpg123-decoder');
  const MPEGDecoder = mod.MPEGDecoder;
  const decoder = new MPEGDecoder();
  try {
    await decoder.ready;
    const decoded = decoder.decode(new Uint8Array(mp3Buf));
    if (decoded.errors && decoded.errors.length) {
      throw new Error('Could not decode MP3.');
    }
    if (!decoded.samplesDecoded || !decoded.channelData || !decoded.channelData.length) {
      throw new Error('Could not decode MP3.');
    }
    return pcmToWav(decoded.channelData, decoded.sampleRate);
  } finally {
    try { decoder.free(); } catch (err) { /* ignore */ }
  }
}

function wavFilename(name) {
  const base = String(name || 'audio').replace(/\.[^.]+$/, '');
  return (base || 'audio') + '.wav';
}

function buildAudioMultipart(filename, mime, fileBuf) {
  const head = Buffer.from(
    '--' + BOUNDARY + '\r\n'
    + 'Content-Disposition: form-data; name="' + AUDIO_FIELD + '"; filename="' + filename + '"\r\n'
    + 'Content-Type: ' + mime + '\r\n\r\n'
  );
  const tail = Buffer.from('\r\n--' + BOUNDARY + '--\r\n');
  return {
    rawBody: Buffer.concat([head, fileBuf, tail]),
    contentType: 'multipart/form-data; boundary=' + BOUNDARY,
    filename: filename,
    mime: mime,
    kind: 'wav',
    converted: true,
  };
}

async function prepareFromBytes(data, filename, mime) {
  if (!data || !data.length) return { error: 'audio file is required.' };
  const kind = sniffKind(data, filename, mime);
  if (kind === 'wav' || kind === 'flac') {
    const outName = filename || ('audio.' + kind);
    const outMime = mime || (kind === 'flac' ? 'audio/flac' : WAV_MIME);
    return Object.assign(buildAudioMultipart(outName, outMime, data), {
      kind: kind,
      converted: false,
    });
  }
  if (kind === 'mp3') {
    try {
      const wav = await mp3ToWav(data);
      return buildAudioMultipart(wavFilename(filename), WAV_MIME, wav);
    } catch (err) {
      return { error: err && err.message ? err.message : 'Could not convert MP3 to WAV.' };
    }
  }
  return { error: 'Audio must be WAV, FLAC, or MP3.' };
}

async function prepareToneGridAudio(raw) {
  const part = parseMultipartAudio(raw);
  if (!part || !part.data || !part.data.length) {
    return { error: 'audio file is required.' };
  }
  const kind = sniffKind(part.data, part.filename, part.mime);
  if (kind === 'wav' || kind === 'flac') {
    return {
      rawBody: raw,
      contentType: '',
      filename: part.filename,
      kind: kind,
      converted: false,
    };
  }
  if (kind === 'mp3') {
    return prepareFromBytes(part.data, part.filename, part.mime);
  }
  return { error: 'Audio must be WAV, FLAC, or MP3.' };
}

function toneGridBodyIsWav(rawBody) {
  if (!rawBody) return false;
  const buf = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
  const head = headerText(buf, 4096);
  if (/filename="[^"]+\.mp3"/i.test(head)) return false;
  if (/audio\/mpeg|audio\/mp3/i.test(head)) return false;
  if (/filename="[^"]+\.wav"/i.test(head) && head.indexOf('RIFF') !== -1) return true;
  return buf.indexOf(Buffer.from('RIFF')) !== -1 && buf.indexOf(Buffer.from('WAVE')) !== -1;
}

module.exports = {
  AUDIO_FIELD,
  incomingAudioAllowed,
  parseMultipartAudio,
  prepareFromBytes,
  prepareToneGridAudio,
  sniffKind,
  toneGridBodyIsWav,
  pcmToWav,
  mp3ToWav,
  buildAudioMultipart,
};
