'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const WIZARD = ['upload.html', 'attest.html', 'review.html', 'submitted.html', 'split-sheet.html'];
const FORBIDDEN_INPUT_VALUES = [
  'value="Neon Shadows"',
  "value='Neon Shadows'",
  'value="Victoria Reyes"',
  "value='Victoria Reyes'",
  'value="Electronic / Synthwave"',
];

function attr(tag, name) {
  const match = tag.match(new RegExp('\\s' + name + '="([^"]*)"'));
  return match ? match[1] : '';
}

function selectById(html, id) {
  const match = html.match(new RegExp('<select[^>]*id="' + id + '"[\\s\\S]*?<\\/select>'));
  assert.ok(match, 'missing select #' + id);
  return match[0];
}

function options(selectHtml) {
  return Array.from(selectHtml.matchAll(/<option([^>]*)>([^<]*)<\/option>/g)).map(function (match) {
    return {
      attrs: match[1],
      value: attr(match[1], 'value'),
      label: match[2],
      selected: /\sselected\b/.test(match[1]),
    };
  });
}

function attachInnerHtml(node) {
  Object.defineProperty(node, 'innerHTML', {
    configurable: true,
    get: function () { return this._html || ''; },
    set: function (value) {
      this._html = String(value);
      if (String(value) === '' && this.children) this.children.length = 0;
    },
  });
  return node;
}

function listButtons(list) {
  return (list.children || []).filter(function (node) {
    return String(node.tagName || '').toUpperCase() === 'BUTTON' || (node.getAttribute && node.getAttribute('data-value'));
  });
}

function pickFromList(list, label) {
  const btn = listButtons(list).find(function (node) { return node.textContent === label; });
  assert.ok(btn, label + ' must be in the open list');
  const ev = { target: btn, preventDefault: function () {}, stopPropagation: function () {} };
  if (list.listeners && list.listeners.pointerdown) list.listeners.pointerdown(ev);
  else if (list.listeners && list.listeners.click) list.listeners.click(ev);
  else if (list.listeners && list.listeners.touchend) list.listeners.touchend(ev);
  else if (list.listeners && list.listeners.pointerup) list.listeners.pointerup(ev);
  else if (btn.listeners && btn.listeners.pointerdown) btn.listeners.pointerdown(ev);
  return btn;
}

function mockTypeaheadEl(tag) {
  const node = {
    tagName: String(tag).toUpperCase(),
    type: '',
    className: '',
    id: '',
    value: '',
    textContent: '',
    children: [],
    style: {},
    attrs: {},
    listeners: {},
    classList: {
      tokens: Object.create(null),
      add(name) { this.tokens[name] = true; },
      remove(name) { delete this.tokens[name]; },
      contains(name) { return Boolean(this.tokens[name]); },
      toggle(name, on) {
        if (on === false) delete this.tokens[name];
        else this.tokens[name] = true;
      },
    },
    setAttribute(name, value) { this.attrs[name] = String(value); },
    getAttribute(name) { return this.attrs[name] == null ? null : this.attrs[name]; },
    addEventListener(type, fn) { this.listeners[type] = fn; },
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      return child;
    },
    dispatchEvent() {},
  };
  return attachInnerHtml(node);
}

function testTypeaheadPrefixBlurKeepsFirstOption(select, input, prefix, expectedLabel) {
  input.value = prefix;
  if (input.listeners && input.listeners.input) input.listeners.input();
  input.listeners.blur();
  assert.strictEqual(input.value, expectedLabel, 'typeahead prefix blur keeps first real option');
  assert.ok(String(select.value || ''), 'typeahead prefix blur must apply a real catalog option');
}

function testTypeaheadGarbageStillClears(select, input) {
  input.value = 'zzzz-not-a-real-genre';
  if (input.listeners && input.listeners.input) input.listeners.input();
  input.listeners.blur();
  assert.strictEqual(select.value, '', 'typeahead custom garbage still clears');
  assert.strictEqual(input.value, '', 'typeahead custom garbage still clears the visible field');
}

function testTypeaheadDelayedBlurKeepsListPick(catalog, created) {
  const field = {
    children: [],
    classList: { tokens: Object.create(null), add(name) { this.tokens[name] = true; }, remove() {} },
    querySelector(sel) {
      if (sel === '.typeahead-input') return this.children.find(function (node) { return node.className === 'typeahead-input'; }) || null;
      if (sel === '.typeahead-list') return this.children.find(function (node) { return String(node.className || '').indexOf('typeahead-list') !== -1; }) || null;
      return { setAttribute() {} };
    },
    insertBefore(node) { this.children.push(node); return node; },
    appendChild(node) { this.children.push(node); return node; },
  };
  const select = {
    parentNode: field,
    id: 'tg-genre-delay',
    options: [{ value: '', textContent: 'Select genre' }],
    selectedIndex: 0,
    value: '',
    tabIndex: 0,
    classList: { add() {} },
    attrs: {},
    getAttribute(name) { return this.attrs[name] || null; },
    setAttribute(name, value) { this.attrs[name] = String(value); },
    removeAttribute(name) { delete this.attrs[name]; },
    dispatchEvent() {},
    addEventListener() {},
  };
  const timers = [];
  const prevWindow = global.window;
  const prevDocument = global.document;
  global.window = {
    setTimeout(fn, ms) { timers.push({ fn: fn, ms: ms == null ? 0 : ms }); return timers.length; },
    clearTimeout() {},
    addEventListener() {},
  };
  global.document = {
    addEventListener(type, fn) {
      this.listeners = this.listeners || {};
      this.listeners[type] = fn;
    },
    createElement(tag) {
      const node = mockTypeaheadEl(tag);
      created.push(node);
      return node;
    },
  };
  try {
    catalog.bindTypeahead(select, catalog.GENRES, function (name) { return name; }, function (name) { return name; });
    const input = field.children.find(function (node) { return node.className === 'typeahead-input'; });
    const list = field.children.find(function (node) { return String(node.className || '').indexOf('typeahead-list') !== -1; });
    assert.ok(input);
    assert.ok(list);
    input.listeners.focus();
    input.value = 'Hip';
    input.listeners.input();
    const hip = listButtons(list).find(function (btn) { return btn.textContent === 'Hip-Hop'; });
    assert.ok(hip, 'Hip-Hop must be in the filtered list');
    input.listeners.blur();
    const blurTimer = timers.find(function (row) { return row.ms >= 400; });
    assert.ok(blurTimer, 'typeahead blur delay must be ~400ms so an iOS list tap can win');
    pickFromList(list, 'Hip-Hop');
    timers.forEach(function (row) { row.fn(); });
    assert.strictEqual(select.value, 'Hip-Hop', 'typeahead list pick after delayed blur stays');
    assert.strictEqual(input.value, 'Hip-Hop', 'typeahead list pick after delayed blur stays');
  } finally {
    if (prevWindow === undefined) delete global.window;
    else global.window = prevWindow;
    if (prevDocument === undefined) delete global.document;
    else global.document = prevDocument;
  }
}

