'use strict';

// ============================================================
// Step 1: Load environment variables from .env file
// ============================================================
// The "dotenv" package reads a file called ".env" in the project root
// and adds those key=value pairs to process.env.
// If .env doesn't exist, dotenv does nothing.
// Variables set in the shell BEFORE running npm start take priority.
require('dotenv').config();

// ============================================================
// Step 2: Validate required environment variables
// ============================================================
// These three access keys MUST be set. If any are missing, we print
// a helpful usage message and exit immediately.
const REQUIRED_VARS = ['RECEPTIONIST_KEY', 'OBSERVER_KEY', 'SAFETY_KEY'];
const missingVars = REQUIRED_VARS.filter(v => !process.env[v]);

if (missingVars.length > 0) {
  console.error('\nERROR: Missing required environment variables:\n');
  missingVars.forEach(v => console.error(`   ${v}  (not set)`));
  console.error(`
Usage:
  Set the following environment variables in the cmd before starting the server.

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
// When started with "npm run dev", NODE_ENV is set to "development".
// In dev mode the race lasts 1 minute (60,000ms) instead of 10 minutes (600,000ms).
const IS_DEV = process.env.NODE_ENV === 'development';
const RACE_DURATION = IS_DEV ? 60_000 : 600_000; // milliseconds
const PORT = parseInt(process.env.PORT || '3000');

console.log(`\nBeachside Racetrack — Starting in ${IS_DEV ? 'DEVELOPMENT' : 'PRODUCTION'} mode`);
console.log(`Race duration: ${RACE_DURATION / 1000} seconds`);

// ============================================================
// Imports
// ============================================================
const express = require('express');           // ExpressJS framework
const http = require('http');                 // Node's built-in HTTP module
const { Server } = require('socket.io');      // Real-time communication
const path = require('path');                 // File path utilities

const { initDb } = require('./db');
const { setupSockets } = require('./socketHandlers');