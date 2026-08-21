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
})();
