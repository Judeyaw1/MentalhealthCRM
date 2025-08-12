import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/hooks/useAuth';

interface WebSocketContextType {
  isConnected: boolean;
  socket: Socket | null;
  emit: (event: string, data: any) => void;
  addEventListener: (event: string, callback: (data: any) => void) => void;
  removeEventListener: (event: string, callback: (data: any) => void) => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}

interface WebSocketProviderProps {
  children: React.ReactNode;
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user, isLoading } = useAuth();
  const eventListenersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());

  // Debug WebSocket context initialization
  useEffect(() => {
    console.log('🔌 WebSocket Context initialized:', { user: user?.id, isLoading, isConnected });
  }, [user?.id, isLoading, isConnected]);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    console.log('🔌 Creating WebSocket connection...');
    
    const socket = io(process.env.NODE_ENV === 'production' 
      ? window.location.origin 
      : 'http://localhost:3000', {
      transports: ['polling', 'websocket'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
      timeout: 20000,
      forceNew: false,
    });

    socket.on('connect', () => {
      console.log('🔌 WebSocket connected successfully');
      setIsConnected(true);
      
      // Authenticate the user
      if (user?.id) {
        console.log('🔌 Authenticating user:', user.id);
        socket.emit('authenticate', user.id);
      }

      // Re-register all event listeners
      eventListenersRef.current.forEach((listeners, event) => {
        listeners.forEach(callback => {
          socket.on(event, callback);
        });
      });
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 WebSocket disconnected:', reason);
      setIsConnected(false);
      
      console.log('🔌 Disconnect reason details:', {
        reason,
        socketId: socket.id,
        connected: socket.connected,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('connect_error', (error) => {
      console.error('🔌 WebSocket connection error:', error);
      setIsConnected(false);
      console.log('🔌 Current transport:', socket.io.engine.transport.name);
    });

    socket.on('upgrade', () => {
      console.log('🔌 Transport upgraded to:', socket.io.engine.transport.name);
    });

    socket.on('upgrade_error', (error) => {
      console.error('🔌 Transport upgrade error:', error);
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log('🔌 WebSocket reconnected, attempt:', attemptNumber);
      setIsConnected(true);
      
      // Re-authenticate after reconnection
      if (user?.id) {
        socket.emit('authenticate', user.id);
      }
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('🔌 WebSocket reconnection attempt:', attemptNumber);
    });

    socket.on('reconnect_error', (error) => {
      console.error('🔌 WebSocket reconnection error:', error);
    });

    // Heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
      if (socket.connected) {
        socket.emit('ping');
      }
    }, 30000);

    socket.on('pong', () => {
      // Heartbeat received
    });

    socketRef.current = socket;

    // Manually connect
    socket.connect();

    // Cleanup heartbeat on disconnect
    return () => {
      clearInterval(heartbeat);
    };
  }, [user?.id]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      console.log('🔌 Disconnecting WebSocket...');
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  const emit = useCallback((event: string, data: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  }, []);

  const addEventListener = useCallback((event: string, callback: (data: any) => void) => {
    if (!eventListenersRef.current.has(event)) {
      eventListenersRef.current.set(event, new Set());
    }
    eventListenersRef.current.get(event)!.add(callback);
    
    // If socket is already connected, add the listener immediately
    if (socketRef.current?.connected) {
      socketRef.current.on(event, callback);
    }
  }, []);

  const removeEventListener = useCallback((event: string, callback: (data: any) => void) => {
    const listeners = eventListenersRef.current.get(event);
    if (listeners) {
      listeners.delete(callback);
      if (socketRef.current?.connected) {
        socketRef.current.off(event, callback);
      }
    }
  }, []);

  useEffect(() => {
    // Wait for authentication to complete
    if (isLoading) {
      console.log('🔌 Authentication still loading, waiting...');
      return;
    }

    if (user?.id) {
      console.log('🔌 User authenticated, connecting WebSocket...');
      // Add a small delay to ensure server is ready
      const timer = setTimeout(() => {
        connect();
      }, 1000);
      
      return () => clearTimeout(timer);
    } else {
      console.log('🔌 No user ID, disconnecting WebSocket');
      disconnect();
    }
  }, [user?.id, isLoading, connect, disconnect]);

  // Handle visibility changes (tab switching)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && socketRef.current && !socketRef.current.connected) {
        console.log('🔌 Tab became visible, reconnecting...');
        socketRef.current.connect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const value: WebSocketContextType = {
    isConnected,
    socket: socketRef.current,
    emit,
    addEventListener,
    removeEventListener,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}
