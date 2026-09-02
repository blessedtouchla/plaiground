(function () {
  var RANK_ONE_ID = "Hl5_Lc6b3AU";
  var EMBED_ORIGIN = "https://www.wannaplai.com";
  var DATA_URL = "data/siqa-chart.json";
  var tracks = [];
  var filtered = [];
  var currentIndex = -1;
  var inflight = Object.create(null);
  var ytPlayer = null;
  var pendingVideoId = "";

  var listEl = document.querySelector("[data-charts-list]");
  var searchEl = document.querySelector("[data-charts-search]");
  var playerEl = document.querySelector("[data-charts-player]");
  var frameEl = document.querySelector("[data-charts-frame]");
  var nowTitle = document.querySelector("[data-charts-now-title]");
  var nowArtist = document.querySelector("[data-charts-now-artist]");
  var nowCover = document.querySelector("[data-charts-now-cover]");
  var prevBtn = document.querySelector("[data-charts-prev]");
  var nextBtn = document.querySelector("[data-charts-next]");

  function coverUrl(id) {
    if (!id) return "";
    return "https://i.ytimg.com/vi/" + encodeURIComponent(id) + "/hqdefault.jpg";
  }

  function embedUrl(id) {
    return "https://www.youtube.com/embed/" + encodeURIComponent(id)
      + "?autoplay=1&modestbranding=1&rel=0&playsinline=1&enablejsapi=1&origin=https://www.wannaplai.com";
  }

  function bindYouTubePlayer() {
    if (ytPlayer || !frameEl || !(window.YT && typeof YT.Player === "function")) return;
    ytPlayer = new YT.Player(frameEl, {
      host: "https://www.youtube.com",
      playerVars: {
        autoplay: 1,
        modestbranding: 1,
        rel: 0,
        playsinline: 1,
        enablejsapi: 1,
        origin: EMBED_ORIGIN
      },
      events: {
        onReady: function (event) {
          var target = event && event.target;
          if (pendingVideoId && target && typeof target.loadVideoById === "function") {
            target.loadVideoById(pendingVideoId);
          } else if (target && typeof target.playVideo === "function") {
            target.playVideo();
          }
        },
        onStateChange: function (event) {
          if (Number(event && event.data) !== 0) return;
          var data = event.target && typeof event.target.getVideoData === "function"
            ? event.target.getVideoData()
            : {};
          var endedId = data && data.video_id;
          var track = filtered[currentIndex];
          if (!track || !track.youtubeId || endedId !== track.youtubeId) return;
          if (currentIndex >= 0 && currentIndex < filtered.length - 1) playAt(currentIndex + 1);
        }
      }
    });
  }

  function loadEmbed(id) {
    if (!id) return;
    pendingVideoId = id;
    if (ytPlayer && typeof ytPlayer.loadVideoById === "function") {
      ytPlayer.loadVideoById(id);
      return;
    }
    if (frameEl) frameEl.src = embedUrl(id);
    bindYouTubePlayer();
  }

  window.onYouTubeIframeAPIReady = function () {
    bindYouTubePlayer();
  };

  if (window.YT && typeof YT.Player === "function") {
    bindYouTubePlayer();
  }

  function applyRankOne(track) {
    if (!track || Number(track.rank) !== 1) return track;
    track.youtubeId = RANK_ONE_ID;
    return track;
  }

  function filterTracks(query) {
    var q = String(query || "").trim().toLowerCase();
    if (!q) return tracks.slice();
    return tracks.filter(function (track) {
      return (track.title + " " + track.artist).toLowerCase().indexOf(q) !== -1;
    });
  }

  function renderList() {
    if (!listEl) return;
    listEl.innerHTML = "";
    if (!filtered.length) {
      var empty = document.createElement("li");
      empty.className = "charts-empty";
      empty.textContent = "No titles match that search.";
      listEl.appendChild(empty);
      return;
    }
    filtered.forEach(function (track, index) {
      var row = document.createElement("button");
      row.type = "button";
      row.className = "charts-row" + (index === currentIndex ? " is-current" : "");
      row.setAttribute("data-charts-rank", String(track.rank));

      var rank = document.createElement("span");
      rank.className = "charts-rank";
      rank.textContent = String(track.rank);

      var cover = document.createElement("img");
      cover.className = "charts-cover" + (track.youtubeId ? "" : " is-empty");
      cover.alt = "";
      if (track.youtubeId) cover.src = coverUrl(track.youtubeId);

      var meta = document.createElement("span");
      meta.className = "charts-meta";
      var title = document.createElement("span");
      title.className = "charts-title";
      title.textContent = track.title;
      var artist = document.createElement("span");
      artist.className = "charts-artist";
      artist.textContent = track.artist;
      meta.appendChild(title);
      meta.appendChild(artist);

      var play = document.createElement("span");
      play.className = "charts-play";
      play.setAttribute("aria-hidden", "true");
      play.textContent = "▶";

      row.appendChild(rank);
      row.appendChild(cover);
      row.appendChild(meta);
      row.appendChild(play);
      row.addEventListener("click", function () {
        playAt(index);
      });

      var item = document.createElement("li");
      item.appendChild(row);
      listEl.appendChild(item);
    });
  }

  function updatePlayer(track) {
    if (!playerEl || !track) return;
    playerEl.hidden = false;
    if (nowTitle) nowTitle.textContent = track.title;
    if (nowArtist) nowArtist.textContent = track.artist;
    if (nowCover) {
      nowCover.className = "charts-cover" + (track.youtubeId ? "" : " is-empty");
      if (track.youtubeId) nowCover.src = coverUrl(track.youtubeId);
      else nowCover.removeAttribute("src");
    }
    if (track.youtubeId) loadEmbed(track.youtubeId);
    if (prevBtn) prevBtn.disabled = currentIndex <= 0;
    if (nextBtn) nextBtn.disabled = currentIndex < 0 || currentIndex >= filtered.length - 1;
    renderList();
  }

  function resolveId(track) {
    applyRankOne(track);
    if (Number(track.rank) === 1) {
      track.youtubeId = RANK_ONE_ID;
      return Promise.resolve(RANK_ONE_ID);
    }
    if (track.youtubeId) return Promise.resolve(track.youtubeId);
    var key = String(track.rank) + ":" + track.title + ":" + track.artist;
    if (inflight[key]) return inflight[key];
    inflight[key] = fetch("/api/youtube", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: track.title, artist: track.artist }),
    })
      .then(function (res) { return res.json().then(function (body) { return { ok: res.ok, body: body }; }); })
      .then(function (result) {
        var id = result && result.body && result.body.videoId;
        if (!id) throw new Error((result && result.body && result.body.error) || "No video found.");
        track.youtubeId = id;
        return id;
      })
      .finally(function () {
        delete inflight[key];
      });
    return inflight[key];
  }

  function playAt(index) {
    var track = filtered[index];
    if (!track) return;
    currentIndex = index;
    updatePlayer(track);
    resolveId(track)
      .then(function () {
        if (filtered[currentIndex] === track) updatePlayer(track);
      })
      .catch(function () {
        if (nowArtist) nowArtist.textContent = "Could not load this title.";
      });
  }

  function applySearch() {
    var current = filtered[currentIndex];
    filtered = filterTracks(searchEl ? searchEl.value : "");
    currentIndex = current ? filtered.indexOf(current) : -1;
    if (prevBtn) prevBtn.disabled = currentIndex <= 0;
    if (nextBtn) nextBtn.disabled = currentIndex < 0 || currentIndex >= filtered.length - 1;
    renderList();
  }

  if (searchEl) {
    searchEl.addEventListener("input", applySearch);
  }
  if (prevBtn) {
    prevBtn.addEventListener("click", function () {
      if (currentIndex > 0) playAt(currentIndex - 1);
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener("click", function () {
      if (currentIndex >= 0 && currentIndex < filtered.length - 1) playAt(currentIndex + 1);
    });
  }

  var browseEl = document.querySelector("[data-charts-browse]");

  function sameSiteHref(href) {
    if (!href) return "";
    var raw = String(href).trim();
    if (!raw || raw.charAt(0) === "#") return "";
    if (/^(mailto|tel|javascript):/i.test(raw)) return "";
    var link = document.createElement("a");
    link.href = raw;
    var here = document.createElement("a");
    here.href = document.baseURI || "/";
    if (link.protocol !== "http:" && link.protocol !== "https:") return "";
    if (link.origin !== here.origin) return "";
    return link.href;
  }

  function isChartsHref(href) {
    var link = document.createElement("a");
    link.href = href;
    var path = String(link.pathname || "");
    return path === "/charts" || /\/charts\.html$/.test(path);
  }

  function openBrowse(href) {
    if (!browseEl) return;
    if (isChartsHref(href)) {
      browseEl.hidden = true;
      browseEl.removeAttribute("src");
      document.documentElement.classList.remove("is-charts-browse");
      return;
    }
    browseEl.hidden = false;
    browseEl.src = href;
    document.documentElement.classList.add("is-charts-browse");
  }

  document.addEventListener("click", function (event) {
    if (!playerEl || playerEl.hidden) return;
    if (event.defaultPrevented || event.button) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var node = event.target;
    while (node && node !== document && !(node.tagName === "A" && node.getAttribute)) {
      node = node.parentNode;
    }
    if (!node || node.tagName !== "A") return;
    if (playerEl.contains(node) || (browseEl && browseEl.contains(node))) return;
    if (node.getAttribute("download") != null) return;
    if (String(node.getAttribute("target") || "").toLowerCase() === "_blank") return;
    var href = sameSiteHref(node.getAttribute("href"));
    if (!href) return;
    event.preventDefault();
    openBrowse(href);
  }, true);

  fetch(DATA_URL)
    .then(function (res) { return res.json(); })
    .then(function (data) {
      tracks = ((data && data.tracks) || []).map(function (track) {
        return applyRankOne({
          rank: Number(track.rank),
          title: track.title,
          artist: track.artist,
          youtubeId: track.youtubeId || "",
        });
      });
      filtered = tracks.slice();
      renderList();
    });

  var sheetEl = document.querySelector("[data-charts-sheet]");
  var calcOpen = document.querySelector("[data-charts-calc-open]");

  function setSheetOpen(open) {
    if (!sheetEl) return;
    if (open) sheetEl.removeAttribute("hidden");
    else sheetEl.setAttribute("hidden", "");
  }

  if (calcOpen) {
    calcOpen.addEventListener("click", function () {
      setSheetOpen(true);
    });
  }
  if (sheetEl) {
    sheetEl.addEventListener("click", function (event) {
      if (event.target && event.target.getAttribute("data-charts-sheet-close") !== null) {
        setSheetOpen(false);
      }
    });
  }
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") setSheetOpen(false);
  });
})();
