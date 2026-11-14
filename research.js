(function () {
  'use strict';

  var R = window.PlaigroundResearch;
  if (!R || !document.querySelector('[data-research-form]')) return;

  var email = '';
  var notes = [];
  var chain = Promise.resolve();
  var activeTab = 'presence';

  var form = document.querySelector('[data-research-form]');
  var input = document.querySelector('[data-research-q]');
  var statusEl = document.querySelector('[data-research-status]');
  var typeEl = document.querySelector('[data-research-type]');
  var linksEl = document.querySelector('[data-research-links]');
  var presenceEl = document.querySelector('[data-presence]');
  var creditsEl = document.querySelector('[data-credits]');
  var metersEl = document.querySelector('[data-meters]');
  var catalogEl = document.querySelector('[data-catalog]');
  var saveNote = document.querySelector('[data-save-note]');
  var addForm = document.querySelector('[data-add-form]');
  var pasteForm = document.querySelector('[data-paste-form]');

  function say(text, bad) {
    statusEl.textContent = text || '';
    statusEl.classList.toggle('is-bad', !!bad);
  }

  function enqueue(task) {
    chain = chain.then(task, task);
    return chain;
  }

  function post(body) {
    return fetch('/api/research', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body)
    }).then(function (response) {
      return response.json().catch(function () { return null; }).then(function (data) {
        if (!data || typeof data !== 'object') return R.failure(response.status === 404 ? 'unavailable' : R.classifyStatus(response.status), response.status);
        return data;
      });
    }).catch(function () {
      return R.failure('offline', 0);
    });
  }

  function publicLine(result) {
    var p = document.createElement('p');
    p.className = 'research-note';
    p.textContent = 'Public Wikidata data retrieved ' + ((result && result.checkedAt) || 'just now') + '. Not a PLAIGROUND sample catalog and not your private rights.';
    return p;
  }

  function externalLink(href, label, className) {
    var a = document.createElement('a');
    a.className = className == null ? 'research-link' : className;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    if (!R.isSafeHttpUrl(href)) return null;
    a.href = href;
    a.textContent = label;
    return a;
  }

  function renderManual(raw) {
    var pack = R.manualLinks(raw);
    typeEl.textContent = pack.typeThis || '';
    linksEl.textContent = '';
    pack.links.forEach(function (link) {
      var a = externalLink(link.href, link.label);
      if (!a) return;
      var small = document.createElement('small');
      small.textContent = link.limitation;
      a.appendChild(small);
      linksEl.appendChild(a);
    });
  }

  function showTab(name) {
    activeTab = name;
    document.querySelectorAll('[data-tab]').forEach(function (tab) {
      var on = tab.getAttribute('data-tab') === name;
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.tabIndex = on ? 0 : -1;
    });
    document.querySelectorAll('[data-panel]').forEach(function (panel) {
      panel.hidden = panel.getAttribute('data-panel') !== name;
    });
  }

  function fieldList(fields) {
    var dl = document.createElement('dl');
    dl.className = 'research-fields';
    (fields || []).forEach(function (item) {
      var wrap = document.createElement('div');
      var dt = document.createElement('dt');
      dt.textContent = item.label || '';
      var dd = document.createElement('dd');
      if (item.href && R.isSafeHttpUrl(item.href)) {
        var a = externalLink(item.href, item.value || item.href, '');
        if (a) dd.appendChild(a);
      } else {
        dd.textContent = item.value || '';
      }
      var meta = document.createElement('span');
      meta.className = 'research-meta';
      meta.textContent = [item.source, item.licence, item.checkedAt].filter(Boolean).join(' · ');
      dd.appendChild(meta);
      if (item.note) {
        var note = document.createElement('span');
        note.className = 'research-meta';
        note.textContent = item.note;
        dd.appendChild(note);
      }
      wrap.appendChild(dt);
      wrap.appendChild(dd);
      dl.appendChild(wrap);
    });
    return dl;
  }

  function conflictList(conflicts) {
    var box = document.createElement('div');
    (conflicts || []).forEach(function (item) {
      var p = document.createElement('p');
      p.className = 'research-conflict';
      p.textContent = (item.field ? item.field + ': ' : '') + (item.detail || '');
      box.appendChild(p);
    });
    return box;
  }

  function candidateButton(row, onPick) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'research-choice';
    button.textContent = row.label || row.id;
    var small = document.createElement('small');
    small.textContent = [row.description, row.id, 'Wikidata CC0', row.checkedAt].filter(Boolean).join(' · ');
    button.appendChild(small);
    button.addEventListener('click', function () { onPick(row); });
    return button;
  }

  function renderCandidates(result, host, onPick) {
    host.textContent = '';
    if (!result) return;
    if (result.ok === false) {
      var fail = document.createElement('p');
      fail.textContent = result.message || '';
      host.appendChild(fail);
      return;
    }
    if (result.noMatch) {
      var empty = document.createElement('p');
      empty.textContent = result.limitation || R.NO_MATCH;
      host.appendChild(publicLine(result));
      host.appendChild(empty);
      return;
    }
    host.appendChild(publicLine(result));
    if (result.ambiguous || result.needsConfirm) {
      var banner = document.createElement('p');
      banner.textContent = result.candidates.length > 1
        ? 'More than one Wikidata item came back. A shared name is not an identity. Choose the row you mean.'
        : 'One Wikidata item came back. Confirm it before treating it as this artist, recording, or work.';
      host.appendChild(banner);
    }
    host.appendChild(conflictList(result.conflicts));
    var list = document.createElement('div');
    list.className = 'research-list';
    (result.candidates || []).forEach(function (row) {
      list.appendChild(candidateButton(row, onPick));
    });
    host.appendChild(list);
  }

  function addButton(label, onClick) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-ghost btn-sm';
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
  }

  function remember(note) {
    if (!email) {
      say('Sign in to keep a private list on this browser.', true);
      return;
    }
    var clean = R.cleanNote(note);
    if (!clean.title) return;
    notes = notes.filter(function (item) { return item.id !== clean.id; }).concat(clean).slice(-80);
    var saved = R.saveNotes(window.localStorage, email, notes);
    if (!saved.ok) {
      say('The list could not be saved on this browser.', true);
      return;
    }
    notes = saved.items;
    renderCatalog();
    say('Saved on this browser only. Self-report and pending are your notes, not a registry status.');
    showTab('credits');
  }

  function renderEntity(result) {
    presenceEl.textContent = '';
    if (!result || result.ok === false) {
      renderCandidates(result, presenceEl, function () {});
      return;
    }
    if (!result.entity) {
      renderCandidates(result, presenceEl, loadEntity);
      return;
    }
    var head = document.createElement('h3');
    head.textContent = result.entity.label || 'Wikidata item';
    presenceEl.appendChild(head);
    presenceEl.appendChild(publicLine(result));
    var limit = document.createElement('p');
    limit.textContent = result.limitation || '';
    presenceEl.appendChild(limit);
    presenceEl.appendChild(conflictList(result.conflicts));
    presenceEl.appendChild(fieldList(result.entity.fields));
    var actions = document.createElement('div');
    actions.className = 'research-actions';
    actions.appendChild(addButton('Recordings found so far', function () { loadLinked('recordings', result.entity.id); }));
    actions.appendChild(addButton('Works found so far', function () { loadLinked('works', result.entity.id); }));
    actions.appendChild(addButton('Add this item to my list', function () {
      var pack = R.evidenceFromEntity(result.entity, result.checkedAt);
      var kind = pack.evidence.iswc && !pack.evidence.isrc ? 'composition' : 'recording';
      remember({
        id: 'wd' + result.entity.id,
        title: result.entity.label,
        kind: kind,
        role: pack.role,
        isrc: pack.evidence.isrc,
        iswc: pack.evidence.iswc,
        mbid: pack.evidence.mbid,
        wikidataId: result.entity.id,
        lookupNote: 'Public Wikidata identifiers only. They are not a released, registered, or agreement status.'
      });
    }));
    presenceEl.appendChild(actions);
    creditsEl.textContent = '';
    var creditNote = document.createElement('p');
    creditNote.textContent = 'These are public credits on Wikidata. They are not this artist\'s own rights record, not a registration, and not chain of title.';
    creditsEl.appendChild(creditNote);
    creditsEl.appendChild(fieldList((result.entity.fields || []).filter(function (item) {
      return /^(P50|P86|P123|P175|P264|P434|P435|P436|P1243|P1827|P1476)/.test(item.id);
    })));
  }

  function renderLinked(result) {
    creditsEl.textContent = '';
    if (!result || result.ok === false || result.noMatch) {
      var p = document.createElement('p');
      p.textContent = (result && (result.message || result.limitation)) || R.NO_MATCH;
      creditsEl.appendChild(p);
      showTab('credits');
      return;
    }
    var rows = result.recordings && result.recordings.length ? result.recordings : result.works;
    var heading = document.createElement('h3');
    heading.textContent = result.op === 'works' ? 'Composer or lyricist links found so far' : 'Recordings with an ISRC found so far';
    creditsEl.appendChild(heading);
    creditsEl.appendChild(publicLine(result));
    var limit = document.createElement('p');
    limit.textContent = 'This is the public Wikidata set for this query, capped at 12. A MusicBrainz ID here is an identifier Wikidata lists, not a MusicBrainz web service result. It is not a full discography and it is not chain of title.';
    creditsEl.appendChild(limit);
    creditsEl.appendChild(conflictList(result.conflicts));
    var list = document.createElement('div');
    list.className = 'research-list';
    rows.forEach(function (row) {
      var card = document.createElement('div');
      card.className = 'research-row';
      var title = document.createElement('strong');
      title.textContent = row.label || row.id;
      card.appendChild(title);
      var meta = document.createElement('span');
      meta.className = 'research-meta';
      var bits = [];
      if (row.isrcs && row.isrcs.length) bits.push('ISRC ' + row.isrcs.join(', '));
      if (row.iswcs && row.iswcs.length) bits.push('ISWC ' + row.iswcs.join(', '));
      if (row.mbids && row.mbids.length) bits.push('MusicBrainz ID listed on Wikidata ' + row.mbids[0]);
      bits.push('Wikidata ' + row.id);
      bits.push(row.checkedAt || '');
      meta.textContent = bits.filter(Boolean).join(' · ');
      card.appendChild(meta);
      if (row.href && R.isSafeHttpUrl(row.href)) {
        var a = externalLink(row.href, 'Open Wikidata item');
        if (a) card.appendChild(a);
      }
      card.appendChild(addButton('Add to my list', function () {
        var kind = result.op === 'works' ? 'composition' : 'recording';
        remember({
          id: 'wd' + row.id,
          title: row.label,
          kind: kind,
          role: 'unknown',
          isrc: row.isrcs && row.isrcs[0],
          iswc: row.iswcs && row.iswcs[0],
          mbid: row.mbids && row.mbids[0],
          wikidataId: row.id,
          lookupNote: 'Public Wikidata identifiers only. They are not a released, registered, or agreement status.'
        });
      }));
      list.appendChild(card);
    });
    creditsEl.appendChild(list);
    showTab('credits');
  }

  function loadEntity(row) {
    enqueue(function () {
      say('Loading the Wikidata item you chose.');
      return post({ op: 'entity', q: row.id }).then(function (result) {
        if (result.ok === false) say(result.message, true);
        else say('Loaded ' + ((result.entity && result.entity.label) || row.id) + '. Fields are what Wikidata returned.');
        renderEntity(result);
        if (statusEl.focus) statusEl.focus();
      });
    });
  }

  function loadLinked(op, qid) {
    enqueue(function () {
      say(op === 'works' ? 'Asking Wikidata for composer or lyricist links found so far.' : 'Asking Wikidata for recordings with an ISRC found so far.');
      return post({ op: op, q: qid }).then(function (result) {
        if (result.ok === false) say(result.message, true);
        else if (result.noMatch) say(result.limitation || R.NO_MATCH, false);
        else say('These are the rows Wikidata returned. The list is not complete.');
        renderLinked(result);
      });
    });
  }

  function lookupRaw(raw) {
    renderManual(raw);
    var seed = R.parseSeed(raw);
    if (!seed.ok) {
      say(seed.reason === 'rejected-url'
        ? 'That link is not a MusicBrainz, Spotify, Apple Music, or Deezer artist URL. It was not opened or fetched.'
        : 'Enter a name, a MusicBrainz artist ID, a store artist link, an ISRC, or an ISWC.', true);
      return;
    }
    enqueue(function () {
      var lead = 'Looking up ' + seed.label + ' on Wikidata.';
      if (seed.type === 'mbid') lead = 'Asking Wikidata whether an item lists MusicBrainz artist ID ' + seed.q + '. The MusicBrainz web service is not called.';
      if (seed.type === 'store') lead = 'Asking Wikidata whether an item lists this ' + seed.platform + ' artist ID. That store is not called.';
      if (seed.type === 'isrc') lead = 'Asking Wikidata whether an item lists ISRC ' + seed.q + '. This is not a registration check.';
      if (seed.type === 'iswc') lead = 'Asking Wikidata whether an item lists ISWC ' + seed.q + '. This is not a PRO or MLC filing.';
      say(lead);
      showTab('presence');
      return post({ q: raw }).then(function (result) {
        if (result.ok === false) {
          say(result.message, true);
          renderCandidates(result, presenceEl, loadEntity);
          return;
        }
        if (result.entity) {
          say('Wikidata returned one item for that ID. Read the description before you rely on it.');
          renderEntity(result);
          return;
        }
        if ((result.recordings && result.recordings.length) || (result.works && result.works.length)) {
          presenceEl.textContent = '';
          var codeNote = document.createElement('p');
          codeNote.textContent = result.ambiguous
            ? 'More than one Wikidata item lists this code. All of them are shown. None is chosen as the only match.'
            : 'Wikidata returned this code on the song and credits tab. A code match is not chain of title.';
          presenceEl.appendChild(codeNote);
          renderLinked(result);
          return;
        }
        if (result.noMatch) say(result.limitation || R.NO_MATCH, false);
        else say('Choose a row. The name alone is not the match.');
        renderCandidates(result, presenceEl, loadEntity);
      });
    });
  }

  function percent(count, total) {
    if (!total) return '0%';
    return Math.round((count / total) * 100) + '%';
  }

  function meterBlock(title, text, counts, note) {
    var section = document.createElement('section');
    var h = document.createElement('h3');
    h.textContent = title;
    section.appendChild(h);
    var p = document.createElement('p');
    p.textContent = counts.total ? text : 'No rows in this count yet.';
    section.appendChild(p);
    var bar = document.createElement('div');
    bar.className = 'research-meter';
    bar.setAttribute('role', 'img');
    bar.setAttribute('aria-label', title + '. ' + text);
    ['self-report', 'pending'].forEach(function (key) {
      if (!counts[key]) return;
      var span = document.createElement('span');
      span.className = key === 'self-report' ? 'is-self' : key === 'pending' ? 'is-pending' : 'is-documented';
      span.style.width = percent(counts[key], counts.total);
      bar.appendChild(span);
    });
    section.appendChild(bar);
    var aside = document.createElement('p');
    aside.className = 'research-note';
    aside.textContent = note;
    section.appendChild(aside);
    return section;
  }

  function countLine(counts) {
    return counts['self-report'] + ' self-reported on this browser, ' + counts.pending + ' marked pending on this browser, ' + counts.unknown + ' unknown';
  }

  function renderMeters() {
    var summary = R.meterSummary(notes);
    metersEl.textContent = '';
    metersEl.appendChild(meterBlock(
      'Released recordings',
      countLine(summary.released),
      summary.released,
      'Your note on this browser only. A Wikidata ISRC or MusicBrainz ID is not counted as released.'
    ));
    metersEl.appendChild(meterBlock(
      'Composition registration evidence',
      countLine(summary.registration),
      summary.registration,
      'Your note on this browser only. A miss is not unregistered, and an ISWC from Wikidata is not a PRO or MLC filing.'
    ));
    metersEl.appendChild(meterBlock(
      'Publishing agreement on file',
      countLine(summary.agreement),
      summary.agreement,
      'Your note on this browser only. The agreement is not uploaded, and this count is not a requirement or a clearance score.'
    ));
    if (summary.coversLeftOut) {
      var cover = document.createElement('p');
      cover.className = 'research-note';
      cover.textContent = summary.coversLeftOut + ' cover composition row' + (summary.coversLeftOut === 1 ? ' is' : 's are') + ' left out of the composition meters. A cover can still count as your recording.';
      metersEl.appendChild(cover);
    }
  }

  function stateButtons(item, key) {
    var wrap = document.createElement('div');
    wrap.className = 'research-inline';
    ['unknown', 'self-report', 'pending'].forEach(function (state) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-ghost btn-sm';
      button.textContent = state === 'self-report' ? 'Self-report' : state === 'pending' ? 'Pending' : 'Unknown';
      button.setAttribute('aria-pressed', item[key] && item[key].state === state ? 'true' : 'false');
      button.addEventListener('click', function () {
        item[key] = { state: state };
        remember(item);
      });
      wrap.appendChild(button);
    });
    return wrap;
  }

  function renderCatalog() {
    renderMeters();
    catalogEl.textContent = '';
    saveNote.textContent = email
      ? 'Saved on this browser for your signed-in account only. Another account on this browser cannot read it. It is not sent to the lookup, and it is not a server record.'
      : 'Sign in to keep this list on this browser for your account. Lookups still work without an account. The list is not uploaded.';
    if (!notes.length) {
      var empty = document.createElement('p');
      empty.textContent = 'No private catalog rows yet.';
      catalogEl.appendChild(empty);
      return;
    }
    notes.forEach(function (item) {
      var card = document.createElement('article');
      card.className = 'research-row';
      var title = document.createElement('h3');
      title.textContent = item.title;
      card.appendChild(title);
      var meta = document.createElement('p');
      meta.className = 'research-meta';
      meta.textContent = [item.kind, item.role].filter(Boolean).join(' · ');
      card.appendChild(meta);
      if (item.isrc || item.iswc || item.mbid || item.wikidataId) {
        var ident = document.createElement('p');
        ident.textContent = 'Public identifier, not a status: ' + [item.isrc && ('ISRC ' + item.isrc), item.iswc && ('ISWC ' + item.iswc), item.mbid && ('MusicBrainz ID ' + item.mbid), item.wikidataId].filter(Boolean).join(', ') + '. Typed by you or copied from Wikidata. It does not count as released, registered, or an agreement.';
        card.appendChild(ident);
      }
      if (item.lookupNote) {
        var looked = document.createElement('p');
        looked.textContent = item.lookupNote;
        card.appendChild(looked);
      }
      if (item.kind === 'recording') {
        var released = document.createElement('p');
        released.textContent = 'Released: ' + item.released.state + (item.released.source ? ' (' + item.released.source + ')' : '');
        card.appendChild(released);
        card.appendChild(stateButtons(item, 'released'));
      } else {
        var registration = document.createElement('p');
        registration.textContent = 'Registration evidence: ' + item.registration.state + (item.registration.source ? ' (' + item.registration.source + ')' : '');
        card.appendChild(registration);
        card.appendChild(stateButtons(item, 'registration'));
        var agreement = document.createElement('p');
        agreement.textContent = 'Publishing agreement: ' + item.agreement.state + (item.agreement.source ? ' (' + item.agreement.source + ')' : '');
        card.appendChild(agreement);
        card.appendChild(stateButtons(item, 'agreement'));
      }
      var actions = document.createElement('div');
      actions.className = 'research-inline';
      if (item.isrc) {
        actions.appendChild(addButton('Look up this ISRC', function () {
          input.value = item.isrc;
          lookupRaw(item.isrc);
        }));
      }
      if (item.iswc) {
        actions.appendChild(addButton('Look up this ISWC', function () {
          input.value = item.iswc;
          lookupRaw(item.iswc);
        }));
      }
      actions.appendChild(addButton('Remove', function () {
        notes = notes.filter(function (row) { return row.id !== item.id; });
        if (email) R.saveNotes(window.localStorage, email, notes);
        renderCatalog();
      }));
      card.appendChild(actions);
      catalogEl.appendChild(card);
    });
  }

  function makeId() {
    return 'n' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
  }

  var personForm = document.querySelector('[data-person-form]');
  var personResults = document.querySelector('[data-person-results]');

  function personLink(href, label) {
    var a = externalLink(href, label);
    return a;
  }

  function appendMeta(parent, text) {
    if (!text) return;
    var meta = document.createElement('span');
    meta.className = 'research-meta';
    meta.textContent = text;
    parent.appendChild(meta);
  }

  function renderLinkList(links) {
    var box = document.createElement('div');
    box.className = 'research-list';
    (links || []).forEach(function (link) {
      var a = personLink(link.href, link.label || link.href);
      if (!a) return;
      if (link.limitation) {
        var small = document.createElement('small');
        small.textContent = link.limitation;
        a.appendChild(small);
      }
      if (link.source) appendMeta(a, [link.source, link.type].filter(Boolean).join(' · '));
      box.appendChild(a);
    });
    return box;
  }

  function sectionTitle(text) {
    var h = document.createElement('h3');
    h.textContent = text;
    return h;
  }

  function renderPersonCard(candidate) {
    var card = document.createElement('article');
    card.className = 'research-row research-card';
    card.setAttribute('data-person-id', candidate.id || '');
    var title = document.createElement('h3');
    title.textContent = candidate.name || 'Unnamed record';
    card.appendChild(title);
    var badge = document.createElement('p');
    badge.className = 'research-confidence is-' + (candidate.confidence || 'weak');
    badge.textContent = candidate.confidenceLabel || 'Weak match';
    card.appendChild(badge);
    var why = document.createElement('p');
    why.textContent = candidate.confidenceReason || '';
    card.appendChild(why);
    appendMeta(card, [candidate.kind, candidate.disambiguation, candidate.sortName].filter(Boolean).join(' · '));
    if (candidate.ipis && candidate.ipis.length) {
      var ipi = document.createElement('p');
      ipi.textContent = 'IPI ' + candidate.ipis.join(', ');
      card.appendChild(ipi);
    }
    card.appendChild(sectionTitle('Aliases and profiles'));
    var aliasHost = document.createElement('div');
    aliasHost.setAttribute('data-person-aliases', '');
    card.appendChild(aliasHost);
    card.appendChild(sectionTitle('Credits'));
    var creditHost = document.createElement('div');
    creditHost.setAttribute('data-person-credits', '');
    creditHost.textContent = 'Loading the public credit sample.';
    card.appendChild(creditHost);
    card.appendChild(sectionTitle('Links a source published'));
    var linkHost = document.createElement('div');
    linkHost.setAttribute('data-person-links', '');
    card.appendChild(linkHost);
    card.appendChild(sectionTitle('Registries'));
    card.appendChild(renderLinkList(candidate.registries));
    fillAliases(aliasHost, candidate);
    fillLinks(linkHost, candidate);
    return card;
  }

  function fillAliases(host, candidate) {
    host.textContent = '';
    var aliases = candidate.aliases || [];
    var profiles = candidate.profiles || [];
    if (!aliases.length && !profiles.length) {
      var empty = document.createElement('p');
      empty.textContent = 'No alias or profile was listed by the sources that answered.';
      host.appendChild(empty);
      return;
    }
    var list = document.createElement('div');
    list.className = 'research-list';
    aliases.forEach(function (alias) {
      var row = document.createElement('div');
      row.className = 'research-row';
      var strong = document.createElement('strong');
      strong.textContent = alias.name || '';
      row.appendChild(strong);
      appendMeta(row, [alias.type, alias.source].filter(Boolean).join(' · '));
      if (alias.href) {
        var a = personLink(alias.href, 'Open source');
        if (a) row.appendChild(a);
      }
      list.appendChild(row);
    });
    host.appendChild(list);
    if (profiles.length) host.appendChild(renderLinkList(profiles));
  }

  function fillLinks(host, candidate) {
    host.textContent = '';
    if (!(candidate.links || []).length) {
      var empty = document.createElement('p');
      empty.textContent = 'No official or social link was published by these sources. None was guessed.';
      host.appendChild(empty);
      return;
    }
    host.appendChild(renderLinkList(candidate.links));
  }

  function fillCredits(host, result) {
    host.textContent = '';
    var note = document.createElement('p');
    note.textContent = (result && result.note) || 'No public credit was returned for this person. That is not proof there are no credits.';
    host.appendChild(note);
    var credits = (result && result.credits) || [];
    if (!credits.length) return;
    var list = document.createElement('div');
    list.className = 'research-list';
    credits.forEach(function (credit) {
      var row = document.createElement('div');
      row.className = 'research-row';
      var strong = document.createElement('strong');
      strong.textContent = credit.title || '';
      row.appendChild(strong);
      appendMeta(row, [credit.role, credit.source].filter(Boolean).join(' · '));
      if (credit.href) {
        var a = personLink(credit.href, 'Open source');
        if (a) row.appendChild(a);
      }
      list.appendChild(row);
    });
    host.appendChild(list);
  }

  function cardById(id) {
    if (!id || !personResults) return null;
    return personResults.querySelector('[data-person-id="' + id.replace(/"/g, '') + '"]');
  }

  function applyProfile(card, result) {
    if (!card || !result) return;
    if ((result.aliases && result.aliases.length) || (result.profiles && result.profiles.length)) {
      fillAliases(card.querySelector('[data-person-aliases]'), result);
    }
    if (result.links && result.links.length) fillLinks(card.querySelector('[data-person-links]'), result);
  }

  function waitPace() {
    return new Promise(function (resolve) { setTimeout(resolve, 1300); });
  }

  function postPerson(body) {
    return post(body).then(function (result) {
      if (result && result.status === 'rate-limit') return waitPace().then(function () { return post(body); });
      return result;
    });
  }

  function loadPersonDetails(candidate) {
    var body = { mbid: candidate.mbid || '', qid: candidate.qid || '', discogsId: candidate.discogsId || '' };
    if (!body.mbid && !body.qid && !body.discogsId) {
      var card = cardById(candidate.id);
      var credits = card && card.querySelector('[data-person-credits]');
      if (credits) credits.textContent = 'No MusicBrainz, Wikidata, or Discogs id was on this row, so credits were not requested.';
      return;
    }
    enqueue(function () {
      return waitPace().then(function () {
        return postPerson(Object.assign({ op: 'person-profile' }, body)).then(function (result) {
          var card = cardById(candidate.id);
          if (result && result.ok !== false) applyProfile(card, result);
        });
      });
    });
    enqueue(function () {
      if (!body.mbid && !body.qid) {
        var card = cardById(candidate.id);
        var credits = card && card.querySelector('[data-person-credits]');
        if (credits) credits.textContent = 'Discogs lists names, not the writer and producer credits. Those credits were not requested from Discogs.';
        return Promise.resolve();
      }
      return waitPace().then(function () { return postPerson(Object.assign({ op: 'person-credits' }, body)); }).then(function (result) {
        var card = cardById(candidate.id);
        var host = card && card.querySelector('[data-person-credits]');
        if (!host) return;
        if (!result || result.ok === false) {
          host.textContent = (result && result.message) || 'The credit sample did not load.';
          return;
        }
        fillCredits(host, result);
      });
    });
  }

  function renderPerson(result) {
    personResults.textContent = '';
    if (!result) return;
    var note = document.createElement('p');
    note.textContent = (result.disclaimer || '') + ' ' + (result.limitation || '');
    personResults.appendChild(note);
    var sources = document.createElement('ul');
    (result.sources || []).forEach(function (source) {
      var item = document.createElement('li');
      item.className = 'research-source';
      item.textContent = source.id + ': ' + source.status + '. ' + (source.note || '');
      sources.appendChild(item);
    });
    personResults.appendChild(sources);
    if (result.ok === false) {
      var fail = document.createElement('p');
      fail.textContent = result.message || '';
      personResults.appendChild(fail);
      return;
    }
    if (result.noMatch) {
      var empty = document.createElement('p');
      empty.textContent = 'No person record came back. The registry links below use the name you typed. A miss is not proof of no rights.';
      personResults.appendChild(empty);
      personResults.appendChild(renderLinkList(result.registries));
      return;
    }
    var list = document.createElement('div');
    list.className = 'research-person';
    (result.candidates || []).forEach(function (candidate) {
      list.appendChild(renderPersonCard(candidate));
    });
    personResults.appendChild(list);
    (result.candidates || []).slice(0, 3).forEach(loadPersonDetails);
  }

  if (personForm) {
    personForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var first = personForm.querySelector('[data-person-first]').value;
      var last = personForm.querySelector('[data-person-last]').value;
      var ipi = personForm.querySelector('[data-person-ipi]').value;
      var artist = personForm.querySelector('[data-person-artist]').value;
      if (!R.trim(first) || !R.trim(last)) {
        say('Enter a first and last name.', true);
        return;
      }
      showTab('person');
      say('Searching public sources for ' + R.trim(first) + ' ' + R.trim(last) + '. Same names stay separate.');
      enqueue(function () {
        return post({ op: 'person', first: first, last: last, ipi: ipi, artist: artist }).then(function (result) {
          if (!result || result.ok === false) say((result && result.message) || 'The person search did not complete.', true);
          else if (result.noMatch) say(result.limitation || 'No person record came back.', false);
          else say(result.candidates.length + ' public record' + (result.candidates.length === 1 ? '' : 's') + '. Confirm the one you mean.');
          renderPerson(result || { ok: false, message: 'The person search did not complete.' });
        });
      });
    });
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    lookupRaw(input.value);
  });

  addForm.addEventListener('submit', function (event) {
    event.preventDefault();
    var title = addForm.querySelector('[data-add-title]').value;
    if (!R.trim(title)) {
      say('Add a title first.', true);
      return;
    }
    remember({
      id: makeId(),
      title: title,
      kind: addForm.querySelector('[data-add-kind]').value,
      role: addForm.querySelector('[data-add-role]').value,
      isrc: addForm.querySelector('[data-add-isrc]').value,
      iswc: addForm.querySelector('[data-add-iswc]').value
    });
    addForm.reset();
  });

  pasteForm.addEventListener('submit', function (event) {
    event.preventDefault();
    var parsed = R.parseCatalogPaste(pasteForm.querySelector('[data-add-paste]').value);
    if (!parsed.ok) {
      say(parsed.reason, true);
      return;
    }
    if (!parsed.items.length) {
      say('No titles were found in that paste.', true);
      return;
    }
    if (!email) {
      say('Sign in to keep imported titles on this browser.', true);
      return;
    }
    parsed.items.forEach(function (item) {
      item.id = makeId() + item.id.slice(0, 8);
      notes.push(item);
    });
    var saved = R.saveNotes(window.localStorage, email, notes);
    notes = saved.ok ? saved.items : notes;
    renderCatalog();
    pasteForm.reset();
    say(parsed.items.length + ' title' + (parsed.items.length === 1 ? '' : 's') + ' added as unknown, not as registered.');
  });

  document.querySelectorAll('[data-tab]').forEach(function (tab) {
    tab.addEventListener('click', function () { showTab(tab.getAttribute('data-tab')); });
    tab.addEventListener('keydown', function (event) {
      var tabs = Array.prototype.slice.call(document.querySelectorAll('[data-tab]'));
      var index = tabs.indexOf(tab);
      var next = null;
      if (event.key === 'ArrowRight') next = tabs[index + 1] || tabs[0];
      else if (event.key === 'ArrowLeft') next = tabs[index - 1] || tabs[tabs.length - 1];
      else if (event.key === 'Home') next = tabs[0];
      else if (event.key === 'End') next = tabs[tabs.length - 1];
      if (!next) return;
      event.preventDefault();
      showTab(next.getAttribute('data-tab'));
      next.focus();
    });
  });

  renderManual('');
  renderCatalog();
  showTab(activeTab);

  fetch('/api/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
    .then(function (response) { return response.ok ? response.json() : null; })
    .then(function (data) {
      email = data && data.email && !data.pending ? data.email : '';
      notes = email ? R.loadNotes(window.localStorage, email) : [];
      renderCatalog();
    })
    .catch(function () {
      email = '';
      notes = [];
      renderCatalog();
    });
})();
