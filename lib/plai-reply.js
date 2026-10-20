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
    'Joining is free. Song Helper is a free co-writer. Releasing is $2.49 a month or $24.99 a year for unlimited songs, and it is optional. Artists keep 100% of their recording royalties. Publishing is optional, under a separate agreement.',
    'When someone asks how to release a song, describe only these steps, in this order, one step on each line. Do not add any other step. 1. Join free. 2. Bring a song you already have, or write one. 3. Attest the rights. 4. Sign the split sheet. 5. Review. 6. Deliver. Releasing is $2.49 a month or $24.99 a year for unlimited songs, and it is optional.',
    'Do not mention a release date, metadata, artwork, or store submission as a step. Those steps do not exist.',
    'Do not say there is no free Basic plan, and do not say no plan covers a song for life. Those are guardrails, not talking points. Only when someone asks about a free plan, say there is no free release plan, and say it once.',
    'When someone asks if there is a free plan, start with what is free: joining, and Song Helper as a free co-writer. Then say releasing is $2.49 a month or $24.99 a year for unlimited songs, and optional. Some Song Helper buttons use 1 credit, so do not call every button free.',
    'Sound like a person. Use short natural sentences and normal commas. Put any intro in a normal sentence, never as list item 1. Number only the real steps, one per line, starting at 1. End with one friendly question or a short tip.',
    'Do not copy a fixed script. Do not end on the word Plai by itself.',
    'Never name Suno, ToneGrid, or YouTube. Do not give a count of stores.',
    'Do not use an em dash or an en dash. Keep commas, periods, and question marks. Finish the last sentence. Never stop in the middle of a word.',
  ].join(' ');

  var PRICE = 'Joining is free. Releasing is $2.49 a month or $24.99 a year for unlimited songs, and it is optional. Artists keep 100%.';
  var FREE_LEAD = 'Joining is free, and Song Helper is a free co-writer.';
  var RELEASE_STEPS = [
    'Join free.',
    'Bring a song you already have, or write one.',
    'Attest the rights.',
    'Sign the split sheet.',
    'Review.',
    'Deliver. Releasing is $2.49 a month or $24.99 a year for unlimited songs, and it is optional.',
  ];
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
      .replace(/\bevery bit of (?:their |your )?royalties\b/gi, '100% of their royalties')
      .replace(/\b2\.49\s+dollars\b/gi, '$2.49')
      .replace(/(^|[^$\d])2\.49\b/g, '$1$2.49')
      .replace(/\$2\.49\b(?!\s+a month)/g, '$2.49 a month');
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

  function asksMoney(ask) {
    return /cost|price|free|plan|how much|\$/i.test(String(ask || ''));
  }

  function asksFreePlan(ask) {
    return /free plan/i.test(String(ask || ''));
  }

  function asksRelease(ask) {
    return /how (?:do i|to) release|release my (?:first )?song|first release/i.test(String(ask || ''));
  }

  function looksLikeStep(rest) {
    return /^(?:join|sign up|bring|write|upload|attest|sign the|review|deliver|pick|add|fill|choose|preview)\b/i.test(String(rest || '').trim());
  }

  function invented(part) {
    return /release date|metadata|artwork|fill in the (?:details|title)|hit submit|store submission/i.test(String(part || ''));
  }

  function denial(part) {
    return /no free basic plan|no plan covers a song for life|no plan that covers a song|covers a song for life|no basic plan|no free release plan|there is no free plan|there'?s no free plan/i.test(String(part || ''));
  }

  function stripNegatives(text, ask) {
    var allow = asksFreePlan(ask) || (!String(ask || '').trim() && /no free release plan/i.test(String(text || '')));
    var kept = false;
    return filterSentences(text, function (part) {
      if (!denial(part)) return false;
      if (allow && /no free release plan/i.test(part) && !kept) {
        kept = true;
        return false;
      }
      return true;
    });
  }

  function pricing(text, ask) {
    var body = String(text || '').trim();
    var question = String(ask || '');
    if (badPricing(body)) body = filterSentences(body, badPricing);
    body = stripNegatives(body, question);
    if (!asksMoney(question) || asksFreePlan(question) || asksRelease(question)) return body.trim();
    if (!/\$?\s*2\.49/.test(body)) body = placeFact(body, PRICE);
    if (!/100%/.test(body)) body = placeFact(body, 'Artists keep 100%.');
    if (/\$2\.49/.test(body) && !/optional|if you choose/i.test(body)) {
      body = placeFact(body, 'That release is optional.');
    }
    return body.trim();
  }

  function trailingQuestion(text) {
    var match = String(text || '').match(/([^\n.!?]*\?)\s*$/);
    var question = match ? match[1].trim() : '';
    if (!question || denial(question) || invented(question)) return '';
    return question;
  }

  function releaseIntro(text) {
    var lines = String(text || '').split('\n');
    var i;
    var s;
    for (i = 0; i < lines.length; i++) {
      var raw = lines[i].trim();
      if (!raw) continue;
      var plain = raw.replace(/^\d+\.\s+/, '');
      if (/^\d+\.\s+/.test(raw) && looksLikeStep(plain)) break;
      var sentences = plain.split(/(?<=[.!?])\s+/);
      for (s = 0; s < sentences.length; s++) {
        var part = sentences[s].trim().replace(/^\d+\.\s+/, '');
        if (!part || /\?\s*$/.test(part)) continue;
        if (denial(part) || invented(part) || badPricing(part)) continue;
        if (looksLikeStep(part)) continue;
        if (!/[.!?]$/.test(part)) part += '.';
        return part;
      }
    }
    return 'Here is how a release works.';
  }

  function releaseAnswer(text) {
    var intro = releaseIntro(text);
    var steps = RELEASE_STEPS.map(function (step, index) {
      return (index + 1) + '. ' + step;
    }).join('\n');
    var question = trailingQuestion(text);
    return question ? intro + '\n' + steps + '\n' + question : intro + '\n' + steps;
  }

  function leadFree(text) {
    var lines = [
      FREE_LEAD,
      'Releasing is $2.49 a month or $24.99 a year for unlimited songs, and it is optional.',
      'Artists keep 100%.',
      "There's no free release plan.",
    ];
    var question = trailingQuestion(text);
    if (question) lines.push(question);
    return lines.join('\n');
  }

  function fixDoubleOnes(text) {
    var normalized = String(text || '').replace(/([.!?])\s+(?=\d+\.\s+)/g, '$1\n');
    var lines = normalized.split('\n').map(function (line) { return line.trim(); }).filter(Boolean);
    var changed = false;
    if (lines.length && /^1\.\s+/.test(lines[0]) && !looksLikeStep(lines[0].replace(/^1\.\s+/, ''))) {
      lines[0] = lines[0].replace(/^1\.\s+/, '');
      changed = true;
    }
    var ones = [];
    lines.forEach(function (line, index) {
      if (/^1\.\s+/.test(line)) ones.push(index);
    });
    if (ones.length >= 2) {
      lines[ones[0]] = lines[ones[0]].replace(/^1\.\s+/, '');
      changed = true;
    }
    if (!changed) return lines.join('\n');
    var count = 0;
    return lines.map(function (line) {
      if (!/^\d+\.\s+/.test(line)) return line;
      var rest = line.replace(/^\d+\.\s+/, '');
      if (!looksLikeStep(rest)) return rest;
      count += 1;
      return count + '. ' + rest;
    }).join('\n');
  }

  function placeFact(body, sentence) {
    var text = String(body || '').trim();
    if (!text) return sentence;
    if (/\?\s*$/.test(text)) {
      return text.replace(/([^\n.!?]*\?)\s*$/, sentence + '\n$1').trim();
    }
    return text + ' ' + sentence;
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
    var ask = options.ask;
    var body = commas(strayName(money(brandName(dashes(text)))));
    body = dropNamed(body);
    if (badPricing(body)) body = filterSentences(body, badPricing);
    body = stripNegatives(body, ask);
    if (options.truncated) body = complete(body);
    if (asksFreePlan(ask)) body = leadFree(body);
    else if (asksRelease(ask)) body = releaseAnswer(body);
    else body = pricing(fixDoubleOnes(body), ask);
    return tidy(body);
  }

  return {
    FACTS: FACTS,
    PRICE: PRICE,
    polish: polish,
    badPricing: badPricing,
  };
});
