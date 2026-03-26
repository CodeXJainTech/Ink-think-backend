// gameLoop.js
const rooms = require("./rooms");
const { getRandomWord } = require("./wordBank");

function runGameLoop(io, roomId) {
  const room = rooms[roomId];
  if (!room) return;

  let round = 1;
  let turnIndex = 0;
  const totalRounds = room.totalRounds || 1;
  let timeLeft;
  let timer;
  let turnActive = false;

  const usedWords = new Set();

  const endGame = () => {
    clearInterval(timer);
    turnActive = false;
    room.handleCorrectGuess = null;
    room.currentDrawerSocketId = null;
    room.currentWord = "";
    room.started = false;
    const finalRanking = [...room.players].sort((a, b) => b.score - a.score);
    io.to(roomId).emit("gameOver", { ranking: finalRanking });
  };

  // BUG FIX: always read room.players live, not a stale snapshot
  const getPlayers = () => room.players || [];

  const startTurn = () => {
    const players = getPlayers();
    if (players.length === 0 || round > totalRounds) {
      endGame();
      return;
    }

    // Wrap turn index if players left
    if (turnIndex >= players.length) turnIndex = 0;

    clearInterval(timer);
    room.operations = [];
    room.players.forEach((p) => (p.canChat = true));
    room.currentRound = round;
    turnActive = true;

    const drawerPlayer = players[turnIndex];
    const chosenWord = getRandomWord(room.wordType || "Random", usedWords);
    room.currentWord = chosenWord;
    room.currentDrawerSocketId = drawerPlayer.socketId || null;

    // Emit turnStart — frontend shows "X is drawing" overlay for 3s, THEN reveals canvas
    io.to(roomId).emit("turnStart", {
      round,
      totalRounds,
      drawer: drawerPlayer.nickname,
      wordLength: chosenWord.length, // give guessers the word length as hint
    });

    // Send word only to drawer
    if (drawerPlayer.socketId) {
      io.to(drawerPlayer.socketId).emit("yourWord", { word: chosenWord });
      drawerPlayer.canChat = false;
    }

    io.to(roomId).emit("roomUpdated", room);

    // BUG FIX: wait 3s (matching frontend overlay) before starting timer
    setTimeout(() => {
      if (!turnActive) return; // turn was skipped (e.g. everyone guessed during transition)
      timeLeft = room.time || 60;
      io.to(roomId).emit("timerUpdate", { timeLeft });

      timer = setInterval(() => {
        timeLeft--;
        io.to(roomId).emit("timerUpdate", { timeLeft });
        if (timeLeft <= 0) {
          clearInterval(timer);
          revealAndNext();
        }
      }, 1000);
    }, 3000);
  };

  // BUG FIX: reveal word to everyone before moving on
  const revealAndNext = () => {
    turnActive = false;
    const revealedWord = room.currentWord;
    io.to(roomId).emit("wordReveal", { word: revealedWord });
    setTimeout(() => nextTurn(), 2000);
  };

  const startRound = () => {
    if (round > totalRounds) {
      endGame();
      return;
    }
    io.to(roomId).emit("roundStart", { round, totalRounds });
    // 3s pause showing "Round X" before first turn of this round
    setTimeout(() => startTurn(), 3000);
  };

  const nextTurn = () => {
    clearInterval(timer);
    room.currentDrawerSocketId = null;
    turnIndex++;

    const players = getPlayers();
    if (turnIndex >= players.length) {
      turnIndex = 0;
      round++;
      if (round > totalRounds) {
        endGame();
        return;
      }
      startRound();
    } else {
      startTurn();
    }
  };

  // BUG FIX: allGuessed recalculated dynamically from live player list
  room.handleCorrectGuess = (nickname) => {
    if (!turnActive) return;
    const player = getPlayers().find((p) => p.nickname === nickname);
    if (!player || !room.currentWord) return;

    const earned = Math.max(timeLeft || 0, 0) * 5;
    player.score = (player.score || 0) + earned;
    player.canChat = false;

    // Check if ALL non-drawer players have guessed
    const nonDrawers = getPlayers().filter(
      (p) => p.socketId !== room.currentDrawerSocketId,
    );
    const allGuessed = nonDrawers.every((p) => p.canChat === false);

    if (allGuessed) {
      clearInterval(timer);
      revealAndNext();
    }
  };

  startRound();
}

module.exports = { runGameLoop };