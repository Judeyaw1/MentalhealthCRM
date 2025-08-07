import mongoose from "mongoose";

// Inquiry schema for front desk tracking
const inquirySchema = new mongoose.Schema({
  inquiryType: {
    type: String,
    enum: ["new_patient", "follow_up", "referral", "general", "emergency"],
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "in_progress", "completed", "cancelled"],
    default: "pending",
  },
  priority: {
    type: String,
    enum: ["low", "medium", "high", "urgent"],
    default: "medium",
  },
  notes: {
    type: String,
    required: true,
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  resolvedAt: Date,
  contactMethod: {
    type: String,
    enum: ["phone", "email", "in_person", "referral"],
    required: true,
  },
  contactInfo: String,
  followUpDate: Date,
});

const patientSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
  },
  lastName: {
    type: String,
    required: true,
  },
  dateOfBirth: {
    type: Date,
    required: true,
  },
  gender: {
    type: String,
    enum: ["male", "female", "other"],
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
  },
  emergencyContact: {
    name: {
      type: String,
    },
    relationship: {
      type: String,
    },
    phone: {
      type: String,
    },
  },
  address: {
    type: String,
  },
  insurance: {
    type: String,
  },
  ssn: {
    type: String,
  },
  insuranceCardUrl: {
    type: String,
  },
  photoUrl: {
    type: String,
  },
  reasonForVisit: {
    type: String,
  },
  authNumber: {
    type: String,
  },
  loc: {
    type: String,
  },
  status: {
    type: String,
    enum: ["active", "inactive", "discharged"],
    default: "active",
  },
  hipaaConsent: {
    type: Boolean,
    default: false,
  },
  important: {
    type: Boolean,
    default: false,
  },
  assignedTherapistId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false,
  },
  // Treatment goals and completion tracking
  treatmentGoals: {
    type: [{
      goal: { type: String, required: true },
      targetDate: { type: Date },
      status: { 
        type: String, 
        enum: ["pending", "in_progress", "achieved", "not_achieved"],
        default: "pending"
      },
      achievedDate: { type: Date },
      notes: { type: String }
    }],
    default: []
  },
  dischargeCriteria: {
    type: {
      targetSessions: { type: Number, default: 12 },
      targetDate: { type: Date },
      autoDischarge: { type: Boolean, default: false },
      dischargeReason: { type: String },
      dischargeDate: { type: Date }
    },
    default: {
      targetSessions: 12,
      autoDischarge: false
    }
  },
  inquiries: [inquirySchema],
  // Discharge request tracking
  dischargeRequests: {
    type: [{
      requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      requestedAt: {
        type: Date,
        default: Date.now,
      },
      reason: {
        type: String,
        required: true,
      },
      status: {
        type: String,
        enum: ["pending", "approved", "denied"],
        default: "pending",
      },
      reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      reviewedAt: {
        type: Date,
      },
      reviewNotes: {
        type: String,
      },
    }],
    default: [],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

patientSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

export const Patient = mongoose.model("Patient", patientSchema);
