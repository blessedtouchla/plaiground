'use strict';

const db = require('./db');

const MADE = { full_ai: true, ai_assisted: true, no_ai: true };
const HUMAN = { lyrics: 'HUMAN Words', vocal: 'HUMAN Vox', played: 'HUMAN Played', mix: 'HUMAN Mix' };

function badgesFor(made, humans) {
  if (made === 'full_ai') return ['FULL AI'];
  if (made === 'no_ai') return ['NO AI'];
  const out = ['AI assisted'];
  (humans || []).forEach((key) => {
    if (HUMAN[key]) out.push(HUMAN[key]);
  });
  return out;
}

function cleanHumans(list) {
  return (Array.isArray(list) ? list : []).map((row) => String(row || '').trim()).filter((key) => HUMAN[key]);
}

function publicPost(row) {
  if (!row) return null;
  return {
    id: row.id,
    artist_name: row.artist_name || '',
    title: row.title || '',
    made: row.made,
    humans: Array.isArray(row.humans) ? row.humans : [],
    platform: row.made === 'no_ai' ? '' : (row.platform || ''),
    badges: Array.isArray(row.badges) ? row.badges : badgesFor(row.made, row.humans),
    audio_name: row.audio_name || '',
    created_at: row.created_at,
  };
}

async function listPosts() {
  await db.migrate();
  const rows = await db.query(
    'SELECT id, user_id, artist_name, title, made, humans, platform, badges, audio_name, created_at FROM community_posts ORDER BY created_at DESC LIMIT 100'
  );
  return rows.map(publicPost);
}

async function insertPost(input) {
  const made = String((input && input.made) || '');
  if (!MADE[made]) {
    const err = new Error('Pick Full AI, AI assisted, or No AI.');
    err.status = 400;
    throw err;
  }
  const title = String((input && input.title) || '').trim().slice(0, 120);
  if (!title) {
    const err = new Error('Title is required.');
    err.status = 400;
    throw err;
  }
  const humans = made === 'ai_assisted' ? cleanHumans(input.humans) : [];
  const platform = made === 'no_ai' ? '' : String((input && input.platform) || '').trim().slice(0, 40);
  const badges = badgesFor(made, humans);
  await db.migrate();
  const rows = await db.query(
    `INSERT INTO community_posts (user_id, artist_name, title, made, humans, platform, badges, audio_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, user_id, artist_name, title, made, humans, platform, badges, audio_name, created_at`,
    [
      input.user_id || null,
      String((input && input.artist_name) || '').trim().slice(0, 80),
      title,
      made,
      humans,
      platform,
      badges,
      String((input && input.audio_name) || '').trim().slice(0, 180),
    ]
  );
  return publicPost(rows[0]);
}

module.exports = {
  badgesFor,
  insertPost,
  listPosts,
  publicPost,
};
