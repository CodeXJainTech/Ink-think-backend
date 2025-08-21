const express = require("express");
const router = express.Router();
const {
  createRoom,
  getRoom,
  joinRoom,
  autoJoinRoom,
  updateRoom,
  startGame,
  leaveRoom,
} = require("../controllers/roomController");

// Create a room
router.post("/createroom", createRoom);

// Join room explicitly
router.post("/adduser", joinRoom);

// Fetch room details
router.get("/room/:roomId", getRoom);

// Auto-join with random nickname if direct visit
router.post("/room/:roomId/autojoin", autoJoinRoom);

// Edit room settings (owner)
router.put("/room/:roomId", updateRoom);

// Start game (owner)
router.post("/room/:roomId/start", startGame);

// Leave room (owner leaves => room closes; otherwise just removed)
router.post("/room/:roomId/leave", leaveRoom);

module.exports = router;