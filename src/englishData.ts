import type { GameDefinition } from './types'

export const englishGames: GameDefinition[] = [
  { id: 'football', name: 'Football Arena', shortName: 'Football', description: 'Two teams, live score and comment power', commandHint: 'Selected team commands', accent: '#8cff45', duration: 24 },
  { id: 'quiz', name: 'Trivia Duel', shortName: 'Trivia Quiz', description: 'Questions, countdown and live answer rates', commandHint: 'A, B, C or D', accent: '#b67cff', duration: 20 },
  { id: 'wheel', name: 'World Wheel', shortName: 'Country Wheel', description: 'Country voting and wheel selection through comments', commandHint: 'Type a country name', accent: '#ffbd4a', duration: 18 },
  { id: 'emoji', name: 'Emoji Riddle', shortName: 'Guess the Emoji', description: 'Be the first to guess the word from emojis', commandHint: 'Type your guess directly', accent: '#4de8d3', duration: 22 },
  { id: 'word', name: 'Word Hunt', shortName: 'Word Hunt', description: 'Find the correct word from scrambled letters', commandHint: 'Type the word directly', accent: '#ff7fa7', duration: 22 },
  { id: 'numbers', name: 'Number Battle', shortName: 'Number Battle', description: 'Chat pushes one of two sides to the top', commandHint: 'Type 1 or 2', accent: '#62a6ff', duration: 18 },
  { id: 'pickaxe', name: 'Falling Pickaxe Mine', shortName: 'Falling Pickaxe', description: 'Chat-controlled pickaxe, blocks, ores and TNT chains', commandHint: 'tnt · fast/slow · big · wood/stone/iron/gold/diamond/netherite', accent: '#36e3ff', duration: 30 },
  { id: 'raid', name: 'Community Raid', shortName: 'Boss Raid', description: 'All viewers unite against the same boss', commandHint: 'hit attack · heal restore', accent: '#ff6b5e', duration: 30 },
  { id: 'tetris', name: 'Community Tetris', shortName: 'Tetris', description: 'Chat controls one piece and clears lines together', commandHint: 'left · right · rotate · drop', accent: '#45e8ff', duration: 30 },
]

export const englishQuestions = [
  { category: 'Geography', question: 'Which is the largest country by area?', answers: ['Canada', 'China', 'Russia', 'United States'], correct: 2 },
  { category: 'Science', question: 'What is the approximate speed of light in vacuum?', answers: ['30,000 km/s', '150,000 km/s', '300,000 km/s', '1,000,000 km/s'], correct: 2 },
  { category: 'Sports', question: 'How many players does a football team field?', answers: ['9', '10', '11', '12'], correct: 2 },
  { category: 'Culture', question: 'Who painted the Mona Lisa?', answers: ['Michelangelo', 'Leonardo da Vinci', 'Raphael', 'Donatello'], correct: 1 },
  { category: 'Technology', question: 'What does the second W in WWW stand for?', answers: ['Web', 'World', 'Wide', 'Wire'], correct: 2 },
  { category: 'Geography', question: 'On which continent is the Nile River?', answers: ['Asia', 'Africa', 'Europe', 'South America'], correct: 1 },
  { category: 'Geography', question: 'What is the capital of Japan?', answers: ['Osaka', 'Kyoto', 'Tokyo', 'Nagoya'], correct: 2 },
  { category: 'Science', question: 'What is the chemical formula of water?', answers: ['CO₂', 'H₂O', 'O₂', 'NaCl'], correct: 1 },
  { category: 'Science', question: 'What is Earth’s natural satellite called?', answers: ['Mars', 'Venus', 'Moon', 'Titan'], correct: 2 },
  { category: 'Science', question: 'What is the largest organ in the human body?', answers: ['Heart', 'Liver', 'Lung', 'Skin'], correct: 3 },
  { category: 'Science', question: 'What process lets plants produce food using light?', answers: ['Respiration', 'Photosynthesis', 'Fermentation', 'Evaporation'], correct: 1 },
  { category: 'Sports', question: 'How many points is a basketball free throw worth?', answers: ['1', '2', '3', '4'], correct: 0 },
  { category: 'Sports', question: 'How many players are on a volleyball team on court?', answers: ['5', '6', '7', '8'], correct: 1 },
  { category: 'Sports', question: 'What is zero called in tennis scoring?', answers: ['Zero', 'Love', 'Blank', 'Nil'], correct: 1 },
  { category: 'History', question: 'Who developed the printing press in Europe?', answers: ['Edison', 'Gutenberg', 'Tesla', 'Bell'], correct: 1 },
  { category: 'History', question: 'In which country did the ancient Olympic Games begin?', answers: ['Italy', 'Egypt', 'Greece', 'Spain'], correct: 2 },
  { category: 'Culture', question: 'Who wrote The Little Prince?', answers: ['Victor Hugo', 'Jules Verne', 'Antoine de Saint-Exupéry', 'Albert Camus'], correct: 2 },
  { category: 'Technology', question: 'What does CPU stand for?', answers: ['Central Processing Unit', 'Computer Power Utility', 'Core Program User', 'Central Program Upload'], correct: 0 },
  { category: 'Geography', question: 'Which ocean is the largest?', answers: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], correct: 3 },
  { category: 'Science', question: 'Which planet is known as the Red Planet?', answers: ['Venus', 'Mars', 'Jupiter', 'Mercury'], correct: 1 },
]

