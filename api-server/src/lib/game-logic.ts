import { readFileSync } from 'fs';
import path from 'path';
import { logger } from './logger.js';

const COMMON_PROPER_NOUNS = new Set([
  'john', 'mary', 'james', 'robert', 'smith', 'jones',
  'michael', 'linda', 'david', 'jennifer', 'william',
  'elizabeth', 'thomas', 'sarah',
]);

const COMMON_5 = new Set([
  'about', 'after', 'again', 'below', 'could', 'every', 'first',
  'found', 'great', 'house', 'large', 'learn', 'never', 'place',
  'plant', 'point', 'right', 'small', 'sound', 'spell', 'still',
  'study', 'their', 'there', 'these', 'thing', 'think', 'three',
  'water', 'where', 'which', 'world', 'would', 'write', 'tiger',
]);

export interface Puzzle {
  letters: string[];
  required: string;
  centerIndex: number;
  baseWord: string;
  validWords: string[];
}

// Try multiple known paths to find words.txt
function loadDictionary(): Set<string> {
  const candidates = [
    path.join(__dirname, '../../word-tiger/public/words.txt'),
    path.join(process.cwd(), 'artifacts/word-tiger/public/words.txt'),
    path.join(process.cwd(), '../../word-tiger/public/words.txt'),
  ];
  for (const p of candidates) {
    try {
      const text = readFileSync(p, 'utf-8');
      const result = new Set<string>();
      for (let w of text.split(/\r?\n/)) {
        w = w.trim().toLowerCase();
        if (w.length >= 4 && !COMMON_PROPER_NOUNS.has(w)) result.add(w);
      }
      if (result.size > 100) {
        logger.info({ path: p, size: result.size }, 'Dictionary loaded');
        return result;
      }
    } catch {}
  }
  logger.warn('words.txt not found, using tiny fallback dictionary');
  return new Set(['tiger', 'great', 'after', 'about', 'alert', 'later', 'alter', 'regal', 'large']);
}

export const words: Set<string> = loadDictionary();

export function isValidWord(word: string): boolean {
  return words.has(word.toLowerCase());
}

function hasCommonSubword(word: string): boolean {
  for (let i = 0; i <= word.length - 5; i++) {
    if (COMMON_5.has(word.slice(i, i + 5))) return true;
  }
  return words.size < 100;
}

function shuffle<T>(arr: T[]): T[] {
  const r = [...arr];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

export function isValidGuess(
  word: string,
  puzzle: Puzzle,
): { valid: boolean; reason?: string } {
  const w = word.toLowerCase();
  if (w.length < 4) return { valid: false, reason: 'Too short (min 4 letters)' };
  if (!w.includes(puzzle.required))
    return { valid: false, reason: `Must contain '${puzzle.required.toUpperCase()}'` };
  if (!isValidWord(w)) return { valid: false, reason: 'Not in word list' };

  const freq: Record<string, number> = {};
  puzzle.letters.forEach(ch => { freq[ch] = (freq[ch] || 0) + 1; });

  const used: Record<string, number> = {};
  for (const ch of w) {
    if (!freq[ch])
      return { valid: false, reason: `Letter '${ch.toUpperCase()}' not in puzzle` };
    used[ch] = (used[ch] || 0) + 1;
    if (used[ch] > freq[ch])
      return { valid: false, reason: `Letter '${ch.toUpperCase()}' used too many times` };
  }
  return { valid: true };
}

function findValidWords(puzzle: Omit<Puzzle, 'validWords'>): string[] {
  const results: string[] = [];
  for (const word of words) {
    const { valid } = isValidGuess(word, { ...puzzle, validWords: [] });
    if (valid) results.push(word);
  }
  return results;
}

export function generatePuzzle(): Puzzle | null {
  if (words.size === 0) return null;

  const nines: string[] = [];
  for (const w of words) if (w.length === 9) nines.push(w);
  if (nines.length === 0) return null;

  for (let attempt = 0; attempt < 1000; attempt++) {
    const baseWord = nines[Math.floor(Math.random() * nines.length)];
    if (!hasCommonSubword(baseWord)) continue;

    const letters = shuffle(baseWord.split(''));
    const required = letters[4];
    const temp = { letters, required, centerIndex: 4, baseWord };
    const validWords = findValidWords(temp);
    if (validWords.length >= 20) return { ...temp, validWords };
  }
  return null;
}
