/**
 * Lyric Racer. An original chase-cam kart on a curvy track.
 * Mood colors, two rival karts, drift boosts, and lyric word boxes.
 * Plain canvas. No engine. Reduced motion steps the gates instead of moving the camera.
 */
(function (root) {
  var raf = 0;
  var running = false;
  var cleanups = [];

  function stop() {
    running = false;
    if (raf) root.cancelAnimationFrame(raf);
    raf = 0;
    cleanups.forEach(function (fn) { fn(); });
    cleanups = [];
    var canvas = root.document && root.document.querySelector('[data-play-canvas]');
    if (canvas) canvas.classList.remove('is-race');
    var steer = root.document && root.document.querySelector('[data-steer]');
    if (steer) steer.hidden = true;
  }

  function listen(target, name, fn) {
    target.addEventListener(name, fn);
    cleanups.push(function () { target.removeEventListener(name, fn); });
  }

  function rgb(hex, mix, toward) {
    function parts(value) {
      var h = String(value || '').replace('#', '');
      if (h.length !== 6) return [125, 60, 255];
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }
    var a = parts(hex);
    var b = parts(toward || '#000000');
    var t = mix || 0;
    return 'rgb(' + a.map(function (channel, index) {
      return Math.max(0, Math.min(255, Math.round(channel + (b[index] - channel) * t)));
    }).join(',') + ')';
  }

  function rounded(ctx, x, y, w, h, r) {
    var radius = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function buildSegments(track) {
    var segments = [];
    function pushRun(count, curve, extra) {
      for (var i = 0; i < count; i += 1) {
        segments.push({
          curve: curve,
          straight: !!extra.straight,
          gate: i === count - 1 ? extra.gate : null,
          finish: false,
          lap: extra.lap || 0,
          lapName: extra.name || '',
          line: extra.line || '',
        });
      }
    }
    var firstStretch = (track.stretches || [])[0];
    pushRun(12, firstStretch && firstStretch.straight ? 0 : 0.28, {
      straight: !!(firstStretch && firstStretch.straight),
      gate: null,
      lap: firstStretch ? firstStretch.lap : 1,
      name: firstStretch ? firstStretch.name : '',
      line: track.finishLine || '',
    });
    (track.stretches || []).forEach(function (stretch) {
      (stretch.words || []).forEach(function (gate, index) {
        var curve = stretch.straight ? 0 : (index % 2 === 0 ? 0.46 : -0.52);
        pushRun(stretch.straight ? 8 : 11, curve, {
          straight: stretch.straight,
          gate: gate,
          lap: stretch.lap,
          name: stretch.name,
          line: gate.line,
        });
      });
    });
    pushRun(7, 0, { straight: true, gate: null, lap: 0, name: 'Finish', line: track.finishLine });
    if (segments.length) {
      segments[segments.length - 1].finish = true;
      segments[segments.length - 1].line = track.finishLine;
    }
    var world = 0;
    segments.forEach(function (seg) {
      world += seg.curve;
      seg.worldX = world;
    });
    return segments;
  }

  function start(session) {
    stop();
    var tools = root.PlaigroundSongGame;
    var level = session.level || {};
    var track = tools && tools.trackFor ? tools.trackFor(level, session.hookLines) : null;
    if (!track || !track.stretches || !track.stretches.length) {
      session.finish();
      return;
    }
    var colors = session.colors && session.colors.length ? session.colors : ['#7D3CFF', '#FF3C8E', '#F5C542'];
    var segments = buildSegments(track);
    var rivals = [
      { pos: 18, x: -0.42, rate: 7.1, color: rgb(colors[0], 0.35, '#FFFFFF') },
      { pos: 12, x: 0.38, rate: 6.3, color: rgb(colors[2] || '#F5C542', 0.1, '#FFFFFF') },
    ];
    var pos = 1;
    var playerX = 0;
    var camX = 0;
    var speed = 10;
    var steer = 0;
    var drift = 0;
    var boost = 0;
    var spin = 0;
    var spinAngle = 0;
    var combo = 0;
    var lapNow = 1;
    var lastIndex = 1;
    var started = Date.now();
    var placeNames = ['', '1st place', '2nd place', '3rd place'];
    running = true;

    function placeNow() {
      var place = 1;
      rivals.forEach(function (rival) {
        if (rival.pos > pos) place += 1;
      });
      return place;
    }

    function paintMeter() {
      var place = placeNow();
      session.setMeter((placeNames[place] || (place + 'th place')).replace(' place', '') + '. Speed ' + Math.max(1, Math.round(speed * 6)));
    }

    function showLine(seg) {
      if (!seg) return;
      if (seg.lap) lapNow = seg.lap;
      var label = seg.straight && seg.lapName === 'Hook straight' ? 'Hook straight' : ('Lap ' + lapNow + ' of ' + track.lapTotal);
      if (seg.finish) label = 'Finish';
      session.setLine(label + '. ' + (seg.line || track.finishLine || ''));
    }

    function endRace() {
      if (!running || session.isDone()) return;
      running = false;
      var place = placeNow();
      var elapsed = (Date.now() - started) / 1000;
      var placeBonus = place === 1 ? 500 : (place === 2 ? 250 : 100);
      session.addScore(Math.max(0, Math.round(1600 - elapsed * 18)) + placeBonus);
      session.setResult(placeNames[place] || (place + 'th place'));
      session.setLine(track.finishLine);
      session.finish();
      stop();
    }

    function resolveGate(seg, lane) {
      if (!seg || !seg.gate || seg.gate.used) return;
      seg.gate.used = true;
      var pad = seg.gate.pads[lane];
      showLine(seg);
      if (pad && pad.correct) {
        combo += 1;
        var points = 90 * combo;
        boost = Math.max(boost, seg.straight ? 1.45 : 0.95);
        if (seg.straight) points += 50;
        session.addScore(points);
        session.setCombo(combo);
        return;
      }
      combo = 0;
      spin = 0.9;
      boost = 0;
      session.setCombo(0);
      session.miss(seg.line);
    }

    function holdSteer(dir) {
      steer = dir;
    }

    function releaseSteer() {
      if (drift > 0.28 && spin <= 0) {
        boost = Math.max(boost, 1.2);
        combo += 1;
        session.addScore(40 * combo);
        session.setCombo(combo);
      }
      drift = 0;
      steer = 0;
    }

    var canvas = session.canvas;
    var steerBar = root.document.querySelector('[data-steer]');
    if (canvas) {
      canvas.hidden = false;
      canvas.classList.add('is-race');
    }
    if (steerBar) steerBar.hidden = false;
    showLine(segments[Math.min(segments.length - 1, 8)] || segments[0]);
    paintMeter();

    function bindHold(button, dir) {
      if (!button) return;
      listen(button, 'pointerdown', function (event) {
        event.preventDefault();
        holdSteer(dir);
        try { button.setPointerCapture(event.pointerId); } catch (err) {}
      });
      listen(button, 'pointerup', function () {
        if (steer === dir) releaseSteer();
      });
      listen(button, 'pointercancel', function () {
        if (steer === dir) releaseSteer();
      });
    }
    if (steerBar) {
      bindHold(steerBar.querySelector('[data-steer-left]'), -1);
      bindHold(steerBar.querySelector('[data-steer-right]'), 1);
    }
    var keyDir = 0;
    listen(root, 'keydown', function (event) {
      if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
        keyDir = -1;
        holdSteer(-1);
      } else if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
        keyDir = 1;
        holdSteer(1);
      }
    });
    listen(root, 'keyup', function (event) {
      var dir = 0;
      if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') dir = -1;
      if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') dir = 1;
      if (dir && dir === keyDir) {
        keyDir = 0;
        releaseSteer();
      }
    });

    if (session.reduced) {
      var sky = session.sky;
      var stillPos = 2;
      function nextGate() {
        for (var i = Math.floor(stillPos); i < segments.length; i += 1) {
          if (segments[i].gate && !segments[i].gate.used) return segments[i];
        }
        return null;
      }
      function paintStill() {
        if (!running) return;
        var gate = nextGate();
        if (!gate) {
          pos = segments.length;
          endRace();
          return;
        }
        stillPos = Math.max(1, segments.indexOf(gate) - 6);
        pos = stillPos;
        draw();
        if (!sky) return;
        sky.hidden = false;
        sky.textContent = '';
        sky.classList.add('is-still', 'is-racer');
        gate.pads.forEach(function (pad, lane) {
          var button = root.document.createElement('button');
          button.type = 'button';
          button.className = 'play-word' + (pad && pad.correct ? '' : ' is-decoy');
          button.textContent = pad ? pad.text : 'Open';
          button.addEventListener('click', function () {
            playerX = lane === 0 ? -0.7 : (lane === 2 ? 0.7 : 0);
            resolveGate(gate, lane);
            rivals.forEach(function (rival) { rival.pos += pad && pad.correct ? 4 : 9; });
            stillPos = segments.indexOf(gate) + 1;
            paintMeter();
            if (running) paintStill();
          });
          sky.appendChild(button);
        });
      }
      paintStill();
      return;
    }

    if (canvas) {
      var dragX = 0;
      listen(canvas, 'pointerdown', function (event) {
        dragX = event.clientX;
        var rect = canvas.getBoundingClientRect();
        holdSteer(event.clientX < rect.left + rect.width / 2 ? -1 : 1);
      });
      listen(canvas, 'pointermove', function (event) {
        if (!steer) return;
        var dx = event.clientX - dragX;
        if (dx > 30) holdSteer(1);
        else if (dx < -30) holdSteer(-1);
      });
      listen(canvas, 'pointerup', releaseSteer);
      listen(canvas, 'pointercancel', releaseSteer);
    }

    var last = Date.now();
    function frame() {
      if (!running) return;
      var now = Date.now();
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (steer && spin <= 0) {
        drift += dt;
        playerX += steer * (1.55 - Math.min(drift, 0.9) * 0.5) * dt;
      }
      if (playerX > 1.35) playerX = 1.35;
      if (playerX < -1.35) playerX = -1.35;
      var index = Math.min(segments.length - 1, Math.floor(pos));
      var onRoad = Math.abs(playerX) < 1.02;
      var top = onRoad ? 13.5 : 5.5;
      if (segments[index] && segments[index].straight && onRoad && spin <= 0) top += 3.5;
      if (boost > 0) top = 21;
      if (spin > 0) top = 2.4;
      speed += (top - speed) * Math.min(1, dt * 2.4);
      pos += speed * dt;
      boost = Math.max(0, boost - dt);
      spin = Math.max(0, spin - dt);
      spinAngle = spin > 0 ? spinAngle + dt * 16 : spinAngle * 0.86;
      camX += (playerX - camX) * Math.min(1, dt * 3.2);
      rivals.forEach(function (rival, rivalIndex) {
        if (rival.pos < segments.length) rival.pos += rival.rate * dt;
        rival.x = Math.max(-0.75, Math.min(0.75, rival.x + Math.sin(now / 380 + rivalIndex * 2) * 0.012));
      });
      var crossed = Math.floor(pos);
      if (crossed > lastIndex) {
        for (var step = lastIndex + 1; step <= crossed && step < segments.length; step += 1) {
          var seg = segments[step];
          showLine(seg);
          if (seg.gate) {
            var lane = playerX < -0.33 ? 0 : (playerX > 0.33 ? 2 : 1);
            resolveGate(seg, lane);
          }
          if (seg.finish || step >= segments.length - 1) endRace();
        }
        lastIndex = crossed;
      }
      if (!running) return;
      paintMeter();
      draw();
      raf = root.requestAnimationFrame(frame);
    }

    function draw() {
      if (!canvas) return;
      var ctx = canvas.getContext('2d');
      var width = canvas.clientWidth || (canvas.parentElement && canvas.parentElement.clientWidth) || 360;
      var height = canvas.clientHeight || 520;
      var ratio = root.devicePixelRatio || 1;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      var horizon = height * 0.42;
      var focal = 300;
      var lengthUnit = 10;
      var base = Math.max(0, Math.floor(pos));
      var frac = pos - Math.floor(pos);
      var camWorld = (segments[Math.min(base, segments.length - 1)].worldX || 0) + camX * 6;
      ctx.fillStyle = rgb(colors[0], 0.45, '#9fd0ff');
      ctx.fillRect(0, 0, width, height);
      var sky = ctx.createLinearGradient(0, 0, 0, horizon);
      sky.addColorStop(0, rgb(colors[2] || '#F5C542', 0.62, '#FFFFFF'));
      sky.addColorStop(1, rgb(colors[1] || colors[0], 0.2, '#8ec8ff'));
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, horizon + 2);
      ctx.fillStyle = rgb(colors[0], 0.25, '#112233');
      ctx.beginPath();
      ctx.moveTo(0, horizon);
      for (var hill = 0; hill <= width; hill += 16) {
        ctx.lineTo(hill, horizon - 20 - Math.sin(hill * 0.012) * 18 - Math.sin(hill * 0.004) * 8);
      }
      ctx.lineTo(width, horizon);
      ctx.fill();

      var clips = [];
      for (var n = 1; n <= 32; n += 1) {
        var index = base + n;
        if (index >= segments.length) break;
        var z = (n - frac) * lengthUnit;
        if (z < 7) z = 7;
        var scale = focal / z;
        var seg = segments[index];
        clips.push({
          y: horizon + scale * 8.4,
          cx: width / 2 + (seg.worldX - camWorld) * scale,
          half: scale * 8.8,
          scale: scale,
          seg: seg,
        });
      }
      for (var drawIndex = clips.length - 1; drawIndex >= 1; drawIndex -= 1) {
        var far = clips[drawIndex];
        var near = clips[drawIndex - 1];
        if (near.y <= far.y) continue;
        ctx.fillStyle = far.seg.straight
          ? (drawIndex % 2 ? '#F5C542' : rgb(colors[1] || '#FF3C8E', 0.15, '#FFFFFF'))
          : (drawIndex % 2 ? rgb(colors[0], 0.08, '#000000') : rgb(colors[1] || colors[0], 0.35, '#000000'));
        ctx.fillRect(0, far.y, width, near.y - far.y + 1);
        ctx.fillStyle = drawIndex % 3 === 0 ? (colors[2] || '#F5C542') : (colors[1] || '#FF3C8E');
        ctx.beginPath();
        ctx.moveTo(far.cx - far.half * 1.18, far.y);
        ctx.lineTo(far.cx + far.half * 1.18, far.y);
        ctx.lineTo(near.cx + near.half * 1.18, near.y);
        ctx.lineTo(near.cx - near.half * 1.18, near.y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = far.seg.straight ? '#3a2a00' : '#1a1a1a';
        ctx.beginPath();
        ctx.moveTo(far.cx - far.half, far.y);
        ctx.lineTo(far.cx + far.half, far.y);
        ctx.lineTo(near.cx + near.half, near.y);
        ctx.lineTo(near.cx - near.half, near.y);
        ctx.closePath();
        ctx.fill();
        if (drawIndex % 2 === 0) {
          ctx.fillStyle = far.seg.straight ? '#F5C542' : 'rgba(255,255,255,0.8)';
          var dash = Math.max(2, far.half * 0.08);
          ctx.fillRect(far.cx - dash / 2, far.y, dash, Math.max(2, near.y - far.y));
        }
        if (far.seg.gate && !far.seg.gate.used) {
          far.seg.gate.pads.forEach(function (pad, lane) {
            if (!pad) return;
            var boxScale = Math.max(0.35, Math.min(1.4, far.scale / 8));
            var boxW = 36 + boxScale * 28;
            var boxH = 16 + boxScale * 10;
            var x = far.cx + (lane - 1) * far.half * 0.62;
            ctx.fillStyle = far.seg.straight ? '#F5C542' : 'rgba(10,10,10,0.9)';
            ctx.strokeStyle = '#F5C542';
            ctx.lineWidth = 2;
            rounded(ctx, x - boxW / 2, far.y - boxH, boxW, boxH, 8);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = far.seg.straight ? '#111' : '#fff';
            ctx.font = '700 ' + Math.max(9, Math.round(11 + boxScale * 3)) + 'px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(pad.text, x, far.y - boxH / 2);
          });
        }
        if (far.seg.finish) {
          ctx.fillStyle = '#F5C542';
          ctx.fillRect(far.cx - far.half, far.y, far.half * 2, 5);
        }
      }

      rivals.forEach(function (rival) {
        var ahead = rival.pos - pos;
        if (ahead < 0.8 || ahead > 30) return;
        var z = ahead * lengthUnit;
        var scale = focal / Math.max(7, z);
        var seg = segments[Math.min(segments.length - 1, Math.floor(rival.pos))];
        var cx = width / 2 + ((seg.worldX || 0) - camWorld) * scale;
        var y = horizon + scale * 8.4;
        var half = scale * 8.8;
        drawKart(ctx, cx + rival.x * half, y, Math.max(0.25, Math.min(1.1, scale / 10)), rival.color, 0, '#fff');
      });

      var lean = steer * (0.18 + Math.min(drift, 1) * 0.28) + spinAngle;
      var kartX = width / 2 + (playerX - camX) * Math.min(width * 0.22, 120);
      drawKart(ctx, kartX, height - 120, 1.15, colors[1] || '#FF3C8E', lean, colors[2] || '#F5C542');
      if (drift > 0.2 && spin <= 0) {
        ctx.fillStyle = '#F5C542';
        for (var spark = 0; spark < 4; spark += 1) {
          ctx.beginPath();
          ctx.arc(kartX - steer * 18 - spark * 7, height - 58 + spark * 4, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    function drawKart(ctx, x, y, scale, color, angle, canopy) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.scale(scale, scale);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(0, 16, 24, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#161616';
      rounded(ctx, -24, -4, 10, 16, 3);
      ctx.fill();
      rounded(ctx, 14, -4, 10, 16, 3);
      ctx.fill();
      ctx.fillStyle = color;
      rounded(ctx, -16, -14, 32, 24, 8);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-8, -14);
      ctx.lineTo(0, -24);
      ctx.lineTo(8, -14);
      ctx.fill();
      ctx.fillStyle = canopy;
      rounded(ctx, -7, -8, 14, 10, 5);
      ctx.fill();
      ctx.restore();
    }

    draw();
    if (!session.reduced) raf = root.requestAnimationFrame(frame);
  }

  root.PlaigroundLyricRacer = { start: start, stop: stop };
})(typeof window !== 'undefined' ? window : globalThis);
