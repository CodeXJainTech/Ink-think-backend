const rooms = {
  "123456": {
    owner: "Alice",
    maxPlayers: 6,
    wordType: "fruit",
    time: 60,
    totalRounds: 5,
    currentRound: 1,
    isStarted: false,
    players: [
      {
        id: "player-1",
        nickname: "Alice", 
        score: 0            
      }
    ]
  }
};

module.exports = rooms;
