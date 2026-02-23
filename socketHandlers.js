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

// ============================================================
// startRaceTimer(durationMs, startedAt)
// ============================================================
// Runs every second. When time runs out, sets mode to 'finish' and broadcasts.
// The actual countdown display is handled client-side from startedAt + durationMs.
function startRaceTimer(durationMs, startedAt) {
  if (raceTimerInterval) { clearInterval(raceTimerInterval); raceTimerInterval = null; }

  raceTimerInterval = setInterval(async () => {
    try {
      const elapsed = Date.now() - startedAt;
      const remaining = durationMs - elapsed;

      if (remaining <= 0) {
        clearInterval(raceTimerInterval);
        raceTimerInterval = null;

        const raceState = await getRaceState();
        // Only auto-finish if something hasn't already finished/ended the race
        if (raceState.mode !== 'finish' && raceState.mode !== 'idle') {
          console.log('Race timer expired — auto-finishing');
          await setRaceState({ mode: 'finish', ended_at: Date.now() });
          await broadcastState();
        }
      }
    } catch (err) {
      console.error('Timer tick error:', err);
    }
  }, 1000);
}

// ============================================================
// setupAuthNamespace(path, expectedKey)
// ============================================================
// This helper function creates a Namespace for a specific
// role, like the Safety Official or Receptionist. 
//
// It adds Middleware that checks if the user has the 
// correct password before letting them in.
function setupAuthNamespace(namespacePath, expectedKey) {
  // 1. Create the restricted namespace (e.g., "/race-control")
  const ns = io.of(namespacePath);

  // 2. Add the Middleware
  // This function runs every single time someone tries to connect to this namespace.
  ns.use((socket, next) => {
    // Check the "handshake" data sent by the browser. 
    // We look specifically in the 'auth' pocket for the 'key'.
    if (socket.handshake.auth.key === expectedKey) {
      // SUCCESS: The keys match! Call next() to let them into the room.
      console.log(`Authenticated connection to ${namespacePath}`);
      next();
    } else {
      // FAILURE: The keys do NOT match.
      console.warn(`Failed auth attempt on ${namespacePath}`);

      // We add a 500ms (half-second) delay before telling them "No." This is a simple way to make brute-force attacks less effective.
      setTimeout(() => next(new Error('AUTH_FAILED')), 500);
    }
  });

  // Return the created namespace so we can use it elsewhere
  return ns;
}

