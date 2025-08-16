import mongoose, { Schema, Document } from 'mongoose';

export interface IPatientMiscellaneous extends Document {
  patientId: string;
  
  // Administrative Information
  insurance?: {
    provider: string;
    policyNumber: string;
    groupNumber?: string;
    coverageLimits?: string;
    notes?: string;
  };
  
  emergencyContacts?: Array<{
    name: string;
    relationship: string;
    phone: string;
    email?: string;
    isPrimary: boolean;
  }>;
  
  legalDocuments?: Array<{
    type: string; // consent, advance_directive, power_of_attorney, etc.
    name: string;
    date: Date;
    fileId?: string; // Reference to uploaded file
    notes?: string;
  }>;
  
  referralInfo?: {
    referredBy: string;
    referralDate: Date;
    reason: string;
    source: string; // internal, external, self_referral
    notes?: string;
  };
  
  billingNotes?: {
    paymentPlan?: string;
    outstandingBalance?: number;
    specialArrangements?: string;
    notes?: string;
  };
  
  // Personal Preferences & Accommodations
  communicationPreferences?: {
    preferredLanguage: string;
    interpreterNeeded: boolean;
    communicationStyle: string; // direct, gentle, visual, etc.
    notes?: string;
  };
  
  culturalConsiderations?: {
    culturalBackground?: string;
    religiousPractices?: string;
    dietaryRestrictions?: string;
    notes?: string;
  };
  
  accessibilityNeeds?: {
    mobility?: string;
    hearing?: string;
    vision?: string;
    cognitive?: string;
    notes?: string;
  };
  
  schedulingPreferences?: {
    preferredTimeOfDay?: string; // morning, afternoon, evening
    preferredDays?: string[]; // monday, tuesday, etc.
    frequency?: string; // weekly, biweekly, monthly
    notes?: string;
  };
  
  // External Resources
  communityResources?: Array<{
    name: string;
    type: string; // support_group, crisis_hotline, housing, etc.
    contactInfo: string;
    description: string;
    notes?: string;
  }>;
  
  healthcareProviders?: Array<{
    name: string;
    specialty: string;
    contactInfo: string;
    relationship: string; // pcp, specialist, therapist, etc.
    notes?: string;
  }>;
  
  socialServices?: Array<{
    name: string;
    type: string; // case_worker, benefits, transportation, etc.
    contactInfo: string;
    description: string;
    notes?: string;
  }>;
  
  educationalResources?: Array<{
    name: string;
    type: string; // book, website, app, video, etc.
    description: string;
    url?: string;
    notes?: string;
  }>;
  
  // File Management
  uploadedFiles?: Array<{
    fileId: string;
    originalName: string;
    fileName: string; // Stored filename
    category: string; // insurance, legal, medical, personal, etc.
    description?: string;
    uploadedBy: string;
    uploadedAt: Date;
    fileSize: number;
    mimeType: string;
    notes?: string;
  }>;
  
  // General Notes & Observations
  generalNotes?: Array<{
    title: string;
    content: string;
    category: string; // staff_observation, family_feedback, progress_note, etc.
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    isPrivate: boolean;
  }>;
  
  // Follow-up & Reminders
  followUpReminders?: Array<{
    title: string;
    description: string;
    dueDate: Date;
    priority: 'low' | 'medium' | 'high';
    status: 'pending' | 'completed' | 'overdue';
    assignedTo?: string;
    notes?: string;
  }>;
  
  createdAt: Date;
  updatedAt: Date;
}

const PatientMiscellaneousSchema = new Schema<IPatientMiscellaneous>({
  patientId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  insurance: {
    provider: String,
    policyNumber: String,
    groupNumber: String,
    coverageLimits: String,
    notes: String
  },
  
  emergencyContacts: [{
    name: { type: String, required: true },
    relationship: { type: String, required: true },
    phone: { type: String, required: true },
    email: String,
    isPrimary: { type: Boolean, default: false }
  }],
  
  legalDocuments: [{
    type: { type: String, required: true },
    name: { type: String, required: true },
    date: { type: Date, required: true },
    fileId: String,
    notes: String
  }],
  
  referralInfo: {
    referredBy: String,
    referralDate: Date,
    reason: String,
    source: String,
    notes: String
  },
  
  billingNotes: {
    paymentPlan: String,
    outstandingBalance: Number,
    specialArrangements: String,
    notes: String
  },
  
  communicationPreferences: {
    preferredLanguage: String,
    interpreterNeeded: { type: Boolean, default: false },
    communicationStyle: String,
    notes: String
  },
  
  culturalConsiderations: {
    culturalBackground: String,
    religiousPractices: String,
    dietaryRestrictions: String,
    notes: String
  },
  
  accessibilityNeeds: {
    mobility: String,
    hearing: String,
    vision: String,
    cognitive: String,
    notes: String
  },
  
  schedulingPreferences: {
    preferredTimeOfDay: String,
    preferredDays: [String],
    frequency: String,
    notes: String
  },
  
  communityResources: [{
    name: { type: String, required: true },
    type: { type: String, required: true },
    contactInfo: { type: String, required: true },
    description: { type: String, required: true },
    notes: String
  }],
  
  healthcareProviders: [{
    name: { type: String, required: true },
    specialty: { type: String, required: true },
    contactInfo: { type: String, required: true },
    relationship: { type: String, required: true },
    notes: String
  }],
  
  socialServices: [{
    name: { type: String, required: true },
    type: { type: String, required: true },
    contactInfo: { type: String, required: true },
    description: { type: String, required: true },
    notes: String
  }],
  
  educationalResources: [{
    name: { type: String, required: true },
    type: { type: String, required: true },
    description: { type: String, required: true },
    url: String,
    notes: String
  }],
  
  uploadedFiles: [{
    fileId: { type: String, required: true },
    originalName: { type: String, required: true },
    fileName: { type: String, required: true },
    category: { type: String, required: true },
    description: String,
    uploadedBy: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
    fileSize: { type: Number, required: true },
    mimeType: { type: String, required: true },
    notes: String
  }],
  
  generalNotes: [{
    title: { type: String, required: true },
    content: { type: String, required: true },
    category: { type: String, required: true },
    createdBy: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    isPrivate: { type: Boolean, default: false }
  }],
  
  followUpReminders: [{
    title: { type: String, required: true },
    description: { type: String, required: true },
    dueDate: { type: Date, required: true },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    status: { type: String, enum: ['pending', 'completed', 'overdue'], default: 'pending' },
    assignedTo: String,
    notes: String
  }]
}, {
  timestamps: true
});

// Index for efficient queries
PatientMiscellaneousSchema.index({ patientId: 1 });
PatientMiscellaneousSchema.index({ 'uploadedFiles.fileId': 1 });
PatientMiscellaneousSchema.index({ 'followUpReminders.dueDate': 1 });
PatientMiscellaneousSchema.index({ 'followUpReminders.status': 1 });

export const PatientMiscellaneous = mongoose.model<IPatientMiscellaneous>('PatientMiscellaneous', PatientMiscellaneousSchema);
