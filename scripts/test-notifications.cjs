const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/mentalhealthtracker', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const { Notification } = require('../server/models/Notification.ts');

async function testNotifications() {
  try {
    console.log('🔍 Testing notification system...');
    
    // Check if notifications exist
    const notifications = await Notification.find({}).limit(5);
    console.log(`📊 Found ${notifications.length} notifications in database`);
    
    if (notifications.length > 0) {
      console.log('📋 Recent notifications:');
      notifications.forEach((notification, index) => {
        console.log(`${index + 1}. ${notification.title} - ${notification.message} (${notification.type})`);
      });
    }
    
    // Check for discharge request notifications specifically
    const dischargeNotifications = await Notification.find({
      type: { $in: ['discharge_request_created', 'discharge_request_approved', 'discharge_request_denied'] }
    });
    
    console.log(`\n📋 Found ${dischargeNotifications.length} discharge request notifications:`);
    dischargeNotifications.forEach((notification, index) => {
      console.log(`${index + 1}. ${notification.title} - ${notification.message} (${notification.type})`);
      console.log(`   User: ${notification.userId}, Read: ${notification.read}, Created: ${notification.createdAt}`);
    });
    
  } catch (error) {
    console.error('❌ Error testing notifications:', error);
  } finally {
    mongoose.connection.close();
  }
}

testNotifications();