// ============================================================
// setupSockets(ioServer, raceDurationMs) — main entry point
// ============================================================
async function setupSockets(ioServer, raceDurationMs) {
  io = ioServer;

  const RECEPTIONIST_KEY = process.env.RECEPTIONIST_KEY;
  const OBSERVER_KEY = process.env.OBSERVER_KEY;
  const SAFETY_KEY = process.env.SAFETY_KEY;

  nsPublic = io.of('/public');
  nsFrontDesk = setupAuthNamespace('/front-desk', RECEPTIONIST_KEY);
  nsRaceCtrl = setupAuthNamespace('/race-control', SAFETY_KEY);
  nsLapTracker = setupAuthNamespace('/lap-tracker', OBSERVER_KEY);

  const raceState = await getRaceState();

  // Resume timer if server restarted mid-race
  if (raceState.started_at && !raceState.ended_at) {
    const remaining = raceState.duration_ms - (Date.now() - raceState.started_at);
    if (remaining > 0) {
      console.log(`Resuming race timer — ${Math.round(remaining / 1000)}s left`);
      startRaceTimer(raceState.duration_ms, raceState.started_at);
    } else {
      console.log('Race expired during downtime — finishing now');
      await setRaceState({ mode: 'finish', ended_at: Date.now() });
    }
  }

  // ---- PUBLIC namespace ----
  nsPublic.on('connection', async (socket) => {
    console.log(`Public client connected: ${socket.id}`);
    await broadcastState();
    socket.on('disconnect', () => console.log(`Public client disconnected: ${socket.id}`));
  });

  // ---- FRONT DESK namespace ----
  nsFrontDesk.on('connection', async (socket) => {
    console.log(`Front-desk connected: ${socket.id}`);
    await broadcastState();

    // Create a new race session named "Race {n}" where n is the total number of sessions + 1
    socket.on('session:create', async () => {
      try {
        const all = await getSessions();
        const sessionName = `Race ${all.length + 1}`;
        const sessionId = uuidv4();
        await createSession(sessionId, sessionName);
        console.log(`Created session: ${sessionName}`);
        await broadcastState();
      } catch (err) {
        console.error('session:create error:', err);
        socket.emit('error:msg', 'Failed to create session');
      }
    });

    // Delete a pending session
    socket.on('session:delete', async ({ sessionId }) => {
      try {
        const session = await getSession(sessionId);
        if (!session) return socket.emit('error:msg', 'Session not found');
        if (session.status !== 'pending') return socket.emit('error:msg', 'Cannot delete a session that has already started');
        await deleteSession(sessionId);
        console.log(`Deleted session: ${sessionId}`);
        await broadcastState();
      } catch (err) {
        console.error('session:delete error:', err);
        socket.emit('error:msg', 'Failed to delete session');
      }
    });

    // Add a driver to a pending session
    socket.on('driver:add', async ({ sessionId, name, carNumber }) => {
      try {
        const session = await getSession(sessionId);
        if (!session) return socket.emit('error:msg', 'Session not found');
        if (session.status !== 'pending') return socket.emit('error:msg', 'Cannot add drivers after race has started');

        const trimmedName = (name || '').trim();
        if (!trimmedName) return socket.emit('error:msg', 'Driver name cannot be empty');
        if (await driverNameExists(sessionId, trimmedName)) {
          return socket.emit('error:msg', `A driver named "${trimmedName}" already exists in this session`);
        }

        const usedCars = await getUsedCarNumbers(sessionId);
        if (usedCars.length >= 8) return socket.emit('error:msg', 'Maximum 8 drivers per session');

        let assignedCar = carNumber ? parseInt(carNumber) : null;
        if (assignedCar !== null) {
          if (assignedCar < 1 || assignedCar > 8) return socket.emit('error:msg', 'Car number must be between 1 and 8');
          if (usedCars.includes(assignedCar)) return socket.emit('error:msg', `Car ${assignedCar} is already taken`);
        } else {
          // Auto-assign: pick the lowest available car number
          for (let i = 1; i <= 8; i++) {
            if (!usedCars.includes(i)) { assignedCar = i; break; }
          }
        }

        await addDriver(uuidv4(), sessionId, trimmedName, assignedCar);
        console.log(`Added driver: ${trimmedName} (Car ${assignedCar}) to session ${sessionId}`);
        await broadcastState();
      } catch (err) {
        console.error('driver:add error:', err);
        socket.emit('error:msg', 'Failed to add driver');
      }
    });

    // Edit a driver's name / car number
    socket.on('driver:update', async ({ driverId, name, carNumber }) => {
      try {
        const driver = await getDriver(driverId);
        if (!driver) return socket.emit('error:msg', 'Driver not found');
        const session = await getSession(driver.session_id);
        if (session.status !== 'pending') return socket.emit('error:msg', 'Cannot edit drivers after race has started');

        const trimmedName = (name || '').trim();
        if (!trimmedName) return socket.emit('error:msg', 'Driver name cannot be empty');
        if (await driverNameExists(driver.session_id, trimmedName, driverId)) {
          return socket.emit('error:msg', `A driver named "${trimmedName}" already exists`);
        }

        const newCar = parseInt(carNumber);
        if (isNaN(newCar) || newCar < 1 || newCar > 8) return socket.emit('error:msg', 'Car number must be 1–8');

        // Make sure the car isn't taken by another driver in this session
        const allDrivers = await getDriversBySession(driver.session_id);
        const conflictDriver = allDrivers.find(d => d.car_number === newCar && d.id !== driverId);
        if (conflictDriver) return socket.emit('error:msg', `Car ${newCar} is assigned to ${conflictDriver.name}`);

        await updateDriver(driverId, trimmedName, newCar);
        console.log(`Updated driver ${driverId}: ${trimmedName} (Car ${newCar})`);
        await broadcastState();
      } catch (err) {
        console.error('driver:update error:', err);
        socket.emit('error:msg', 'Failed to update driver');
      }
    });

    // Remove a driver from a pending session
    socket.on('driver:remove', async ({ driverId }) => {
      try {
        const driver = await getDriver(driverId);
        if (!driver) return socket.emit('error:msg', 'Driver not found');
        const session = await getSession(driver.session_id);
        if (session.status !== 'pending') return socket.emit('error:msg', 'Cannot remove drivers after race has started');
        await removeDriver(driverId);
        console.log(`Removed driver: ${driverId}`);
        await broadcastState();
      } catch (err) {
        console.error('driver:remove error:', err);
        socket.emit('error:msg', 'Failed to remove driver');
      }
    });

    socket.on('disconnect', () => console.log(`Front-desk disconnected: ${socket.id}`));
  });

}