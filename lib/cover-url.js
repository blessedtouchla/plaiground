/**
 * Pick a paint-able cover URL from a catalog / store release row.
 * Accepts the usual flat fields and nested { url } objects. No dummy art.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PlaigroundCoverUrl = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function isHttpUrl(value) {
    return /^https?:\/\//i.test(value);
  }

  function isPaintUrl(value) {
    return isHttpUrl(value) || /^blob:/i.test(value) || /^data:image\//i.test(value);
  }

  function fromValue(value, depth) {
    if (value == null || depth > 4) return '';
    if (typeof value === 'string') {
      var text = value.trim();
      return isPaintUrl(text) ? text : '';
    }
    if (typeof value !== 'object') return '';
    if (Array.isArray(value)) {
      var i;
      for (i = 0; i < value.length; i += 1) {
        var item = fromValue(value[i], depth + 1);
        if (item) return item;
      }
      return '';
    }
    return fromValue(
      value.url
        || value.src
        || value.href
        || value.artwork_url
        || value.cover_art_url
        || value.cover_url
        || value.image_url
        || value.image,
      depth + 1
    );
  }

  function from(row) {
    if (!row || typeof row !== 'object') return '';
    var keys = [
      'artwork_url',
      'cover_art_url',
      'cover_url',
      'image_url',
      'artwork',
      'cover',
      'image',
      'cover_art',
      'art',
      'images',
    ];
    var i;
    for (i = 0; i < keys.length; i += 1) {
      var got = fromValue(row[keys[i]], 0);
      if (got) return got;
    }
    if (row.release && row.release !== row) {
      var nested = from(row.release);
      if (nested) return nested;
    }
    if (row.data && row.data !== row && !Array.isArray(row.data)) {
      var data = from(row.data);
      if (data) return data;
    }
    return '';
  }

  function stored(row) {
    var url = from(row);
    return isHttpUrl(url) ? url : '';
  }

  return {
    from: from,
    stored: stored,
    isHttpUrl: isHttpUrl,
    isPaintUrl: isPaintUrl,
  };
});
