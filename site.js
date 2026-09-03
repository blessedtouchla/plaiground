(function () {
  var filters = document.querySelectorAll("[data-faq-filter]");
  var groups = document.querySelectorAll("[data-faq-group]");
  var items = document.querySelectorAll(".faq-item");

  filters.forEach(function (button) {
    button.addEventListener("click", function () {
      var key = button.getAttribute("data-faq-filter");
      filters.forEach(function (el) { el.classList.toggle("on", el === button); });
      groups.forEach(function (group) {
        var show = key === "all" || group.getAttribute("data-faq-group") === key;
        group.hidden = !show;
      });
    });
  });

  items.forEach(function (item) {
    var trigger = item.querySelector(".q");
    if (!trigger) return;
    trigger.addEventListener("click", function () {
      var open = item.classList.contains("open");
      items.forEach(function (other) { other.classList.remove("open"); });
      if (!open) item.classList.add("open");
    });
  });

  function makeToggle(extraClass) {
    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = extraClass ? "menu-toggle " + extraClass : "menu-toggle";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open menu");
    toggle.innerHTML = '<span class="menu-toggle-bars" aria-hidden="true"></span><span class="menu-toggle-text">Menu</span>';
    return toggle;
  }

  function makeBackdrop(className) {
    var backdrop = document.createElement("div");
    backdrop.className = className;
    backdrop.hidden = true;
    return backdrop;
  }

  function wireToggle(toggle, isOpen, setOpen) {
    toggle.addEventListener("click", function (event) {
      event.preventDefault();
      setOpen(!isOpen());
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") setOpen(false);
    });
  }

  function isPhoneAppMenu() {
    return !!(window.matchMedia && window.matchMedia("(max-width: 980px)").matches);
  }

  function isOverviewHomeLink(link) {
    if (!link || !link.closest) return false;
    if (!link.closest("[data-overview-menu]")) return false;
    return hrefFile(link.getAttribute("href")) === "dashboard.html";
  }

  function setupOverviewSubmenu(side) {
    if (!side || !side.querySelector) return;
    var item = side.querySelector("[data-overview-menu]");
    if (!item || item.getAttribute("data-submenu-wired") === "1") return;
    var toggle = item.querySelector(".side-submenu-toggle");
    var overview = item.querySelector(".side-item-row a[href]");
    var submenu = item.querySelector(".side-submenu");
    if (!toggle || !submenu) return;
    item.setAttribute("data-submenu-wired", "1");

    function setSubmenuOpen(open) {
      item.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Hide Overview pages" : "Show Overview pages");
    }

    if (item.classList.contains("open") || item.classList.contains("is-current") || submenu.querySelector("a.on")) {
      item.classList.add("is-current");
      setSubmenuOpen(true);
    }

    toggle.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      setSubmenuOpen(!item.classList.contains("open"));
    });

    if (overview) {
      overview.addEventListener("click", function (event) {
        var drawerOpen = !!(document.body && document.body.classList && document.body.classList.contains("nav-open"));
        if (!drawerOpen && !isPhoneAppMenu()) return;
        event.preventDefault();
        event.stopPropagation();
        setSubmenuOpen(!item.classList.contains("open"));
      });
    }
  }

  function setupAppMenu() {
    var app = document.body;
    if (!app || !app.classList.contains("app")) return;
    var side = app.querySelector(".side");
    var topbar = app.querySelector(".topbar");
    if (!side || !topbar) return;

    if (!side.id) side.id = "app-menu";

    var page = "";
    try {
      page = String((window.location && window.location.pathname) || "").split("/").pop();
    } catch (err) {}
    if (page === "publishing-register.html" || page === "publishing.html") {
      side.querySelectorAll("[data-publishing-register]").forEach(function (el) {
        el.classList.add("on");
      });
    }
    var overviewPages = {
      "dashboard.html": 1,
      "releases.html": 1,
      "song.html": 1,
      "library.html": 1,
      "splits.html": 1,
      "splits-empty.html": 1,
      "publishing-register.html": 1,
      "publishing.html": 1,
      "earnings.html": 1,
      "analytics.html": 1,
      "payouts.html": 1
    };
    if (overviewPages[page]) {
      var overviewMenu = side.querySelector("[data-overview-menu]");
      if (overviewMenu) overviewMenu.classList.add("open", "is-current");
    }
    setupOverviewSubmenu(side);
    setupAppBlogLink(side);

    var toggle = topbar.querySelector(".menu-toggle");
    if (!toggle) {
      toggle = makeToggle();
      toggle.setAttribute("aria-controls", side.id);
      topbar.insertBefore(toggle, topbar.firstChild);
    }

    if (!topbar.querySelector(".logo")) {
      var brand = document.createElement("a");
      brand.className = "logo mobile-only-logo";
      brand.href = brandHomeHref(isSignedInPublic());
      brand.setAttribute("aria-label", "PLAIGROUND");
      brand.innerHTML = '<img src="assets/plaiground-logo.png" alt="PLAIGROUND" />';
      topbar.insertBefore(brand, toggle.nextSibling);
    }

    var backdrop = app.querySelector(".app-nav-backdrop");
    if (!backdrop) {
      backdrop = makeBackdrop("app-nav-backdrop");
      app.insertBefore(backdrop, app.firstChild);
    }

    function isOpen() {
      return app.classList.contains("nav-open");
    }

    function setOpen(open) {
      app.classList.toggle("nav-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      backdrop.hidden = !open;
    }

    wireToggle(toggle, isOpen, setOpen);
    backdrop.addEventListener("click", function () { setOpen(false); });
    side.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        if (isOverviewHomeLink(link) && (isOpen() || isPhoneAppMenu())) return;
        setOpen(false);
      });
    });
  }

  function setupPublicMenu() {
    var header = document.querySelector("header.nav");
    if (!header || document.body.classList.contains("app")) return;
    var inner = header.querySelector(".nav-inner");
    var links = header.querySelector(".nav-links");
    var actions = header.querySelector(".nav-actions");
    if (!inner || (!links && !actions)) return;

    var drawer = inner.querySelector(".nav-drawer");
    if (!drawer) {
      drawer = document.createElement("div");
      drawer.className = "nav-drawer";
      if (links) drawer.appendChild(links);
      if (actions) drawer.appendChild(actions);
      inner.appendChild(drawer);
    }

    var toggle = inner.querySelector(".menu-toggle");
    if (!toggle) {
      toggle = makeToggle("public-menu-toggle");
      toggle.setAttribute("aria-controls", "public-menu");
      drawer.id = drawer.id || "public-menu";
    }
    setupPublicHeaderLogin(header, inner, drawer, toggle);

    var backdrop = header.querySelector(".public-nav-backdrop");
    if (!backdrop) {
      backdrop = makeBackdrop("public-nav-backdrop");
      header.appendChild(backdrop);
    }

    setupPublicPlansMenu(links);
    setupPublicBlogLink(links);

    function isOpen() {
      return header.classList.contains("nav-open");
    }

    function setOpen(open) {
      header.classList.toggle("nav-open", open);
      document.body.classList.toggle("public-nav-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      backdrop.hidden = !open;
      if (!open && links) {
        links.querySelectorAll(".nav-item.has-submenu.open").forEach(function (item) {
          setSubmenuOpen(item, false);
        });
      }
    }

    wireToggle(toggle, isOpen, setOpen);
    backdrop.addEventListener("click", function () { setOpen(false); });
    drawer.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () { setOpen(false); });
    });
  }

  function isSignedInPublic() {
    var api = window.PlaigroundMembership;
    return !!(api && typeof api.isSignedIn === "function" && api.isSignedIn());
  }

  function brandHomeHref(signedIn) {
    if (!signedIn) return "index.html";
    var api = window.PlaigroundMembership;
    if (api && typeof api.signedInHome === "function") return api.signedInHome();
    return "dashboard.html";
  }

  function eachHeaderBrandLogo(fn) {
    var header = document.querySelector("header.nav");
    var side = document.querySelector(".side");
    var topbar = document.querySelector(".topbar");
    [header, side, topbar].forEach(function (root) {
      if (!root) return;
      root.querySelectorAll(".logo").forEach(fn);
    });
  }

  function goBrandHome(event) {
    if (event && typeof event.preventDefault === "function") event.preventDefault();
    var href = brandHomeHref(isSignedInPublic());
    try {
      window.location.href = href;
    } catch (err) {}
  }

  function wireBrandLogo(logo) {
    if (!logo || logo.tagName !== "A" || logo.getAttribute("data-brand-home") === "1") return;
    logo.setAttribute("data-brand-home", "1");
    if (!logo.getAttribute("aria-label")) logo.setAttribute("aria-label", "PLAIGROUND");
    logo.addEventListener("click", goBrandHome);
  }

  function setupBrandLogos() {
    function sync() {
      var href = brandHomeHref(isSignedInPublic());
      eachHeaderBrandLogo(function (logo) {
        wireBrandLogo(logo);
        logo.setAttribute("href", href);
        logo.href = href;
      });
    }
    sync();
    var api = window.PlaigroundMembership;
    if (api && typeof api.whenReady === "function") api.whenReady(sync);
  }

  function existingPublicLogin(header) {
    return header.querySelector(".public-header-login") ||
      header.querySelector(".nav-actions a.login") ||
      header.querySelector("a.login[href]");
  }

  function makePublicLogin() {
    var login = document.createElement("a");
    login.className = "login public-header-login";
    login.href = "login.html";
    login.textContent = "Log in";
    return login;
  }

  function setupPublicHeaderLogin(header, inner, drawer, toggle) {
    var tools = inner.querySelector(".public-header-tools");
    if (!tools) {
      tools = document.createElement("div");
      tools.className = "public-header-tools";
    }

    var login = existingPublicLogin(header);
    if (login) {
      login.classList.add("public-header-login");
    } else {
      login = makePublicLogin();
    }

    header.querySelectorAll("a.login").forEach(function (el) {
      if (el !== login && el.parentNode) el.parentNode.removeChild(el);
    });

    if (login.parentNode !== tools) tools.appendChild(login);
    if (toggle && toggle.parentNode !== tools) tools.appendChild(toggle);
    if (tools.parentNode !== inner) inner.insertBefore(tools, drawer);

    function syncSignedIn() {
      var signedIn = isSignedInPublic();
      login.hidden = !!signedIn;
      tools.classList.toggle("is-signed-in", signedIn);
    }
    syncSignedIn();
    var api = window.PlaigroundMembership;
    if (api && typeof api.whenReady === "function") api.whenReady(syncSignedIn);
  }

  function hrefFile(href) {
    if (!href) return "";
    var path = href.split("?")[0].split("#")[0];
    var parts = path.split("/");
    return parts[parts.length - 1] || "";
  }

  function setSubmenuOpen(item, open) {
    if (!item) return;
    var chevron = item.querySelector(".nav-submenu-toggle");
    item.classList.toggle("open", open);
    if (chevron) {
      chevron.setAttribute("aria-expanded", open ? "true" : "false");
      chevron.setAttribute("aria-label", open ? "Hide Basic, Creator, and Pro" : "Show Basic, Creator, and Pro");
    }
  }

  function wirePlansSubmenu(item) {
    if (!item || item.getAttribute("data-submenu-wired") === "1") return;
    var chevron = item.querySelector(".nav-submenu-toggle");
    if (!chevron) return;
    item.setAttribute("data-submenu-wired", "1");
    chevron.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      setSubmenuOpen(item, !item.classList.contains("open"));
    });
    document.addEventListener("click", function (event) {
      if (!item.contains(event.target)) setSubmenuOpen(item, false);
    });
  }

  function isBlogHref(href) {
    var file = hrefFile(href);
    return file === "blog.html" || file === "blog" || file === "/blog";
  }

  function isBlogPage() {
    var page = hrefFile((window.location && window.location.pathname) || "");
    return page === "blog.html" || page.indexOf("blog-") === 0 || page === "blog";
  }

  function linkText(el) {
    return String((el && el.textContent) || "").replace(/\s+/g, " ").trim();
  }

  function findNavSiqa(root) {
    if (!root || !root.querySelectorAll) return null;
    var links = root.querySelectorAll("a[href]");
    var i;
    var el;
    var href;
    var file;
    var text;
    for (i = 0; i < links.length; i += 1) {
      el = links[i];
      if (el.classList && el.classList.contains("nav-siqa")) return el;
    }
    for (i = 0; i < links.length; i += 1) {
      el = links[i];
      href = el.getAttribute("href") || "";
      file = hrefFile(href);
      if (file === "charts" || file === "charts.html" || href === "/charts" || href === "/charts.html") return el;
    }
    for (i = 0; i < links.length; i += 1) {
      el = links[i];
      text = linkText(el);
      if (/SIQA/i.test(text)) return el;
    }
    return null;
  }

  function findNavBlog(root) {
    if (!root || !root.querySelectorAll) return null;
    var links = root.querySelectorAll("a[href]");
    var i;
    var el;
    var href;
    var file;
    var text;
    for (i = 0; i < links.length; i += 1) {
      el = links[i];
      href = el.getAttribute("href") || "";
      file = hrefFile(href);
      if (isBlogHref(href) || file === "blog.html" || file === "blog") return el;
    }
    for (i = 0; i < links.length; i += 1) {
      el = links[i];
      text = linkText(el);
      if (text === "Blog") return el;
    }
    return null;
  }

  function setupPublicBlogLink(links) {
    if (!links) return;
    var blog = findNavBlog(links);
    if (!blog) {
      blog = document.createElement("a");
      blog.href = "blog.html";
      blog.textContent = "Blog";
    }
    if (isBlogPage()) blog.classList.add("active");
    if (blog.parentNode) blog.parentNode.removeChild(blog);
    if (links.firstElementChild) links.insertBefore(blog, links.firstElementChild);
    else links.appendChild(blog);
    var siqa = findNavSiqa(links);
    if (siqa && links.lastElementChild !== siqa) links.appendChild(siqa);
  }

  function setupAppBlogLink(side) {
    if (!side || !side.querySelector) return;
    var nav = side.querySelector(".side-nav");
    if (!nav) return;
    var blog = findNavBlog(nav);
    if (!blog) {
      blog = document.createElement("a");
      blog.href = "blog.html";
      blog.textContent = "Blog";
    }
    if (isBlogPage()) blog.classList.add("on");
    if (blog.parentNode) blog.parentNode.removeChild(blog);
    var after = nav.querySelector("a.side-action[data-new-release]") || nav.querySelector("a.side-action") || nav.querySelector("[data-new-release]");
    if (after && after.parentNode === nav) {
      var ref = after.nextElementSibling;
      if (ref) nav.insertBefore(blog, ref);
      else nav.appendChild(blog);
    } else if (nav.firstElementChild) {
      nav.insertBefore(blog, nav.firstElementChild);
    } else {
      nav.appendChild(blog);
    }
    var siqa = findNavSiqa(nav);
    if (siqa && nav.lastElementChild !== siqa) nav.appendChild(siqa);
  }

  function setupPublicPlansMenu(links) {
    if (!links) return;
    var existing = links.querySelector(".nav-item.has-submenu");
    if (existing) {
      wirePlansSubmenu(existing);
      return;
    }

    var pricing = null;
    var basic = null;
    var creator = null;
    var pro = null;
    Array.prototype.forEach.call(links.children, function (el) {
      if (!el || el.tagName !== "A") return;
      var href = el.getAttribute("href") || "";
      var file = hrefFile(href);
      var text = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (href.indexOf("#pricing") !== -1 && /plans and pricing|pricing/i.test(text)) {
        pricing = el;
      } else if (file === "basic.html") {
        basic = el;
      } else if (file === "creator.html") {
        creator = el;
      } else if (file === "pro.html") {
        pro = el;
      }
    });
    if (!pricing || !basic || !creator || !pro) return;

    var item = document.createElement("div");
    item.className = "nav-item has-submenu";
    var row = document.createElement("div");
    row.className = "nav-item-row";
    var chevron = document.createElement("button");
    chevron.type = "button";
    chevron.className = "nav-submenu-toggle";
    chevron.setAttribute("aria-expanded", "false");
    chevron.setAttribute("aria-label", "Show Basic, Creator, and Pro");
    chevron.innerHTML = '<span class="nav-submenu-chevron" aria-hidden="true"></span>';
    var submenu = document.createElement("div");
    submenu.className = "nav-submenu";
    submenu.id = "public-plans-submenu";
    chevron.setAttribute("aria-controls", "public-plans-submenu");

    links.insertBefore(item, pricing);
    row.appendChild(pricing);
    row.appendChild(chevron);
    item.appendChild(row);
    submenu.appendChild(basic);
    submenu.appendChild(creator);
    submenu.appendChild(pro);
    item.appendChild(submenu);

    if (basic.classList.contains("active") || creator.classList.contains("active") || pro.classList.contains("active")) {
      item.classList.add("is-current");
      pricing.classList.add("active");
    }

    wirePlansSubmenu(item);
  }

  var PUBLIC_SOCIALS_HTML =
    '<a href="https://www.facebook.com/profile.php?id=61593116849937" target="_blank" rel="noopener" aria-label="Facebook" title="Facebook">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z"/></svg>' +
    '</a>' +
    '<a href="https://www.instagram.com/plaigroundmusic" target="_blank" rel="noopener" aria-label="Instagram" title="Instagram">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zm10 2H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm-5 3.2A3.8 3.8 0 1 1 8.2 12 3.8 3.8 0 0 1 12 8.2zm0 2A1.8 1.8 0 1 0 13.8 12 1.8 1.8 0 0 0 12 10.2zM17.2 6.6a.9.9 0 1 1-.9.9.9.9 0 0 1 .9-.9z"/></svg>' +
    '</a>';

  function setupPublicSocials() {
    document.querySelectorAll(".socials").forEach(function (el) {
      el.innerHTML = PUBLIC_SOCIALS_HTML;
    });
  }

  function setupSignedInPublicAppChrome() {
    var header = document.querySelector("header.nav");
    var side = document.querySelector(".side");
    var topbar = document.querySelector(".topbar");
    if (!header || !side || !topbar) return;

    function apply(signedIn) {
      document.body.classList.toggle("app", signedIn);
      side.hidden = !signedIn;
      topbar.hidden = !signedIn;
      header.hidden = !!signedIn;
      var footer = document.querySelector("footer");
      if (footer) footer.hidden = !!signedIn;
      if (signedIn) setupAppMenu();
    }

    apply(isSignedInPublic());
    var api = window.PlaigroundMembership;
    if (api && typeof api.whenReady === "function") {
      api.whenReady(function () { apply(isSignedInPublic()); });
    }
  }

  function loadProblemChrome() {
    var doc = document;
    if (!doc) return;
    if (doc.body && doc.body.classList && doc.body.classList.contains("app") === false) {
      if (!doc.querySelector || !doc.querySelector(".side-nav, .flow-top, [data-problem-form]")) return;
    }
    function start() {
      if (window.PlaigroundProblem && typeof window.PlaigroundProblem.mount === "function") {
        window.PlaigroundProblem.mount();
      }
    }
    if (window.PlaigroundProblem) {
      start();
      return;
    }
    var existing = doc.querySelector && doc.querySelector('script[src="problem.js"]');
    if (existing) {
      if (existing.addEventListener) existing.addEventListener("load", start);
      return;
    }
    if (!doc.createElement) return;
    var script = doc.createElement("script");
    script.src = "problem.js";
    script.onload = start;
    var parent = doc.body || doc.documentElement;
    if (parent && parent.appendChild) parent.appendChild(script);
  }

  setupSignedInPublicAppChrome();
  setupAppMenu();
  setupPublicMenu();
  setupPublicSocials();
  setupBrandLogos();
  loadProblemChrome();

  var PUBLIC_PIXEL_PAGES = {
    "": true,
    "index.html": true,
    "about.html": true,
    "how.html": true,
    "how-it-works.html": true,
    "faq.html": true,
    "contact.html": true,
    "basic.html": true,
    "creator.html": true,
    "pro.html": true,
    "signup.html": true,
    "login.html": true,
    "forgot.html": true,
    "magic.html": true,
    "confirm.html": true,
    "confirmed.html": true,
    "terms.html": true,
    "privacy.html": true,
    "rights.html": true,
    "cowriter.html": true,
    "publishing.html": true,
    "publishing-confirm.html": true,
    "blog.html": true,
    "blog": true,
    "blog-welcome.html": true,
    "welcome": true,
    "blog-first-release.html": true,
    "first-release": true,
    "blog-meet-plai.html": true,
    "meet-plai": true,
    "blog-meet-siva.html": true,
    "meet-siva": true,
    "blog-what-a-human-did.html": true,
    "what-a-human-did": true
  };

  function pixelPageFile() {
    var file = String((window.location && window.location.pathname) || "").split("/").pop() || "index.html";
    if (!file || file === "/") file = "index.html";
    return file.toLowerCase();
  }

  function isPublicPixelPage() {
    return !!PUBLIC_PIXEL_PAGES[pixelPageFile()];
  }

  function pixelIdOk(value) {
    return /^\d{5,20}$/.test(String(value || "").trim());
  }

  window.PlaigroundPixel = {
    id: "",
    ready: false,
    q: [],
    track: function (name) {
      var eventName = String(name || "").trim();
      if (eventName !== "CompleteRegistration") return;
      if (window.fbq && this.ready) {
        window.fbq("track", eventName);
        return;
      }
      this.q.push(eventName);
    }
  };

  function consumeSignupPixel() {
    try {
      if (window.sessionStorage && window.sessionStorage.getItem("plaigroundCompleteRegistration") === "1") {
        window.PlaigroundPixel.track("CompleteRegistration");
        window.sessionStorage.removeItem("plaigroundCompleteRegistration");
      }
    } catch (err) {}
  }

  function injectMetaPixel(id) {
    if (!pixelIdOk(id)) return;
    if (window.fbq) return;
    window.PlaigroundPixel.id = id;
    (function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = !0;
      n.version = "2.0";
      n.queue = [];
      t = b.createElement(e);
      t.async = !0;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      if (s && s.parentNode) s.parentNode.insertBefore(t, s);
    })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    window.fbq("init", id);
    window.PlaigroundPixel.ready = true;
    if (isPublicPixelPage()) window.fbq("track", "PageView");
    consumeSignupPixel();
    window.PlaigroundPixel.q.forEach(function (name) {
      window.fbq("track", name);
    });
    window.PlaigroundPixel.q = [];
  }

  function loadMetaPixel() {
    if (!window.fetch) return;
    fetch("/api/auth/pixel", { credentials: "same-origin", headers: { Accept: "application/json" } })
      .then(function (res) {
        return res.json().catch(function () { return {}; });
      })
      .then(function (data) {
        var id = data && data.pixel_id;
        if (pixelIdOk(id)) injectMetaPixel(id);
      })
      .catch(function () {});
  }

  loadMetaPixel();
})();
