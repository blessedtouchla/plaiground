'use strict';

/**
 * Per-artist file catalog. Bytes stay in the private object store.
 * This module only keeps names, folders, and which files the press kit may show.
 */

const crypto = require('crypto');

const MAX_FILES = 48;
const MAX_NAME = 80;
const IMAGE_MAX = 15 * 1024 * 1024;
const VIDEO_MAX = 100 * 1024 * 1024;
const DOC_MAX = 15 * 1024 * 1024;
const AUDIO_MAX = 200 * 1024 * 1024;

const FOLDERS = [
  {
    id: 'profile',
    label: 'Profile photos',
    accept: 'image/jpeg,image/png,.jpg,.jpeg,.png',
    max: IMAGE_MAX,
    hint: 'JPG or PNG. 15 MB or smaller.',
    upload: true,
  },
  {
    id: 'lifestyle',
    label: 'Lifestyle / press photos',
    accept: 'image/jpeg,image/png,.jpg,.jpeg,.png',
    max: IMAGE_MAX,
    hint: 'JPG or PNG. 15 MB or smaller.',
    upload: true,
  },
  {
    id: 'covers',
    label: 'Cover art',
    accept: 'image/jpeg,image/png,.jpg,.jpeg,.png',
    max: IMAGE_MAX,
    hint: 'Cover art from linked releases shows up here. You can also upload JPG or PNG.',
    upload: true,
  },
  {
    id: 'logos',
    label: 'Logos / brand',
    accept: 'image/jpeg,image/png,.jpg,.jpeg,.png',
    max: IMAGE_MAX,
    hint: 'JPG or PNG. 15 MB or smaller.',
    upload: true,
  },
  {
    id: 'videos',
    label: 'Videos / clips',
    accept: 'video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov',
    max: VIDEO_MAX,
    hint: 'MP4, WEBM, or MOV. 100 MB or smaller.',
    upload: true,
  },
  {
    id: 'documents',
    label: 'Documents',
    accept: 'application/pdf,.pdf',
    max: DOC_MAX,
    hint: 'PDF. 15 MB or smaller. Split sheets, contracts, one-sheets.',
    upload: true,
  },
  {
    id: 'audio',
    label: 'Audio',
    accept: 'audio/wav,audio/flac,audio/mpeg,.wav,.flac,.mp3',
    max: AUDIO_MAX,
    hint: 'WAV, FLAC, or MP3, or paste a master or stems link.',
    upload: true,
    link: true,
  },
];

const FOLDER_IDS = {};
FOLDERS.forEach((folder) => { FOLDER_IDS[folder.id] = folder; });

const KEY_RE = /^((?:audio|covers|drive\/image|drive\/video|drive\/doc))\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[A-Za-z0-9._-]+$/i;
const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PIN_RE = /^[A-Za-z0-9_-]{1,80}$/;

function clip(value, max) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max || MAX_NAME);
}

function folderById(id) {
  return FOLDER_IDS[String(id || '').trim()] || null;
}

function kindFor(folderId, mode) {
  const folder = folderById(folderId);
  if (!folder) return '';
  if (folder.id === 'videos') return 'drive-video';
  if (folder.id === 'documents') return 'drive-doc';
  if (folder.id === 'audio') return mode === 'link' ? '' : 'audio';
  return 'drive-image';
}

function kindOfFolder(folderId) {
  const kind = kindFor(folderId, 'file');
  if (kind === 'drive-video') return 'video';
  if (kind === 'drive-doc') return 'doc';
  if (kind === 'audio') return 'audio';
  return 'image';
}

function safeKey(value) {
  const key = String(value || '').trim();
  return KEY_RE.test(key) ? key : '';
}

function safeLink(value) {
  const raw = String(value || '').trim();
  if (!raw || raw.length > 300) return '';
  let url;
  try { url = new URL(raw); } catch (err) { return ''; }
  if (url.username || url.password) return '';
  if (url.protocol !== 'https:') return '';
  const host = String(url.hostname || '').toLowerCase().replace(/\.+$/, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return '';
  if (host === 'metadata.google.internal' || host.indexOf(':') !== -1) return '';
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const parts = host.split('.').map(Number);
    const a = parts[0];
    const b = parts[1];
    if (a === 10 || a === 127 || a === 0) return '';
    if (a === 169 && b === 254) return '';
    if (a === 172 && b >= 16 && b <= 31) return '';
    if (a === 192 && b === 168) return '';
  }
  return url.toString();
}

