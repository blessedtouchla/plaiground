/**
 * Opens the Cover Art generator in a same-page panel.
 * A picked image is dropped onto the existing cover input.
 */
(function (root) {
  var doc = root.document;
  if (!doc || !doc.querySelector) return;
  var openBtn = doc.querySelector('[data-cover-make]');
  var modal = doc.querySelector('[data-cover-make-modal]');
  var frame = doc.querySelector('[data-cover-make-frame]');
  if (!openBtn || !modal || !frame) return;

  function fieldValue(id) {
    var el = doc.getElementById(id);
    return el && el.value ? String(el.value).trim() : '';
  }

  function artistName() {
    var select = doc.getElementById('tg-artist-select');
    if (select && select.value) {
      var option = select.options && select.options[select.selectedIndex];
      var label = option ? String(option.textContent || '').trim() : '';
      if (label && label !== 'Select an artist') return label;
    }
    return fieldValue('tg-artist-new') || fieldValue('tg-artist-link-name') || fieldValue('tg-artist');
  }

  function sendPrefill() {
    if (!frame.contentWindow) return;
    var src = String(frame.getAttribute('src') || '');
    if (src.indexOf('embed=1') === -1) return;
    try {
      frame.contentWindow.postMessage({
        type: 'plaiground-cover-prefill',
        title: fieldValue('tg-title'),
        artist: artistName()
      }, root.location.origin);
    } catch (err) {}
  }

  function openModal() {
    modal.hidden = false;
    if (doc.body && doc.body.classList) doc.body.classList.add('cover-make-open');
    frame.setAttribute('src', 'cover-art.html?embed=1');
    var closeBtn = modal.querySelector('.cover-make-bar [data-cover-make-close]');
    if (closeBtn && closeBtn.focus) closeBtn.focus();
  }

  function closeModal() {
    modal.hidden = true;
    if (doc.body && doc.body.classList) doc.body.classList.remove('cover-make-open');
    frame.setAttribute('src', 'about:blank');
    if (openBtn && openBtn.focus) openBtn.focus();
  }

  function fileFromPick(data) {
    var mime = data.mime || 'image/jpeg';
    var name = data.name || 'plaiground-cover.jpg';
    if (!/\.jpe?g$/i.test(name)) name = 'plaiground-cover.jpg';
    try {
      return new File([data.buffer], name, { type: mime });
    } catch (err) {
      var blob = new Blob([data.buffer], { type: mime });
      blob.name = name;
      return blob;
    }
  }

  function dropCover(data) {
    var input = doc.querySelector('[data-art-input]');
    if (!input || !data || !data.buffer) return;
    (root.PlaigroundEventQueue = root.PlaigroundEventQueue || []).push({ name: 'cover_art_used', payload: {} });
    var file = fileFromPick(data);
    input._plaigroundUserPick = true;
    input._plaigroundFile = file;
    try {
      var Transfer = root.DataTransfer || (typeof DataTransfer !== 'undefined' ? DataTransfer : null);
      if (Transfer) {
        var dt = new Transfer();
        if (dt.items && dt.items.add) dt.items.add(file);
        if (dt.files) input.files = dt.files;
      }
    } catch (err) {}
    try {
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (err2) {}
    closeModal();
  }

  openBtn.addEventListener('click', function (event) {
    if (event && event.preventDefault) event.preventDefault();
    if (event && event.stopPropagation) event.stopPropagation();
    openModal();
  });

  modal.addEventListener('click', function (event) {
    var node = event && event.target;
    while (node && node !== modal) {
      if (node.getAttribute && node.getAttribute('data-cover-make-close') != null) {
        if (event.preventDefault) event.preventDefault();
        closeModal();
        return;
      }
      node = node.parentNode;
    }
  });

  doc.addEventListener('keydown', function (event) {
    if (!event || event.key !== 'Escape' || modal.hidden) return;
    closeModal();
  });

  frame.addEventListener('load', sendPrefill);

  root.addEventListener('message', function (event) {
    if (!event || event.origin !== root.location.origin) return;
    var data = event.data || {};
    if (data.type !== 'plaiground-cover-pick') return;
    dropCover(data);
  });
})(typeof window !== 'undefined' ? window : this);
