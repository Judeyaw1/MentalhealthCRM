import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  type: { 
    type: String, 
    required: true,
    enum: [
      'appointment_reminder',
      'patient_update',
      'system_alert',
      'treatment_completion',
      'discharge_reminder',
      'inquiry_received',
      'staff_invitation',
      'password_reset',
      'directed_note',
      'general',
      'assessment_followup',
      'patient_assigned',
      'discharge_request_created',
      'discharge_request_approved',
      'discharge_request_denied'
    ]
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date },
});

// Index for efficient queries
NotificationSchema.index({ userId: 1, read: 1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ expiresAt: 1 });

export const Notification = mongoose.model("Notification", NotificationSchema); 