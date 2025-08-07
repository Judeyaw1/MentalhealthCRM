const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/mentalhealthtracker', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const { Notification } = require('../server/models/Notification.ts');

async function createTestDischargeNotification() {
  try {
    console.log('🔍 Creating test discharge request notification...');
    
    // Create a test discharge request notification
    const testNotification = new Notification({
      id: 'test-discharge-notification-' + Date.now(),
      userId: '6894db14db7d6f2a931d0191', // Current user ID
      type: 'discharge_request_created',
      title: 'New Discharge Request',
      message: 'Test User (staff) has requested discharge for Test Patient',
      data: {
        patientName: 'Test Patient',
        patientId: 'test-patient-id',
        requestedBy: {
          firstName: 'Test',
          lastName: 'User',
          role: 'staff'
        },
        reason: 'Test discharge request for debugging',
        requestId: 'test-request-id'
      },
      read: false, // Make it unread so it shows up
      createdAt: new Date()
    });
    
    await testNotification.save();
    console.log('✅ Test discharge request notification created successfully');
    console.log('Notification details:', {
      id: testNotification.id,
      type: testNotification.type,
      userId: testNotification.userId,
      read: testNotification.read
    });
    
  } catch (error) {
    console.error('❌ Error creating test discharge notification:', error);
  } finally {
    mongoose.connection.close();
  }
}

createTestDischargeNotification();
