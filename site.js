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

  function setupAppMenu() {
    var app = document.body;
    if (!app || !app.classList.contains("app")) return;
    var side = app.querySelector(".side");
    var topbar = app.querySelector(".topbar");
    if (!side || !topbar) return;

    if (!side.id) side.id = "app-menu";

    var toggle = topbar.querySelector(".menu-toggle");
    if (!toggle) {
      toggle = makeToggle();
      toggle.setAttribute("aria-controls", side.id);
      topbar.insertBefore(toggle, topbar.firstChild);
    }

    if (!topbar.querySelector(".logo")) {
      var brand = document.createElement("a");
      var sideLogo = side.querySelector(".logo");
      brand.className = "logo mobile-only-logo";
      brand.href = sideLogo ? (sideLogo.getAttribute("href") || "dashboard.html") : "dashboard.html";
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
      link.addEventListener("click", function () { setOpen(false); });
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
      inner.appendChild(toggle);
    }

    var backdrop = header.querySelector(".public-nav-backdrop");
    if (!backdrop) {
      backdrop = makeBackdrop("public-nav-backdrop");
      header.appendChild(backdrop);
    }

    function isOpen() {
      return header.classList.contains("nav-open");
    }

    function setOpen(open) {
      header.classList.toggle("nav-open", open);
      document.body.classList.toggle("public-nav-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      backdrop.hidden = !open;
    }

    wireToggle(toggle, isOpen, setOpen);
    backdrop.addEventListener("click", function () { setOpen(false); });
    drawer.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () { setOpen(false); });
    });
  }

  setupAppMenu();
  setupPublicMenu();
})();