function testTypeaheadFilledFieldReopensOnRetap(catalog) {
  const field = {
    children: [],
    classList: { tokens: Object.create(null), add(name) { this.tokens[name] = true; }, remove(name) { delete this.tokens[name]; } },
    querySelector(sel) {
      if (sel === '.typeahead-input') return this.children.find(function (node) { return node.className === 'typeahead-input'; }) || null;
      if (sel === '.typeahead-list') return this.children.find(function (node) { return String(node.className || '').indexOf('typeahead-list') !== -1; }) || null;
      return { setAttribute() {} };
    },
    insertBefore(node) { this.children.push(node); return node; },
    appendChild(node) { this.children.push(node); return node; },
  };
  const select = {
    parentNode: field,
    id: 'tg-genre-retap',
    options: [{ value: '', textContent: 'Select genre' }],
    selectedIndex: 0,
    value: '',
    tabIndex: 0,
    classList: { add() {} },
    attrs: {},
    getAttribute(name) { return this.attrs[name] || null; },
    setAttribute(name, value) { this.attrs[name] = String(value); },
    removeAttribute(name) { delete this.attrs[name]; },
    dispatchEvent() {},
    addEventListener() {},
  };
  const timers = [];
  const prevWindow = global.window;
  const prevDocument = global.document;
  const created = [];
  global.window = {
    setTimeout(fn, ms) { timers.push({ fn: fn, ms: ms == null ? 0 : ms }); return timers.length; },
    clearTimeout() {},
    addEventListener() {},
  };
  global.document = {
    addEventListener(type, fn) {
      this.listeners = this.listeners || {};
      this.listeners[type] = fn;
    },
    createElement(tag) {
      const node = mockTypeaheadEl(tag);
      created.push(node);
      return node;
    },
    activeElement: null,
  };
  // Only run the immediate (0ms) work like the deferred blur. Leave longer
  // timers (the 450ms picking fallback) pending so the re-tap has to clear the
  // latch itself — that is the fast "no wait, wrong one" re-tap iOS Safari hit.
  function flushImmediate() {
    for (let i = timers.length - 1; i >= 0; i -= 1) {
      if (timers[i].ms === 0) {
        const row = timers.splice(i, 1)[0];
        if (typeof row.fn === 'function') row.fn();
      }
    }
  }
  try {
    catalog.bindTypeahead(select, catalog.GENRES, function (name) { return name; }, function (name) { return name; });
    const input = field.children.find(function (node) { return node.className === 'typeahead-input'; });
    const list = field.children.find(function (node) { return String(node.className || '').indexOf('typeahead-list') !== -1; });
    assert.ok(input, 're-tap test needs a typeahead input');
    assert.ok(list, 're-tap test needs a typeahead list');
    assert.ok(typeof input.listeners.pointerdown === 'function', 'typeahead input must reopen from pointerdown (the half-focused re-tap path)');
    assert.ok(typeof input.listeners.touchend === 'function', 'typeahead input must open from touchend (post-gesture, keyboard-safe)');
    assert.ok(typeof input.listeners.pointerup === 'function', 'typeahead input must open from pointerup');

    // Open the empty field and pick a value the normal way.
    input.listeners.focus();
    input.value = 'Pop';
    input.listeners.input();
    pickFromList(list, 'Pop');
    assert.strictEqual(select.value, 'Pop', 'first pick commits');
    assert.strictEqual(input.value, 'Pop', 'first pick shows the label');
    assert.ok(list.classList.contains('is-hidden'), 'pick closes the list');
    // Deferred blur (setTimeout 0) and any settle timers now run — as on device.
    flushImmediate();

    // Re-tap the field WITHOUT clearing input.value — this is the path that was
    // dead on iOS Safari: the picked label is still shown, pickOption just ran,
    // and the input is left half-focused so focus/click/pointerup do not fire.
    // pointerdown (which always fires) must both clear the settle latch AND
    // reopen the list — "quiet" so it doesn't schedule a scroll and lose the
    // keyboard.
    input.listeners.pointerdown();
    assert.ok(!list.classList.contains('is-hidden'), 're-tap pointerdown alone must reopen the list on a filled field');
    const reopened = listButtons(list);
    assert.ok(reopened.length >= 1, 're-tap must repopulate the option list');
    assert.ok(reopened.some(function (btn) { return btn.textContent === 'Pop'; }), 're-tap keeps the current value in the list');

    // A second value can now be picked to replace the first.
    input.value = 'Rock';
    input.listeners.input();
    pickFromList(list, 'Rock');
    assert.strictEqual(select.value, 'Rock', 're-tap lets the user change the value');
    assert.strictEqual(input.value, 'Rock', 're-tap change updates the visible field');
    flushImmediate();

    // And once more via focus alone (no pointerdown), covering the openList latch reset.
    input.listeners.focus();
    assert.ok(!list.classList.contains('is-hidden'), 'focus after a pick must also reopen a filled field');
  } finally {
    if (prevWindow === undefined) delete global.window;
    else global.window = prevWindow;
    if (prevDocument === undefined) delete global.document;
    else global.document = prevDocument;
  }
}

function testTypeaheadOpenDefersScroll(catalog) {
  const field = {
    children: [],
    classList: { tokens: Object.create(null), add(name) { this.tokens[name] = true; }, remove(name) { delete this.tokens[name]; } },
    querySelector(sel) {
      if (sel === '.typeahead-input') return this.children.find(function (node) { return node.className === 'typeahead-input'; }) || null;
      if (sel === '.typeahead-list') return this.children.find(function (node) { return String(node.className || '').indexOf('typeahead-list') !== -1; }) || null;
      return { setAttribute() {} };
    },
    insertBefore(node) { this.children.push(node); return node; },
    appendChild(node) { this.children.push(node); return node; },
  };
  const select = {
    parentNode: field,
    id: 'tg-genre-scroll',
    options: [{ value: '', textContent: 'Select genre' }],
    selectedIndex: 0,
    value: '',
    tabIndex: 0,
    classList: { add() {} },
    attrs: {},
    getAttribute(name) { return this.attrs[name] || null; },
    setAttribute(name, value) { this.attrs[name] = String(value); },
    removeAttribute(name) { delete this.attrs[name]; },
    dispatchEvent() {},
    addEventListener() {},
  };
  const timers = [];
  const prevWindow = global.window;
  const prevDocument = global.document;
  const created = [];
  global.window = {
    innerHeight: 600,
    innerWidth: 390,
    addEventListener() {},
    scrolled: 0,
    scrollBy(x, y) { this.scrolled += y; },
    setTimeout(fn, ms) { timers.push({ fn: fn, ms: ms == null ? 0 : ms }); return timers.length; },
    clearTimeout() {},
  };
  global.document = {
    addEventListener(type, fn) {
      this.listeners = this.listeners || {};
      this.listeners[type] = fn;
    },
    createElement(tag) {
      const node = mockTypeaheadEl(tag);
      created.push(node);
      return node;
    },
    activeElement: null,
  };
  function runTimers() {
    while (timers.length) {
      const row = timers.shift();
      if (typeof row.fn === 'function') row.fn();
    }
  }
  try {
    catalog.bindTypeahead(select, catalog.GENRES, function (name) { return name; }, function (name) { return name; });
    const input = created.find(function (node) { return node.className === 'typeahead-input'; });
    const list = created.find(function (node) { return String(node.className || '').indexOf('typeahead-list') !== -1; });
    assert.ok(input && list, 'scroll-defer test needs the typeahead nodes');
    // Place the field well below the keyboard-safe zone so keepInputVisible would scroll.
    input.getBoundingClientRect = function () {
      return { top: 430, bottom: 474, left: 16, right: 300, width: 284, height: 44 };
    };

    ['touchend', 'click', 'focus', 'pointerup'].forEach(function (trigger) {
      global.window.scrolled = 0;
      list.classList.add('is-hidden');
      input.listeners[trigger]();
      assert.ok(!list.classList.contains('is-hidden'), trigger + ' opens the list');
      assert.strictEqual(
        global.window.scrolled, 0,
        trigger + '-triggered openList must NOT scroll synchronously (iOS keyboard race)'
      );
      runTimers();
      assert.ok(
        global.window.scrolled !== 0,
        trigger + ' still scrolls the field into view once the gesture settles'
      );
    });

    // pointerdown opens the list too (it is the only tap event that fires when
    // the input is left half-focused after a pick), but "quiet": it must never
    // schedule a scroll at all, since even a deferred scrollBy during the tap
    // makes iOS abort it and suppress the keyboard.
    global.window.scrolled = 0;
    timers.length = 0;
    list.classList.add('is-hidden');
    input.listeners.pointerdown();
    assert.ok(!list.classList.contains('is-hidden'), 'pointerdown reopens the list (half-focused re-tap path)');
    assert.strictEqual(global.window.scrolled, 0, 'pointerdown open must not scroll synchronously');
    assert.strictEqual(timers.length, 0, 'pointerdown open must not even schedule a deferred scroll');
    runTimers();
    assert.strictEqual(global.window.scrolled, 0, 'pointerdown open never scrolls; the trailing touchend does');
  } finally {
    if (prevWindow === undefined) delete global.window;
    else global.window = prevWindow;
    if (prevDocument === undefined) delete global.document;
    else global.document = prevDocument;
  }
}

function fillableCatalogSelect(id, placeholder) {
  const optionsArr = [{ value: '', textContent: placeholder }];
  const field = mockField();
  const select = {
    parentNode: field,
    id: id,
    options: optionsArr,
    selectedIndex: 0,
    _value: '',
    tabIndex: 0,
    classList: { tokens: Object.create(null), add(name) { this.tokens[name] = true; } },
    attrs: {},
    get value() { return this._value; },
    set value(next) {
      const found = this.options.find(function (opt) { return String(opt.value) === String(next); });
      if (found) {
        this._value = String(next);
        this.selectedIndex = this.options.indexOf(found);
      } else if (!next) {
        this._value = '';
        this.selectedIndex = 0;
      }
    },
    getAttribute(name) { return this.attrs[name] == null ? null : this.attrs[name]; },
    setAttribute(name, value) { this.attrs[name] = String(value); },
    removeAttribute(name) { delete this.attrs[name]; },
    dispatchEvent() {},
    listeners: {},
    addEventListener(type, fn) { this.listeners[type] = fn; },
    querySelectorAll(sel) { return sel === 'option' ? this.options : []; },
    appendChild(child) {
      child.parentNode = this;
      this.options.push(child);
      return child;
    },
    removeChild(child) {
      const i = this.options.indexOf(child);
      if (i !== -1) this.options.splice(i, 1);
      return child;
    },
  };
  optionsArr[0].parentNode = select;
  return select;
}

function typeaheadNodes(select) {
  const kids = (select.parentNode && select.parentNode.children) || [];
  return {
    input: kids.find(function (node) { return node.className === 'typeahead-input'; }) || null,
    list: kids.find(function (node) { return String(node.className || '').indexOf('typeahead-list') !== -1; }) || null,
  };
}

function withPointerEnv(opts, fn) {
  const prevWindow = global.window;
  const prevDocument = global.document;
  const created = [];
  const coarse = !!opts.coarse;
  const phoneWidth = !!opts.phoneWidth;
  global.window = {
    matchMedia(query) {
      const q = String(query || '');
      return {
        matches: (coarse && q.indexOf('pointer: coarse') !== -1) || (phoneWidth && q.indexOf('max-width') !== -1),
        media: query,
        addListener() {},
        removeListener() {},
      };
    },
    innerWidth: opts.innerWidth != null ? opts.innerWidth : (phoneWidth ? 390 : 1280),
    innerHeight: opts.innerHeight != null ? opts.innerHeight : 800,
    navigator: {
      userAgent: opts.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0',
      platform: opts.platform || 'MacIntel',
      maxTouchPoints: opts.maxTouchPoints || 0,
    },
    addEventListener() {},
    setTimeout(fn, ms) { if (typeof fn === 'function') fn(); return 1; },
    clearTimeout() {},
  };
  global.document = {
    createElement(tag) {
      const node = mockTypeaheadEl(tag);
      created.push(node);
      return node;
    },
    addEventListener() {},
    getElementById() { return null; },
    querySelector(sel) {
      if (opts.reviewPage && (sel === '[data-store-submit]' || sel === '[data-review-title]')) {
        return { id: 'review-marker' };
      }
      return null;
    },
  };
  try {
    fn(created);
  } finally {
    if (prevWindow === undefined) delete global.window;
    else global.window = prevWindow;
    if (prevDocument === undefined) delete global.document;
    else global.document = prevDocument;
  }
}

