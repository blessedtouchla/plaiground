'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function read(file) {
  return fs.readFileSync(path.join(__dirname, file), 'utf8');
}

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
    data,
  };
}

function loadMembership(options) {
  const localStorage = makeStorage();
  const sessionStorage = makeStorage();
  if (options && options.seedLocal) {
    Object.keys(options.seedLocal).forEach(function (key) {
      localStorage.setItem(key, options.seedLocal[key]);
    });
  }
  const location = {
    href: options.href || 'dashboard.html',
    pathname: options.pathname || '/dashboard.html',
    search: '',
    replace(next) { location.href = next; },
  };
  const context = {
    URLSearchParams,
    localStorage,
    sessionStorage,
    fetch: function () {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: function () { return Promise.resolve(options.account || {}); },
      });
    },
    document: {
      cookie: '',
      currentScript: { getAttribute() { return null; } },
      querySelector() { return null; },
      addEventListener() {},
    },
    location,
  };
  context.window = context;
  vm.runInNewContext(read('membership.js'), context);
  return { api: context.PlaigroundMembership, location };
}

function el(tag, attrs, kids) {
  const node = {
    tagName: String(tag).toUpperCase(),
    className: '',
    id: '',
    hidden: false,
    href: '',
    parentNode: null,
    children: [],
    attributes: Object.create(null),
    textContent: '',
    innerHTML: '',
    classList: {
      contains: function (name) {
        return (' ' + node.className + ' ').indexOf(' ' + name + ' ') !== -1;
      },
      add: function (name) {
        if (!node.classList.contains(name)) node.className = (node.className + ' ' + name).trim();
      },
      remove: function (name) {
        node.className = node.className.split(/\s+/).filter(function (part) { return part && part !== name; }).join(' ');
      },
      toggle: function (name, on) {
        if (on === false) node.classList.remove(name);
        else if (on === true || !node.classList.contains(name)) node.classList.add(name);
        else node.classList.remove(name);
        return node.classList.contains(name);
      },
    },
    setAttribute: function (key, value) {
      node.attributes[key] = String(value);
      if (key === 'class') node.className = String(value);
      if (key === 'id') node.id = String(value);
      if (key === 'href') node.href = String(value);
    },
    getAttribute: function (key) {
      if (key === 'class') return node.className;
      if (key === 'id') return node.id;
      if (key === 'href') return node.href;
      return Object.prototype.hasOwnProperty.call(node.attributes, key) ? node.attributes[key] : null;
    },
    appendChild: function (child) {
      if (child.parentNode) child.parentNode.removeChild(child);
      child.parentNode = node;
      node.children.push(child);
      return child;
    },
    insertBefore: function (child, ref) {
      if (child.parentNode) child.parentNode.removeChild(child);
      child.parentNode = node;
      const index = node.children.indexOf(ref);
      if (index === -1) node.children.push(child);
      else node.children.splice(index, 0, child);
      return child;
    },
    removeChild: function (child) {
      node.children = node.children.filter(function (item) { return item !== child; });
      child.parentNode = null;
      return child;
    },
    listeners: Object.create(null),
    addEventListener: function (type, fn) {
      if (!node.listeners[type]) node.listeners[type] = [];
      node.listeners[type].push(fn);
    },
    contains: function (other) {
      if (other === node) return true;
      return node.children.some(function (child) { return child.contains(other); });
    },
    querySelector: function (sel) { return qsa(node, sel)[0] || null; },
    querySelectorAll: function (sel) { return qsa(node, sel); },
  };
  Object.keys(attrs || {}).forEach(function (key) { node.setAttribute(key, attrs[key]); });
  (kids || []).forEach(function (child) { node.appendChild(child); });
  return node;
}

