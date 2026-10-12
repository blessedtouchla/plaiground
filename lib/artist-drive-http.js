'use strict';

/**
 * Owner-only Artist Drive. Same private object store as covers and audio.
 * Public press kits only receive files the artist tagged Use in EPK.
 */

const accounts = require('./accounts');
const artistDrive = require('./artist-drive');
const auth = require('./auth');
const objectStore = require('./object-store');
const profile = require('./profile');
const { queryValue } = require('./route');
const { readBody, sendJson } = require('./tonegrid');

function signOwned(store, userId, key, expires) {
  if (!key || !store || typeof store.isConfigured !== 'function' || !store.isConfigured()) return '';
  const owned = store.ownedKey(key, userId);
  if (!owned) return '';
  try {
    const signed = store.presignGet(key, { expires: expires || 300 });
    return signed && /^https:\/\//i.test(signed.url) ? signed.url : '';
  } catch (err) {
    return '';
  }
}

function present(file, userId, store) {
  const view = {
    id: file.id,
    folder: file.folder,
    name: file.name,
    use_in_epk: file.use_in_epk === true,
    kind: file.kind,
    source: file.source,
    link: file.source === 'link' ? file.link : '',
  };
  if (file.kind === 'image') {
    if (file.link && /^https:\/\//i.test(file.link)) view.preview_url = file.link;
    else {
      const preview = signOwned(store, userId, file.object_key, 3600);
      if (preview) view.preview_url = preview;
    }
  }
  return view;
}

function payload(artist, stored, userId, store) {
  return {
    private: true,
    artist_id: artist.id,
    folders: artistDrive.FOLDERS,
    files: artistDrive.list(artist, stored).files.map((file) => present(file, userId, store)),
  };
}

async function defaultLoadUser(req, res) {
  if (!auth.isConfigured()) {
    auth.notConfigured(res);
    return null;
  }
  if (auth.rejectQueryPassword(req, res)) return null;
  const session = auth.sessionFromRequest(req);
  if (!session) {
    sendJson(res, 401, { error: 'Sign in required.' });
    return null;
  }
  const row = await accounts.findById(session.userId);
  if (!row) {
    sendJson(res, 401, { error: 'Sign in required.' });
    return null;
  }
  if (auth.rejectUnconfirmed(res, row)) return null;
  auth.attachSession(req, res, row.id);
  return row;
}

async function persist(row, artist, drive, updateProfile) {
  const stored = profile.readStored(row);
  const nextArtist = Object.assign({}, artist, { drive: artistDrive.normalize(drive) || { files: [], pins: {} } });
  const nextProfile = profile.upsertArtist(stored, nextArtist);
  return updateProfile(row.id, { artist: row.artist_name, profile: nextProfile });
}

async function handle(req, res, deps) {
  const loadUser = (deps && deps.loadUser) || defaultLoadUser;
  const updateProfile = (deps && deps.updateProfile) || accounts.updateProfile;
  const store = (deps && deps.objectStore) || objectStore;
  const row = await loadUser(req, res);
  if (!row) return;

  let body = {};
  if (req.method === 'POST') {
    try {
      body = await readBody(req);
    } catch (err) {
      sendJson(res, 400, { error: 'Invalid JSON.' });
      return;
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) body = {};
    if (auth.bodyHasPassword(body)) {
      sendJson(res, 400, { error: 'Password is not accepted here.' });
      return;
    }
  } else if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  const stored = profile.readStored(row);
  const artistId = String((body.artist_id || body.id || queryValue(req, 'artist_id') || queryValue(req, 'id') || '')).trim();
  const artist = profile.findArtist(stored, artistId);
  if (!artist) {
    sendJson(res, 404, { error: 'Choose an artist on this account.' });
    return;
  }

  const op = String(body.op || queryValue(req, 'op') || (queryValue(req, 'file') ? 'download' : 'list')).trim().toLowerCase();

  if (op === 'list') {
    sendJson(res, 200, { drive: payload(artist, stored, row.id, store) });
    return;
  }

  if (op === 'download') {
    const file = artistDrive.findFile(artist, stored, body.id || queryValue(req, 'file'));
    if (!file) {
      sendJson(res, 404, { error: 'That file is not in this drive.' });
      return;
    }
    if (file.link && /^https:\/\//i.test(file.link)) {
      sendJson(res, 200, { url: file.link, kind: file.kind, name: file.name, expires_in: 0 });
      return;
    }
    const url = signOwned(store, row.id, file.object_key, 300);
    if (!url) {
      sendJson(res, 503, { error: 'We could not open that file.' });
      return;
    }
    sendJson(res, 200, { url: url, kind: file.kind, name: file.name, expires_in: 300 });
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }

  if (op === 'mint') {
    const folder = artistDrive.folderById(body.folder);
    const kind = artistDrive.kindFor(body.folder, 'file');
    if (!folder || !kind) {
      sendJson(res, 400, { error: 'Pick a folder.' });
      return;
    }
    if (!store.isConfigured()) {
      sendJson(res, 503, { error: 'File storage is not ready yet. You can still paste an audio link.' });
      return;
    }
    const check = store.validateMint(kind, body.filename || body.name, body.content_type || body.contentType, body.size || body.bytes);
    if (check.error) {
      sendJson(res, 400, { error: check.error });
      return;
    }
    const key = store.objectKey(check.kind, row.id, check.filename);
    if (!key) {
      sendJson(res, 400, { error: 'We could not start that upload.' });
      return;
    }
    const contentType = String(body.content_type || body.contentType || '').trim()
      || (kind === 'drive-doc' ? 'application/pdf' : kind === 'drive-video' ? 'video/mp4' : kind === 'audio' ? 'application/octet-stream' : 'image/jpeg');
    let signed;
    try {
      signed = store.presignPut(key, contentType);
    } catch (err) {
      sendJson(res, 503, { error: 'File storage is not ready yet. You can still paste an audio link.' });
      return;
    }
    sendJson(res, 200, {
      object_key: key,
      upload_url: signed.url,
      headers: signed.headers,
      expires_in: signed.expires_in,
      folder: folder.id,
    });
    return;
  }

  let result;
  if (op === 'save') {
    const folder = artistDrive.folderById(body.folder);
    const link = body.link || body.url;
    if (link) {
      result = artistDrive.mutate(artist.drive, 'add', {
        folder: body.folder,
        name: body.name,
        link: link,
      });
    } else {
      const kind = artistDrive.kindFor(body.folder, 'file');
      const key = String(body.object_key || body.objectKey || '').trim();
      if (!folder || !kind || !store.ownedKey(key, row.id, kind)) {
        sendJson(res, 400, { error: 'That file is not on this account.' });
        return;
      }
      const check = store.validateMint(kind, body.filename || body.name, body.content_type || body.contentType, body.size || body.bytes);
      if (check.error) {
        sendJson(res, 400, { error: check.error });
        return;
      }
      result = artistDrive.mutate(artist.drive, 'add', body);
    }
  } else if (op === 'rename' || op === 'delete' || op === 'tag') {
    result = artistDrive.mutate(artist.drive, op, body);
  } else {
    sendJson(res, 400, { error: 'Unknown drive action.' });
    return;
  }

  if (!result || result.error) {
    sendJson(res, (result && result.status) || 400, { error: (result && result.error) || 'We could not save that.' });
    return;
  }

  let saved;
  try {
    saved = await persist(row, artist, result.drive, updateProfile);
  } catch (err) {
    sendJson(res, 503, { error: 'We could not save that.' });
    return;
  }
  const next = profile.readStored(saved || row);
  const nextArtist = profile.findArtist(next, artist.id) || artist;
  sendJson(res, 200, { drive: payload(nextArtist, next, row.id, store) });
}

module.exports = {
  handle,
  payload,
  present,
  signOwned,
};
