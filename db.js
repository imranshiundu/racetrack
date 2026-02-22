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