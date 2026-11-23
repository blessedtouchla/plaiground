'use strict';

/**
 * The Couch. Server-side only. The xAI key never enters this module.
 * Signed-out visitors, a missing key, a kill switch, or a bad reply
 * all use the same labeled sample. No credit is charged here.
 * Credit packs are not in this preview, so a live turn does not deduct one.
 */

const SAMPLE = 'Sample reply. Live chat is off.';
const SAFETY = 'This is a writing room, not therapy. If you are in danger or thinking about hurting yourself, call or text 988 (US) or your local emergency number.';
const END = "That's the end of this couch session. Take it to the writers' room.";
const BLOCKED = "Plai can't help with that one. Let's keep it about the song.";
const FOLLOW = [
  'Where were you sitting?',
  'What did they say, exactly?',
  'How did it feel, right then?',
  'What would you say back?'
];
const MAX_TURNS = 8;
const MAX_CHARS = 600;
const MAX_REPLY = 200;
const MAX_STUDIO = 480;
const MAX_PIN = 60;
const ARC_RULE = 'Each verse must advance the story or emotional stakes past the previous verse.';
const POSES = { idle: 1, thinking: 1, listening: 1, hyped: 1, coffee: 1, dancing: 1, autopilot: 1 };
const NAME_RE = /\b(kanye(?:\s+west)?|yeezy|dreamville|j\.?\s*cole|jay-?z|drake|kendrick|beyonce|beyoncé|hawaii\s+sessions?)\b/i;
const CLICHE_RE = /\b(neon lights|concrete jungle|shadows of the night|echo(?:es)? in the dark|echoes of yesterday|spitting fire|symphony|unleash the beast|tapestry|canvas|burning flame|dancing in the rain)\b/gi;
const HYPE_RE = /\b(sensory anchor|sensory_anchor|hook_seed|song_dna|detected_mode|banger_ready|squad_banter|squad_pitches|studio_message|ending_echo|emotional_arc|active_pose|banger|crazy|insane|legendary|chef's kiss|gold|fire)\b/gi;
const MODE_RE = /\bmode\b/gi;

const SELF_HARM = /\b(kill myself|killing myself|suicide|suicidal|want to die|wanna die|end my life|hurt myself|self-harm|self harm|cut myself)\b/i;

function producerPrompt() {
  return [
    'You are Plai, the resident Executive Producer at Song Lab on wannaplai.com.',
    '',
    '### CORE IDENTITY & MISSION',
    '- You are a sharp, warm, nonjudgmental collaborator sitting at the studio board.',
    '- Your goal: make sure anyone who walks in leaves with a real, moving song in their own words, not generic AI fluff.',
    '- You lead a resident camp: Vibe (melodies & hooks), Dex (bars & rhymes), and 808 (cadence & rhythm). You keep the artist in the Executive Producer chair.',
    '- Tone: Cool, direct, in-studio talkback. Keep replies short (1-3 natural sentences). No robotic preambles, no sycophantic praise, no corny corporate cheerleading.',
    '',
    '### THREE NON-NEGOTIABLE CORE RULES',
    '1. WHOLE-SONG NARRATIVE DEVELOPMENT & ENDING LOOP:',
    '   - Songs must never be static loops of the same idea. Each verse must advance the story or emotional stakes past the previous verse.',
    '   - The climax/outro or final chorus must loop back to the opening image or motif, transforming its meaning.',
    '2. STRICT 3-TIER AI LABELS (NO SCORES):',
    '   - Every song is labeled strictly as one of three tags: [Human], [AI-assisted], or [Fully AI]. Never show arbitrary percentage meters or numerical scores.',
    '3. INTERNAL-ONLY REFERENCES:',
    '   - High-level studio camp references (e.g., legendary camp writing rooms) are internal inspiration for flow and pacing only. Never mention artist camp names or external celebrity setups to the user.',
    '',
    '### CONVERSATIONAL INTAKE MODES',
    'Detect what the artist brought in and adapt immediately:',
    '- RANT / DIARY MODE: Unfiltered emotional stream. Pull out the rawest real-world sentence as the anchor hook.',
    '- LONE HOOK MODE: Artist has one catchy punchline. Build the cinematic verse world around who they are speaking to.',
    '- STORY GAP MODE: Beginning and end are clear, but missing the turning point. Ask the single question that uncovers the bridge.',
    '- ONE-NOTE FLEX MODE: Surface-level brag. Dig for the personal stakes ("What did that flex cost you?").',
    '- ROAST / BATTLE RAP MODE: Target identified. Convert public facts and specifics into sharp punchlines and setups.',
    '',
    '### THE SENSORY ANCHOR RULE',
    'Every song draft must feature at least one tangible, real-world sensory anchor (e.g., cold kitchen tile, dying iPhone charger, stale bodega coffee, chipped gold ring). Reject abstract generic filler.',
    '',
    '### BANNED AI CLICHÉS',
    'Never write, suggest, or approve these lines or tropes:',
    '- "Neon lights painting the city streets"',
    '- "Echoes of yesterday / shadows in the dark"',
    '- "A symphony of broken dreams"',
    '- "Dancing in the rain / burning flame"',
    '- Surface-level rhyming pairs: fire/desire, pain/rain, night/light, strive/alive.',
    '',
    '### OUTPUT JSON PAYLOAD FORMAT',
    'Always respond in this JSON schema:',
    '{',
    '  "talkback": "Short, punchy 1-2 sentence response to the artist",',
    '  "active_pose": "idle" | "thinking" | "listening" | "hyped" | "coffee" | "dancing" | "autopilot",',
    '  "detected_mode": "rant" | "hook" | "story_gap" | "flex" | "roast",',
    '  "banger_ready": true | false,',
    '  "song_dna": {',
    '    "addressee": "Who the artist is speaking to",',
    '    "sensory_anchor": "The physical object/sensory detail",',
    '    "hook_seed": "The core recurring line",',
    '    "emotional_arc": "Progression from verse 1 through the ending loop",',
    '    "label": "Human" | "AI-assisted" | "Fully AI"',
    '  },',
    '  "squad_pitches": {',
    '    "vibe": "Hook melody or cadence idea",',
    '    "dex": "Punchline or rhyming bar couplet",',
    '    "808": "Pocket, tempo, or bounce direction"',
    '  }',
    '}',
    '',
    'Never say the words "sensory anchor", "mode", or any internal rule name to the artist. Never use hype phrases (no "gold", "fire", "banger", "crazy", "insane", "legendary", "chef\'s kiss", no exclamation-point cheerleading). Never use em dashes.',
    'Labels are exactly Human, AI-assisted, or Fully AI. No scores, percentages, or meters anywhere.',
    'Camp and artist names are internal only. Never write them in talkback or squad pitches.'
  ].join('\n');
}

function disabled() {
  var flag = String(process.env.COUCH_DISABLED || '').trim().toLowerCase();
  return flag === '1' || flag === 'true' || flag === 'on' || flag === 'yes';
}

function clip(value, max) {
  return String(value == null ? '' : value).replace(/https?:\/\/\S+/gi, '').replace(/<[^>]*>/g, '').trim().slice(0, max);
}

function scrubPublic(value) {
  var text = String(value == null ? '' : value);
  text = text.replace(/\s*[\u2014\u2013]\s*/g, ', ');
  text = text.replace(/!+/g, '.');
  text = text.replace(CLICHE_RE, '');
  text = text.replace(HYPE_RE, '');
  text = text.replace(MODE_RE, '');
  text = text.replace(/\b\d{1,3}\s*%/g, '');
  text = text.replace(/\byours\s*[:=]\s*\d+/gi, '');
  var kept = text.split(/(?<=[.!?])\s+/).filter(function (sentence) {
    return sentence && !NAME_RE.test(sentence);
  });
  return kept.join(' ').replace(/\s{2,}/g, ' ').replace(/\s+([,.])/g, '$1').trim();
}

function authorshipLabel(value) {
  var text = String(value || '').replace(/\s+/g, ' ').trim();
  if (/assist/i.test(text)) return 'AI-assisted';
  if (/full/i.test(text) && /\bai\b/i.test(text)) return 'Fully AI';
  if (/human/i.test(text)) return 'Human';
  return '';
}

function cleanPose(value) {
  var key = String(value || '').trim().toLowerCase();
  if (POSES[key]) return key;
  return 'idle';
}

function applyArc(dna) {
  var song = dna && typeof dna === 'object' ? dna : {};
  var next = {
    addressee: clip(scrubPublic(song.addressee || ''), 120),
    sensory_anchor: clip(scrubPublic(song.sensory_anchor || ''), 180),
    hook_seed: clip(scrubPublic(song.hook_seed || ''), 160),
    emotional_arc: clip(scrubPublic(song.emotional_arc || song.emotional_stakes || ''), 240)
  };
  var label = authorshipLabel(song.label || song.authorship || '');
  if (label) next.label = label;
  return next;
}

function readSquad(raw) {
  var pitches = { vibe: '', dex: '', '808': '' };
  if (Array.isArray(raw)) {
    raw.forEach(function (row) {
      if (!row) return;
      var who = String(row.speaker || '').toLowerCase();
      if (who === 'vibe' || who === 'dex' || who === '808') pitches[who] = clip(scrubPublic(row.pitch || ''), 180);
    });
  } else if (raw && typeof raw === 'object') {
    ['vibe', 'dex', '808'].forEach(function (key) {
      pitches[key] = clip(scrubPublic(raw[key] || ''), 180);
    });
  }
  var banter = [];
  [['Vibe', 'vibe'], ['Dex', 'dex'], ['808', '808']].forEach(function (pair) {
    if (pitches[pair[1]]) banter.push({ speaker: pair[0], pitch: pitches[pair[1]] });
  });
  return { pitches: pitches, banter: banter };
}

function userTurns(turns) {
  return (Array.isArray(turns) ? turns : []).filter(function (row) {
    return row && row.role === 'user' && String(row.text || '').trim();
  });
}

function pinsFrom(text) {
  var raw = clip(text, MAX_CHARS);
  var quotes = raw.match(/"[^"]{2,80}"/g) || [];
  var words = raw.toLowerCase().split(/[^a-z']+/).filter(function (word) {
    return word.length > 3;
  }).slice(0, 3);
  var pins = {};
  if (quotes.length) pins.phrase = quotes.slice(0, 2).map(function (line) { return clip(line, MAX_PIN); });
  if (words.length) pins.detail = words.map(function (word) { return clip(word, MAX_PIN); });
  return pins;
}

function scriptedReply(count) {
  if (count >= MAX_TURNS) return END;
  return FOLLOW[Math.min(count, FOLLOW.length - 1)];
}

function fallback(body, reason) {
  var turns = userTurns(body && body.turns);
  var last = turns.length ? turns[turns.length - 1].text : '';
  var reply = scriptedReply(turns.length);
  return {
    ok: true,
    fallback: true,
    live: false,
    label: SAMPLE,
    reply: reply,
    talkback: reply,
    active_pose: 'idle',
    squad_pitches: { vibe: '', dex: '', '808': '' },
    squad_banter: [],
    pins: pinsFrom(last),
    reason: reason || 'fallback'
  };
}

function safetyBody() {
  return {
    ok: true,
    fallback: true,
    live: false,
    safety: true,
    label: SAMPLE,
    reply: SAFETY,
    talkback: SAFETY,
    active_pose: 'idle',
    squad_banter: [],
    pins: {}
  };
}

function capPin(value) {
  if (Array.isArray(value)) {
    return value.map(function (item) { return clip(item, MAX_PIN); }).filter(Boolean).slice(0, 4);
  }
  if (typeof value === 'string' && value.trim()) return clip(value, MAX_PIN);
  return '';
}

function readPins(raw) {
  var pins = {};
  if (!raw || typeof raw !== 'object') return pins;
  ['feel', 'detail', 'phrase'].forEach(function (key) {
    var list = capPin(raw[key]);
    if (list && list.length) pins[key] = list;
  });
  ['title', 'sound'].forEach(function (key) {
    var text = capPin(raw[key]);
    if (text) pins[key] = text;
  });
  return pins;
}

function parseModel(content) {
  var text = String(content || '').trim();
  var start = text.indexOf('{');
  var end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  var data;
  try { data = JSON.parse(text.slice(start, end + 1)); } catch (err) { return null; }
  if (!data) return null;
  var spoken = typeof data.talkback === 'string' ? data.talkback : (typeof data.studio_message === 'string' ? data.studio_message : data.reply);
  if (typeof spoken !== 'string') return null;
  spoken = scrubPublic(spoken);
  if (!spoken) return null;
  var squad = readSquad(data.squad_pitches || data.squad_banter);
  return {
    reply: clip(spoken, MAX_REPLY),
    talkback: clip(spoken, MAX_STUDIO),
    studio_message: clip(spoken, MAX_STUDIO),
    active_pose: cleanPose(data.active_pose),
    song_dna: applyArc(data.song_dna),
    squad_pitches: squad.pitches,
    squad_banter: squad.banter,
    pins: readPins(data.pins),
    partial: !data.squad_pitches && !data.squad_banter
  };
}

function roomFallback() {
  return {
    ok: true,
    fallback: true,
    live: false,
    label: SAMPLE,
    bubbles: [
      { who: 'Hook', text: 'Title is the hook. Sing it twice.' },
      { who: 'Verse', text: 'Open on the coffee, two seats down.' },
      { who: 'Flow', text: 'Title runs 9 beats. Clip "own" and it bounces.' }
    ],
    directions: [
      { id: 'quiet', name: 'Quiet burn', tag: 'R&B · slow' },
      { id: 'loud', name: 'Loud receipt', tag: 'Hip hop · punchy' }
    ]
  };
}

function logLine(result, extra) {
  return {
    evt: 'couch_turn',
    turn: extra && extra.turn ? extra.turn : 0,
    result: result || 'fallback',
    model: extra && extra.model ? extra.model : ''
  };
}

async function handle(action, body, ctx) {
  var context = ctx || {};
  var safeBody = body && typeof body === 'object' ? body : {};
  var turns = userTurns(safeBody.turns);
  if (turns.length > MAX_TURNS) turns = turns.slice(0, MAX_TURNS);
  var last = turns.length ? clip(turns[turns.length - 1].text, MAX_CHARS) : '';
  if (SELF_HARM.test(last) || SELF_HARM.test(JSON.stringify(safeBody.pins || ''))) {
    return { status: 200, body: safetyBody(), log: logLine('blocked', { turn: turns.length }) };
  }
  if (action === 'couch-room' || action === 'couch-pick') {
    return { status: 200, body: roomFallback(), log: logLine('fallback', { turn: turns.length }) };
  }
  if (turns.length >= MAX_TURNS) {
    var done = fallback({ turns: turns }, 'limit');
    done.reply = END;
    done.talkback = END;
    return { status: 200, body: done, log: logLine('limit', { turn: turns.length }) };
  }
  var liveOk = !!(context.xaiConfigured && !context.disabled && !disabled() && typeof context.chat === 'function');
  if (!liveOk) {
    return { status: 200, body: fallback({ turns: turns }, context.xaiConfigured ? 'off' : 'off'), log: logLine('fallback', { turn: turns.length }) };
  }
  try {
    var history = turns.map(function (row) {
      return { role: 'user', content: clip(row.text, MAX_CHARS) };
    });
    var system = typeof context.system === 'string' && context.system ? context.system : producerPrompt();
    var chat = await context.chat([
      { role: 'system', content: system },
      { role: 'user', content: history.map(function (row) { return row.content; }).join('\n') }
    ], 900);
    var parsed = parseModel(chat && chat.content);
    if (!parsed) {
      return { status: 200, body: fallback({ turns: turns }, 'bad-json'), log: logLine('fallback', { turn: turns.length, model: chat && chat.model }) };
    }
    return {
      status: 200,
      body: {
        ok: true,
        fallback: false,
        live: true,
        reply: parsed.reply,
        talkback: parsed.talkback,
        studio_message: parsed.studio_message,
        active_pose: parsed.partial ? 'idle' : parsed.active_pose,
        song_dna: parsed.song_dna,
        squad_pitches: parsed.partial ? { vibe: '', dex: '', '808': '' } : parsed.squad_pitches,
        squad_banter: parsed.partial ? [] : parsed.squad_banter,
        pins: parsed.pins
      },
      log: logLine('ok', { turn: turns.length, model: chat && chat.model })
    };
  } catch (err) {
    return { status: 200, body: fallback({ turns: turns }, 'error'), log: logLine('fallback', { turn: turns.length }) };
  }
}

module.exports = {
  SAMPLE: SAMPLE,
  SAFETY: SAFETY,
  END: END,
  BLOCKED: BLOCKED,
  FOLLOW: FOLLOW,
  MAX_TURNS: MAX_TURNS,
  MAX_CHARS: MAX_CHARS,
  disabled: disabled,
  pinsFrom: pinsFrom,
  fallback: fallback,
  parseModel: parseModel,
  producerPrompt: producerPrompt,
  scrubPublic: scrubPublic,
  applyArc: applyArc,
  authorshipLabel: authorshipLabel,
  cleanPose: cleanPose,
  ARC_RULE: ARC_RULE,
  handle: handle,
  roomFallback: roomFallback,
  logLine: logLine
};
