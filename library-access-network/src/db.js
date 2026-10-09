'use strict';
// Local JSON-file data store. All reads and writes go through this module so it
// can later be swapped for SQLite or a hosted database without touching routes.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { buildSeed } = require('./seed');

const DATA_FILE = process.env.LAN_DATA_FILE || path.join(__dirname, '..', 'data', 'db.json');

let data = null;

function load() {
  if (data) return data;
  if (fs.existsSync(DATA_FILE)) {
    data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } else {
    data = buildSeed();
    save();
  }
  return data;
}

function save() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, DATA_FILE); // atomic replace
}

function reset() {
  data = buildSeed();
  save();
  return data;
}

const newId = (prefix) => `${prefix}-${crypto.randomBytes(4).toString('hex')}`;
const now = () => new Date().toISOString();

function all(table) { return load()[table]; }
function get(table, id) { return load()[table].find((row) => row.id === id) || null; }
function where(table, fn) { return load()[table].filter(fn); }

function insert(table, row) {
  const record = { id: newId(table.slice(0, 3)), createdAt: now(), ...row };
  load()[table].push(record);
  save();
  return record;
}

function update(table, id, changes, { touch = true } = {}) {
  const row = get(table, id);
  if (!row) return null;
  Object.assign(row, changes, touch ? { updatedAt: now() } : {});
  save();
  return row;
}

module.exports = { load, save, reset, all, get, where, insert, update, now, DATA_FILE };
