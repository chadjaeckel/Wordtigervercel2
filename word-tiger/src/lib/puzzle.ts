import { Dictionary } from "./dictionary";

const MIN_WORD_LENGTH = 4;
const MIN_VALID_WORDS = 20;

// Obscure 9-letter words filter
const COMMON_5 = new Set([
  "about", "after", "again", "below", "could", "every", "first",
  "found", "great", "house", "large", "learn", "never", "place",
  "plant", "point", "right", "small", "sound", "spell", "still",
  "study", "their", "there", "these", "thing", "think", "three",
  "water", "where", "which", "world", "would", "write", "tiger"
]);

export interface Puzzle {
  letters: string[];
  required: string;
  centerIndex: number;
  baseWord: string;
  validWords: string[];
}

function hasCommonSubword(word: string): boolean {
  for (let i = 0; i <= word.length - 5; i++) {
    const chunk = word.slice(i, i + 5);
    if (COMMON_5.has(chunk)) return true;
  }
  // If no common 5-letter, let's also pass some words just so we don't loop forever 
  // if dictionary is small (like in fallback mode)
  return Dictionary.words.size < 100 ? true : false; 
}

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function isValidGuess(word: string, puzzle: Puzzle): { valid: boolean; reason?: string } {
  const w = word.toLowerCase();
  
  if (w.length < MIN_WORD_LENGTH) return { valid: false, reason: "Too short (min 4 letters)" };
  if (!w.includes(puzzle.required)) return { valid: false, reason: `Must contain center letter '${puzzle.required.toUpperCase()}'` };
  if (!Dictionary.isValidWord(w)) return { valid: false, reason: "Not in word list" };

  const freq: Record<string, number> = {};
  puzzle.letters.forEach(ch => { freq[ch] = (freq[ch] || 0) + 1; });

  const used: Record<string, number> = {};
  for (const ch of w) {
    if (!freq[ch]) return { valid: false, reason: `Letter '${ch.toUpperCase()}' is not in the puzzle` };
    used[ch] = (used[ch] || 0) + 1;
    if (used[ch] > freq[ch]) return { valid: false, reason: `Letter '${ch.toUpperCase()}' used too many times` };
  }

  return { valid: true };
}

export function findValidWords(puzzle: Omit<Puzzle, 'validWords'>): string[] {
  const results: string[] = [];
  for (const word of Dictionary.words) {
    const { valid } = isValidGuess(word, { ...puzzle, validWords: [] });
    if (valid) results.push(word);
  }
  return results;
}

export function generatePuzzle(): Puzzle | null {
  if (!Dictionary.isLoaded || Dictionary.words.size === 0) {
    console.error("Dictionary not loaded.");
    return null;
  }

  const nineLetterWords: string[] = [];
  for (const w of Dictionary.words) {
    if (w.length === 9) nineLetterWords.push(w);
  }

  if (nineLetterWords.length === 0) {
    console.error("No 9-letter words available.");
    return null;
  }

  let attempts = 0;
  while (attempts < 1000) {
    attempts++;
    const baseWord = nineLetterWords[Math.floor(Math.random() * nineLetterWords.length)];
    if (!hasCommonSubword(baseWord)) continue;

    const letters = shuffle(baseWord.split(""));
    const required = letters[4];

    const tempPuzzle = { letters, required, centerIndex: 4, baseWord };
    const validWords = findValidWords(tempPuzzle);

    if (validWords.length >= MIN_VALID_WORDS || Dictionary.words.size < 100) {
      return { ...tempPuzzle, validWords };
    }
  }

  return null;
}
