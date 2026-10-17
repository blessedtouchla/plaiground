/**
 * Stage Hero. Notes from the lyric, timed by the mood.
 * Pass a beat map to PlaigroundSongGame.chartFor later and these notes can be replaced.
 * Plain canvas. No engine. Reduced motion steps the notes instead of sliding them.
 */
(function (root) {
  var raf = 0;
  var running = false;
  var onKey = null;
  var onPointer = null;
  var canvasEl = null;

  function stop() {
    running = false;
    if (raf) root.cancelAnimationFrame(raf);
    raf = 0;
    if (onKey) root.removeEventListener('keydown', onKey);
    onKey = null;
    if (canvasEl && onPointer) canvasEl.removeEventListener('pointerdown', onPointer);
    canvasEl = null;
    onPointer = null;
  }

  function start(session) {
    stop();
    var tools = root.PlaigroundSongGame;
    var level = session.level || {};
    var chart = tools && tools.chartFor ? tools.chartFor(level, session.mood, level.beats) : { notes: [], bpm: 100, source: 'mood' };
    var notes = chart.notes || [];
    if (!notes.length) {
      session.finish();
      return;
    }
    var colors = session.colors && session.colors.length ? session.colors : ['#7D3CFF', '#FF3C8E', '#F5C542'];
    var playhead = 0;
    var combo = 0;
    var cursor = 0;
    running = true;
    session.setMeter('Hit');
    session.setLine(notes[0].line);

    function hitLane(lane) {
      if (!running || session.isDone()) return;
      var windowSec = 0.18;
      var found = null;
      notes.forEach(function (note) {
        if (found || note.done || note.lane !== lane) return;
        if (Math.abs(note.time - playhead) <= windowSec) found = note;
      });
      if (!found && session.reduced) {
        notes.forEach(function (note) {
          if (found || note.done) return;
          if (note.lane === lane && note.index === cursor) found = note;
        });
      }
      if (!found) {
        combo = 0;
        session.setCombo(0);
        session.miss(notes[cursor] ? notes[cursor].line : '');
        return;
      }
      found.done = true;
      combo += 1;
      session.setCombo(combo);
      session.addScore(100 * combo);
      while (notes[cursor] && notes[cursor].done) cursor += 1;
      if (notes[cursor]) session.setLine(notes[cursor].line);
      if (cursor >= notes.length) {
        session.finish();
        stop();
      }
    }

    function missLate() {
      notes.forEach(function (note) {
        if (note.done || note.time + 0.22 >= playhead) return;
        note.done = true;
        combo = 0;
        session.setCombo(0);
        session.miss(note.line);
      });
      while (notes[cursor] && notes[cursor].done) cursor += 1;
      if (notes[cursor]) session.setLine(notes[cursor].line);
      if (cursor >= notes.length && running) {
        session.finish();
        stop();
      }
    }

    onKey = function (event) {
      var lanes = { a: 0, A: 0, s: 1, S: 1, d: 2, D: 2, f: 3, F: 3 };
      if (event.key === 'ArrowLeft') hitLane(0);
      else if (event.key === 'ArrowDown') hitLane(1);
      else if (event.key === 'ArrowUp') hitLane(2);
      else if (event.key === 'ArrowRight') hitLane(3);
      else if (lanes[event.key] !== undefined) hitLane(lanes[event.key]);
    };
    root.addEventListener('keydown', onKey);

    if (session.reduced) {
      var sky = session.sky;
      if (!sky) return;
      sky.hidden = false;
      sky.textContent = '';
      sky.classList.add('is-still', 'is-hero');
      function paintStill() {
        if (!running) return;
        sky.textContent = '';
        var upcoming = notes.filter(function (note) { return !note.done; }).slice(0, 4);
        for (var lane = 0; lane < 4; lane += 1) {
          var button = root.document.createElement('button');
          button.type = 'button';
          var note = null;
          upcoming.forEach(function (item) {
            if (!note && item.lane === lane) note = item;
          });
          button.className = 'play-word' + (note && note.index === cursor ? ' is-caught' : ' is-decoy');
          button.textContent = note && note.word ? note.word : 'Lane ' + (lane + 1);
          button.addEventListener('click', function () {
            hitLane(lane);
            if (running) paintStill();
          });
          sky.appendChild(button);
        }
      }
      paintStill();
      var originalHit = hitLane;
      hitLane = function (lane) {
        originalHit(lane);
      };
      return;
    }

    var canvas = session.canvas;
    if (!canvas) return;
    canvas.hidden = false;
    canvasEl = canvas;
    var ctx = canvas.getContext('2d');
    function fit() {
      var width = canvas.clientWidth || (canvas.parentElement && canvas.parentElement.clientWidth) || 360;
      var height = canvas.clientHeight || 520;
      var ratio = root.devicePixelRatio || 1;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      return { width: width, height: height };
    }
    onPointer = function (event) {
      var rect = canvas.getBoundingClientRect();
      var x = event.clientX - rect.left;
      var lane = Math.max(0, Math.min(3, Math.floor(x / (rect.width / 4))));
      hitLane(lane);
    };
    canvas.addEventListener('pointerdown', onPointer);
    var last = Date.now();
    var step = session.reduced ? 0.2 : 0;
    function frame() {
      if (!running) return;
      var now = Date.now();
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (session.reduced) {
        step += dt;
        if (step >= 0.2) {
          playhead += 0.2;
          step = 0;
        }
      } else {
        playhead += dt;
      }
      missLate();
      if (!running) return;
      draw(fit());
      raf = root.requestAnimationFrame(frame);
    }
    function draw(box) {
      var width = box.width;
      var height = box.height;
      var hitY = height * 0.78;
      var px = 240;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, height);
      var laneW = width / 4;
      for (var lane = 0; lane < 4; lane += 1) {
        ctx.fillStyle = lane % 2 === 0 ? 'rgba(125, 60, 255, 0.18)' : 'rgba(255, 60, 142, 0.12)';
        ctx.fillRect(lane * laneW, 0, laneW - 4, height);
      }
      ctx.fillStyle = colors[2] || '#F5C542';
      ctx.fillRect(0, hitY, width, 6);
      notes.forEach(function (note) {
        if (note.done) return;
        var y = hitY - (note.time - playhead) * px;
        if (y < -40 || y > height + 20) return;
        var x = note.lane * laneW + laneW / 2;
        ctx.fillStyle = note.word ? (colors[0] || '#7D3CFF') : (colors[1] || '#FF3C8E');
        ctx.beginPath();
        ctx.roundRect(x - laneW * 0.32, y - 16, laneW * 0.64, 32, 12);
        ctx.fill();
        if (note.word) {
          ctx.fillStyle = '#fff';
          ctx.font = '700 14px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(note.word, x, y);
        }
      });
    }
    draw(fit());
    raf = root.requestAnimationFrame(frame);
  }

  root.PlaigroundStageHero = { start: start, stop: stop };
})(typeof window !== 'undefined' ? window : globalThis);
