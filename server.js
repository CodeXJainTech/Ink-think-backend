// server.js
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const roomRoutes = require("./roomRoutes");
const rooms = require("./rooms");
const { runGameLoop } = require("./gameLoop");
const { setIO } = require("./roomController");

const app = express();
const server = http.createServer(app);

app.use(
  cors({
    origin: "https://ink-think.vercel.app",
    methods: ["GET", "POST"],
  })
);
app.use(express.json());
app.use("/", roomRoutes);

app.get("/", (req, res) => {
  res.send("Scribble Game Backend Running!");
});

const io = new Server(server, {
  cors: {
    origin: "https://ink-think.vercel.app",
    methods: ["GET", "POST"],
  },
});
setIO(io);

// central socket handlers
io.on("connection", (socket) => {
  console.log("✅ New client connected:", socket.id);

  // Player joins a room
  // client: socket.emit("joinRoom", { roomId, nickname })
  socket.on("joinRoom", ({ roomId, nickname }) => {
    if (!roomId || !nickname) return;
    socket.join(roomId);
    console.log(`👤 ${nickname} joined room ${roomId} (${socket.id})`);

    const room = rooms[roomId];
    if (room) {
      let player = room.players.find((p) => p.nickname === nickname);
      if (player) {
        player.socketId = socket.id;
        player.canChat = player.canChat ?? true;
      } else {
        const playerId = `player-${room.players.length + 1}`;
        player = { id: playerId, nickname, score: 0, canChat: true, socketId: socket.id };
        room.players.push(player);
      }

      io.to(roomId).emit("roomUpdated", room);
    }

    io.to(roomId).emit("userJoined", { nickname, id: socket.id });
  });

  // Player leaves
  socket.on("leaveRoom", ({ roomId, nickname }) => {
    if (!roomId || !nickname) return;
    socket.leave(roomId);
    console.log(`🚪 ${nickname} left room ${roomId}`);

    const room = rooms[roomId];
    if (room) {
      const player = room.players.find((p) => p.nickname === nickname);
      if (player) {
        delete player.socketId;
      }
      io.to(roomId).emit("roomUpdated", room);
    }
    io.to(roomId).emit("userLeft", nickname);
  });

  // A client can emit drawOp: { roomId, op }
  socket.on("drawOp", ({ roomId, op }) => {
    if (!roomId || !op) return;
    const room = rooms[roomId];
    if (!room) return;
    // store op (so new spectators can replay)
    room.operations = room.operations || [];
    room.operations.push(op);
    // broadcast op to all in room (including drawer so live sync)
    io.to(roomId).emit("drawOp", { op });
  });

  // Client asks to fetch initial drawing operations
  socket.on("fetchDrawing", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    socket.emit("initDrawing", { operations: room.operations || [] });
  });

  // Player guesses
  socket.on("sendGuess", ({ roomId, nickname, text }) => {
    const room = rooms[roomId];
    if (!room) return;
    const player = room.players.find((p) => p.nickname === nickname);
    if (!player) return;

    if (player.canChat === false) {
      socket.emit("chatDisabled");
      return;
    }

    const normalized = (text || "").trim().toLowerCase();
    const current = (room.currentWord || "").toLowerCase();
    const correct = normalized && current && normalized === current;

    if (correct) {
      player.canChat = false;
      const scoreEarned = (room.time || 60) > 0 ? room.time * 5 : 0;
      player.score += scoreEarned;

      io.to(roomId).emit("correctGuess", { user: nickname, score: player.score });
      io.to(roomId).emit("roomUpdated", room);
      io.to(player.socketId || socket.id).emit("chatDisabled");

      // trigger round check
      if (room.handleCorrectGuess) {
        room.handleCorrectGuess(nickname);
      }
    } else {
      io.to(roomId).emit("newGuess", { user: nickname, text });
    }
  });


  // startGame via socket (optional)
  socket.on("startGame", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    room.started = true;
    io.to(roomId).emit("gameStarted", { roomId });
    setTimeout(() => {console.log("Game is about to start MF!")}, 3000);
    runGameLoop(io, roomId);
  });

  // disconnect cleanup
  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
    // clear socketId from any player that had it
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