// gameLoop.js
const rooms = require("./rooms");

function runGameLoop(io, roomId) {
  const room = rooms[roomId];
  if (!room) return;
  console.log("hello3");

  let round = 1;
  const totalRounds = room.totalRounds;
  const players = room.players; // keep full objects, not just nicknames

  const startRound = () => {
    if (round > totalRounds) {
      io.to(roomId).emit("gameOver");
      room.started = false;
      return;
    }

    const drawerIndex = (round - 1) % players.length;
    const drawerPlayer = players[drawerIndex]; // full player object
    const drawerNickname = drawerPlayer.nickname;

    // 👉 Pick a word for this round
    const chosenWord = "apple"; // TODO: replace with random word picker

    // Broadcast to everyone who is the drawer
    io.to(roomId).emit("roundStart", { round, drawer: drawerNickname });

    // Send the actual word ONLY to the drawer’s socket
    io.to(drawerPlayer.id).emit("word", { word: chosenWord });

    // Timer
    let timeLeft = room.time; // e.g. 60 seconds
    const timer = setInterval(() => {
      timeLeft--;
      io.to(roomId).emit("timerUpdate", { timeLeft });
      console.log(timeLeft);
      if (timeLeft <= 0) {
        clearInterval(timer);
        round++;
        startRound();
      }
    }, 1000);
  };

  startRound();
}

module.exports = { runGameLoop };