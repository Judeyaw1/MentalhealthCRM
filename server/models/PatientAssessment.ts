import mongoose from "mongoose";

const patientAssessmentSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
  date: { type: Date, required: true, default: Date.now },
  presentingProblem: { type: String, required: true },
  medicalHistory: String,
  psychiatricHistory: String,
  familyHistory: String,
  socialHistory: String,
  mentalStatus: String,
  riskAssessment: String,
  diagnosis: String,
  impressions: { type: String, required: true },
  followUpDate: Date,
  followUpNotes: String,
  status: { type: String, enum: ["in_progress", "complete"], default: "in_progress" },
  createdBy: {
    id: { type: String },
    name: { type: String },
    role: { type: String }
  },
  updatedBy: {
    id: { type: String },
    name: { type: String },
    role: { type: String }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

patientAssessmentSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

export const PatientAssessment = mongoose.model("PatientAssessment", patientAssessmentSchema); 