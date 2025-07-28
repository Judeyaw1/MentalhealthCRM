import {
  sqliteTable,
  text,
  integer,
  real,
  blob,
} from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Session storage table (required for Replit Auth)
export const sessions = sqliteTable("sessions", {
  sid: text("sid").primaryKey(),
  sess: blob("sess").notNull(),
  expire: integer("expire", { mode: "timestamp" }).notNull(),
});

// User storage table (required for Replit Auth)
export const users = sqliteTable("users", {
  id: text("id").primaryKey().notNull(),
  email: text("email").unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  profileImageUrl: text("profile_image_url"),
  role: text("role").notNull().default("staff"), // admin, supervisor, therapist, staff, frontdesk
  password: text("password"), // For password management
  forcePasswordChange: integer("force_password_change", {
    mode: "boolean",
  }).default(false), // Force password change on next login
  createdAt: integer("created_at", { mode: "timestamp" }).defaultNow(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).defaultNow(),
});

// Patients table
export const patients = sqliteTable("patients", {
  id: text("id").primaryKey().notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  dateOfBirth: integer("date_of_birth", { mode: "timestamp" }).notNull(),
  gender: text("gender"),
  email: text("email"),
  phone: text("phone"),
  emergencyContact: text("emergency_contact"),
  address: text("address"),
  insurance: text("insurance"),
  insuranceCardUrl: text("insurance_card_url"),
  photoUrl: text("photo_url"),
  reasonForVisit: text("reason_for_visit"),
  status: text("status").notNull().default("active"), // active, inactive, discharged
  hipaaConsent: integer("hipaa_consent", { mode: "boolean" })
    .notNull()
    .default(false),
  assignedTherapistId: text("assigned_therapist_id"),
  loc: text("loc"),
  createdAt: integer("created_at", { mode: "timestamp" }).defaultNow(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).defaultNow(),
});

// Appointments table
export const appointments = sqliteTable("appointments", {
  id: text("id").primaryKey().notNull(),
  patientId: text("patient_id").notNull(),
  therapistId: text("therapist_id").notNull(),
  appointmentDate: integer("appointment_date", { mode: "timestamp" }).notNull(),
  duration: integer("duration").notNull().default(60), // minutes
  type: text("type").notNull(), // therapy, consultation, group, intake
  status: text("status").notNull().default("scheduled"), // scheduled, completed, cancelled, no-show
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" }).defaultNow(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).defaultNow(),
});

// Treatment records table
export const treatmentRecords = sqliteTable("treatment_records", {
  id: text("id").primaryKey().notNull(),
  patientId: text("patient_id").notNull(),
  therapistId: text("therapist_id").notNull(),
  appointmentId: text("appointment_id"),
  sessionDate: integer("session_date", { mode: "timestamp" }).notNull(),
  sessionType: text("session_type").notNull(),
  notes: text("notes").notNull(),
  goals: text("goals"),
  interventions: text("interventions"),
  progress: text("progress"),
  planForNextSession: text("plan_for_next_session"),
  createdAt: integer("created_at", { mode: "timestamp" }).defaultNow(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).defaultNow(),
});

// Audit logs table for HIPAA compliance
export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey().notNull(),
  userId: text("user_id").notNull(),
  action: text("action").notNull(), // view, create, update, delete
  resourceType: text("resource_type").notNull(), // patient, appointment, record
  resourceId: text("resource_id").notNull(),
  details: text("details"), // JSON as text for SQLite
  timestamp: integer("timestamp", { mode: "timestamp" }).defaultNow(),
});

// Define relations
export const usersRelations = relations(users, ({ many }) => ({
  patientsAsTherapist: many(patients),
  appointments: many(appointments),
  treatmentRecords: many(treatmentRecords),
  auditLogs: many(auditLogs),
}));

export const patientsRelations = relations(patients, ({ one, many }) => ({
  assignedTherapist: one(users, {
    fields: [patients.assignedTherapistId],
    references: [users.id],
  }),
  appointments: many(appointments),
  treatmentRecords: many(treatmentRecords),
}));

export const appointmentsRelations = relations(
  appointments,
  ({ one, many }) => ({
    patient: one(patients, {
      fields: [appointments.patientId],
      references: [patients.id],
    }),
    therapist: one(users, {
      fields: [appointments.therapistId],
      references: [users.id],
    }),
    treatmentRecords: many(treatmentRecords),
  }),
);

export const treatmentRecordsRelations = relations(
  treatmentRecords,
  ({ one }) => ({
    patient: one(patients, {
      fields: [treatmentRecords.patientId],
      references: [patients.id],
    }),
    therapist: one(users, {
      fields: [treatmentRecords.therapistId],
      references: [users.id],
    }),
    appointment: one(appointments, {
      fields: [treatmentRecords.appointmentId],
      references: [appointments.id],
    }),
  }),
);

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPatientSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  dateOfBirth: z.union([z.date(), z.number(), z.string()]).transform((val) => {
    if (typeof val === "string") {
      return new Date(val);
    } else if (typeof val === "number") {
      return new Date(val);
    }
    return val;
  }),
  gender: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  emergencyContact: z.string().optional(),
  address: z.string().optional(),
  insurance: z.string().optional(),
  insuranceCardUrl: z.string().optional(),
  photoUrl: z.string().optional(),
  reasonForVisit: z.string().optional(),
  status: z.string().optional(),
  hipaaConsent: z.boolean().optional(),
  assignedTherapistId: z.string().optional(),
  loc: z.string().optional(),
  // New fields from Excel
  participants: z.string().optional(),
  location: z.string().optional(),
  intakeDate: z.union([z.date(), z.number(), z.string()]).optional().transform((val) => {
    if (val === undefined) return undefined;
    if (typeof val === "string") return new Date(val);
    if (typeof val === "number") return new Date(val);
    return val;
  }),
  maNumber: z.string().optional(),
  authNumber: z.string().optional(),
  dischargeDate: z.union([z.date(), z.number(), z.string()]).optional().transform((val) => {
    if (val === undefined) return undefined;
    if (typeof val === "string") return new Date(val);
    if (typeof val === "number") return new Date(val);
    return val;
  }),
  // New treatment completion fields (optional for backward compatibility)
  treatmentGoals: z.array(z.object({
    goal: z.string(),
    targetDate: z.date().optional(),
    status: z.enum(["pending", "in_progress", "achieved", "not_achieved"]).optional(),
    achievedDate: z.date().optional(),
    notes: z.string().optional()
  })).optional(),
  dischargeCriteria: z.object({
    targetSessions: z.number().optional(),
    targetDate: z.date().optional(),
    autoDischarge: z.boolean().optional(),
    dischargeReason: z.string().optional(),
    dischargeDate: z.date().optional()
  }).optional(),
});

export const insertAppointmentSchema = createInsertSchema(appointments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTreatmentRecordSchema = createInsertSchema(
  treatmentRecords,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  timestamp: true,
});

// Types
export type UpsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type Patient = typeof patients.$inferSelect;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type Appointment = typeof appointments.$inferSelect;
export type InsertTreatmentRecord = z.infer<typeof insertTreatmentRecordSchema>;
export type TreatmentRecord = typeof treatmentRecords.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

// Extended types with relations
export type PatientWithTherapist = Patient & {
  assignedTherapist?: User;
  createdBy?: User;
};

export type AppointmentWithDetails = Appointment & {
  patient: Patient;
  therapist: User;
};

export type TreatmentRecordWithDetails = TreatmentRecord & {
  patient: Patient;
  therapist: User;
  appointment?: Appointment;
};
