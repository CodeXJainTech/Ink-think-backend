// server.js
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const roomRoutes = require("./roomRoutes");
const rooms = require("./rooms");
const { runGameLoop } = require("./gameLoop");
const { setIO } = require("./roomController");
const dotenv = require("dotenv");
dotenv.config();

const app = express();
const server = http.createServer(app);

const ALLOWED_ORIGIN = process.env.FRONTEND_URL;

app.use(
  cors({
    origin: ALLOWED_ORIGIN,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.use(express.json({ limit: "10kb" }));
app.use("/", roomRoutes);

app.get("/health", (req, res) => res.json({ status: "ok" }));
app.get("/", (req, res) => res.send("Scribble Game Backend Running!"));

const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGIN,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  },
});

setIO(io);

const MAX_NICKNAME_LEN = 24;
const MAX_GUESS_LEN = 120;

const sanitize = (str) =>
  typeof str === "string" ? str.trim().slice(0, MAX_GUESS_LEN) : "";
const sanitizeNick = (str) =>
  typeof str === "string" ? str.trim().slice(0, MAX_NICKNAME_LEN) : "";

io.on("connection", (socket) => {
  console.log("✅ New client connected:", socket.id);

  socket.on("joinRoom", ({ roomId, nickname }) => {
    const nick = sanitizeNick(nickname);
    if (!roomId || !nick) return;
    socket.join(roomId);

    const room = rooms[roomId];
    if (room) {
      let player = room.players.find((p) => p.nickname === nick);
      if (player) {
        player.socketId = socket.id;
        player.canChat = player.canChat ?? true;
      } else {
        const playerId = `player-${room.players.length + 1}`;
        player = {
          id: playerId,
          nickname: nick,
          score: 0,
          canChat: true,
          socketId: socket.id,
        };
        room.players.push(player);
      }
      io.to(roomId).emit("roomUpdated", room);
    }

    io.to(roomId).emit("userJoined", { nickname: nick, id: socket.id });
  });

  socket.on("leaveRoom", ({ roomId, nickname }) => {
    const nick = sanitizeNick(nickname);
    if (!roomId || !nick) return;
    socket.leave(roomId);

    const room = rooms[roomId];
    if (room) {
      const player = room.players.find((p) => p.nickname === nick);
      if (player) delete player.socketId;
      io.to(roomId).emit("roomUpdated", room);
    }
    io.to(roomId).emit("userLeft", nick);
  });

  // FIX: Only the current drawer can emit draw ops
  socket.on("drawOp", ({ roomId, op }) => {
    if (!roomId || !op) return;
    const room = rooms[roomId];
    if (!room) return;

    if (!room.currentDrawerSocketId || room.currentDrawerSocketId !== socket.id)
      return;

    room.operations = room.operations || [];
    room.operations.push(op);
    io.to(roomId).emit("drawOp", { op });
  });

  socket.on("fetchDrawing", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    socket.emit("initDrawing", { operations: room.operations || [] });
  });

  // FIX: No double scoring, drawer cannot guess, input sanitized
  socket.on("sendGuess", ({ roomId, nickname, text }) => {
    const nick = sanitizeNick(nickname);
    const guessText = sanitize(text);

    const room = rooms[roomId];
    if (!room || !nick || !guessText) return;

    const player = room.players.find((p) => p.nickname === nick);
    if (!player) return;

    if (player.canChat === false) {
      socket.emit("chatDisabled");
      return;
    }

    // Drawer cannot guess
    if (room.currentDrawerSocketId === socket.id) {
      socket.emit("chatDisabled");
      return;
    }

    const normalized = guessText.toLowerCase();
    const current = (room.currentWord || "").toLowerCase();
    const correct = normalized && current && normalized === current;

    if (correct) {
      player.canChat = false;
      io.to(player.socketId || socket.id).emit("chatDisabled");
      io.to(roomId).emit("correctGuess", { user: nick });

      // Scoring handled only in gameLoop
      if (room.handleCorrectGuess) {
        room.handleCorrectGuess(nick);
      }

      io.to(roomId).emit("roomUpdated", room);
    } else {
      io.to(roomId).emit("newGuess", { user: nick, text: guessText });
    }
  });

  // FIX: Socket startGame now verifies owner via socketId
  socket.on("startGame", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || room.started) return;

    const player = room.players.find((p) => p.socketId === socket.id);
    if (!player || room.owner !== player.nickname) {
      socket.emit("error", {
        message: "Only the room owner can start the game.",
      });
      return;
    }

    room.started = true;
    io.to(roomId).emit("gameStarted", { roomId });
    runGameLoop(io, roomId);
  });

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
    for (const rid of Object.keys(rooms)) {
      const room = rooms[rid];
      const player = (room.players || []).find((p) => p.socketId === socket.id);
      if (player) {
        delete player.socketId;
        io.to(rid).emit("roomUpdated", room);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});