// wordBank.js
const WORD_BANK = {
  Animals: ["Dog", "Cat", "Elephant", "Tiger", "Lion", "Horse", "Zebra", "Giraffe"],
  Places: ["Paris", "London", "Tokyo", "New York", "Delhi", "Sydney", "Cairo"],
  Buildings: ["School", "Hospital", "Temple", "Castle", "Skyscraper", "Bridge", "Museum"],
  Food: ["Pizza", "Burger", "Apple", "Banana", "Cake", "Pasta", "Sushi"],
  Random: [],
};

Object.keys(WORD_BANK).forEach((k) => {
  if (k !== "Random") WORD_BANK.Random.push(...WORD_BANK[k]);
});

function getRandomWord(wordType) {
  const type = wordType && WORD_BANK[wordType] ? wordType : "Random";
  const arr = WORD_BANK[type];
  if (!arr || arr.length === 0) return "apple";
  return arr[Math.floor(Math.random() * arr.length)];
}

module.exports = { WORD_BANK, getRandomWord };