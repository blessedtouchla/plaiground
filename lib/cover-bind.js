(function (root) {
  function bindCover() {
    var input = document.querySelector('[data-art-input]');
    if (!input) return;
    var picks = document.querySelectorAll('[data-art-pick]');
    var i;
    for (i = 0; i < picks.length; i += 1) {
      picks[i].addEventListener('click', function (event) {
        if (event && event.preventDefault) event.preventDefault();
        input.click();
      });
    }
    if (root.PlaigroundCoverPreview && typeof root.PlaigroundCoverPreview.bind === 'function') {
      root.PlaigroundCoverPreview.bind({
        input: input,
        tile: document.querySelector('[data-art-box]'),
        note: document.querySelector('[data-art-meta]'),
        clearButton: document.querySelector('[data-art-clear]'),
        emptyNote: '3000 \u00d7 3000 px \u00b7 JPG or PNG',
        hasNote: 'Cover ready'
      });
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindCover);
  } else {
    bindCover();
  }
})(typeof window !== 'undefined' ? window : this);
