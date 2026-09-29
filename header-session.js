/* Paints signed-in header state before first paint.
   Keep keys and TTLs aligned with membership.js (plaigroundSignedIn,
   plaigroundSignedInAt, plaigroundRemember, plaiground_signed, plaiground_session). */
(function () {
  var root = document.documentElement;
  if (!root || typeof root.setAttribute !== "function") return;

  function read(store, key) {
    try {
      return store ? (store.getItem(key) || "") : "";
    } catch (err) {
      return "";
    }
  }

  function pick(key) {
    return read(window.localStorage, key) || read(window.sessionStorage, key);
  }

  function hasSessionCookie() {
    var parts;
    var i;
    var piece;
    var eq;
    var name;
    var value;
    try {
      parts = String(document.cookie || "").split(";");
    } catch (err) {
      return false;
    }
    for (i = 0; i < parts.length; i += 1) {
      piece = String(parts[i] || "").replace(/^\s+/, "");
      eq = piece.indexOf("=");
      if (eq <= 0) continue;
      name = piece.slice(0, eq);
      value = piece.slice(eq + 1);
      if ((name === "plaiground_session" || name === "plaiground_signed") && value) return true;
    }
    return false;
  }

  function storageSaysSignedIn() {
    var flag = String(pick("plaigroundSignedIn") || "").toLowerCase();
    var at;
    var remember;
    var ttl;
    if (flag !== "1" && flag !== "true" && flag !== "yes") return false;
    at = Number(pick("plaigroundSignedInAt") || 0);
    if (!at) return true;
    remember = String(pick("plaigroundRemember") || "").toLowerCase();
    ttl = (remember === "1" || remember === "true" || remember === "yes")
      ? 30 * 24 * 60 * 60 * 1000
      : 30 * 60 * 1000;
    return (Date.now() - at) <= ttl;
  }

  try {
    if (hasSessionCookie() || storageSaysSignedIn()) root.setAttribute("data-signed-in", "1");
  } catch (err) {}
})();
