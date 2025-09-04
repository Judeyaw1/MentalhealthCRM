import mongoose from "mongoose";

const TreatmentOutcomeSchema = new mongoose.Schema(
  {
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
    assessmentDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    
    // Symptom Assessment Scores
    depressionScore: {
      type: Number,
      min: 0,
      max: 27,
      required: false,
    },
    anxietyScore: {
      type: Number,
      min: 0,
      max: 21,
      required: false,
    },
    stressScore: {
      type: Number,
      min: 0,
      max: 40,
      required: false,
    },
    
    // Functional Assessment
    dailyFunctioning: {
      type: String,
      enum: ["excellent", "good", "fair", "poor", "severe"],
      required: false,
    },
    socialEngagement: {
      type: String,
      enum: ["very_active", "active", "moderate", "limited", "isolated"],
      required: false,
    },
    workPerformance: {
      type: String,
      enum: ["excellent", "good", "fair", "poor", "unable"],
      required: false,
    },
    
    // Treatment Goals
    primaryGoal: {
      type: String,
      required: false,
    },
    goalProgress: {
      type: String,
      enum: ["not_started", "beginning", "progressing", "achieved", "exceeded"],
      required: false,
    },
    goalNotes: {
      type: String,
      required: false,
    },
    
    // Clinical Observations
    moodState: {
      type: String,
      enum: ["elevated", "stable", "low", "depressed", "anxious", "mixed"],
      required: false,
    },
    riskFactors: {
      type: [String],
      required: false,
    },
    safetyPlan: {
      type: String,
      required: false,
    },
    
    // Treatment Response
    medicationEffectiveness: {
      type: String,
      enum: ["excellent", "good", "fair", "poor", "adverse"],
      required: false,
    },
    therapyEngagement: {
      type: String,
      enum: ["very_engaged", "engaged", "moderate", "resistant", "non_compliant"],
      required: false,
    },
    
    // Notes and Documentation
    clinicalNotes: {
      type: String,
      required: false,
    },
    nextSteps: {
      type: String,
      required: false,
    },
    
    // Metadata
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
TreatmentOutcomeSchema.index({ patientId: 1, assessmentDate: -1 });
TreatmentOutcomeSchema.index({ clinicalId: 1, assessmentDate: -1 });
TreatmentOutcomeSchema.index({ assessmentDate: -1 });

export const TreatmentOutcome = mongoose.model(
  "TreatmentOutcome",
  TreatmentOutcomeSchema
);
