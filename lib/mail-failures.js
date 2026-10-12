'use strict';

/**
 * Artist mail that did not send. Owner desk reads the list.
 * Memory when accounts are in memory or no database is configured.
 * Never store a password, key, or secret.
 */

const crypto = require('crypto');
const db = require('./db');

const TEXT_MAX = 500;
const LIST_MAX = 200;

let rows = [];
let forceMemory = false;

function resetStore() {
  forceMemory = false;
  rows = [];
}

function useMemoryStore() {
  forceMemory = true;
  rows = [];
  return rows;
}

function usingAccountsMemory() {
  try {
    const accounts = require('./accounts');
    return typeof accounts.usingMemory === 'function' && accounts.usingMemory();
  } catch (err) {
    return false;
  }
}

function memoryMode() {
  if (forceMemory) return true;
  if (usingAccountsMemory()) return true;
  return !db.hasDatabase();
}

function clip(value, max) {
  return String(value || '')
    .replace(/[\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function safeText(value, max) {
  const text = clip(value, max);
  if (/password|api[\s_-]*key|secret|bearer|authorization/i.test(text)) return 'Hidden';
  return text;
}

function publicRow(row) {
  return {
    id: String(row.id || ''),
    kind: String(row.kind || ''),
    event_name: String(row.event_name || ''),
    to_email: String(row.to_email || ''),
    subject: String(row.subject || ''),
    error: String(row.error || ''),
    release_id: String(row.release_id || ''),
    created_at: row.created_at ? new Date(row.created_at).toISOString() : '',
  };
}

function normalize(input) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    id: crypto.randomUUID(),
    kind: safeText(source.kind || 'artist', 40),
    event_name: safeText(source.event_name || source.eventName, 80),
    to_email: safeText(source.to_email || source.email, 200).toLowerCase(),
    subject: safeText(source.subject, TEXT_MAX),
    error: safeText(source.error, TEXT_MAX) || 'Could not send the email.',
    release_id: safeText(source.release_id || source.releaseId, 80),
    created_at: new Date().toISOString(),
  };
}

async function ready() {
  if (memoryMode()) return;
  const accounts = require('./accounts');
  await accounts.ensureReady();
}

async function recordMailFailure(input) {
  try {
    const row = normalize(input);
    if (memoryMode()) {
      rows.unshift(row);
      if (rows.length > LIST_MAX) rows.length = LIST_MAX;
      return publicRow(row);
    }
    await ready();
    const inserted = await db.query(
      'INSERT INTO mail_failures (kind, event_name, to_email, subject, error, release_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, kind, event_name, to_email, subject, error, release_id, created_at',
      [row.kind, row.event_name, row.to_email, row.subject, row.error, row.release_id]
    );
    return publicRow(inserted[0] || row);
  } catch (err) {
    return null;
  }
}

async function listMailFailures() {
  if (memoryMode()) {
    return rows.slice(0, LIST_MAX).map(publicRow);
  }
  await ready();
  const listed = await db.query(
    'SELECT id, kind, event_name, to_email, subject, error, release_id, created_at FROM mail_failures ORDER BY created_at DESC LIMIT 200'
  );
  return (listed || []).map(publicRow);
}

module.exports = {
  listMailFailures,
  recordMailFailure,
  resetStore,
  useMemoryStore,
};
