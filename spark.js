(function () {
  var spark = window.SparkCore;
  if (!spark || !document.getElementById('spark-app')) return;

  var current = 'trending';
  var newsLane = '';
  var topic = '';
  var headline = '';
  var dailyOpen = false;
  var ask = { feel: '', story: '', keep: '' };
  var picked = null;
  var pack = null;

  function $(id) { return document.getElementById(id); }

  function groups() {
    return spark.GROUPS || [];
  }

  function lanes() {
    var group = groups().filter(function (row) { return row.id === current; })[0];
    var list = group ? group.lanes.slice() : [];
    if (newsLane) return [newsLane];
    return list;
  }

  function askValue(el) {
    if (!el) return '';
    var value = String(el.value || '').trim();
    var hint = String(el.getAttribute('placeholder') || '').trim();
    if (hint && value.toLowerCase() === hint.toLowerCase()) return '';
    return value.slice(0, 280);
  }

  function rememberAsk() {
    var host = $('spark-list');
    if (!host) return;
    ['feel', 'story', 'keep'].forEach(function (key) {
      var el = host.querySelector('[data-spark-ask="' + key + '"]');
      if (el) ask[key] = askValue(el);
    });
    if (picked) {
      picked.feel = ask.feel;
      picked.story = ask.story;
      picked.keep = ask.keep;
    }
  }

  function chip(label, on, onClick) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'sh-chip' + (on ? ' on' : '');
    button.textContent = label;
    button.setAttribute('aria-pressed', on ? 'true' : 'false');
    button.addEventListener('click', function () {
      rememberAsk();
      onClick();
    });
    return button;
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

  function goWrite(item, which) {
    rememberAsk();
    try {
      sessionStorage.setItem('plaiground.sparkPrompt', JSON.stringify({
        id: item.id || '',
        title: item.title || '',
        detail: item.detail || '',
        flip: item.flip || '',
        answer: item.answer || '',
        lane: item.lane || '',
        topic: item.topic || '',
        headline: item.headline || '',
        sourceLabel: item.sourceLabel || '',
        sourceUrl: item.sourceUrl || '',
        which: which === 'flip' ? 'flip' : 'spark',
        feel: ask.feel || '',
        story: ask.story || '',
        keep: ask.keep || '',
      }));
    } catch (err) {}
    window.location.href = '/song-helper';
  }

  function choose(item, which) {
    rememberAsk();
    if (!item) return;
    var blob = [item.title, item.detail, item.flip, item.headline].join(' ');
    if (spark.tragedy(blob)) return;
    var same = picked && picked.id && picked.id === item.id;
    if (!same) ask = { feel: '', story: '', keep: '' };
    picked = {
      id: item.id || '',
      which: which === 'flip' ? 'flip' : 'spark',
      feel: ask.feel,
      story: ask.story,
      keep: ask.keep,
    };
    if (item.topic) topic = item.topic;
    if (item.headline) headline = item.headline;
    if (item.daily) dailyOpen = true;
    paint();
    var panel = document.getElementById('spark-ask');
    if (panel) {
      try { panel.scrollIntoView({ block: 'nearest' }); } catch (err) {}
    }
  }

  function card(item) {
    var article = document.createElement('article');
    article.className = 'spark-card' + (picked && picked.id === item.id ? ' is-picked' : '');
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
    var actions = document.createElement('div');
    actions.className = 'sh-spark-actions';
    var use = document.createElement('button');
    use.type = 'button';
    use.className = 'btn btn-ghost btn-md';
    use.textContent = 'Use this spark';
    use.addEventListener('click', function () { choose(item, 'spark'); });
    actions.appendChild(use);
    if (item.flip) {
      var flip = document.createElement('button');
      flip.type = 'button';
      flip.className = 'btn btn-ghost btn-md';
      flip.textContent = 'Flip the angle';
      flip.addEventListener('click', function () { choose(item, 'flip'); });
      actions.appendChild(flip);
    }
    article.appendChild(actions);
    return article;
  }

  function askPanel() {
    var copy = spark.ASK || {};
    var panel = document.createElement('div');
    panel.className = 'spark-ask';
    panel.id = 'spark-ask';
    var lead = document.createElement('p');
    lead.textContent = copy.lead || 'You can start writing now, or answer a few questions first.';
    var optional = document.createElement('p');
    optional.className = 'sh-help';
    optional.textContent = copy.optional || 'These questions are optional. The more you put in, the more human the draft feels.';
    panel.appendChild(lead);
    panel.appendChild(optional);
    addAsk(panel, 'feel', copy.feel, copy.feelHint);
    addAsk(panel, 'story', copy.story, copy.storyHint);
    addAsk(panel, 'keep', copy.keep, copy.keepHint);
    var start = document.createElement('button');
    start.type = 'button';
    start.className = 'btn btn-purple btn-md';
    start.textContent = copy.startAway || 'Start writing in Song Helper';
    start.addEventListener('click', function () {
      var item = (pack.items || []).filter(function (row) { return picked && row.id === picked.id; })[0];
      if (!item && pack.daily && picked && pack.daily.id === picked.id) item = pack.daily;
      if (!item) return;
      goWrite(item, picked.which);
    });
    panel.appendChild(start);
    return panel;
  }

  function addAsk(parent, key, label, hint) {
    var field = document.createElement('label');
    field.className = 'sh-field';
    var span = document.createElement('span');
    span.textContent = label || key;
    var area = document.createElement('textarea');
    area.className = 'sh-area';
    area.rows = 2;
    area.maxLength = 280;
    area.setAttribute('data-spark-ask', key);
    if (hint) area.placeholder = hint;
    area.value = ask[key] || '';
    area.addEventListener('input', function () { ask[key] = askValue(area); });
    field.appendChild(span);
    field.appendChild(area);
    parent.appendChild(field);
  }

  function paint() {
    if (!pack) return;
    var laneIds = lanes();
    var topics = spark.topicsFor(pack.items || [], laneIds);
    if (topic && !topics.some(function (row) { return row.label === topic; })) {
      topic = '';
      headline = '';
    }
    var heads = spark.headlinesFor(pack.items || [], laneIds, topic);
    if (headline && !heads.some(function (row) { return row.label === headline; })) headline = '';

    var laneHost = $('spark-lanes');
    laneHost.textContent = '';
    groups().forEach(function (group) {
      laneHost.appendChild(chip(group.label, group.id === current, function () {
        current = group.id;
        newsLane = '';
        topic = '';
        headline = '';
        paint();
      }));
    });
    if (current === 'news') {
      var desks = document.createElement('div');
      desks.className = 'sh-modes';
      desks.setAttribute('role', 'group');
      desks.setAttribute('aria-label', 'News desks');
      desks.appendChild(chip('All news', !newsLane, function () {
        newsLane = '';
        topic = '';
        headline = '';
        paint();
      }));
      spark.LANES.filter(function (lane) { return lane.id.indexOf('news-') === 0; }).forEach(function (lane) {
        desks.appendChild(chip(lane.label.replace(/^News · /, ''), newsLane === lane.id, function () {
          newsLane = lane.id;
          topic = '';
          headline = '';
          paint();
        }));
      });
      laneHost.appendChild(desks);
    }

    var banner = $('spark-banner');
    banner.hidden = false;
    banner.textContent = pack.notice || spark.SAMPLE_LABEL;

    var daily = $('spark-daily');
    daily.textContent = '';
    if (pack.daily && !spark.tragedy([pack.daily.title, pack.daily.detail, pack.daily.flip].join(' '))) {
      var dailyBtn = document.createElement('button');
      dailyBtn.type = 'button';
      dailyBtn.className = 'spark-headline' + (dailyOpen ? ' on' : '');
      dailyBtn.setAttribute('aria-expanded', dailyOpen ? 'true' : 'false');
      dailyBtn.textContent = pack.daily.headline || pack.daily.title || 'Daily spark';
      dailyBtn.addEventListener('click', function () {
        rememberAsk();
        dailyOpen = !dailyOpen;
        paint();
      });
      daily.appendChild(dailyBtn);
      if (dailyOpen) daily.appendChild(card(pack.daily));
    }

    var list = $('spark-list');
    list.textContent = '';
    var topicLabel = document.createElement('h3');
    topicLabel.className = 'sh-subhead';
    topicLabel.textContent = (spark.BROWSE && spark.BROWSE.topics) || 'Topics';
    list.appendChild(topicLabel);
    if (!topics.length) {
      var empty = document.createElement('p');
      empty.className = 'sh-help';
      empty.textContent = (spark.BROWSE && spark.BROWSE.empty) || 'Nothing in this lane right now.';
      list.appendChild(empty);
    } else {
      var topicRow = document.createElement('div');
      topicRow.className = 'sh-modes';
      topicRow.setAttribute('role', 'group');
      topicRow.setAttribute('aria-label', 'Topics');
      topics.forEach(function (row) {
        topicRow.appendChild(chip(row.label, topic === row.label, function () {
          topic = row.label;
          headline = '';
          paint();
        }));
      });
      list.appendChild(topicRow);
    }
    if (!topic) {
      var pickTopic = document.createElement('p');
      pickTopic.className = 'sh-help';
      pickTopic.textContent = (spark.BROWSE && spark.BROWSE.pickTopic) || 'Pick a topic.';
      list.appendChild(pickTopic);
    } else {
      var headLabel = document.createElement('h3');
      headLabel.className = 'sh-subhead';
      headLabel.textContent = (spark.BROWSE && spark.BROWSE.headlines) || 'Headlines';
      list.appendChild(headLabel);
      var headRow = document.createElement('div');
      headRow.className = 'spark-headlines';
      headRow.setAttribute('role', 'group');
      headRow.setAttribute('aria-label', 'Headlines');
      heads.forEach(function (row) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'spark-headline' + (headline === row.label ? ' on' : '');
        button.setAttribute('aria-expanded', headline === row.label ? 'true' : 'false');
        button.textContent = row.label;
        button.addEventListener('click', function () {
          rememberAsk();
          headline = row.label;
          paint();
        });
        headRow.appendChild(button);
      });
      list.appendChild(headRow);
      if (!headline) {
        var pickHead = document.createElement('p');
        pickHead.className = 'sh-help';
        pickHead.textContent = (spark.BROWSE && spark.BROWSE.pickHeadline) || 'Pick a headline.';
        list.appendChild(pickHead);
      } else {
        spark.sparksFor(pack.items || [], laneIds, topic, headline).forEach(function (item) {
          list.appendChild(card(item));
        });
      }
    }
    if (picked) list.appendChild(askPanel());
  }

  async function load() {
    pack = spark.pack();
    try {
      var response = await fetch('/api/spark');
      if (response.ok) {
        var data = await response.json();
        if (data && data.items) pack = data;
      }
    } catch (err) {}
    paint();
  }

  load();
}());