function match(node, sel) {
  sel = String(sel || '');
  var attr = '';
  if (sel.indexOf('[') !== -1) {
    attr = sel.slice(sel.indexOf('[') + 1, sel.lastIndexOf(']'));
    sel = sel.slice(0, sel.indexOf('['));
  }
  var parts = sel.split('.');
  var tag = parts[0];
  var classes = parts.slice(1);
  if (tag && node.tagName !== tag.toUpperCase()) return false;
  for (var i = 0; i < classes.length; i += 1) {
    if (!node.classList.contains(classes[i])) return false;
  }
  if (!attr) return true;
  if (attr.indexOf('=') === -1) return node.getAttribute(attr) != null;
  var name = attr.split('=')[0];
  var value = attr.split('=').slice(1).join('=').replace(/^["']|["']$/g, '');
  return String(node.getAttribute(name) || '') === value;
}

function qsa(root, selector) {
  const parts = String(selector || '').trim().split(/\s+/);
  function walk(node, acc) {
    acc.push(node);
    node.children.forEach(function (child) { walk(child, acc); });
    return acc;
  }
  let current = [root];
  parts.forEach(function (part) {
    const next = [];
    current.forEach(function (node) {
      walk(node, []).forEach(function (candidate) {
        if (candidate !== node && match(candidate, part) && next.indexOf(candidate) === -1) next.push(candidate);
      });
    });
    current = next;
  });
  current.forEach = Array.prototype.forEach;
  return current;
}

function runBrandNav(account) {
  const location = { href: 'settings.html', pathname: '/settings.html' };
  const who = el('a', { class: 'who', href: 'settings.html' });
  who.textContent = 'Hi there';
  const topbar = el('div', { class: 'topbar' }, [who]);
  const side = el('aside', { class: 'side' }, [el('a', { class: 'logo', href: 'dashboard.html' })]);
  const document = {
    body: el('body', { class: 'app' }, [side, el('div', { class: 'app-main' }, [topbar])]),
    querySelector: function (sel) { return document.body.querySelector(sel); },
    querySelectorAll: function (sel) { return document.body.querySelectorAll(sel); },
    createElement: function (tag) { return el(tag); },
    addEventListener: function () {},
  };
  const membership = {
    isSignedIn: function () { return true; },
    signedInHome: function () {
      return account && account.email === 'emailplaiground@gmail.com' ? '/admin' : 'dashboard.html';
    },
    isOwner: function () {
      return !!(account && account.email === 'emailplaiground@gmail.com');
    },
    whenReady: function (cb) { if (typeof cb === 'function') cb(); },
  };
  const context = {
    document: document,
    window: { location: location, PlaigroundMembership: membership },
    NodeList: Array,
  };
  context.window.document = document;
  vm.runInNewContext(read('site.js'), context);
  const logo = topbar.querySelector('.logo') || side.querySelector('.logo');
  (logo.listeners.click || []).forEach(function (fn) {
    fn({ preventDefault: function () {}, target: logo });
  });
  return { logo: logo, location: location };
}

function run() {
  const adminHtml = read('admin.html');
  const adminJs = read('admin.js');
  const membership = read('membership.js');
  const siteJs = read('site.js');
  const loginHtml = read('login.html');
  const nav = adminHtml.match(/<nav class="side-nav"[\s\S]*?<\/nav>/)[0];

  assert.ok(adminHtml.includes('<title>Admin – PLAIGROUND</title>'));
  assert.ok(adminHtml.includes('kicker">Owner'));
  assert.ok(adminHtml.includes('<h1>Admin</h1>'));
  assert.ok(/This is every signup, paid checkout, subscription, money, and store submission/.test(adminHtml));
  assert.ok(adminHtml.includes('data-owner-desk'));
  assert.ok(/href="\/admin">Admin</.test(nav), 'Admin is home on the owner desk');
  assert.ok(nav.includes('href="#signups">Signups</a>'));
  assert.ok(nav.includes('href="#paid">Paid</a>'));
  assert.ok(nav.includes('href="#subs">Subs</a>'));
  assert.ok(nav.includes('href="#money">Money</a>'));
  assert.ok(nav.includes('href="#submissions">Submissions</a>'));
  assert.ok(nav.includes('href="#deliveries">Deliveries</a>'));
  assert.ok(nav.includes('href="#royalties">Royalties</a>'));
  assert.ok(nav.includes('href="settings.html">Settings</a>'));
  assert.ok(nav.includes('href="how.html">How it works</a>'));
  assert.ok(nav.includes('href="faq.html">FAQ</a>'));
  assert.ok(nav.includes('data-have-problem'));
  assert.ok(!/New release/.test(nav), 'owner desk hides New release');
  assert.ok(!/Overview/.test(nav), 'owner desk hides Overview');
  assert.ok(!/Boosts/.test(nav), 'owner desk hides Boosts');
  assert.ok(!/Artist Profiles/.test(nav), 'owner desk hides Artist Profiles');
  assert.ok(!/data-new-release|data-overview-menu|data-publishing-register/.test(nav));
  assert.ok(!/Your plan/.test(adminHtml), 'owner desk is not a Creator pitch');
  assert.ok(!/Hi there/.test(adminHtml), 'owner desk does not greet as an artist');
  assert.ok(!/data-account-plan-title|data-account-who/.test(adminHtml));
  assert.ok(adminHtml.includes('<h3>Signups</h3>'));
  assert.ok(adminHtml.includes('<h3>Paid checkouts</h3>'));
  assert.ok(adminHtml.includes('<h3>Subscriptions</h3>'));
  assert.ok(adminHtml.includes('<h3>Money in and out</h3>'));
  assert.ok(adminHtml.includes('<h3>Submissions</h3>'));
  assert.ok(adminHtml.includes('<h3>Store deliveries</h3>'));
  assert.ok(adminHtml.includes('<h3>Store royalties</h3>'));
  assert.ok(adminHtml.includes('id="signups"') && adminHtml.includes('id="paid"') && adminHtml.includes('id="royalties"'));
  assert.ok(!adminHtml.includes('<iframe'));
  assert.ok(!/ToneGrid|InterSpace|DistroKid|\bFrank\b/i.test(adminHtml));
  assert.ok(!/ToneGrid|InterSpace|DistroKid|\bFrank\b/i.test(adminJs));

  assert.ok(adminJs.includes('emailplaiground@gmail.com'));
  assert.ok(adminJs.includes('Could not load the desk.'));
  assert.ok(!/if \(!list\.ok\)[\s\S]{0,180}location\.replace\(DENY\)/.test(adminJs), 'confirmed owner is not bounced to Overview on a data miss');

  assert.ok(membership.includes("OWNER_HOME = '/admin'"));
  assert.ok(membership.includes('signedInHome'));
  assert.ok(membership.includes('goOwnerDeskFromOverview'));
  assert.ok(siteJs.includes('signedInHome'));
  assert.ok(loginHtml.includes('signedInHome'));
  assert.ok(read('magic.html').includes('signedInHome'));
  assert.ok(read('forgot.html').includes('signedInHome'));

  const artistPages = [
    'dashboard.html',
    'settings.html',
    'artists.html',
    'faq.html',
    'how.html',
    'releases.html',
    'boosts.html',
  ];
  artistPages.forEach(function (file) {
    const html = read(file);
    const side = html.match(/<nav class="side-nav">[\s\S]*?<\/nav>/);
    assert.ok(side, file + ' keeps the artist side nav');
    assert.ok(!/>Admin</.test(side[0]), file + ' must not put Admin on the artist menu');
    assert.ok(!/href="\/admin"|href="admin(?:\.html|\/signups)?"/.test(side[0]), file + ' must not link the owner desk');
    assert.ok(side[0].includes('New release'), file + ' keeps New release for artists');
    assert.ok(side[0].includes('Overview'), file + ' keeps Overview for artists');
  });

  const owner = loadMembership({
    pathname: '/dashboard.html',
    href: 'dashboard.html',
    account: { email: 'emailplaiground@gmail.com', artist: 'Staff', plan: 'pro', status: 'active' },
  });
  const victoria = loadMembership({
    pathname: '/dashboard.html',
    href: 'dashboard.html',
    account: { email: 'victoriaimtanes@gmail.com', artist: 'Victoria', plan: 'creator', status: 'active' },
  });
  const herman = loadMembership({
    pathname: '/login.html',
    href: 'login.html',
    account: { email: 'herman@example.com', artist: 'Herman', plan: 'basic', status: 'active' },
  });
  const ownerLogin = loadMembership({
    pathname: '/login.html',
    href: 'login.html',
    account: { email: 'emailplaiground@gmail.com', artist: 'Staff', plan: 'pro', status: 'active' },
  });
  const ownerStay = loadMembership({
    pathname: '/admin',
    href: '/admin',
    account: { email: 'emailplaiground@gmail.com', artist: 'Staff', plan: 'pro', status: 'active' },
  });

  return Promise.all([
    owner.api.whenReady(),
    victoria.api.whenReady(),
    herman.api.whenReady(),
    ownerLogin.api.whenReady(),
    ownerStay.api.whenReady(),
  ]).then(function () {
    assert.strictEqual(owner.api.isOwner(), true);
    assert.strictEqual(owner.api.signedInHome(), '/admin');
    assert.strictEqual(owner.location.href, '/admin', 'owner Overview session lands on /admin');
    assert.strictEqual(victoria.api.isOwner(), false);
    assert.strictEqual(victoria.api.signedInHome(), 'dashboard.html');
    assert.strictEqual(victoria.location.href, 'dashboard.html', 'victoria stays on Overview');
    assert.strictEqual(herman.location.href, 'dashboard.html', 'Herman login stays on Overview');
    assert.strictEqual(ownerLogin.location.href, '/admin', 'owner already signed in on login.html goes to /admin');
    assert.strictEqual(ownerStay.location.href, '/admin', 'signed-in owner stays on /admin');

    const artistBrand = runBrandNav({ email: 'victoriaimtanes@gmail.com' });
    assert.strictEqual(artistBrand.logo.getAttribute('href'), 'dashboard.html', 'artist wordmark stays Overview');
    assert.strictEqual(artistBrand.location.href, 'dashboard.html');

    const ownerBrand = runBrandNav({ email: 'emailplaiground@gmail.com' });
    assert.strictEqual(ownerBrand.logo.getAttribute('href'), '/admin', 'owner wordmark is the desk');
    assert.strictEqual(ownerBrand.location.href, '/admin', 'owner logo click goes to /admin');

    console.log('owner-desk.test.js ok');
  });
}

run().catch(function (err) {
  console.error(err);
  process.exit(1);
});
