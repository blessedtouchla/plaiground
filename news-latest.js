/* Latest posts for the homepage news strip. Source is the blog index card list. */
(function () {
  var MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

  function decodeText(value) {
    return String(value || "")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  function parseNewsDate(text) {
    var match = String(text || "").trim().match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/);
    if (!match) return -1;
    var month = MONTHS[match[1].slice(0, 3).toLowerCase()];
    if (month == null) return -1;
    var day = Number(match[2]);
    var year = Number(match[3]);
    if (day < 1 || day > 31) return -1;
    return Date.UTC(year, month, day);
  }

  function newsHref(href) {
    var value = String(href || "").trim();
    if (!value) return "/blog";
    if (value.charAt(0) === "/" || value.charAt(0) === "#" || /^[a-z]+:/i.test(value)) return value;
    return "/" + value.replace(/^\.\//, "");
  }

  function postsFromBlogHtml(html) {
    var source = String(html || "");
    var start = source.search(/class=["']tease-grid["']/);
    if (start === -1) return [];
    var end = source.indexOf("</section>", start);
    var chunk = source.slice(start, end === -1 ? source.length : end);
    var re = /<article\b[^>]*>([\s\S]*?)<\/article>/gi;
    var posts = [];
    var match;
    var order = 0;
    while ((match = re.exec(chunk))) {
      var block = match[1];
      var dateMatch = block.match(/<p[^>]*class=["'][^"']*eyebrow[^"']*["'][^>]*>([\s\S]*?)<\/p>/i);
      var linkMatch = block.match(/<h3[^>]*>\s*<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
      if (!linkMatch) continue;
      var date = dateMatch ? decodeText(dateMatch[1]) : "";
      posts.push({
        title: decodeText(linkMatch[2]),
        href: newsHref(linkMatch[1]),
        date: date,
        time: parseNewsDate(date),
        order: order
      });
      order += 1;
    }
    posts.sort(function (a, b) {
      if (a.time !== b.time) return b.time - a.time;
      return a.order - b.order;
    });
    return posts;
  }

  function latestPosts(html, count) {
    return postsFromBlogHtml(html).slice(0, count || 3);
  }

  function isoDate(time) {
    if (typeof time !== "number" || time < 0) return "";
    var d = new Date(time);
    var y = d.getUTCFullYear();
    var m = String(d.getUTCMonth() + 1);
    var day = String(d.getUTCDate());
    if (m.length < 2) m = "0" + m;
    if (day.length < 2) day = "0" + day;
    return y + "-" + m + "-" + day;
  }

  var api = {
    postsFromBlogHtml: postsFromBlogHtml,
    latestPosts: latestPosts,
    newsHref: newsHref,
    parseNewsDate: parseNewsDate,
    isoDate: isoDate
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;

  function render(list, posts) {
    while (list.firstChild) list.removeChild(list.firstChild);
    posts.forEach(function (post) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.setAttribute("href", post.href);
      var time = document.createElement("time");
      var iso = isoDate(post.time);
      if (iso) time.setAttribute("datetime", iso);
      time.textContent = post.date;
      var title = document.createElement("span");
      title.textContent = post.title;
      a.appendChild(time);
      a.appendChild(title);
      li.appendChild(a);
      list.appendChild(li);
    });
  }

  function boot() {
    var section = document.querySelector("[data-home-news]");
    if (!section || !window.fetch) return;
    var list = section.querySelector("[data-home-news-list]");
    if (!list) return;
    window.fetch("/blog.html", { credentials: "same-origin" })
      .then(function (res) {
        if (!res.ok) throw new Error("news");
        return res.text();
      })
      .then(function (html) {
        var posts = latestPosts(html, 3);
        if (!posts.length) return;
        render(list, posts);
        section.hidden = false;
      })
      .catch(function () {});
  }

  if (typeof document !== "undefined" && document.querySelector) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
  }
})();
