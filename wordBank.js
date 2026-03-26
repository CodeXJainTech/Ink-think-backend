// wordBank.js
const WORD_BANK = {
  Animals: [
    "Dog", "Cat", "Elephant", "Tiger", "Lion", "Horse", "Zebra", "Giraffe",
    "Penguin", "Kangaroo", "Crocodile", "Dolphin", "Octopus", "Parrot",
    "Cheetah", "Gorilla", "Flamingo", "Hedgehog", "Porcupine", "Jellyfish",
    "Camel", "Peacock", "Raccoon", "Sloth", "Toucan"
  ],
  Places: [
    "Paris", "London", "Tokyo", "New York", "Delhi", "Sydney", "Cairo",
    "Rome", "Berlin", "Dubai", "Moscow", "Barcelona", "Istanbul", "Bangkok",
    "Singapore", "Amsterdam", "Venice", "Athens", "Mexico City", "Toronto",
    "Sahara", "Amazon", "Antarctica", "Everest", "Grand Canyon"
  ],
  Buildings: [
    "School", "Hospital", "Temple", "Castle", "Skyscraper", "Bridge", "Museum",
    "Library", "Lighthouse", "Stadium", "Airport", "Cathedral", "Pyramid",
    "Windmill", "Treehouse", "Igloo", "Palace", "Jail", "Barn", "Submarine",
    "Rocket", "Ferris Wheel", "Tunnel", "Dam", "Greenhouse"
  ],
  Food: [
    "Pizza", "Burger", "Apple", "Banana", "Cake", "Pasta", "Sushi",
    "Taco", "Donut", "Waffle", "Pancake", "Sandwich", "Hotdog", "Popcorn",
    "Ice Cream", "Watermelon", "Broccoli", "Carrot", "Cupcake", "Cheesecake",
    "Noodles", "Pretzel", "Lollipop", "Avocado", "Pineapple"
  ],
};

WORD_BANK.Random = Object.values(WORD_BANK).flat();

function getRandomWord(wordType, usedWords = new Set()) {
  // Normalise: accept any casing, fall back to Random
  const normalised = Object.keys(WORD_BANK).find(
    (k) => k.toLowerCase() === (wordType || "").toLowerCase()
  ) || "Random";

  const pool = WORD_BANK[normalised];

  // Filter out already-used words
  let available = pool.filter((w) => !usedWords.has(w));

  // If every word has been used, reset and start over
  if (available.length === 0) {
    usedWords.clear();
    available = [...pool];
  }

  const word = available[Math.floor(Math.random() * available.length)];
  usedWords.add(word);
  return word;
}

module.exports = { WORD_BANK, getRandomWord };