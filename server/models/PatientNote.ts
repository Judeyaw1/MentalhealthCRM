import mongoose from "mongoose";

const patientNoteSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    authorName: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    directedTo: { // Added for directed notes
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // null means general note, user ID means directed to specific person
    },
    directedToName: { // Added for directed notes
      type: String,
      default: null, // Store the name for easier display
    },
    parentNoteId: { // Added for threading - links to parent note in same thread
      type: mongoose.Schema.Types.ObjectId,
      ref: "PatientNote",
      default: null, // null for top-level notes, ObjectId for threaded replies
    },
    isPrivate: {
      type: Boolean,
      default: false,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    archivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    archivedByName: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
patientNoteSchema.index({ patientId: 1, createdAt: -1 });
patientNoteSchema.index({ directedTo: 1 }); // Added for finding notes directed to specific users
patientNoteSchema.index({ parentNoteId: 1 }); // Added for finding threaded replies

export const PatientNote = mongoose.model("PatientNote", patientNoteSchema); 