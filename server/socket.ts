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

    // Handle dashboard stats updates
    socket.on('dashboard_stats_updated', (data) => {
      console.log('📊 Dashboard stats updated, broadcasting to all users');
      socket.broadcast.emit('dashboard_stats_updated', data);
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