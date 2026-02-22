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