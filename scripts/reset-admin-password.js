import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';

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

    const emailToReset = process.argv[2];
    if (!emailToReset) {
      console.error("Please provide the user's email as an argument.\nUsage: node scripts/reset-admin-password.js user@example.com");
      process.exit(1);
    }

    // Find and update the user by email
    const user = await User.findOne({ email: emailToReset });
    if (!user) {
      console.error("No user found with that email.");
      process.exit(1);
    }

    user.password = hashedPassword;
    user.updatedAt = new Date();
    await user.save();
    console.log(`Password updated for user: ${user.email}`);

    // Send email notification
    if (user.email) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 465,
        secure: process.env.SMTP_SECURE === 'true' || true,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: user.email,
        subject: 'Your Password Has Been Reset',
        text: `Hello ${user.firstName || ''} ${user.lastName || ''},\n\nYour password has been reset by an administrator.\n\nEmail: ${user.email}\nNew Password: ${newPassword}\n\nPlease log in and change your password as soon as possible.`,
        html: `<p>Hello ${user.firstName || ''} ${user.lastName || ''},</p><p>Your password has been reset by an administrator.</p><p><b>Email:</b> ${user.email}<br/><b>New Password:</b> ${newPassword}</p><p>Please log in and change your password as soon as possible.</p>`,
      });
      console.log(`Password reset email sent to ${user.email}`);
    } else {
      console.log('User has no email address set. Cannot send notification.');
    }

    console.log('\n=== LOGIN CREDENTIALS ===');
    console.log(`Email: ${emailToReset}`);
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