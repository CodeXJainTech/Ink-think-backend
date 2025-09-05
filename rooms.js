// rooms.js
// In-memory rooms store. Persisting to DB is outside scope.
const rooms = {
  "123456": {
    owner: "Alice",
    maxPlayers: 6,
    wordType: "Fruit",
    time: 60,
    totalRounds: 5,
    currentRound: 1,
    started: false,
    currentWord: "",
    operations: [], // drawing operations stored per round
    players: [
      {
        id: "player-1",
        nickname: "Alice",
        score: 0,
        canChat: true,
        socketId: undefined,
      },
    ],
  },
};

module.exports = rooms;