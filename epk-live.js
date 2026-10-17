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

  function render(epk) {
    var kit = epk || {};
    var bios = kit.bios || {};
    var releases = Array.isArray(kit.releases) ? kit.releases : [];
    var colors = (kit.colors || []).map(function (hex) {
      return '<span class="epk-swatch" style="background:' + esc(hex) + '"></span>';
    }).join('');
    var releaseHtml = releases.map(function (row) {
      var art = row.artwork_url ? '<img src="' + esc(row.artwork_url) + '" alt="" />' : '';
      var links = (row.links || []).map(function (link) {
        return '<a href="' + esc(link.url) + '">' + esc(link.label || 'Listen') + '</a>';
      }).join(' ');
      return '<div class="epk-release">' + art + '<div><strong>' + esc(row.title) + '</strong>'
        + (row.upc ? '<p>UPC ' + esc(row.upc) + '</p>' : '')
        + (row.release_date ? '<p>' + esc(row.release_date) + '</p>' : '')
        + links + '</div></div>';
    }).join('');
    var press = (kit.press || []).map(function (item) {
      return '<blockquote>“' + esc(item.quote) + '”' + (item.source ? '<p>' + esc(item.source) + '</p>' : '') + '</blockquote>';
    }).join('');
    var banner = kit.preview ? '<p class="epk-banner">Preview. This page is not public until you publish it.</p>' : '';
    var photo = kit.photo ? ' style="background-image:url(' + esc(kit.photo) + ')"' : '';
    return banner
      + '<div class="epk-live-hero"><div class="epk-live-photo"' + photo + '></div><div><p class="eyebrow">Press kit</p><h1>' + esc(kit.name || 'Artist') + '</h1>'
      + '<p>' + esc((kit.vibe || []).join(', ')) + '</p>' + colors + '</div></div>'
      + '<div class="epk-bios"><p><strong>Short.</strong> ' + esc(bios.short || '') + '</p><p><strong>Medium.</strong> ' + esc(bios.medium || '') + '</p><p><strong>Long.</strong> ' + esc(bios.long || '') + '</p></div>'
      + (kit.story ? '<h2>Story</h2><p>' + esc(kit.story) + '</p>' : '')
      + (releaseHtml ? '<h2>Releases</h2>' + releaseHtml : '')
      + (press ? '<h2>Press</h2>' + press : '')
      + (kit.booking && (kit.booking.email || kit.booking.name) ? '<h2>Booking</h2><p>' + esc([kit.booking.name, kit.booking.email].filter(Boolean).join(', ')) + '</p>' : '')
      + '<p>' + esc(kit.credit || 'Human + AI.') + '</p>';
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

  function mount(document, windowRef) {
    var host = document.getElementById('epk-live');
    if (!host || !windowRef || !windowRef.location) return;
    var slug = slugFromLocation(windowRef.location);
    if (!slug) return;
    var preview = false;
    try { preview = new URLSearchParams(windowRef.location.search).get('preview') === '1'; } catch (err) { preview = false; }
    host.className = 'epk-live is-on wrap';
    host.innerHTML = '<p>Loading the press kit.</p>';
    var url = '/api/epk?slug=' + encodeURIComponent(slug) + (preview ? '&preview=1' : '');
    windowRef.fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (result) {
        if (!result.ok || !result.data || !result.data.epk) {
          host.innerHTML = '<p>' + esc((result.data && result.data.error) || 'This EPK is not public yet.') + '</p>';
          return;
        }
        document.querySelectorAll('main > section').forEach(function (section) {
          if (section.id !== 'epk-live') section.hidden = true;
        });
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

  return { mount: mount, render: render, slugFromLocation: slugFromLocation };
});
