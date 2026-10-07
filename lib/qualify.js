(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PlaigroundQualify = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  var DISCLAIMER = 'General info, not legal advice.';
  var TRUTH = 'A human re-record protects the new recording. The song itself needs human authorship.';
  var CLEAR = 'The aim is a record labels, supervisors and distributors can clear.';
  var INTRO = {
    title: 'What this check is for',
    lead: 'You are checking this song for four things.'
  };
  var FOR = [
    { id: 'copyright', title: 'Copyright registration', detail: '' },
    {
      id: 'publishing',
      title: 'Publishing',
      detail: 'Collecting songwriter royalties through a PRO like BMI or ASCAP.'
    },
    { id: 'sync', title: 'Sync placements', detail: 'TV, film, ads, and games.' },
    { id: 'release', title: 'Clean release with distributors and labels', detail: '' }
  ];

  var QUESTIONS = [
    {
      id: 'lyrics',
      ask: 'Who wrote the lyrics?',
      options: [
        { id: 'human', label: 'Me or another human' },
        { id: 'ai', label: 'AI' },
        { id: 'mix', label: 'A mix' }
      ]
    },
    {
      id: 'melody',
      ask: 'Who made the melody?',
      options: [
        { id: 'human', label: 'Me or another human' },
        { id: 'ai', label: 'AI' },
        { id: 'mix', label: 'A mix' }
      ]
    },
    {
      id: 'vocals',
      ask: 'Vocals: human or AI?',
      options: [
        { id: 'human', label: 'Human' },
        { id: 'ai', label: 'AI' }
      ]
    },
    {
      id: 'instruments',
      ask: 'Instruments or beat?',
      options: [
        { id: 'human', label: 'Real players or a producer' },
        { id: 'ai', label: 'AI' }
      ]
    }
  ];

  var OUTCOMES = {
    ready: {
      id: 'ready',
      title: 'Ready for sync & publishing',
      lead: 'A person wrote the song, and a person recorded it.',
      steps: [
        'Keep the recording, the lyrics, and the date.',
        'Name the writers and the shares on a split sheet.',
        'Register the human composition and the human recording.',
        'If a tool touched anything else, say so in an honest disclosure line.'
      ],
      cta: 'See the sync-ready package',
      href: '/make-human#sync'
    },
    almost: {
      id: 'almost',
      title: 'Almost there',
      lead: 'A person wrote the song. The vocals or the track still need a human pass.',
      steps: [
        'Re-sing it with a human voice if the vocals are AI.',
        'Rebuild the track with live players or a producer if the beat is AI.',
        'Use the stems or session files when you have them.',
        'Keep the human composition. The new recording is the part a re-record can protect.'
      ],
      cta: 'Start a human re-sing',
      href: '/make-human#resing'
    },
    needs: {
      id: 'needs',
      title: 'Needs a human pass',
      lead: 'AI wrote lyrics or the melody. The song itself needs a human writing pass before that song is protectable.',
      steps: [
        'A person writes new lyrics, a new melody, or both.',
        'Then a person records that human version.',
        'The AI draft can stay a sketch. It is not the song you register.',
        'After the human writing pass, a human recording can be cleared.'
      ],
      cta: 'Start with a writing pass',
      href: '/make-human#sync'
    }
  };

  function outcomeId(answers) {
    var data = answers || {};
    if (data.lyrics === 'ai' || data.melody === 'ai' || data.lyrics === 'mix' || data.melody === 'mix') return 'needs';
    if (data.vocals === 'ai' || data.instruments === 'ai') return 'almost';
    return 'ready';
  }

  function extraSteps(answers) {
    var data = answers || {};
    var lines = [];
    if (data.files === 'yes') lines.push('Bring the project files. They show what a person did.');
    if (data.files === 'no') lines.push('Save what you still have: the words, the date, and the tool name.');
    if (data.tool && data.tool !== 'none') lines.push('Name the tool in the disclosure line.');
    if (data.traction === 'yes') lines.push('Traction helps people find the song. It does not replace human authorship.');
    return lines;
  }

  function offer(id, answers) {
    if (id === 'almost' && answers && answers.instruments === 'ai') {
      return { cta: 'Start a new human master', href: '/make-human#master' };
    }
    var base = OUTCOMES[id];
    return { cta: base.cta, href: base.href };
  }

  function recordingWait(answers) {
    if (answers && answers.instruments === 'ai') return 'After a new human master';
    return 'After a human re-sing';
  }

  function gateStatus(itemId, tier, answers) {
    if (tier === 'ready') return 'Ready';
    if (tier === 'needs') return 'After a human writing pass';
    if (itemId === 'publishing') return 'Ready';
    var wait = recordingWait(answers);
    if (itemId === 'copyright') {
      return 'Song ready. Recording ' + wait.charAt(0).toLowerCase() + wait.slice(1) + '.';
    }
    return wait;
  }

  function gates(answers) {
    var tier = outcomeId(answers);
    return FOR.map(function (item) {
      return {
        id: item.id,
        title: item.title,
        detail: item.detail,
        status: gateStatus(item.id, tier, answers)
      };
    });
  }

  function result(answers) {
    var id = outcomeId(answers);
    var base = OUTCOMES[id];
    var next = offer(id, answers);
    return {
      id: id,
      title: base.title,
      lead: base.lead,
      truth: TRUTH,
      clear: CLEAR,
      gates: gates(answers),
      steps: base.steps.concat(extraSteps(answers)),
      cta: next.cta,
      href: next.href
    };
  }

  return {
    DISCLAIMER: DISCLAIMER,
    TRUTH: TRUTH,
    CLEAR: CLEAR,
    INTRO: INTRO,
    FOR: FOR,
    QUESTIONS: QUESTIONS,
    OUTCOMES: OUTCOMES,
    outcomeId: outcomeId,
    gates: gates,
    result: result
  };
});
