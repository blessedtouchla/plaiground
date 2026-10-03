'use strict';

/**
 * One server-side xAI client for Song Helper, Cover Art, Scout, and Scoop.
 * OpenAI-compatible Grok API. The key is read here and never returned.
 * https://api.x.ai/v1
 */

const CHAT_URL = 'https://api.x.ai/v1/chat/completions';
const IMAGE_URL = 'https://api.x.ai/v1/images/generations';

function key() {
  return String(process.env.XAI_API_KEY || '').trim();
}

function configured() {
  return Boolean(key());
}

function chatModel(fallback) {
  return String(process.env.XAI_MODEL || fallback || 'grok-4.20-0309-non-reasoning').trim() || fallback;
}

function imageModel(fallback) {
  return String(process.env.XAI_IMAGE_MODEL || fallback || 'grok-imagine-image-2.0').trim() || fallback;
}

async function postJson(url, bearer, payload, timeoutMs) {
  var controller = typeof AbortController === 'function' ? new AbortController() : null;
  var timer = controller ? setTimeout(function () { controller.abort(); }, timeoutMs || 20000) : null;
  try {
    return await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + bearer,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller ? controller.signal : undefined,
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function chat(opts) {
  var options = opts || {};
  var model = options.model || chatModel();
  var payload = {
    model: model,
    temperature: typeof options.temperature === 'number' ? options.temperature : 0.8,
    max_tokens: options.max_tokens || 1400,
    messages: options.messages || [],
  };
  if (!/non-reasoning/i.test(model) && options.reasoning_effort !== false) {
    payload.reasoning_effort = options.reasoning_effort || 'none';
  }
  var response = await postJson(options.url || CHAT_URL, key(), payload, options.timeoutMs || 20000);
  var data = await response.json().catch(function () { return {}; });
  if (!response.ok) {
    var failure = new Error('xai');
    failure.status = response.status;
    throw failure;
  }
  var content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  return { content: content || '', model: model };
}

module.exports = {
  CHAT_URL: CHAT_URL,
  IMAGE_URL: IMAGE_URL,
  chat: chat,
  chatModel: chatModel,
  configured: configured,
  imageModel: imageModel,
  key: key,
  postJson: postJson,
};
