'use strict';

// ============================================================
// Imports and Variables
// ============================================================
const { v4: uuidv4 } = require('uuid');

const {
  getSessions, getSession, createSession, updateSessionStatus, deleteSession,
  getDriversBySession, getDriver, driverNameExists, getUsedCarNumbers,
  addDriver, updateDriver, removeDriver,
  recordLap, getRaceState, setRaceState, computeLeaderboard,
} = require('./db');

// Timer handle — keeps track of the running setInterval
let raceTimerInterval = null;

// Namespace references — stored so broadcastState() can reach all of them
let io = null;
let nsPublic = null, nsFrontDesk = null, nsRaceCtrl = null, nsLapTracker = null;

// ============================================================
// broadcastState() — push the full app state to every client
// ============================================================
// Rather than sending partial updates, we always send the complete picture.
// Clients simply replace their local state on each update — simple and reliable.
async function broadcastState() {
  try {
    const raceState = await getRaceState();

    // Active session data
    let currentSession = null, currentDrivers = [], leaderboard = [];
    if (raceState.current_session_id) {
      currentSession = await getSession(raceState.current_session_id);
      if (currentSession) {
        currentDrivers = await getDriversBySession(currentSession.id);
        leaderboard = await computeLeaderboard(currentSession.id);
      }
    }

    // Timer — how many ms are left in the race
    let timerRemaining = raceState.duration_ms;
    if (raceState.started_at && raceState.ended_at) {
      timerRemaining = 0;
    } else if (raceState.started_at && !raceState.ended_at) {
      timerRemaining = Math.max(0, raceState.duration_ms - (Date.now() - raceState.started_at));
    }

    // Upcoming sessions
    const pendingSessions = await getSessions('pending');
    const nextSession = pendingSessions[0] || null;
    const nextDrivers = nextSession ? await getDriversBySession(nextSession.id) : [];

    // Map of all pending session IDs → their drivers (for the front-desk view)
    const allPendingDrivers = {};
    for (const s of pendingSessions) {
      allPendingDrivers[s.id] = await getDriversBySession(s.id);
    }

    // Last ended session — shown on leaderboard/next-race after race ends
    const allSessions = await getSessions();
    const endedSessions = allSessions.filter(s => s.status === 'ended')
      .sort((a, b) => b.created_at - a.created_at);
    const lastSession = endedSessions[0] || null;
    let lastLeaderboard = [];
    if (lastSession && !currentSession) {
      lastLeaderboard = await computeLeaderboard(lastSession.id);
    }

    const state = {
      raceState, currentSession, currentDrivers, leaderboard,
      pendingSessions, nextSession, nextDrivers, allPendingDrivers,
      lastSession, lastLeaderboard, timerRemaining,
    };

    // Send to all namespaces
    if (nsPublic) nsPublic.emit('state:full', state);
    if (nsFrontDesk) nsFrontDesk.emit('state:full', state);
    if (nsRaceCtrl) nsRaceCtrl.emit('state:full', state);
    if (nsLapTracker) nsLapTracker.emit('state:full', state);

  } catch (err) {
    console.error('broadcastState error:', err);
  }
}