function firstValuedOption(select) {
  return (select.options || []).find(function (opt) { return opt && opt.value; }) || null;
}

function assertBasicTypeaheadCatalog(catalog, created, label) {
  const genre = fillableCatalogSelect('tg-genre', 'Select genre');
  const language = fillableCatalogSelect('tg-language', 'Select language');
  catalog.fillUploadSelects({
    getElementById(id) {
      if (id === 'tg-genre') return genre;
      if (id === 'tg-language') return language;
      return null;
    },
  });
  if (!catalog.isTypeaheadBound(genre)) {
    catalog.bindTypeahead(genre, catalog.GENRES, function (name) { return name; }, function (name) { return name; });
  }
  if (!catalog.isTypeaheadBound(language)) {
    catalog.bindTypeahead(language, catalog.LANGUAGES, function (row) { return row.code; }, function (row) { return row.name; });
  }
  assert.ok(catalog.isTypeaheadBound(genre), label + ' genre must bind typeahead');
  assert.ok(catalog.isTypeaheadBound(language), label + ' language must bind typeahead');
  const genreUi = typeaheadNodes(genre);
  const langUi = typeaheadNodes(language);
  assert.ok(genreUi.input && genreUi.list, label + ' genre must offer type-to-filter');
  assert.ok(langUi.input && langUi.list, label + ' language must offer type-to-filter');
  assert.ok(created.some(function (node) { return node.className === 'typeahead-input'; }), label + ' must create typeahead inputs');
  genreUi.input.value = 'hip';
  if (genreUi.input.listeners.input) genreUi.input.listeners.input();
  const listed = genreUi.list && listButtons(genreUi.list).some(function (btn) { return btn.textContent === 'Hip-Hop'; });
  const inSelect = genre.options.some(function (opt) { return opt.value === 'Hip-Hop'; });
  assert.ok(listed || inSelect, label + ' typing hip must find Hip-Hop');
  if (listed) pickFromList(genreUi.list, 'Hip-Hop');
  else {
    genre.value = 'Hip-Hop';
    if (genre.listeners.change) genre.listeners.change();
  }
  assert.strictEqual(genre.value, 'Hip-Hop', label + ' genre pick must stick');
  const firstLang = firstValuedOption(language);
  assert.ok(firstLang && firstLang.value === 'en' && firstLang.textContent === 'English', label + ' language list has English first');
  langUi.input.value = '';
  if (langUi.input.listeners.focus) langUi.input.listeners.focus();
  else if (langUi.input.listeners.input) langUi.input.listeners.input();
  const langButtons = langUi.list ? listButtons(langUi.list) : [];
  if (langButtons.length) {
    assert.strictEqual(langButtons[0].textContent, 'English', label + ' language typeahead shows English first');
  }
}

function testBasicPhoneUsesTypeahead(catalog) {
  withPointerEnv({ coarse: true, phoneWidth: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1', platform: 'iPhone', maxTouchPoints: 5 }, function (created) {
    assertBasicTypeaheadCatalog(catalog, created, 'coarse iOS');
  });
  withPointerEnv({ coarse: false, phoneWidth: false, innerWidth: 1280, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15', platform: 'iPhone' }, function (created) {
    assertBasicTypeaheadCatalog(catalog, created, 'iOS user-agent');
  });
  withPointerEnv({ coarse: false, phoneWidth: true, userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/120.0.0.0 Mobile' }, function (created) {
    assertBasicTypeaheadCatalog(catalog, created, 'max-width phone');
  });
}

function testBasicTypeaheadFiltersAndEnglishFirst(catalog) {
  withPointerEnv({ coarse: false, phoneWidth: false, innerWidth: 1440, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }, function (created) {
    assert.strictEqual(catalog.LANGUAGES[0].code, 'en', 'catalog language list pins English first');
    assert.strictEqual(catalog.LANGUAGES[0].name, 'English', 'catalog language list pins English first');
    const genre = fillableCatalogSelect('tg-genre', 'Select genre');
    const language = fillableCatalogSelect('tg-language', 'Select language');
    catalog.fillUploadSelects({
      getElementById(id) {
        if (id === 'tg-genre') return genre;
        if (id === 'tg-language') return language;
        return null;
      },
    });
    assert.ok(catalog.isTypeaheadBound(genre), 'Basic genre typeahead binds');
    assert.ok(catalog.isTypeaheadBound(language), 'Basic language typeahead binds');
    const genreUi = typeaheadNodes(genre);
    const langUi = typeaheadNodes(language);
    assert.ok(genreUi.input && genreUi.list, 'Basic genre offers typeahead');
    assert.ok(langUi.input && langUi.list, 'Basic language offers typeahead');
    genreUi.input.listeners.focus();
    genreUi.input.value = 'hip';
    genreUi.input.listeners.input();
    assert.ok(listButtons(genreUi.list).some(function (btn) { return btn.textContent === 'Hip-Hop'; }), 'Basic typing hip filters to Hip-Hop');
    pickFromList(genreUi.list, 'Hip-Hop');
    assert.strictEqual(genre.value, 'Hip-Hop', 'Basic Hip-Hop pick sticks');
    const firstLang = firstValuedOption(language);
    assert.ok(firstLang && firstLang.value === 'en' && firstLang.textContent === 'English', 'Basic filled language list has English first');
    langUi.input.listeners.focus();
    const langButtons = listButtons(langUi.list);
    assert.ok(langButtons.length >= 1, 'Basic language typeahead opens');
    assert.strictEqual(langButtons[0].textContent, 'English', 'Basic language typeahead shows English first');
  });
}

function testDesktopTypeaheadStillBindsOnFinePointer(catalog) {
  withPointerEnv({ coarse: false, phoneWidth: false, innerWidth: 1440, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }, function (created) {
    const genre = fillableCatalogSelect('tg-genre', 'Select genre');
    const language = fillableCatalogSelect('tg-language', 'Select language');
    catalog.fillUploadSelects({
      getElementById(id) {
        if (id === 'tg-genre') return genre;
        if (id === 'tg-language') return language;
        return null;
      },
    });
    const genreUi = typeaheadNodes(genre);
    const langUi = typeaheadNodes(language);
    assert.ok(genreUi.input && genreUi.list, 'desktop Basic genre still binds typeahead');
    assert.ok(langUi.input && langUi.list, 'desktop Basic language still binds typeahead');
    assert.ok(catalog.isTypeaheadBound(genre), 'desktop genre reports typeahead bound');
    assert.ok(catalog.isTypeaheadBound(language), 'desktop language reports typeahead bound');
    genreUi.input.listeners.focus();
    assert.ok(listButtons(genreUi.list).length >= 1, 'desktop genre typeahead still opens');
    genreUi.input.value = 'Hip';
    genreUi.input.listeners.input();
    pickFromList(genreUi.list, 'Hip-Hop');
    assert.strictEqual(genre.value, 'Hip-Hop', 'desktop genre typeahead pick still sticks');
    langUi.input.listeners.focus();
    langUi.input.value = 'English';
    langUi.input.listeners.input();
    pickFromList(langUi.list, 'English');
    assert.strictEqual(language.value, 'en', 'desktop language typeahead pick still sticks');
    assert.ok(created.some(function (node) { return node.className === 'typeahead-input'; }), 'desktop still creates typeahead inputs');
  });
}

function assertTypeToFilterFindsHipHop(catalog, created, id, items, getValue, getLabel, pickValue, pickLabel, message) {
  const select = fillableCatalogSelect(id, id.indexOf('language') !== -1 ? 'Select language' : 'Select genre');
  catalog.fillUploadSelects({
    getElementById(found) { return found === id ? select : null; },
  });
  if (!catalog.isTypeaheadBound(select)) {
    catalog.bindTypeahead(select, items, getValue, getLabel);
  }
  const ui = typeaheadNodes(select);
  assert.ok(ui.input, message + ' must offer type-to-filter');
  ui.input.value = id.indexOf('language') !== -1 ? 'spa' : 'hip';
  if (ui.input.listeners.input) ui.input.listeners.input();
  const hip = select.options.some(function (opt) {
    return opt.value === pickValue || opt.textContent === pickLabel;
  });
  const listed = ui.list && listButtons(ui.list).some(function (btn) { return btn.textContent === pickLabel; });
  assert.ok(hip || listed, message + ' typing must find ' + pickLabel);
  if (listed) pickFromList(ui.list, pickLabel);
  else {
    select.value = pickValue;
    if (select.listeners.change) select.listeners.change();
  }
  assert.strictEqual(select.value, pickValue, message + ' pick must stick');
  return { select: select, ui: ui };
}

