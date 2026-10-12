'use strict';

/**
 * Read a public paste (links and old bio text) into persona suggestions.
 * No logins, no passwords, no auto-publish. Robots and private hosts are skipped.
 */

const persona = require('./persona');
const xai = require('./xai-client');

const MAX_URLS = 4;
const MAX_PASTE = 20000;
const MAX_PAGE = 80000;
const FETCH_MS = 8000;

function clip(value, max) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max);
}

function scrubSecrets(text) {
  return String(text || '')
    .replace(/\b(password|passcode|api[_ ]?key|secret|token)\s*[:=]\s*\S+/gi, ' ')
    .replace(/\b(password|passcode)\s+is\s+\S+/gi, ' ')
    .replace(/\bpassword\b/gi, ' ');
}

function privateHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/\.+$/, '');
  if (!host || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return true;
  if (host === '0.0.0.0' || host === '::1' || host === '[::1]') return true;
  const parts = host.split('.').map(Number);
  if (parts.length === 4 && parts.every((n) => n >= 0 && n <= 255)) {
    if (parts[0] === 10 || parts[0] === 127 || parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  }
  return false;
}

function safeUrl(value) {
  const text = clip(value, 400);
  if (!/^https?:\/\//i.test(text)) return '';
  if (/^[a-z][a-z0-9+.-]*:\/\/[^/]*@/i.test(text)) return '';
  let url;
  try {
    url = new URL(text);
  } catch (err) {
    return '';
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
  if (url.username || url.password) return '';
  if (privateHost(url.hostname)) return '';
  return url.toString();
}

function splitPaste(raw) {
  const text = scrubSecrets(String(raw || '')).slice(0, MAX_PASTE);
  const urls = [];
  const seen = {};
  text.replace(/https?:\/\/[^\s<>"']+/gi, function (match) {
    const clean = safeUrl(match.replace(/[),.;]+$/, ''));
    if (!clean || seen[clean] || urls.length >= MAX_URLS) return match;
    seen[clean] = true;
    urls.push(clean);
    return match;
  });
  const prose = clip(text.replace(/https?:\/\/[^\s<>"']+/gi, ' '), MAX_PASTE);
  return { urls: urls, text: prose, blockedPassword: /\bpassword\b/i.test(String(raw || '')) };
}

function pathBlocked(robots, path) {
  const body = String(robots || '');
  if (!body) return false;
  const lines = body.split(/\r?\n/);
  let star = false;
  let blocked = false;
  lines.forEach(function (line) {
    const trimmed = line.split('#')[0].trim();
    const agent = trimmed.match(/^user-agent:\s*(.+)$/i);
    if (agent) {
      star = agent[1].trim() === '*';
      return;
    }
    if (!star) return;
    const rule = trimmed.match(/^disallow:\s*(.*)$/i);
    if (!rule) return;
    const rulePath = rule[1].trim();
    if (!rulePath) return;
    if (path.indexOf(rulePath) === 0) blocked = true;
  });
  return blocked;
}

function htmlText(html) {
  return clip(String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>'), 12000);
}

function loginWall(html) {
  const text = String(html || '');
  if (/type=["']password["']/i.test(text)) return true;
  if (/sign in to continue|log in to continue|this account is private/i.test(text) && htmlText(text).length < 400) return true;
  return false;
}

async function fetchText(url, deps, timeoutMs) {
  const fetchImpl = deps && deps.fetch ? deps.fetch : fetch;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(function () { controller.abort(); }, timeoutMs || FETCH_MS) : null;
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
        'User-Agent': 'PLAIGROUND-persona-import (public pages only)',
      },
      signal: controller ? controller.signal : undefined,
    });
    if (response.status >= 300 && response.status < 400) {
      return { ok: false, reason: 'redirect skipped' };
    }
    if (!response.ok) return { ok: false, reason: 'page unavailable' };
    const type = String(response.headers && response.headers.get ? response.headers.get('content-type') : '');
    const raw = await response.text();
    return { ok: true, type: type, body: String(raw || '').slice(0, MAX_PAGE) };
  } catch (err) {
    return { ok: false, reason: 'timed out' };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function readRobots(url, deps) {
  let origin = '';
  let path = '/';
  try {
    const parsed = new URL(url);
    origin = parsed.origin;
    path = parsed.pathname || '/';
  } catch (err) {
    return { blocked: true, reason: 'bad link' };
  }
  const robots = await fetchText(origin + '/robots.txt', deps, FETCH_MS);
  if (!robots.ok) return { blocked: false, unread: true };
  if (pathBlocked(robots.body, path)) return { blocked: true, reason: 'robots' };
  return { blocked: false };
}

function metaContent(html, key) {
  const pattern = new RegExp('<meta[^>]+(?:property|name)=["\']' + key + '["\'][^>]+content=["\']([^"\']+)', 'i');
  const alt = new RegExp('<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\']' + key + '["\']', 'i');
  const match = String(html || '').match(pattern) || String(html || '').match(alt);
  return match ? clip(match[1], 400) : '';
}

function classifyUrl(url) {
  const host = new URL(url).hostname.toLowerCase();
  const path = new URL(url).pathname.toLowerCase();
  if (host.indexOf('spotify.com') !== -1) return path.indexOf('/track') !== -1 ? 'spotify-track' : 'spotify-artist';
  if (host.indexOf('music.apple.com') !== -1 || host.indexOf('itunes.apple.com') !== -1) {
    return path.indexOf('/album') !== -1 || path.indexOf('/song') !== -1 ? 'apple-track' : 'apple-artist';
  }
  if (host.indexOf('instagram.com') !== -1) return 'instagram';
  if (host.indexOf('tiktok.com') !== -1) return 'tiktok';
  if (host.indexOf('youtube.com') !== -1 || host.indexOf('youtu.be') !== -1) return 'youtube';
  if (host.indexOf('linktr.ee') !== -1 || host.indexOf('linktree.com') !== -1) return 'linktree';
  return 'page';
}

function quoteFrom(text) {
  const match = String(text || '').match(/[“"]([^"”]{24,220})[”"]/);
  return match ? clip(match[1], 240) : '';
}

function heuristic(pages, prose) {
  const suggestion = {};
  const sources = {};
  const releases = [];
  function put(field, value, source) {
    if (value == null || value === '' || (Array.isArray(value) && !value.length)) return;
    if (suggestion[field] == null || suggestion[field] === '' || (Array.isArray(suggestion[field]) && !suggestion[field].length)) {
      suggestion[field] = value;
      sources[field] = source;
    }
  }
  function putSocial(key, value, source) {
    if (!value) return;
    const socials = Object.assign({}, suggestion.socials || {});
    if (socials[key]) return;
    socials[key] = value;
    suggestion.socials = socials;
    sources.socials = sources.socials || source;
  }
  pages.forEach(function (page) {
    const kind = page.kind;
    const source = page.url;
    if (kind === 'spotify-artist') put('spotify_artist', page.url, source);
    if (kind === 'apple-artist') put('apple_artist', page.url, source);
    if (kind === 'instagram') putSocial('instagram', page.url, source);
    if (kind === 'tiktok') putSocial('tiktok', page.url, source);
    if (kind === 'youtube') putSocial('youtube', page.url, source);
    if (kind === 'page') putSocial('website', page.url, source);
    if ((kind === 'spotify-track' || kind === 'apple-track') && page.title) {
      releases.push({
        title: page.title,
        url: page.url,
        cover: page.image || '',
        source: source,
      });
    }
    if (page.description && !suggestion.story) {
      put('story', clip(page.description, 600), source);
    }
    const quote = quoteFrom(page.text);
    if (quote) {
      suggestion.press = (suggestion.press || []).concat([{ quote: quote, source: page.title || source, url: page.url }]);
      sources.press = source;
    }
    if (page.image) put('look', { photo: page.image }, source);
  });
  if (prose) {
    put('story', clip(prose, 600), 'pasted text');
    const quote = quoteFrom(prose);
    if (quote) {
      suggestion.press = (suggestion.press || []).concat([{ quote: quote, source: 'pasted text', url: '' }]);
      sources.press = sources.press || 'pasted text';
    }
  }
  if (releases.length) {
    suggestion.imported_releases = releases.slice(0, 8);
    sources.imported_releases = releases[0].source;
  }
  suggestion.sources = sources;
  return { suggestion: suggestion, sources: sources };
}

function parseModelJson(content) {
  const text = String(content || '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch (err) {
    return null;
  }
}

async function askModel(bundle, deps) {
  const chat = deps && deps.chat ? deps.chat : xai.chat;
  if (deps && deps.configured === false) return null;
  if (!deps && !xai.configured()) return null;
  const messages = [
    {
      role: 'system',
      content: 'Extract a musician persona from public text. Reply with JSON only. Fields: story, vibe (array of up to 3 everyday words), look chips, voice chips, audience city, press quotes, genres, socials, imported_releases with title and https cover. Influences may only be eras, places, or feelings. Never name other artists. Never include passwords, emails that look like logins, or private stats that are not in the text. Omit anything you cannot see.',
    },
    { role: 'user', content: bundle.slice(0, 14000) },
  ];
  const result = await chat({
    messages: messages,
    temperature: 0.2,
    max_tokens: 900,
    timeoutMs: 20000,
  });
  return parseModelJson(result && result.content);
}

function mergeModel(base, model) {
  if (!model || typeof model !== 'object') return base;
  const sources = Object.assign({}, base.sources);
  function fill(field, value, source) {
    if (value == null || value === '') return;
    if (Array.isArray(value) && !value.length) return;
    const current = base.suggestion[field];
    if (current && (!Array.isArray(current) || current.length)) return;
    base.suggestion[field] = value;
    sources[field] = source || 'public page';
  }
  fill('story', model.story, 'public page');
  fill('vibe', model.vibe, 'public page');
  fill('genres', model.genres, 'public page');
  if (model.audience && model.audience.city) {
    base.suggestion.audience = Object.assign({}, base.suggestion.audience, { city: model.audience.city });
    sources.audience = 'public page';
  }
  if (Array.isArray(model.press) && model.press.length && !(base.suggestion.press || []).length) {
    base.suggestion.press = model.press;
    sources.press = 'public page';
  }
  base.sources = sources;
  base.suggestion.sources = sources;
  return base;
}

async function loadPages(urls, deps) {
  const pages = [];
  const skipped = [];
  for (let i = 0; i < urls.length; i += 1) {
    const url = urls[i];
    let kind = 'page';
    try {
      kind = classifyUrl(url);
    } catch (err) {
      skipped.push({ url: url, reason: 'bad link' });
      continue;
    }
    const robots = await readRobots(url, deps);
    if (robots.blocked) {
      skipped.push({ url: url, reason: robots.reason || 'robots' });
      continue;
    }
    let pageUrl = url;
    if (kind === 'spotify-artist' || kind === 'spotify-track' || kind.indexOf('apple') === 0) {
      pageUrl = 'https://open.spotify.com/oembed?url=' + encodeURIComponent(url);
      if (kind.indexOf('apple') === 0) pageUrl = 'https://music.apple.com/oembed?url=' + encodeURIComponent(url);
    }
    let loaded = await fetchText(pageUrl, deps, FETCH_MS);
    if (!loaded.ok && pageUrl !== url) loaded = await fetchText(url, deps, FETCH_MS);
    if (!loaded.ok) {
      skipped.push({ url: url, reason: loaded.reason || 'unavailable' });
      continue;
    }
    if (loginWall(loaded.body)) {
      skipped.push({ url: url, reason: 'login wall' });
      continue;
    }
    let title = '';
    let description = '';
    let image = '';
    let text = '';
    if (/json/i.test(loaded.type) || loaded.body.trim().charAt(0) === '{') {
      try {
        const data = JSON.parse(loaded.body);
        title = clip(data.title, 160);
        description = clip(data.author_name && kind.indexOf('track') === -1 ? '' : data.title, 400);
        image = persona.httpsUrl(data.thumbnail_url, 300);
        text = [title, clip(data.author_name, 80)].filter(Boolean).join(' ');
        if (kind.indexOf('artist') !== -1) description = '';
      } catch (err) {
        text = htmlText(loaded.body);
      }
    } else {
      title = clip(metaContent(loaded.body, 'og:title') || (loaded.body.match(/<title>([^<]+)<\/title>/i) || [])[1], 160);
      description = clip(metaContent(loaded.body, 'og:description') || metaContent(loaded.body, 'description'), 600);
      image = persona.httpsUrl(metaContent(loaded.body, 'og:image'), 300);
      text = htmlText(loaded.body);
    }
    pages.push({
      url: url,
      kind: kind,
      title: title,
      description: description,
      image: image,
      text: text,
    });
  }
  return { pages: pages, skipped: skipped };
}

async function extract(raw, deps) {
  const split = splitPaste(raw);
  if (!split.urls.length && !split.text) {
    return {
      ok: false,
      error: split.blockedPassword
        ? 'Paste a public bio or a public link. We never take passwords.'
        : 'Paste a public link or a few lines of bio.',
    };
  }
  const loaded = await loadPages(split.urls, deps || {});
  let packed = heuristic(loaded.pages, split.text);
  const bundle = loaded.pages.map(function (page) {
    return [page.url, page.title, page.description, page.text].filter(Boolean).join('\n');
  }).concat(split.text ? ['pasted text\n' + split.text] : []).join('\n\n');
  try {
    const model = await askModel(bundle, deps || {});
    packed = mergeModel(packed, model);
  } catch (err) {
    packed.model_error = true;
  }
  const normalized = persona.normalize(packed.suggestion, { keepPublished: false }) || persona.emptyPersona();
  normalized.published = false;
  const asks = persona.asks(normalized);
  return {
    ok: true,
    published: false,
    suggestions: normalized,
    sources: packed.sources,
    asks: asks,
    skipped: loaded.skipped,
    progress: persona.progress(normalized),
  };
}

module.exports = {
  extract: extract,
  htmlText: htmlText,
  loginWall: loginWall,
  pathBlocked: pathBlocked,
  privateHost: privateHost,
  safeUrl: safeUrl,
  scrubSecrets: scrubSecrets,
  splitPaste: splitPaste,
};
