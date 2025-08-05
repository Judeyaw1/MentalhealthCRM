import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './useAuth';

interface UseSocketOptions {
  onPatientCreated?: (data: any) => void;
  onPatientUpdated?: (data: any) => void;
  onPatientDeleted?: (data: any) => void;
  onAppointmentCreated?: (data: any) => void;
  onAppointmentUpdated?: (data: any) => void;
  onAppointmentDeleted?: (data: any) => void;
  onTreatmentRecordCreated?: (data: any) => void;
  onTreatmentRecordUpdated?: (data: any) => void;
  onTreatmentRecordDeleted?: (data: any) => void;
  onNotificationCreated?: (data: any) => void;
  onNotificationRead?: (data: any) => void;
  onStaffCreated?: (data: any) => void;
  onStaffUpdated?: (data: any) => void;
  onStaffDeleted?: (data: any) => void;
  onDashboardStatsUpdated?: (data: any) => void;
}

export function useSocket(options: UseSocketOptions = {}) {
  const socketRef = useRef<Socket | null>(null);
  const { user } = useAuth();

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const socket = io(process.env.NODE_ENV === 'production' 
      ? window.location.origin 
      : 'http://localhost:3000', {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
      timeout: 20000,
      forceNew: false, // Reuse existing connection if available
    });

    socket.on('connect', () => {
      console.log('🔌 WebSocket connected');
      
      // Authenticate the user
      if (user?.id) {
        socket.emit('authenticate', user.id);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 WebSocket disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('🔌 WebSocket connection error:', error);
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log('🔌 WebSocket reconnected after', attemptNumber, 'attempts');
      
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
    }, 30000); // Send ping every 30 seconds

    socket.on('pong', () => {
      console.log('🔌 Heartbeat received');
    });

    // Set up event listeners
    if (options.onPatientCreated) {
      socket.on('patient_created', options.onPatientCreated);
    }
    if (options.onPatientUpdated) {
      socket.on('patient_updated', options.onPatientUpdated);
    }
    if (options.onPatientDeleted) {
      socket.on('patient_deleted', options.onPatientDeleted);
    }
    if (options.onAppointmentCreated) {
      socket.on('appointment_created', options.onAppointmentCreated);
    }
    if (options.onAppointmentUpdated) {
      socket.on('appointment_updated', options.onAppointmentUpdated);
    }
    if (options.onAppointmentDeleted) {
      socket.on('appointment_deleted', options.onAppointmentDeleted);
    }
    if (options.onTreatmentRecordCreated) {
      socket.on('treatment_record_created', options.onTreatmentRecordCreated);
    }
    if (options.onTreatmentRecordUpdated) {
      socket.on('treatment_record_updated', options.onTreatmentRecordUpdated);
    }
    if (options.onTreatmentRecordDeleted) {
      socket.on('treatment_record_deleted', options.onTreatmentRecordDeleted);
    }
    if (options.onNotificationCreated) {
      socket.on('notification_created', options.onNotificationCreated);
    }
    if (options.onNotificationRead) {
      socket.on('notification_read', options.onNotificationRead);
    }
    if (options.onStaffCreated) {
      socket.on('staff_created', options.onStaffCreated);
    }
    if (options.onStaffUpdated) {
      socket.on('staff_updated', options.onStaffUpdated);
    }
    if (options.onStaffDeleted) {
      socket.on('staff_deleted', options.onStaffDeleted);
    }
    if (options.onDashboardStatsUpdated) {
      socket.on('dashboard_stats_updated', options.onDashboardStatsUpdated);
    }

    socketRef.current = socket;

    // Cleanup heartbeat on disconnect
    return () => {
      clearInterval(heartbeat);
    };
  }, [user?.id, options]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  const emit = useCallback((event: string, data: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  }, []);

  useEffect(() => {
    if (user?.id) {
      connect();
    }

    // Handle visibility changes (tab switching)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && socketRef.current && !socketRef.current.connected) {
        console.log('🔌 Tab became visible, reconnecting...');
        socketRef.current.connect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      disconnect();
    };
  }, [user?.id, connect, disconnect]);

  return {
    socket: socketRef.current,
    emit,
    connect,
    disconnect,
    isConnected: socketRef.current?.connected || false,
  };
} 