import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  integer,
  date,
  boolean,
  decimal,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").notNull().default("staff"), // admin, therapist, staff
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Patients table
export const patients = pgTable("patients", {
  id: serial("id").primaryKey(),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  dateOfBirth: date("date_of_birth").notNull(),
  gender: varchar("gender"),
  email: varchar("email"),
  phone: varchar("phone"),
  emergencyContact: varchar("emergency_contact"),
  address: text("address"),
  insurance: varchar("insurance"),
  reasonForVisit: text("reason_for_visit"),
  status: varchar("status").notNull().default("active"), // active, inactive, discharged
  hipaaConsent: boolean("hipaa_consent").notNull().default(false),
  assignedTherapistId: varchar("assigned_therapist_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Appointments table
export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull(),
  therapistId: varchar("therapist_id").notNull(),
  appointmentDate: timestamp("appointment_date").notNull(),
  duration: integer("duration").notNull().default(60), // minutes
  type: varchar("type").notNull(), // therapy, consultation, group, intake
  status: varchar("status").notNull().default("scheduled"), // scheduled, completed, cancelled, no-show
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Treatment records table
export const treatmentRecords = pgTable("treatment_records", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").notNull(),
  therapistId: varchar("therapist_id").notNull(),
  appointmentId: integer("appointment_id"),
  sessionDate: timestamp("session_date").notNull(),
  sessionType: varchar("session_type").notNull(),
  notes: text("notes").notNull(),
  goals: text("goals"),
  interventions: text("interventions"),
  progress: text("progress"),
  planForNextSession: text("plan_for_next_session"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Audit logs table for HIPAA compliance
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  action: varchar("action").notNull(), // view, create, update, delete
  resourceType: varchar("resource_type").notNull(), // patient, appointment, record
  resourceId: varchar("resource_id").notNull(),
  details: jsonb("details"),
  timestamp: timestamp("timestamp").defaultNow(),
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

export const appointmentsRelations = relations(appointments, ({ one, many }) => ({
  patient: one(patients, {
    fields: [appointments.patientId],
    references: [patients.id],
  }),
  therapist: one(users, {
    fields: [appointments.therapistId],
    references: [users.id],
  }),
  treatmentRecords: many(treatmentRecords),
}));

export const treatmentRecordsRelations = relations(treatmentRecords, ({ one }) => ({
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
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertPatientSchema = createInsertSchema(patients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAppointmentSchema = createInsertSchema(appointments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTreatmentRecordSchema = createInsertSchema(treatmentRecords).omit({
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
