// Simple TypeScript interfaces for the application
// These replace the SQLite schema that was removed

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'supervisor' | 'clinical' | 'staff' | 'frontdesk';
  password?: string;
  forcePasswordChange?: boolean;
  profileImageUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Inquiry {
  id?: string;
  inquiryType: 'new_patient' | 'follow_up' | 'referral' | 'general' | 'emergency';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  notes: string;
  assignedTo?: string;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
  resolvedAt?: Date;
  contactMethod: 'phone' | 'email' | 'in_person' | 'referral';
  contactInfo?: string;
  followUpDate?: Date;
}

export interface Patient {
  id: string;
  _id?: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  gender?: string;
  email?: string;
  phone?: string;
  emergencyContact?: {
    name?: string;
    relationship?: string;
    phone?: string;
  };
  address?: string;
  insurance?: {
    provider?: string;
    policyNumber?: string;
    groupNumber?: string;
    coverageLimits?: string;
    notes?: string;
  };
  ssn?: string;
  insuranceCardUrl?: string;
  photoUrl?: string;
  reasonForVisit?: string;
  status: 'active' | 'inactive' | 'discharged';
  hipaaConsent?: boolean;
  assignedClinicalId?: string;
  loc?: string;
  important?: boolean;
  dischargeCriteria?: {
    targetSessions?: number;
    targetDate?: Date;
    autoDischarge?: boolean;
    dischargeReason?: string;
    dischargeDate?: Date;
  };
  inquiries?: Inquiry[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Appointment {
  id: string;
  patientId: string;
  clinicalId: string;
  appointmentDate: Date;
  duration: number;
  type: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no-show';
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TreatmentRecord {
  id: string;
  patientId: string;
  clinicalId: string;
  appointmentId?: string;
  sessionDate: Date;
  sessionType: string;
  notes?: string;
  goals?: string;
  interventions?: string;
  progress?: string;
  planForNextSession?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details?: string;
  timestamp?: Date;
}

// Patient Miscellaneous Data Types
export interface PatientMiscellaneous {
  id?: string;
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
    type: string;
    name: string;
    date: Date;
    fileId?: string;
    notes?: string;
  }>;
  
  referralInfo?: {
    referredBy: string;
    referralDate: Date;
    reason: string;
    source: string;
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
    communicationStyle: string;
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
    preferredTimeOfDay?: string;
    preferredDays?: string[];
    frequency?: string;
    notes?: string;
  };
  
  // External Resources
  communityResources?: Array<{
    name: string;
    type: string;
    contactInfo: string;
    description: string;
    notes?: string;
  }>;
  
  healthcareProviders?: Array<{
    name: string;
    specialty: string;
    contactInfo: string;
    relationship: string;
    notes?: string;
  }>;
  
  socialServices?: Array<{
    name: string;
    type: string;
    contactInfo: string;
    description: string;
    notes?: string;
  }>;
  
  educationalResources?: Array<{
    name: string;
    type: string;
    description: string;
    url?: string;
    notes?: string;
  }>;
  
  // File Management
  uploadedFiles?: Array<{
    fileId: string;
    originalName: string;
    fileName: string;
    category: string;
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
    category: string;
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
  
  createdAt?: Date;
  updatedAt?: Date;
}

// Insert types for form submissions
export interface InsertUser {
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'supervisor' | 'clinical' | 'staff' | 'frontdesk';
  password?: string;
  forcePasswordChange?: boolean;
}

export interface InsertPatient {
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  gender?: string;
  email?: string;
  phone?: string;
  emergencyContact?: {
    name?: string;
    relationship?: string;
    phone?: string;
  };
  address?: string;
  insurance?: {
    provider?: string;
    policyNumber?: string;
    groupNumber?: string;
    coverageLimits?: string;
    notes?: string;
  };
  ssn?: string;
  insuranceCardUrl?: string;
  photoUrl?: string;
  reasonForVisit?: string;
  status?: 'active' | 'inactive' | 'discharged';
  hipaaConsent?: boolean;
  assignedClinicalId?: string;
  loc?: string;
  important?: boolean;
  authNumber?: string;
}

export interface InsertAppointment {
  patientId: string;
  clinicalId: string;
  appointmentDate: Date;
  duration?: number;
  type: string;
  status?: 'scheduled' | 'completed' | 'cancelled' | 'no-show';
  notes?: string;
}

export interface InsertTreatmentRecord {
  patientId: string;
  clinicalId: string;
  appointmentId?: string;
  sessionDate: Date;
  sessionType: string;
  notes?: string;
  goals?: string;
  interventions?: string;
  progress?: string;
  planForNextSession?: string;
}

export interface InsertAuditLog {
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details?: string;
}

// Extended types with relationships
export interface PatientWithClinical extends Patient {
  assignedClinical?: User;
  createdBy?: User;
}

export interface AppointmentWithDetails extends Appointment {
  patient: Patient;
  clinical: User;
}

export interface TreatmentRecordWithDetails extends TreatmentRecord {
  patient: Patient;
  clinical: User;
  appointment?: Appointment;
} 