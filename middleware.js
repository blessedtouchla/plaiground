/**
 * Apex POST /api/stripe/webhook must not 308. Stripe does not follow redirects.
 * If this Edge middleware sees the apex host, proxy to www and return that
 * status so the client never receives a redirect. Other apex paths stay on
 * the existing apex→www redirect.
 */
const WEBHOOK_PATH = '/api/stripe/webhook';

function pathnameOf(url) {
  try {
    return new URL(url).pathname.replace(/\/+$/, '') || '/';
  } catch {
    return '';
  }
}

function hostOf(request) {
  const raw = String((request && request.headers && request.headers.get('host')) || '');
  return raw.split(':')[0].toLowerCase();
}

export const config = {
  matcher: [WEBHOOK_PATH, WEBHOOK_PATH + '/'],
};

export default async function middleware(request) {
  if (!request || pathnameOf(request.url) !== WEBHOOK_PATH) return;
  if (hostOf(request) !== 'wannaplai.com') return;
  if (String(request.method || '').toUpperCase() === 'OPTIONS') return;

  const dest = new URL(request.url);
  dest.protocol = 'https:';
  dest.hostname = 'www.wannaplai.com';
  dest.port = '';

  const headers = new Headers(request.headers);
  headers.delete('host');

  const method = String(request.method || 'GET').toUpperCase();
  const init = { method, headers, redirect: 'manual' };
  if (method !== 'GET' && method !== 'HEAD') {
    init.body = await request.arrayBuffer();
  }

  const proxied = await fetch(dest.toString(), init);
  return new Response(proxied.body, {
    status: proxied.status,
    statusText: proxied.statusText,
    headers: proxied.headers,
  });
}