export const englishEmojiPuzzles = [
  { emoji: '🌈', clues: ['sky', 'colors', 'rain'], answer: 'rainbow' },
  { emoji: '☕ ❤️', clues: ['hot', 'cup', 'break'], answer: 'coffee' },
  { emoji: '🧭 🗺️', clues: ['journey', 'discovery', 'quest'], answer: 'adventure' },
  { emoji: '🌙 ⭐', clues: ['night', 'sky', 'light'], answer: 'star' },
  { emoji: '⚽ 🥅', clues: ['pitch', 'goal', 'team'], answer: 'football' },
  { emoji: '🎬 🍿', clues: ['screen', 'movie', 'theater'], answer: 'cinema' },
  { emoji: '✈️ 🧳', clues: ['flight', 'luggage', 'trip'], answer: 'travel' },
  { emoji: '📚 🎓', clues: ['school', 'knowledge', 'lesson'], answer: 'education' },
  { emoji: '💻 🌐', clues: ['network', 'computer', 'connection'], answer: 'internet' },
  { emoji: '🎤 🎶', clues: ['sound', 'stage', 'song'], answer: 'music' },
  { emoji: '🍕 🧀', clues: ['dough', 'slice', 'oven'], answer: 'pizza' },
  { emoji: '🚲 🛣️', clues: ['pedal', 'two wheels', 'road'], answer: 'bicycle' },
  { emoji: '🌧️ ☂️', clues: ['rain', 'protection', 'open'], answer: 'umbrella' },
  { emoji: '🐝 🍯', clues: ['bee', 'sweet', 'hive'], answer: 'honey' },
  { emoji: '🌋 🔥', clues: ['lava', 'mountain', 'eruption'], answer: 'volcano' },
  { emoji: '🚀 🪐', clues: ['space', 'journey', 'planet'], answer: 'rocket' },
  { emoji: '🏆 🎉', clues: ['winner', 'cup', 'victory'], answer: 'champion' },
  { emoji: '🔑 🚪', clues: ['lock', 'door', 'open'], answer: 'key' },
  { emoji: '📷 🌄', clues: ['image', 'capture', 'memory'], answer: 'photo' },
  { emoji: '🧩 🧠', clues: ['piece', 'thinking', 'solve'], answer: 'puzzle' },
]

const englishWordBank = [
  ['Broadcast', 'camera', 'Captures the video for a broadcast'], ['Broadcast', 'microphone', 'Carries your voice to viewers'],
  ['Broadcast', 'viewer', 'The real power of a live stream'], ['Broadcast', 'comment', 'A message written by a viewer'],
  ['Broadcast', 'screen', 'The surface where images appear'], ['Broadcast', 'automation', 'A system that performs tasks automatically'],
  ['Sports', 'football', 'Played by eleven players on a green pitch'], ['Sports', 'basketball', 'Points are scored through a hoop'],
  ['Sports', 'volleyball', 'Played with hands over a net'], ['Sports', 'referee', 'Enforces the rules of a match'],
  ['Technology', 'computer', 'An electronic device that runs programs'], ['Technology', 'keyboard', 'A set of keys used for typing'],
  ['Technology', 'internet', 'The network that connects the world'], ['Technology', 'software', 'Programs that tell a device what to do'],
  ['Technology', 'algorithm', 'Ordered steps that solve a problem'], ['Technology', 'browser', 'An application that opens websites'],
  ['Nature', 'rainbow', 'Colors that appear in the sky after rain'], ['Nature', 'ocean', 'A vast body of water around continents'],
  ['Nature', 'forest', 'An area where many trees grow'], ['Nature', 'volcano', 'A mountain that can release lava'],
  ['Daily Life', 'adventure', 'A journey full of discovery and excitement'], ['Daily Life', 'coffee', 'A hot drink made from roasted beans'],
  ['Daily Life', 'book', 'Pages filled with stories and knowledge'], ['Daily Life', 'window', 'Lets light and air into a room'],
  ['Daily Life', 'umbrella', 'Opened to protect you from rain'], ['Culture', 'cinema', 'The art of watching films on a large screen'],
  ['Culture', 'music', 'A harmonious combination of rhythm and sound'], ['Culture', 'theater', 'Actors tell a live story on stage'],
  ['Science', 'atom', 'The smallest unit that keeps an element’s properties'], ['Science', 'energy', 'The ability to do work'],
]

const scramble = (answer: string, index: number) => {
  const letters = [...answer.toUpperCase()]
  let seed = (index + 1) * 7919
  for (let cursor = letters.length - 1; cursor > 0; cursor -= 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0
    const target = seed % (cursor + 1)
    ;[letters[cursor], letters[target]] = [letters[target], letters[cursor]]
  }
  if (letters.join('').toLowerCase() === answer.toLowerCase()) letters.reverse()
  return letters.join(' ')
}

export const englishWordPuzzles = englishWordBank.map(([category, answer, hint], index) => ({ category, answer, hint, scrambled: scramble(answer, index) }))
