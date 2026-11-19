// DistroKid featured-artist DM helper. Client-side only. Does not send the DM.
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PlaiFeatureVerify = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var X_ID = '1466086093';
  var IG_PATH = 'https://ig.me/m/distrokid';
  var X_FALLBACK = 'https://x.com/DistroKid';

  function digits(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function message(upcDigits) {
    return 'Verifying for UPC ' + upcDigits;
  }

  function isUpc(upcDigits) {
    return upcDigits.length === 12 || upcDigits.length === 13;
  }

  function xHref(upcDigits) {
    if (!isUpc(upcDigits)) return X_FALLBACK;
    return 'https://x.com/messages/compose?recipient_id=' + X_ID + '&text=' + encodeURIComponent(message(upcDigits));
  }

  return {
    X_ID: X_ID,
    IG_PATH: IG_PATH,
    X_FALLBACK: X_FALLBACK,
    digits: digits,
    message: message,
    isUpc: isUpc,
    xHref: xHref
  };
});
