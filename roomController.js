// roomController.js
const rooms = require("./rooms");
let ioInstance = null;
const { runGameLoop } = require("./gameLoop");

const generateRoomId = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "";
  for (let i = 0; i < 6; i++)
    id += chars[Math.floor(Math.random() * chars.length)];
  return id;
};

const randomNames = [
  "Panda",
  "Tiger",
  "Eagle",
  "Shark",
  "Wolf",
  "Falcon",
  "Koala",
  "Otter",
  "Hawk",
  "Dolphin",
  "Cobra",
  "Lynx",
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

const MAX_NICKNAME_LEN = 24;
const sanitizeNick = (str) =>
  typeof str === "string" ? str.trim().slice(0, MAX_NICKNAME_LEN) : "";

exports.createRoom = (req, res) => {
  const { owner, maxPlayers, wordType, time, totalRounds } = req.body;
  const ownerName = sanitizeNick(owner);
  if (!ownerName || !maxPlayers || !wordType || !time || !totalRounds) {
    return res.status(400).json({ message: "All fields are required." });
  }

  const mp = Number(maxPlayers);
  const t = Number(time);
  const tr = Number(totalRounds);

  if (mp < 2 || mp > 12)
    return res.status(400).json({ message: "Max players must be 2–12." });
  if (t < 20 || t > 180)
    return res.status(400).json({ message: "Time must be 20–180 seconds." });
  if (tr < 1 || tr > 10)
    return res.status(400).json({ message: "Total rounds must be 1–10." });

  let roomId = generateRoomId();
  while (rooms[roomId]) roomId = generateRoomId();

  rooms[roomId] = {
    owner: ownerName,
    maxPlayers: mp,
    wordType,
    time: t,
    totalRounds: tr,
    players: [
      {
        id: "player-1",
        nickname: ownerName,
        score: 0,
        canChat: true,
        socketId: undefined,
      },
    ],
    currentRound: 1,
    started: false,
    currentWord: "",
    currentDrawerSocketId: null,
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
  const { roomId } = req.body;
  const nickname = sanitizeNick(req.body.nickname);
  if (!roomId || !nickname)
    return res.status(400).json({ message: "roomId and nickname required" });

  const room = rooms[roomId];
  if (!room) return res.status(404).json({ message: "Room not found" });
  if (room.started)
    return res.status(400).json({ message: "Game already started" });
  if (room.players.length >= room.maxPlayers)
    return res.status(400).json({ message: "Room is full" });

  const nicknameExists = room.players.some((p) => p.nickname === nickname);
  if (nicknameExists)
    return res
      .status(400)
      .json({ message: "Nickname already taken in this room" });

  const playerId = `player-${room.players.length + 1}`;
  room.players.push({
    id: playerId,
    nickname,
    score: 0,
    canChat: true,
    socketId: undefined,
  });

  return res
    .status(200)
    .json({ message: "Joined room successfully", room: { ...room } });
};

exports.autoJoinRoom = (req, res) => {
  const { roomId } = req.params;
  const room = rooms[roomId];
  if (!room) return res.status(404).json({ message: "Room not found" });
  if (room.started)
    return res.status(400).json({ message: "Game already started" });
  if (room.players.length >= room.maxPlayers)
    return res.status(400).json({ message: "Room is full" });

  const nickname = assignRandomName(room);
  const playerId = `player-${room.players.length + 1}`;
  room.players.push({
    id: playerId,
    nickname,
    score: 0,
    canChat: true,
    socketId: undefined,
  });
  return res
    .status(200)
    .json({
      message: "Auto-joined with random name",
      nickname,
      room: { ...room },
    });
};

// FIX: updateRoom now requires owner verification
exports.updateRoom = (req, res) => {
  const { roomId } = req.params;
  const { maxPlayers, wordType, time, totalRounds, nickname } = req.body;

  const room = rooms[roomId];
  if (!room) return res.status(404).json({ message: "Room not found" });

  // FIX: only owner can update
  if (!nickname || room.owner !== sanitizeNick(nickname)) {
    return res
      .status(403)
      .json({ message: "Only the room owner can update settings." });
  }

  if (maxPlayers !== undefined) {
    const mp = Number(maxPlayers);
    if (mp < 2 || mp > 12)
      return res.status(400).json({ message: "Max players must be 2–12." });
    room.maxPlayers = mp;
  }
  if (wordType !== undefined) room.wordType = wordType;
  if (time !== undefined) {
    const t = Number(time);
    if (t < 20 || t > 180)
      return res.status(400).json({ message: "Time must be 20–180 seconds." });
    room.time = t;
  }
  if (totalRounds !== undefined) {
    const tr = Number(totalRounds);
    if (tr < 1 || tr > 10)
      return res.status(400).json({ message: "Rounds must be 1–10." });
    room.totalRounds = tr;
  }

  return res.status(200).json({ message: "Room updated", room: { ...room } });
};

exports.startGame = (req, res) => {
  const { roomId } = req.params;
  const { nickname } = req.body;
  const room = rooms[roomId];

  if (!room) return res.status(404).json({ message: "Room not found" });
  if (room.owner !== sanitizeNick(nickname))
    return res
      .status(403)
      .json({ message: "Only the owner can start the game" });
  if (room.started)
    return res.status(400).json({ message: "Game already started" });

  room.started = true;
  if (ioInstance) {
    ioInstance.to(roomId).emit("gameStarted", { roomId });
    runGameLoop(ioInstance, roomId);
  }

  return res.status(200).json({ message: "Game started", room: { ...room } });
};

exports.leaveRoom = (req, res) => {
  const { roomId } = req.params;
  const nickname = sanitizeNick(req.body.nickname);
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