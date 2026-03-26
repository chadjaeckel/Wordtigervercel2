import { create } from 'zustand';
import {
  getSocket, disconnectSocket,
  getListenersRegistered, setListenersRegistered,
} from '@/lib/socket';
import type { Puzzle } from '@/lib/puzzle';

export interface OnlinePlayer {
  name: string;
  score: number;
}

export interface OnlineFoundWordEntry {
  word: string;
  playerIndex: number;
}

export interface OnlineGameState {
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  roomCode: string | null;
  myPlayerIndex: number | null;
  status: 'idle' | 'waiting' | 'playing' | 'ended';
  players: OnlinePlayer[];
  currentPlayerIndex: number;
  puzzle: Puzzle | null;
  foundWords: Set<string>;
  foundWordEntries: OnlineFoundWordEntry[];
  turnTime: number;
  turnTimeLeft: number;
  elapsedSeconds: number;
  message: { text: string; type: 'success' | 'error' | 'info' } | null;
  error: string | null;

  connect: () => void;
  createRoom: (playerName: string, turnDuration: number) => void;
  joinRoom: (roomCode: string, playerName: string) => void;
  submitWord: (word: string) => void;
  endGame: () => void;
  reset: () => void;
}

function applyState(
  set: (partial: Partial<OnlineGameState>) => void,
  serverState: {
    status: string;
    players: OnlinePlayer[];
    currentPlayerIndex: number;
    puzzle: Puzzle | null;
    foundWords: string[];
    foundWordEntries: OnlineFoundWordEntry[];
    turnTime: number;
    turnTimeLeft: number;
    elapsedSeconds: number;
    roomCode: string;
  },
) {
  set({
    roomCode: serverState.roomCode,
    status: serverState.status as OnlineGameState['status'],
    players: serverState.players,
    currentPlayerIndex: serverState.currentPlayerIndex,
    puzzle: serverState.puzzle,
    foundWords: new Set(serverState.foundWords ?? []),
    foundWordEntries: serverState.foundWordEntries ?? [],
    turnTime: serverState.turnTime,
    turnTimeLeft: serverState.turnTimeLeft,
    elapsedSeconds: serverState.elapsedSeconds,
  });
}

export const useOnlineStore = create<OnlineGameState>((set, get) => ({
  connectionStatus: 'disconnected',
  roomCode: null,
  myPlayerIndex: null,
  status: 'idle',
  players: [],
  currentPlayerIndex: 0,
  puzzle: null,
  foundWords: new Set(),
  foundWordEntries: [],
  turnTime: 60,
  turnTimeLeft: 60,
  elapsedSeconds: 0,
  message: null,
  error: null,

  connect: () => {
    if (getListenersRegistered()) return;
    setListenersRegistered(true);

    const socket = getSocket();
    set({ connectionStatus: 'connecting' });

    socket.on('connect', () => {
      set({ connectionStatus: 'connected', error: null });
    });
    socket.on('disconnect', () => {
      set({ connectionStatus: 'disconnected' });
    });
    socket.on('connect_error', () => {
      set({ connectionStatus: 'error', error: 'Cannot connect to game server. Please try again.' });
    });

    socket.on('room-created', ({ roomCode, playerIndex, state }) => {
      set({ myPlayerIndex: playerIndex });
      applyState(set, state);
    });

    socket.on('opponent-joined', ({ playerName, state }) => {
      applyState(set, state);
      set({ message: { text: `${playerName} joined! Game is starting!`, type: 'info' } });
    });

    socket.on('joined-room', ({ playerIndex, state }) => {
      set({ myPlayerIndex: playerIndex });
      applyState(set, state);
    });

    socket.on('state-update', state => {
      applyState(set, state);
    });

    socket.on('word-result', ({ success, reason, word }: { success: boolean; reason?: string; word: string }) => {
      set({
        message: {
          text: success
            ? `✓ ${word.toUpperCase()} — nice!`
            : (reason ?? 'Invalid word'),
          type: success ? 'success' : 'error',
        },
      });
    });

    socket.on('turn-skipped', ({ nextPlayer }: { prevPlayer: string; nextPlayer: string }) => {
      set({ message: { text: `Time's up! ${nextPlayer}'s turn.`, type: 'info' } });
    });

    socket.on('game-ended', ({ state }) => {
      applyState(set, state);
    });

    socket.on('join-error', ({ message }: { message: string }) => {
      set({ error: message });
    });

    socket.on('error', ({ message }: { message: string }) => {
      set({ error: message });
    });
  },

  createRoom: (playerName: string, turnDuration: number) => {
    set({ error: null });
    getSocket().emit('create-room', { playerName, turnDuration });
  },

  joinRoom: (roomCode: string, playerName: string) => {
    set({ error: null });
    getSocket().emit('join-room', { roomCode: roomCode.toUpperCase().trim(), playerName });
  },

  submitWord: (word: string) => {
    const { roomCode } = get();
    if (!roomCode) return;
    getSocket().emit('submit-word', { roomCode, word });
  },

  endGame: () => {
    const { roomCode } = get();
    if (!roomCode) return;
    set({ status: 'ended' });
    getSocket().emit('end-game', { roomCode });
  },

  reset: () => {
    disconnectSocket();
    set({
      connectionStatus: 'disconnected',
      roomCode: null,
      myPlayerIndex: null,
      status: 'idle',
      players: [],
      currentPlayerIndex: 0,
      puzzle: null,
      foundWords: new Set(),
      foundWordEntries: [],
      turnTime: 60,
      turnTimeLeft: 60,
      elapsedSeconds: 0,
      message: null,
      error: null,
    });
  },
}));
