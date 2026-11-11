(function () {
  'use strict';
  // Ask Plai: floating text chat on every page. Plai answers about what is on this screen.
  if (window.__plaiAsk) return; window.__plaiAsk = true;
  try { if (window.parent && window.parent !== window) return; } catch (e) {}
  var ENDPOINT = '/api/song-helper?action=plai-ask';
  var history = [];
  var css = '#plai-ask-btn{position:fixed;left:max(16px,env(safe-area-inset-left,0px));right:auto;bottom:max(12px,env(safe-area-inset-bottom,0px));z-index:60;display:flex;align-items:center;gap:8px;min-height:44px;background:linear-gradient(135deg,#7D3CFF,#FF3C8E);color:#fff;border:2px solid #F5C542;border-radius:99px;padding:8px 14px 8px 8px;font:800 15px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 8px 18px rgba(125,60,255,.32)}' +
    '#plai-ask-btn .pa-face{width:30px;height:30px;border-radius:50%;background:#F5C542;color:#000;display:grid;place-items:center;font-size:16px}' +
    '#plai-ask-panel{position:fixed;left:max(12px,env(safe-area-inset-left,0px));right:auto;bottom:var(--ask-dock,calc(72px + env(safe-area-inset-bottom,0px)));z-index:61;width:min(380px,calc(100vw - 24px));max-height:min(520px,calc(100dvh - 140px));display:flex;flex-direction:column;background:#0b0b0f;color:#fff;border:2px solid #7D3CFF;border-radius:18px;box-shadow:0 10px 40px rgba(0,0,0,.6);font:15px/1.45 system-ui,sans-serif;overflow:hidden}' +
    '#plai-ask-panel[hidden]{display:none}#plai-ask-panel header{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:#1d1036;font-weight:800}' +
    '#plai-ask-panel header button{background:none;border:0;color:#F5C542;font-size:20px;cursor:pointer}#pa-log{flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:8px}' +
    '.pa-m{padding:8px 12px;border-radius:14px;max-width:88%;white-space:pre-wrap}.pa-u{align-self:flex-end;background:#7D3CFF}.pa-p{align-self:flex-start;background:#1d1036;border:1px solid #3a2466}' +
    '#pa-form{display:flex;gap:6px;padding:10px;border-top:1px solid #3a2466}#pa-q{flex:1;background:#141018;color:#fff;border:1px solid #3a2466;border-radius:10px;padding:8px}#pa-form button{background:#F5C542;color:#000;border:0;border-radius:10px;padding:8px 12px;font-weight:800;cursor:pointer}' +
    '.pa-chips{display:flex;flex-wrap:wrap;gap:6px}.pa-chips button{background:#141018;color:#F5C542;border:1px solid #F5C542;border-radius:99px;padding:5px 10px;font-size:13px;cursor:pointer}' +
    'body.app #plai-ask-btn,body.overview-page #plai-ask-btn{left:auto;right:max(16px,env(safe-area-inset-right,0px));bottom:max(12px,env(safe-area-inset-bottom,0px))}' +
    'body.app #plai-ask-panel,body.overview-page #plai-ask-panel{left:auto;right:max(12px,env(safe-area-inset-right,0px));bottom:var(--ask-dock,var(--overview-dock,calc(72px + env(safe-area-inset-bottom,0px))))}' +
    'body.nav-open #plai-ask-btn,body.nav-open #plai-ask-panel,body.app.nav-open #plai-ask-btn,body.app.nav-open #plai-ask-panel{visibility:hidden;pointer-events:none}' +
    '@media print{#plai-ask-btn,#plai-ask-panel{display:none!important}}';
  function el(tag, attrs, text) { var n = document.createElement(tag); for (var k in attrs) n.setAttribute(k, attrs[k]); if (text) n.textContent = text; return n; }
  function pageContext() {
    var root = document.querySelector('main') || document.querySelector('article') || document.body;
    var clone = root.cloneNode(true);
    clone.querySelectorAll('script,style,noscript,svg,nav,footer,#plai-ask-panel,#plai-ask-btn,[aria-hidden="true"]').forEach(function (n) { n.remove(); });
    return String(clone.innerText || clone.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 3500);
  }
  function init() {
    var style = el('style'); style.textContent = css; document.head.appendChild(style);
    var btn = el('button', { id: 'plai-ask-btn', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'plai-ask-panel' });
    btn.innerHTML = '<span class="pa-face" aria-hidden="true">P</span>Ask Plai';
    var panel = el('section', { id: 'plai-ask-panel', role: 'dialog', 'aria-label': 'Ask Plai' }); panel.hidden = true;
    panel.innerHTML = '<header><span>Plai, your host</span><button type="button" aria-label="Close" id="pa-x">×</button></header><div id="pa-log" aria-live="polite"></div>' +
      '<form id="pa-form"><input type="text" name="company_website" tabindex="-1" autocomplete="off" style="display:none"><input id="pa-q" maxlength="500" placeholder="Ask about this page..." aria-label="Ask Plai a question"><button type="submit">Send</button></form>';
    document.body.appendChild(btn); document.body.appendChild(panel);
    var log = panel.querySelector('#pa-log'), q = panel.querySelector('#pa-q'), form = panel.querySelector('#pa-form');
    function say(cls, text) { var m = el('div', { 'class': 'pa-m ' + cls }, text); log.appendChild(m); log.scrollTop = log.scrollHeight; return m; }
    function ask(text) {
      text = String(text || '').trim(); if (!text) return;
      say('pa-u', text); var wait = say('pa-p', 'Plai is thinking...');
      fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: text, title: document.title, path: location.pathname, context: pageContext(), history: history.slice(-6), company_website: form.company_website.value }) })
        .then(function (r) { return r.json().catch(function () { return {}; }); })
        .then(function (d) { var a = (d && (d.reply || d.error)) || 'Plai did not answer. Try again.'; wait.textContent = a; history.push({ role: 'user', content: text }, { role: 'assistant', content: a }); })
        .catch(function () { wait.textContent = 'Network hiccup. Try again.'; });
    }
    var opened = false;
    function toggle(open) {
      panel.hidden = !open; btn.setAttribute('aria-expanded', String(open));
      if (open && !opened) {
        opened = true;
        say('pa-p', 'Hi, I\'m Plai! Ask me anything about this page, or tap one:');
        var chips = el('div', { 'class': 'pa-chips' });
        ['Explain this page', 'What should I do next?', 'How does this work?'].forEach(function (c) { var b = el('button', { type: 'button' }, c); b.onclick = function () { ask(c); }; chips.appendChild(b); });
        log.appendChild(chips);
      }
      if (open) q.focus();
    }
    btn.onclick = function () { toggle(panel.hidden); };
    panel.querySelector('#pa-x').onclick = function () { toggle(false); btn.focus(); };
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) toggle(false); });
    form.onsubmit = function (e) { e.preventDefault(); var t = q.value; q.value = ''; ask(t); };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
