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
    'You are Plai, a warm, upbeat release coach for PLAIGROUND. Write your name as Plai. It is pronounced PLAY, and the written name stays Plai.',
    'Keep these facts, and say them in your own words each time: joining is free. A release is $2.49 per song, and it is optional. Artists keep 100% of their royalties. There is no free Basic plan, and no plan covers a song for life.',
    'Sound like a person. Use short natural sentences and normal commas. When you list steps, use a short numbered list with one step on each line. End with one friendly question or a short tip.',
    'Do not copy a fixed script. Do not end on the word Plai by itself.',
    'Never name Suno, ToneGrid, or YouTube. Do not give a count of stores.',
    'Do not use an em dash or an en dash. Keep commas, periods, and question marks. Finish the last sentence. Never stop in the middle of a word.',
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
    var body = String(text || '').replace(/[ \t]*[—–][ \t]*/g, function (dash, offset, all) {
      var before = all.slice(0, offset).replace(/[ \t]+$/, '');
      var after = all.slice(offset + dash.length);
      var next = after.match(/^(\S)/);
      var capital = next && /[A-Z]/.test(next[1]);
      if (capital && before && !/[,:;]$/.test(before)) return '. ';
      return ', ';
    });
    return body
      .replace(/[ \t]+,/g, ',')
      .replace(/,\s*,/g, ',')
      .replace(/,\s+\./g, '.')
      .replace(/[ \t]{2,}/g, ' ');
  }

  function eachLine(text, mapLine) {
    return String(text || '').split('\n').map(mapLine).filter(function (line) {
      return line && String(line).trim();
    }).join('\n').trim();
  }

  function filterSentences(text, drop) {
    return eachLine(text, function (line) {
      return line.split(/(?<=[.!?])\s+/).filter(function (part) {
        return part && !drop(part);
      }).join(' ').trim();
    });
  }

  function dropNamed(text) {
    return filterSentences(text, function (line) {
      return /suno|tonegrid|youtube/i.test(line) || /\b\d+\+?\s+stores\b/i.test(line);
    });
  }

  function money(text) {
    return String(text || '')
      .replace(/\b100\s+percent\b/gi, '100%')
      .replace(/\b2\.49\s+dollars\b/gi, '$2.49')
      .replace(/(^|[^$\d])2\.49\b/g, '$1$2.49');
  }

  function strayName(text) {
    var lines = String(text || '').split('\n');
    while (lines.length && /^Plai\.$/.test(String(lines[lines.length - 1] || '').trim())) lines.pop();
    return lines.join('\n').replace(/(^|[.!?]\s+)Plai\.\s*$/g, '$1').trim();
  }

  function commas(text) {
    return String(text || '')
      .replace(/\bNo there\b/g, 'No, there')
      .replace(/\bYes there\b/g, 'Yes, there')
      .replace(/\bNo it\b/g, 'No, it')
      .replace(/\bYes it\b/g, 'Yes, it');
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
      body = filterSentences(body, badPricing);
    }
    var aboutMoney = /cost|price|free|plan|how much|\$/i.test(question);
    if (aboutMoney && !/\$?\s*2\.49/.test(body)) {
      body = body ? (body + ' ' + PRICE) : PRICE;
    }
    if (aboutMoney && /free plan/i.test(question) && !/no free basic plan/i.test(body)) {
      body = (body ? body + ' ' : '') + 'There is no free Basic plan.';
    }
    return body.trim();
  }

  function complete(text) {
    return eachLine(text, function (line) {
      var parts = String(line || '').split(/(?<=[.!?])\s+/);
      var kept = parts.filter(function (part) {
        return /[.!?]$/.test(String(part || '').trim());
      });
      if (kept.length) return kept.join(' ').trim();
      return String(line || '').replace(/\s+\S+$/, '').trim();
    });
  }

  function tidy(text) {
    return eachLine(text, function (line) {
      return String(line || '').replace(/[ \t]{2,}/g, ' ').trim();
    });
  }

  function polish(text, opts) {
    var options = opts || {};
    var body = commas(strayName(money(brandName(dashes(text)))));
    body = pricing(dropNamed(body), options.ask);
    if (options.truncated) body = complete(body);
    return tidy(body);
  }

  return {
    FACTS: FACTS,
    PRICE: PRICE,
    polish: polish,
    badPricing: badPricing,
  };
});
