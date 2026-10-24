// Settings: "Your writer IPI" panel. Reads and saves via /api/me/ipi (lib/writer-ipi-client.js).
// Only the IPI and the PRO name. Never SSN, birth date, bank details or a PRO login.
(function () {
  'use strict';
  var W = window.PlaigroundWriterIpi;
  var root = document.querySelector('[data-writer-ipi]');
  if (!W || !root) return;
  function q(name) { return root.querySelector('[data-writer-ipi-' + name + ']'); }
  var valueEl = q('value');
  var proEl = q('pro-label');
  var editBtn = q('edit');
  var form = q('form');
  var numberEl = q('number');
  var proSel = q('pro');
  var otherWrap = q('other-wrap');
  var otherEl = q('other');
  var saveBtn = q('save');
  var cancelBtn = q('cancel');
  var removeBtn = q('remove');
  var statusEl = q('status');
  var guideRow = q('guide-row');
  var badge = q('badge');
  var confirmBox = q('confirm');
  var confirmValue = q('confirm-value');
  var yesBtn = q('confirm-yes');
  var noBtn = q('confirm-no');
  var writer = null;
  var store = null;
  try { store = window.localStorage; } catch (err) { store = null; }

  function status(text, bad) {
    statusEl.hidden = !text;
    statusEl.textContent = text || '';
    statusEl.style.color = bad ? '#FF8A8A' : '';
  }
  function syncOther() { otherWrap.hidden = proSel.value !== 'Other'; }
  function masked(ipi) {
    var v = String(ipi || '');
    return v.length > 3 ? '\u2022\u2022\u2022\u2022\u2022\u2022' + v.slice(-3) : v;
  }
  function show() {
    form.hidden = true;
    confirmBox.hidden = true;
    editBtn.hidden = false;
    var locked = Boolean(writer && writer.locked_at);
    badge.hidden = !locked;
    if (writer) {
      valueEl.textContent = locked ? masked(writer.ipi) : writer.ipi;
      proEl.textContent = 'PRO: ' + W.proLabel(writer) + (locked ? '. Locked for the life of this account. Contact support to change it.' : '. Not locked yet.');
      editBtn.textContent = 'Lock it in';
      editBtn.hidden = locked;
      guideRow.hidden = true;
    } else {
      valueEl.textContent = 'No IPI on your account yet';
      proEl.textContent = 'Have one? Lock it in and it fills in on your releases.';
      editBtn.textContent = 'I have an IPI';
      guideRow.hidden = false;
    }
  }
  function edit() {
    numberEl.value = writer ? writer.ipi : '';
    proSel.value = writer ? writer.pro : 'BMI';
    otherEl.value = writer ? (writer.pro_other || '') : '';
    syncOther();
    removeBtn.hidden = !writer;
    form.hidden = false;
    editBtn.hidden = true;
    guideRow.hidden = false;
    status('');
    numberEl.focus();
  }
  function save() {
    var ipi = String(numberEl.value || '').replace(/[\s.\-]/g, '');
    if (!/^\d{6,15}$/.test(ipi)) { status('Paste your full IPI, numbers only.', true); return; }
    confirmValue.textContent = masked(ipi);
    form.hidden = true;
    confirmBox.hidden = false;
    status('');
  }
  function lock() {
    yesBtn.disabled = true;
    status('Locking it in...');
    W.saveWriter(null, { ipi: numberEl.value, pro: proSel.value, pro_other: otherEl.value, lock: true }).then(function (r) {
      yesBtn.disabled = false;
      if (!r.ok) { confirmBox.hidden = true; form.hidden = false; status(r.error, true); return; }
      writer = r.writer;
      show();
      status('Locked in. It now fills in on your releases.');
    });
  }
  function remove() {
    removeBtn.disabled = true;
    fetch(W.API, { method: 'DELETE', credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (res) {
        removeBtn.disabled = false;
        if (!res.ok) { status('Could not remove it right now.', true); return; }
        writer = null;
        show();
        status('Removed from your account.');
      })
      .catch(function () { removeBtn.disabled = false; status('Could not reach PLAIGROUND.', true); });
  }

  editBtn.addEventListener('click', edit);
  cancelBtn.addEventListener('click', function () { show(); status(''); });
  saveBtn.addEventListener('click', save);
  yesBtn.addEventListener('click', lock);
  noBtn.addEventListener('click', function () { confirmBox.hidden = true; form.hidden = false; status(''); });
  removeBtn.addEventListener('click', remove);
  proSel.addEventListener('change', syncOther);

  // Load, and copy an IPI saved by the free guide on this device if the account has none yet.
  W.migrateLocal(null, store).then(function (res) {
    if (!res.signedIn) {
      valueEl.textContent = 'Log in to see your IPI.';
      proEl.textContent = '';
      editBtn.hidden = true;
      return;
    }
    writer = res.writer || null;
    show();
    if (res.migrated) status('We added the IPI you saved in the free guide.');
  });
})();
