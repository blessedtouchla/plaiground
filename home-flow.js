// "Start where you are" segmented control: one line and one button per stage.
(function () {
  var ROUTES = {
    idea: { title: 'Turn your idea into a song.', line: 'Write it with Plai in Song Lab. You set the vision.', cta: 'Open Song Lab', href: '/song-helper' },
    made: { title: 'Got a song? Get it ready.', line: 'Check it, sign the splits, then release it to every major store.', cta: 'Is my song ready?', href: '/qualify' },
    out: { title: 'Already out? Build on it.', line: 'Press kit, A&R pack and your route for what comes next.', cta: 'See my roadmap', href: '/destination' }
  };
  var root = document.querySelector('.hf-route');
  if (!root) return;
  var title = root.querySelector('[data-hf-title]');
  var line = root.querySelector('[data-hf-line]');
  var cta = root.querySelector('[data-hf-cta]');
  Array.prototype.forEach.call(root.querySelectorAll('[data-hf]'), function (b) {
    b.addEventListener('click', function () {
      var r = ROUTES[b.getAttribute('data-hf')];
      if (!r) return;
      Array.prototype.forEach.call(root.querySelectorAll('[data-hf]'), function (x) { x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
      title.textContent = r.title; line.textContent = r.line; cta.textContent = r.cta; cta.setAttribute('href', r.href);
    });
  });
})();
