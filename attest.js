(function (root) {
  var DRAFT_KEY = 'plaiground.store.draft';
  var SHEET_KEY = 'plaiground.tonegrid.draft';
  var HUMAN_SAVED_KEY = 'plaiground.attest.human_saved';

  function readDraft() {
    try {
      var local = root.localStorage && (root.localStorage.getItem(DRAFT_KEY) || root.localStorage.getItem(SHEET_KEY));
      var session = root.sessionStorage && (root.sessionStorage.getItem(DRAFT_KEY) || root.sessionStorage.getItem(SHEET_KEY));
      return JSON.parse(local || session || '{}') || {};
    } catch (err) {
      return {};
    }
  }

  function writeDraft(patch) {
    var next = readDraft();
    Object.keys(patch || {}).forEach(function (key) {
      if (patch[key] !== undefined) next[key] = patch[key];
    });
    var text = JSON.stringify(next);
    try { root.localStorage.setItem(DRAFT_KEY, text); } catch (err) {}
    try { root.sessionStorage.setItem(DRAFT_KEY, text); } catch (err) {}
    try { root.localStorage.setItem(SHEET_KEY, text); } catch (err) {}
    try { root.sessionStorage.setItem(SHEET_KEY, text); } catch (err) {}
    return next;
  }

  function bindAttestPage(doc) {
    var document = doc || root.document;
    if (!document) return null;
    var choices = document.querySelectorAll('[data-made-how]');
    var tags = document.querySelectorAll('.tag, [data-human-tag]');
    var countEl = document.querySelector('[data-human-count]');
    var humanSection = document.querySelector('[data-human-section]');
    var human = document.getElementById('attest-human');
    var rights = document.getElementById('attest-rights');
    var solo = document.getElementById('attest-solo');
    var soloCard = document.getElementById('solo-card');
    var soloWriter = document.querySelector('[data-solo-writer]');
    var otherToggle = document.querySelector('[data-other-writers]');
    var otherCountWrap = document.querySelector('[data-other-writers-count]');
    var otherCount = document.getElementById('attest-other-count');
    var writerFirst = document.getElementById('attest-writer-first');
    var writerLast = document.getElementById('attest-writer-last');
    var performer = document.getElementById('attest-performer');
    var writerCredit = document.getElementById('attest-writer-credit');
    var producer = document.getElementById('attest-producer');
    var didLyrics = document.getElementById('attest-did-lyrics');
    var didBeat = document.getElementById('attest-did-beat');
    var directed = document.getElementById('attest-directed');
    var directedWrap = document.querySelector('[data-directed-claim]');
    var status = document.getElementById('attest-status');
    var trigger = document.querySelector('[data-attest-continue]');
    if (!trigger) return null;
    if (root.PlaigroundReleaseCredits && typeof root.PlaigroundReleaseCredits.installUploadGate === 'function') {
      root.PlaigroundReleaseCredits.installUploadGate(root);
    }

    function selectedHow() {
      var on = document.querySelector('[data-made-how].on');
      return on ? on.getAttribute('data-made-how') : '';
    }

    function selectedElements() {
      return Array.prototype.map.call(tags, function (tag) {
        return tag.classList.contains('on') ? String(tag.textContent || '').trim() : '';
      }).filter(Boolean);
    }

    function featuredName() {
      var draft = readDraft();
      return String((draft && draft.featured) || '').trim();
    }

    function otherWritersOn() {
      if (featuredName()) return true;
      var on = otherToggle && otherToggle.querySelector ? otherToggle.querySelector('[data-other-writers].on') : null;
      if (on) return on.getAttribute('data-other-writers') === 'true';
      return Boolean(solo && !solo.checked);
    }

    function legalFromDraft(draft) {
      draft = draft || readDraft();
      var remembered = root.PlaigroundReleaseCredits && root.PlaigroundReleaseCredits.rememberedLegal
        ? root.PlaigroundReleaseCredits.rememberedLegal(root)
        : { first: '', last: '' };
      return {
        first: String((writerFirst && writerFirst.value) || draft.legal_first || remembered.first || '').trim(),
        last: String((writerLast && writerLast.value) || draft.legal_last || remembered.last || '').trim(),
      };
    }

    function collect() {
      var featured = featuredName();
      var others = otherWritersOn();
      var draft = readDraft();
      var legal = legalFromDraft(draft);
      var lyricsOn = Boolean(didLyrics && didLyrics.checked) || selectedElements().indexOf('Original lyrics') !== -1;
      var beatOn = Boolean(didBeat && didBeat.checked);
      var directedOn = Boolean(directed && directed.checked);
      var fields = {
        made_how: selectedHow(),
        human_elements: selectedElements(),
        human_contribution: human ? String(human.value || '').trim() : '',
        rights_confirmed: Boolean(rights && rights.checked),
        featured: featured,
        solo_owned_100: !featured && !others,
        other_writers: others,
        other_writer_count: others ? Number(otherCount && otherCount.value) || 0 : 0,
        legal_first: legal.first,
        legal_last: legal.last,
        name: String((draft && (draft.name || draft.artist)) || '').trim(),
        did_lyrics: lyricsOn,
        did_beat: beatOn,
        directed: directedOn,
        credits: {
          performer: performer ? String(performer.value || '').trim() : '',
          writer: writerCredit ? String(writerCredit.value || '').trim() : '',
          producer: producer ? String(producer.value || '').trim() : '',
        },
      };
      if (root.PlaigroundReleaseCredits && root.PlaigroundReleaseCredits.seedWriters) {
        fields.writers = root.PlaigroundReleaseCredits.seedWriters(fields);
      }
      return fields;
    }

    function nextHref(fields) {
      return fields && fields.solo_owned_100 ? 'review.html' : 'split-sheet.html';
    }

    function setHiddenEl(el, hidden) {
      if (!el) return;
      el.hidden = Boolean(hidden);
      if (el.classList && el.classList.toggle) el.classList.toggle('is-hidden', Boolean(hidden));
    }

    function setOtherWriters(on) {
      if (otherToggle && otherToggle.querySelectorAll) {
        Array.prototype.forEach.call(otherToggle.querySelectorAll('[data-other-writers]'), function (el) {
          var yes = el.getAttribute('data-other-writers') === 'true';
          if (el.classList && el.classList.toggle) el.classList.toggle('on', on ? yes : !yes);
        });
      }
      if (solo) solo.checked = !on && !featuredName();
    }

    function syncCreditsPrefill() {
      var draft = readDraft();
      var stage = String((draft && (draft.name || draft.artist)) || '').trim();
      var legal = legalFromDraft(draft);
      var how = selectedHow();
      var lyricsOn = Boolean(didLyrics && didLyrics.checked) || selectedElements().indexOf('Original lyrics') !== -1;
      var beatOn = Boolean(didBeat && didBeat.checked);
      var directedOn = Boolean(directed && directed.checked);
      if (performer && !performer.value && stage) performer.value = stage;
      if (performer && /^ai$/i.test(String(performer.value || '').trim())) performer.value = stage;
      if (writerCredit && lyricsOn && how !== 'fully_ai' && legal.first && legal.last && !writerCredit.value) {
        writerCredit.value = [legal.first, legal.last].join(' ');
      }
      if (writerCredit && how === 'fully_ai' && !lyricsOn && writerCredit.dataset && writerCredit.dataset.autofilled === '1') {
        writerCredit.value = '';
      }
      if (producer && (beatOn || (how === 'fully_ai' && directedOn)) && !producer.value) {
        producer.value = stage || [legal.first, legal.last].join(' ');
      }
    }

    function syncSolo() {
      var featured = featuredName();
      var others = otherWritersOn();
      if (featured) setOtherWriters(true);
      if (solo && featured) solo.checked = false;
      if (solo && !featured) solo.checked = !others;
      setHiddenEl(soloWriter, others || featured);
      setHiddenEl(otherCountWrap, !others);
      setHiddenEl(directedWrap, selectedHow() !== 'fully_ai');
      if (soloCard && featured) {
        /* keep the card visible so they can still set other-writer count */
      }
      syncCreditsPrefill();
      if (!trigger) return;
      if (!featured && !others) {
        trigger.setAttribute('href', 'review.html');
        if ('textContent' in trigger) trigger.textContent = 'Continue to review';
      } else {
        trigger.setAttribute('href', 'split-sheet.html');
        if ('textContent' in trigger) trigger.textContent = 'Continue to the split sheet';
      }
    }

    function pageError(fields) {
      if (root.PlaigroundUploadRequired && root.PlaigroundUploadRequired.validateAttestPage) {
        var checked = root.PlaigroundUploadRequired.validateAttestPage(fields);
        return checked && checked.error ? checked.error : '';
      }
      if (!fields.made_how) return 'How the song was made is required.';
      if (fields.made_how === 'ai_assisted') {
        if (!fields.human_elements.length && !fields.human_contribution) {
          return 'Human element is required.';
        }
      }
      if (!fields.rights_confirmed) return 'Rights confirmation is required.';
      return '';
    }

    function setStatus(text) {
      if (!status) return;
      status.textContent = text || '';
      status.hidden = !text;
    }

    function humanSavedThisSession() {
      try {
        return Boolean(root.sessionStorage && root.sessionStorage.getItem(HUMAN_SAVED_KEY));
      } catch (err) {
        return false;
      }
    }

    function markHumanSaved() {
      try {
        if (root.sessionStorage) root.sessionStorage.setItem(HUMAN_SAVED_KEY, '1');
      } catch (err) {}
    }

    function applyHumanElements(items) {
      var wanted = Object.create(null);
      (Array.isArray(items) ? items : []).forEach(function (item) {
        var label = String(item || '').trim();
        if (label) wanted[label] = true;
      });
      Array.prototype.forEach.call(tags, function (tag) {
        tag.classList.toggle('on', Boolean(wanted[String(tag.textContent || '').trim()]));
      });
    }

    function savedHumanElements(draft) {
      draft = draft || {};
      if (!Array.isArray(draft.human_elements) || !draft.human_elements.length) return [];
      if (!humanSavedThisSession()) return [];
      return draft.human_elements;
    }

    function applyDraft(draft) {
      draft = draft || {};
      if (draft.made_how) {
        Array.prototype.forEach.call(choices, function (el) {
          el.classList.toggle('on', el.getAttribute('data-made-how') === draft.made_how);
        });
      }
      applyHumanElements(savedHumanElements(draft));
      if (human && draft.human_contribution != null) human.value = String(draft.human_contribution);
      if (rights && draft.rights_confirmed != null) {
        rights.checked = draft.rights_confirmed === true || draft.rights_confirmed === 'true';
      }
      if (solo && !featuredName()) {
        var others = draft.other_writers === true || draft.other_writers === 'true';
        var soloOn = draft.solo_owned_100 === true || draft.solo_owned_100 === 'true' || !others;
        solo.checked = soloOn;
        setOtherWriters(!soloOn);
      }
      if (otherCount && draft.other_writer_count) otherCount.value = String(draft.other_writer_count);
      if (writerFirst && !writerFirst.value) writerFirst.value = String(draft.legal_first || '').trim();
      if (writerLast && !writerLast.value) writerLast.value = String(draft.legal_last || '').trim();
      if (performer && draft.credits && draft.credits.performer) performer.value = draft.credits.performer;
      if (writerCredit && draft.credits && draft.credits.writer) writerCredit.value = draft.credits.writer;
      if (producer && draft.credits && draft.credits.producer) producer.value = draft.credits.producer;
      if (didLyrics && draft.did_lyrics != null) didLyrics.checked = draft.did_lyrics === true || draft.did_lyrics === 'true';
      if (didBeat && draft.did_beat != null) didBeat.checked = draft.did_beat === true || draft.did_beat === 'true';
      if (directed && draft.directed != null) directed.checked = draft.directed === true || draft.directed === 'true';
      if (!writerFirst || !writerFirst.value || !writerLast || !writerLast.value) {
        var remembered = root.PlaigroundReleaseCredits && root.PlaigroundReleaseCredits.rememberedLegal
          ? root.PlaigroundReleaseCredits.rememberedLegal(root)
          : { first: '', last: '' };
        if (writerFirst && !writerFirst.value) writerFirst.value = remembered.first || '';
        if (writerLast && !writerLast.value) writerLast.value = remembered.last || '';
      }
    }

    function syncHumanSection() {
      var show = selectedHow() === 'ai_assisted';
      if (!humanSection) return;
      humanSection.hidden = !show;
      if (humanSection.classList && humanSection.classList.toggle) {
        humanSection.classList.toggle('is-hidden', !show);
      }
    }

    function refresh() {
      syncHumanSection();
      syncSolo();
      if (countEl) countEl.textContent = selectedElements().length + ' selected';
      if (trigger.classList) trigger.classList.toggle('is-incomplete', Boolean(pageError(collect())));
      writeDraft(collect());
    }

    function selectHow(value) {
      Array.prototype.forEach.call(choices, function (el) {
        el.classList.toggle('on', el.getAttribute('data-made-how') === value);
      });
      refresh();
    }

    function toggleTag(tag) {
      if (!tag) return;
      tag.classList.toggle('on');
      markHumanSaved();
      refresh();
    }

    Array.prototype.forEach.call(choices, function (choice) {
      choice.addEventListener('click', function (event) {
        if (event && event.preventDefault) event.preventDefault();
        selectHow(choice.getAttribute('data-made-how'));
      });
    });
    Array.prototype.forEach.call(tags, function (tag) {
      tag.addEventListener('click', function (event) {
        if (event && event.preventDefault) event.preventDefault();
        toggleTag(tag);
      });
    });
    if (human) human.addEventListener('input', refresh);
    if (rights) rights.addEventListener('change', refresh);
    if (solo) {
      solo.addEventListener('change', function () {
        setOtherWriters(!(solo && solo.checked));
        refresh();
      });
    }
    if (otherToggle) {
      otherToggle.addEventListener('click', function (event) {
        var choice = event.target && event.target.closest && event.target.closest('[data-other-writers]');
        if (!choice) return;
        if (event.preventDefault) event.preventDefault();
        setOtherWriters(choice.getAttribute('data-other-writers') === 'true');
        refresh();
      });
    }
    [writerFirst, writerLast, performer, writerCredit, producer, otherCount].forEach(function (el) {
      if (el && el.addEventListener) {
        el.addEventListener('input', refresh);
        el.addEventListener('change', refresh);
      }
    });
    [didLyrics, didBeat, directed].forEach(function (el) {
      if (el && el.addEventListener) el.addEventListener('change', refresh);
    });

    trigger.addEventListener('click', function (event) {
      if (event && event.preventDefault) event.preventDefault();
      var fields = collect();
      var error = pageError(fields);
      if (error) {
        setStatus(error);
        if (trigger.classList) trigger.classList.add('is-incomplete');
        return false;
      }
      markHumanSaved();
      writeDraft(fields);
      if (root.PlaigroundReleaseCredits && root.PlaigroundReleaseCredits.writeLegalToArtist) {
        var draft = readDraft();
        root.PlaigroundReleaseCredits.writeLegalToArtist(
          draft.artist_id,
          fields.legal_first,
          fields.legal_last,
          root
        );
      }
      setStatus('');
      if (root.location) root.location.href = nextHref(fields);
      return true;
    });

    applyDraft(readDraft());
    refresh();
    return {
      collect: collect,
      pageError: pageError,
      selectHow: selectHow,
      toggleTag: toggleTag,
      refresh: refresh,
    };
  }

  var api = { bindAttestPage: bindAttestPage, writeDraft: writeDraft, readDraft: readDraft };
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.PlaigroundAttest = api;
    if (root.document) bindAttestPage(root.document);
  }
}(typeof globalThis !== 'undefined' ? globalThis : this));
