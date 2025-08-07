const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/mentalhealthtracker', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const { Notification } = require('../server/models/Notification.ts');

async function testSimpleNotification() {
  try {
    console.log('🔍 Testing simple notification creation...');
    
    // Create a simple test notification
    const testNotification = new Notification({
      id: 'test-notification-' + Date.now(),
      userId: '6894db14db7d6f2a931d0191', // Admin user ID
      type: 'discharge_request_denied',
      title: 'Test Discharge Request Denied',
      message: 'This is a test notification for discharge request denied',
      data: {
        patientName: 'Test Patient',
        patientId: 'test-patient-id',
        requestedBy: {
          userId: 'test-user-id',
          firstName: 'Test',
          lastName: 'User'
        },
        reviewedBy: {
          firstName: 'Admin',
          lastName: 'User',
          role: 'admin'
        }
      },
      read: false,
      createdAt: new Date()
    });
    
    await testNotification.save();
    console.log('✅ Test notification created successfully');
    
    // Check if it was saved
    const savedNotification = await Notification.findOne({ id: testNotification.id });
    if (savedNotification) {
      console.log('✅ Test notification found in database');
      console.log('Notification details:', {
        title: savedNotification.title,
        message: savedNotification.message,
        type: savedNotification.type,
        userId: savedNotification.userId
      });
    } else {
      console.log('❌ Test notification not found in database');
    }
    
  } catch (error) {
    console.error('❌ Error testing simple notification:', error);
  } finally {
    mongoose.connection.close();
  }
}

testSimpleNotification();
