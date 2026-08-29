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
    if (me && me.username) names.push(me.username);
    if (me && me.profile && me.profile.username) names.push(me.profile.username);
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

  function isPaidPlan(plan) {
    var next = String(plan || '').trim().toLowerCase();
    return next === 'creator' || next === 'pro';
  }

  function unixSeconds(value) {
    if (value == null || value === '') return null;
    var n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n > 1e12 ? Math.floor(n / 1000) : Math.floor(n);
  }

  function formatRenewalDate(unix) {
    var n = unixSeconds(unix);
    if (n == null) return '';
    var date = new Date(n * 1000);
    if (Number.isNaN(date.getTime())) return '';
    try {
      return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    } catch (err) {
      return '';
    }
  }

  function paintPlanRenews(data) {
    var plan = data && data.plan;
    var label = isPaidPlan(plan) ? formatRenewalDate(data && data.current_period_end) : '';
    var text = label ? 'Renews ' + label : '';
    $all('[data-plan-renews]').forEach(function (el) {
      setText(el, text);
      el.hidden = !text;
      if (!text) el.setAttribute('hidden', '');
      else if (el.removeAttribute) el.removeAttribute('hidden');
    });
  }

  function applyBillingState(data) {
    if (!data) return;
    if (data.plan || data.interval) markPlanOption(data.plan, data.interval);
    paintPlanRenews(data);
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

  function leftoverOverviewRow(el) {
    if (!el) return false;
    var span = el.querySelector ? el.querySelector('span') : null;
    var label = String((span && span.textContent) || '').replace(/\s+/g, ' ').trim().toLowerCase();
    return label === 'split sheets signed' || label === 'plan renews';
  }

  function stripOverviewLeftoverRows() {
    var rows = $all('.account-card .row');
    var list = [];
    var i;
    for (i = 0; i < rows.length; i += 1) list.push(rows[i]);
    list.forEach(function (el) {
      if (!leftoverOverviewRow(el)) return;
      if (el.parentNode && el.parentNode.removeChild) el.parentNode.removeChild(el);
    });
  }

  function fillAccount(me) {
    if (!me) return;
    lastMe = me;
    stripOverviewLeftoverRows();
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
    var username = String((me.username || (me.profile && me.profile.username) || '')).trim();
    $all('[data-account-username]').forEach(function (el) {
      if (el.tagName === 'INPUT') el.value = username;
      else setText(el, username);
    });
    var legal = String((me.profile && me.profile.legal_name) || '').trim();
    $all('[data-account-legal]').forEach(function (el) {
      if (el.tagName === 'INPUT') el.value = legal;
      else setText(el, legal);
    });
    var country = String((me.profile && me.profile.country) || '').trim();
    $all('[data-account-country]').forEach(function (el) {
      if (el.tagName === 'INPUT') el.value = country;
      else setText(el, country);
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
    if (!isPaidPlan(me.plan)) paintPlanRenews({ plan: me.plan });
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
    paintAccountCounts(me, cards);
    renderNextUp(me, cards);
    $all('[data-pub-call]').forEach(function (el) {
      el.hidden = true;
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
        var api = statusApi();
        var byId = {};
        result.data.releases.forEach(function (row) {
          var id = String((row && (row.uuid || row.id)) || '').toLowerCase();
          if (id) byId[id] = row;
        });
        var seen = {};
        var next = (cards || []).map(function (card) {
          var id = String((card && card.id) || '').toLowerCase();
          if (id) seen[id] = true;
          var row = byId[id];
          if (!row) return card;
          var mapped = (api && typeof api.displayInfo === 'function')
            ? api.displayInfo(row)
            : (api ? api.info(row.status) : null);
          var url = coverOf(row);
          return Object.assign({}, card, {
            title: String((row.title || (card && card.title) || '')).trim(),
            status: String((row.status || (card && card.status) || '')),
            label: mapped ? mapped.label : (card && card.label),
            group: mapped ? mapped.group : (card && card.group),
            live: mapped ? mapped.live : false,
            artwork_url: (card && card.artwork_url) || url,
            alert: mapped && mapped.alert != null
              ? mapped.alert
              : ((api && typeof api.problemAlert === 'function') ? api.problemAlert(row) : (card && card.alert) || ''),
          });
        });
        result.data.releases.forEach(function (row) {
          var id = String((row && (row.uuid || row.id)) || '').toLowerCase();
          if (!id || seen[id]) return;
          var card = api && typeof api.cardFromRow === 'function' ? api.cardFromRow(row) : null;
          if (card) next.push(card);
        });
        renderOverview(next);
        paintAccountCounts(lastMe, next);
        renderNextUp(lastMe, next);
      })
      .catch(function () {});
  }

  function artistProfileCount(me) {
    var roster = me && me.profile && Array.isArray(me.profile.artists) ? me.profile.artists : [];
    var n = 0;
    var i;
    for (i = 0; i < roster.length; i += 1) {
      var name = roster[i] && roster[i].name;
      if (name && !isPlaceholderName(name)) n += 1;
    }
    return n;
  }

  function isPendingCard(card, api) {
    if (!card || card.live) return false;
    if (api && typeof api.isPendingPipeline === 'function') return api.isPendingPipeline(card);
    var g = card.group || (api && typeof api.group === 'function' ? api.group(card.status) : '');
    return g === 'pending' || g === 'processing' || g === 'rejected';
  }

  function paintAccountCounts(me, cards) {
    var api = statusApi();
    var list = Array.isArray(cards) ? cards : [];
    var liveN = 0;
    var pendingN = 0;
    if (list.length) {
      list.forEach(function (card) {
        if (card && card.live) liveN += 1;
        else if (isPendingCard(card, api)) pendingN += 1;
      });
    } else if (api && me) {
      liveN = typeof api.liveCount === 'function' ? api.liveCount(me) : 0;
      pendingN = typeof api.pendingCount === 'function' ? api.pendingCount(me) : 0;
    }
    $all('[data-account-releases]').forEach(function (el) { setText(el, String(liveN)); });
    $all('[data-account-pending]').forEach(function (el) { setText(el, String(pendingN)); });
    $all('[data-account-artists]').forEach(function (el) { setText(el, String(artistProfileCount(me))); });
  }

  function payoutSetUp(me) {
    var raw = me && (me.payout_method || (me.profile && (me.profile.payout_method || me.profile.payout)));
    return Boolean(raw && String(raw).trim());
  }

  function firstRealProblem(cards) {
    var api = statusApi();
    var i;
    for (i = 0; i < (cards || []).length; i += 1) {
      var card = cards[i];
      if (!card || card.live) continue;
      var alertText = String((card.alert || (api && typeof api.problemAlert === 'function' ? api.problemAlert(card) : '')) || '').trim();
      if (alertText) return { card: card, alert: readableFixCopy(alertText) };
    }
    return null;
  }

  function hideStoreNames(text) {
    var next = String(text == null ? '' : text);
    next = next.replace(/\bthe\s+(?:ToneGrid|InterSpace|Flossy(?:TheBoss)?)\b/gi, 'the store');
    next = next.replace(/ToneGrid|Tonegrid|InterSpace|Flossy(?:TheBoss)?/gi, 'the store');
    return next.replace(/\s{2,}/g, ' ').replace(/^\s+|\s+$/g, '');
  }

  function readableFixCopy(text) {
    var raw = hideStoreNames(text);
    if (!raw) return '';
    var api = statusApi();
    var qc = (api && Array.isArray(api.STORE_QC_LINES)) ? api.STORE_QC_LINES.join('\n') : '';
    var vendor = raw;
    var tail = '';
    if (qc && raw.indexOf(qc) !== -1) {
      vendor = raw.replace(qc, '').replace(/\n+$/g, '').trim();
      tail = qc;
    }
    if (!vendor) return tail;
    var lower = vendor.toLowerCase();
    var songwriter = /songwriter|composer|writer names?/.test(lower);
    var stage = /stage|rapper|\bband\b/.test(lower);
    var firstLast = /first(?:\s+and\s+|\s+)last/.test(lower);
    var performer = /performer/.test(lower);
    var producer = /producer/.test(lower);
    var credit = /credit|missing|required/.test(lower);
    var rewritten = vendor;
    if (songwriter && (stage || credit || firstLast)) {
      rewritten = 'Stores need real songwriter names, not a stage, rapper, or band name.';
    } else if ((performer || producer) && credit) {
      rewritten = 'This release needs a performer credit and a producer credit.';
    }
    return tail ? (rewritten + '\n' + tail) : rewritten;
  }

  function renderNextUp(me, cards) {
    var host = $('[data-next-up]');
    if (!host) return;
    var list = Array.isArray(cards) ? cards : [];
    var title = $('[data-next-up-title]');
    var body = $('[data-next-up-body]');
    var link = $('[data-next-up-link]');
    var next = null;
    if (!list.length) {
      next = {
        title: 'Submit your first song',
        body: 'Upload a finished track, confirm the rights, sign the split sheet.',
        href: 'upload.html',
        label: 'Submit your first song',
      };
    } else {
      var problem = firstRealProblem(list);
      if (problem) {
        next = {
          title: 'Fix this release',
          body: problem.alert,
          href: problem.card.id ? ('song.html?id=' + encodeURIComponent(problem.card.id)) : 'releases.html',
          label: 'Open release',
        };
      } else if (!payoutSetUp(me)) {
        next = {
          title: 'Add a payout method',
          body: 'Set where royalties go when they clear.',
          href: 'payouts.html',
          label: 'Add a payout method',
        };
      }
    }
    host.hidden = !next;
    if (!next) return;
    if (title) setText(title, next.title);
    if (body) setText(body, next.body);
    if (link) {
      link.setAttribute('href', next.href);
      setText(link, next.label);
    }
  }

  function recentStrip(cards) {
    var list = Array.isArray(cards) ? cards.filter(Boolean) : [];
    var out = [];
    var i;
    for (i = list.length - 1; i >= 0 && out.length < 4; i -= 1) {
      out.push(list[i]);
    }
    return out;
  }

  function renderOverview(cards) {
    var list = Array.isArray(cards) ? cards : [];
    list = recentStrip(list);
    if (global.PlaigroundReleaseCredits && typeof global.PlaigroundReleaseCredits.withSavedDraft === 'function') {
      list = global.PlaigroundReleaseCredits.withSavedDraft(list, readDraft());
    }
    renderReleaseTiles(list);
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
      link.href = (card.local_draft || card.id === 'local-draft')
        ? 'upload.html'
        : (card.id ? ('song.html?id=' + encodeURIComponent(card.id)) : 'releases.html');
      var art = document.createElement('span');
      art.className = 'release-tile-art';
      art.setAttribute('aria-hidden', 'true');
      applyCover(art, coverOf(card));
      var title = document.createElement('strong');
      title.textContent = card.title || 'Untitled';
      var status = document.createElement('span');
      var api = statusApi();
      var mapped = api ? api.info(card.status) : {
        label: card.label || 'Pending',
        dot: (card.status === 'live' || card.status === 'delivered') ? 'green' : 'yellow',
        live: card.status === 'live' || card.status === 'delivered',
      };
      var tileLabel = card.label || mapped.label || 'Pending';
      var tileDot = tileLabel === 'Needs fix' ? 'red' : (mapped.dot || 'gray');
      status.className = 'release-tile-status is-' + tileDot;
      status.textContent = tileLabel;
      link.appendChild(art);
      link.appendChild(title);
      link.appendChild(status);
      var alertText = String((card && card.alert) || '').trim();
      if (!alertText && api && typeof api.problemAlert === 'function') {
        alertText = String(api.problemAlert(card) || '').trim();
      }
      if (alertText) {
        var note = document.createElement('p');
        note.className = 'release-tile-alert';
        note.textContent = alertText;
        link.appendChild(note);
      }
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
    if (typeof PlaigroundReleaseStatus !== 'undefined' && PlaigroundReleaseStatus && typeof PlaigroundReleaseStatus.displayInfo === 'function') {
      var latestRow = null;
      if (me && me.profile && Array.isArray(me.profile.releases) && latestId) {
        me.profile.releases.forEach(function (row) {
          if (String((row && (row.tonegrid_release_id || row.id)) || '').toLowerCase() === String(latestId).toLowerCase()) {
            latestRow = row;
          }
        });
      }
      if (Array.isArray(cards)) {
        cards.forEach(function (card) {
          if (card && card.id && String(card.id).toLowerCase() === String(latestId || '').toLowerCase()) {
            latestRow = latestRow ? Object.assign({}, latestRow, card) : card;
          }
        });
      }
      var shown = PlaigroundReleaseStatus.displayInfo(latestRow, stored);
      if (shown && shown.label) status = shown.label;
    }
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

  function accountPayload(overrides) {
    overrides = overrides || {};
    var me = currentMe() || {};
    var raw = me.profile && typeof me.profile === 'object' ? me.profile : {};
    var artistInput = document.querySelector('[data-account-artist]');
    var artist = artistInput && artistInput.tagName === 'INPUT'
      ? String(artistInput.value || '').trim()
      : (accountArtistField(me) || String(me.artist || '').trim());
    if (overrides.artist != null) artist = String(overrides.artist || '').trim();
    var legalInput = document.querySelector('[data-account-legal]');
    var countryInput = document.querySelector('[data-account-country]');
    var photo = Object.prototype.hasOwnProperty.call(overrides, 'photo')
      ? overrides.photo
      : accountPhoto(me);
    var legal = legalInput ? String(legalInput.value || '').trim() : String(raw.legal_name || '');
    var country = countryInput ? String(countryInput.value || '').trim() : String(raw.country || '');
    if (overrides.legal_name != null) legal = String(overrides.legal_name || '').trim();
    if (overrides.country != null) country = String(overrides.country || '').trim();
    var usernameInput = document.querySelector('[data-account-username]');
    var username = usernameInput && usernameInput.tagName === 'INPUT'
      ? String(usernameInput.value || '').trim()
      : String((me.username || raw.username || '')).trim();
    if (overrides.username != null) username = String(overrides.username || '').trim();
    var nextProfile = {
      photo: photo || '',
      genres: Array.isArray(raw.genres) ? raw.genres : [],
      specialties: Array.isArray(raw.specialties) ? raw.specialties : [],
      legal_name: legal,
      country: country,
    };
    if (usernameInput || overrides.username != null) nextProfile.username = username;
    return {
      artist: artist,
      profile: nextProfile,
    };
  }

  function postAccountProfile(payload) {
    return fetch('/api/me/profile', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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

  function saveAccountPhoto(photo) {
    return postAccountProfile(accountPayload({ photo: photo }));
  }

  function saveAccountChanges() {
    var btn = document.querySelector('[data-account-save]');
    var status = document.querySelector('[data-account-save-status]');
    if (btn) {
      if (btn.setAttribute) btn.setAttribute('aria-busy', 'true');
      btn.disabled = true;
    }
    setHint(status, 'Saving…');
    return postAccountProfile(accountPayload()).then(function (result) {
      if (btn) {
        if (btn.removeAttribute) btn.removeAttribute('aria-busy');
        btn.disabled = false;
      }
      if (!result) {
        setHint(status, 'Could not save changes.');
        return result;
      }
      if (result.status === 401) {
        setHint(status, 'Sign in to save these changes.');
        return result;
      }
      if (!result.ok) {
        setHint(status, (result.data && result.data.error) || 'Could not save changes.');
        return result;
      }
      setHint(status, 'Saved on this account.');
      return result;
    }).catch(function () {
      if (btn) {
        if (btn.removeAttribute) btn.removeAttribute('aria-busy');
        btn.disabled = false;
      }
      setHint(status, 'Could not save changes.');
      return { ok: false };
    });
  }

  function bindSaveChanges() {
    var btn = document.querySelector('[data-account-save]');
    if (!btn) return;
    if (btn.getAttribute('data-bound') === 'true') return;
    btn.setAttribute('data-bound', 'true');
    btn.addEventListener('click', function (event) {
      if (event && event.preventDefault) event.preventDefault();
      saveAccountChanges();
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
  whenDomReady(stripOverviewLeftoverRows);
  stripOverviewLeftoverRows();
  whenDomReady(bindManagePlan);
  whenDomReady(bindManageBilling);
  whenDomReady(bindChangePassword);
  whenDomReady(bindDeleteAccount);
  whenDomReady(bindChangePhoto);
  whenDomReady(bindSaveChanges);
  bindManagePlan();
  bindManageBilling();
  bindChangePassword();
  bindDeleteAccount();
  bindChangePhoto();
  bindSaveChanges();
  bindPlanConfirm();
  fromMembership().then(function (me) {
    if (me) fillAccount(me);
    if (global.PlaigroundProblem && typeof global.PlaigroundProblem.mount === 'function') {
      global.PlaigroundProblem.mount();
    }
  });

  function loadProblemChrome() {
    var doc = global.document;
    if (!doc) return;
    function start() {
      if (global.PlaigroundProblem && typeof global.PlaigroundProblem.mount === 'function') {
        global.PlaigroundProblem.mount();
      }
    }
    if (global.PlaigroundProblem) {
      start();
      return;
    }
    if (!doc.querySelector || !doc.querySelector('.side-nav, .flow-top, [data-problem-form]')) return;
    var existing = doc.querySelector('script[src="problem.js"]');
    if (existing) {
      if (existing.addEventListener) existing.addEventListener('load', start);
      return;
    }
    if (!doc.createElement) return;
    var script = doc.createElement('script');
    script.src = 'problem.js';
    script.onload = start;
    var parent = doc.body || doc.documentElement;
    if (parent && parent.appendChild) parent.appendChild(script);
  }
  whenDomReady(loadProblemChrome);

  global.PlaigroundAccount = {
    fill: fillAccount,
    markPlanOption: markPlanOption,
    renderOverview: renderOverview,
    stripOverviewLeftoverRows: stripOverviewLeftoverRows,
    accountPhoto: accountPhoto,
    readPhotoFile: readPhotoFile,
    saveAccountPhoto: saveAccountPhoto,
    saveAccountChanges: saveAccountChanges,
  };
})(window);