function testEditTypeToFilterOnIos(catalog) {
  withPointerEnv({ coarse: true, phoneWidth: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15', platform: 'iPhone', maxTouchPoints: 5 }, function (created) {
    assertTypeToFilterFindsHipHop(
      catalog, created, 'edit-genre', catalog.GENRES,
      function (name) { return name; }, function (name) { return name; },
      'Hip-Hop', 'Hip-Hop', 'Edit iPhone genre'
    );
    assertTypeToFilterFindsHipHop(
      catalog, created, 'edit-language', catalog.LANGUAGES,
      function (row) { return row.code; }, function (row) { return row.name; },
      'es', 'Spanish', 'Edit iPhone language'
    );
    assert.ok(created.some(function (node) { return node.className === 'typeahead-input'; }), 'Edit mobile uses type-to-filter, not a bare native picker');
  });
}

function testReviewTypeToFilterOnIos(catalog) {
  withPointerEnv({
    coarse: true,
    phoneWidth: true,
    reviewPage: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15',
    platform: 'iPhone',
    maxTouchPoints: 5,
  }, function (created) {
    assertTypeToFilterFindsHipHop(
      catalog, created, 'tg-genre', catalog.GENRES,
      function (name) { return name; }, function (name) { return name; },
      'Hip-Hop', 'Hip-Hop', 'Submit review iPhone genre'
    );
    assertTypeToFilterFindsHipHop(
      catalog, created, 'tg-language', catalog.LANGUAGES,
      function (row) { return row.code; }, function (row) { return row.name; },
      'es', 'Spanish', 'Submit review iPhone language'
    );
  });
}

function testEditDesktopTypeaheadFiltersHip(catalog) {
  withPointerEnv({ coarse: false, phoneWidth: false, innerWidth: 1440, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }, function (created) {
    const genre = fillableCatalogSelect('edit-genre', 'Select genre');
    const language = fillableCatalogSelect('edit-language', 'Select language');
    catalog.fillUploadSelects({
      getElementById(id) {
        if (id === 'edit-genre') return genre;
        if (id === 'edit-language') return language;
        return null;
      },
    });
    const genreUi = typeaheadNodes(genre);
    const langUi = typeaheadNodes(language);
    assert.ok(genreUi.input && genreUi.list, 'desktop Edit genre uses the typeahead overlay');
    assert.ok(langUi.input && langUi.list, 'desktop Edit language uses the typeahead overlay');
    genreUi.input.listeners.focus();
    genreUi.input.value = 'hip';
    genreUi.input.listeners.input();
    assert.ok(listButtons(genreUi.list).some(function (btn) { return /hip/i.test(btn.textContent); }), 'desktop Edit typing hip filters genres');
    pickFromList(genreUi.list, 'Hip-Hop');
    assert.strictEqual(genre.value, 'Hip-Hop', 'desktop Edit genre pick sticks');
    langUi.input.listeners.focus();
    langUi.input.value = 'spa';
    langUi.input.listeners.input();
    assert.ok(listButtons(langUi.list).some(function (btn) { return btn.textContent === 'Spanish'; }), 'desktop Edit typing spa filters languages');
    pickFromList(langUi.list, 'Spanish');
    assert.strictEqual(language.value, 'es', 'desktop Edit language pick sticks');
  });
}

function mockField() {
  return {
    children: [],
    classList: { tokens: Object.create(null), add(name) { this.tokens[name] = true; }, remove(name) { delete this.tokens[name]; }, contains(name) { return Boolean(this.tokens[name]); } },
    querySelector(sel) {
      if (sel === '.typeahead-input') return this.children.find(function (node) { return node.className === 'typeahead-input'; }) || null;
      if (sel === '.typeahead-list') return this.children.find(function (node) { return String(node.className || '').indexOf('typeahead-list') !== -1; }) || null;
      return { setAttribute() {} };
    },
    insertBefore(node) { this.children.push(node); return node; },
    appendChild(node) { this.children.push(node); return node; },
  };
}

function testTypeaheadRebindsIfInputMissing(catalog) {
  const field = {
    children: [],
    classList: { tokens: Object.create(null), add(name) { this.tokens[name] = true; }, remove() {} },
    querySelector() { return null; },
    insertBefore(node) { this.children.push(node); return node; },
    appendChild(node) { this.children.push(node); return node; },
  };
  const select = {
    parentNode: field,
    id: 'edit-genre',
    options: [{ value: '', textContent: 'Select genre' }],
    selectedIndex: 0,
    value: '',
    tabIndex: 0,
    classList: { add() {} },
    attrs: { 'data-typeahead': 'on' },
    getAttribute(name) { return this.attrs[name] || null; },
    setAttribute(name, value) { this.attrs[name] = String(value); },
    removeAttribute(name) { delete this.attrs[name]; },
    dispatchEvent() {},
    addEventListener() {},
  };
  const created = [];
  const prevDocument = global.document;
  global.document = {
    createElement(tag) {
      const node = {
        tagName: String(tag).toUpperCase(),
        type: '',
        className: '',
        id: '',
        value: '',
        textContent: '',
        children: [],
        style: {},
        attrs: {},
        listeners: {},
        classList: {
          tokens: Object.create(null),
          add(name) { this.tokens[name] = true; },
          remove(name) { delete this.tokens[name]; },
          contains(name) { return Boolean(this.tokens[name]); },
        },
        setAttribute(name, value) { this.attrs[name] = String(value); },
        getAttribute(name) { return this.attrs[name] == null ? null : this.attrs[name]; },
        addEventListener(type, fn) { this.listeners[type] = fn; },
        appendChild(child) { this.children.push(child); return child; },
      };
      created.push(node);
      return node;
    },
  };
  try {
    catalog.bindTypeahead(select, catalog.GENRES, function (name) { return name; }, function (name) { return name; });
    const input = created.find(function (node) { return node.className === 'typeahead-input'; });
    assert.ok(input, 'bindTypeahead must run again when the typeahead input is missing');
  } finally {
    if (prevDocument === undefined) delete global.document;
    else global.document = prevDocument;
  }
}

