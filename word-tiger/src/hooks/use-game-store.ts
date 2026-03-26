import { create } from 'zustand';
import { Puzzle, generatePuzzle, isValidGuess } from '@/lib/puzzle';
import { Dictionary } from '@/lib/dictionary';
import { SpeechService } from '@/lib/speech';
import { playTigerRoar } from '@/lib/audio';
import confetti from 'canvas-confetti';

export type GameMode = 'single' | 'two';

export interface Player {
  name: string;
  score: number;
}

export interface FoundWordEntry {
  word: string;
  playerIndex: number;
}

export interface GameState {
  status: 'loading' | 'setup' | 'playing' | 'ended';
  mode: GameMode;
  players: Player[];
  currentPlayerIndex: number;
  puzzle: Puzzle | null;
  foundWords: Set<string>;
  foundWordEntries: FoundWordEntry[];
  startTime: number;
  elapsedSeconds: number;
  message: { text: string; type: 'success' | 'error' | 'info' } | null;
  turnTimeLeft: number;
  turnTimerActive: boolean;
  spokenTimerWarnings: Set<number>;

  // Actions
  initialize: () => Promise<void>;
  startGame: (mode: GameMode, p1Name: string, p2Name: string) => void;
  endGame: () => void;
  submitWord: (word: string) => void;
  tickTimer: () => void;
  getHint: () => string | null;
  readLetters: () => void;
  readStatus: () => void;
  skipTurn: () => void;
}

const TURN_TIME = 30;
const TIMER_WARNINGS = [10, 5, 3, 2, 1];

const checkMilestones = (foundCount: number, totalCount: number) => {
  if (totalCount === 0) return;
  const pct = foundCount / totalCount;
  const thresholds = [0.25, 0.5, 0.75, 1.0];

  for (const t of thresholds) {
    const previousPct = (foundCount - 1) / totalCount;
    if (previousPct < t && pct >= t) {
      fireConfetti();
      const msgs: Record<number, string> = {
        0.25: "Great work! You're 25% of the way there!",
        0.5:  "Halfway there! Keep hunting!",
        0.75: "75% complete! You're on fire!",
        1.0:  "Incredible! You found every word! You're a true Word Tiger!",
      };
      SpeechService.speakNow(msgs[t] ?? "Great job!");
      break;
    }
  }
};

