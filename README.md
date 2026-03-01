# Beachside Racetrack — Real-Time Race Management System

A real-time race control and spectator information system for Beachside Racetrack. Built with Node.js, Express, Socket.IO, and SQLite. Every screen — employee dashboards and public displays — updates instantly without page refreshes.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [File Structure](#file-structure)
3. [Requirements](#requirements)
4. [Environment Variables](#environment-variables)
5. [Installation and Setup](#installation-and-setup)
6. [Starting the Server](#starting-the-server)
7. [Interface Routes](#interface-routes)
8. [How the System Works](#how-the-system-works)
9. [Socket.IO Events Reference](#socketio-events-reference)
10. [User Guide](#user-guide)
11. [Testing Interfaces in the Browser](#testing-interfaces-in-the-browser)
12. [Notes for the Frontend Developer](#notes-for-the-frontend-developer)
13. [Extra Features Implemented](#extra-features-implemented)

---

## Project Overview

The system replaces entirely manual race-day workflows at Beachside Racetrack. It serves three employee roles and multiple public displays, all synchronized over WebSockets in real time.

**Employee interfaces** (password-protected):

| Interface       | Role                 | Route              |
|-----------------|----------------------|--------------------|
| Front Desk      | Receptionist         | `/front-desk`      |
| Race Control    | Safety Official      | `/race-control`    |
| Lap-line Tracker| Lap-line Observer    | `/lap-line-tracker`|

**Public displays** (no password, for 40-75 inch screens and spectator devices):

| Interface       | Audience             | Route              |
|-----------------|----------------------|--------------------|
| Leader Board    | Spectators           | `/leader-board`    |
| Next Race       | Race Drivers         | `/next-race`       |
| Race Countdown  | Race Drivers         | `/race-countdown`  |
| Race Flag       | Race Drivers (track) | `/race-flags`      |

---

## File Structure

```
beachside-racetrack/
├── server.js                  # Entry point — Express + Socket.IO bootstrap
├── socketHandlers.js          # All Socket.IO namespaces and event logic
├── db.js                      # SQLite database layer (initDb, all queries)
├── package.json
├── .env                       # Environment variables (not committed to git)
├── .gitignore
├── racetrack.db               # SQLite database (auto-created, not committed)
│
└── public/
    ├── socket-client.js       # Shared frontend auth + socket connection helper
    ├── styles.css             # Shared base styles (if applicable)
    │
    ├── front-desk/            # EMPLOYEE — Receptionist
    │   ├── index.html
    │   ├── script.js
    │   └── style.css
    │
    ├── race-control/          # EMPLOYEE — Safety Official
    │   ├── index.html
    │   ├── script.js
    │   └── style.css
    │
    ├── lap-line-tracker/      # EMPLOYEE — Lap-line Observer
    │   ├── index.html
    │   ├── script.js
    │   └── style.css
    │
    ├── leader-board/          # PUBLIC DISPLAY — Spectator leaderboard
    │   └── index.html
    │
    ├── next-race/             # PUBLIC DISPLAY — Upcoming drivers list
    │   └── index.html
    │
    ├── race-countdown/        # PUBLIC DISPLAY — Full-screen race timer
    │   └── index.html
    │
    └── race-flags/            # PUBLIC DISPLAY — Full-screen flag color
        └── index.html
```

The `leader-board`, `next-race`, `race-countdown`, and `race-flags` directories currently each contain only an `index.html` with inline JavaScript. The frontend developer can split these into separate `script.js` and `style.css` files at their discretion — the server will serve any static file under `/public` automatically.

---

## Requirements

- Node.js v24 or later
- npm

No external database software is needed. SQLite is bundled via the `sqlite3` npm package.

---

## Environment Variables

The server **refuses to start** if any of the three access keys are missing. This prevents the system from running in an insecure state.

| Variable          | Purpose                                          | Example value  |
|-------------------|--------------------------------------------------|----------------|
| `RECEPTIONIST_KEY`| Password for the Front Desk interface            | `8ded6076`     |
| `SAFETY_KEY`      | Password for the Race Control interface          | `a2d393bc`     |
| `OBSERVER_KEY`    | Password for the Lap-line Tracker interface      | `662e0f6c`     |
| `PORT`            | HTTP port the server listens on (default: 3000)  | `3000`         |

Create a `.env` file in the project root (this file is excluded from git):

```
RECEPTIONIST_KEY=8ded6076
SAFETY_KEY=a2d393bc
OBSERVER_KEY=662e0f6c
PORT=3000
```

Alternatively, export variables in your shell before running the server:

```bash
export RECEPTIONIST_KEY=8ded6076
export SAFETY_KEY=a2d393bc
export OBSERVER_KEY=662e0f6c
npm start
```

---

## Installation and Setup

```bash
# 1. Clone the repository
git clone https://gitea.kood.tech/imranshiundu/info-screens.git
cd info-screens

# 2. Install dependencies
npm install

# 3. Create your .env file
cp .env.example .env    # or create .env manually with the variables listed above
```

---

## Starting the Server

**Production mode** — race sessions last 10 minutes:

```bash
npm start
```

**Development mode** — race sessions last 1 minute (faster testing):

```bash
npm run dev
```

Once started, you will see output like:

```
Beachside Racetrack — Starting in PRODUCTION mode
Race duration: 600 seconds

Server running!
   Local:   http://localhost:3000
   Network: http://<your-ip>:3000

   Access Keys loaded:
   RECEPTIONIST_KEY = 8ded6076
   OBSERVER_KEY     = 662e0f6c
   SAFETY_KEY       = a2d393bc
```

The server binds to `0.0.0.0`, so any device on the same network can connect using the machine's IP address. To expose it over the internet (for remote displays or review), use a tunneling tool like `ngrok`:

```bash
ngrok http 3000
```

This produces a public URL such as `https://866ed777.ngrok.io`. All routes work under that URL without any configuration change.

---

## Interface Routes

All routes are served at the first level. Open these in a browser after the server is running.

### Employee Interfaces (require access key)

| Route               | URL example                              |
|---------------------|------------------------------------------|
| `/front-desk`       | `http://localhost:3000/front-desk`       |
| `/race-control`     | `http://localhost:3000/race-control`     |
| `/lap-line-tracker` | `http://localhost:3000/lap-line-tracker` |

### Public Displays (no login required)

| Route               | URL example                              |
|---------------------|------------------------------------------|
| `/leader-board`     | `http://localhost:3000/leader-board`     |
| `/next-race`        | `http://localhost:3000/next-race`        |
| `/race-countdown`   | `http://localhost:3000/race-countdown`   |
| `/race-flags`       | `http://localhost:3000/race-flags`       |

---

## How the System Works

### Authentication

Each employee interface shows an access key prompt when first loaded. The key is sent as part of the Socket.IO connection handshake. The server validates it server-side using Socket.IO middleware before allowing the connection to complete. If the key is wrong, the server waits 500 ms before responding with an error (to slow down guessing). The client displays the error message and re-prompts.

No REST API is used. All data — including authentication — flows through Socket.IO.

### Real-Time State

The server maintains one authoritative state object assembled from the SQLite database. Whenever anything changes (a lap is recorded, mode is changed, session created, etc.), the server calls `broadcastState()`, which pushes the full state object to every connected client across all namespaces. Clients replace their local state entirely on each update. There is no partial patching.

The Socket.IO event that carries this is `state:full`. All interfaces listen for it.

### Socket.IO Namespaces

| Namespace      | Who connects       | Auth required |
|----------------|---------------------|---------------|
| `/public`      | Public displays     | No            |
| `/front-desk`  | Receptionist        | Yes           |
| `/race-control`| Safety Official     | Yes           |
| `/lap-tracker` | Lap-line Observer   | Yes           |

### Race State Machine

The `race_state` table in SQLite holds a single row describing the current state of the system. The `mode` field controls what every display shows.

```
idle  →  safe  →  hazard / danger (interchangeable during live race)
                →  finish  →  [race:end event]  →  danger  →  idle (next session)
```

| Mode     | Meaning                                      | Flag display color      |
|----------|----------------------------------------------|-------------------------|
| `idle`   | No active session                            | Dark / off              |
| `safe`   | Race running, track is clear                 | Solid green             |
| `hazard` | Race running, slow down                      | Solid yellow            |
| `danger` | Stop / track being cleared                   | Solid red               |
| `finish` | Race over, return to pit lane                | Chequered black/white   |

Once the mode is set to `finish`, it cannot be changed back to any other mode. The only next action is `race:end`.

### Timer

The timer is started server-side when a race begins. The server stores the `started_at` timestamp and `duration_ms` in the database. Clients compute countdown locally from these two values and re-sync on every `state:full` event. The server also runs a `setInterval` that fires when the timer expires and sets the mode to `finish` automatically. If the server restarts mid-race, the timer resumes from the correct remaining time.

### Data Persistence

All data is stored in `racetrack.db` (SQLite). The server can be restarted without losing sessions, drivers, or lap times. The race timer also resumes correctly on restart. The `.gitignore` excludes the database file to avoid committing race data.

---

## Socket.IO Events Reference

This section describes every event the server accepts and emits. It is intended to give the frontend developer everything needed to build additional displays or modify existing logic.

### Events emitted by the server

#### `state:full`

Sent to all namespaces after any state change. Also sent immediately when a client connects.

**Payload shape:**

```json
{
  "raceState": {
    "id": 1,
    "current_session_id": "uuid-or-null",
    "mode": "safe | hazard | danger | finish | idle",
    "started_at": 1708857600000,
    "ended_at": null,
    "duration_ms": 600000
  },
  "currentSession": { "id": "uuid", "name": "Race 1", "status": "active", "created_at": 1708857600000 },
  "currentDrivers": [
    { "id": "uuid", "session_id": "uuid", "name": "Alice", "car_number": 1 }
  ],
  "leaderboard": [
    {
      "car_number": 1,
      "driver_name": "Alice",
      "laps": 5,
      "fastest_lap_ms": 42000,
      "last_lap_ms": 43200,
      "current_lap": 6
    }
  ],
  "pendingSessions": [ ... ],
  "nextSession": { ... },
  "nextDrivers": [ ... ],
  "allPendingDrivers": { "uuid": [ ... ] },
  "lastSession": { ... },
  "lastLeaderboard": [ ... ],
  "timerRemaining": 312000
}
```

Key notes:
- `currentSession` is `null` when no race is active.
- `leaderboard` reflects the live race. `lastLeaderboard` is shown when there is no active session.
- `timerRemaining` is computed at the moment of broadcast. Clients run their own countdown locally.
- `allPendingDrivers` is keyed by session ID. Used by the Front Desk to render each session's driver list.
- `nextSession` is the first pending session in creation order.

#### `error:msg`

Sent to a specific socket when a server-side operation fails.

```json
"Car 3 is already assigned to Alice"
```

---

### Events emitted by the client

#### Front Desk namespace (`/front-desk`)

**`session:create`** — Create a new pending race session. No payload required. The session is auto-named `Race N` where N is the total number of sessions ever created + 1.

**`session:delete`** — Delete a pending session (and all its drivers).

```json
{ "sessionId": "uuid" }
```

**`driver:add`** — Add a driver to a pending session. `carNumber` is optional; if omitted, the lowest available car number (1-8) is assigned automatically.

```json
{ "sessionId": "uuid", "name": "Alice", "carNumber": 3 }
```

**`driver:update`** — Edit a driver's name or car number. The session must still be pending.

```json
{ "driverId": "uuid", "name": "Alice Updated", "carNumber": 5 }
```

**`driver:remove`** — Remove a driver from a pending session.

```json
{ "driverId": "uuid" }
```

---

#### Race Control namespace (`/race-control`)

**`race:start`** — Start the first pending session. The session must have at least one driver. Starts the race timer and sets mode to `safe`.

No payload.

**`race:mode`** — Change the current flag mode. Valid values: `safe`, `hazard`, `danger`, `finish`. Cannot be called once mode is already `finish`.

```json
{ "mode": "hazard" }
```

**`race:end`** — End the current session. Only valid when mode is `finish`. Sets mode to `danger`, clears `current_session_id`. The Safety Official can then brief the next group.

No payload.

---

#### Lap Tracker namespace (`/lap-tracker`)

**`lap:record`** — Record a lap-line crossing for a car. Only valid when a session is active. Allowed even in `finish` mode. Rejected after `race:end`.

```json
{ "carNumber": 3 }
```

---

## User Guide

This section walks through the complete workflow from setting up a race to finishing it.

### Step 1 — Configure upcoming sessions (Receptionist, Front Desk)

1. Open `http://<server-ip>:3000/front-desk` in the browser at the reception desk.
2. Enter the receptionist access key and click Unlock Dashboard.
3. Click **New Race Session** to create a session. Sessions are named automatically (Race 1, Race 2, etc.).
4. For each driver in the session:
   - Type the driver's name in the text field.
   - Optionally select a car number from the dropdown. Leave it as "Auto Car" to assign the next available car.
   - Click the plus button to add the driver. Up to 8 drivers per session.
5. Use the edit button (pencil icon) on a driver row to change their name.
6. Use the delete button (trash icon) on a driver row to remove them.
7. Use the trash button in the session header to delete an entire session.
8. Repeat for as many sessions as needed. Sessions are shown in creation order.

### Step 2 — Announce next race (Next Race display)

The `/next-race` display updates automatically when the receptionist adds drivers. There is no manual step for the receptionist. Race drivers watching the screen will see their name and car number appear.

### Step 3 — Start the race (Safety Official, Race Control)

1. Open `http://<server-ip>:3000/race-control` on the Safety Official's device (a phone or tablet works well).
2. Enter the safety access key and click Unlock Controls.
3. The right-hand panel shows the next session's driver list for the briefing.
4. Once drivers are briefed and in position, click **START RACE 1** (the large green button).
5. The timer starts, mode is set to Safe (green), and all displays update instantly.

### Step 4 — Record lap times (Lap-line Observer, Lap-line Tracker)

1. Open `http://<server-ip>:3000/lap-line-tracker` on the observer's tablet.
2. Enter the observer access key and click Unlock Tracker.
3. Eight large buttons are shown, one per car. Each button fills the available screen space so they are easy to tap.
4. Press a car's button each time it crosses the lap line. The first press starts that car's timing. Each subsequent press records a completed lap.
5. The driver's name appears on each button once the session is active.
6. Buttons are disabled after the Safety Official ends the session.

### Step 5 — Control race modes (Safety Official, Race Control)

During the race, four flag buttons are visible in Race Control:

| Button      | When to use                                             |
|-------------|---------------------------------------------------------|
| Safe (green)| Track is clear, normal racing                           |
| Hazard (yellow) | Slow down — incident on track, not race-stopping    |
| Danger (red)| Stop — serious incident or hazard requiring track clearance |
| Finish (chequered) | End the race                                   |

Pressing any button instantly updates the `/race-flags` display around the track and the flag indicator on the Leader Board and Lap Tracker.

### Step 6 — Finish the race

**Auto-finish:** When the timer reaches zero, the server automatically sets the mode to Finish. Drivers see the chequered flag display.

**Manual finish:** Press the Finish button in Race Control at any time before the timer runs out.

Once mode is Finish, lap recording still works until the Safety Official ends the session.

### Step 7 — End the session (Safety Official, Race Control)

Once all cars are back in the pit lane:

1. Click **Declare Race Over** (visible in Race Control when mode is Finish).
2. The mode changes to Danger (track not yet safe to enter).
3. The Next Race display shows the upcoming session with a "Proceed to Paddock" alert.
4. The Leader Board continues to show the previous session's results until the next race starts.
5. The Safety Official can now see the next session's driver list for their briefing.

### Step 8 — View the leader board (Spectators)

The `/leader-board` display at `http://<server-ip>:3000/leader-board` requires no login. It shows:

- The current race session name and status.
- A countdown timer showing time remaining.
- The current race flag / mode.
- A ranked table of all drivers, sorted by: most laps completed first, then fastest lap time as a tiebreaker.
- Fastest lap time per driver.
- Lap count per driver.

After a race ends, the last session's results are shown until the next race starts.

---

## Testing Interfaces in the Browser

You can test every aspect of the system using only a browser — no separate API testing tool is needed.

**Testing without a second device:**
Open multiple browser tabs simultaneously. For example:
- Tab 1: `http://localhost:3000/front-desk` — act as Receptionist
- Tab 2: `http://localhost:3000/race-control` — act as Safety Official
- Tab 3: `http://localhost:3000/lap-line-tracker` — act as Observer
- Tab 4: `http://localhost:3000/leader-board` — watch the result update in real time

When you press a button in one tab, the other tabs update immediately.

**Recommended test sequence:**

1. Open all four tabs listed above.
2. In Tab 1 (Front Desk): enter key `8ded6076` and unlock. Create a session. Add 2-3 drivers.
3. Watch Tab 4 (Leader Board) — it still shows "Waiting for green flag" (no active session).
4. In Tab 2 (Race Control): enter key `a2d393bc` and unlock. Click **Start Race 1**. Watch the timer start in Tab 4.
5. In Tab 3 (Lap Tracker): enter key `track789` and unlock. Press the numbered buttons to record laps. Watch the leaderboard in Tab 4 update with lap times.
6. In Tab 2: press Hazard — watch the flag indicator change in Tab 3 and Tab 4.
7. In Tab 2: press Finish — watch the chequered flag appear in `/race-flags` (open in another tab).
8. In Tab 2: click **Declare Race Over**. Watch the next race briefing appear.

**Default access keys (from `.env`):**

| Interface           | Key         |
|---------------------|-------------|
| Front Desk          | `admin123`  |
| Race Control        | `safety456` |
| Lap-line Tracker    | `track789`  |

To use different keys, edit `.env` and restart the server.

---

## Notes for the Frontend Developer

This section explains what the backend provides and what the frontend developer is responsible for completing.

### What is complete (backend + admin interfaces)

- The Node.js/Express server (`server.js`)
- SQLite database layer with full persistence (`db.js`)
- All Socket.IO namespaces, auth middleware, and event handlers (`socketHandlers.js`)
- The Front Desk interface (`/public/front-desk/`) — fully functional
- The Race Control interface (`/public/race-control/`) — fully functional
- The Lap-line Tracker interface (`/public/lap-line-tracker/`) — fully functional
- The `socket-client.js` shared helper used by all interfaces

### What requires frontend development

The four public displays are currently functional but minimal. They receive all the data they need from the `state:full` event and can be extended or redesigned freely:

- `/public/leader-board/index.html` — leaderboard display
- `/public/next-race/index.html` — upcoming race driver list
- `/public/race-countdown/index.html` — race countdown timer
- `/public/race-flags/index.html` — full-screen flag color display

Each display connects to the `/public` Socket.IO namespace (no authentication). The shared `socket-client.js` handles public connections differently from employee connections — public displays call `Racetrack.init('/public', callback)` and connect immediately without an auth overlay.

### Connecting a new public display

To add a new public display or modify an existing one, follow this pattern:

```html
<!-- Load socket.io client from the server -->
<script src="/socket.io/socket.io.js"></script>
<!-- Load the shared helper -->
<script src="/socket-client.js"></script>
<script>
    // Connect to the public namespace and receive state updates
    Racetrack.init('/public', function(state) {
        // 'state' contains the full state object described in Socket.IO Events Reference
        // Re-render your display here every time data changes
        console.log(state.raceState.mode);
        console.log(state.leaderboard);
        console.log(state.timerRemaining);
    });
</script>
```

### Adding routes

If you add a new page at `/public/my-display/index.html`, register its route in `server.js`:

```js
const UI_ROUTES = [
    '/front-desk', '/race-control', '/lap-line-tracker',
    '/leader-board', '/next-race', '/race-countdown', '/race-flags',
    '/my-display'   // add it here
];
```

### State object field reference (for frontend use)

| Field                     | Type              | Description                                                  |
|---------------------------|-------------------|--------------------------------------------------------------|
| `raceState.mode`          | string            | Current flag mode: `idle`, `safe`, `hazard`, `danger`, `finish` |
| `raceState.started_at`    | number or null    | Unix ms timestamp when the current race started              |
| `raceState.duration_ms`   | number            | Total race duration in ms (600000 prod / 60000 dev)          |
| `timerRemaining`          | number            | Milliseconds remaining in the race at the time of broadcast  |
| `currentSession`          | object or null    | Active session row, null if no race is running               |
| `currentDrivers`          | array             | Drivers in the active session, sorted by car number          |
| `leaderboard`             | array             | Ranked driver entries for the active session                 |
| `leaderboard[n].car_number`   | number        | Car number (1-8)                                             |
| `leaderboard[n].driver_name`  | string        | Driver's name                                                |
| `leaderboard[n].laps`         | number        | Completed laps                                               |
| `leaderboard[n].fastest_lap_ms` | number or null | Fastest lap time in ms                                   |
| `leaderboard[n].current_lap`  | number        | Current lap number (completed laps + 1)                      |
| `nextSession`             | object or null    | The first pending session                                    |
| `nextDrivers`             | array             | Drivers registered in the next session                       |
| `lastSession`             | object or null    | The most recently ended session                              |
| `lastLeaderboard`         | array             | Leaderboard for the last ended session (shown between races)  |
| `pendingSessions`         | array             | All sessions with status `pending`                           |
| `allPendingDrivers`       | object            | Map of session ID to driver array for all pending sessions   |

---

## Extra Features Implemented

- **Data persistence** — All race data is stored in SQLite. A server restart reinstates the full previous state, including resuming the race timer if a race was in progress.

- **Receptionist car selection** — When adding a driver, the receptionist can either manually pick a car number from a dropdown (cars already taken are shown as disabled) or leave it on "Auto Car" to assign the next available number automatically.

- **Server timer auto-finish** — When the race timer expires server-side, the mode is set to `finish` automatically. No manual action is required from the Safety Official.

- **Timer recovery after restart** — If the server restarts mid-race, the remaining time is computed from the stored `started_at` and `duration_ms` fields and the countdown resumes correctly from the right position.