function run() {
  WIZARD.forEach(function (file) {
    const html = fs.readFileSync(path.join(__dirname, file), 'utf8');
    FORBIDDEN_INPUT_VALUES.forEach(function (needle) {
      assert.strictEqual(html.indexOf(needle), -1, file + ' still has ' + needle);
    });
    assert.strictEqual(/name:\s*'Victoria Reyes'/.test(html), false, file + ' still defaults a writer to Victoria Reyes');
  });

  const upload = fs.readFileSync(path.join(__dirname, 'upload.html'), 'utf8');
  assert.ok(/id="tg-title"[^>]*value=""/.test(upload));
  assert.ok(/id="tg-artist"[^>]*value=""/.test(upload));
  assert.ok(upload.indexOf('placeholder="SONG TITLE"') !== -1);
  assert.ok(upload.indexOf('Choose artist profile') !== -1);
  assert.ok(upload.indexOf('Create new artist profile') !== -1);
  assert.ok(upload.indexOf('Import an existing artist') !== -1);
  assert.ok(upload.indexOf('id="tg-artist-new"') !== -1);
  assert.ok(upload.indexOf('id="tg-artist-link"') !== -1);
  assert.ok(upload.indexOf('human_contributions') === -1);
  assert.ok(upload.indexOf('ai_involvement') === -1);
  assert.ok(upload.indexOf('placeholder="Artist name"') !== -1);
  assert.ok(!/id="tg-artist"[^>]*(legal name|FIRST NAME LAST NAME)/i.test(upload));
  assert.ok(upload.indexOf('placeholder="Optional featured"') !== -1);

  const settings = fs.readFileSync(path.join(__dirname, 'settings.html'), 'utf8');
  assert.ok(settings.indexOf('<label>Artist name</label>') === -1);
  assert.ok(settings.indexOf('data-account-artist') === -1);
  assert.ok(settings.indexOf('<label>Username</label>') !== -1);
  assert.ok(settings.indexOf('data-account-username') !== -1);
  assert.ok(settings.indexOf('placeholder="Username"') !== -1);
  assert.ok(!/data-account-username[^>]*(legal name|FIRST NAME LAST NAME)/i.test(settings));
  assert.ok(!/Legal name[\s\S]{0,80}required/i.test(settings));
  assert.ok(settings.indexOf('John ham') === -1);
  assert.ok(settings.indexOf('>VV<') === -1);
  assert.ok(settings.indexOf('data-account-avatar>PG') !== -1);
  assert.ok(upload.indexOf('placeholder="Electronic"') === -1);
  assert.ok(upload.indexOf('placeholder="$0.00"') === -1);
  assert.ok(upload.indexOf('placeholder="Price"') === -1);
  assert.ok(upload.indexOf('<input id="tg-genre"') === -1);
  assert.ok(upload.indexOf('<input id="tg-language"') === -1);
  assert.ok(upload.indexOf('<input id="tg-price"') === -1);
  assert.ok(upload.indexOf('<select id="tg-genre"') !== -1);
  assert.ok(upload.indexOf('<select id="tg-language"') !== -1);
  assert.ok(upload.indexOf('<select id="tg-price"') !== -1);
  // TEMP STOPGAP: Genre ships as a plain native <select> (data-native-picker),
  // same as Download price, while the typeahead re-tap bug is fixed separately.
  // Language keeps the searchable typeahead. Revert by removing the attribute.
  assert.ok(/<select id="tg-genre"[^>]*\bdata-native-picker\b/.test(upload), 'upload Genre is a native picker while the typeahead re-tap bug is open');
  assert.ok(!/<select id="tg-language"[^>]*\bdata-native-picker\b/.test(upload), 'upload Language keeps the typeahead');
  const reviewHtmlNative = fs.readFileSync(path.join(__dirname, 'review.html'), 'utf8');
  const songHtmlNative = fs.readFileSync(path.join(__dirname, 'song.html'), 'utf8');
  assert.ok(/<select id="tg-genre"[^>]*\bdata-native-picker\b/.test(reviewHtmlNative), 'review Genre is a native picker too');
  assert.ok(/<select id="edit-genre"[^>]*\bdata-native-picker\b/.test(songHtmlNative), 'song edit Genre is a native picker too');
  assert.ok(upload.indexOf('plai-bubble.js') !== -1);
  assert.ok(upload.indexOf('membership.js') !== -1);
  assert.ok(upload.indexOf('data-require-membership="true"') !== -1);
  assert.ok(upload.indexOf('id="tg-upgrade"') !== -1);
  assert.ok(upload.indexOf('href="creator.html"') !== -1);
  assert.ok(upload.indexOf('href="pro.html"') !== -1);

  assert.ok(upload.indexOf('upload-catalog.js') !== -1);
  assert.ok(upload.indexOf('bindTypeahead') !== -1 || fs.readFileSync(path.join(__dirname, 'upload-catalog.js'), 'utf8').indexOf('bindTypeahead') !== -1);
  assert.ok(upload.indexOf('id="tg-subgenre"') === -1);
  assert.ok(upload.indexOf('name="release-subgenre"') === -1);
  assert.ok(upload.indexOf('capture=') === -1);
  assert.ok(upload.indexOf('accept="audio/*,.wav,.flac,.mp3,.mpeg,.mpga,audio/wav,audio/x-wav,audio/flac,audio/x-flac,audio/mpeg,audio/mp3,audio/x-mpeg,audio/x-mp3,audio/mpeg3,audio/mpg"') !== -1);
  assert.ok(upload.indexOf('lib/audio-accept.js') !== -1);
  assert.ok(upload.indexOf('lib/store-pick.js') !== -1);
  assert.ok(upload.indexOf('Pre-select all stores') !== -1);
  assert.ok(upload.indexOf('data-store-customize') !== -1);
  assert.ok(upload.indexOf('data-store-all') !== -1);
  assert.ok(upload.indexOf('data-store-list') !== -1);
  assert.ok(upload.indexOf('data-store-pick') !== -1);
  assert.ok(upload.indexOf('accept=".jpg,.jpeg,.png,image/jpeg,image/png"') !== -1);
  assert.ok(upload.indexOf('data-art-pick') !== -1);
  assert.ok(upload.indexOf('data-art-input') !== -1);
  assert.ok(upload.indexOf('lib/cover-preview.js') !== -1);
  assert.ok(upload.indexOf('lib/object-hop.js') !== -1);
  assert.ok(upload.indexOf('lib/object-store.js') === -1);
  assert.ok(upload.indexOf('data-art-clear') !== -1);
  assert.ok(upload.indexOf('data-art-box') !== -1);
  assert.ok(upload.indexOf('MP3 is converted to WAV before it goes to stores') !== -1);
  assert.ok(upload.indexOf('data-audio-preview') !== -1);
  assert.ok(upload.indexOf('data-audio-player') !== -1);
  assert.ok(upload.indexOf('data-audio-play') !== -1);
  assert.ok(upload.indexOf('URL.createObjectURL') !== -1);
  assert.ok(upload.indexOf('URL.revokeObjectURL') !== -1);
  assert.ok(upload.indexOf('pagehide') !== -1);
  assert.ok(upload.indexOf('indexedDB') === -1);
  assert.ok(upload.indexOf('Play this file here to confirm it is the right master') !== -1);
  assert.ok(upload.indexOf('id="tg-instrumental"') !== -1);
  assert.ok(upload.indexOf('id="tg-legal-first"') !== -1);
  assert.ok(upload.indexOf('id="tg-legal-last"') !== -1);
  assert.ok(upload.indexOf('id="tg-legal-first-create"') !== -1);
  assert.ok(upload.indexOf('id="tg-legal-last-create"') !== -1);
  assert.ok(upload.indexOf('id="artist-legal-wrap"') !== -1);
  assert.ok(/id="tg-legal-first-create"[^>]*autocomplete="new-password"/.test(upload), 'create legal first must not use account autocomplete');
  assert.ok(/id="tg-legal-last-create"[^>]*autocomplete="new-password"/.test(upload), 'create legal last must not use account autocomplete');
  const createLegalChunk = upload.slice(upload.indexOf('id="artist-create-wrap"'), upload.indexOf('id="artist-link-wrap"'));
  assert.ok(!/data-legal-first/.test(createLegalChunk) && !/data-legal-last/.test(createLegalChunk), 'create legal fields must not share wrap data-legal selectors');
  assert.ok(/id="artist-legal-wrap"[^>]*data-artist-legal/.test(upload));
  assert.ok(/id="tg-legal-first"[^>]*data-legal-first/.test(upload), 'wrap pair keeps data-legal-first for existing-artist prefill');
  assert.ok(/id="tg-label"[^>]*value="PLAIGROUND"/.test(upload), 'Record label is locked to PLAIGROUND');
  assert.ok(/id="tg-label"[^>]*\breadonly\b/.test(upload), 'Record label cannot be edited');
  assert.ok(upload.indexOf('id="tg-record-label"') === -1);
  assert.ok(upload.indexOf('id="tg-copyright-year"') === -1);
  assert.ok(upload.indexOf('id="tg-copyright-line"') !== -1);
  assert.ok(/id="tg-copyright-line"[^>]*\breadonly\b/.test(upload), 'copyright line is read-only');
  assert.ok(upload.indexOf('name="copyright_year"') === -1);
  assert.ok(upload.indexOf('name="copyright_holder"') === -1);
  assert.ok(/Record label/i.test(upload));
  assert.ok(!/Copyright year/i.test(upload), 'no separate copyright-year field to type');
  assert.ok(upload.indexOf('id="tg-lyrics"') !== -1);
  assert.ok(upload.indexOf('data-lyrics-open') !== -1);
  assert.ok(upload.indexOf('data-lyrics-field') !== -1);
  assert.ok(upload.indexOf('<label for="tg-lyrics">Lyrics</label>') !== -1);
  assert.ok(upload.indexOf('Add lyrics file') === -1);
  assert.ok(upload.indexOf('type="checkbox"') !== -1);
  assert.ok(upload.indexOf('data-language-field') !== -1);
  assert.ok(upload.indexOf('data-upload-loader') !== -1);
  assert.ok(upload.indexOf('hidden') !== -1);
  assert.ok(!/accept="[^"]*audio\/mp4|m4a|aiff/i.test(upload));
  assert.ok(upload.indexOf('ToneGrid accepts MP3') === -1);

  const catalog = require('./upload-catalog');
  const vm = require('vm');
  const dual = { module: { exports: {} }, window: { document: null }, document: null };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'upload-catalog.js'), 'utf8'), dual);
  assert.strictEqual(dual.window.PlaigroundUploadCatalog, dual.module.exports, 'window catalog must exist even when module.exports is set');
  assert.ok(dual.window.PlaigroundUploadCatalog.GENRES.length >= 180);
  assert.ok(typeof dual.window.PlaigroundUploadCatalog.bindTypeahead === 'function');
  assert.ok(catalog.GENRES.indexOf('Afrobeats') !== -1);
  assert.ok(catalog.GENRES.indexOf('Afropop') !== -1);
  assert.ok(catalog.GENRES.indexOf('Electronic') !== -1);
  assert.ok(catalog.GENRES.length >= 180);
  assert.ok(catalog.LANGUAGES.length >= 180);
  assert.ok(catalog.LANGUAGES.every(function (row) { return /^[a-z]{2}$/.test(row.code); }));
  assert.strictEqual(catalog.LANGUAGES[0].code, 'en');
  assert.strictEqual(catalog.LANGUAGES[0].name, 'English');
  assert.ok(catalog.LANGUAGES.some(function (row) { return row.code === 'en' && row.name === 'English'; }));
  assert.ok(catalog.LANGUAGES.some(function (row) { return row.code === 'es'; }));
  assert.ok(!catalog.LANGUAGES.some(function (row) { return row.code === 'English'; }));

  // TEMP STOPGAP: a genre <select> carrying data-native-picker must be filled
  // with options but NOT bound to the typeahead (no overlay input).
  (function () {
    const nativeGenre = fillableCatalogSelect('tg-genre', 'Select genre');
    nativeGenre.setAttribute('data-native-picker', '');
    const nativeLang = fillableCatalogSelect('tg-language', 'Select language');
    const prevDoc = global.document;
    const prevWin = global.window;
    global.window = { setTimeout() { return 1; }, clearTimeout() {}, addEventListener() {} };
    global.document = {
      createElement(tag) { return mockTypeaheadEl(tag); },
      addEventListener() {},
      getElementById() { return null; },
    };
    try {
      catalog.fillUploadSelects({
        getElementById(id) {
          if (id === 'tg-genre') return nativeGenre;
          if (id === 'tg-language') return nativeLang;
          return null;
        },
      });
      assert.ok(nativeGenre.options.length > 100, 'native Genre still gets every option');
      assert.strictEqual(catalog.isTypeaheadBound(nativeGenre), false, 'data-native-picker Genre must NOT bind the typeahead');
      assert.strictEqual(typeaheadNodes(nativeGenre).input, null, 'data-native-picker Genre has no overlay input');
      assert.ok(catalog.isTypeaheadBound(nativeLang), 'Language still binds the typeahead');
      // ensureTypeahead (used by store-client on the review page) also respects it.
      catalog.ensureTypeahead(nativeGenre, catalog.GENRES, function (n) { return n; }, function (n) { return n; });
      assert.strictEqual(catalog.isTypeaheadBound(nativeGenre), false, 'ensureTypeahead leaves a native-picker Genre native');
    } finally {
      if (prevDoc === undefined) delete global.document;
      else global.document = prevDoc;
      if (prevWin === undefined) delete global.window;
      else global.window = prevWin;
    }
  }());

  const genre = options(selectById(upload, 'tg-genre'));
  assert.deepStrictEqual(genre.map(function (opt) { return opt.value; }), ['']);
  assert.strictEqual(genre[0].label, 'Select genre');
  assert.ok(genre.every(function (opt) { return !opt.selected; }));

  const language = options(selectById(upload, 'tg-language'));
  assert.strictEqual(language[0].value, '');
  assert.strictEqual(language[0].label, 'Select language');
  assert.ok(!language.some(function (opt) { return opt.value === 'English'; }));
  assert.ok(language.every(function (opt) { return !opt.selected; }));

  const price = options(selectById(upload, 'tg-price'));
  assert.deepStrictEqual(price.map(function (opt) { return opt.value; }), ['', '$0.69', '$0.99']);
  assert.strictEqual(price[0].label, 'Select price');
  assert.ok(price.every(function (opt) { return !opt.selected; }));

  const catalogSrc = fs.readFileSync(path.join(__dirname, 'upload-catalog.js'), 'utf8');
  assert.ok(catalogSrc.indexOf('const api =') === -1, 'top-level const api collides with var api on the song page');
  const shared = { window: { document: { readyState: 'complete', getElementById() { return null; }, addEventListener() {} } }, document: null };
  shared.document = shared.window.document;
  shared.window.window = shared.window;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'lib/release-status.js'), 'utf8'), shared);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'lib/live-player.js'), 'utf8'), shared);
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'lib/statement-pdf.js'), 'utf8'), shared);
  vm.runInNewContext(catalogSrc, shared);
  assert.ok(shared.window.PlaigroundUploadCatalog, 'catalog must boot after other song-page scripts that use var api');
  assert.ok(shared.window.PlaigroundUploadCatalog.GENRES.length >= 180);
  assert.ok(catalogSrc.indexOf('if (matches.length >= 12) break;') === -1);
  assert.ok(catalogSrc.indexOf("new Event('pointerdown'") === -1, 'document pick must not re-dispatch pointerdown');
  assert.ok(catalogSrc.indexOf('bindTypeaheadDocumentPick') === -1, 'recursive pointerdown dispatcher must be gone');
  assert.ok(catalogSrc.indexOf('Type to search') !== -1);
  assert.ok(catalog.TYPEAHEAD_LIST_CAP >= 20 && catalog.TYPEAHEAD_LIST_CAP <= 30);
  assert.ok(!/setTimeout\(function \(\) \{ fillUploadSelects/.test(catalogSrc), 'fillUploadSelects must not rebind on 0ms/400ms timers');
  assert.ok(catalogSrc.indexOf('visualViewport') !== -1);
  assert.ok(catalogSrc.indexOf('pointerdown') !== -1);
  assert.ok(catalogSrc.indexOf('must not jump the input') !== -1);
  assert.ok(/if \(typeof module === 'object' && module.exports\) \{[\s\S]*?\}\s*if \(typeof window !== 'undefined'\)/.test(catalogSrc), 'catalog must attach on window even when CommonJS module exists');
  const tonegridSrc = fs.readFileSync(path.join(__dirname, 'store-client.js'), 'utf8');
  assert.ok(tonegridSrc.indexOf('function bindUploadCatalog') !== -1, 'upload must bind typeahead itself, not only wait for DOMContentLoaded');
  assert.ok(tonegridSrc.indexOf('fillUploadSelects') !== -1);
  assert.ok(tonegridSrc.indexOf('bindTypeahead') !== -1);
  assert.ok(tonegridSrc.indexOf('function catalogFieldValue') !== -1, 'upload must read the typeahead pick, not only select.value');
  assert.ok(tonegridSrc.indexOf('function ensureUploadTypeahead') !== -1, 'Basic account ready must re-ensure genre/language typeahead');
  assert.ok(tonegridSrc.indexOf('ensureUploadTypeahead()') !== -1);
  assert.ok(tonegridSrc.indexOf('function clearNewReleaseDraft') !== -1, 'New release must wipe leftover draft');
  assert.ok(tonegridSrc.indexOf('isNewReleaseStart') !== -1);
  assert.ok(tonegridSrc.indexOf('function cancelInProgressUpload') !== -1, 'mid-upload Cancel must wipe the leftover draft');
  assert.ok(tonegridSrc.indexOf('Cancel this upload? This loses the in-progress info.') !== -1);
  assert.ok(/class="btn btn-ghost btn-sm" data-upload-cancel>Cancel</.test(upload), 'Cancel is a real secondary button');
  assert.ok(/class="btn btn-ghost btn-sm" data-upload-start-over>Start over</.test(upload), 'Start over is a real secondary button next to Cancel');
  assert.ok(upload.indexOf('lib/upload-leave.js') !== -1, 'New release loads Cancel / Start over without store-client');
  assert.ok(upload.indexOf('upload-leave-actions') !== -1, 'Cancel and Start over share a wrap-safe action row');
  assert.ok(upload.indexOf('Save and exit') === -1, 'upload Cancel must not say Save and exit');
  assert.ok(!/if \(typeaheadApplying\) return/.test(catalogSrc), 'fillUploadSelects must not skip bind while a pick is applying');
  const bindFn = tonegridSrc.slice(tonegridSrc.indexOf('function bindUploadCatalog'), tonegridSrc.indexOf('function restoreUploadDraft'));
  assert.ok(bindFn.indexOf('plan') === -1, 'genre/language bind is not plan-gated');
  const songSrc = fs.readFileSync(path.join(__dirname, 'song.js'), 'utf8');
  const fillFn = songSrc.slice(songSrc.indexOf('function fillCatalogSelects'), songSrc.indexOf('function syncCatalogValues'));
  assert.ok(fillFn.indexOf('plan') === -1 && fillFn.indexOf('paid') === -1, 'edit genre/language bind is not plan-gated');
  assert.ok(!/data-for-plans/.test(upload.slice(Math.max(0, upload.indexOf('id="tg-genre"') - 280), upload.indexOf('id="tg-genre"') + 180)), 'genre is not plan-gated');
  assert.ok(!/data-for-plans/.test(upload.slice(Math.max(0, upload.indexOf('id="tg-language"') - 280), upload.indexOf('id="tg-language"') + 180)), 'language is not plan-gated');
  assert.ok(tonegridSrc.indexOf('ignoreEmpty') !== -1, 'calendar input must not wipe a just-picked date');
  const css = fs.readFileSync(path.join(__dirname, 'site.css'), 'utf8');
  assert.ok(/\.typeahead-list\s*\{[\s\S]*?overflow-y:\s*auto/.test(css));
  assert.ok(/\.typeahead-list\s*\{[\s\S]*?max-height:\s*240px/.test(css));
  assert.ok(/input\.typeahead-input[\s\S]*?font-size:\s*16px/.test(css));
  assert.ok(/select\.is-typeahead-source[\s\S]*?width:\s*0/.test(css));
  assert.ok(/select\.details-select\.is-typeahead-source/.test(css));
  assert.ok(/select\.is-typeahead-source[\s\S]*?pointer-events:\s*none/.test(css));
  assert.ok(/\.typeahead-field\.is-typeahead-open\s*\{[^}]*z-index:\s*4100/.test(css), 'open typeahead must sit above the PLAI bubble');
  assert.ok(/\.typeahead-list\s*\{[\s\S]*?z-index:\s*4200/.test(css), 'typeahead list must sit above the PLAI bubble');
  assert.ok(css.indexOf('::-webkit-datetime-edit') !== -1, 'picked calendar date must keep visible text');
  assert.ok(catalog.LANGUAGES.filter(function (row) { return row.name === 'Akan'; }).length === 1);
  assert.ok(catalog.LANGUAGES.some(function (row) { return row.code === 'tw' && row.name === 'Twi'; }));
  assert.ok(/\.typeahead-list\.is-above/.test(css));
  assert.ok(/\.typeahead-list button[\s\S]*?min-height:\s*44px/.test(css));
  assert.ok(/\.typeahead-list button[\s\S]*?cursor:\s*pointer/.test(css), 'iOS click targets need cursor:pointer');
  assert.ok(catalogSrc.indexOf('holdBlur') !== -1, 'iOS tap must hold blur until touchend');
  assert.ok(catalogSrc.indexOf('commitTouchEnd') !== -1, 'iOS must commit on touchend, not only click');
  assert.ok(catalogSrc.indexOf('pickFromClientPoint') !== -1, 'iOS tap that misses the option node must still use the tap point');
  assert.ok(catalogSrc.indexOf('claimTypeahead') !== -1, 'only one Basic typeahead list may own the tap');
  assert.ok(catalogSrc.indexOf('is-fixed') !== -1, 'genre list must escape the form-grid overlay');
  assert.ok(catalogSrc.indexOf('preferNativeCatalogSelect') === -1, 'Basic upload must not keep the #129 native-only picker');
  assert.ok(/iPad\|iPhone\|iPod/.test(catalogSrc), 'phone type-to-filter still detects iOS Safari');
  assert.ok(catalogSrc.indexOf('max-width: 720px') !== -1, 'phone type-to-filter still detects a phone-width viewport');
  assert.ok(catalogSrc.indexOf('isBasicUploadCatalogSelect') !== -1, 'type-to-filter includes Basic upload genre/language');
  assert.ok(catalogSrc.indexOf('preferTypeToFilterNative') !== -1, 'Basic, Edit, and Submit review get type-to-filter on phone');
  assert.ok(catalogSrc.indexOf('isSubmitReviewPage') === -1, 'Submit review no longer special-cases away from Basic typeahead');
  assert.ok(catalogSrc.indexOf('bindTypeToFilterNative') !== -1, 'phone fallback still finds Hip-Hop by typing');
  const reviewHtml = fs.readFileSync(path.join(__dirname, 'review.html'), 'utf8');
  assert.ok(/id="tg-genre"/.test(reviewHtml), 'Submit review has the same genre field as Creator');
  assert.ok(/id="tg-language"/.test(reviewHtml), 'Submit review has the same language field as Creator');
  assert.ok(/data-upload-cancel>Cancel</.test(reviewHtml), 'Submit review Cancel is a real button');
  assert.ok(reviewHtml.indexOf('Save and exit') === -1, 'Submit review Cancel must not say Save and exit');
  assert.ok(reviewHtml.indexOf('upload-catalog.js') !== -1, 'Submit review loads the Creator catalog lists');
  assert.ok(catalogSrc.indexOf('isCoarsePointer') !== -1 && catalogSrc.indexOf('pointer: coarse') !== -1, 'iPhone must not use the desktop fixed overlay');
  assert.ok(catalogSrc.indexOf('Do not rewrite the visible field while') !== -1, 'genre labels must not autofill mid-type');
  assert.ok(/@media\s*\(hover:\s*hover\)\s*and\s*\(pointer:\s*fine\)\s*\{[\s\S]*?html\.is-typeahead-open[\s\S]*?pointer-events:\s*none/.test(css), 'desktop open genre still disables the language field under the list');
  assert.ok(!/^html\.is-typeahead-open \.typeahead-field:not\(\.is-typeahead-open\) \{\s*pointer-events: none;/m.test(css), 'iPhone must keep sibling typeaheads tappable');
  assert.ok(/\.typeahead-list\.is-fixed[\s\S]*?position:\s*fixed/.test(css), 'fixed typeahead list sits above the next field');
  assert.ok(catalogSrc.indexOf("new Event('pointerdown'") === -1, 'document pick must not re-dispatch pointerdown');

  const aGenres = catalog.GENRES.filter(function (name) { return /^a/i.test(name); });
  assert.ok(aGenres.length > 12, 'catalog must have more than 12 A-genres so the old 12-cap was stuck on A');
  assert.ok(catalog.GENRES.some(function (name) { return /^b/i.test(name); }));

  const field = {
    children: [],
    classList: { tokens: Object.create(null), add(name) { this.tokens[name] = true; } },
    querySelector() { return { setAttribute() {} }; },
    insertBefore(node) { this.children.push(node); return node; },
    appendChild(node) { this.children.push(node); return node; },
  };
  const select = {
    parentNode: field,
    id: 'tg-genre',
    options: [{ value: '', textContent: 'Select genre' }],
    selectedIndex: 0,
    value: '',
    tabIndex: 0,
    classList: { add() {} },
    attrs: {},
    getAttribute(name) { return this.attrs[name] || null; },
    setAttribute(name, value) { this.attrs[name] = String(value); },
    dispatchEvent() {},
  };
  const created = [];
  const prevDocument = global.document;
  global.document = {
    listeners: {},
    addEventListener(type, fn) { this.listeners[type] = fn; },
    createElement(tag) {
      const node = mockTypeaheadEl(tag);
      created.push(node);
      return node;
    },
  };
  try {
    catalog.bindTypeahead(select, catalog.GENRES, function (name) { return name; }, function (name) { return name; });
    const input = created.find(function (node) { return node.className === 'typeahead-input'; });
    const list = created.find(function (node) { return String(node.className).indexOf('typeahead-list') !== -1; });
    assert.ok(input);
    assert.ok(list);
    input.listeners.focus();
    assert.ok(listButtons(list).length <= catalog.TYPEAHEAD_LIST_CAP, 'empty query must not dump the full catalog into the DOM');
    assert.ok(listButtons(list).length >= 1, 'empty focus still shows a short option list');
    assert.ok(list.children.some(function (node) { return /type to search/i.test(node.textContent); }), 'empty focus shows Type to search');
    assert.ok(listButtons(list).length < catalog.GENRES.length, 'empty list is capped, not every genre');
    assert.strictEqual(list.style.overflowY, 'auto');
    assert.ok(Number(String(list.style.maxHeight).replace('px', '')) >= 240);
    input.value = 'Zydeco';
    input.listeners.input();
    assert.ok(listButtons(list).some(function (btn) { return btn.textContent === 'Zydeco'; }), 'typing searches the full catalog, not a stuck A-prefix clip');

    testTypeaheadPrefixBlurKeepsFirstOption(select, input, 'Hip', 'Hip-Hop');
    testTypeaheadGarbageStillClears(select, input);

    input.value = 'Pop';
    input.listeners.input();
    const popBtn = listButtons(list).find(function (btn) { return btn.textContent === 'Pop'; });
    assert.ok(popBtn, 'prefix tap still finds a real catalog option');
    let pointerDispatch = 0;
    popBtn.dispatchEvent = function () { pointerDispatch += 1; };
    if (global.document.listeners && global.document.listeners.pointerdown) {
      global.document.listeners.pointerdown({ target: popBtn, preventDefault: function () {}, stopPropagation: function () {} });
      assert.ok(pointerDispatch <= 1, 'document capture pointerdown must not recurse');
    } else {
      assert.strictEqual(pointerDispatch, 0, 'recursive document pointerdown dispatcher is gone');
    }
    pickFromList(list, 'Pop');
    assert.strictEqual(select.value, 'Pop', 'tapping a real genre commits and stays');
    assert.strictEqual(input.value, 'Pop');
    assert.ok(list.classList.contains('is-hidden') || listButtons(list).length === 0, 'pick hides the list instead of rebuilding it');

    const langField = {
      children: [],
      classList: { tokens: Object.create(null), add(name) { this.tokens[name] = true; } },
      querySelector() { return { setAttribute() {} }; },
      insertBefore(node) { this.children.push(node); return node; },
      appendChild(node) { this.children.push(node); return node; },
    };
    const langSelect = {
      parentNode: langField,
      id: 'tg-language',
      options: [{ value: '', textContent: 'Select language' }],
      selectedIndex: 0,
      value: '',
      tabIndex: 0,
      classList: { add() {} },
      attrs: {},
      getAttribute(name) { return this.attrs[name] || null; },
      setAttribute(name, value) { this.attrs[name] = String(value); },
      dispatchEvent() {},
      addEventListener() {},
    };
    const langCreated = [];
    global.document.createElement = function (tag) {
      const node = mockTypeaheadEl(tag);
      node.getBoundingClientRect = function () {
        return this._rect || { top: 40, bottom: 84, left: 16, width: 280, height: 44 };
      };
      langCreated.push(node);
      return node;
    };
    catalog.bindTypeahead(langSelect, catalog.LANGUAGES, function (row) { return row.code; }, function (row) { return row.name; });
    const langInput = langCreated.find(function (node) { return node.className === 'typeahead-input'; });
    const langList = langCreated.find(function (node) { return String(node.className).indexOf('typeahead-list') !== -1; });
    assert.ok(langInput);
    assert.ok(langList);
    assert.ok(typeof langInput.listeners.click === 'function', 'language typeahead must open from a tap');
    assert.ok(typeof langInput.listeners.pointerup === 'function', 'language typeahead must open from pointerup on phone');
    langInput.listeners.click();
    assert.ok(listButtons(langList).length <= catalog.TYPEAHEAD_LIST_CAP, 'language empty list must stay under the cap');
    assert.ok(listButtons(langList).length < catalog.LANGUAGES.length, 'language empty list must not dump every ISO row');
    langInput.value = 'En';
    langInput.listeners.input();
    assert.ok(listButtons(langList).length >= 1);
    assert.ok(listButtons(langList).some(function (btn) { return btn.textContent === 'English'; }));
    assert.strictEqual(langInput.value, 'En', 'ISO code must not jump the visible field to English');
    assert.strictEqual(langSelect.value, '', 'ISO code is a filter, not a mid-type pick');
    langInput.value = 'English';
    langInput.listeners.input();
    assert.strictEqual(langSelect.value, 'en');
    assert.strictEqual(langInput.value, 'English');
    pickFromList(langList, 'English');
    assert.strictEqual(langSelect.value, 'en');
    assert.strictEqual(langInput.value, 'English');
    langInput.value = 'en';
    langInput.listeners.input();
    assert.strictEqual(langInput.value, 'en');
    langInput.listeners.blur();
    assert.strictEqual(langSelect.value, 'en');
    assert.strictEqual(langInput.value, 'English');
    testTypeaheadPrefixBlurKeepsFirstOption(langSelect, langInput, 'Engl', 'English');
    assert.strictEqual(langSelect.value, 'en');
    langInput.value = 'Klingon';
    langInput.listeners.input();
    assert.strictEqual(langSelect.value, '');
    langInput._rect = { top: 80, bottom: 124, left: 16, width: 280, height: 44 };
    const prevWindow = global.window;
    global.window = {
      innerHeight: 280,
      innerWidth: 390,
      visualViewport: { offsetTop: 0, offsetLeft: 0, width: 390, height: 280, addEventListener() {} },
      addEventListener() {},
      scrolled: 0,
      scrollBy(x, y) { this.scrolled += y; },
      setTimeout(fn) { fn(); return 1; },
      clearTimeout() {},
    };
    try {
      langInput.value = '';
      langInput.listeners.focus();
      const maxH = Number(String(langList.style.maxHeight).replace('px', ''));
      assert.ok(maxH <= 148, 'list must shrink to the space above the keyboard');
      assert.ok(maxH >= 120);
      assert.ok(global.window.scrolled !== 0, 'focused language field must scroll into the visible viewport');
      langInput._rect = { top: 430, bottom: 474, left: 16, width: 280, height: 44 };
      global.window.innerHeight = 520;
      global.window.visualViewport.height = 520;
      langInput.listeners.focus();
      assert.ok(langList.classList.contains('is-above'), 'list flips above when the keyboard leaves no room below');
    } finally {
      if (prevWindow === undefined) delete global.window;
      else global.window = prevWindow;
    }
  } finally {
    if (prevDocument === undefined) delete global.document;
    else global.document = prevDocument;
  }

  const faq = fs.readFileSync(path.join(__dirname, 'faq.html'), 'utf8');
  assert.ok(faq.indexOf('data-faq-store-list') !== -1);
  assert.ok(faq.indexOf('lib/store-pick.js') !== -1);
  assert.ok(/\b150 platforms\b/.test(faq));
  assert.ok(!/\b55 stores\b/.test(faq));
  assert.ok(!/live store catalog/.test(faq));
  assert.ok(!/\b164\b/.test(faq.replace(/facebook\.com\/profile\.php\?id=61593116849937/g, '')));

  const review = fs.readFileSync(path.join(__dirname, 'review.html'), 'utf8');
  assert.ok(review.indexOf('Pre-select all stores') !== -1);
  assert.ok(review.indexOf('data-store-customize') !== -1);
  assert.ok(review.indexOf('All stores will receive this release.') !== -1);
  assert.ok(!/\b55 stores\b/.test(review));
  assert.ok(!/\b150 stores\b/.test(review));
  assert.ok(review.indexOf('164 of 165 stores') === -1);
  assert.ok(review.indexOf('All 156 other stores') === -1);
  assert.ok(review.indexOf('164 of 163 stores') === -1);

  const uploadHtml = fs.readFileSync(path.join(__dirname, 'upload.html'), 'utf8');
  assert.ok(uploadHtml.indexOf('All stores will receive this release.') !== -1);
  assert.ok(!/\b55 stores\b/.test(uploadHtml));
  assert.ok(!/\b150 stores\b/.test(uploadHtml));

  const submitted = fs.readFileSync(path.join(__dirname, 'submitted.html'), 'utf8');
  assert.ok(submitted.indexOf('data-submit-stores') !== -1);
  assert.ok(submitted.indexOf('lib/store-pick.js') !== -1);
  assert.ok(submitted.indexOf('164 of 163 stores') === -1);
  assert.ok(submitted.indexOf('164 of 164 stores') === -1);
  assert.ok(submitted.indexOf('164 of 165 stores') === -1);
  assert.ok(!/\b55 stores\b/.test(submitted));
  assert.ok(!/\b163 stores\b/.test(submitted));
  assert.ok(!/\b164 of \d+/.test(submitted));

  const song = fs.readFileSync(path.join(__dirname, 'song.html'), 'utf8');
  assert.ok(/\.store-pick label input[\s\S]*position:\s*static/.test(css), 'store chips must reset toggle-input overlay');
  assert.ok(css.includes('store-pick-box'));
  assert.ok(css.includes('white-space: nowrap'));
  assert.ok(song.indexOf('id="edit-language"') !== -1);
  assert.ok(song.indexOf('name="release-language"') !== -1);
  assert.ok(song.indexOf('<select id="edit-genre"') !== -1);
  assert.ok(song.indexOf('<input id="edit-genre"') === -1);
  assert.ok(song.indexOf('id="edit-subgenre"') === -1);
  assert.ok(song.indexOf('name="release-subgenre"') === -1);
  assert.ok(song.indexOf('Pre-select all stores') !== -1);
  assert.ok(song.indexOf('data-store-customize') !== -1);
  assert.ok(song.indexOf('accept="audio/*,.wav,.flac,.mp3,.mpeg,.mpga') !== -1);
  assert.ok(song.indexOf('lib/audio-accept.js') !== -1);
  assert.ok(song.indexOf('lib/store-pick.js') !== -1);

  const editSelectHtml = selectById(song, 'edit-genre');
  const editGenre = options(editSelectHtml);
  assert.deepStrictEqual(editGenre.map(function (opt) { return opt.value; }), ['']);
  assert.strictEqual(editGenre[0].label, 'Select genre');

  function realisticSelect(id) {
    const field = {
      children: [],
      classList: { tokens: Object.create(null), add(name) { this.tokens[name] = true; } },
      querySelector(sel) {
        if (sel && sel.indexOf('label') === 0) return { setAttribute() {} };
        if (sel === '.typeahead-input') return this.children.find(function (node) { return node.className === 'typeahead-input'; }) || null;
        return null;
      },
      insertBefore(node) { this.children.push(node); return node; },
      appendChild(node) { this.children.push(node); return node; },
    };
    const optionsArr = [{ value: '', textContent: 'Select genre', parentNode: field }];
    const select = {
      parentNode: field,
      id: id,
      options: optionsArr,
      selectedIndex: 0,
      _value: '',
      tabIndex: 0,
      classList: { add() {} },
      attrs: {},
      get value() { return this._value; },
      set value(next) {
        const found = this.options.find(function (opt) { return opt.value === next; });
        if (found) {
          this._value = next;
          this.selectedIndex = this.options.indexOf(found);
        } else {
          this._value = '';
          this.selectedIndex = 0;
        }
      },
      getAttribute(name) { return this.attrs[name] || null; },
      setAttribute(name, value) { this.attrs[name] = String(value); },
      dispatchEvent() {},
      addEventListener() {},
      querySelectorAll(sel) { return sel === 'option' ? this.options : []; },
      appendChild(child) {
        child.parentNode = this;
        this.options.push(child);
        return child;
      },
    };
    return { field: field, select: select };
  }

  const createdEdit = [];
  const prevDoc2 = global.document;
  global.document = {
    createElement(tag) {
      const node = mockTypeaheadEl(tag);
      createdEdit.push(node);
      return node;
    },
    activeElement: null,
  };
  try {
    const edit = realisticSelect('edit-genre');
    catalog.fillSelect = catalog.fillSelect;
    catalog.fillUploadSelects({
      getElementById(id) { return id === 'edit-genre' ? edit.select : null; },
    });
    catalog.fillUploadSelects({
      getElementById(id) { return id === 'edit-genre' ? edit.select : null; },
    });
    assert.ok(edit.select.options.length > 180, 'edit genre must load the same ToneGrid list as upload');
    assert.strictEqual(createdEdit.filter(function (node) { return node.className === 'typeahead-input'; }).length, 1, 'fillUploadSelects binds once when the input already exists');
    catalog.bindTypeahead(edit.select, catalog.GENRES, function (name) { return name; }, function (name) { return name; });
    const editInput = createdEdit.find(function (node) { return node.className === 'typeahead-input'; });
    const editList = createdEdit.find(function (node) { return String(node.className).indexOf('typeahead-list') !== -1; });
    assert.ok(editInput);
    assert.ok(editList);
    catalog.setTypeaheadValue(edit.select, 'electronic');
    assert.strictEqual(edit.select.value, 'Electronic');
    assert.strictEqual(editInput.value, 'Electronic');
    editInput.value = 'Afrobeat';
    editInput.listeners.input();
    assert.ok(listButtons(editList).some(function (btn) { return btn.textContent === 'Afrobeats'; }));
    pickFromList(editList, 'Afrobeats');
    assert.strictEqual(edit.select.value, 'Afrobeats');
    assert.strictEqual(editInput.value, 'Afrobeats');
    editInput.value = 'Made Up Genre';
    editInput.listeners.input();
    assert.strictEqual(edit.select.value, '');
    assert.strictEqual(catalog.canonicalCatalogValue(edit.select, 'Made Up Genre'), null);
    assert.strictEqual(catalog.canonicalCatalogValue(edit.select, 'Pop'), 'Pop');
    testTypeaheadDelayedBlurKeepsListPick(catalog, createdEdit);
    testTypeaheadFilledFieldReopensOnRetap(catalog);
    testTypeaheadOpenDefersScroll(catalog);
    testTypeaheadRebindsIfInputMissing(catalog);
    testBasicPhoneUsesTypeahead(catalog);
    testBasicTypeaheadFiltersAndEnglishFirst(catalog);
    testDesktopTypeaheadStillBindsOnFinePointer(catalog);
    testEditTypeToFilterOnIos(catalog);
    testReviewTypeToFilterOnIos(catalog);
    testEditDesktopTypeaheadFiltersHip(catalog);
  } finally {
    if (prevDoc2 === undefined) delete global.document;
    else global.document = prevDoc2;
  }

  console.log('upload-defaults.test.js ok');
}

run();
