(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PlaigroundContracts = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  var DISCLAIMER = 'General info, not legal advice. Have a lawyer review before signing anything big.';
  var PAY_LINE = 'Pay per use. Victoria will set the amount.';
  var TEXT_KEY = 'plaigroundContractText';

  var TYPES = [
    { id: 'split', lane: 'both', title: 'Split sheet', what: 'A note of who wrote the song and what share each person keeps.', fair: 'Every writer is named, and the shares add up.', watch: 'A missing name, or a share that quietly moves to someone else.' },
    { id: 'beat', lane: 'both', title: 'Producer / beat lease', what: 'Permission to use a beat. Non-exclusive means others can lease it too. Exclusive means just you, for the use you name.', fair: 'You know which one it is, what you can release, and that you keep your song.', watch: 'A lease that quietly becomes ownership of your master or your publishing.' },
    { id: 'feature', lane: 'both', title: 'Feature agreement', what: 'A guest vocal or verse on someone else\'s song, or yours on theirs.', fair: 'Each person keeps their own part, with a named credit and a named share.', watch: 'Giving away your verse, your name, or the whole song to get the feature.' },
    { id: 'management', lane: 'both', title: 'Management', what: 'Someone helps run the career and gets a commission on money they help bring in.', fair: 'A short term, a commission only on what they actually book, and a way to leave.', watch: 'A cut of everything you ever earn, with no end date.' },
    { id: 'booking', lane: 'human', title: 'Booking / performance', what: 'The deal for a live show: fee, date, and what the room provides.', fair: 'You are paid for the show, and you can cancel if the date falls through.', watch: 'A booking cut that also takes your merch, your records, or future shows.' },
    { id: 'recording', lane: 'both', title: 'Recording / label', what: 'A company helps put the recording out, usually for a license or a term.', fair: 'You keep the song. Their right to release it is named, and it ends.', watch: 'They own the master forever, or they recoup from money that is not this record.' },
    { id: 'publishing', lane: 'both', title: 'Publishing / admin', what: 'Someone registers and collects publishing, or administers it for you.', fair: 'You keep the copyright. They collect for a named term, then it comes back.', watch: 'An admin deal that assigns the song, or a term you cannot leave.' },
    { id: 'distribution', lane: 'both', title: 'Distribution', what: 'Someone delivers the song to stores.', fair: 'You keep the song and the royalties. Delivery is separate from ownership.', watch: 'A distributor that also takes publishing, neighbors, or the right to sign you elsewhere.' },
    { id: 'sync', lane: 'both', title: 'Sync license', what: 'Permission for a film, show, game, or ad to use the song.', fair: 'One named use, one territory, one length. You keep the song.', watch: 'A sync deal that takes all future uses, or your writer\'s share, with no placement promise.' },
    { id: 'wfh', lane: 'both', title: 'Work for hire', what: 'A deal where the buyer is treated as the author. That is a big give.', fair: 'Use it only when the work truly is hired, the fee is named by you, and the scope is one job.', watch: 'Work for hire language dropped into a feature, a session, or a beat lease.' },
    { id: 'band', lane: 'human', title: 'Band / partnership', what: 'How the group owns the name, the songs, and the money.', fair: 'Shares are written down, and someone leaving knows what they take.', watch: 'One member owning the name, or a leave that erases someone\'s songs.' },
    { id: 'nda', lane: 'both', title: 'NDA', what: 'A promise to keep a conversation private.', fair: 'It covers the private talk, for a set time, and still lets you make music.', watch: 'A promise so wide you cannot release your own songs or talk to a lawyer.' },
    { id: 'session', lane: 'human', title: 'Session musician', what: 'A player comes in for a session. They are paid for the playing.', fair: 'Credit, a session fee you name, and you keep the song unless you agree to a share.', watch: 'A session that turns into work for hire plus a piece of the master with no talk.' },
    { id: 'ai-terms', lane: 'ai', title: 'AI tool terms', what: 'The rules of an AI tool you use on the song.', fair: 'You keep the song, the voice, and the masters. The tool gets permission for the feature you turned on.', watch: 'Terms that train on your voice or your stems unless you clearly say yes.' },
    { id: 'ai-voice', lane: 'ai', title: 'AI voice / likeness consent', what: 'A yes for someone to use your voice or your face in a named way.', fair: 'The use is named, it ends, and you can take the yes back.', watch: 'A blanket yes for any future voice, face, or campaign.' },
    { id: 'ai-train', lane: 'ai', title: 'Voice licensing for training', what: 'Permission to train a model on your voice or recordings.', fair: 'A named set of files, a named model, a term, and a way to pull the files back.', watch: 'Training that never ends, or a model you cannot tell people is not you.' },
    { id: 'ai-stems', lane: 'ai', title: 'Stems-for-AI license', what: 'Permission to use your stems inside an AI tool or model.', fair: 'These stems, this use, this term. You keep the song.', watch: 'Stems that can be resold, retrained, or used as someone else\'s voice.' }
  ];

  var RULES = [
    { id: 'own', re: /all rights|all right, title|hereby assign|assignment of copyright|work for hire|work-for-hire|we own the|company owns/i, title: 'Ownership grab', plain: 'This wording can hand over the song, not just permission to use it.', instead: 'You keep the song. They get permission for this use only.' },
    { id: 'term', re: /in perpetuity|perpetual|forever|for all time|life of copyright|99 years|ninety-nine years/i, title: 'A very long term', plain: 'A term with no real end is hard to leave.', instead: 'This lasts for this project, or for one year, and it ends unless you both renew it in writing.' },
    { id: 'percent', re: /(\d{2,3})\s*%/, title: 'A high percentage', plain: 'A share of 50% or more showed up. Check who that share belongs to.', instead: 'Name each person\'s share in words, and make sure the shares belong to the people who did the work.', high: true },
    { id: 'exit', re: /irrevocable|may not terminate|shall not terminate|no termination|cannot cancel|no right to terminate/i, title: 'No way out', plain: 'The wording makes it hard or impossible to leave.', instead: 'Either side can end this with 30 days written notice. Rights you already granted for a finished use can stay, and new uses stop.' },
    { id: 'cross', re: /cross[-\s]?collateral/i, title: 'Cross-collateralization', plain: 'Money from one song can be held back to pay for a different song.', instead: 'Costs and advances stay with this one release. Other songs are not collateral.' },
    { id: '360', re: /\b360\b|touring income|merchandise income|endorsement income/i, title: 'A 360 clause', plain: 'They want a cut of income beyond the record, such as shows or merch.', instead: 'Their cut, if any, is only on the recording in this deal. Shows, merch, and brand work stay yours.' },
    { id: 'ai', re: /\b(ai|a\.i\.|artificial intelligence|voice model|likeness|training data|machine learning|stems)\b/i, title: 'AI, voice, or stems', plain: 'The paste talks about AI, a voice, a likeness, or stems. Check that your yes is named and limited.', instead: 'No AI training, voice model, likeness, or stem use unless you sign a separate consent that names the use and the end date.' }
  ];

  function typeById(id) {
    var found = null;
    TYPES.forEach(function (type) {
      if (type.id === id) found = type;
    });
    return found;
  }

  function typesFor(lane) {
    var key = lane === 'human' || lane === 'ai' ? lane : 'all';
    if (key === 'all') return TYPES.slice();
    return TYPES.filter(function (type) {
      return type.lane === 'both' || type.lane === key;
    });
  }

  function tagFor(type) {
    if (!type) return '';
    if (type.lane === 'human') return 'Human';
    if (type.lane === 'ai') return 'AI';
    return 'Human and AI';
  }

  function tidy(value) {
    return String(value || '').replace(/\u2014/g, '. ').replace(/\u2013/g, '-').replace(/\s+/g, ' ').trim();
  }

  function highPercent(text) {
    var re = /(\d{2,3})\s*%/g;
    var match;
    while ((match = re.exec(String(text || '')))) {
      if (parseInt(match[1], 10) >= 50) return true;
    }
    return false;
  }

  function aiHasConsent(text) {
    return /consent|permission|opt in|opt-in|you agree|written approval/i.test(String(text || ''));
  }

  function analyze(text) {
    var raw = tidy(text);
    var redFlags = [];
    var fair = [];
    var ask = [];
    var redlines = [];
    if (!raw) {
      return {
        ok: false,
        error: 'Paste the contract, or upload a text file.',
        redFlags: [],
        fair: [],
        ask: [],
        redlines: []
      };
    }
    RULES.forEach(function (rule) {
      var hit = rule.high ? highPercent(raw) : rule.re.test(raw);
      if (!hit) return;
      if (rule.id === 'ai' && aiHasConsent(raw)) {
        fair.push({ title: 'Consent is mentioned', plain: 'The paste talks about AI, voice, or stems and also mentions a yes. Read that yes and see how wide it is.' });
        return;
      }
      redFlags.push({ title: rule.title, plain: rule.plain });
      ask.push({ title: rule.title, plain: rule.instead });
      redlines.push({ title: rule.title, instead: rule.instead });
    });
    if (/you keep|artist retains|writer retains|copyright remains/i.test(raw)) {
      fair.push({ title: 'You keep something', plain: 'Some wording says you keep rights. Make sure it names the song, the recording, and the term.' });
    }
    if (/30 days|terminate|end this|either party may/i.test(raw)) {
      fair.push({ title: 'There is an ending', plain: 'The paste mentions an end or a notice. Check that it covers new uses, not only old ones.' });
    }
    if (!fair.length) {
      fair.push({ title: 'What a fair version names', plain: 'Who owns the song, how long the permission lasts, how you leave, and what they may not do with your voice or stems.' });
    }
    if (!redFlags.length) {
      redFlags.push({ title: 'No usual red flag in this paste', plain: 'That is not a clean bill. A lawyer should still read the whole thing before you sign.' });
      ask.push({ title: 'Still ask', plain: 'Ask who owns the song when this ends, and ask them to say no AI training unless you sign a separate yes.' });
      redlines.push({ title: 'Still send this', instead: 'I keep the song and the recording. This permission ends on the date we name. No AI training, voice model, or likeness use unless I sign a separate consent.' });
    }
    return {
      ok: true,
      demo: true,
      redFlags: redFlags,
      fair: fair,
      ask: ask,
      redlines: redlines
    };
  }

  function questionsFor(typeId, includeType) {
    var type = typeById(typeId);
    var list = [];
    if (includeType || !type) {
      list.push({ id: 'type', ask: 'Which contract is this?', kind: 'type' });
    }
    list.push({ id: 'you', ask: 'What is your name?', kind: 'text', placeholder: 'Your name' });
    list.push({ id: 'them', ask: 'Who is the other side?', kind: 'text', placeholder: 'Their name' });
    list.push({ id: 'work', ask: 'What song or project is this for?', kind: 'text', placeholder: 'Song or project' });
    if (type && type.id === 'beat') {
      list.push({
        id: 'exclusive',
        ask: 'Is the beat lease exclusive?',
        kind: 'choice',
        options: ['Non-exclusive', 'Exclusive for this song']
      });
    }
    list.push({
      id: 'term',
      ask: 'How long does this last?',
      kind: 'choice',
      options: ['Until you end it', 'One year', 'This one project']
    });
    list.push({
      id: 'leave',
      ask: 'Can you leave?',
      kind: 'choice',
      options: ['Yes, with 30 days notice', 'Yes, when the project ends']
    });
    list.push({
      id: 'keep',
      ask: 'What do you keep?',
      kind: 'choice',
      options: keepOptions(type)
    });
    list.push({ id: 'share', ask: 'What share do you keep?', kind: 'text', placeholder: 'Say it in words' });
    return list;
  }

  function keepOptions(type) {
    var id = type && type.id;
    if (id === 'beat') return ['You keep the song. They keep the beat.', 'You license the beat. You do not own it.'];
    if (id === 'feature') return ['You keep your song. They keep their part.', 'You keep your verse. They keep their song.'];
    if (id === 'management') return ['You keep the music. They earn a commission on what they book.'];
    if (id === 'booking') return ['You keep the show fee, minus the booking cut you name.'];
    if (id === 'recording') return ['You keep the song. They may release this recording for the term.'];
    if (id === 'publishing') return ['You keep the copyright. They administer it for the term.'];
    if (id === 'distribution') return ['You keep the song and the royalties. They deliver it.'];
    if (id === 'sync') return ['You license this one use. You keep the song.'];
    if (id === 'wfh') return ['This is one hired job, with a fee you name. The scope stays that job.'];
    if (id === 'band') return ['The group owns the name and the songs in the shares you write down.'];
    if (id === 'nda') return ['You keep your ideas. They may not share them.'];
    if (id === 'session') return ['You keep the song. They are credited for the session.'];
    if (id === 'ai-terms') return ['You keep the song, the voice, and the masters.'];
    if (id === 'ai-voice') return ['They may use the voice only for the use you name.'];
    if (id === 'ai-train') return ['They may train only on the files you name, and you can take them back.'];
    if (id === 'ai-stems') return ['They may use these stems for this AI use only. You keep the song.'];
    return ['You keep the song.', 'You keep your share of the song.'];
  }

  function buildDraft(answers) {
    var data = answers || {};
    var type = typeById(data.type) || { title: 'Contract note', lane: 'both', what: '' };
    var you = tidy(data.you) || 'You';
    var them = tidy(data.them) || 'The other side';
    var work = tidy(data.work) || 'this project';
    var lines = [];
    lines.push(type.title);
    lines.push(DISCLAIMER);
    lines.push('');
    lines.push(you + ' and ' + them + ' are writing this down for ' + work + '.');
    lines.push(type.what);
    if (data.exclusive) lines.push('Beat lease: ' + tidy(data.exclusive) + '.');
    lines.push('What ' + you + ' keeps: ' + (tidy(data.keep) || 'The song.'));
    lines.push('How long: ' + (tidy(data.term) || 'Until you end it') + '.');
    lines.push('Leaving: ' + (tidy(data.leave) || 'Yes, with 30 days notice') + '.');
    lines.push('Share ' + you + ' keeps: ' + (tidy(data.share) || 'the share you write here') + '.');
    lines.push('No AI training, voice model, likeness, or stem use unless ' + you + ' signs a separate consent that names the use and the end date.');
    lines.push(type.fair);
    lines.push(PAY_LINE);
    lines.push('This is a starting note, not a finished contract.');
    return lines.join('\n');
  }

  function fromModel(content) {
    var raw = String(content || '');
    var start = raw.indexOf('{');
    var end = raw.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    var parsed;
    try {
      parsed = JSON.parse(raw.slice(start, end + 1));
    } catch (err) {
      return null;
    }
    function list(key, field) {
      var rows = parsed && Array.isArray(parsed[key]) ? parsed[key] : [];
      return rows.slice(0, 8).map(function (row) {
        var item = { title: tidy(row && row.title).slice(0, 120) };
        item[field] = tidy(row && (row[field] || row.plain || row.instead)).slice(0, 500);
        return item;
      }).filter(function (row) { return row.title && row[field]; });
    }
    var redFlags = list('redFlags', 'plain');
    var fair = list('fair', 'plain');
    var ask = list('ask', 'plain');
    var redlines = list('redlines', 'instead');
    if (!redFlags.length && !redlines.length) return null;
    return { ok: true, demo: false, redFlags: redFlags, fair: fair, ask: ask, redlines: redlines };
  }

  return {
    DISCLAIMER: DISCLAIMER,
    PAY_LINE: PAY_LINE,
    TEXT_KEY: TEXT_KEY,
    TYPES: TYPES,
    typeById: typeById,
    typesFor: typesFor,
    tagFor: tagFor,
    analyze: analyze,
    questionsFor: questionsFor,
    buildDraft: buildDraft,
    fromModel: fromModel,
    tidy: tidy
  };
});
