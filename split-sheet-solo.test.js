'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function makeStorage() {
  const data = Object.create(null);
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem(key, value) {
      data[key] = String(value);
    },
    removeItem(key) {
      delete data[key];
    },
  };
}

function makeEl(attrs) {
  const el = {
    id: attrs.id || '',
    value: attrs.value != null ? attrs.value : '',
    textContent: attrs.textContent || '',
    hidden: Boolean(attrs.hidden),
    disabled: false,
    innerHTML: '',
    href: attrs.href || '',
    className: attrs.className || '',
    attrs: Object.assign({}, attrs.attrs || {}),
    listeners: Object.create(null),
    classList: {
      tokens: Object.create(null),
      toggle(name, force) {
        if (force === undefined) {
          if (this.tokens[name]) delete this.tokens[name];
          else this.tokens[name] = true;
          return;
        }
        if (force) this.tokens[name] = true;
        else delete this.tokens[name];
      },
      add(name) { this.tokens[name] = true; },
      remove(name) { delete this.tokens[name]; },
      contains(name) { return Boolean(this.tokens[name]); },
    },
    getAttribute(name) {
      return this.attrs[name] == null ? null : this.attrs[name];
    },
    setAttribute(name, value) {
      this.attrs[name] = String(value);
    },
    addEventListener(type, fn) {
      this.listeners[type] = fn;
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    closest() { return null; },
    scrollIntoView() {},
  };
  if (attrs.className === 'is-hidden' || /\bis-hidden\b/.test(attrs.className || '')) {
    el.classList.tokens['is-hidden'] = true;
  }
  return el;
}

function extractScript() {
  const html = fs.readFileSync(path.join(__dirname, 'split-sheet.html'), 'utf8');
  const match = html.match(/<script>\s*(\(function \(\) \{[\s\S]*?\}\)\(\);)\s*<\/script>/);
  assert.ok(match, 'missing split-sheet page script');
  return match[1];
}

function load(options) {
  const opts = options || {};
  const title = makeEl({ id: 'song-title', value: '' });
  const writers = makeEl({ id: 'writers' });
  const totalBox = makeEl({ id: 'total-box', textContent: 'Total 100%' });
  const addBtn = makeEl({ id: 'add-writer' });
  const slotNote = makeEl({ id: 'slot-note', className: 'hint is-hidden' });
  const statusEl = makeEl({ id: 'form-status', className: 'alert is-hidden' });
  const configBanner = makeEl({ id: 'config-banner', className: 'alert is-hidden' });
  const signBtn = makeEl({ id: 'sign-in-page' });
  const emailBtn = makeEl({ id: 'email-link' });
  const embedCard = makeEl({ id: 'embed-card', className: 'flow-card embed-card is-hidden' });
  const emailDone = makeEl({ id: 'email-done', className: 'flow-card is-hidden' });
  const signActions = makeEl({ id: 'sign-actions' });
  const incomplete = makeEl({ id: 'incomplete-alert', className: 'alert' });
  const continueReview = makeEl({ href: 'review.html' });

  const byId = {
    writers: writers,
    'total-box': totalBox,
    'add-writer': addBtn,
    'slot-note': slotNote,
    'form-status': statusEl,
    'config-banner': configBanner,
    'sign-in-page': signBtn,
    'email-link': emailBtn,
    'embed-card': embedCard,
    'email-done': emailDone,
    'sign-actions': signActions,
    'song-title': title,
    'incomplete-alert': incomplete,
  };

  const localStorage = makeStorage();
  const sessionStorage = makeStorage();
  if (opts.draft) {
    const text = JSON.stringify(opts.draft);
    if (opts.store === 'session') sessionStorage.setItem('plaiground.tonegrid.draft', text);
    else if (opts.store === 'both') {
      localStorage.setItem('plaiground.tonegrid.draft', text);
      sessionStorage.setItem('plaiground.tonegrid.draft', text);
    } else {
      localStorage.setItem('plaiground.tonegrid.draft', text);
    }
  }

  const calls = [];
  const context = {
    document: {
      hidden: false,
      getElementById(id) {
        return byId[id] || null;
      },
      querySelector(sel) {
        if (sel === '#email-done a[href="review.html"]') return continueReview;
        return null;
      },
      addEventListener() {},
    },
    localStorage,
    sessionStorage,
    addEventListener() {},
    fetch(url, options) {
      calls.push({ url: String(url), method: String((options && options.method) || 'GET') });
      if (String(url).indexOf('/api/signwell?id=') !== -1) {
        return Promise.resolve({
          ok: true,
          json: async () => (opts.signwellGet || { signed: false, status: 'Pending' }),
        });
      }
      if (String((options && options.method) || 'GET').toUpperCase() === 'POST') {
        calls[calls.length - 1].body = options && options.body ? JSON.parse(options.body) : null;
        return Promise.resolve({
          ok: true,
          json: async () => ({ documentId: 'doc_multi_01', mode: JSON.parse(options.body).emailLinkOnly ? 'email' : 'embed', embeddedSigningUrl: 'https://example.invalid/sign' }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ configured: true }),
      });
    },
    PlaigroundUploadRequired: require('./lib/upload-required'),
    PlaigroundReleaseCredits: {
      seedWriters() {
        return Array.isArray(opts.writers) && opts.writers.length
          ? opts.writers
          : [{ first_name: '', last_name: '', name: '', email: '', share: 100, pro: '' }];
      },
    },
  };
  context.location = { href: 'https://www.wannaplai.com/split-sheet.html', origin: 'https://www.wannaplai.com' };
  context.URL = URL;
  context.embeds = [];
  // Mirrors SignWell's embedded.js: every redirect URL goes through new URL(value.trim()), which throws on a relative path.
  context.SignWellEmbed = function (o) {
    if (o.redirectionUrl) new URL(String(o.redirectionUrl).trim());
    context.embeds.push(o);
    this.open = function () { context.embedOpened = true; };
  };
  context.PlaigroundUploadDraftFiles = { keepHeldFiles() { return Promise.resolve(null); } };
  context.window = context;
  context.globalThis = context;

  vm.runInNewContext(extractScript(), context);
  return {
    context,
    writersEl: writers,
    addBtn,
    emailBtn,
    emailDone,
    title,
    incomplete,
    signBtn,
    localStorage,
    sessionStorage,
    listeners: title.listeners,
    status: statusEl,
    calls,
  };
}

function draftOf(storage) {
  return JSON.parse(storage.getItem('plaiground.tonegrid.draft') || '{}');
}


async function flush() {
  for (let i = 0; i < 4; i += 1) await new Promise(function (resolve) { setImmediate(resolve); });
}
function draftOf(storage, key) {
  return JSON.parse(storage.getItem(key || 'plaiground.tonegrid.draft') || '{}');
}
function solo(pro) {
  return { first_name: 'German', last_name: 'Nunez', name: 'German Nunez', email: 'herman@example.com', share: 100, pro: pro };
}
const HERMAN_DRAFT = {
  title: 'NASTY (feat. Herman Watson, Baby Bash & Nate Dogg)',
  featured: 'Herman Watson, Baby Bash & Nate Dogg',
  legal_first: 'German',
  legal_last: 'Nunez',
  solo_owned_100: false,
  other_writers: true,
};
const required = require('./lib/upload-required');

async function run() {
  const results = [];
  function ok(name, cond) { assert.ok(cond, name); results.push(name); }

  // Solo writer at 100% with each PRO option (and none): goes to Review, no SignWell POST.
  for (const pro of ['', 'BMI', 'ASCAP', 'SESAC', 'Other', 'None / not yet']) {
    for (const button of ['signBtn', 'emailBtn']) {
      const page = load({ draft: HERMAN_DRAFT, writers: [solo(pro)] });
      page.localStorage.setItem('plaiground.store.draft', JSON.stringify(Object.assign({ release_id: 'rel_1' }, HERMAN_DRAFT)));
      await flush();
      ok('solo ' + (pro || 'no PRO') + ' ' + button + ': no blocking alert', page.incomplete.classList.contains('is-hidden'));
      await page[button].listeners.click();
      await flush();
      ok('solo ' + (pro || 'no PRO') + ' ' + button + ': no SignWell POST', !page.calls.some(function (c) { return c.method === 'POST'; }));
      ok('solo ' + (pro || 'no PRO') + ' ' + button + ': lands on Review', page.context.location.href === 'review.html');
      const store = draftOf(page.localStorage, 'plaiground.store.draft');
      ok('solo ' + (pro || 'no PRO') + ' ' + button + ': store draft is solo', store.solo_owned_100 === true && store.solo_writer_confirmed === true && store.release_id === 'rel_1');
      ok('solo ' + (pro || 'no PRO') + ' ' + button + ': writer PRO kept', store.writers.length === 1 && store.writers[0].pro === pro);
      ok('solo ' + (pro || 'no PRO') + ' ' + button + ': review treats it as solo', required.isSoloOwned(store));
    }
  }

  // Two writers summing to 100%, one with no PRO: SignWell POST with both buttons.
  for (const button of ['signBtn', 'emailBtn']) {
    const two = [solo('ASCAP'), { first_name: 'Ada', last_name: 'Night', name: 'Ada Night', email: 'ada@example.com', share: 50, pro: '' }];
    two[0] = Object.assign({}, two[0], { share: 50 });
    const page = load({ draft: { title: 'Duo' }, writers: two });
    page.localStorage.setItem('plaiground.store.draft', JSON.stringify({ title: 'Duo', release_id: 'rel_2' }));
    await flush();
    await page[button].listeners.click();
    await flush();
    const post = page.calls.find(function (c) { return c.method === 'POST'; });
    ok('2 writers ' + button + ': SignWell POST sent', Boolean(post));
    ok('2 writers ' + button + ': emailLinkOnly matches button', post.body.emailLinkOnly === (button === 'emailBtn'));
    ok('2 writers ' + button + ': no-PRO writer allowed', post.body.writers[1].pro === '');
    const store = draftOf(page.localStorage, 'plaiground.store.draft');
    ok('2 writers ' + button + ': document id reaches the Review draft', store.signwell_document_id === 'doc_multi_01' && store.solo_owned_100 === false);
    ok('2 writers ' + button + ': not solo at Review', !required.isSoloOwned(store));
    if (button === 'signBtn') {
      ok('2 writers sign in page: SignWell embed opens (no Could not reach)', page.context.embedOpened === true && page.status.textContent.indexOf('Could not reach') === -1);
      ok('2 writers sign in page: redirect URL is absolute', page.context.embeds[0].redirectionUrl === 'https://www.wannaplai.com/review.html');
    }
  }

  // Three writers 40/30/30.
  {
    const w = [Object.assign(solo('BMI'), { share: 40 }),
      { first_name: 'A', last_name: 'B', name: 'A B', email: 'a@example.com', share: 30, pro: 'SESAC' },
      { first_name: 'C', last_name: 'D', name: 'C D', email: 'c@example.com', share: 30, pro: 'Other' }];
    const page = load({ draft: { title: 'Trio' }, writers: w });
    await flush();
    await page.emailBtn.listeners.click();
    await flush();
    ok('3 writers: SignWell POST sent', page.calls.some(function (c) { return c.method === 'POST'; }));
  }

  // Add then remove a collaborator: no phantom Writer 2 warning, solo still goes through.
  {
    const page = load({ draft: HERMAN_DRAFT, writers: [solo('ASCAP')] });
    await flush();
    page.addBtn.listeners.click();
    ok('add collaborator shows Writer 2 warning', !page.incomplete.classList.contains('is-hidden') && /Writer 2/.test(page.incomplete.textContent));
    page.writersEl.listeners.click({ target: { closest() { return { getAttribute() { return '1'; } }; } } });
    ok('remove collaborator clears the Writer 2 warning', page.incomplete.classList.contains('is-hidden'));
    await page.signBtn.listeners.click();
    await flush();
    ok('after add/remove, solo goes to Review', page.context.location.href === 'review.html');
  }

  // Shares off 100 still blocks; missing co-writer email still blocks.
  {
    const page = load({ draft: { title: 'Off' }, writers: [Object.assign(solo(''), { share: 90 })] });
    await flush();
    await page.signBtn.listeners.click();
    await flush();
    ok('solo at 90% is blocked', page.context.location.href !== 'review.html' && /100%/.test(page.status.textContent));
    const page2 = load({ draft: { title: 'Duo' }, writers: [Object.assign(solo(''), { share: 50 }), { first_name: 'A', last_name: 'B', name: 'A B', email: '', share: 50, pro: '' }] });
    await flush();
    await page2.signBtn.listeners.click();
    await flush();
    ok('co-writer with no email is blocked', /Writer 2 needs an email/.test(page2.status.textContent) && !page2.calls.some(function (c) { return c.method === 'POST'; }));
  }

  // isSoloOwned rules.
  ok('featured without confirmation is not solo', !required.isSoloOwned({ solo_owned_100: true, featured: 'Guest' }));
  ok('featured with split-sheet confirmation is solo', required.isSoloOwned({ solo_owned_100: true, solo_writer_confirmed: true, featured: 'Guest' }));
  ok('confirmation with 2 named writers is not solo', !required.isSoloOwned({ solo_owned_100: true, solo_writer_confirmed: true, writers: [{ name: 'A' }, { name: 'B' }] }));
  ok('plain solo still solo', required.isSoloOwned({ solo_owned_100: true }));
  ok('not flagged is not solo', !required.isSoloOwned({ solo_writer_confirmed: true }));

  // Server-side submit validation passes for every AI label.
  const labels = {
    no_ai: { made_how: 'no_ai', rights_confirmed: true, release_date: '2026-11-20', human_elements: ['Original lyrics'] },
    ai_assisted: { made_how: 'ai_assisted', rights_confirmed: true, release_date: '2026-11-20', human_elements: ['Original lyrics', 'Lead vocals performed'], human_contribution: 'I wrote the lyrics and sang the lead.', ai_service: 'Suno' },
    fully_ai: { made_how: 'fully_ai', rights_confirmed: true, release_date: '2026-11-20', ai_service: '', ai_service_other: 'My Tool' },
  };
  Object.keys(labels).forEach(function (k) {
    const out = required.validateSubmit(Object.assign({ solo_owned_100: true, solo_writer_confirmed: true, featured: 'Guest' }, labels[k]), {});
    ok('validateSubmit ' + k + ' passes: ' + JSON.stringify(out), out.ok === true);
  });

  console.log('split-sheet-solo.test.js ok (' + results.length + ' checks)');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
