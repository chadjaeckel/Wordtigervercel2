import { generatePuzzle, isValidGuess, type Puzzle } from './game-logic.js';

const TURN_TIME = 30;

export interface RoomPlayer {
  name: string;
  score: number;
  socketId: string;
}

export interface FoundWordEntry {
  word: string;
  playerIndex: number;
}

export interface Room {
  roomCode: string;
  status: 'waiting' | 'playing' | 'ended';
  players: RoomPlayer[];
  puzzle: Puzzle | null;
  foundWords: Set<string>;
  foundWordEntries: FoundWordEntry[];
  currentPlayerIndex: number;
  turnTime: number;
  turnTimeLeft: number;
  wordsFoundThisTurn: number;
  consecutiveEmptyTurns: number;
  startTime: number;
  elapsedSeconds: number;
}

export interface ClientRoomState {
  roomCode: string;
  status: 'waiting' | 'playing' | 'ended';
  players: Array<{ name: string; score: number }>;
  puzzle: Puzzle | null;
  foundWords: string[];
  foundWordEntries: FoundWordEntry[];
  currentPlayerIndex: number;
  turnTime: number;
  turnTimeLeft: number;
  elapsedSeconds: number;
}

const rooms = new Map<string, Room>();

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code: string;
  do {
    code = Array.from({ length: 4 }, () =>
      chars[Math.floor(Math.random() * chars.length)],
    ).join('');
  } while (rooms.has(code));
  return code;
}

export function serializeRoom(room: Room): ClientRoomState {
  return {
    roomCode: room.roomCode,
    status: room.status,
    players: room.players.map(p => ({ name: p.name, score: p.score })),
    puzzle: room.puzzle,
    foundWords: [...room.foundWords],
    foundWordEntries: room.foundWordEntries,
    currentPlayerIndex: room.currentPlayerIndex,
    turnTime: room.turnTime,
    turnTimeLeft: room.turnTimeLeft,
    elapsedSeconds: room.elapsedSeconds,
  };
}

export function createRoom(playerName: string, socketId: string, turnTime: number = TURN_TIME): Room {
  const code = generateCode();
  const puzzle = generatePuzzle();
  const clampedTurnTime = Math.min(180, Math.max(30, turnTime));
  const room: Room = {
    roomCode: code,
    status: 'waiting',
    players: [{ name: playerName || 'Player 1', score: 0, socketId }],
    puzzle,
    foundWords: new Set(),
    foundWordEntries: [],
    currentPlayerIndex: 0,
    turnTime: clampedTurnTime,
    turnTimeLeft: clampedTurnTime,
    wordsFoundThisTurn: 0,
    consecutiveEmptyTurns: 0,
    startTime: 0,
    elapsedSeconds: 0,
  };
  rooms.set(code, room);
  return room;
}

export function joinRoom(
  roomCode: string,
  playerName: string,
  socketId: string,
): { room: Room | null; error?: string } {
  const room = rooms.get(roomCode.toUpperCase());
  if (!room) return { room: null, error: 'Room not found. Check the code and try again.' };
  if (room.status !== 'waiting') return { room: null, error: 'This game has already started.' };
  if (room.players.length >= 2) return { room: null, error: 'Room is full.' };

  room.players.push({ name: playerName || 'Player 2', score: 0, socketId });
  room.status = 'playing';
  room.startTime = Date.now();
  return { room };
}

export function getRoom(roomCode: string): Room | undefined {
  return rooms.get(roomCode.toUpperCase());
}

export function deleteRoom(roomCode: string): void {
  rooms.delete(roomCode.toUpperCase());
}

export function handleSubmitWord(
  room: Room,
  word: string,
  playerIndex: number,
): { success: boolean; reason?: string } {
  const w = word.trim().toLowerCase().replace(/[^a-z]/g, '');
  if (!w || !room.puzzle) return { success: false, reason: 'Invalid input' };
  if (room.foundWords.has(w)) return { success: false, reason: `Already found: ${w.toUpperCase()}` };

  const { valid, reason } = isValidGuess(w, room.puzzle);
  if (!valid) return { success: false, reason: reason || 'Invalid word' };

  room.foundWords.add(w);
  room.foundWordEntries.push({ word: w, playerIndex });
  room.players[playerIndex].score += 1;
  room.wordsFoundThisTurn += 1;
  room.consecutiveEmptyTurns = 0;
  return { success: true };
}
