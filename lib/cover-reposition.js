/**
 * Square cover frame.
 * Zoom 1 is the cover fit (image fills the square, no letterboxing).
 * Pan is clamped to that same rule. The framed source rect is what
 * cover-qc draws into the existing 3000 JPEG.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PlaigroundCoverReposition = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var MIN_ZOOM = 1;
  var MAX_ZOOM = 4;

  function coverState(iw, ih) {
    return {
      iw: iw,
      ih: ih,
      zoom: MIN_ZOOM,
      cx: iw / 2,
      cy: ih / 2,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM
    };
  }

  function cropSide(state) {
    return Math.min(state.iw, state.ih) / state.zoom;
  }

  function clampCenter(state) {
    var half = cropSide(state) / 2;
    var minX = half;
    var maxX = state.iw - half;
    var minY = half;
    var maxY = state.ih - half;
    if (state.cx < minX) state.cx = minX;
    if (state.cx > maxX) state.cx = maxX;
    if (state.cy < minY) state.cy = minY;
    if (state.cy > maxY) state.cy = maxY;
    return state;
  }

  function setZoom(state, zoom) {
    var next = Number(zoom);
    if (!isFinite(next)) next = state.minZoom;
    if (next < state.minZoom) next = state.minZoom;
    if (next > state.maxZoom) next = state.maxZoom;
    state.zoom = next;
    return clampCenter(state);
  }

  function panBy(state, dxView, dyView, viewPx) {
    var view = Number(viewPx) || 0;
    if (!view) return state;
    var scale = view / cropSide(state);
    if (!scale) return state;
    state.cx -= Number(dxView) / scale;
    state.cy -= Number(dyView) / scale;
    return clampCenter(state);
  }

  function reset(state) {
    state.zoom = state.minZoom;
    state.cx = state.iw / 2;
    state.cy = state.ih / 2;
    return state;
  }

  function frameOf(state) {
    var side = cropSide(state);
    return {
      sx: state.cx - side / 2,
      sy: state.cy - side / 2,
      side: side
    };
  }

  function layout(state, viewPx) {
    var frame = frameOf(state);
    var view = Number(viewPx) || 0;
    var scale = view && frame.side ? view / frame.side : 0;
    return {
      left: -frame.sx * scale,
      top: -frame.sy * scale,
      width: state.iw * scale,
      height: state.ih * scale,
      frame: frame
    };
  }

  var session = null;

  function isOpen() {
    return Boolean(session && session.active);
  }

  function currentFrame() {
    if (!session || !session.active || typeof session.frame !== 'function') return null;
    return session.frame();
  }

  function isSettled() {
    if (!session || !session.active) return true;
    return typeof session.isDirty === 'function' ? !session.isDirty() : true;
  }

  function flush() {
    if (!session || typeof session.flush !== 'function') return Promise.resolve();
    return session.flush();
  }

  function close() {
    var current = session;
    session = null;
    if (current && typeof current.destroy === 'function') current.destroy();
  }

  function listen(target, type, fn, options, signal) {
    if (!target || !target.addEventListener) return;
    var opts = options;
    if (signal) {
      if (opts === true) opts = { capture: true, signal: signal };
      else if (!opts || opts === false) opts = { signal: signal };
      else opts = Object.assign({ signal: signal }, opts);
    }
    try { target.addEventListener(type, fn, opts || false); } catch (err) {}
  }

  function viewSize(tile) {
    var v = 0;
    if (tile) {
      v = tile.clientWidth || tile.offsetWidth || 0;
      if (!v && tile.getBoundingClientRect) v = tile.getBoundingClientRect().width || 0;
    }
    return v || 320;
  }

  function resetImg(img) {
    if (!img || !img.style) return;
    img.style.left = '';
    img.style.top = '';
    img.style.width = '';
    img.style.height = '';
    img.style.maxWidth = '';
    img.style.maxHeight = '';
    img.style.objectFit = '';
    img.style.pointerEvents = '';
    img.style.inset = '';
    img.style.transform = '';
  }

  function open(opts) {
    close();
    opts = opts || {};
    var tile = opts.tile;
    var panel = opts.panel;
    var img = opts.img;
    var w = Number(opts.width) || 0;
    var h = Number(opts.height) || 0;
    if (!tile || !panel || !img || !(w > 0) || !(h > 0)) return false;

    var state = coverState(w, h);
    var active = true;
    var dirty = false;
    var timer = null;
    var inFlight = false;
    var localGen = 0;
    var drag = null;
    var ac = typeof AbortController === 'function' ? new AbortController() : null;
    var signal = ac && ac.signal;
    var win = opts.window || (typeof window !== 'undefined' ? window : null);
    var doc = tile.ownerDocument || (typeof document !== 'undefined' ? document : null);
    var slider = panel.querySelector ? panel.querySelector('[data-cover-zoom]') : null;
    var resetBtn = panel.querySelector ? panel.querySelector('[data-cover-reset]') : null;
    var hint = panel.querySelector ? panel.querySelector('[data-cover-reposition-hint], .cover-reposition-hint') : null;
    var previousLabel = tile.getAttribute ? tile.getAttribute('aria-label') : '';

    function applyLayout() {
      if (!active) return;
      var box = layout(state, viewSize(tile));
      img.style.position = 'absolute';
      img.style.inset = 'auto';
      img.style.right = 'auto';
      img.style.bottom = 'auto';
      img.style.margin = '0';
      img.style.maxWidth = 'none';
      img.style.maxHeight = 'none';
      img.style.objectFit = 'fill';
      img.style.pointerEvents = 'none';
      img.style.left = box.left + 'px';
      img.style.top = box.top + 'px';
      img.style.width = box.width + 'px';
      img.style.height = box.height + 'px';
    }

    function runExport() {
      timer = null;
      if (!active) return Promise.resolve();
      var frame = frameOf(state);
      var gen = ++localGen;
      dirty = false;
      inFlight = true;
      return Promise.resolve().then(function () {
        if (typeof opts.onFrame === 'function') return opts.onFrame(frame);
        return null;
      }).then(function (result) {
        if (gen === localGen) inFlight = false;
        return result;
      }, function (err) {
        if (gen === localGen) inFlight = false;
        if (gen !== localGen) return null;
        throw err;
      });
    }

    function exportSoon(immediate) {
      if (!active) return;
      dirty = true;
      if (timer && win && win.clearTimeout) win.clearTimeout(timer);
      timer = null;
      var wait = immediate ? 0 : 180;
      var kick = function () { if (active) runExport(); };
      if (win && win.setTimeout) timer = win.setTimeout(kick, wait);
      else kick();
    }

    function doFlush() {
      if (timer && win && win.clearTimeout) win.clearTimeout(timer);
      timer = null;
      if (!active) return Promise.resolve();
      if (!dirty && !inFlight) return Promise.resolve();
      return runExport();
    }

    function onPointerDown(event) {
      if (!active || !event) return;
      if (event.pointerType === 'mouse' && event.button != null && event.button !== 0) return;
      if (drag) return;
      drag = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        cx: state.cx,
        cy: state.cy
      };
      if (tile.classList) tile.classList.add('is-dragging');
      if (tile.setPointerCapture && event.pointerId != null) {
        try { tile.setPointerCapture(event.pointerId); } catch (err) {}
      }
    }

    function onPointerMove(event) {
      if (!active || !drag || !event) return;
      if (event.pointerId != null && drag.id != null && event.pointerId !== drag.id) return;
      state.cx = drag.cx;
      state.cy = drag.cy;
      panBy(state, event.clientX - drag.x, event.clientY - drag.y, viewSize(tile));
      applyLayout();
      if (event.cancelable && event.preventDefault) event.preventDefault();
    }

    function onPointerUp(event) {
      if (!drag || !event) return;
      if (event.pointerId != null && drag.id != null && event.pointerId !== drag.id) return;
      drag = null;
      if (tile.classList) tile.classList.remove('is-dragging');
      exportSoon(true);
    }

    function onTouchMove(event) {
      if (!drag || !event) return;
      if (event.cancelable && event.preventDefault) event.preventDefault();
    }

    function onMouseDown(event) {
      if (typeof PointerEvent === 'function') return;
      onPointerDown({
        pointerType: 'mouse',
        button: event.button,
        pointerId: 1,
        clientX: event.clientX,
        clientY: event.clientY,
        preventDefault: function () { if (event.preventDefault) event.preventDefault(); }
      });
    }

    function onMouseMove(event) {
      if (typeof PointerEvent === 'function') return;
      onPointerMove({
        pointerId: 1,
        clientX: event.clientX,
        clientY: event.clientY,
        cancelable: true,
        preventDefault: function () { if (event.preventDefault) event.preventDefault(); }
      });
    }

    function onMouseUp() {
      if (typeof PointerEvent === 'function') return;
      if (!drag) return;
      onPointerUp({ pointerId: 1 });
    }

    function onTouchStart(event) {
      if (typeof PointerEvent === 'function') return;
      var t = event.touches && event.touches[0];
      if (!t) return;
      onPointerDown({
        pointerType: 'touch',
        button: 0,
        pointerId: t.identifier,
        clientX: t.clientX,
        clientY: t.clientY
      });
    }

    function onTouchMoveLegacy(event) {
      if (typeof PointerEvent === 'function') {
        onTouchMove(event);
        return;
      }
      var t = event.touches && event.touches[0];
      if (!t) return;
      onPointerMove({
        pointerId: t.identifier,
        clientX: t.clientX,
        clientY: t.clientY,
        cancelable: event.cancelable,
        preventDefault: function () { if (event.preventDefault) event.preventDefault(); }
      });
      onTouchMove(event);
    }

    function onTouchEnd(event) {
      if (typeof PointerEvent === 'function') return;
      var t = event.changedTouches && event.changedTouches[0];
      onPointerUp({ pointerId: t ? t.identifier : (drag && drag.id) });
    }

    function stopOpenPicker(event) {
      if (!active || !event) return;
      if (event.preventDefault) event.preventDefault();
      if (event.stopPropagation) event.stopPropagation();
    }

    function onSlider() {
      if (!slider) return;
      setZoom(state, slider.value);
      applyLayout();
      exportSoon(false);
    }

    function onReset(event) {
      if (event && event.preventDefault) event.preventDefault();
      if (event && event.stopPropagation) event.stopPropagation();
      reset(state);
      if (slider) slider.value = '1';
      applyLayout();
      exportSoon(true);
    }

    if (tile.classList) tile.classList.add('is-repositioning');
    if (tile.setAttribute) {
      tile.setAttribute('data-cover-repositioning', 'true');
      tile.setAttribute('aria-label', 'Cover art. Drag to reposition.');
    }
    if (hint && hint.id && tile.setAttribute) tile.setAttribute('aria-describedby', hint.id);
    if (tile.style) tile.style.touchAction = 'none';
    img.draggable = false;
    if (img.setAttribute) img.setAttribute('draggable', 'false');
    panel.hidden = false;
    if (panel.removeAttribute) panel.removeAttribute('hidden');
    if (slider) slider.value = '1';

    listen(tile, 'pointerdown', onPointerDown, false, signal);
    listen(win, 'pointermove', onPointerMove, false, signal);
    listen(win, 'pointerup', onPointerUp, false, signal);
    listen(win, 'pointercancel', onPointerUp, false, signal);
    listen(tile, 'touchstart', onTouchStart, { passive: false }, signal);
    listen(tile, 'touchmove', onTouchMoveLegacy, { passive: false }, signal);
    listen(tile, 'touchend', onTouchEnd, { passive: false }, signal);
    listen(tile, 'touchcancel', onTouchEnd, { passive: false }, signal);
    listen(tile, 'mousedown', onMouseDown, false, signal);
    listen(win, 'mousemove', onMouseMove, false, signal);
    listen(win, 'mouseup', onMouseUp, false, signal);
    listen(tile, 'click', stopOpenPicker, true, signal);
    listen(tile, 'keydown', stopOpenPicker, true, signal);
    listen(slider, 'input', onSlider, false, signal);
    listen(slider, 'change', onSlider, false, signal);
    listen(resetBtn, 'click', onReset, false, signal);
    listen(win, 'resize', applyLayout, false, signal);

    var observer = null;
    if (typeof ResizeObserver === 'function') {
      try {
        observer = new ResizeObserver(function () { applyLayout(); });
        observer.observe(tile);
      } catch (err) { observer = null; }
    }

    applyLayout();
    if (win && win.requestAnimationFrame) win.requestAnimationFrame(function () { if (active) applyLayout(); });
    exportSoon(true);

    var local = {
      active: true,
      frame: function () { return frameOf(state); },
      isDirty: function () { return Boolean(dirty || timer || inFlight); },
      flush: doFlush,
      destroy: function () {
        if (!active) return;
        active = false;
        local.active = false;
        drag = null;
        if (timer && win && win.clearTimeout) win.clearTimeout(timer);
        timer = null;
        if (ac) {
          try { ac.abort(); } catch (err) {}
        }
        if (observer) {
          try { observer.disconnect(); } catch (err2) {}
        }
        if (tile.classList) tile.classList.remove('is-repositioning', 'is-dragging');
        if (tile.removeAttribute) tile.removeAttribute('data-cover-repositioning');
        if (tile.setAttribute) {
          if (previousLabel) tile.setAttribute('aria-label', previousLabel);
          else if (tile.removeAttribute) tile.removeAttribute('aria-label');
          if (tile.removeAttribute) tile.removeAttribute('aria-describedby');
        }
        if (tile.style) tile.style.touchAction = '';
        resetImg(img);
        panel.hidden = true;
        if (panel.setAttribute) panel.setAttribute('hidden', '');
      }
    };
    session = local;
    return true;
  }

  return {
    MIN_ZOOM: MIN_ZOOM,
    MAX_ZOOM: MAX_ZOOM,
    coverState: coverState,
    cropSide: cropSide,
    clampCenter: clampCenter,
    setZoom: setZoom,
    panBy: panBy,
    reset: reset,
    frameOf: frameOf,
    layout: layout,
    open: open,
    close: close,
    isOpen: isOpen,
    isSettled: isSettled,
    currentFrame: currentFrame,
    flush: flush
  };
});
