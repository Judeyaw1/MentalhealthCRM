import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';

export function setupSocketServer(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? process.env.CLIENT_URL || 'http://localhost:5173'
        : 'http://localhost:5173',
      methods: ['GET', 'POST']
    }
  });

  // Store connected users
  const connectedUsers = new Map<string, string>();

  io.on('connection', (socket) => {
    console.log(`🔌 User connected: ${socket.id}`);

    // Handle user authentication
    socket.on('authenticate', (userId: string) => {
      connectedUsers.set(socket.id, userId);
      socket.join(`user_${userId}`);
      console.log(`✅ User ${userId} authenticated on socket ${socket.id}`);
    });

    // Handle patient updates
    socket.on('patient_created', (data) => {
      console.log('📝 Patient created, broadcasting to all users');
      socket.broadcast.emit('patient_created', data);
    });

    socket.on('patient_updated', (data) => {
      console.log('📝 Patient updated, broadcasting to all users');
      socket.broadcast.emit('patient_updated', data);
    });

    socket.on('patient_deleted', (data) => {
      console.log('📝 Patient deleted, broadcasting to all users');
      socket.broadcast.emit('patient_deleted', data);
    });

    // Handle appointment updates
    socket.on('appointment_created', (data) => {
      console.log('📅 Appointment created, broadcasting to all users');
      socket.broadcast.emit('appointment_created', data);
    });

    socket.on('appointment_updated', (data) => {
      console.log('📅 Appointment updated, broadcasting to all users');
      socket.broadcast.emit('appointment_updated', data);
    });

    socket.on('appointment_deleted', (data) => {
      console.log('📅 Appointment deleted, broadcasting to all users');
      socket.broadcast.emit('appointment_deleted', data);
    });

    // Handle treatment record updates
    socket.on('treatment_record_created', (data) => {
      console.log('📋 Treatment record created, broadcasting to all users');
      socket.broadcast.emit('treatment_record_created', data);
    });

    socket.on('treatment_record_updated', (data) => {
      console.log('📋 Treatment record updated, broadcasting to all users');
      socket.broadcast.emit('treatment_record_updated', data);
    });

    socket.on('treatment_record_deleted', (data) => {
      console.log('📋 Treatment record deleted, broadcasting to all users');
      socket.broadcast.emit('treatment_record_deleted', data);
    });

    // Handle notification updates
    socket.on('notification_created', (data) => {
      console.log('🔔 Notification created, broadcasting to all users');
      socket.broadcast.emit('notification_created', data);
    });

    socket.on('notification_read', (data) => {
      console.log('🔔 Notification read, broadcasting to all users');
      socket.broadcast.emit('notification_read', data);
    });

    // Handle staff updates
    socket.on('staff_created', (data) => {
      console.log('👥 Staff created, broadcasting to all users');
      socket.broadcast.emit('staff_created', data);
    });

    socket.on('staff_updated', (data) => {
      console.log('👥 Staff updated, broadcasting to all users');
      socket.broadcast.emit('staff_updated', data);
    });

    socket.on('staff_deleted', (data) => {
      console.log('👥 Staff deleted, broadcasting to all users');
      socket.broadcast.emit('staff_deleted', data);
    });

    // Handle discharge request updates
    socket.on('discharge_request_created', (data) => {
      console.log('📋 Discharge request created, broadcasting to all users');
      socket.broadcast.emit('discharge_request_created', data);
    });

    socket.on('discharge_request_updated', (data) => {
      console.log('📋 Discharge request updated, broadcasting to all users');
      socket.broadcast.emit('discharge_request_updated', data);
    });

    // Handle dashboard stats updates
    socket.on('dashboard_stats_updated', (data) => {
      console.log('📊 Dashboard stats updated, broadcasting to all users');
      socket.broadcast.emit('dashboard_stats_updated', data);
    });

    // Handle inquiry updates
    socket.on('inquiry_created', (data) => {
      console.log('📝 Inquiry created, broadcasting to all users');
      socket.broadcast.emit('inquiry_created', data);
    });

    socket.on('inquiry_updated', (data) => {
      console.log('📝 Inquiry updated, broadcasting to all users');
      socket.broadcast.emit('inquiry_updated', data);
    });

    // Handle audit log updates
    socket.on('audit_log_created', (data) => {
      console.log('📋 Audit log created, broadcasting to all users');
      socket.broadcast.emit('audit_log_created', data);
    });

    // Handle patient note updates - scope to specific patient
    socket.on('note_created', (data) => {
      console.log('📝 Note created, broadcasting to patient room:', data.patientId);
      socket.broadcast.to(`patient_${data.patientId}`).emit('note_created', data);
    });

    socket.on('note_updated', (data) => {
      console.log('📝 Note updated, broadcasting to patient room:', data.patientId);
      socket.broadcast.to(`patient_${data.patientId}`).emit('note_updated', data);
    });

    socket.on('note_deleted', (data) => {
      console.log('📝 Note deleted, broadcasting to patient room:', data.patientId);
      socket.broadcast.to(`patient_${data.patientId}`).emit('note_deleted', data);
    });

    // Handle room joining for patient-specific events
    socket.on('join_patient_room', (data) => {
      console.log('🔌 User joining patient room:', data.patientId);
      socket.join(`patient_${data.patientId}`);
    });

    socket.on('leave_patient_room', (data) => {
      console.log('🔌 User leaving patient room:', data.patientId);
      socket.leave(`patient_${data.patientId}`);
    });

    // Handle typing indicators
    socket.on('typing_start', (data) => {
      console.log('⌨️ User started typing:', data);
      socket.broadcast.to(`patient_${data.patientId}`).emit('user_typing_start', data);
    });

    socket.on('typing_stop', (data) => {
      console.log('⌨️ User stopped typing:', data);
      socket.broadcast.to(`patient_${data.patientId}`).emit('user_typing_stop', data);
    });

    // Handle heartbeat
    socket.on('ping', () => {
      socket.emit('pong');
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      const userId = connectedUsers.get(socket.id);
      connectedUsers.delete(socket.id);
      console.log(`🔌 User disconnected: ${socket.id} (User: ${userId})`);
    });
  });

  return io;
}

// Helper function to emit events from routes
export function emitEvent(eventName: string, data: any) {
  // This will be used in routes to emit events
  // We'll need to access the io instance from the main server
  console.log(`📡 Emitting event: ${eventName}`, data);
} 