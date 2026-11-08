/*
 * SIQA spotlight preview checks.
 * Shared by the browser page and node tests.
 * A passing check is still not stored, emailed, or subscribed.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SpotlightPreview = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var LIMITS = { name: 80, email: 120, link: 300, story: 800, storyMin: 20, nameMin: 2 };

  function text(value) {
    return String(value == null ? '' : value).replace(/\r\n/g, '\n');
  }

  function trimmed(value) {
    return text(value).trim();
  }

  function linkError(link) {
    if (!link) return 'Add one link to your music or artist page.';
    if (link.length > LIMITS.link) return 'Use one shorter link.';
    if (/\s/.test(link)) return 'Use one link, with no spaces or a second link.';
    var url;
    try {
      url = new URL(link);
    } catch (err) {
      return 'Use a full link that starts with https://.';
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return 'Use a full link that starts with https://.';
    if (url.username || url.password) return 'Use a public link, without a password in it.';
    if (!url.hostname || url.hostname.indexOf('.') === -1) return 'That link needs a full site name.';
    return '';
  }

  function emailError(email) {
    if (!email) return 'Enter an email an editor could reply to.';
    if (email.length > LIMITS.email || /\s/.test(email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return 'Enter an email an editor could reply to.';
    }
    return '';
  }

  function wantsUpdates(value) {
    return value === true || value === 'yes' || value === 'on';
  }

  function check(input) {
    var raw = input || {};
    var base = { ok: false, stored: false, emailed: false, subscribed: false };
    if (trimmed(raw.company)) {
      return Object.assign({}, base, { errors: { form: 'This preview could not check that.' } });
    }

    var name = trimmed(raw.name);
    var email = trimmed(raw.email);
    var link = trimmed(raw.link);
    var story = trimmed(raw.story);
    var errors = {};

    if (name.length < LIMITS.nameMin) errors.name = 'Add the public name you want an editor to see.';
    else if (name.length > LIMITS.name) errors.name = 'Keep the public name under 80 characters.';
    var badEmail = emailError(email);
    if (badEmail) errors.email = badEmail;
    var badLink = linkError(link);
    if (badLink) errors.link = badLink;
    if (story.length < LIMITS.storyMin) errors.story = 'Add a short story, at least a sentence.';
    else if (story.length > LIMITS.story) errors.story = 'Keep the story under 800 characters.';

    if (Object.keys(errors).length) return Object.assign({}, base, { errors: errors });

    return {
      ok: true,
      stored: false,
      emailed: false,
      subscribed: false,
      updatesChecked: wantsUpdates(raw.updates),
      preview: {
        name: name,
        email: email,
        link: link,
        story: story,
        updates: wantsUpdates(raw.updates)
      }
    };
  }

  return { LIMITS: LIMITS, check: check };
});
