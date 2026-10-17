/**
 * Lyric Racer. A short road, three lanes, and the song's colors.
 * Plain canvas. No engine. Reduced motion uses lane buttons instead of a scroll.
 */
(function (root) {
  var raf = 0;
  var running = false;
  var onKey = null;
  var touch = null;

  function stop() {
    running = false;
    if (raf) root.cancelAnimationFrame(raf);
    raf = 0;
    if (onKey) root.removeEventListener('keydown', onKey);
    onKey = null;
    if (touch && touch.el) {
      touch.el.removeEventListener('touchstart', touch.start);
      touch.el.removeEventListener('touchend', touch.end);
      touch.el.removeEventListener('pointerdown', touch.pointer);
    }
    touch = null;
  }

  function speedLabel(speed) {
    return 'Speed ' + Math.max(1, Math.round((speed / 0.55) * 100));
  }

  function start(session) {
    stop();
    var tools = root.PlaigroundSongGame;
    var level = session.level || {};
    var course = tools && tools.courseFor ? tools.courseFor(level, session.hookLines) : [];
    if (!course.length) {
      session.finish();
      return;
    }
    var lane = 1;
    var index = 0;
    var depth = 0.4;
    var speed = 0.24;
    var combo = 0;
    var started = Date.now();
    var colors = session.colors && session.colors.length ? session.colors : ['#7D3CFF', '#FF3C8E', '#F5C542'];
    running = true;
    session.setMeter(speedLabel(speed));
    session.setLine(course[0].line);

    function finishCourse() {
      if (!running || session.isDone()) return;
      var elapsed = (Date.now() - started) / 1000;
      var timeBonus = Math.max(0, Math.round(1800 - elapsed * 25));
      session.addScore(timeBonus);
      session.finish();
      stop();
    }

    function resolve(row) {
      var pad = row.pads[lane];
      if (pad && pad.correct) {
        combo += 1;
        var points = 80 * combo;
        if (pad.boost) {
          points += 60;
          speed = Math.min(0.55, speed * 1.16);
        }
        session.addScore(points);
        session.setCombo(combo);
      } else {
        combo = 0;
        speed = Math.max(0.1, speed * 0.7);
        session.setCombo(0);
        session.miss(row.line);
      }
      session.setMeter(speedLabel(speed));
      index += 1;
      depth = 0.28;
      if (index >= course.length) finishCourse();
      else session.setLine(course[index].line);
    }

    function steer(next) {
      lane = Math.max(0, Math.min(2, next));
    }

    if (session.reduced) {
      var sky = session.sky;
      if (!sky) return;
      sky.hidden = false;
      sky.textContent = '';
      sky.classList.add('is-still', 'is-racer');
      function paintStill() {
        if (!running) return;
        sky.textContent = '';
        var row = course[index];
        if (!row) return;
        row.pads.forEach(function (pad, padLane) {
          var button = root.document.createElement('button');
          button.type = 'button';
          button.className = 'play-word' + (pad && pad.correct ? '' : ' is-decoy') + (padLane === lane ? ' is-caught' : '');
          button.textContent = pad ? pad.text : 'Open lane';
          button.addEventListener('click', function () {
            steer(padLane);
            resolve(course[index]);
            if (running) paintStill();
          });
          sky.appendChild(button);
        });
      }
      onKey = function (event) {
        if (!running) return;
        if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') steer(lane - 1);
        if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') steer(lane + 1);
        if (event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          resolve(course[index]);
          if (running) paintStill();
        }
      };
      root.addEventListener('keydown', onKey);
      paintStill();
      return;
    }

    var canvas = session.canvas;
    if (!canvas) return;
    canvas.hidden = false;
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
    onKey = function (event) {
      if (!running) return;
      if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') steer(lane - 1);
      if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') steer(lane + 1);
    };
    root.addEventListener('keydown', onKey);
    var startX = 0;
    touch = {
      el: canvas,
      start: function (event) {
        startX = event.changedTouches && event.changedTouches[0] ? event.changedTouches[0].clientX : 0;
      },
      end: function (event) {
        var endX = event.changedTouches && event.changedTouches[0] ? event.changedTouches[0].clientX : startX;
        if (endX - startX > 28) steer(lane + 1);
        else if (startX - endX > 28) steer(lane - 1);
      },
      pointer: function (event) {
        var rect = canvas.getBoundingClientRect();
        var x = event.clientX - rect.left;
        if (x < rect.width / 3) steer(lane - 1);
        else if (x > rect.width * 2 / 3) steer(lane + 1);
      },
    };
    canvas.addEventListener('touchstart', touch.start, { passive: true });
    canvas.addEventListener('touchend', touch.end, { passive: true });
    canvas.addEventListener('pointerdown', touch.pointer);
    var last = Date.now();
    function frame() {
      if (!running) return;
      var now = Date.now();
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      depth += speed * dt;
      if (depth >= 1) resolve(course[Math.min(index, course.length - 1)]);
      if (!running) return;
      draw(fit());
      raf = root.requestAnimationFrame(frame);
    }
    function draw(box) {
      var width = box.width;
      var height = box.height;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, height);
      var horizon = height * 0.18;
      ctx.fillStyle = colors[0] || '#7D3CFF';
      ctx.beginPath();
      ctx.moveTo(width * 0.5, horizon);
      ctx.lineTo(width * 0.08, height);
      ctx.lineTo(width * 0.92, height);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(245, 197, 66, 0.85)';
      ctx.lineWidth = 3;
      [0.33, 0.66].forEach(function (at) {
        ctx.beginPath();
        ctx.moveTo(width * 0.5, horizon);
        ctx.lineTo(width * (0.08 + 0.84 * at), height);
        ctx.stroke();
      });
      var row = course[index];
      if (row) {
        if (row.last) {
          ctx.fillStyle = '#F5C542';
          var lineY = horizon + (height - horizon) * Math.min(depth, 0.92);
          ctx.fillRect(width * 0.2, lineY, width * 0.6, 8);
        }
        row.pads.forEach(function (pad, padLane) {
          if (!pad) return;
          var spread = (0.18 + depth * 0.7) * width;
          var x = width * 0.5 + (padLane - 1) * spread * 0.42;
          var y = horizon + (height - horizon - 90) * depth;
          ctx.fillStyle = pad.boost ? '#F5C542' : (pad.correct ? '#fff' : '#161616');
          ctx.strokeStyle = pad.boost ? '#F5C542' : (colors[1] || '#FF3C8E');
          ctx.lineWidth = 2;
          var w = 70 + depth * 46;
          var h = 28 + depth * 16;
          ctx.beginPath();
          ctx.roundRect(x - w / 2, y - h / 2, w, h, 14);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = pad.boost || pad.correct ? '#111' : '#F5C542';
          ctx.font = '700 ' + Math.round(14 + depth * 8) + 'px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(pad.text, x, y);
        });
      }
      var carSpread = width * 0.28;
      var carX = width * 0.5 + (lane - 1) * carSpread;
      var carY = height - 78;
      ctx.fillStyle = colors[1] || '#FF3C8E';
      ctx.beginPath();
      ctx.roundRect(carX - 28, carY - 16, 56, 36, 12);
      ctx.fill();
      ctx.fillStyle = colors[2] || '#F5C542';
      ctx.fillRect(carX - 16, carY - 8, 32, 12);
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(carX - 16, carY + 20, 6, 0, Math.PI * 2);
      ctx.arc(carX + 16, carY + 20, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    draw(fit());
    raf = root.requestAnimationFrame(frame);
  }

  root.PlaigroundLyricRacer = { start: start, stop: stop };
})(typeof window !== 'undefined' ? window : globalThis);
