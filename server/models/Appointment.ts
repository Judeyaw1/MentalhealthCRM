import mongoose from "mongoose";

const AppointmentSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Patient",
    required: true,
  },
  clinicalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  appointmentDate: { type: Date, required: true },
  duration: { type: Number, default: 60 },
  type: { type: String, required: true },
  status: { type: String, default: "scheduled" },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Update the updatedAt field on save
AppointmentSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

export const Appointment = mongoose.model("Appointment", AppointmentSchema);
