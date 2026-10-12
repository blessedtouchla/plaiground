'use strict';

/**
 * Persona save, public EPK, bio draft, and paste import.
 * All of these ride on the existing /api/me function.
 */

const persona = require('./persona');
const personaImport = require('./persona-import');
const personaPdf = require('./persona-pdf');
const profile = require('./profile');
const roadmap = require('./roadmap');
const { listUsers, updateProfile } = require('./accounts');
const { sessionFromRequest } = require('./auth');
const xai = require('./xai-client');

const importHits = new Map();

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function queryValue(req, key) {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    return url.searchParams.get(key) || '';
  } catch (err) {
    return '';
  }
}

function allowImport(userId) {
  const now = Date.now();
  const key = String(userId || '');
  const recent = (importHits.get(key) || []).filter(function (time) { return now - time < 60 * 60 * 1000; });
  if (recent.length >= 12) {
    importHits.set(key, recent);
    return false;
  }
  recent.push(now);
  importHits.set(key, recent);
  return true;
}

async function mirrorProfiles(userId, artist, normalized) {
  const current = await roadmap.readOwnProfiles(userId);
  const record = current && current.profiles && typeof current.profiles === 'object'
    ? JSON.parse(JSON.stringify(current.profiles))
    : { artists: [] };
  if (!Array.isArray(record.artists)) record.artists = [];
  let row = record.artists.find(function (item) {
    return item && (String(item.id) === String(artist.id) || String(item.name || '').toLowerCase() === String(artist.name || '').toLowerCase());
  });
  if (!row) {
    row = { id: artist.id, name: artist.name, picked: record.artists.length === 0 };
    record.artists.push(row);
  }
  row.name = row.name || artist.name;
  row.persona = normalized;
  if (!record.artists.some(function (item) { return item && item.picked; })) row.picked = true;
  await roadmap.saveOwnProfiles(userId, record);
}

async function savePersona(res, row, stored, body) {
  const id = String((body && (body.id || body.artist_id || body.plaiground_artist_id)) || '').trim();
  const artist = profile.findArtist(stored, id) || (stored.artists || []).find(function (item) {
    return item && String(item.name || '').toLowerCase() === String(body.name || '').toLowerCase();
  });
  if (!artist) {
    sendJson(res, 404, { error: 'Choose an artist first.' });
    return;
  }
  const wantPublish = Boolean(body && (body.publish === true || (body.persona && body.persona.published === true)));
  const merged = Object.assign({}, artist.persona || {}, body && body.persona && typeof body.persona === 'object' ? body.persona : {});
  if (Object.prototype.hasOwnProperty.call(merged, 'password')) {
    sendJson(res, 400, { error: 'Password is not accepted here.' });
    return;
  }
  merged.published = false;
  let normalized = persona.normalize(merged, { name: artist.name, keepPublished: false });
  if (!normalized) {
    sendJson(res, 400, { error: 'Add a persona detail before saving.' });
    return;
  }
  const meter = persona.progress(normalized);
  if (wantPublish && !meter.ready) {
    sendJson(res, 400, { error: 'Finish the persona first. Then you can publish the EPK.', progress: meter, asks: persona.asks(normalized) });
    return;
  }
  if (wantPublish) {
    merged.published = true;
    normalized = persona.normalize(merged, { name: artist.name, keepPublished: true });
  }
  const slugTaken = (await listUsers()).some(function (user) {
    if (!user || String(user.id) === String(row.id)) return false;
    const storedProfile = profile.readStored(user);
    return (storedProfile.artists || []).some(function (other) {
      const otherSlug = other && other.persona && (other.persona.slug || persona.slugify(other.name));
      return otherSlug && otherSlug === normalized.slug && other.persona && other.persona.published;
    });
  });
  if (slugTaken) normalized.slug = persona.slugify(artist.name + '-' + String(artist.id).slice(0, 6));
  const drafted = persona.sampleBios(normalized, artist.name);
  if (!normalized.bios.short) normalized.bios.short = drafted.short;
  if (!normalized.bios.medium) normalized.bios.medium = drafted.medium;
  if (!normalized.bios.long) normalized.bios.long = drafted.long;
  const nextArtist = Object.assign({}, artist, { persona: normalized });
  const nextProfile = profile.upsertArtist(stored, nextArtist);
  await updateProfile(row.id, { profile: nextProfile });
  let profilesSaved = true;
  try {
    await mirrorProfiles(row.id, nextArtist, normalized);
  } catch (err) {
    profilesSaved = false;
  }
  sendJson(res, 200, {
    artist: nextArtist,
    persona: normalized,
    progress: persona.progress(normalized),
    asks: persona.asks(normalized),
    published: normalized.published === true,
    profiles_saved: profilesSaved,
    epk_path: '/epk/' + encodeURIComponent(normalized.slug || persona.slugify(artist.name)),
  });
}

