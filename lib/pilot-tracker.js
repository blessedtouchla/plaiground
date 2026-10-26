'use strict';

/**
 * Artist pilot tracker for the owner desk.
 * Built only from data we already store:
 *   users (created_at, email, artist_name, tonegrid_release_at)
 *   product_event_rollups (first_at, last_at, event_count per user and event)
 * No new tables, no new events, no lyrics or free text.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const SECOND_RELEASE_DAYS = 30;

const TOOL_EVENTS = {
  song_helper_started: 'Song Lab',
  song_helper_draft: 'Song Lab',
  song_helper_first: 'Song Lab',
  cover_art_generated: 'Cover Art',
  cover_reposition_used: 'Cover Art',
  split_sheet_created: 'Split sheet',
  qualify_started: 'Qualify my song',
  claim_created: 'Claim my human parts',
  contract_reviewed: 'Contracts',
  contract_fixed: 'Contracts',
  contract_created: 'Contracts',
  copyright_choice: 'Copyright',
  route_map_built: 'Roadmap',
};

// Ordered journey. The last one reached is where they stalled.
const STEPS = [
  { key: 'signup', label: 'Signed up' },
  { key: 'tool', label: 'Tried a tool' },
  { key: 'split_sheet_created', label: 'Split sheet started' },
  { key: 'split_sheet_signed', label: 'Split sheet signed' },
  { key: 'qualify_completed', label: 'Song qualified' },
  { key: 'submission', label: 'Release submitted' },
  { key: 'second_release', label: 'Second release in 30 days' },
];

function ms(value) {
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function iso(value) {
  const t = ms(value);
  return t ? new Date(t).toISOString() : '';
}

function releaseTimes(user, roll) {
  const list = (user && Array.isArray(user.tonegrid_release_at) ? user.tonegrid_release_at : [])
    .map(ms).filter(Boolean).sort((a, b) => a - b);
  if (list.length) return list;
  const sub = roll.submission;
  if (!sub) return [];
  const out = [ms(sub.first_at)].filter(Boolean);
  if (Number(sub.event_count) >= 2 && ms(sub.last_at) > out[0]) out.push(ms(sub.last_at));
  return out;
}

function pilotRow(user, roll, now) {
  let firstTool = '';
  let firstToolAt = 0;
  Object.keys(TOOL_EVENTS).forEach((name) => {
    const r = roll[name];
    const t = r ? ms(r.first_at) : 0;
    if (t && (!firstToolAt || t < firstToolAt)) {
      firstToolAt = t;
      firstTool = TOOL_EVENTS[name];
    }
  });
  const releases = releaseTimes(user, roll);
  const firstRelease = releases[0] || 0;
  const second = releases.find((t) => t > firstRelease && t - firstRelease <= SECOND_RELEASE_DAYS * DAY_MS) || 0;
  let secondStatus = 'no release yet';
  if (firstRelease) {
    if (second) secondStatus = 'yes';
    else if (ms(now) < firstRelease + SECOND_RELEASE_DAYS * DAY_MS) secondStatus = 'window open';
    else secondStatus = 'no';
  }
  const reached = {
    signup: true,
    tool: Boolean(firstTool),
    split_sheet_created: Boolean(roll.split_sheet_created),
    split_sheet_signed: Boolean(roll.split_sheet_signed),
    qualify_completed: Boolean(roll.qualify_completed),
    submission: Boolean(firstRelease || roll.submission),
    second_release: Boolean(second),
  };
  let last = STEPS[0];
  STEPS.forEach((step) => { if (reached[step.key]) last = step; });
  let lastSeen = ms(user && user.created_at);
  Object.keys(roll).forEach((name) => {
    const t = ms(roll[name].last_at);
    if (t > lastSeen) lastSeen = t;
  });
  return {
    email: String((user && user.email) || ''),
    artist: String((user && user.artist_name) || ''),
    signed_up_at: iso(user && user.created_at),
    first_tool: firstTool,
    first_tool_at: firstToolAt ? new Date(firstToolAt).toISOString() : '',
    last_step: last.label,
    split_sheet_signed: reached.split_sheet_signed,
    song_qualified: reached.qualify_completed,
    release_submitted: reached.submission,
    first_release_at: firstRelease ? new Date(firstRelease).toISOString() : '',
    second_release_30d: secondStatus,
    last_seen_at: lastSeen ? new Date(lastSeen).toISOString() : '',
    reached: reached,
  };
}

function buildPilot(users, rollups, now) {
  const byUser = {};
  (Array.isArray(rollups) ? rollups : []).forEach((row) => {
    if (!row || !row.user_id) return;
    const id = String(row.user_id);
    if (!byUser[id]) byUser[id] = {};
    byUser[id][row.event_name] = row;
  });
  const at = now || new Date().toISOString();
  return (Array.isArray(users) ? users : [])
    .filter((u) => u && u.id)
    .map((u) => pilotRow(u, byUser[String(u.id)] || {}, at));
}

function funnel(rows) {
  return STEPS.map((step) => ({
    step: step.label,
    artists: (rows || []).filter((r) => r && r.reached && r.reached[step.key]).length,
  }));
}

module.exports = { STEPS, TOOL_EVENTS, buildPilot, funnel, pilotRow };
