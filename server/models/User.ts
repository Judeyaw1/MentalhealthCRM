import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  role: { type: String, required: true }, // e.g., 'staff', 'therapist', 'admin'
  password: { type: String },
  forcePasswordChange: { type: Boolean, default: false },
  settings: {
    notifications: {
      emailNotifications: { type: Boolean, default: true },
      appointmentReminders: { type: Boolean, default: true },
      patientUpdates: { type: Boolean, default: true },
      systemAlerts: { type: Boolean, default: true },
    },
    appearance: {
      theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
      compactMode: { type: Boolean, default: false },
      showAnimations: { type: Boolean, default: true },
    },
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export const User = mongoose.model("User", UserSchema);
