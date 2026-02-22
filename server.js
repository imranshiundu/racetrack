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