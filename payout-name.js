// Settings: "Name for payouts". Legal first + last name saved as profile.legal_name via /api/me/profile.
// Lock it in once (with a confirm step). After that it is read-only for the life of the account.
(function () {
  'use strict';
  var root = document.querySelector('[data-payout-name]');
  if (!root) return;
  function q(name) { return root.querySelector('[data-payout-' + name + ']'); }
  var firstEl = q('first');
  var lastEl = q('last');
  var lockBtn = q('lock');
  var actions = q('actions');
  var confirmBox = q('confirm');
  var confirmName = q('confirm-name');
  var yesBtn = q('confirm-yes');
  var noBtn = q('confirm-no');
  var badge = q('badge');
  var lockedNote = q('locked-note');
  var statusEl = q('status');
  var me = null;

  function status(text, bad) {
    statusEl.hidden = !text;
    statusEl.textContent = text || '';
    statusEl.style.color = bad ? '#FF8A8A' : '';
  }
  function splitName(full) {
    var parts = String(full || '').trim().split(/\s+/).filter(Boolean);
    return { first: parts[0] || '', last: parts.slice(1).join(' ') };
  }
  function syncHidden() {
    var hidden = document.querySelector('input[type="hidden"][data-account-legal]');
    if (hidden) hidden.value = [firstEl.value.trim(), lastEl.value.trim()].filter(Boolean).join(' ');
  }
  function paint() {
    var p = (me && me.profile) || {};
    var name = splitName(p.legal_name);
    var locked = Boolean(p.legal_name_locked_at);
    if (locked || !firstEl.value) firstEl.value = name.first;
    if (locked || !lastEl.value) lastEl.value = name.last;
    firstEl.readOnly = locked;
    lastEl.readOnly = locked;
    badge.hidden = !locked;
    lockedNote.hidden = !locked;
    actions.hidden = locked;
    confirmBox.hidden = true;
    syncHidden();
  }
  function ask() {
    var first = firstEl.value.trim();
    var last = lastEl.value.trim();
    if (!first || !last) { status('Add your legal first and last name first.', true); return; }
    confirmName.textContent = first + ' ' + last;
    confirmBox.hidden = false;
    actions.hidden = true;
    status('');
  }
  function lock() {
    var name = firstEl.value.trim() + ' ' + lastEl.value.trim();
    yesBtn.disabled = true;
    status('Locking it in...');
    fetch('/api/me/profile', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: { legal_name: name, legal_name_lock: true } }),
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        yesBtn.disabled = false;
        if (res.status === 401) { status('Log in to lock in your name.', true); return; }
        if (!res.ok) { status(data.error || 'Could not lock it in right now.', true); confirmBox.hidden = true; actions.hidden = false; return; }
        me = data;
        paint();
        status('Locked in. It now fills in on your releases.');
        try {
          var back = new URLSearchParams(window.location.search).get('return') || '';
          if (/^[a-z0-9-]+\.html$/i.test(back)) setTimeout(function () { window.location.href = back; }, 900);
        } catch (e) {}
      });
    }).catch(function () { yesBtn.disabled = false; status('Could not reach PLAIGROUND.', true); });
  }
  lockBtn.addEventListener('click', ask);
  yesBtn.addEventListener('click', lock);
  noBtn.addEventListener('click', function () { confirmBox.hidden = true; actions.hidden = false; status(''); });
  firstEl.addEventListener('input', syncHidden);
  lastEl.addEventListener('input', syncHidden);

  fetch('/api/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (data) { if (data) { me = data; paint(); } })
    .catch(function () {});
})();
