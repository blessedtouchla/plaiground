(function (root) {
  var DRAFT_KEY = 'plaiground.tonegrid.draft';

  function readDraft() {
    try {
      var local = root.localStorage && root.localStorage.getItem(DRAFT_KEY);
      var session = root.sessionStorage && root.sessionStorage.getItem(DRAFT_KEY);
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

    function collect() {
      return {
        made_how: selectedHow(),
        human_elements: selectedElements(),
        human_contribution: human ? String(human.value || '').trim() : '',
        rights_confirmed: Boolean(rights && rights.checked)
      };
    }

    function pageError(fields) {
      if (root.PlaigroundUploadRequired && root.PlaigroundUploadRequired.validateAttestPage) {
        var checked = root.PlaigroundUploadRequired.validateAttestPage(fields);
        return checked && checked.error ? checked.error : '';
      }
      if (!fields.made_how) return 'How the song was made is required.';
      if (fields.made_how === 'ai_assisted') {
        if (!fields.human_elements.length) return 'Human element is required.';
        if (!fields.human_contribution) return 'Describe the human contribution is required.';
      }
      if (!fields.rights_confirmed) return 'Rights confirmation is required.';
      return '';
    }

    function setStatus(text) {
      if (!status) return;
      status.textContent = text || '';
      status.hidden = !text;
    }

    function applyDraft(draft) {
      draft = draft || {};
      if (draft.made_how) {
        Array.prototype.forEach.call(choices, function (el) {
          el.classList.toggle('on', el.getAttribute('data-made-how') === draft.made_how);
        });
      }
      if (Array.isArray(draft.human_elements)) {
        var wanted = Object.create(null);
        draft.human_elements.forEach(function (item) {
          wanted[String(item || '').trim()] = true;
        });
        Array.prototype.forEach.call(tags, function (tag) {
          tag.classList.toggle('on', Boolean(wanted[String(tag.textContent || '').trim()]));
        });
      }
      if (human && draft.human_contribution != null) human.value = String(draft.human_contribution);
      if (rights && draft.rights_confirmed != null) {
        rights.checked = draft.rights_confirmed === true || draft.rights_confirmed === 'true';
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

    trigger.addEventListener('click', function (event) {
      if (event && event.preventDefault) event.preventDefault();
      var fields = collect();
      var error = pageError(fields);
      if (error) {
        setStatus(error);
        if (trigger.classList) trigger.classList.add('is-incomplete');
        return false;
      }
      writeDraft(fields);
      setStatus('');
      if (root.location) root.location.href = trigger.getAttribute('href') || 'split-sheet.html';
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
