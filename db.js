/**
 * db.js — SQLite database layer
 *
 * This file handles everything data-related:
 *   - Creating the tables on first run
 *   - Reading and writing sessions, drivers, lap times, and race state
 *   - Computing the leaderboard standings
 *
 * We use `sqlite3` with Promises so the rest of the code can use async/await
 * instead of nested callbacks.
 */

'use strict';

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// The database file lives next to this file.
const DB_PATH = path.join(__dirname, 'racetrack.db');

// Open (or create) the database file.
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) { console.error('Could not open database:', err.message); }
  else { console.log(`Connected to SQLite database at ${DB_PATH}`); }
});

// ---- Promise wrappers ----
// sqlite3 uses callbacks. These wrappers let us use async/await instead.

// Run a query that changes data (INSERT / UPDATE / DELETE)
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err); else resolve(this);
    });
  });
}

// Fetch a single row
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err); else resolve(row);
    });
  });
}

// Fetch multiple rows
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err); else resolve(rows);
    });
  });
}


// ============================================================
// initDb() — Create tables and seed initial data
// ============================================================
// Called once on server startup. Uses "CREATE TABLE IF NOT EXISTS"
// so re-running it on restart is safe — it won't wipe existing data.
async function initDb() {
  // sessions — one row per race session
  await run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,           -- UUID
      name TEXT NOT NULL,            -- e.g. "Race 1"
      status TEXT DEFAULT 'pending', -- pending | active | ended
      created_at INTEGER DEFAULT (strftime('%s','now') * 1000)
    )
  `);

  // drivers — one row per driver, linked to a session
  await run(`
    CREATE TABLE IF NOT EXISTS drivers (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      name TEXT NOT NULL,
      car_number INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    )
  `);

  // lap_times — one row each time a car crosses the lap line
  await run(`
    CREATE TABLE IF NOT EXISTS lap_times (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      car_number INTEGER NOT NULL,
      crossing_time INTEGER NOT NULL  -- Unix timestamp in ms
    )
  `);

  // race_state — a single row (id=1) that holds the live race status
  await run(`
    CREATE TABLE IF NOT EXISTS race_state (
      id INTEGER PRIMARY KEY DEFAULT 1,
      current_session_id TEXT DEFAULT NULL,
      mode TEXT DEFAULT 'idle',            -- idle | safe | hazard | danger | finish
      started_at INTEGER DEFAULT NULL,     -- when the timer started (ms timestamp)
      ended_at INTEGER DEFAULT NULL,       -- when the race ended (ms timestamp)
      duration_ms INTEGER DEFAULT 600000   -- 10 min prod / 60 sec dev
    )
  `);

  // Insert the race_state row if it doesn't exist yet
  await run(`
    INSERT OR IGNORE INTO race_state (id) VALUES (1)
  `);

  // Enable CASCADE deletes — deleting a session also deletes its drivers and laps
  await run('PRAGMA foreign_keys = ON');

  console.log('✅  Database tables initialized');
}

// ============================================================
// SESSION FUNCTIONS
// ============================================================

// Get sessions, optionally filtered by status ('pending', 'active', 'ended').
// Returns them sorted oldest-first.
async function getSessions(status = null) {
  if (status) {
    return all('SELECT * FROM sessions WHERE status = ? ORDER BY created_at ASC', [status]);
  }
  return all('SELECT * FROM sessions ORDER BY created_at ASC', []);
}

// Fetch a single session by its UUID.
async function getSession(id) {
  return get('SELECT * FROM sessions WHERE id = ?', [id]);
}

// Insert a new session.
// We pass created_at explicitly
async function createSession(id, name) {
  await run(
    'INSERT INTO sessions (id, name, created_at) VALUES (?, ?, ?)',
    [id, name, Date.now()]
  );
}

// Change a session's status (pending → active → ended).
async function updateSessionStatus(id, status) {
  await run('UPDATE sessions SET status = ? WHERE id = ?', [status, id]);
}

// Delete a session (and its drivers/laps, thanks to CASCADE).
async function deleteSession(id) {
  await run('DELETE FROM sessions WHERE id = ?', [id]);
}

// ============================================================
// DRIVER FUNCTIONS
// ============================================================

// Get all drivers in a session, sorted by car number(1-8 ascending).
async function getDriversBySession(sessionId) {
  return all(
    'SELECT * FROM drivers WHERE session_id = ? ORDER BY car_number ASC',
    [sessionId]
  );
}

// Fetch a single driver by their UUID.
async function getDriver(id) {
  return get('SELECT * FROM drivers WHERE id = ?', [id]);
}

// Returns true if a driver with this name already exists in the session.
// Pass excludeId when editing a driver so they can keep their own name.
async function driverNameExists(sessionId, name, excludeId = null) {
  let row;
  if (excludeId) {
    row = await get(
      'SELECT id FROM drivers WHERE session_id = ? AND name = ? AND id != ?',
      [sessionId, name, excludeId]
    );
  } else {
    row = await get(
      'SELECT id FROM drivers WHERE session_id = ? AND name = ?',
      [sessionId, name]
    );
  }
  return !!row;
}

// Returns an array of car numbers already in use for this session (e.g. [1, 3, 5]).
async function getUsedCarNumbers(sessionId) {
  const rows = await all(
    'SELECT car_number FROM drivers WHERE session_id = ?',
    [sessionId]
  );
  return rows.map(r => r.car_number);
}

// Insert a new driver.
async function addDriver(id, sessionId, name, carNumber) {
  await run(
    'INSERT INTO drivers (id, session_id, name, car_number) VALUES (?, ?, ?, ?)',
    [id, sessionId, name, carNumber]
  );
}

// Update a driver's name and car number.
async function updateDriver(id, name, carNumber) {
  await run(
    'UPDATE drivers SET name = ?, car_number = ? WHERE id = ?',
    [name, carNumber, id]
  );
}

// Remove a driver.
async function removeDriver(id) {
  await run('DELETE FROM drivers WHERE id = ?', [id]);
}