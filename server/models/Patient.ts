import mongoose from 'mongoose';

const PatientSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  dateOfBirth: { type: Date, required: true },
  gender: { type: String, enum: ['male', 'female', 'other'], required: true },
  email: { type: String, required: true },
  phone: { type: String },
  emergencyContact: { type: String },
  address: { type: String },
  insurance: { type: String },
  reasonForVisit: { type: String },
  status: { type: String, default: 'active' },
  hipaaConsent: { type: Boolean, default: false },
  assignedTherapistId: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export const Patient = mongoose.model('Patient', PatientSchema); 