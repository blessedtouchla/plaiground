// Free "Get your IPI" guide: renders the stepper. Saves progress and the IPI in this browser.
// Signed-in members also get the IPI saved on their account via /api/me/ipi (lib/writer-ipi-client.js).
(function () {
  'use strict';
  var G = window.PlaigroundIpiGuide;
  var view = document.querySelector('[data-ipg-view]');
  if (!G || !view) return;
  var store = null;
  try { store = window.localStorage; } catch (err) { store = null; }
  var state = G.load(store);
  var W = window.PlaigroundWriterIpi || null;
  var account = { signedIn: false, writer: null, checked: false };
  var LOGIN_BACK = 'login.html?next=' + encodeURIComponent('ipi-guide.html#step-' + (G.STEPS.length - 1));
  var current = G.clampStep(readHash() != null ? readHash() : state.step || 0);

  function readHash() {
    var m = /^#step-(\d+)$/.exec(window.location.hash || '');
    return m ? parseInt(m[1], 10) : null;
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function plaiImg(pose) { return '/for-david-fv/img/plai-' + pose + '.webp'; }

  function progress(step) {
    var wrap = el('div', 'ipg-prog');
    var lbl = el('div', 'ipg-prog-lbl');
    var left; var right;
    if (step.kind === 'ready') { left = 'Get ready'; right = 'Before step 1'; }
    else if (step.kind === 'ipi') { left = 'All 7 steps done'; right = 'Last thing: your IPI'; }
    else { left = 'Step ' + step.n + ' of 7: ' + step.title; right = 'on bmi.com'; }
    lbl.appendChild(el('span', '', left)); lbl.appendChild(el('span', 'ipg-dim', right));
    wrap.appendChild(lbl);
    var bar = el('div', 'ipg-prog-bar');
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', '7');
    var doneCount = step.kind === 'ipi' ? 7 : step.kind === 'ready' ? 0 : step.n - 1;
    bar.setAttribute('aria-valuenow', String(step.kind === 'bmi' ? step.n : doneCount));
    bar.setAttribute('aria-label', left);
    var nums = el('div', 'ipg-prog-nums');
    for (var i = 1; i <= 7; i++) {
      var cls = i <= doneCount ? 'done' : step.kind === 'bmi' && i === step.n ? 'now' : '';
      bar.appendChild(el('i', cls));
      nums.appendChild(el('b', '', String(i)));
    }
    wrap.appendChild(bar); wrap.appendChild(nums);
    return wrap;
  }

  function host(step) {
    var h = el('div', 'ipg-host');
    var img = el('img', 'ipg-host-img');
    img.src = plaiImg(step.pose); img.alt = 'Plai'; img.width = 64; img.height = 64;
    var say = el('p', 'ipg-say');
    say.appendChild(el('b', '', 'Plai'));
    say.appendChild(document.createTextNode(step.say));
    say.setAttribute('aria-live', 'polite');
    h.appendChild(img); h.appendChild(say);
    return h;
  }

  function tip(step) {
    var t = el('div', 'ipg-tip');
    t.appendChild(el('span', 'ipg-tip-ico', step.tipIcon === 'warn' ? '\u26a0\ufe0f' : '\ud83d\udca1'));
    var body = el('div');
    body.appendChild(el('b', '', 'Plai tip'));
    body.appendChild(document.createTextNode(step.tip));
    t.appendChild(body);
    return t;
  }

  function field(k, v) {
    var f = el('div', 'ipg-f');
    f.appendChild(el('span', '', k)); f.appendChild(el('b', '', v));
    return f;
  }

  function bmiCard(step) {
    var c = el('div', 'ipg-bmi');
    c.setAttribute('aria-label', 'Preview of what you will see on bmi.com (our drawing, not the real site)');
    var url = el('div', 'ipg-url');
    var dots = el('span', 'ipg-dots'); dots.appendChild(el('i')); dots.appendChild(el('i')); dots.appendChild(el('i'));
    url.appendChild(dots); url.appendChild(el('span', 'ipg-addr', step.addr)); url.appendChild(el('span', 'ipg-on', 'on bmi.com'));
    c.appendChild(url);
    var body = el('div', 'ipg-bmi-body');
    if (step.card.success) body.appendChild(el('div', 'ipg-ok', '\u2714'));
    body.appendChild(el('h3', step.card.success ? 'ipg-center' : '', step.card.heading));
    step.card.blocks.forEach(function (b) {
      if (b.type === 'field') body.appendChild(field(b.k, b.v));
      else if (b.type === 'row') { var r = el('div', 'ipg-row'); b.fields.forEach(function (p) { r.appendChild(field(p[0], p[1])); }); body.appendChild(r); }
      else if (b.type === 'section') body.appendChild(el('div', 'ipg-sec', b.text));
      else if (b.type === 'note') body.appendChild(el('small', '', b.text));
      else if (b.type === 'text') body.appendChild(el('p', 'ipg-text', b.text));
      else if (b.type === 'button') body.appendChild(el('span', 'ipg-fake-btn', b.text));
      else if (b.type === 'box') {
        var bx = el('div', 'ipg-box');
        bx.appendChild(el('b', '', b.title)); bx.appendChild(el('small', '', b.text));
        if (b.button) bx.appendChild(el('span', 'ipg-fake-btn', b.button));
        body.appendChild(bx);
      } else if (b.type === 'radio') {
        var rd = el('div', 'ipg-radio');
        b.options.forEach(function (o, i) { var s = el('span'); s.appendChild(el('i', i === b.picked ? 'on' : '')); s.appendChild(document.createTextNode(o)); rd.appendChild(s); });
        body.appendChild(rd);
      } else if (b.type === 'edit') {
        var ed = el('div', 'ipg-box');
        ed.appendChild(el('span', 'ipg-pen', '\u270e Edit')); ed.appendChild(el('b', '', b.title)); ed.appendChild(el('small', '', b.text));
        body.appendChild(ed);
      } else if (b.type === 'check') {
        var ck = el('div', 'ipg-ck');
        ck.appendChild(el('i', b.on ? 'on' : '', b.on ? '\u2713' : ''));
        var sp = el('span', '', b.text);
        if (b.sub) sp.appendChild(el('small', '', b.sub));
        ck.appendChild(sp); body.appendChild(ck);
      }
    });
    c.appendChild(body);
    return c;
  }

  function button(cls, text, onClick) {
    var b = el('button', cls, text); b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }
  function bmiLink(text) {
    var a = el('a', 'ipg-out', text);
    a.href = G.BMI_JOIN_URL; a.target = '_blank'; a.rel = 'noopener noreferrer';
    return a;
  }

  function go(i) {
    current = G.clampStep(i);
    state = G.save(store, { step: current });
    if (history.replaceState) history.replaceState(null, '', '#step-' + current);
    render();
    window.scrollTo(0, 0);
  }

  function ipiScreen(step, frag) {
    var chips = el('div', 'ipg-chips');
    chips.appendChild(el('span', '', '\u2713 Application sent'));
    chips.appendChild(el('span', '', '\u2713 Confirmation saved'));
    frag.appendChild(chips);
    frag.appendChild(el('h2', 'ipg-h', step.heading));
    var label = el('label', 'ipg-label', 'Your IPI number');
    label.setAttribute('for', 'ipg-ipi');
    var input = el('input', 'ipg-ipi');
    input.id = 'ipg-ipi'; input.type = 'text'; input.inputMode = 'numeric'; input.autocomplete = 'off';
    input.placeholder = 'Paste your IPI';
    var saved = account.signedIn && account.writer ? account.writer.ipi : state.ipi;
    if (saved) input.value = saved;
    var msg = el('p', 'ipg-msg'); msg.setAttribute('role', 'status');
    if (account.signedIn && account.writer) msg.textContent = 'Saved on your PLAIGROUND account.';
    else if (state.ipi) msg.textContent = 'Saved on this device.';
    frag.appendChild(label); frag.appendChild(input);
    frag.appendChild(el('p', 'ipg-mini', account.signedIn
      ? 'Find it in your BMI Online Services account after BMI emails you. We keep it on your PLAIGROUND account so it is always there.'
      : 'Find it in your BMI Online Services account after BMI emails you. We save it in this browser.'));
    frag.appendChild(button('ipg-go', step.next, function () {
      var r = G.saveIpi(store, input.value);
      state = G.load(store);
      if (!r.ok) { setMsg(msg, r.error, false); return; }
      if (!account.signedIn || !W) { setMsg(msg, 'Saved on this device. Nice work.', true); return; }
      setMsg(msg, 'Saving to your account...', true);
      W.saveWriter(null, { ipi: state.ipi, pro: 'BMI' }).then(function (res) {
        if (res.ok) {
          account.writer = res.writer;
          setMsg(msg, 'Saved on your PLAIGROUND account. Nice work.', true);
        } else if (res.status === 401) {
          account.signedIn = false;
          setMsg(msg, 'Saved on this device. Log in again to keep it on your account.', true);
        } else {
          setMsg(msg, 'Saved on this device. ' + res.error, false);
        }
      });
    }));
    frag.appendChild(msg);
    if (!account.signedIn) {
      var keep = el('p', 'ipg-keep');
      var join = el('a', 'ipg-keep-link', 'Sign up free to keep your IPI on your account.');
      join.href = 'signup.html';
      keep.appendChild(join);
      keep.appendChild(document.createTextNode(' Already a member? '));
      var login = el('a', 'ipg-keep-link', 'Log in');
      login.href = LOGIN_BACK;
      keep.appendChild(login);
      frag.appendChild(keep);
    }
    frag.appendChild(tip(step));
    frag.appendChild(el('p', 'ipg-ask', 'Got songs out? Let us handle the publishing side.'));
    var cta = el('a', 'ipg-cta', 'Publish my song with PLAIGROUND');
    cta.href = G.PUBLISH_URL;
    frag.appendChild(cta);
    frag.appendChild(el('p', 'ipg-mini', 'We register your songs with BMI and The MLC and handle the paperwork. No upfront cost. No promises on how much a song earns.'));
  }

  function setMsg(node, text, ok) {
    node.textContent = text;
    node.className = 'ipg-msg ' + (ok ? 'ok' : 'bad');
  }

  function render() {
    var step = G.STEPS[current];
    view.textContent = '';
    var frag = document.createDocumentFragment();
    frag.appendChild(progress(step));
    frag.appendChild(host(step));
    if (step.kind === 'ready') {
      frag.appendChild(el('h2', 'ipg-h', step.heading));
      step.checklist.forEach(function (row) {
        var c = el('div', 'ipg-check');
        c.appendChild(el('span', 'ipg-box-ico', '\u2713'));
        var d = el('div', '', row[0]); d.appendChild(el('small', '', row[1]));
        c.appendChild(d); frag.appendChild(c);
      });
      frag.appendChild(tip(step));
    } else if (step.kind === 'bmi') {
      frag.appendChild(bmiCard(step));
      frag.appendChild(tip(step));
      if (step.openBmi) frag.appendChild(bmiLink('Open bmi.com/join (new tab)'));
    } else {
      ipiScreen(step, frag);
    }
    var nav = el('div', 'ipg-nav');
    if (current > 0) nav.appendChild(button('ipg-back', 'Back', function () { go(current - 1); }));
    if (step.kind !== 'ipi') nav.appendChild(button('ipg-go', step.next, function () { go(current + 1); }));
    frag.appendChild(nav);
    if (step.kind === 'bmi' && !step.openBmi) frag.appendChild(bmiLink('Open bmi.com/join'));
    view.appendChild(frag);
  }

  window.addEventListener('hashchange', function () {
    var h = readHash();
    if (h != null && h !== current) { current = G.clampStep(h); render(); }
  });
  render();

  // Signed in? Copy a device-only IPI to the account once, then show the account copy.
  if (W) {
    W.migrateLocal(null, store).then(function (res) {
      account = { signedIn: Boolean(res.signedIn), writer: res.writer || null, checked: true };
      if (G.STEPS[current].kind === 'ipi') render();
    });
  }
})();
