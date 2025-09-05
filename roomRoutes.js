// roomRoutes.js
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
} = require("./roomController");

router.post("/createroom", createRoom);
router.post("/adduser", joinRoom);
router.get("/room/:roomId", getRoom);
router.post("/room/:roomId/autojoin", autoJoinRoom);
router.put("/room/:roomId", updateRoom);
router.post("/room/:roomId/start", startGame);
router.post("/room/:roomId/leave", leaveRoom);

module.exports = router;