import mongoose from "mongoose";

const TreatmentRecordSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },
    therapistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sessionDate: { type: Date, required: true },
    sessionType: { type: String, required: true },
    notes: { type: String },
    goals: { type: String },
    interventions: { type: String },
    progress: { type: String },
    planForNextSession: { type: String },
  },
  { timestamps: true },
);

export const TreatmentRecord = mongoose.model(
  "TreatmentRecord",
  TreatmentRecordSchema,
);
