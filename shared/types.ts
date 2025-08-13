// Simple TypeScript interfaces for the application
// These replace the SQLite schema that was removed

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'supervisor' | 'therapist' | 'staff' | 'frontdesk';
  password?: string;
  forcePasswordChange?: boolean;
  profileImageUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
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
  insurance?: string;
  ssn?: string;
  insuranceCardUrl?: string;
  photoUrl?: string;
  reasonForVisit?: string;
  status: 'active' | 'inactive' | 'discharged';
  hipaaConsent?: boolean;
  assignedTherapistId?: string;
  loc?: string;
  important?: boolean;
  dischargeCriteria?: {
    targetSessions?: number;
    targetDate?: Date;
    autoDischarge?: boolean;
    dischargeReason?: string;
    dischargeDate?: Date;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Appointment {
  id: string;
  patientId: string;
  therapistId: string;
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
  therapistId: string;
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

// Insert types for form submissions
export interface InsertUser {
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'supervisor' | 'therapist' | 'staff' | 'frontdesk';
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
  insurance?: string;
  ssn?: string;
  insuranceCardUrl?: string;
  photoUrl?: string;
  reasonForVisit?: string;
  status?: 'active' | 'inactive' | 'discharged';
  hipaaConsent?: boolean;
  assignedTherapistId?: string;
  loc?: string;
  important?: boolean;
  authNumber?: string;
}

export interface InsertAppointment {
  patientId: string;
  therapistId: string;
  appointmentDate: Date;
  duration?: number;
  type: string;
  status?: 'scheduled' | 'completed' | 'cancelled' | 'no-show';
  notes?: string;
}

export interface InsertTreatmentRecord {
  patientId: string;
  therapistId: string;
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
export interface PatientWithTherapist extends Patient {
  assignedTherapist?: User;
  createdBy?: User;
}

export interface AppointmentWithDetails extends Appointment {
  patient: Patient;
  therapist: User;
}

export interface TreatmentRecordWithDetails extends TreatmentRecord {
  patient: Patient;
  therapist: User;
  appointment?: Appointment;
} 