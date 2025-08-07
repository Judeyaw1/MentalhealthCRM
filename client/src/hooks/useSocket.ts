import { useEffect, useRef, useCallback, useMemo } from 'react';
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
  onNoteCreated?: (data: any) => void;
  onNoteUpdated?: (data: any) => void;
  onNoteDeleted?: (data: any) => void;
  onInquiryCreated?: (data: any) => void;
  onInquiryUpdated?: (data: any) => void;
  onAuditLogCreated?: (data: any) => void;
  onDischargeRequestCreated?: (data: any) => void;
  onDischargeRequestUpdated?: (data: any) => void;
}

export function useSocket(options: UseSocketOptions = {}) {
  const socketRef = useRef<Socket | null>(null);
  const { user } = useAuth();

  // Memoize options to prevent unnecessary re-renders
  const memoizedOptions = useMemo(() => options, [
    options.onPatientCreated,
    options.onPatientUpdated,
    options.onPatientDeleted,
    options.onAppointmentCreated,
    options.onAppointmentUpdated,
    options.onAppointmentDeleted,
    options.onTreatmentRecordCreated,
    options.onTreatmentRecordUpdated,
    options.onTreatmentRecordDeleted,
    options.onNotificationCreated,
    options.onNotificationRead,
    options.onStaffCreated,
    options.onStaffUpdated,
    options.onStaffDeleted,
    options.onDashboardStatsUpdated,
    options.onNoteCreated,
    options.onNoteUpdated,
    options.onNoteDeleted,
    options.onInquiryCreated,
    options.onInquiryUpdated,
    options.onAuditLogCreated,
    options.onDischargeRequestCreated,
    options.onDischargeRequestUpdated,
  ]);

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
    if (memoizedOptions.onPatientCreated) {
      socket.on('patient_created', memoizedOptions.onPatientCreated);
    }
    if (memoizedOptions.onPatientUpdated) {
      socket.on('patient_updated', memoizedOptions.onPatientUpdated);
    }
    if (memoizedOptions.onPatientDeleted) {
      socket.on('patient_deleted', memoizedOptions.onPatientDeleted);
    }
    if (memoizedOptions.onAppointmentCreated) {
      socket.on('appointment_created', memoizedOptions.onAppointmentCreated);
    }
    if (memoizedOptions.onAppointmentUpdated) {
      socket.on('appointment_updated', memoizedOptions.onAppointmentUpdated);
    }
    if (memoizedOptions.onAppointmentDeleted) {
      socket.on('appointment_deleted', memoizedOptions.onAppointmentDeleted);
    }
    if (memoizedOptions.onTreatmentRecordCreated) {
      socket.on('treatment_record_created', memoizedOptions.onTreatmentRecordCreated);
    }
    if (memoizedOptions.onTreatmentRecordUpdated) {
      socket.on('treatment_record_updated', memoizedOptions.onTreatmentRecordUpdated);
    }
    if (memoizedOptions.onTreatmentRecordDeleted) {
      socket.on('treatment_record_deleted', memoizedOptions.onTreatmentRecordDeleted);
    }
    if (memoizedOptions.onNotificationCreated) {
      socket.on('notification_created', memoizedOptions.onNotificationCreated);
    }
    if (memoizedOptions.onNotificationRead) {
      socket.on('notification_read', memoizedOptions.onNotificationRead);
    }
    if (memoizedOptions.onStaffCreated) {
      socket.on('staff_created', memoizedOptions.onStaffCreated);
    }
    if (memoizedOptions.onStaffUpdated) {
      socket.on('staff_updated', memoizedOptions.onStaffUpdated);
    }
    if (memoizedOptions.onStaffDeleted) {
      socket.on('staff_deleted', memoizedOptions.onStaffDeleted);
    }
    if (memoizedOptions.onDashboardStatsUpdated) {
      socket.on('dashboard_stats_updated', memoizedOptions.onDashboardStatsUpdated);
    }
    if (memoizedOptions.onNoteCreated) {
      socket.on('note_created', memoizedOptions.onNoteCreated);
    }
    if (memoizedOptions.onNoteUpdated) {
      socket.on('note_updated', memoizedOptions.onNoteUpdated);
    }
    if (memoizedOptions.onNoteDeleted) {
      socket.on('note_deleted', memoizedOptions.onNoteDeleted);
    }
    if (memoizedOptions.onInquiryCreated) {
      socket.on('inquiry_created', memoizedOptions.onInquiryCreated);
    }
    if (memoizedOptions.onInquiryUpdated) {
      socket.on('inquiry_updated', memoizedOptions.onInquiryUpdated);
    }
    if (memoizedOptions.onAuditLogCreated) {
      socket.on('audit_log_created', memoizedOptions.onAuditLogCreated);
    }
    if (memoizedOptions.onDischargeRequestCreated) {
      socket.on('discharge_request_created', memoizedOptions.onDischargeRequestCreated);
    }
    if (memoizedOptions.onDischargeRequestUpdated) {
      socket.on('discharge_request_updated', memoizedOptions.onDischargeRequestUpdated);
    }

    socketRef.current = socket;

    // Cleanup heartbeat on disconnect
    return () => {
      clearInterval(heartbeat);
    };
  }, [user?.id, memoizedOptions]);

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