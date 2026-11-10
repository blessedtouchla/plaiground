/* Featured artists: "+" adds another name row, "x" removes it.
 * All names are joined as "A, B, C" in the existing `featured` field so saved
 * single-value data keeps working. */
(function () {
  'use strict';
  function first() { return document.getElementById('tg-featured'); }
  function list() { return document.getElementById('tg-featured-more'); }
  function changed(el) {
    if (!el) return;
    try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
  }
  function addRow(value, focus) {
    var box = list();
    if (!box) return null;
    var row = document.createElement('div');
    row.className = 'featured-row';
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'tg-featured-extra';
    input.name = 'release-featured-extra';
    input.placeholder = 'Another featured artist';
    input.autocomplete = 'off';
    input.setAttribute('aria-label', 'Another featured artist');
    input.value = value || '';
    input.addEventListener('input', function () { changed(first()); });
    var remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'featured-remove';
    remove.setAttribute('aria-label', 'Remove featured artist');
    remove.textContent = '\u00d7';
    remove.addEventListener('click', function () {
      row.parentNode.removeChild(row);
      changed(first());
    });
    row.appendChild(input);
    row.appendChild(remove);
    box.appendChild(row);
    if (focus) input.focus();
    return input;
  }
  function names() {
    var out = [];
    var f = first();
    if (f && f.value.trim()) out.push(f.value.trim());
    var extras = document.querySelectorAll('.tg-featured-extra');
    for (var i = 0; i < extras.length; i++) {
      var v = extras[i].value.trim();
      if (v) out.push(v);
    }
    return out;
  }
  function set(value) {
    var parts = Array.isArray(value) ? value : String(value || '').split(',');
    parts = parts.map(function (p) { return String(p || '').trim(); }).filter(Boolean);
    var box = list();
    if (box) box.innerHTML = '';
    var f = first();
    if (f) f.value = parts[0] || '';
    for (var i = 1; i < parts.length; i++) addRow(parts[i], false);
  }
  window.plaiFeatured = {
    names: names,
    value: function () { return names().join(', '); },
    set: set,
    add: addRow,
  };
  function init() {
    var btn = document.getElementById('tg-featured-add');
    if (btn) btn.addEventListener('click', function () { addRow('', true); });
    var f = first();
    if (f && f.value.indexOf(',') !== -1) set(f.value);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
