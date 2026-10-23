// Free "Get your IPI" guide: step data and small helpers. No network, no personal data.
// The guide never collects SSN, date of birth, bank details or BMI login details.
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PlaigroundIpiGuide = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  var BMI_JOIN_URL = 'https://www.bmi.com/join';
  var STORAGE_KEY = 'plaiground_ipi_guide_v1';
  var MASKED_SSN = '\u2022\u2022\u2022-\u2022\u2022-\u2022\u2022\u2022\u2022';
  var SAMPLE_NOTE = 'Sample details for Jordan Rivers. Use your own on bmi.com.';

  // kind: 'ready' (pre-step), 'bmi' (steps 1 to 7), 'ipi' (final).
  var STEPS = [
    {
      id: 'ready', kind: 'ready', title: 'Get ready', pose: 'hello',
      say: "Hi! I'm Plai. I'll walk you through joining BMI as a songwriter. It's free, and you do it yourself on bmi.com. I'm right here the whole way.",
      heading: 'Get ready: have these handy',
      checklist: [
        ['A valid email address', 'BMI sends your login and updates here.'],
        ['Your legal name, exactly as on your SSN card', 'Not your artist name. That comes later.'],
        ['Your SSN and date of birth', 'You type these only on bmi.com. We never ask for them.'],
        ['Your phone and mailing address', 'Where BMI can reach you.'],
        ['Every artist or pen name you use', 'You will add them as AKAs.'],
        ['Under 18?', 'You need a custodial trust bank account at a US bank.']
      ],
      tip: 'We never ask for your SSN, your BMI password, or sign up as you. This guide just shows you what to expect.',
      next: "I'm ready, let's go"
    },
    {
      id: 'find', kind: 'bmi', n: 1, title: 'Find the form', pose: 'thinking',
      say: 'Go to bmi.com/join and find the card for songwriters. Check the two requirements, then tap Join.',
      addr: 'bmi.com/join',
      card: { heading: 'Join BMI', blocks: [
        { type: 'box', title: 'Songwriter or Composer', text: 'Requirements: a valid email address. Applicants under 18 need a custodial trust bank account at a US bank.', button: 'Join' },
        { type: 'note', text: 'Join opens join.bmi.com' }
      ] },
      tip: "Pick Songwriter or Composer, not Publisher. You're joining as the writer.",
      openBmi: true,
      next: 'I found it'
    },
    {
      id: 'info', kind: 'bmi', n: 2, title: 'Your info', pose: 'hello',
      say: "This is Online Affiliation, Personal Information. Fill it in carefully. It's the most important page.",
      addr: 'join.bmi.com',
      card: { heading: 'Personal Information', blocks: [
        { type: 'row', fields: [['Citizenship', 'United States'], ['Tax residence', 'United States']] },
        { type: 'section', text: 'Contact' },
        { type: 'field', k: 'Legal name', v: 'Jordan Rivers' },
        { type: 'field', k: 'Email', v: 'jordan.rivers@example.com' },
        { type: 'field', k: 'Phone', v: '(555) 010-2234' },
        { type: 'field', k: 'Mailing address', v: '100 Sample Ave, Anytown' },
        { type: 'row', fields: [['SSN', MASKED_SSN], ['DOB', 'MM / DD / YYYY']] },
        { type: 'section', text: 'AKAs / Pseudonyms' },
        { type: 'field', k: 'AKA 1', v: 'J. Rivers' },
        { type: 'field', k: 'AKA 2', v: 'JRiv' },
        { type: 'field', k: 'Other memberships', v: 'None' },
        { type: 'note', text: SAMPLE_NOTE }
      ] },
      tip: 'Use your legal name exactly as on your SSN card. Then add every artist name you release under as an AKA, so BMI can match your songs to you.',
      next: 'Done with this page'
    },
    {
      id: 'status', kind: 'bmi', n: 3, title: 'PRO history', pose: 'thinking',
      say: 'Next is Affiliation Status. Just one question about your history with performing rights organizations.',
      addr: 'join.bmi.com',
      card: { heading: 'Affiliation Status', blocks: [
        { type: 'text', text: 'Are you currently or have you ever been a member of a Performing Rights Organization?' },
        { type: 'radio', options: ['Yes', 'No'], picked: 1 },
        { type: 'button', text: 'Continue' }
      ] },
      tip: 'Answer honestly. If you were ever with ASCAP, SESAC or a society in another country, pick Yes.',
      next: 'Next'
    },
    {
      id: 'review', kind: 'bmi', n: 4, title: 'Review', pose: 'wink',
      say: 'Application Information. BMI shows everything you entered. Tap a pencil to fix anything.',
      addr: 'join.bmi.com',
      card: { heading: 'Application Information', blocks: [
        { type: 'edit', title: 'Personal', text: 'Jordan Rivers, jordan.rivers@example.com, (555) 010-2234' },
        { type: 'edit', title: 'AKAs', text: 'J. Rivers, JRiv' },
        { type: 'edit', title: 'Affiliation Status', text: 'Never a PRO member' },
        { type: 'button', text: 'Continue' }
      ] },
      tip: "Read every line once. A typo in your name or AKAs is a common reason songs don't match later.",
      next: 'Looks right'
    },
    {
      id: 'documents', kind: 'bmi', n: 5, title: 'Your documents', pose: 'thinking',
      say: 'Contract & Application. Open and check all three documents, then read the acknowledgments.',
      addr: 'join.bmi.com',
      card: { heading: 'Review Your Documents', blocks: [
        { type: 'check', on: true, text: 'Application for Affiliation', sub: 'Includes a W-9 tax form' },
        { type: 'check', on: true, text: 'Writer Agreement (draft)', sub: 'Spanish version available' },
        { type: 'check', on: true, text: 'Terms of Use for BMI Online Services' },
        { type: 'section', text: 'Acknowledgments' },
        { type: 'check', on: false, text: "I can't join another PRO for at least 2 years" },
        { type: 'check', on: false, text: 'My electronic signature is legally binding' }
      ] },
      tip: 'The 2-year lock-in is real: once you join BMI, you can\'t join another PRO for at least 2 years. Read the Writer Agreement before you check the box.',
      tipIcon: 'warn',
      next: 'Got it'
    },
    {
      id: 'sign', kind: 'bmi', n: 6, title: 'Sign', pose: 'hello',
      say: 'Time to sign. Check the box with your name, then press SUBMIT.',
      addr: 'join.bmi.com',
      card: { heading: 'Sign', blocks: [
        { type: 'check', on: true, text: 'I, Jordan Rivers, by electronically signing this application...' },
        { type: 'button', text: 'SUBMIT' }
      ] },
      tip: 'This is your signature, so only you can do this step. Nobody at PLAIGROUND signs or submits for you.',
      next: 'I pressed SUBMIT'
    },
    {
      id: 'done', kind: 'bmi', n: 7, title: 'Done', pose: 'dancing',
      say: 'You did it! BMI has your application. Now we wait for their email.',
      addr: 'join.bmi.com',
      card: { heading: 'Your BMI Writer Application Has Been Received', success: true, blocks: [
        { type: 'note', text: "Allow 5 to 7 business days. You will get an email with access to BMI Online Services. You can't log in before that email. If it's been over 60 days with no contact, the application isn't processed." }
      ] },
      tip: "Screenshot this confirmation screen and save it. If BMI's email hasn't come after a couple of weeks, contact BMI and show it. Don't let it reach 60 days.",
      next: 'Next: save your IPI'
    },
    {
      id: 'ipi', kind: 'ipi', title: 'I got my IPI', pose: 'wink',
      say: "When BMI's email comes and you're in Online Services, find your IPI number and paste it here.",
      heading: 'I got my IPI',
      tip: 'Your IPI is your songwriter ID. It goes on every song you register so BMI knows the song is yours.',
      next: 'Save my IPI'
    }
  ];

  function cleanIpi(value) {
    return String(value == null ? '' : value).replace(/[\s.\-]/g, '');
  }
  function isValidIpi(value) {
    var v = cleanIpi(value);
    return v.length > 0 && /^\d+$/.test(v);
  }
  function load(storage) {
    try {
      var raw = storage && storage.getItem(STORAGE_KEY);
      var data = raw ? JSON.parse(raw) : {};
      return data && typeof data === 'object' ? data : {};
    } catch (err) { return {}; }
  }
  function save(storage, patch) {
    var data = load(storage);
    for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) data[k] = patch[k];
    try { if (storage) storage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (err) {}
    return data;
  }
  function saveIpi(storage, value, now) {
    if (!isValidIpi(value)) return { ok: false, error: 'Paste the IPI number exactly as BMI shows it (numbers only).' };
    var data = save(storage, { ipi: cleanIpi(value), ipiSavedAt: (now || new Date()).toISOString() });
    return { ok: true, data: data };
  }
  function clampStep(i) {
    var n = parseInt(i, 10);
    if (isNaN(n) || n < 0) return 0;
    return Math.min(n, STEPS.length - 1);
  }

  return {
    BMI_JOIN_URL: BMI_JOIN_URL, STORAGE_KEY: STORAGE_KEY, MASKED_SSN: MASKED_SSN, STEPS: STEPS,
    PUBLISH_URL: 'publishing.html',
    cleanIpi: cleanIpi, isValidIpi: isValidIpi, load: load, save: save, saveIpi: saveIpi, clampStep: clampStep
  };
});
