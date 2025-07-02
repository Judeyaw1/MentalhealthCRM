import {
  users,
  patients,
  appointments,
  treatmentRecords,
  auditLogs,
  type User,
  type UpsertUser,
  type Patient,
  type InsertPatient,
  type PatientWithTherapist,
  type Appointment,
  type InsertAppointment,
  type AppointmentWithDetails,
  type TreatmentRecord,
  type InsertTreatmentRecord,
  type TreatmentRecordWithDetails,
  type AuditLog,
  type InsertAuditLog,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, like, and, gte, lte, count, sql } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Patient operations
  getPatients(
    limit?: number,
    offset?: number,
    search?: string,
    status?: string
  ): Promise<{ patients: PatientWithTherapist[]; total: number }>;
  getPatient(id: number): Promise<PatientWithTherapist | undefined>;
  createPatient(patient: InsertPatient): Promise<Patient>;
  updatePatient(id: number, patient: Partial<InsertPatient>): Promise<Patient>;
  getPatientsByTherapist(therapistId: string): Promise<PatientWithTherapist[]>;

  // Appointment operations
  getAppointments(
    therapistId?: string,
    patientId?: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<AppointmentWithDetails[]>;
  getAppointment(id: number): Promise<AppointmentWithDetails | undefined>;
  createAppointment(appointment: InsertAppointment): Promise<Appointment>;
  updateAppointment(id: number, appointment: Partial<InsertAppointment>): Promise<Appointment>;
  getTodayAppointments(therapistId?: string): Promise<AppointmentWithDetails[]>;

  // Treatment record operations
  getTreatmentRecords(patientId: number): Promise<TreatmentRecordWithDetails[]>;
  getTreatmentRecord(id: number): Promise<TreatmentRecordWithDetails | undefined>;
  createTreatmentRecord(record: InsertTreatmentRecord): Promise<TreatmentRecord>;
  updateTreatmentRecord(id: number, record: Partial<InsertTreatmentRecord>): Promise<TreatmentRecord>;

  // Dashboard statistics
  getDashboardStats(therapistId?: string): Promise<{
    totalPatients: number;
    todayAppointments: number;
    activeTreatments: number;
    monthlyRevenue: number;
  }>;

  // Audit logging
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(resourceId?: string, userId?: string): Promise<AuditLog[]>;

  // Staff operations
  getStaff(): Promise<User[]>;
  getTherapists(): Promise<User[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations (required for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Patient operations
  async getPatients(
    limit = 50,
    offset = 0,
    search?: string,
    status?: string
  ): Promise<{ patients: PatientWithTherapist[]; total: number }> {
    let whereConditions = [];
    
    if (search) {
      whereConditions.push(
        sql`(${patients.firstName} ILIKE ${`%${search}%`} OR ${patients.lastName} ILIKE ${`%${search}%`} OR ${patients.email} ILIKE ${`%${search}%`})`
      );
    }
    
    if (status) {
      whereConditions.push(eq(patients.status, status));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const [patientsResult, totalResult] = await Promise.all([
      db
        .select({
          patient: patients,
          therapist: users,
        })
        .from(patients)
        .leftJoin(users, eq(patients.assignedTherapistId, users.id))
        .where(whereClause)
        .orderBy(desc(patients.createdAt))
        .limit(limit)
        .offset(offset),
      
      db
        .select({ count: count() })
        .from(patients)
        .where(whereClause)
    ]);

    const patientsWithTherapist = patientsResult.map(row => ({
      ...row.patient,
      assignedTherapist: row.therapist || undefined,
    }));

    return {
      patients: patientsWithTherapist,
      total: totalResult[0].count,
    };
  }

  async getPatient(id: number): Promise<PatientWithTherapist | undefined> {
    const [result] = await db
      .select({
        patient: patients,
        therapist: users,
      })
      .from(patients)
      .leftJoin(users, eq(patients.assignedTherapistId, users.id))
      .where(eq(patients.id, id));

    if (!result) return undefined;

    return {
      ...result.patient,
      assignedTherapist: result.therapist || undefined,
    };
  }

  async createPatient(patient: InsertPatient): Promise<Patient> {
    const [newPatient] = await db
      .insert(patients)
      .values(patient)
      .returning();
    return newPatient;
  }

  async updatePatient(id: number, patient: Partial<InsertPatient>): Promise<Patient> {
    const [updatedPatient] = await db
      .update(patients)
      .set({ ...patient, updatedAt: new Date() })
      .where(eq(patients.id, id))
      .returning();
    return updatedPatient;
  }

  async getPatientsByTherapist(therapistId: string): Promise<PatientWithTherapist[]> {
    const result = await db
      .select({
        patient: patients,
        therapist: users,
      })
      .from(patients)
      .leftJoin(users, eq(patients.assignedTherapistId, users.id))
      .where(eq(patients.assignedTherapistId, therapistId));

    return result.map(row => ({
      ...row.patient,
      assignedTherapist: row.therapist || undefined,
    }));
  }

  // Appointment operations
  async getAppointments(
    therapistId?: string,
    patientId?: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<AppointmentWithDetails[]> {
    let whereConditions = [];
    
    if (therapistId) {
      whereConditions.push(eq(appointments.therapistId, therapistId));
    }
    
    if (patientId) {
      whereConditions.push(eq(appointments.patientId, patientId));
    }
    
    if (startDate) {
      whereConditions.push(gte(appointments.appointmentDate, startDate));
    }
    
    if (endDate) {
      whereConditions.push(lte(appointments.appointmentDate, endDate));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const result = await db
      .select({
        appointment: appointments,
        patient: patients,
        therapist: users,
      })
      .from(appointments)
      .innerJoin(patients, eq(appointments.patientId, patients.id))
      .innerJoin(users, eq(appointments.therapistId, users.id))
      .where(whereClause)
      .orderBy(asc(appointments.appointmentDate));

    return result.map(row => ({
      ...row.appointment,
      patient: row.patient,
      therapist: row.therapist,
    }));
  }

  async getAppointment(id: number): Promise<AppointmentWithDetails | undefined> {
    const [result] = await db
      .select({
        appointment: appointments,
        patient: patients,
        therapist: users,
      })
      .from(appointments)
      .innerJoin(patients, eq(appointments.patientId, patients.id))
      .innerJoin(users, eq(appointments.therapistId, users.id))
      .where(eq(appointments.id, id));

    if (!result) return undefined;

    return {
      ...result.appointment,
      patient: result.patient,
      therapist: result.therapist,
    };
  }

  async createAppointment(appointment: InsertAppointment): Promise<Appointment> {
    const [newAppointment] = await db
      .insert(appointments)
      .values(appointment)
      .returning();
    return newAppointment;
  }

  async updateAppointment(id: number, appointment: Partial<InsertAppointment>): Promise<Appointment> {
    const [updatedAppointment] = await db
      .update(appointments)
      .set({ ...appointment, updatedAt: new Date() })
      .where(eq(appointments.id, id))
      .returning();
    return updatedAppointment;
  }

  async getTodayAppointments(therapistId?: string): Promise<AppointmentWithDetails[]> {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    return this.getAppointments(therapistId, undefined, startOfDay, endOfDay);
  }

  // Treatment record operations
  async getTreatmentRecords(patientId: number): Promise<TreatmentRecordWithDetails[]> {
    const result = await db
      .select({
        record: treatmentRecords,
        patient: patients,
        therapist: users,
        appointment: appointments,
      })
      .from(treatmentRecords)
      .innerJoin(patients, eq(treatmentRecords.patientId, patients.id))
      .innerJoin(users, eq(treatmentRecords.therapistId, users.id))
      .leftJoin(appointments, eq(treatmentRecords.appointmentId, appointments.id))
      .where(eq(treatmentRecords.patientId, patientId))
      .orderBy(desc(treatmentRecords.sessionDate));

    return result.map(row => ({
      ...row.record,
      patient: row.patient,
      therapist: row.therapist,
      appointment: row.appointment || undefined,
    }));
  }

  async getTreatmentRecord(id: number): Promise<TreatmentRecordWithDetails | undefined> {
    const [result] = await db
      .select({
        record: treatmentRecords,
        patient: patients,
        therapist: users,
        appointment: appointments,
      })
      .from(treatmentRecords)
      .innerJoin(patients, eq(treatmentRecords.patientId, patients.id))
      .innerJoin(users, eq(treatmentRecords.therapistId, users.id))
      .leftJoin(appointments, eq(treatmentRecords.appointmentId, appointments.id))
      .where(eq(treatmentRecords.id, id));

    if (!result) return undefined;

    return {
      ...result.record,
      patient: result.patient,
      therapist: result.therapist,
      appointment: result.appointment || undefined,
    };
  }

  async createTreatmentRecord(record: InsertTreatmentRecord): Promise<TreatmentRecord> {
    const [newRecord] = await db
      .insert(treatmentRecords)
      .values(record)
      .returning();
    return newRecord;
  }

  async updateTreatmentRecord(id: number, record: Partial<InsertTreatmentRecord>): Promise<TreatmentRecord> {
    const [updatedRecord] = await db
      .update(treatmentRecords)
      .set({ ...record, updatedAt: new Date() })
      .where(eq(treatmentRecords.id, id))
      .returning();
    return updatedRecord;
  }

  // Dashboard statistics
  async getDashboardStats(therapistId?: string): Promise<{
    totalPatients: number;
    todayAppointments: number;
    activeTreatments: number;
    monthlyRevenue: number;
  }> {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    let patientWhere = therapistId ? eq(patients.assignedTherapistId, therapistId) : undefined;
    let appointmentWhere = [
      gte(appointments.appointmentDate, startOfDay),
      lte(appointments.appointmentDate, endOfDay),
    ];
    if (therapistId) {
      appointmentWhere.push(eq(appointments.therapistId, therapistId));
    }

    let treatmentWhere = therapistId ? eq(treatmentRecords.therapistId, therapistId) : undefined;

    const [totalPatientsResult, todayAppointmentsResult, activeTreatmentsResult] = await Promise.all([
      db
        .select({ count: count() })
        .from(patients)
        .where(patientWhere),
      
      db
        .select({ count: count() })
        .from(appointments)
        .where(and(...appointmentWhere)),
      
      db
        .select({ count: count() })
        .from(treatmentRecords)
        .where(treatmentWhere),
    ]);

    // Mock monthly revenue calculation (would need billing data in real system)
    const monthlyRevenue = 18750; // This should be calculated from actual billing data

    return {
      totalPatients: totalPatientsResult[0].count,
      todayAppointments: todayAppointmentsResult[0].count,
      activeTreatments: activeTreatmentsResult[0].count,
      monthlyRevenue,
    };
  }

  // Audit logging
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [newLog] = await db
      .insert(auditLogs)
      .values(log)
      .returning();
    return newLog;
  }

  async getAuditLogs(resourceId?: string, userId?: string): Promise<AuditLog[]> {
    let whereConditions = [];
    
    if (resourceId) {
      whereConditions.push(eq(auditLogs.resourceId, resourceId));
    }
    
    if (userId) {
      whereConditions.push(eq(auditLogs.userId, userId));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    return await db
      .select()
      .from(auditLogs)
      .where(whereClause)
      .orderBy(desc(auditLogs.timestamp));
  }

  // Staff operations
  async getStaff(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .orderBy(asc(users.firstName));
  }

  async getTherapists(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(eq(users.role, "therapist"))
      .orderBy(asc(users.firstName));
  }
}

export const storage = new DatabaseStorage();
