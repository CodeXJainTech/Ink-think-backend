// roomController.js
const rooms = require("./rooms");
let ioInstance = null;
const { runGameLoop } = require("./gameLoop");

// Utility to generate random 6-character room ID
const generateRoomId = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "";
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
};

const randomNames = [
  "Panda","Tiger","Eagle","Shark","Wolf","Falcon","Koala","Otter","Hawk","Dolphin","Cobra","Lynx"
];

const assignRandomName = (room) => {
  let nickname;
  do {
    nickname =
      randomNames[Math.floor(Math.random() * randomNames.length)] +
      Math.floor(Math.random() * 100);
  } while (room.players.some((p) => p.nickname === nickname));
  return nickname;
};

// Create room
exports.createRoom = (req, res) => {
  const { owner, maxPlayers, wordType, time, totalRounds } = req.body;
  if (!owner || !maxPlayers || !wordType || !time || !totalRounds) {
    return res.status(400).json({ message: "All fields are required." });
  }

  let roomId = generateRoomId();
  while (rooms[roomId]) roomId = generateRoomId(); // ensure unique

  rooms[roomId] = {
    owner: owner.trim(),
    maxPlayers: Number(maxPlayers),
    wordType,
    time: Number(time),
    totalRounds: Number(totalRounds),
    players: [{ id: "player-1", nickname: owner.trim(), score: 0, canChat: true, socketId: undefined }],
    currentRound: 1,
    started: false,
    currentWord: "",
    operations: [],
  };

  return res.status(201).json({ message: "Room created", roomId });
};

exports.getRoom = (req, res) => {
  const { roomId } = req.params;
  const room = rooms[roomId];
  if (!room) return res.status(404).json({ message: "Room not found" });
  return res.status(200).json({ room: { ...room } });
};

exports.joinRoom = (req, res) => {
  const { roomId, nickname } = req.body;
  if (!roomId || !nickname) return res.status(400).json({ message: "roomId and nickname required" });

  const room = rooms[roomId];
  if (!room) return res.status(404).json({ message: "Room not found" });
  if (room.started) return res.status(400).json({ message: "Game already started" });
  if (room.players.length >= room.maxPlayers) return res.status(400).json({ message: "Room is full" });

  const nicknameExists = room.players.some((p) => p.nickname === nickname);
  if (nicknameExists) return res.status(400).json({ message: "Nickname already taken in this room" });

  const playerId = `player-${room.players.length + 1}`;

  room.players.push({
    id: playerId,
    nickname,
    score: 0,
    canChat: true,
    socketId: undefined,
  });

  return res.status(200).json({ message: "Joined room successfully", room: { ...room } });
};

exports.autoJoinRoom = (req, res) => {
  const { roomId } = req.params;
  const room = rooms[roomId];
  if (!room) return res.status(404).json({ message: "Room not found" });
  if (room.started) return res.status(400).json({ message: "Game already started" });
  if (room.players.length >= room.maxPlayers) return res.status(400).json({ message: "Room is full" });

  const nickname = assignRandomName(room);
  const playerId = `player-${room.players.length + 1}`;

  room.players.push({
    id: playerId,
    nickname,
    score: 0,
    canChat: true,
    socketId: undefined,
  });
  return res.status(200).json({ message: "Auto-joined with random name", nickname, room: { ...room } });
};

exports.updateRoom = (req, res) => {
  const { roomId } = req.params;
  const { maxPlayers, wordType, time, totalRounds } = req.body;

  const room = rooms[roomId];
  if (!room) return res.status(404).json({ message: "Room not found" });

  if (maxPlayers !== undefined) room.maxPlayers = Number(maxPlayers);
  if (wordType !== undefined) room.wordType = wordType;
  if (time !== undefined) room.time = Number(time);
  if (totalRounds !== undefined) room.totalRounds = Number(totalRounds);

  return res.status(200).json({ message: "Room updated", room: { ...room } });
};

exports.startGame = (req, res) => {
  const { roomId } = req.params;
  const { nickname } = req.body;
  const room = rooms[roomId];

  if (!room) return res.status(404).json({ message: "Room not found" });
  if (room.owner !== nickname) return res.status(403).json({ message: "Only the owner can start the game" });
  if (room.started) return res.status(400).json({ message: "Game already started" });

  room.started = true;
  if (ioInstance) {
    ioInstance.to(roomId).emit("gameStarted", { roomId });
    runGameLoop(ioInstance, roomId);
  }

  return res.status(200).json({ message: "Game started", room: { ...room } });
};

exports.leaveRoom = (req, res) => {
  const { roomId } = req.params;
  const { nickname } = req.body;
  const room = rooms[roomId];
  if (!room) return res.status(404).json({ message: "Room not found" });

  room.players = room.players.filter((p) => p.nickname !== nickname);

  if (room.owner === nickname || room.players.length === 0) {
    delete rooms[roomId];
    return res.status(200).json({ message: "Room closed" });
  }

  return res.status(200).json({ message: "Left room", room: { ...room } });
};

exports.setIO = (io) => {
  ioInstance = io;
};