// server.js
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const roomRoutes = require("./routes/roomRoutes");
const rooms = require("./data/rooms"); // 👈 so we can fetch updated room state

const app = express();
const server = http.createServer(app); // ⬅️ Needed for Socket.IO

// Middleware
app.use(cors());
app.use(express.json());

// Routes (REST API)
app.use("/", roomRoutes);

// Default route
app.get("/", (req, res) => {
  res.send("Scribble Game Backend Running!");
});

// SOCKET.IO setup
const io = new Server(server, {
  cors: {
    origin: "*", // you can restrict to frontend URL later
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("✅ New client connected:", socket.id);

  // User joins a specific room
  socket.on("joinRoom", ({ roomId, nickname }) => {
    socket.join(roomId);
    console.log(`👤 ${nickname} joined room ${roomId}`);

    // Notify all users in the room
    io.to(roomId).emit("userJoined", { nickname, id: socket.id });
  });

  // Handle leaving room
  socket.on("leaveRoom", ({ roomId, nickname }) => {
    socket.leave(roomId);
    console.log(`🚪 ${nickname} left room ${roomId}`);
    io.to(roomId).emit("userLeft", nickname);
  });

  // Broadcast updated room settings/game state
  socket.on("roomUpdated", ({ roomId }) => {
    const room = rooms[roomId];
    if (room) {
      console.log(`🔄 Room ${roomId} updated, broadcasting to users.`);
      io.to(roomId).emit("roomUpdated", room);
    }
  });

  socket.on("startGame", ({ roomId }) => {
    // ✅ mark room as started in your rooms data
    if (rooms[roomId]) {
      rooms[roomId].isStarted = true;
      io.to(roomId).emit("gameStarted", { roomId });
      console.log(`🎮 Game started in room ${roomId}`);
    }
  });


  // Handle disconnection
  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
    // Note: we can’t always map socket.id -> nickname unless we track it,
    // but we still cleanly remove socket from rooms automatically.
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});