const fireConfetti = () => {
  const duration = 3000;
  const end = Date.now() + duration;
  const frame = () => {
    confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#f97316', '#fbbf24', '#ffffff'] });
    confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#f97316', '#fbbf24', '#ffffff'] });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
};

const spellOut = (word: string) => word.toUpperCase().split('').join(', ');

export const useGameStore = create<GameState>((set, get) => ({
  status: 'loading',
  mode: 'single',
  players: [],
  currentPlayerIndex: 0,
  puzzle: null,
  foundWords: new Set(),
  foundWordEntries: [],
  startTime: 0,
  elapsedSeconds: 0,
  message: null,
  turnTimeLeft: TURN_TIME,
  turnTimerActive: false,
  spokenTimerWarnings: new Set(),

  initialize: async () => {
    await Dictionary.load();
    set({ status: 'setup' });
  },

  startGame: (mode, p1Name, p2Name) => {
    const puzzle = generatePuzzle();
    if (!puzzle) {
      set({ message: { text: "Failed to generate puzzle", type: 'error' } });
      return;
    }

    const players = mode === 'single'
      ? [{ name: p1Name || 'Player 1', score: 0 }]
      : [{ name: p1Name || 'Player 1', score: 0 }, { name: p2Name || 'Player 2', score: 0 }];

    set({
      status: 'playing',
      mode,
      players,
      currentPlayerIndex: 0,
      puzzle,
      foundWords: new Set(),
      foundWordEntries: [],
      startTime: Date.now(),
      elapsedSeconds: 0,
      message: { text: `Game started! Find ${puzzle.validWords.length} words.`, type: 'info' },
      turnTimeLeft: TURN_TIME,
      turnTimerActive: mode === 'two',
      spokenTimerWarnings: new Set(),
    });

    // Roar first, then announce game start with letters
    playTigerRoar();
    const letterList = puzzle.letters.map(l => l.toUpperCase()).join(', ');
    const required = puzzle.required.toUpperCase();
    setTimeout(() => {
      SpeechService.speak(
        `Game started! You have ${puzzle.validWords.length} words to find. ` +
        `Your 9 letters are: ${letterList}. ` +
        `You must use the letter ${required} in every word. ` +
        `Type a word and press Enter, or hold Space to speak. ` +
        (mode === 'two' ? `${players[0].name} goes first. You have 30 seconds per turn. ` : '') +
        `Press S at any time to hear your current status. You may start the hunt!`
      );
    }, 200);
  },

  endGame: () => {
    const { players, foundWords, puzzle, mode } = get();
    set({ status: 'ended', turnTimerActive: false });

    let summary = `Game over. You found ${foundWords.size} words. `;
    if (mode === 'single') {
      summary += `Final score: ${players[0].score} points.`;
    } else {
      const p0 = players[0], p1 = players[1];
      summary += `${p0.name}: ${p0.score} points. ${p1.name}: ${p1.score} points. `;
      if (p0.score > p1.score) summary += `${p0.name} wins!`;
      else if (p1.score > p0.score) summary += `${p1.name} wins!`;
      else summary += `It's a tie!`;
    }

    const foundList  = [...foundWords];
    const missedList = puzzle ? puzzle.validWords.filter(w => !foundWords.has(w)) : [];

    // 1. Summary → 2. Found words → 3. 2-second pause → 4. Missed words (slower)
    SpeechService.speakThen(summary, 1.0, () => {
      if (foundList.length === 0) {
        // Nothing found — skip straight to missed words after pause
        setTimeout(() => {
          if (missedList.length > 0) {
            SpeechService.speak(`Words you missed: ${missedList.join(', ')}.`, false, 0.75);
          }
        }, 2000);
        return;
      }

      SpeechService.speakThen(
        `Words you found: ${foundList.join(', ')}.`,
        1.0,
        () => {
          setTimeout(() => {
            if (missedList.length > 0) {
              SpeechService.speak(
                `Words you missed: ${missedList.join(', ')}.`,
                false,
                0.75,
              );
            } else {
              SpeechService.speak('You found every single word. Incredible!');
            }
          }, 2000);
        },
      );
    });

    try {
      const stored = JSON.parse(localStorage.getItem('tigerLeaderboard') || '[]');
      const newEntries = players.map(p => ({ name: p.name, score: p.score, date: new Date().toISOString() }));
      const updated = [...stored, ...newEntries].sort((a, b) => b.score - a.score).slice(0, 10);
      localStorage.setItem('tigerLeaderboard', JSON.stringify(updated));
    } catch (e) {
      console.error("Leaderboard save error", e);
    }
  },

  skipTurn: () => {
    const { mode, players, currentPlayerIndex } = get();
    if (mode !== 'two') return;
    const nextIndex = currentPlayerIndex === 0 ? 1 : 0;
    const nextName = players[nextIndex].name;
    set({
      currentPlayerIndex: nextIndex,
      turnTimeLeft: TURN_TIME,
      spokenTimerWarnings: new Set(),
      message: { text: `Time's up! ${nextName}'s turn`, type: 'info' }
    });
    SpeechService.speakNow(`Time's up! ${nextName}'s turn. You have 30 seconds.`);
  },

  submitWord: (rawWord: string) => {
    const word = rawWord.trim().toLowerCase().replace(/[^a-z]/g, "");
    if (!word) return;

    const { puzzle, foundWords, foundWordEntries, players, currentPlayerIndex, mode } = get();
    if (!puzzle) return;

    if (foundWords.has(word)) {
      SpeechService.speak(`Already found: ${spellOut(word)}`);
      set({ message: { text: `Already found: ${word.toUpperCase()}`, type: 'error' } });
      return;
    }

    const { valid, reason } = isValidGuess(word, puzzle);

    if (!valid) {
      const msg = reason || "Invalid word";
      SpeechService.speak(msg);
      set({ message: { text: msg, type: 'error' } });
      return;
    }

    const newFound = new Set(foundWords);
    newFound.add(word);
    const newEntries = [...foundWordEntries, { word, playerIndex: currentPlayerIndex }];

    const newPlayers = [...players];
    newPlayers[currentPlayerIndex] = {
      ...newPlayers[currentPlayerIndex],
      score: newPlayers[currentPlayerIndex].score + 1,
    };

    let nextPlayerIndex = currentPlayerIndex;
    if (mode === 'two') {
      nextPlayerIndex = currentPlayerIndex === 0 ? 1 : 0;
    }

    const newScore = newPlayers[currentPlayerIndex].score;
    const remaining = puzzle.validWords.length - newFound.size;

    set({
      foundWords: newFound,
      foundWordEntries: newEntries,
      players: newPlayers,
      currentPlayerIndex: nextPlayerIndex,
      turnTimeLeft: TURN_TIME,
      spokenTimerWarnings: new Set(),
      message: { text: `+1 point for ${players[currentPlayerIndex].name}!`, type: 'success' }
    });

    checkMilestones(newFound.size, puzzle.validWords.length);

    // Speak word result
    let announcement = `Correct! ${word}. `;
    if (mode === 'single') {
      announcement += `Score: ${newScore}. ${remaining} words remaining.`;
    } else {
      const nextName = players[nextPlayerIndex].name;
      announcement += `${players[currentPlayerIndex].name} scores. ${nextName}'s turn.`;
    }
    SpeechService.speak(announcement);
  },

  tickTimer: () => {
    const { status, startTime, mode, turnTimeLeft, turnTimerActive, spokenTimerWarnings } = get();
    if (status !== 'playing') return;

    set({ elapsedSeconds: Math.floor((Date.now() - startTime) / 1000) });

    if (mode === 'two' && turnTimerActive) {
      const newTime = turnTimeLeft - 1;
      if (newTime <= 0) {
        get().skipTurn();
      } else {
        // Speak timer warnings
        if (TIMER_WARNINGS.includes(newTime) && !spokenTimerWarnings.has(newTime)) {
          const newWarnings = new Set(spokenTimerWarnings);
          newWarnings.add(newTime);
          set({ turnTimeLeft: newTime, spokenTimerWarnings: newWarnings });
          SpeechService.speak(newTime === 1 ? "1 second!" : `${newTime} seconds!`);
        } else {
          set({ turnTimeLeft: newTime });
        }
      }
    }
  },

  getHint: () => {
    const { puzzle, foundWords } = get();
    if (!puzzle) return null;

    const missing = puzzle.validWords.filter(w => !foundWords.has(w));
    if (missing.length === 0) {
      const msg = "No more words to find! You've got them all!";
      set({ message: { text: msg, type: 'info' } });
      SpeechService.speak(msg);
      return null;
    }

    const hintWord = missing[Math.floor(Math.random() * missing.length)];
    const hintMsg = `Hint: try a ${hintWord.length}-letter word starting with ${hintWord[0].toUpperCase()}`;
    set({ message: { text: hintMsg, type: 'info' } });
    SpeechService.speak(hintMsg);
    return hintWord;
  },

  readLetters: () => {
    const { puzzle } = get();
    if (!puzzle) return;
    const letters = puzzle.letters.map(l => l.toUpperCase()).join(', ');
    const msg = `Your letters are: ${letters}. The required center letter is ${puzzle.required.toUpperCase()}. You must use it in every word.`;
    SpeechService.speakNow(msg);
    set({ message: { text: `Letters: ${puzzle.letters.join(' ').toUpperCase()} — Required: ${puzzle.required.toUpperCase()}`, type: 'info' } });
  },

  readStatus: () => {
    const { puzzle, players, foundWords, currentPlayerIndex, mode, turnTimeLeft } = get();
    if (!puzzle) return;

    const remaining = puzzle.validWords.length - foundWords.size;
    const pct = Math.round((foundWords.size / puzzle.validWords.length) * 100);

    let status = `Status: ${foundWords.size} words found, ${remaining} remaining, ${pct}% complete. `;
    if (mode === 'single') {
      status += `Your score is ${players[0].score}.`;
    } else {
      const p0 = players[0], p1 = players[1];
      status += `${p0.name}: ${p0.score} points. ${p1.name}: ${p1.score} points. `;
      status += `It is ${players[currentPlayerIndex].name}'s turn with ${turnTimeLeft} seconds remaining.`;
    }
    SpeechService.speakNow(status);
  },
}));
