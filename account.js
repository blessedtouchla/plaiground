(function (global) {
  var PHOTO_RE = /^data:image\/(jpeg|jpg|png);base64,/i;
  var lastMe = null;

  function $(sel) {
    if (sel && sel.charAt(0) === '#' && document.getElementById) {
      var byId = document.getElementById(sel.slice(1));
      if (byId) return byId;
    }
    return document.querySelector(sel);
  }

  function $all(sel) {
    return document.querySelectorAll(sel);
  }

  function firstName(artist) {
    var parts = String(artist || '').trim().split(/\s+/).filter(Boolean);
    return parts[0] || '';
  }

  function initials(artist) {
    var parts = String(artist || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'PG';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  function isPlaceholderName(name) {
    var next = String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!next) return false;
    if (
      next === 'john'
      || next === 'john ham'
      || next === 'john doe'
      || next === 'john harper'
      || next === 'patrick'
      || next === 'neon shadows'
      || next === 'neon sermon'
      || next === 'neon santos'
      || next === 'victoria reyes'
      || next === 'victoria void'
    ) return true;
    var first = next.split(' ')[0];
    return first === 'john' || first === 'patrick';
  }

  function accountArtistField(me) {
    var artist = String((me && me.artist) || '').trim();
    if (!artist || isPlaceholderName(artist)) return '';
    return artist;
  }

  function accountDisplayName(me) {
    var names = [];
    if (me && me.artist) names.push(me.artist);
    var roster = me && me.profile && me.profile.artists;
    if (Array.isArray(roster)) {
      roster.forEach(function (row) {
        if (row && row.name) names.push(row.name);
      });
    }
    for (var i = 0; i < names.length; i += 1) {
      var name = String(names[i] || '').trim();
      if (name && !isPlaceholderName(name)) return name;
    }
    return '';
  }

  var PLAN_PITCH = {
    creator: 'Creator · $14.99/month or $12.42/month billed yearly',
    pro: 'Pro · $19.99/month or $16.58/month billed yearly',
    basic: 'Basic · $0 forever',
  };
  var PLAN_DETAIL = {
    creator: 'Creator is Basic with the paid features unlocked. 8 distribution uploads and 8 publishing registrations this UTC month, counted separately. Pro unlocks unlimited.',
    pro: 'Same product as Creator, unlimited, plus catalog migration. Unlimited distribution uploads and publishing registrations.',
    basic: 'One release for the life of the account. Canceling a paid plan drops you here.',
  };

  function planLabel(plan) {
    var next = String(plan || '').trim().toLowerCase();
    if (next === 'pro') return 'PRO';
    if (next === 'creator') return 'CREATOR';
    if (next === 'basic') return 'BASIC';
    return '—';
  }

  function planPitch(plan, interval) {
    var next = String(plan || '').trim().toLowerCase();
    var billed = String(interval || '').trim().toLowerCase();
    if (next === 'creator' && billed === 'month') return 'Creator · $14.99/month';
    if (next === 'creator' && billed === 'year') return 'Creator · $12.42/month billed yearly';
    if (next === 'pro' && billed === 'month') return 'Pro · $19.99/month';
    if (next === 'pro' && billed === 'year') return 'Pro · $16.58/month billed yearly';
    return PLAN_PITCH[next] || 'Your plan';
  }

  function sidebarPrice(plan) {
    var next = String(plan || '').trim().toLowerCase();
    if (next === 'creator') return 'Creator · $14.99/month';
    if (next === 'pro') return 'Pro · $19.99/month';
    if (next === 'basic') return 'Basic · $0 forever';
    return 'Your plan';
  }

  function sidebarYear(plan) {
    var next = String(plan || '').trim().toLowerCase();
    if (next === 'creator') return 'or $149/year';
    if (next === 'pro') return 'or $199/year';
    return '';
  }

  function markPlanOption(plan, interval) {
    var key = String(plan || '').trim().toLowerCase();
    var billed = String(interval || '').trim().toLowerCase();
    $all('[data-plan-option]').forEach(function (el) {
      var option = String(el.getAttribute('data-plan-option') || '');
      var current = billed ? option === key + ':' + billed : option.indexOf(key + ':') === 0;
      if (el.classList && el.classList.toggle) el.classList.toggle('is-current', current);
      if (current) el.setAttribute('aria-current', 'true');
      else el.removeAttribute('aria-current');
    });
  }

  function setBillingStatus(text) {
    $all('[data-manage-billing-status]').forEach(function (el) {
      setText(el, text || '');
      el.hidden = !text;
    });
  }

  function applyBillingState(data) {
    if (!data) return;
    if (data.plan || data.interval) markPlanOption(data.plan, data.interval);
    if (data.no_card || data.has_card === false) {
      setBillingStatus('There is no card on file.');
    }
  }

  function isPortalUrl(url) {
    try {
      var parsed = new URL(url, 'https://www.wannaplai.com');
      var host = String(parsed.hostname || '').toLowerCase();
      if (parsed.protocol !== 'https:') return false;
      if (host === 'dashboard.stripe.com' || host.indexOf('dashboard.stripe.') === 0) return false;
      return host === 'billing.stripe.com' || host.slice(-19) === '.billing.stripe.com';
    } catch (err) {
      return false;
    }
  }

  function hashName() {
    return String((global.location && global.location.hash) || '').replace(/^#/, '');
  }

  function setText(el, text) {
    if (el) el.textContent = text;
  }

  function accountPhoto(me) {
    var raw = me && me.profile && typeof me.profile === 'object' ? me.profile.photo : '';
    var photo = String(raw || '').trim();
    return PHOTO_RE.test(photo) ? photo : '';
  }

  function paintAvatar(el, photo, letters) {
    if (!el) return;
    var art = String(photo || '').trim();
    if (el.style) {
      el.style.backgroundImage = art ? ('url("' + art.replace(/"/g, '') + '")') : '';
      el.style.backgroundSize = art ? 'cover' : '';
      el.style.backgroundPosition = art ? 'center' : '';
    }
    if (el.classList && el.classList.toggle) el.classList.toggle('has-art', Boolean(art));
    setText(el, art ? '' : letters);
  }

  function paintAvatars(photo, letters) {
    $all('[data-account-avatar]').forEach(function (el) {
      paintAvatar(el, photo, letters);
    });
  }

  function fillAccount(me) {
    if (!me) return;
    lastMe = me;
    var artist = accountArtistField(me);
    var display = accountDisplayName(me);
    var first = firstName(display);
    var who = first ? 'Hi ' + first + '!' : 'Hi there';
    $all('[data-account-who]').forEach(function (el) { setText(el, who); });
    paintAvatars(accountPhoto(me), initials(display));
    $all('[data-account-email]').forEach(function (el) {
      if (el.tagName === 'INPUT') el.value = me.email || '';
      else setText(el, me.email || '');
    });
    $all('[data-account-artist]').forEach(function (el) {
      if (el.tagName === 'INPUT') el.value = artist;
      else setText(el, artist);
    });
    $all('[data-account-plan]').forEach(function (el) { setText(el, planLabel(me.plan)); });
    var interval = String(me.billing_interval || me.interval || '').toLowerCase();
    $all('[data-account-plan-pitch]').forEach(function (el) { setText(el, planPitch(me.plan, interval)); });
    $all('[data-account-plan-price]').forEach(function (el) { setText(el, sidebarPrice(me.plan)); });
    $all('[data-account-plan-year]').forEach(function (el) {
      var year = sidebarYear(me.plan);
      setText(el, year);
      el.hidden = !year;
    });
    $all('[data-account-plan-detail]').forEach(function (el) {
      setText(el, PLAN_DETAIL[String(me.plan || '').toLowerCase()] || PLAN_DETAIL.basic);
    });
    markPlanOption(me.plan, interval);
    $all('[data-account-plan-title]').forEach(function (el) {
      var status = String(me.status || '').toLowerCase();
      if (status === 'hold') {
        el.textContent = 'On hold';
        return;
      }
      if (status === 'warning') {
        el.textContent = 'Payment warning';
        return;
      }
      var label = planLabel(me.plan);
      el.textContent = label === '—' ? 'Your plan' : 'On ' + label.charAt(0) + label.slice(1).toLowerCase();
    });
    var warning = String(me.status || '').toLowerCase() === 'warning';
    var hold = String(me.status || '').toLowerCase() === 'hold';
    $all('[data-billing-warning]').forEach(function (el) { el.hidden = !warning; });
    $all('[data-billing-hold]').forEach(function (el) { el.hidden = !hold; });
    $all('[data-payout-withdraw]').forEach(function (el) {
      var plan = String(me.plan || '').toLowerCase();
      var canWithdraw = plan === 'creator' || plan === 'pro';
      el.hidden = !canWithdraw;
      if (el.classList && el.classList.toggle) el.classList.toggle('is-hidden', !canWithdraw);
      var blocked = warning || hold;
      el.disabled = !canWithdraw || blocked;
      if (!canWithdraw) return;
      if (blocked) {
        el.setAttribute('aria-disabled', 'true');
        el.textContent = 'Payouts paused — update card';
      }
    });
    var ids = Array.isArray(me.tonegrid_release_ids) ? me.tonegrid_release_ids.filter(Boolean) : [];
    var cards = releaseCards(me);
    var hasRelease = cards.length > 0 || ids.length > 0;
    var latestId = hasRelease ? String((cards[cards.length - 1] && cards[cards.length - 1].id) || ids[ids.length - 1] || '') : '';
    var latest = latestReleaseCard(me, latestId, cards);
    var liveN = (typeof PlaigroundReleaseStatus !== 'undefined' && PlaigroundReleaseStatus)
      ? PlaigroundReleaseStatus.liveCount(me)
      : cards.filter(function (card) { return card && card.live; }).length;
    $all('[data-account-releases]').forEach(function (el) { setText(el, String(liveN)); });
    $all('[data-pub-call]').forEach(function (el) {
      el.hidden = !hasRelease;
    });
    renderOverview(cards);
    hydrateOverviewCovers(cards);
    var plan = String(me.plan || '').toLowerCase();
    var paid = plan === 'creator' || plan === 'pro';
    $all('[data-pub-badge]').forEach(function (el) {
      setText(el, paid ? 'INCLUDED IN YOUR PLAN' : 'INCLUDED ON CREATOR AND PRO');
    });
    $all('[data-first-song]').forEach(function (el) { el.hidden = hasRelease; });
    $all('[data-has-release]').forEach(function (el) { el.hidden = !hasRelease; });
    $all('[data-first-upload]').forEach(function (el) { el.hidden = hasRelease; });
    if (!(global.document && global.document.querySelector && global.document.querySelector('[data-publishing-pick]'))) {
      $all('[data-latest-title]').forEach(function (el) { setText(el, latest.title); });
    }
    $all('[data-latest-status]').forEach(function (el) { setText(el, latest.status); });
    $all('[data-latest-link]').forEach(function (el) {
      if (latest.href) el.setAttribute('href', latest.href);
    });
    $all('[data-latest-edit]').forEach(function (el) {
      el.setAttribute('href', 'releases.html');
    });
    $all('.side-nav a').forEach(function (el) {
      var href = el && el.getAttribute ? String(el.getAttribute('href') || '') : '';
      if (/^releases\.html(\?|$|#)/.test(href) || href === 'releases.html') {
        el.setAttribute('href', 'releases.html');
      }
    });
    var upload = me.upload || {};
    var atLimit = upload.allowed === false;
    $all('[data-new-release]').forEach(function (el) {
      if (!atLimit) return;
      el.setAttribute('href', 'upload.html');
    });
  }

  function readDraft() {
    try {
      return JSON.parse((global.localStorage && global.localStorage.getItem('plaiground.store.draft')) || '{}') || {};
    } catch (err) {
      try {
        return JSON.parse((global.sessionStorage && global.sessionStorage.getItem('plaiground.store.draft')) || '{}') || {};
      } catch (inner) {
        return {};
      }
    }
  }

  function statusApi() {
    return (typeof PlaigroundReleaseStatus !== 'undefined' && PlaigroundReleaseStatus) || null;
  }

  function releaseCards(me) {
    var api = statusApi();
    if (api && typeof api.ownedReleases === 'function') return api.ownedReleases(me);
    var ids = Array.isArray(me && me.tonegrid_release_ids) ? me.tonegrid_release_ids.filter(Boolean) : [];
    return ids.map(function (id) {
      return { id: String(id), title: '', status: 'pending', label: 'Pending', group: 'pending', live: false, artwork_url: '' };
    });
  }

  function coverOf(row) {
    var api = statusApi();
    if (api && typeof api.coverUrl === 'function') return api.coverUrl(row);
    if (global.PlaigroundCoverUrl && typeof global.PlaigroundCoverUrl.from === 'function') {
      return global.PlaigroundCoverUrl.from(row);
    }
    return String((row && (row.artwork_url || row.cover_art_url || row.cover_url)) || '').trim();
  }

  function applyCover(el, url) {
    if (global.PlaigroundCoverPreview && typeof global.PlaigroundCoverPreview.paintTile === 'function') {
      global.PlaigroundCoverPreview.paintTile(el, url);
      return;
    }
    var art = String(url || '').trim();
    if (el && el.style) {
      el.style.backgroundImage = art ? ('url("' + art.replace(/"/g, '') + '")') : '';
      el.style.backgroundSize = art ? 'cover' : '';
      el.style.backgroundPosition = art ? 'center' : '';
      el.style.backgroundColor = art ? '#111' : '';
    }
    if (el && el.classList && el.classList.toggle) el.classList.toggle('has-art', Boolean(art));
  }

  function hydrateOverviewCovers(cards) {
    if (!cards || !cards.length) return;
    if (!$('[data-release-tiles]')) return;
    if ($('[data-release-rows]')) return;
    if (typeof fetch !== 'function') return;
    fetch('/api/tonegrid/releases', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (response) {
        return response.json().then(function (body) {
          return { ok: response.ok, data: body || {} };
        }).catch(function () {
          return { ok: false, data: {} };
        });
      })
      .then(function (result) {
        if (!result.ok || !result.data || !Array.isArray(result.data.releases)) return;
        var byId = {};
        result.data.releases.forEach(function (row) {
          var id = String((row && (row.uuid || row.id)) || '').toLowerCase();
          var url = coverOf(row);
          if (id && url) byId[id] = url;
        });
        var next = cards.map(function (card) {
          var url = byId[String((card && card.id) || '').toLowerCase()];
          if (!url || (card && card.artwork_url)) return card;
          return Object.assign({}, card, { artwork_url: url });
        });
        var changed = next.some(function (card, i) { return card !== cards[i]; });
        if (changed) renderReleaseTiles(next);
      })
      .catch(function () {});
  }

  function renderOverview(cards) {
    var list = Array.isArray(cards) ? cards : [];
    var hasRelease = list.length > 0;
    var liveN = list.filter(function (card) { return card && card.live; }).length;
    renderReleaseTiles(list);
    renderMsp(list, hasRelease, liveN);
  }

  function renderReleaseTiles(cards) {
    var host = $('[data-release-tiles]');
    if (!host) return;
    host.textContent = '';
    if (!cards || !cards.length) {
      host.hidden = true;
      return;
    }
    host.hidden = false;
    cards.forEach(function (card) {
      var link = document.createElement('a');
      link.className = 'release-tile';
      link.href = card.id ? ('song.html?id=' + encodeURIComponent(card.id)) : 'releases.html';
      var art = document.createElement('span');
      art.className = 'release-tile-art';
      art.setAttribute('aria-hidden', 'true');
      applyCover(art, coverOf(card));
      var title = document.createElement('strong');
      title.textContent = card.title || 'Untitled';
      var status = document.createElement('span');
      var api = statusApi();
      var mapped = api ? api.info(card.status) : { label: card.label || 'Pending', dot: card.live ? 'green' : 'yellow' };
      status.className = 'release-tile-status is-' + (mapped.dot || 'gray');
      status.textContent = mapped.label || card.label || 'Pending';
      link.appendChild(art);
      link.appendChild(title);
      link.appendChild(status);
      host.appendChild(link);
    });
  }

  function mspRow(label, amount) {
    var row = document.createElement('div');
    row.className = 'row';
    var name = document.createElement('span');
    name.textContent = label;
    var value = document.createElement('b');
    value.textContent = amount;
    row.appendChild(name);
    row.appendChild(value);
    return row;
  }

  function renderMsp(cards, hasRelease, liveN) {
    var live = (cards || []).filter(function (card) { return card && card.live; });
    $all('[data-msp-section]').forEach(function (el) { el.hidden = !hasRelease; });
    $all('[data-msp-lock]').forEach(function (el) { el.hidden = !hasRelease || liveN > 0; });
    $all('[data-msp-open]').forEach(function (el) { el.hidden = liveN === 0; });
    var host = $('[data-msp-songs]');
    if (!host) return;
    host.textContent = '';
    live.forEach(function (card) {
      var box = document.createElement('article');
      box.className = 'msp-song';
      var heading = document.createElement('h4');
      heading.textContent = card.title || 'Untitled';
      var status = document.createElement('p');
      status.className = 'hint';
      status.textContent = card.label || 'Live';
      box.appendChild(heading);
      box.appendChild(status);
      box.appendChild(mspRow('Performance', '$0.00'));
      box.appendChild(mspRow('Mechanical', '$0.00'));
      host.appendChild(box);
    });
  }

  function latestReleaseCard(me, latestId, cards) {
    var draft = readDraft();
    var fromCard = '';
    if (Array.isArray(cards)) {
      cards.forEach(function (card) {
        if (card && card.id && String(card.id).toLowerCase() === String(latestId || '').toLowerCase()) {
          fromCard = String(card.title || '').trim();
        }
      });
    }
    var title = fromCard || String((draft && draft.title) || '').trim() || 'Your release';
    var href = latestId ? ('song.html?id=' + encodeURIComponent(latestId)) : 'releases.html';
    var editHref = 'releases.html';
    var stored = '';
    if (typeof PlaigroundReleaseStatus !== 'undefined' && PlaigroundReleaseStatus && latestId) {
      stored = PlaigroundReleaseStatus.storedStatus(me, latestId);
    }
    if (!stored && me && me.profile && Array.isArray(me.profile.releases) && latestId) {
      me.profile.releases.forEach(function (row) {
        if (String((row && (row.tonegrid_release_id || row.id)) || '').toLowerCase() === String(latestId).toLowerCase()) {
          stored = String((row && row.tonegrid_status) || '').toLowerCase();
        }
      });
    }
    if (!stored && draft && draft.tonegrid_status) stored = String(draft.tonegrid_status).toLowerCase();
    if (!stored) stored = (draft && draft.submitted === false) ? 'draft' : 'pending';
    var status = (typeof PlaigroundReleaseStatus !== 'undefined' && PlaigroundReleaseStatus)
      ? PlaigroundReleaseStatus.label(stored)
      : (stored === 'live' ? 'Live' : stored === 'draft' ? 'Draft' : stored === 'rejected' ? 'Needs fix' : 'Pending');
    return { title: title, status: status, href: href, editHref: editHref };
  }

  function setHint(el, text) {
    if (!el) return;
    el.textContent = text || '';
    el.hidden = !text;
  }

  function currentMe() {
    if (lastMe) return lastMe;
    if (global.PlaigroundMembership && typeof global.PlaigroundMembership.account === 'function') {
      return global.PlaigroundMembership.account();
    }
    return null;
  }

  function readPhotoFile(file) {
    return new Promise(function (resolve, reject) {
      if (!file) {
        resolve('');
        return;
      }
      if (typeof FileReader !== 'function') {
        reject(new Error('Could not read that photo.'));
        return;
      }
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('Could not read that photo.')); };
      reader.onload = function () {
        var src = String(reader.result || '');
        if (!PHOTO_RE.test(src) && !/^data:image\//i.test(src)) {
          reject(new Error('Photo must be a JPG or PNG.'));
          return;
        }
        if (typeof Image !== 'function' || !document.createElement) {
          if (!PHOTO_RE.test(src)) {
            reject(new Error('Photo must be a JPG or PNG.'));
            return;
          }
          resolve(src);
          return;
        }
        var img = new Image();
        img.onload = function () {
          var canvas = document.createElement('canvas');
          var size = 512;
          var scale = Math.min(size / Math.max(img.width, 1), size / Math.max(img.height, 1), 1);
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          var ctx = canvas.getContext && canvas.getContext('2d');
          if (!ctx || typeof canvas.toDataURL !== 'function') {
            if (!PHOTO_RE.test(src)) {
              reject(new Error('Photo must be a JPG or PNG.'));
              return;
            }
            resolve(src);
            return;
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          var out = canvas.toDataURL('image/jpeg', 0.8);
          if (out.length > 180000) out = canvas.toDataURL('image/jpeg', 0.6);
          resolve(out);
        };
        img.onerror = function () { reject(new Error('Photo must be a JPG or PNG.')); };
        img.src = src;
      };
      reader.readAsDataURL(file);
    });
  }

  function photoPayload(photo) {
    var me = currentMe() || {};
    var raw = me.profile && typeof me.profile === 'object' ? me.profile : {};
    return {
      artist: accountArtistField(me) || String(me.artist || '').trim(),
      profile: {
        photo: photo || '',
        genres: Array.isArray(raw.genres) ? raw.genres : [],
        specialties: Array.isArray(raw.specialties) ? raw.specialties : [],
      },
    };
  }

  function saveAccountPhoto(photo) {
    return fetch('/api/me/profile', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(photoPayload(photo)),
    }).then(function (response) {
      return response.json().then(function (data) {
        return { ok: response.ok, status: response.status, data: data || {} };
      }).catch(function () {
        return { ok: false, status: response.status, data: {} };
      });
    }).then(function (result) {
      if (result.ok && result.data) fillAccount(result.data);
      return result;
    });
  }

  function bindChangePhoto() {
    var pick = document.querySelector('[data-account-photo-pick]');
    var input = $('#account-photo') || document.querySelector('[data-account-photo]');
    if (!pick || !input) return;
    if (pick.getAttribute('data-bound') === 'true') return;
    pick.setAttribute('data-bound', 'true');
    var status = document.querySelector('[data-account-photo-status]');
    pick.addEventListener('click', function () {
      if (typeof input.click === 'function') input.click();
    });
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (!file) return;
      setHint(status, '');
      readPhotoFile(file).then(function (photo) {
        var me = currentMe() || {};
        paintAvatars(photo, initials(accountDisplayName(me)));
        return saveAccountPhoto(photo);
      }).then(function (result) {
        if (!result) return;
        if (!result.ok) {
          setHint(status, (result.data && result.data.error) || 'Could not save that photo.');
        }
      }).catch(function (err) {
        setHint(status, (err && err.message) || 'Photo must be a JPG or PNG.');
      });
    });
  }

  function bindChangePassword() {
    var toggle = document.querySelector('[data-change-password-toggle]');
    var form = document.querySelector('[data-change-password]');
    if (!toggle || !form) return;
    if (toggle.getAttribute('data-bound') === 'true') return;
    toggle.setAttribute('data-bound', 'true');
    var status = document.querySelector('[data-change-password-status]');
    var currentEl = document.getElementById('current-password');
    var nextEl = document.getElementById('new-password');
    var submit = form.querySelector('button[type="submit"]');

    toggle.addEventListener('click', function () {
      var open = form.hidden;
      form.hidden = !open;
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open && currentEl && typeof currentEl.focus === 'function') currentEl.focus();
    });

    form.addEventListener('submit', function (event) {
      if (event && event.preventDefault) event.preventDefault();
      var current = currentEl ? String(currentEl.value || '') : '';
      var password = nextEl ? String(nextEl.value || '') : '';
      if (password.length < 8) {
        setHint(status, 'Password must be at least 8 characters.');
        return;
      }
      if (submit) {
        submit.disabled = true;
        submit.setAttribute('aria-busy', 'true');
      }
      setHint(status, '');
      fetch('/api/auth/password', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: current, password: password }),
      }).then(function (response) {
        return response.json().then(function (data) {
          return { ok: response.ok, data: data || {} };
        }).catch(function () {
          return { ok: false, data: {} };
        });
      }).then(function (result) {
        if (submit) {
          submit.disabled = false;
          submit.removeAttribute('aria-busy');
        }
        if (!result.ok) {
          setHint(status, result.data.error || 'Current password is wrong.');
          return;
        }
        if (currentEl) currentEl.value = '';
        if (nextEl) nextEl.value = '';
        setHint(status, 'Password updated.');
      }).catch(function () {
        if (submit) {
          submit.disabled = false;
          submit.removeAttribute('aria-busy');
        }
        setHint(status, 'Could not update the password.');
      });
    });
  }

  function bindDeleteAccount() {
    var toggle = document.querySelector('[data-delete-account-toggle]');
    var panel = document.querySelector('[data-delete-account]');
    var submit = document.querySelector('[data-delete-account-submit]');
    if (!toggle || !panel || !submit) return;
    if (toggle.getAttribute('data-bound') === 'true') return;
    toggle.setAttribute('data-bound', 'true');
    var status = document.querySelector('[data-delete-account-status]');
    var confirmEl = document.getElementById('delete-confirm');

    toggle.addEventListener('click', function () {
      var open = panel.hidden;
      panel.hidden = !open;
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open && confirmEl && typeof confirmEl.focus === 'function') confirmEl.focus();
    });

    submit.addEventListener('click', function () {
      var confirm = confirmEl ? String(confirmEl.value || '').trim() : '';
      if (confirm.toUpperCase() !== 'DELETE') {
        setHint(status, 'Type DELETE to confirm.');
        return;
      }
      if (submit.getAttribute('aria-busy') === 'true') return;
      submit.setAttribute('aria-busy', 'true');
      submit.disabled = true;
      setHint(status, '');
      fetch('/api/auth/delete', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE' }),
      }).then(function (response) {
        return response.json().then(function (data) {
          return { ok: response.ok, data: data || {} };
        }).catch(function () {
          return { ok: false, data: {} };
        });
      }).then(function (result) {
        submit.removeAttribute('aria-busy');
        submit.disabled = false;
        if (!result.ok) {
          setHint(status, result.data.error || 'Could not delete the account.');
          return;
        }
        if (global.PlaigroundMembership && typeof global.PlaigroundMembership.clearSignedIn === 'function') {
          global.PlaigroundMembership.clearSignedIn();
        }
        global.location.href = 'index.html';
      }).catch(function () {
        submit.removeAttribute('aria-busy');
        submit.disabled = false;
        setHint(status, 'Could not delete the account.');
      });
    });
  }

  function bindSignOut() {
    var link = document.querySelector('.sign-out');
    if (!link) return;
    link.addEventListener('click', function (event) {
      event.preventDefault();
      var dest = link.getAttribute('href') || 'index.html';
      if (global.PlaigroundMembership && typeof global.PlaigroundMembership.clearSignedIn === 'function') {
        global.PlaigroundMembership.clearSignedIn();
      }
      fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin', headers: { Accept: 'application/json' } })
        .catch(function () {})
        .then(function () {
          global.location.href = dest;
        });
    });
  }

  function bounceUnfinished(result) {
    var path = String((global.location && global.location.pathname) || '');
    var file = path.split('/').pop();
    if (file === 'confirm.html' || file === 'confirmed.html' || file === 'login.html' || file === 'signup.html') {
      return;
    }
    if (result && result.data && result.data.pending) {
      global.location.replace('confirm.html');
    }
  }

  function fromMembership() {
    if (global.PlaigroundMembership && typeof global.PlaigroundMembership.whenReady === 'function') {
      return global.PlaigroundMembership.whenReady().then(function (result) {
        bounceUnfinished(result);
        if (result && result.ok && result.data && !result.data.pending) return result.data;
        if (global.PlaigroundMembership.account) return global.PlaigroundMembership.account();
        return null;
      });
    }
    return fetch('/api/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (response) {
        return response.json().then(function (data) {
          bounceUnfinished({ ok: response.ok, data: data || {} });
          if (!response.ok) return null;
          return data;
        });
      })
      .catch(function () {
        return null;
      });
  }

  function dollars(cents) {
    var n = Number(cents);
    if (!Number.isFinite(n)) return '';
    return '$' + (n / 100).toFixed(2);
  }

  function nextPeriodPrice(plan, interval, cents) {
    var fromServer = dollars(cents);
    if (fromServer) return fromServer;
    var next = String(plan || '').trim().toLowerCase();
    var billed = String(interval || '').trim().toLowerCase();
    if (next === 'creator' && billed === 'month') return '$14.99';
    if (next === 'creator' && billed === 'year') return '$149.00';
    if (next === 'pro' && billed === 'month') return '$19.99';
    if (next === 'pro' && billed === 'year') return '$199.00';
    return '';
  }

  function upgradeChargeCopy(due, next) {
    if (due && next) {
      return 'You pay the difference now: ' + due + '. Next period you pay ' + next + '. Same billing date.';
    }
    if (due) return 'You pay the difference now: ' + due + '. Then the new price next period.';
    return 'You pay the difference now, then the new price next period.';
  }

  function bindPlanConfirm() {
    var root = document.querySelector('[data-plan-confirm]');
    if (!root) return;
    var params;
    try {
      params = new URLSearchParams(global.location.search);
    } catch (err) {
      params = { get: function () { return ''; } };
    }
    var plan = String(params.get('plan') || '').trim().toLowerCase();
    var interval = String(params.get('interval') || 'month').trim().toLowerCase();
    if (interval === 'yearly') interval = 'year';
    if (interval === 'monthly') interval = 'month';
    var title = document.querySelector('[data-plan-confirm-title]');
    var change = document.querySelector('[data-plan-confirm-change]');
    var charge = document.querySelector('[data-plan-confirm-charge]');
    var submit = document.querySelector('[data-plan-confirm-submit]');
    var status = document.querySelector('[data-checkout-status]');
    if (plan !== 'creator' && plan !== 'pro') {
      setText(title, 'Choose a paid plan');
      setText(change, 'Basic is not a paid switch target. Pick Creator or Pro from Settings.');
      if (submit) submit.hidden = true;
      return;
    }
    if (submit) {
      submit.setAttribute('data-checkout-plan', plan);
      submit.setAttribute('data-checkout-interval', interval);
      submit.setAttribute('data-checkout-switch', '');
    }
    setText(title, 'Confirm ' + planPitch(plan, interval));
    setText(change, 'Switch to ' + planPitch(plan, interval) + '.' + (plan === 'pro' ? ' ' + PLAN_DETAIL.pro : ''));
    setText(charge, 'You pay the difference now, then the new price next period. Downgrades take effect now with no refund.');
    if (typeof global.fetch !== 'function') return;
    global.fetch('/api/create-checkout-session', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ action: 'preview', plan: plan, interval: interval }),
    })
      .then(function (response) {
        return response.json().then(function (data) {
          return { ok: response.ok, data: data || {} };
        }).catch(function () {
          return { ok: false, data: {} };
        });
      })
      .then(function (result) {
        var data = result.data || {};
        if (!result.ok) {
          if (status) {
            status.textContent = '';
            status.hidden = true;
          }
          return;
        }
        var from = planPitch(data.currentPlan || data.from_plan, data.currentInterval || data.from_interval);
        var to = planPitch(data.plan || plan, data.interval || interval);
        if (data.unchanged) {
          setText(change, 'You are already on ' + to + '.');
          setText(charge, 'Submit will not charge again.');
          return;
        }
        setText(change, 'Switch from ' + from + ' to ' + to + '.' + (plan === 'pro' ? ' ' + PLAN_DETAIL.pro : ''));
        if (data.proration === 'none') {
          setText(title, 'No refund');
          setText(charge, 'This is a downgrade. The change takes effect now. No refund for unused time.');
          return;
        }
        if (data.checkout && !data.existing) {
          setText(charge, 'Submit continues to Stripe Checkout to start this plan.');
          return;
        }
        var due = dollars(data.amount_due);
        var next = nextPeriodPrice(data.plan || plan, data.interval || interval, data.recurring_amount);
        if (due) setText(title, 'Due now: ' + due);
        setText(charge, upgradeChargeCopy(due, next));
      })
      .catch(function () {});
  }

  function fetchBillingState() {
    if (typeof global.fetch !== 'function') return Promise.resolve(null);
    if (!document.querySelector('[data-manage-plan], [data-manage-billing]')) return Promise.resolve(null);
    return global.fetch('/api/create-checkout-session', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ action: 'billing' }),
    })
      .then(function (response) {
        return response.json().then(function (data) {
          return { ok: response.ok, data: data || {} };
        }).catch(function () {
          return { ok: false, data: {} };
        });
      })
      .then(function (result) {
        if (!result.ok) return null;
        applyBillingState(result.data);
        $all('[data-account-plan-pitch]').forEach(function (el) {
          setText(el, planPitch(result.data.plan, result.data.interval));
        });
        return result.data;
      })
      .catch(function () {
        return null;
      });
  }

  function openManagePlan() {
    var toggle = document.querySelector('[data-manage-plan-toggle]');
    var panel = document.querySelector('[data-manage-plan]');
    if (!toggle || !panel) return;
    panel.hidden = false;
    panel.removeAttribute('hidden');
    toggle.setAttribute('aria-expanded', 'true');
    if (typeof panel.scrollIntoView === 'function') {
      panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    var current = panel.querySelector('[data-plan-option][aria-current="true"], [data-plan-option].is-current');
    var first = current || panel.querySelector('[data-plan-option]');
    if (first && typeof first.focus === 'function') first.focus();
    fetchBillingState();
  }

  function bindManagePlan() {
    var toggle = document.querySelector('[data-manage-plan-toggle]');
    var panel = document.querySelector('[data-manage-plan]');
    if (!toggle || !panel) return;
    if (toggle.getAttribute('data-manage-bound') === 'true') return;
    toggle.setAttribute('data-manage-bound', 'true');
    toggle.addEventListener('click', function (event) {
      if (event && event.preventDefault) event.preventDefault();
      openManagePlan();
    });
    if (hashName() === 'manage-plan') openManagePlan();
  }

  function bindManageBilling() {
    var button = document.querySelector('[data-manage-billing]');
    if (!button) return;
    if (button.getAttribute('data-billing-bound') === 'true') return;
    button.setAttribute('data-billing-bound', 'true');
    if (hashName() === 'manage-billing') {
      var panel = document.getElementById('manage-billing');
      if (panel && typeof panel.scrollIntoView === 'function') {
        panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
    fetchBillingState();
    button.addEventListener('click', function (event) {
      if (event && event.preventDefault) event.preventDefault();
      if (button.getAttribute('aria-busy') === 'true') return;
      var original = button.getAttribute('data-billing-label') || button.textContent;
      button.setAttribute('data-billing-label', original);
      button.setAttribute('aria-busy', 'true');
      button.disabled = true;
      button.textContent = 'Opening…';
      setBillingStatus('');
      if (typeof global.fetch !== 'function') {
        button.removeAttribute('aria-busy');
        button.disabled = false;
        button.textContent = original;
        setBillingStatus('There is no card on file.');
        return;
      }
      global.fetch('/api/create-checkout-session', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          action: 'portal',
          returnUrl: 'https://www.wannaplai.com/settings.html#manage-billing',
        }),
      })
        .then(function (response) {
          return response.json().then(function (data) {
            return { ok: response.ok, status: response.status, data: data || {} };
          }).catch(function () {
            return { ok: false, status: response.status, data: {} };
          });
        })
        .then(function (result) {
          var data = result.data || {};
          if (data.no_card || data.has_card === false) {
            button.removeAttribute('aria-busy');
            button.disabled = false;
            button.textContent = original;
            setBillingStatus('There is no card on file.');
            return;
          }
          if (data.url && isPortalUrl(data.url)) {
            global.location.href = data.url;
            return;
          }
          button.removeAttribute('aria-busy');
          button.disabled = false;
          button.textContent = original;
          if (result.status === 401) {
            setBillingStatus('Still signed in. Try again.');
            return;
          }
          if (result.status === 503 || data.configured === false) {
            setBillingStatus('Billing is not available yet.');
            return;
          }
          setBillingStatus(data.error || 'There is no card on file.');
        })
        .catch(function () {
          button.removeAttribute('aria-busy');
          button.disabled = false;
          button.textContent = original;
          setBillingStatus('Could not open billing.');
        });
    });
  }

  function whenDomReady(cb) {
    var doc = global.document;
    if (!doc || typeof cb !== 'function') return;
    if (doc.readyState === 'loading' && typeof doc.addEventListener === 'function') {
      doc.addEventListener('DOMContentLoaded', cb);
      return;
    }
    cb();
  }

  bindSignOut();
  whenDomReady(bindManagePlan);
  whenDomReady(bindManageBilling);
  whenDomReady(bindChangePassword);
  whenDomReady(bindDeleteAccount);
  whenDomReady(bindChangePhoto);
  bindManagePlan();
  bindManageBilling();
  bindChangePassword();
  bindDeleteAccount();
  bindChangePhoto();
  bindPlanConfirm();
  fromMembership().then(function (me) {
    if (me) fillAccount(me);
  });

  global.PlaigroundAccount = {
    fill: fillAccount,
    markPlanOption: markPlanOption,
    renderOverview: renderOverview,
    accountPhoto: accountPhoto,
    readPhotoFile: readPhotoFile,
    saveAccountPhoto: saveAccountPhoto,
  };
})(window);
