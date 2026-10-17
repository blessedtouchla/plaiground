/**
 * Plai reply cleanup. Browser and server. No secrets.
 * Spelling, dashes, and a cut-off ending are fixed after the model speaks.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PlaigroundPlaiReply = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  var FACTS = [
    'You are Plai, the release coach for PLAIGROUND. Always write your name as Plai. It is pronounced PLAY, and the written name stays Plai.',
    'Joining is free. Releasing a song is $2.49 per song, and that release is optional. Artists keep 100% of their royalties.',
    'There is no free Basic plan, and no plan covers a song for life.',
    'A first release starts by joining free, bringing or writing the song, attesting the rights, signing the split sheet, then reviewing and delivering.',
    'Never name Suno, ToneGrid, or YouTube. Do not give a count of stores.',
    'Do not use an em dash or an en dash. Answer in a few short sentences. Finish the last sentence. Never stop in the middle of a word.',
  ].join(' ');

  var PRICE = 'Joining is free. A release is $2.49 per song, and it is optional. Artists keep 100%. There is no free Basic plan.';
  var VERB_NEXT = {
    the: 1, your: 1, it: 1, this: 1, that: 1, a: 1, an: 1, my: 1, some: 1,
    along: 1, on: 1, back: 1, through: 1, out: 1,
  };

  function brandName(text) {
    return String(text || '')
      .replace(/\bPLAY\b/g, 'Plai')
      .replace(/\bPlay\b/g, function (word, offset, all) {
        var match = all.slice(offset + word.length).match(/^\s+([A-Za-z']+)/);
        var next = match ? match[1].toLowerCase().replace(/[^a-z']/g, '') : '';
        if (VERB_NEXT[next]) return word;
        return 'Plai';
      });
  }

  function dashes(text) {
    return String(text || '')
      .replace(/\s*[—–]\s*/g, ', ')
      .replace(/\s+,/g, ',')
      .replace(/,\s*,/g, ',')
      .replace(/,\s+\./g, '.')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  function dropNamed(text) {
    return String(text || '').split(/(?<=[.!?])\s+/).filter(function (line) {
      return line && !/suno|tonegrid|youtube/i.test(line) && !/\b\d+\+?\s+stores\b/i.test(line);
    }).join(' ').trim();
  }

  function badPricing(text) {
    var body = String(text || '');
    if (/no plan covers a song for life|no free basic plan/i.test(body) && !/pick basic|basic is free|covers a single song/i.test(body)) return false;
    if (/covers a single song|single song for life|pick basic|basic is free|free basic plan|basic plan is free|basic covers/i.test(body)) return true;
    return false;
  }

  function pricing(text, ask) {
    var body = String(text || '').trim();
    var question = String(ask || '');
    if (badPricing(body)) {
      var kept = body.split(/(?<=[.!?])\s+/).filter(function (line) {
        return line && !badPricing(line);
      });
      body = kept.join(' ').trim();
    }
    var aboutMoney = /cost|price|free|plan|how much|\$/i.test(question);
    if (aboutMoney && body.indexOf('$2.49') === -1) {
      body = body ? (body + ' ' + PRICE) : PRICE;
    }
    if (aboutMoney && /free plan/i.test(question) && !/no free basic plan/i.test(body)) {
      body = (body ? body + ' ' : '') + 'There is no free Basic plan.';
    }
    return body.replace(/\s+/g, ' ').trim();
  }

  function complete(text) {
    var parts = String(text || '').split(/(?<=[.!?])\s+/);
    var kept = [];
    parts.forEach(function (part) {
      var line = String(part || '').trim();
      if (line && /[.!?]$/.test(line)) kept.push(line);
    });
    if (kept.length) return kept.join(' ');
    return String(text || '').replace(/\s+\S+$/, '').trim();
  }

  function polish(text, opts) {
    var options = opts || {};
    var body = pricing(dropNamed(brandName(dashes(text))), options.ask);
    if (options.truncated) body = complete(body);
    return body.replace(/\s+/g, ' ').trim();
  }

  return {
    FACTS: FACTS,
    PRICE: PRICE,
    polish: polish,
    badPricing: badPricing,
  };
});