async function handleImport(req, res, row, body) {
  if (!allowImport(row.id)) {
    sendJson(res, 429, { error: 'Too many pastes in a short time. Try again later.' });
    return;
  }
  const text = body && (body.text || body.paste || body.links);
  const result = await personaImport.extract(text);
  if (!result.ok) {
    sendJson(res, 400, { error: result.error });
    return;
  }
  sendJson(res, 200, {
    suggestions: result.suggestions,
    sources: result.sources,
    asks: result.asks,
    skipped: result.skipped,
    progress: result.progress,
    published: false,
    note: 'Suggestions only. Nothing is public until you save and publish.',
  });
}

async function handleBio(req, res, row, stored, body) {
  const id = String((body && (body.id || body.artist_id)) || '').trim();
  const artist = profile.findArtist(stored, id);
  if (!artist) {
    sendJson(res, 404, { error: 'Choose an artist first.' });
    return;
  }
  const normalized = persona.normalize(Object.assign({}, artist.persona || {}, body && body.persona ? body.persona : {}), {
    name: artist.name,
    keepPublished: true,
  }) || persona.emptyPersona();
  let bios = persona.sampleBios(normalized, artist.name);
  let source = 'sample';
  if (xai.configured()) {
    try {
      const chat = await xai.chat({
        temperature: 0.4,
        max_tokens: 700,
        messages: [
          {
            role: 'system',
            content: 'Write three bios for this artist: short, medium, and long. JSON only with keys short, medium, long. Warm plain English. No other artist names. No passwords. No em dash.',
          },
          { role: 'user', content: JSON.stringify({ name: artist.name, persona: normalized }) },
        ],
      });
      const text = String(chat.content || '');
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start !== -1 && end > start) {
        const parsed = JSON.parse(text.slice(start, end + 1));
        const drafted = persona.normalize({ bios: parsed, story: normalized.story || 'draft' }, { name: artist.name });
        if (drafted && (drafted.bios.short || drafted.bios.medium || drafted.bios.long)) {
          bios = drafted.bios;
          source = 'plai';
        }
      }
    } catch (err) {
      source = 'sample';
    }
  }
  sendJson(res, 200, {
    bios: bios,
    source: source,
    published: false,
    asks: persona.asks(normalized),
  });
}

async function sessionUser(req) {
  const session = sessionFromRequest(req);
  if (!session) return null;
  const { findById } = require('./accounts');
  return findById(session.userId);
}

async function handleEpk(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  const slug = queryValue(req, 'slug') || queryValue(req, 'artist');
  if (!slug) {
    sendJson(res, 400, { error: 'An artist link is required.' });
    return;
  }
  const preview = queryValue(req, 'preview') === '1' || queryValue(req, 'preview') === 'true';
  let owner = null;
  if (preview) {
    owner = await sessionUser(req);
    if (!owner) {
      sendJson(res, 401, { error: 'Sign in to preview your EPK.' });
      return;
    }
  }
  const users = (await listUsers()).map(function (user) {
    return Object.assign({}, user, { profile: profile.readStored(user) });
  });
  const found = persona.findBySlug(users, slug, owner && owner.id);
  if (!found) {
    sendJson(res, 404, { error: 'This EPK is not public yet.' });
    return;
  }
  if (preview && !found.owned) {
    sendJson(res, 404, { error: 'This EPK is not public yet.' });
    return;
  }
  const view = persona.epkView(found.artist, found.profile, { preview: preview && found.owned && !found.artist.persona.published });
  if (!view) {
    sendJson(res, 404, { error: 'This EPK is not public yet.' });
    return;
  }
  if (String(queryValue(req, 'format') || '').toLowerCase() === 'pdf') {
    const pdf = personaPdf.build(view);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="' + view.slug + '-epk.pdf"');
    res.setHeader('Cache-Control', 'no-store');
    res.end(pdf);
    return;
  }
  sendJson(res, 200, { epk: view });
}

module.exports = {
  allowImport: allowImport,
  handleBio: handleBio,
  handleEpk: handleEpk,
  handleImport: handleImport,
  savePersona: savePersona,
};
