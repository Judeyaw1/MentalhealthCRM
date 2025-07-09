import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

// Connect to MongoDB using the same URI as the server
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mentalhealthtracker';

async function hashPasswords() {
  try {
    console.log('Connecting to MongoDB...');
    console.log('Using URI:', MONGODB_URI);
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

    // Find all users with plain text passwords (not starting with $2b$ which is bcrypt)
    const users = await User.find({
      password: { $exists: true, $ne: null, $ne: '' },
      $or: [
        { password: { $not: /^\$2b\$/ } },
        { password: { $not: /^\$2a\$/ } }
      ]
    });

    console.log(`Found ${users.length} users with plain text passwords`);

    if (users.length === 0) {
      console.log('No users with plain text passwords found. All passwords are already hashed.');
      return;
    }

    let updatedCount = 0;
    for (const user of users) {
      try {
        console.log(`\nProcessing user: ${user.email}`);
        console.log(`Current password: ${user.password}`);
        
        // Hash the plain text password
        const hashedPassword = await bcrypt.hash(user.password, 12);
        
        // Update the user with the hashed password
        await User.findByIdAndUpdate(user._id, {
          password: hashedPassword,
          updatedAt: new Date()
        });

        console.log(`✅ Updated password for user: ${user.email}`);
        updatedCount++;
      } catch (error) {
        console.error(`❌ Failed to hash password for user ${user.email}:`, error);
      }
    }

    console.log(`\n🎉 Successfully updated ${updatedCount} out of ${users.length} users`);

  } catch (error) {
    console.error('Error during password migration:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the migration
hashPasswords().then(() => {
  console.log('Password migration completed');
  process.exit(0);
}).catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
}); 