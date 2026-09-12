'use strict';

const { sessionFromRequest } = require('../lib/auth');
const { insertPost, listPosts } = require('../lib/community-posts');
const { readBody, sendJson } = require('../lib/tonegrid');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method === 'GET') {
    try {
      const posts = await listPosts();
      sendJson(res, 200, { posts: posts });
    } catch (err) {
      sendJson(res, 500, { error: err && err.message ? err.message : 'Could not load Community.' });
    }
    return;
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    sendJson(res, 405, { error: 'Method not allowed.' });
    return;
  }
  const session = sessionFromRequest(req);
  if (!session || !session.id) {
    sendJson(res, 401, { error: 'Sign in to post.' });
    return;
  }
  let body;
  try {
    body = await readBody(req);
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON.' });
    return;
  }
  try {
    const post = await insertPost({
      user_id: session.id,
      artist_name: session.artist_name || session.name || '',
      title: body && body.title,
      made: body && body.made,
      humans: body && body.humans,
      platform: body && body.platform,
      audio_name: body && body.audio_name,
    });
    sendJson(res, 201, { post: post });
  } catch (err) {
    sendJson(res, err && err.status ? err.status : 500, {
      error: err && err.message ? err.message : 'Could not post.',
    });
  }
};
