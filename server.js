/**
 * server.js — Backend Entry Point
 * =================================
 * First file that runs on "npm start" or "npm run dev".
 *
 * What it does:
 *   1. Load environment variables from .env
 *   2. Validate required access keys — exit immediately if missing
 *   3. Create an HTTP server with Express as the base
 *   4. Attach Socket.IO for real-time communication
 *   5. Initialize the SQLite database
 *   6. Start listening for connections on port 3000
 *
 * NETWORK:
 *   Binds to 0.0.0.0 (all interfaces) so any device on the
 *   same Wi-Fi or LAN can connect — not just localhost.
 */

'use strict';

// ============================================================
// Step 1: Load environment variables from .env file
// ============================================================
// The "dotenv" package reads .env and adds each line to process.env.
// This is optional — if .env doesn't exist, dotenv does nothing.
// Variables set in the shell BEFORE running npm start take priority.
require('dotenv').config();

// ============================================================
// Step 2: Validate required environment variables
// ============================================================
// These three access keys MUST be set. If any are missing, we print
// a helpful usage message and exit immediately rather than starting
// a server that would silently accept any key.
const REQUIRED_VARS = ['RECEPTIONIST_KEY', 'OBSERVER_KEY', 'SAFETY_KEY'];
const missingVars = REQUIRED_VARS.filter(v => !process.env[v]);

if (missingVars.length > 0) {
  console.error('\nERROR: Missing required environment variables:\n');
  missingVars.forEach(v => console.error(`   ${v}  (not set)`));
  console.error(`
Usage:
  Set the following environment variables before starting the server.

  On Windows (PowerShell):
    $env:RECEPTIONIST_KEY="your-receptionist-key"
    $env:OBSERVER_KEY="your-observer-key"
    $env:SAFETY_KEY="your-safety-key"
    npm start

  On Mac/Linux (bash):
    export RECEPTIONIST_KEY="your-receptionist-key"
    export OBSERVER_KEY="your-observer-key"
    export SAFETY_KEY="your-safety-key"
    npm start

  Or create a .env file in the project root:
    RECEPTIONIST_KEY=your-receptionist-key
    OBSERVER_KEY=your-observer-key
    SAFETY_KEY=your-safety-key

  Then run: npm start
`);
  process.exit(1); // Exit with error code 1 to signal failure
}

// ============================================================
// Step 3: Determine race duration (dev mode vs production)
// ============================================================
// "npm run dev" sets NODE_ENV=development via cross-env.
// Dev mode = 1 minute races (60,000ms) for easier testing.
// Production mode = 10 minute races (600,000ms).
const IS_DEV = process.env.NODE_ENV === 'development';
const RACE_DURATION = IS_DEV ? 60_000 : 600_000; // milliseconds
const PORT = parseInt(process.env.PORT || '3000');

console.log(`\nBeachside Racetrack — Starting in ${IS_DEV ? 'DEVELOPMENT' : 'PRODUCTION'} mode`);
console.log(`Race duration: ${RACE_DURATION / 1000} seconds`);

// ============================================================
// Imports
// ============================================================
const express = require('express');    // Web framework (base for http server)
const http = require('http');       // Node's built-in HTTP module
const path = require('path');       // Node's built-in Path module
const { Server } = require('socket.io'); // Real-time communication library

const { initDb } = require('./db');
const { setupSockets } = require('./socketHandlers');

// ============================================================
// Step 4: Create Express app and HTTP server
// ============================================================
// Express is used as the base handler for the HTTP server.
// Socket.IO attaches to this same server — both HTTP and WebSocket
// connections are served from the same port.
const app = express();
const server = http.createServer(app);

// ============================================================
// Step 4.5: Serve Static Files and UI Routes
// ============================================================
// Serve everything in the /public folder (CSS, Client JS, Images)
app.use(express.static(path.join(__dirname, 'public')));

// Explicitly handle UI routes by serving their index.html files.
// This ensures that navigating to /front-desk directly works.
const UI_ROUTES = [
  '/front-desk', '/race-control', '/lap-line-tracker',
  '/leader-board', '/next-race', '/race-countdown', '/race-flags'
];

UI_ROUTES.forEach(route => {
  app.get(route, (req, res) => {
    // Each route corresponds to a folder in /public with an index.html
    const folder = route.startsWith('/') ? route.substring(1) : route;
    res.sendFile(path.join(__dirname, 'public', folder, 'index.html'));
  });
});

// ============================================================
// Step 5: Configure Socket.IO
// ============================================================
// cors: { origin: '*' } allows any frontend — browser, mobile app,
// or another web server — to connect to this Socket.IO endpoint.
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// ============================================================
// Step 6: Initialize database and start server
// ============================================================
// We wrap everything in an immediately-invoked async function (IIFE)
// because "await" can only be used inside an async function, and we
// need to wait for the database to be ready before accepting connections.
(async () => {
  try {
    // Create database tables if they don't already exist
    await initDb();

    // Register all Socket.IO namespaces and event handlers
    await setupSockets(io, RACE_DURATION);

    // Start listening — 0.0.0.0 means all network interfaces (not just localhost)
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`\nServer running!`);
      console.log(`   Local:   http://localhost:${PORT}`);
      console.log(`   Network: http://<your-ip>:${PORT}`);
      console.log(`\n   Access Keys loaded:`);
      console.log(`   RECEPTIONIST_KEY = ${process.env.RECEPTIONIST_KEY}`);
      console.log(`   OBSERVER_KEY     = ${process.env.OBSERVER_KEY}`);
      console.log(`   SAFETY_KEY       = ${process.env.SAFETY_KEY}`);
      console.log();
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
})();
