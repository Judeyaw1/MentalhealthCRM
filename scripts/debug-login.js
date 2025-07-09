import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mentalhealthcrm';

async function debugLogin() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get the User model
    const User = mongoose.model('User', new mongoose.Schema({
      email: String,
      firstName: String,
      lastName: String,
      role: String,
      password: String,
      forcePasswordChange: Boolean,
      createdAt: Date,
      updatedAt: Date,
    }));

    // Test credentials
    const testEmail = 'admin@newlife.com';
    const testPassword = 'Admin123!@#';

    console.log(`\n=== DEBUGGING LOGIN PROCESS ===`);
    console.log(`Email: ${testEmail}`);
    console.log(`Password: ${testPassword}`);

    // Step 1: Check if user exists
    console.log('\n1. Checking if user exists...');
    const user = await User.findOne({ email: testEmail });
    
    if (!user) {
      console.log('❌ User not found!');
      console.log('Available users:');
      const allUsers = await User.find({});
      allUsers.forEach(u => console.log(`- ${u.email} (${u.role})`));
      return;
    }

    console.log('✅ User found');
    console.log(`User ID: ${user._id}`);
    console.log(`User email: ${user.email}`);
    console.log(`User role: ${user.role}`);

    // Step 2: Check password
    console.log('\n2. Checking password...');
    console.log(`Stored password hash: ${user.password.substring(0, 30)}...`);
    console.log(`Password is hashed: ${user.password.startsWith('$2b$')}`);

    // Step 3: Compare password
    console.log('\n3. Comparing password...');
    const isPasswordValid = await bcrypt.compare(testPassword, user.password);
    console.log(`Password comparison result: ${isPasswordValid ? '✅ VALID' : '❌ INVALID'}`);

    if (isPasswordValid) {
      console.log('\n🎉 LOGIN SHOULD WORK!');
      console.log('\nPossible issues:');
      console.log('1. Server not running');
      console.log('2. Database connection issue in server');
      console.log('3. Frontend/backend mismatch');
      console.log('4. Session configuration issue');
      
      console.log('\nTry these steps:');
      console.log('1. Make sure your server is running (npm start)');
      console.log('2. Check browser console for errors');
      console.log('3. Check server logs for errors');
      console.log('4. Try accessing http://localhost:3000/api/login directly');
    } else {
      console.log('\n❌ PASSWORD COMPARISON FAILED');
      console.log('This is the root cause of the login issue.');
    }

  } catch (error) {
    console.error('Error during debug:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the script
debugLogin().then(() => {
  console.log('\nDebug completed');
  process.exit(0);
}).catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
}); 