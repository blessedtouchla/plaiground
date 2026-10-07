(function () {
  var api = window.PlaigroundContracts;
  var textBox = document.querySelector('[data-contract-text]');
  var results = document.querySelector('[data-contract-results]');
  var go = document.querySelector('[data-contract-go]');
  if (!api || !textBox || !results || !go) return;

  var action = /fix/.test(window.location.pathname) ? 'fix' : 'review';
  var status = { demo: true, turnstile: false, turnstileSiteKey: '' };
  var turnstileToken = '';

  function esc(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function list(title, rows, field) {
    if (!rows || !rows.length) return '';
    var html = '<section class="contract-block"><h2>' + esc(title) + '</h2><ul>';
    rows.forEach(function (row) {
      html += '<li><strong>' + esc(row.title) + '</strong><br>' + esc(row[field]) + '</li>';
    });
    html += '</ul></section>';
    return html;
  }

  function paint(data) {
    if (!data || data.ok === false) {
      results.innerHTML = '<p>' + esc((data && data.error) || 'That read did not come back.') + '</p>';
      return;
    }
    try { window.sessionStorage.setItem(api.TEXT_KEY, textBox.value); } catch (err) {}
    (window.PlaigroundEventQueue = window.PlaigroundEventQueue || []).push({
      name: action === 'fix' ? 'contract_fixed' : 'contract_reviewed',
      payload: {}
    });
    var html = '';
    if (data.notice) html += '<p>' + esc(data.notice) + '</p>';
    if (data.attribution) html += '<p>' + esc(data.attribution) + '</p>';
    if (action === 'fix') {
      html += list('Send this back', data.redlines, 'instead');
    } else {
      html += list('Red flags', data.redFlags, 'plain');
      html += list('What is fair', data.fair, 'plain');
      html += list('What to ask for instead', data.ask, 'plain');
      html += '<a class="guide-cta" href="/contracts/fix">Fix mine</a>';
    }
    var copyText = action === 'fix'
      ? (data.redlines || []).map(function (row) { return row.title + '\n' + row.instead; }).join('\n\n')
      : '';
    if (copyText) html += '<button type="button" class="guide-cta" data-contract-copy>Copy the reply</button>';
    results.innerHTML = html;
    results._copy = copyText;
  }

  async function readIt() {
    var text = textBox.value.trim();
    if (!text) {
      paint({ ok: false, error: 'Paste the contract, or upload a text file.' });
      return;
    }
    go.disabled = true;
    var honey = document.querySelector('[data-contract-honey]');
    try {
      var response = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: action,
          text: text,
          turnstile_token: turnstileToken,
          company_website: honey ? honey.value : ''
        })
      });
      var data = await response.json().catch(function () { return null; });
      if (!response.ok || !data) {
        if (response.status === 400 || response.status === 429 || response.status === 413) {
          paint(data || { ok: false, error: 'That read did not come back.' });
          return;
        }
        throw new Error('fallback');
      }
      paint(data);
    } catch (err) {
      var sample = api.analyze(text);
      sample.demo = true;
      sample.notice = 'Sample read. The live reader is not connected. This is not from Grok.';
      paint(sample);
    } finally {
      go.disabled = false;
    }
  }

  function mountTurnstile() {
    var host = document.querySelector('[data-contract-turnstile]');
    if (!host || !status.turnstile || !status.turnstileSiteKey) return;
    var script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    script.onload = function () {
      if (!window.turnstile) return;
      window.turnstile.render(host, {
        sitekey: status.turnstileSiteKey,
        callback: function (token) { turnstileToken = token; }
      });
    };
    document.head.appendChild(script);
  }

  fetch('/api/contracts?action=status').then(function (response) {
    if (!response.ok) throw new Error('status');
    return response.json();
  }).then(function (data) {
    status = data || status;
    var note = document.querySelector('[data-contract-demo]');
    if (note && (status.demo || status.disabled)) {
      note.hidden = false;
      note.textContent = status.disabled
        ? 'Contracts is turned off right now. A sample read still works.'
        : 'Sample read until the live reader is connected. Samples are not from Grok.';
    }
    mountTurnstile();
  }).catch(function () {});

  try {
    var saved = window.sessionStorage.getItem(api.TEXT_KEY);
    if (saved && !textBox.value) textBox.value = saved;
  } catch (err) {}

  var file = document.querySelector('[data-contract-file]');
  if (file) {
    file.addEventListener('change', function () {
      var picked = file.files && file.files[0];
      if (!picked) return;
      var reader = new FileReader();
      reader.onload = function () {
        var value = String(reader.result || '');
        if (value.indexOf('\u0000') !== -1) {
          paint({ ok: false, error: 'Paste the words. This page reads a text file.' });
          return;
        }
        textBox.value = value.slice(0, 12000);
      };
      reader.readAsText(picked);
    });
  }

  go.addEventListener('click', readIt);
  results.addEventListener('click', function (event) {
    var button = event.target.closest('[data-contract-copy]');
    if (!button || !results._copy) return;
    var done = function () { button.textContent = 'Copied'; };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(results._copy).then(done).catch(function () {});
    }
  });
})();
