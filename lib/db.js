'use strict';

/**
 * Neon-friendly Postgres access. DATABASE_URL is server-only.
 * Schema is applied once per process on first auth request.
 */

const fs = require('fs');
const path = require('path');

const SCHEMA_PATH = path.join(__dirname, '..', 'schema.sql');

let sqlClient = null;
let migrated = false;
let migratePromise = null;

function databaseUrl() {
  return String(process.env.DATABASE_URL || '').trim();
}

function hasDatabase() {
  return Boolean(databaseUrl());
}

function asRows(result) {
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.rows)) return result.rows;
  return [];
}

function getSql() {
  if (!hasDatabase()) return null;
  if (!sqlClient) {
    const { neon } = require('@neondatabase/serverless');
    sqlClient = neon(databaseUrl());
  }
  return sqlClient;
}

async function query(text, params) {
  const sql = getSql();
  if (!sql) {
    const err = new Error('Accounts are not configured.');
    err.code = 'ACCOUNTS_UNCONFIGURED';
    throw err;
  }
  const result = params && params.length
    ? await sql.query(text, params)
    : await sql.query(text);
  return asRows(result);
}

function splitStatements(sqlText) {
  return String(sqlText || '')
    .split(/;\s*\n/)
    .map((part) => part.replace(/--[^\n]*/g, '').trim())
    .filter(Boolean)
    .map((part) => (part.endsWith(';') ? part : part + ';'));
}

async function migrate() {
  if (migrated) return;
  if (migratePromise) {
    await migratePromise;
    return;
  }
  migratePromise = (async () => {
    const sqlText = fs.readFileSync(SCHEMA_PATH, 'utf8');
    const statements = splitStatements(sqlText);
    for (let i = 0; i < statements.length; i += 1) {
      await query(statements[i]);
    }
    migrated = true;
  })();
  try {
    await migratePromise;
  } finally {
    migratePromise = null;
  }
}

function resetClientForTests() {
  sqlClient = null;
  migrated = false;
  migratePromise = null;
}

module.exports = {
  asRows,
  databaseUrl,
  getSql,
  hasDatabase,
  migrate,
  query,
  resetClientForTests,
  splitStatements,
};
