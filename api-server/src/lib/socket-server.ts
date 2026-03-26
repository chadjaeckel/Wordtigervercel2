import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';
import {
  createRoom, joinRoom, getRoom, deleteRoom,
  handleSubmitWord, serializeRoom,
} from './rooms.js';
import { logger } from './logger.js';


export function attachSocketIO(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    path: '/api/socket.io',
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  const roomTimers = new Map<string, NodeJS.Timeout>();

  function startRoomTimer(roomCode: string) {
    if (roomTimers.has(roomCode)) clearInterval(roomTimers.get(roomCode)!);

    const interval = setInterval(() => {
      const room = getRoom(roomCode);
      if (!room || room.status !== 'playing') {
        clearInterval(interval);
        roomTimers.delete(roomCode);
        return;
      }

      room.elapsedSeconds = Math.floor((Date.now() - room.startTime) / 1000);
      room.turnTimeLeft = Math.max(0, room.turnTimeLeft - 1);

      if (room.turnTimeLeft <= 0) {
        const prevPlayer = room.players[room.currentPlayerIndex].name;

        if (room.wordsFoundThisTurn === 0) {
          room.consecutiveEmptyTurns += 1;
        } else {
          room.consecutiveEmptyTurns = 0;
        }
        room.wordsFoundThisTurn = 0;

        if (room.consecutiveEmptyTurns >= 6) {
          room.status = 'ended';
          clearInterval(interval);
          roomTimers.delete(roomCode);
          io.to(roomCode).emit('game-ended', { state: serializeRoom(room), reason: 'idle' });
          setTimeout(() => deleteRoom(roomCode), 30 * 60 * 1000);
          logger.info({ roomCode }, 'Game auto-ended: 3 idle cycles');
          return;
        }

        room.currentPlayerIndex = room.currentPlayerIndex === 0 ? 1 : 0;
        room.turnTimeLeft = room.turnTime;
        const nextPlayer = room.players[room.currentPlayerIndex].name;
        io.to(roomCode).emit('state-update', serializeRoom(room));
        io.to(roomCode).emit('turn-skipped', { prevPlayer, nextPlayer });
      } else {
        io.to(roomCode).emit('state-update', serializeRoom(room));
      }
    }, 1000);

    roomTimers.set(roomCode, interval);
  }

  function stopRoomTimer(roomCode: string) {
    const t = roomTimers.get(roomCode);
    if (t) { clearInterval(t); roomTimers.delete(roomCode); }
  }

  io.on('connection', socket => {
    logger.info({ socketId: socket.id }, 'Socket connected');

    socket.on('create-room', ({ playerName, turnDuration }: { playerName: string; turnDuration?: number }) => {
      try {
        const room = createRoom(playerName, socket.id, turnDuration ?? 60);
        socket.join(room.roomCode);
        socket.emit('room-created', {
          roomCode: room.roomCode,
          playerIndex: 0,
          state: serializeRoom(room),
        });
        logger.info({ roomCode: room.roomCode, playerName }, 'Room created');
      } catch (err) {
        logger.error({ err }, 'create-room error');
        socket.emit('error', { message: 'Failed to create room' });
      }
    });

    socket.on('join-room', ({ roomCode, playerName }: { roomCode: string; playerName: string }) => {
      try {
        const { room, error } = joinRoom(roomCode, playerName, socket.id);
        if (error || !room) {
          socket.emit('join-error', { message: error || 'Failed to join room' });
          return;
        }
        socket.join(room.roomCode);
        socket.emit('joined-room', { playerIndex: 1, state: serializeRoom(room) });
        socket.to(room.roomCode).emit('opponent-joined', {
          playerName: room.players[1].name,
          state: serializeRoom(room),
        });
        startRoomTimer(room.roomCode);
        logger.info({ roomCode: room.roomCode, playerName }, 'Player joined');
      } catch (err) {
        logger.error({ err }, 'join-room error');
        socket.emit('join-error', { message: 'Failed to join room' });
      }
    });

    socket.on('submit-word', ({ roomCode, word }: { roomCode: string; word: string }) => {
      const room = getRoom(roomCode);
      if (!room) { socket.emit('word-result', { success: false, reason: 'Room not found', word }); return; }
      if (room.status !== 'playing') { socket.emit('word-result', { success: false, reason: 'Game not in progress', word }); return; }

      const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
      if (playerIndex === -1) { socket.emit('word-result', { success: false, reason: 'Not in this room', word }); return; }
      if (playerIndex !== room.currentPlayerIndex) {
        socket.emit('word-result', { success: false, reason: "It's not your turn", word });
        return;
      }

      const result = handleSubmitWord(room, word, playerIndex);
      socket.emit('word-result', { success: result.success, reason: result.reason, word });
      io.to(roomCode).emit('state-update', serializeRoom(room));
    });

    socket.on('end-game', ({ roomCode }: { roomCode: string }) => {
      const room = getRoom(roomCode);
      if (!room) return;
      room.status = 'ended';
      stopRoomTimer(roomCode);
      io.to(roomCode).emit('game-ended', { state: serializeRoom(room) });
      setTimeout(() => deleteRoom(roomCode), 30 * 60 * 1000);
      logger.info({ roomCode }, 'Game ended');
    });

    socket.on('disconnect', () => {
      logger.info({ socketId: socket.id }, 'Socket disconnected');
    });
  });

  return io;
}
