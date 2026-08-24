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
    var status = document.getElementById('attest-status');
    var trigger = document.querySelector('[data-attest-continue]');
    if (!trigger) return null;

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

    function collect() {
      var featured = featuredName();
      return {
        made_how: selectedHow(),
        human_elements: selectedElements(),
        human_contribution: human ? String(human.value || '').trim() : '',
        rights_confirmed: Boolean(rights && rights.checked),
        featured: featured,
        solo_owned_100: !featured && Boolean(solo && solo.checked)
      };
    }

    function nextHref(fields) {
      return fields && fields.solo_owned_100 ? 'review.html' : 'split-sheet.html';
    }

    function syncSolo() {
      var featured = featuredName();
      if (soloCard) {
        soloCard.hidden = Boolean(featured);
        if (soloCard.classList && soloCard.classList.toggle) {
          soloCard.classList.toggle('is-hidden', Boolean(featured));
        }
      }
      if (solo && featured) solo.checked = false;
      if (!trigger) return;
      if (!featured && solo && solo.checked) {
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
        solo.checked = draft.solo_owned_100 === true || draft.solo_owned_100 === 'true';
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
    if (solo) solo.addEventListener('change', refresh);

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
