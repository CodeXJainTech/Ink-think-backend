# 🎨 Ink & Think — Backend

A real-time multiplayer drawing & guessing game server built with **Node.js**, **Express**, and **Socket.IO**.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| HTTP Server | Express |
| Real-time | Socket.IO (WebSocket) |
| Data Store | In-memory (plain JS object) |

---

## System Design Overview

```
┌─────────────────────────────────────────────────────────┐
│                        Clients                          │
│         (Browser tabs — React + Socket.IO client)       │
└────────────────────┬────────────────────────────────────┘
                     │  HTTP REST  +  WebSocket
                     ▼
┌─────────────────────────────────────────────────────────┐
│                  Express Server (Node.js)               │
│                                                         │
│   ┌─────────────────┐    ┌──────────────────────────┐   │
│   │   REST Routes   │    │    Socket.IO Handlers    │   │
│   │  /createroom    │    │  connection / joinRoom   │   │
│   │  /adduser       │    │  drawOp / sendGuess      │   │
│   │  /room/:id      │    │  startGame / leaveRoom   │   │
│   │  /room/:id/...  │    │  disconnect              │   │
│   └────────┬────────┘    └────────────┬─────────────┘   │
│            │                          │                 │
│            └──────────┬───────────────┘                 │
│                       ▼                                 │
│              ┌─────────────────┐                        │
│              │   rooms{}       │  ← In-memory store     │
│              │   (shared ref)  │                        │
│              └────────┬────────┘                        │
│                       │                                 │
│              ┌────────▼────────┐                        │
│              │   Game Loop     │  ← Per-room timer +    │
│              │  (setInterval)  │     turn management    │
│              └─────────────────┘                        │
└─────────────────────────────────────────────────────────┘
```

### How a Game Round Works

```
Owner clicks Start
       │
       ▼
  runGameLoop()
       │
       ▼
  startRound()  ──► emit "roundStart" to all players
       │
       ▼  (3s delay)
  startTurn()
       │
       ├── emit "turnStart" (drawer name) → all
       ├── emit "word"                    → drawer only
       └── setInterval every 1s          → emit "timerUpdate"
              │
              ├── Player sends "sendGuess"
              │      ├── wrong  → broadcast as chat message
              │      └── correct → award points, canChat=false
              │                    trigger nextTurn if all guessed
              │
              └── timeLeft hits 0 → nextTurn()
                       │
                       └── more players? → startTurn()
                           all done?     → startRound() or gameOver
```

---

## Project Structure

```
backend/
├── server.js          # Entry point — Express + Socket.IO setup, socket handlers
├── roomRoutes.js      # REST route definitions
├── roomController.js  # Route handler logic (create, join, start, leave, update)
├── gameLoop.js        # Round/turn timer, scoring, turn rotation
├── rooms.js           # Shared in-memory rooms store
├── wordBank.js        # Word lists by category + getRandomWord()
└── package.json
```

---

## REST API

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/createroom` | Create a new room |
| `POST` | `/adduser` | Join a room by ID + nickname |
| `GET` | `/room/:roomId` | Get room state |
| `PUT` | `/room/:roomId` | Update room settings (owner only) |
| `POST` | `/room/:roomId/start` | Start the game (owner only) |
| `POST` | `/room/:roomId/leave` | Leave or close a room |
| `POST` | `/room/:roomId/autojoin` | Join with a random nickname |
| `GET` | `/health` | Health check |

---

## Getting Started

```bash
npm install
npm run start
```

### Frontend Repo: [Here](https://github.com/CodeXJainTech/Ink-think-frontend)
> **Note:** This server uses in-memory storage. All room data is lost on restart. For production persistence, wire `rooms.js` to a Redis or MongoDB store.

