(function () {
  var spark = window.SparkCore;
  if (!spark || !document.getElementById('spark-app')) return;

  var current = 'trending';

  function $(id) { return document.getElementById(id); }

  function card(item) {
    var article = document.createElement('article');
    article.className = 'spark-card';
    var title = document.createElement('h3');
    title.textContent = item.title;
    var detail = document.createElement('p');
    detail.textContent = item.detail;
    var source = document.createElement('p');
    source.className = 'spark-source';
    if (item.sourceUrl) {
      var link = document.createElement('a');
      link.href = item.sourceUrl;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = item.sourceLabel || item.sourceUrl;
      source.appendChild(link);
    } else {
      source.textContent = item.sourceLabel || spark.SAMPLE_LABEL;
    }
    article.appendChild(title);
    article.appendChild(detail);
    article.appendChild(source);
    addBlock(article, 'Flip the angle', item.flip);
    addBlock(article, 'Answer song', item.answer);
    if (item.cause) addBlock(article, 'Cause drop', item.cause);
    if (item.dailyNote) {
      var note = document.createElement('p');
      note.className = 'spark-source';
      note.textContent = item.dailyNote;
      article.appendChild(note);
    }
    var use = document.createElement('button');
    use.type = 'button';
    use.className = 'btn btn-ghost btn-md';
    use.textContent = 'Use this in Song Helper';
    use.addEventListener('click', function () {
      try {
        sessionStorage.setItem('plaiground.sparkPrompt', JSON.stringify({
          title: item.title,
          flip: item.flip,
          answer: item.answer,
        }));
      } catch (err) {}
      window.location.href = '/song-helper';
    });
    article.appendChild(use);
    return article;
  }

  function addBlock(parent, label, text) {
    if (!text) return;
    var p = document.createElement('p');
    var strong = document.createElement('strong');
    strong.textContent = label + ': ';
    p.appendChild(strong);
    p.appendChild(document.createTextNode(text));
    parent.appendChild(p);
  }

  function paint(pack) {
    var lanes = $('spark-lanes');
    lanes.textContent = '';
    (pack.lanes || spark.LANES).forEach(function (lane) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'sh-chip' + (lane.id === current ? ' on' : '');
      button.textContent = lane.label;
      button.addEventListener('click', function () {
        current = lane.id;
        paint(pack);
      });
      lanes.appendChild(button);
    });
    var banner = $('spark-banner');
    banner.hidden = false;
    banner.textContent = pack.notice || spark.SAMPLE_LABEL;
    var daily = $('spark-daily');
    daily.textContent = '';
    if (pack.daily) daily.appendChild(card(pack.daily));
    var list = $('spark-list');
    list.textContent = '';
    (pack.items || []).filter(function (item) { return item.lane === current; }).forEach(function (item) {
      list.appendChild(card(item));
    });
    if (!list.children.length) {
      var empty = document.createElement('p');
      empty.className = 'sh-help';
      empty.textContent = 'No items in this lane.';
      list.appendChild(empty);
    }
  }

  async function load() {
    var pack = spark.pack();
    try {
      var response = await fetch('/api/spark');
      if (response.ok) {
        var data = await response.json();
        if (data && data.items) pack = data;
      }
    } catch (err) {}
    paint(pack);
  }

  load();
}());
