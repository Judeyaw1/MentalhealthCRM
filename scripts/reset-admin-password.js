import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mentalhealthcrm';

async function resetAdminPassword() {
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

    // Generate a secure admin password
    const newPassword = 'Admin123!@#';
    console.log(`Generated new admin password: ${newPassword}`);

    // Hash the password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    console.log('Password hashed successfully');

    // Find and update the admin user
    const result = await User.updateOne(
      { role: 'admin' },
      { 
        password: hashedPassword,
        updatedAt: new Date()
      }
    );

    if (result.matchedCount === 0) {
      console.log('No admin user found. Creating a new admin user...');
      
      // Create a new admin user
      const newAdmin = new User({
        email: 'admin@newlife.com',
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        password: hashedPassword,
        forcePasswordChange: false,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await newAdmin.save();
      console.log('New admin user created successfully');
      console.log(`Email: admin@newlife.com`);
    } else {
      console.log('Admin user password updated successfully');
    }

    console.log('\n=== LOGIN CREDENTIALS ===');
    console.log(`Email: admin@newlife.com`);
    console.log(`Password: ${newPassword}`);
    console.log('========================\n');

    console.log('You can now log in with these credentials!');

  } catch (error) {
    console.error('Error during admin password reset:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
resetAdminPassword().then(() => {
  console.log('Admin password reset completed');
  process.exit(0);
}).catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
}); 