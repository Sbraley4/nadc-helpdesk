import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import useAuthStore from '../store/authStore';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}

export function useSocket() {
  const { user, isAuthenticated } = useAuthStore();
  const socketRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const socket = getSocket();
    socketRef.current = socket;

    if (!socket.connected) {
      socket.connect();
    }

    // Join user room for notifications
    socket.emit('join:user', { userId: user.id });
    socket.emit('join:agents');

    return () => {
      socket.emit('leave:user', { userId: user.id });
    };
  }, [isAuthenticated, user]);

  return socketRef.current;
}

export function useTicketSocket(ticketId) {
  const socket = useSocket();

  useEffect(() => {
    if (!socket || !ticketId) return;

    socket.emit('join:ticket', { ticketId });

    return () => {
      socket.emit('leave:ticket', { ticketId });
    };
  }, [socket, ticketId]);

  return socket;
}

export default useSocket;
