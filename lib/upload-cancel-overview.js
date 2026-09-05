(function (root) {
  var OVERVIEW = 'dashboard.html';

  function goOverview(event) {
    if (event) {
      if (event.preventDefault) event.preventDefault();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      if (event.stopPropagation) event.stopPropagation();
    }
    try {
      if (root.localStorage) {
        root.localStorage.removeItem('plaiground.store.draft');
        root.localStorage.removeItem('plaiground.tonegrid.draft');
        root.localStorage.removeItem('plaiground.store.held_draft');
      }
    } catch (err) {}
    try {
      if (root.location && typeof root.location.replace === 'function') {
        root.location.replace(OVERVIEW);
        return;
      }
    } catch (err2) {}
    try { root.location.href = OVERVIEW; } catch (err3) {}
  }

  function bind() {
    var doc = root.document;
    if (!doc || !doc.addEventListener) return;
    if (doc.documentElement && doc.documentElement.getAttribute('data-cancel-overview') === 'true') return;
    if (doc.documentElement && doc.documentElement.setAttribute) {
      doc.documentElement.setAttribute('data-cancel-overview', 'true');
    }
    doc.addEventListener('click', function (event) {
      var node = event.target;
      var btn = null;
      while (node && node !== doc) {
        if (node.getAttribute && node.getAttribute('data-upload-cancel') != null) {
          btn = node;
          break;
        }
        node = node.parentNode;
      }
      if (!btn) return;
      goOverview(event);
    }, true);
  }

  if (root.document && root.document.readyState === 'loading') {
    root.document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})(typeof window !== 'undefined' ? window : this);
