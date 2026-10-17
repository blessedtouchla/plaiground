/**
 * Public Stage tiles on an EPK page.
 * Stays quiet when STAGE_ENABLED is off.
 */
(function (root) {
  function enabled() {
    return root.PlaigroundFeatures && root.PlaigroundFeatures.enabled('STAGE_ENABLED');
  }

  function paint(host, epk) {
    if (!enabled() || !host || !epk) return;
    var tiles = Array.isArray(epk.stage) ? epk.stage : [];
    if (!tiles.length) return;
    if (host.querySelector('[data-stage-public]')) return;
    var section = root.document.createElement('section');
    section.className = 'stage-public';
    section.setAttribute('data-stage-public', '1');
    var heading = root.document.createElement('h2');
    heading.textContent = 'Stage';
    var intro = root.document.createElement('p');
    intro.textContent = 'Songs on this stage. Tap one to play the hook. No account needed.';
    var grid = root.document.createElement('div');
    grid.className = 'stage-tiles';
    tiles.forEach(function (tile) {
      var card = root.document.createElement(tile && tile.href ? 'a' : 'div');
      card.className = 'stage-tile';
      if (tile && tile.href) card.setAttribute('href', tile.href);
      var name = root.document.createElement('strong');
      name.textContent = (tile && tile.title) || 'Untitled';
      var note = root.document.createElement('span');
      note.textContent = tile && tile.href ? 'Play the hook' : 'On the stage';
      card.appendChild(name);
      card.appendChild(note);
      grid.appendChild(card);
    });
    section.appendChild(heading);
    section.appendChild(intro);
    section.appendChild(grid);
    host.appendChild(section);
  }

  root.PlaigroundStagePublic = { paint: paint };
})(typeof window !== 'undefined' ? window : globalThis);
