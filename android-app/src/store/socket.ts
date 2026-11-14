import { io, Socket } from 'socket.io-client';
import { API_URL, getAccessToken } from '../api/client';
let socket: Socket | null = null;
export async function connectSocket(): Promise<Socket> {
  if (socket?.connected) return socket;
  const token = await getAccessToken();
  socket = io(API_URL, { auth: { token }, transports: ['websocket', 'polling'] });
  return socket;
}
export function getSocket() { return socket; }
export function disconnectSocket() { socket?.disconnect(); socket = null; }
