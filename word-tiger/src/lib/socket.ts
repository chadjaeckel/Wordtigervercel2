import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;
let listenersRegistered = false;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(window.location.origin, {
      path: '/api/socket.io',
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    listenersRegistered = false;
  }
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
    listenersRegistered = false;
  }
}

export function getListenersRegistered(): boolean {
  return listenersRegistered;
}

export function setListenersRegistered(v: boolean): void {
  listenersRegistered = v;
}
