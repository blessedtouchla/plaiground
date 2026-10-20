// Arcade brand layer: fade sections in as they scroll into view. Skipped when reduced motion is on.
(function () {
  if (!('IntersectionObserver' in window)) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var items = document.querySelectorAll('.hf-icons li, .hj-step, .hj-tool-row a, .hf-trio-row a');
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('ba-in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px' });
  Array.prototype.forEach.call(items, function (n) { if (n.getBoundingClientRect().top > window.innerHeight) { n.classList.add('ba-reveal'); io.observe(n); } });
})();
