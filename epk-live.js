(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', function () { api.mount(root.document, root); });
    else api.mount(root.document, root);
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function safeHref(url) {
    var text = String(url || '').trim();
    if (/^https:\/\//i.test(text)) return text;
    if (/^mailto:[^\s]+$/i.test(text)) return text;
    return '';
  }

  function safeSrc(url) {
    var text = String(url || '').trim();
    if (/^\/assets\/epk-demo\/[a-z0-9.-]+\.jpe?g$/i.test(text)) return text;
    if (/^data:image\/(?:png|jpeg|jpg);base64,[a-z0-9+/=\s]+$/i.test(text) && text.length <= 1500000) return text;
    return safeHref(text);
  }

  function accentOf(colors) {
    var list = Array.isArray(colors) ? colors : [];
    var i;
    for (i = 0; i < list.length; i += 1) {
      var hex = String(list[i] || '').toLowerCase();
      if (!/^#[0-9a-f]{6}$/.test(hex)) continue;
      if (hex === '#161616' || hex === '#000000' || hex === '#0a0a0a') continue;
      return hex;
    }
    return '#e2b657';
  }

  function inkOn(hex) {
    var n = parseInt(String(hex || '').slice(1), 16);
    if (!isFinite(n)) return '#161616';
    var y = (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000;
    return y > 150 ? '#161616' : '#f6f1e7';
  }

  function linkHtml(href, label) {
    var safe = safeHref(href);
    if (!safe) return '';
    return '<a href="' + esc(safe) + '" rel="noopener noreferrer">' + esc(label || safe) + '</a>';
  }

  function handleLink(network, value) {
    var text = String(value || '').trim();
    if (!text) return '';
    if (/^https:\/\//i.test(text)) return linkHtml(text, text.replace(/^https:\/\//i, ''));
    var handle = text.replace(/^@/, '');
    if (!/^[A-Za-z0-9._-]{2,40}$/.test(handle)) return esc(text);
    var host = network === 'tiktok' ? 'https://www.tiktok.com/@' : (network === 'youtube' ? 'https://www.youtube.com/@' : 'https://www.instagram.com/');
    return linkHtml(host + handle, '@' + handle);
  }

  function render(epk) {
    var kit = epk || {};
    var bios = kit.bios || {};
    var releases = Array.isArray(kit.releases) ? kit.releases : [];
    var press = Array.isArray(kit.press) ? kit.press : [];
    var booking = kit.booking || {};
    var socials = kit.socials || {};
    var stats = kit.stats || {};
    var accent = accentOf(kit.colors);
    var ink = inkOn(accent);
    var short = String(bios.short || '').trim();
    var body = String(bios.long || bios.medium || '').trim();
    if (short && body && (body === short || body.indexOf(short) === 0)) short = '';
    var meta = [];
    if (kit.genres && kit.genres.length) meta.push(kit.genres.join(', '));
    if (kit.vibe && kit.vibe.length) meta.push(kit.vibe.join(', '));
    if (kit.audience && kit.audience.city) meta.push(kit.audience.city);
    var voice = kit.voice && kit.voice.length ? kit.voice.join(', ') : '';
    var photoSrc = safeSrc(kit.photo);
    var photo = photoSrc ? '<div class="epk-portrait" role="img" aria-label="Press photo" style="background-image:url(\'' + esc(photoSrc) + '\')"></div>' : '';
    var banner = '';
    if (kit.demo) banner += '<p class="epk-banner">Demo layout. Not a real artist. Nothing on this sample is a booking, a quote, or a result.</p>';
    if (kit.preview) banner += '<p class="epk-banner">Preview. This page is not public until you publish it.</p>';
    var bio = '';
    if (short || body || kit.story) {
      bio = '<section class="epk-section epk-bio"><p class="epk-kicker">Biography</p>'
        + (photoSrc ? '<div class="epk-bio-photo" style="background-image:url(\'' + esc(photoSrc) + '\')"></div>' : '')
        + (short ? '<p class="epk-lead">' + esc(short) + '</p>' : '')
        + (body ? '<p class="epk-copy">' + esc(body) + '</p>' : '')
        + (kit.story && kit.story !== short && kit.story !== body ? '<p class="epk-copy">' + esc(kit.story) + '</p>' : '')
        + (voice ? '<p class="epk-meta">Voice: ' + esc(voice) + '</p>' : '')
        + '</section>';
    }
    var music = '';
    if (releases.length) {
      music = '<section class="epk-section"><p class="epk-kicker">Music</p><div class="epk-music">' + releases.map(function (row) {
        var artSrc = safeSrc(row.artwork_url);
        var art = artSrc
          ? '<div class="epk-tile-art" role="img" aria-label="' + esc(row.title || 'Cover') + '" style="background-image:url(\'' + esc(artSrc) + '\')"></div>'
          : '<div class="epk-tile-art is-empty"><span>No image</span></div>';
        var links = (row.links || []).map(function (link) {
          return linkHtml(link.url, link.label || 'Listen');
        }).filter(Boolean).join('');
        var facts = [row.release_date ? esc(row.release_date) : '', row.upc ? 'UPC ' + esc(row.upc) : ''].filter(Boolean).join(' · ');
        return '<article class="epk-tile">' + art + '<div class="epk-tile-copy"><strong>' + esc(row.title || 'Untitled') + '</strong>'
          + (facts ? '<p>' + facts + '</p>' : '')
          + (links ? '<p class="epk-tile-links">' + links + '</p>' : '')
          + '</div></article>';
      }).join('') + '</div></section>';
    }
    var quotes = '';
    if (press.length) {
      quotes = '<section class="epk-section"><p class="epk-kicker">Press</p><div class="epk-press">' + press.map(function (item) {
        if (!item || !item.quote) return '';
        var source = item.url ? linkHtml(item.url, item.source || item.url) : (item.source ? esc(item.source) : '');
        return '<blockquote><p>' + esc(item.quote) + '</p>' + (source ? '<footer>' + source + '</footer>' : '') + '</blockquote>';
      }).join('') + '</div></section>';
    }
    var numbers = [];
    if (stats.monthly_listeners) numbers.push(['Monthly listeners', stats.monthly_listeners]);
    if (stats.followers) numbers.push(['Followers', stats.followers]);
    if (stats.shows) numbers.push(['Shows', stats.shows]);
    if (stats.playlist_adds) numbers.push(['Playlist adds', stats.playlist_adds]);
    var figures = '';
    if (numbers.length) {
      figures = '<section class="epk-section"><p class="epk-kicker">Figures they shared</p><ul class="epk-stats">'
        + numbers.map(function (pair) { return '<li><span>' + esc(pair[0]) + '</span><strong>' + esc(pair[1]) + '</strong></li>'; }).join('')
        + '</ul><p class="epk-meta">These are the artist\'s own figures, not a verified count.</p></section>';
    }
    var gallery = (Array.isArray(kit.gallery) ? kit.gallery : []).filter(function (url) { return safeHref(url); });
    var photos = '';
    if (gallery.length) {
      photos = '<section class="epk-section"><p class="epk-kicker">Photos</p><div class="epk-gallery">' + gallery.map(function (url) {
        return '<a href="' + esc(url) + '" rel="noopener noreferrer"><img src="' + esc(url) + '" alt="Press photo" /><span>Open photo</span></a>';
      }).join('') + '</div></section>';
    }
    var contactBits = [];
    if (booking.name) contactBits.push('<li><span>Booking</span><strong>' + esc(booking.name) + '</strong></li>');
    if (booking.email) contactBits.push('<li><span>Email</span><strong>' + linkHtml('mailto:' + booking.email, booking.email) + '</strong></li>');
    if (booking.url) contactBits.push('<li><span>Booking site</span><strong>' + linkHtml(booking.url, booking.url.replace(/^https:\/\//i, '')) + '</strong></li>');
    if (socials.website) contactBits.push('<li><span>Website</span><strong>' + linkHtml(socials.website, String(socials.website).replace(/^https:\/\//i, '')) + '</strong></li>');
    if (socials.instagram) contactBits.push('<li><span>Instagram</span><strong>' + handleLink('instagram', socials.instagram) + '</strong></li>');
    if (socials.tiktok) contactBits.push('<li><span>TikTok</span><strong>' + handleLink('tiktok', socials.tiktok) + '</strong></li>');
    if (socials.youtube) contactBits.push('<li><span>YouTube</span><strong>' + handleLink('youtube', socials.youtube) + '</strong></li>');
    if (kit.spotify_artist) contactBits.push('<li><span>Spotify</span><strong>' + linkHtml(kit.spotify_artist, 'Artist page') + '</strong></li>');
    if (kit.apple_artist) contactBits.push('<li><span>Apple Music</span><strong>' + linkHtml(kit.apple_artist, 'Artist page') + '</strong></li>');
    var contact = '';
    if (contactBits.length) {
      contact = '<section class="epk-contact" style="--epk-ink:' + ink + '"><p class="epk-kicker">Contact</p><ul>' + contactBits.join('') + '</ul></section>';
    }
    var openPhoto = photoSrc && safeHref(photoSrc) ? '<p class="epk-open-photo"><a href="' + esc(photoSrc) + '" rel="noopener noreferrer">Open photo</a></p>' : '';
    var creditNote = kit.imageCredit ? '<p class="epk-attrib">' + esc(kit.imageCredit) + '</p>' : '';
    return '<article class="epk-kit" style="--epk-accent:' + esc(accent) + ';--epk-ink:' + ink + '">'
      + banner
      + '<header class="epk-cover' + (photo ? ' has-photo' : '') + '">'
      + '<div class="epk-identity"><p class="epk-kicker">Electronic press kit</p><h1>' + esc(kit.name || 'Artist') + '</h1>'
      + (meta.length ? '<p class="epk-meta">' + esc(meta.join(' · ')) + '</p>' : '')
      + '<p class="epk-credit">' + esc(kit.credit || 'Human + AI.') + '</p>'
      + openPhoto
      + '</div>'
      + photo
      + '</header>'
      + bio + music + quotes + figures + photos + contact
      + creditNote
      + '</article>';
  }

  var DEMO_CREDIT = 'Human + AI. A person made the choices. AI helped with drafts and tools.';
  var DEMO_IMAGES = 'Demo layout. Not a real artist. Photos under the Unsplash License: 1493225457124, 1511379938547, 1514320291840, 1470225620780.';

  function demoKit(kind) {
    if (kind === 'empty') {
      return {
        demo: true,
        name: 'New Act',
        bios: {},
        releases: [],
        press: [],
        booking: {},
        socials: {},
        credit: DEMO_CREDIT,
      };
    }
    if (kind === 'long') {
      return {
        demo: true,
        name: 'Demo Act With A Long Name For The Cover',
        photo: '',
        vibe: ['late night'],
        bios: { short: 'Edge case. Not a real artist.', long: '' },
        releases: [{ title: 'Demo track', artwork_url: '', links: [{ label: 'Listen', url: 'https://example.com/demo-track' }] }],
        press: [],
        booking: {},
        socials: {},
        credit: DEMO_CREDIT,
      };
    }
    return {
      demo: true,
      name: 'North Room',
      photo: '/assets/epk-demo/portrait.jpg',
      vibe: ['late night'],
      genres: ['Demo'],
      audience: { city: 'Sample city' },
      voice: ['smooth'],
      bios: {
        short: 'Demo layout. Not a real artist.',
        medium: '',
        long: 'North Room is a fictional name used only to show this press kit. The portrait and the three covers are stock photographs. The songs, the desk, and the note in Press are layout copy. None of this is a booking, a chart, a client list, or a result.',
      },
      story: '',
      releases: [
        { title: 'Window Light', artwork_url: '/assets/epk-demo/cover-window.jpg', links: [{ label: 'Listen', url: 'https://example.com/window-light' }] },
        { title: 'Night Desk', artwork_url: '/assets/epk-demo/cover-night.jpg', links: [{ label: 'Listen', url: 'https://example.com/night-desk' }] },
        { title: 'Violet Hour', artwork_url: '/assets/epk-demo/cover-violet.jpg', links: [{ label: 'Listen', url: 'https://example.com/violet-hour' }] },
      ],
      press: [{ quote: 'Layout sample only. This is not a real review.', source: 'Not a publication' }],
      booking: { name: 'Demo desk', email: 'demo@example.com', url: '' },
      socials: { instagram: 'northroomdemo', website: 'https://example.com' },
      credit: DEMO_CREDIT,
      imageCredit: DEMO_IMAGES,
    };
  }

  function slugFromLocation(location) {
    var params;
    try { params = new URLSearchParams(location && location.search || ''); } catch (err) { params = new URLSearchParams(); }
    var slug = params.get('artist') || params.get('slug') || '';
    if (!slug && location && location.pathname) {
      var parts = String(location.pathname).split('/').filter(Boolean);
      if (parts[0] === 'epk' && parts[1] && parts[1] !== 'epk.html') slug = decodeURIComponent(parts[1]);
    }
    return slug;
  }

  function showKit(document, host) {
    host.className = 'epk-live is-on';
    if (document.body && document.body.classList) document.body.classList.add('epk-recipient');
    document.querySelectorAll('main > section').forEach(function (section) {
      if (section.id !== 'epk-live') section.hidden = true;
    });
  }

  function mount(document, windowRef) {
    var host = document.getElementById('epk-live');
    if (!host || !windowRef || !windowRef.location) return;
    var layout = '';
    try { layout = new URLSearchParams(windowRef.location.search).get('layout') || ''; } catch (err) { layout = ''; }
    var slug = slugFromLocation(windowRef.location);
    if (!slug && (layout === 'demo' || layout === 'empty' || layout === 'long')) {
      showKit(document, host);
      host.innerHTML = render(demoKit(layout))
        + '<p class="epk-live-actions"><button class="btn btn-ghost btn-sm" type="button" onclick="window.print()">Print</button></p>';
      return;
    }
    if (!slug) return;
    var preview = false;
    try { preview = new URLSearchParams(windowRef.location.search).get('preview') === '1'; } catch (err) { preview = false; }
    host.className = 'epk-live is-on';
    host.innerHTML = '<p class="epk-loading">Loading the press kit.</p>';
    var url = '/api/epk?slug=' + encodeURIComponent(slug) + (preview ? '&preview=1' : '');
    windowRef.fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (result) {
        if (!result.ok || !result.data || !result.data.epk) {
          host.innerHTML = '<p>' + esc((result.data && result.data.error) || 'This EPK is not public yet.') + '</p>';
          return;
        }
        showKit(document, host);
        host.innerHTML = render(result.data.epk)
          + '<p class="epk-live-actions"><a class="btn btn-gold btn-sm" href="' + url + '&format=pdf">Download PDF</a> <button class="btn btn-ghost btn-sm" type="button" onclick="window.print()">Print</button></p>';
        if (windowRef.PlaigroundStagePublic && windowRef.PlaigroundStagePublic.paint) {
          windowRef.PlaigroundStagePublic.paint(host, result.data.epk);
        }
      })
      .catch(function () {
        host.innerHTML = '<p>This EPK is not public yet.</p>';
      });
  }

  return { mount: mount, render: render, slugFromLocation: slugFromLocation, demoKit: demoKit };
});