function emptyDrive() {
  return { files: [], pins: {} };
}

function normalizeFile(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const folder = folderById(raw.folder);
  if (!folder) return null;
  const id = String(raw.id || '').trim();
  if (!ID_RE.test(id)) return null;
  const objectKey = safeKey(raw.object_key || raw.objectKey);
  const link = folder.link ? safeLink(raw.link || raw.url) : '';
  if (!objectKey && !link) return null;
  if (objectKey && kindFor(folder.id, 'file') === 'audio' && !/^audio\//i.test(objectKey)) return null;
  if (objectKey && kindFor(folder.id, 'file') === 'drive-image' && !/^drive\/image\//i.test(objectKey)) return null;
  if (objectKey && kindFor(folder.id, 'file') === 'drive-video' && !/^drive\/video\//i.test(objectKey)) return null;
  if (objectKey && kindFor(folder.id, 'file') === 'drive-doc' && !/^drive\/doc\//i.test(objectKey)) return null;
  const size = Number(raw.size || raw.bytes || 0);
  const max = folder.max;
  if (objectKey && (!isFinite(size) || size < 1 || size > max)) return null;
  const name = clip(raw.name || raw.filename) || (link ? 'Link' : 'File');
  return {
    id: id,
    folder: folder.id,
    name: name,
    object_key: objectKey,
    link: objectKey ? '' : link,
    content_type: clip(raw.content_type || raw.contentType, 80),
    size: objectKey ? Math.round(size) : 0,
    use_in_epk: raw.use_in_epk === true,
    source: objectKey ? 'upload' : 'link',
    created_at: clip(raw.created_at, 40) || new Date().toISOString(),
  };
}

function normalizePins(raw) {
  const pins = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return pins;
  Object.keys(raw).slice(0, 80).forEach((key) => {
    if (!PIN_RE.test(key)) return;
    const row = raw[key] && typeof raw[key] === 'object' ? raw[key] : {};
    pins[key] = {
      name: clip(row.name),
      use_in_epk: row.use_in_epk === true,
      hidden: row.hidden === true,
    };
  });
  return pins;
}

function normalize(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const files = [];
  (Array.isArray(raw.files) ? raw.files : []).forEach((row) => {
    if (files.length >= MAX_FILES) return;
    const file = normalizeFile(row);
    if (!file) return;
    if (files.some((item) => item.id === file.id)) return;
    files.push(file);
  });
  return { files: files, pins: normalizePins(raw.pins) };
}

function linkedReleases(profile, artist) {
  const artists = profile && Array.isArray(profile.artists) ? profile.artists : [];
  const releases = profile && Array.isArray(profile.releases) ? profile.releases : [];
  const only = artists.length === 1;
  return releases.filter((row) => {
    if (!row) return false;
    const owner = String(row.plaiground_artist_id || '').trim();
    if (owner) return owner === String(artist.id) || owner === String(artist.artist_id || '');
    return only;
  });
}

function releaseCover(release, pin) {
  const art = safeLink(release && (release.artwork_url || release.cover_url));
  const key = safeKey(release && release.artwork_object_key);
  if (!art && !key) return null;
  const id = String(release.id || release.tonegrid_release_id || '').trim();
  if (!PIN_RE.test(id)) return null;
  if (pin && pin.hidden) return null;
  return {
    id: 'release:' + id,
    folder: 'covers',
    name: (pin && pin.name) || clip(release.title) || 'Cover art',
    object_key: key,
    link: art,
    content_type: 'image/jpeg',
    size: 0,
    use_in_epk: Boolean(pin && pin.use_in_epk),
    source: 'release',
    kind: 'image',
    created_at: '',
  };
}

function list(artist, profile) {
  const drive = normalize(artist && artist.drive) || emptyDrive();
  const files = drive.files.map((file) => Object.assign({}, file, { kind: kindOfFolder(file.folder) }));
  linkedReleases(profile, artist).forEach((release) => {
    const id = String(release.id || '').trim();
    const cover = releaseCover(release, drive.pins[id]);
    if (cover) files.push(cover);
  });
  return { files: files, drive: drive };
}

function findFile(artist, profile, id) {
  const want = String(id || '').trim();
  return list(artist, profile).files.find((file) => file.id === want) || null;
}

function mutate(drive, action, input) {
  const current = normalize(drive) || emptyDrive();
  const body = input || {};
  if (action === 'add') {
    if (current.files.length >= MAX_FILES) {
      return { error: 'This drive is full. Delete a file first.', status: 400 };
    }
    const folder = folderById(body.folder);
    if (!folder) return { error: 'Pick a folder.', status: 400 };
    const rawLink = body.link || body.url;
    const link = rawLink ? safeLink(rawLink) : '';
    const objectKey = safeKey(body.object_key || body.objectKey);
    if (rawLink && !link) return { error: 'That link has to be a public https address.', status: 400 };
    if (link && folder.id !== 'audio') return { error: 'Links belong in Audio.', status: 400 };
    if (!objectKey && !link) return { error: 'Add a file or an https link.', status: 400 };
    const file = normalizeFile({
      id: crypto.randomUUID(),
      folder: folder.id,
      name: body.name || body.filename,
      object_key: objectKey,
      link: link,
      content_type: body.content_type || body.contentType,
      size: body.size || body.bytes,
      use_in_epk: false,
      created_at: new Date().toISOString(),
    });
    if (!file) return { error: 'That file does not fit this folder.', status: 400 };
    current.files.push(file);
    return { drive: current, file: file };
  }
  const id = String(body.id || '').trim();
  if (id.indexOf('release:') === 0) {
    const releaseId = id.slice('release:'.length);
    if (!PIN_RE.test(releaseId)) return { error: 'That file is not in this drive.', status: 404 };
    const pin = Object.assign({ name: '', use_in_epk: false, hidden: false }, current.pins[releaseId] || {});
    if (action === 'rename') {
      const name = clip(body.name);
      if (!name) return { error: 'Name the file.', status: 400 };
      pin.name = name;
    } else if (action === 'delete') {
      pin.hidden = true;
    } else if (action === 'tag') {
      pin.use_in_epk = body.use_in_epk === true;
    } else {
      return { error: 'Unknown drive action.', status: 400 };
    }
    current.pins[releaseId] = pin;
    return { drive: current };
  }
  const idx = current.files.findIndex((file) => file.id === id);
  if (idx < 0) return { error: 'That file is not in this drive.', status: 404 };
  if (action === 'rename') {
    const name = clip(body.name);
    if (!name) return { error: 'Name the file.', status: 400 };
    current.files[idx].name = name;
  } else if (action === 'delete') {
    current.files.splice(idx, 1);
  } else if (action === 'tag') {
    current.files[idx].use_in_epk = body.use_in_epk === true;
  } else {
    return { error: 'Unknown drive action.', status: 400 };
  }
  return { drive: current };
}

function publicKit(artist, profile, userId, sign) {
  const rows = list(artist, profile).files.filter((file) => file.use_in_epk);
  const items = [];
  rows.forEach((file) => {
    let url = '';
    if (file.link && /^https:\/\//i.test(file.link)) url = file.link;
    else if (file.object_key && typeof sign === 'function') {
      url = String(sign(userId, file.object_key) || '');
    }
    if (!/^https:\/\//i.test(url)) return;
    const folder = folderById(file.folder);
    items.push({
      id: file.id,
      folder: file.folder,
      folder_label: folder ? folder.label : '',
      name: file.name,
      kind: file.kind || kindOfFolder(file.folder),
      url: url,
    });
  });
  const hero = items.find((item) => item.folder === 'profile' && item.kind === 'image')
    || items.find((item) => item.folder === 'lifestyle' && item.kind === 'image');
  return { items: items, hero: hero ? hero.url : '' };
}

module.exports = {
  AUDIO_MAX,
  DOC_MAX,
  FOLDERS,
  IMAGE_MAX,
  MAX_FILES,
  VIDEO_MAX,
  findFile,
  folderById,
  kindFor,
  linkedReleases,
  list,
  mutate,
  normalize,
  publicKit,
  safeKey,
  safeLink,
};
