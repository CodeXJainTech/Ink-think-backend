// gameLoop.js
const rooms = require("./rooms");
const { getRandomWord } = require("./wordBank");

function runGameLoop(io, roomId) {
  const room = rooms[roomId];
  if (!room) return;

  let round = 1;
  let turnIndex = 0;
  const totalRounds = room.totalRounds || 1;
  const players = room.players || [];
  let timeLeft;
  let timer;
  let allGuessed = 1;

  const startTurn = () => {
    if (round > totalRounds) {
      const finalRanking = [...room.players].sort((a, b) => b.score - a.score);
      io.to(roomId).emit("gameOver", { ranking: finalRanking });
      room.started = false;
      return;
    }

    // reset
    room.operations = [];
    room.players.forEach((p) => (p.canChat = true));
    room.currentRound = round;

    const drawerPlayer = players[turnIndex];
    const drawerNickname = drawerPlayer.nickname;

    const chosenWord = getRandomWord(room.wordType || "Random");
    room.currentWord = chosenWord;

    // emit turnStart
    io.to(roomId).emit("turnStart", { round, drawer: drawerNickname });

    // send word only to drawer
    if (drawerPlayer.socketId) {
      io.to(drawerPlayer.socketId).emit("word", { word: chosenWord });
      io.to(drawerPlayer.socketId).emit("chatDisabled");
      drawerPlayer.canChat = false;
    }

    io.to(roomId).emit("roomUpdated", room);

    // timer
    timeLeft = room.time || 60;
    io.to(roomId).emit("timerUpdate", { timeLeft });

    timer = setInterval(() => {
      timeLeft--;
      io.to(roomId).emit("timerUpdate", { timeLeft });

      if (timeLeft <= 0) {
        clearInterval(timer);
        nextTurn();
      }
    }, 1000);
  };

  const startRound = () => {
    if (round > totalRounds) return;
    io.to(roomId).emit("roundStart", { round });
    // wait 3s before first turn of this round
    setTimeout(() => {
      startTurn();
    }, 3000);
  };

  const nextTurn = () => {
    turnIndex++;
    allGuessed = 1;
    if (turnIndex >= players.length) {
      turnIndex = 0;
      round++;
      if (round > totalRounds) {
        const finalRanking = [...room.players].sort((a, b) => b.score - a.score);
        io.to(roomId).emit("gameOver", { ranking: finalRanking });
        room.started = false;
        return;
      }
      // new round
      startRound();
    } else {
      // next player turn after short delay
      setTimeout(() => {
        startTurn();
      }, 3000);
    }
  };

  // correct guess scoring
  room.handleCorrectGuess = (nickname) => {
    const player = players.find((p) => p.nickname === nickname);
    if (!player || !room.currentWord) return;

    const earned = timeLeft * 5;
    player.score = (player.score || 0) + earned;
    player.canChat = false;
    allGuessed++;

    if(allGuessed === room.players.length) {
      clearInterval(timer);
      nextTurn();
    }
  };

  // start first round
  startRound();
}

module.exports = { runGameLoop };