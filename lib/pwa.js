/**
 * Home-screen install tags + service worker.
 * Does not change upload or store hops.
 */
(function (root) {
  var doc = root.document;
  if (!doc || !doc.head) return;

  function ensure(tag, attrs) {
    var i;
    var nodes = doc.head.querySelectorAll(tag);
    for (i = 0; i < nodes.length; i += 1) {
      var ok = true;
      Object.keys(attrs).forEach(function (key) {
        if (String(nodes[i].getAttribute(key) || '') !== String(attrs[key])) ok = false;
      });
      if (ok) return nodes[i];
    }
    var el = doc.createElement(tag);
    Object.keys(attrs).forEach(function (key) {
      el.setAttribute(key, attrs[key]);
    });
    doc.head.appendChild(el);
    return el;
  }

  ensure('link', { rel: 'manifest', href: 'manifest.webmanifest' });
  ensure('link', { rel: 'apple-touch-icon', href: 'assets/plaiground-logo.png' });
  ensure('meta', { name: 'theme-color', content: '#0B0B0F' });
  ensure('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' });
  ensure('meta', { name: 'apple-mobile-web-app-title', content: 'PLAIGROUND' });
  ensure('meta', { name: 'mobile-web-app-capable', content: 'yes' });

  if (root.navigator && root.navigator.serviceWorker && root.location && root.location.protocol.indexOf('http') === 0) {
    root.navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})(typeof window !== 'undefined' ? window : this);
