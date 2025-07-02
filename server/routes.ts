import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import {
  insertPatientSchema,
  insertAppointmentSchema,
  insertTreatmentRecordSchema,
  insertAuditLogSchema,
} from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Helper function for audit logging
  const logActivity = async (
    userId: string,
    action: string,
    resourceType: string,
    resourceId: string,
    details?: any
  ) => {
    try {
      await storage.createAuditLog({
        userId,
        action,
        resourceType,
        resourceId,
        details,
      });
    } catch (error) {
      console.error("Failed to create audit log:", error);
    }
  };

  // Auth routes
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Dashboard routes
  app.get("/api/dashboard/stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const therapistId = user?.role === "therapist" ? userId : undefined;
      
      const stats = await storage.getDashboardStats(therapistId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  app.get("/api/dashboard/recent-patients", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const therapistId = user?.role === "therapist" ? userId : undefined;
      
      let patients;
      if (therapistId) {
        patients = await storage.getPatientsByTherapist(therapistId);
      } else {
        const result = await storage.getPatients(5, 0);
        patients = result.patients;
      }
      
      res.json(patients.slice(0, 5));
    } catch (error) {
      console.error("Error fetching recent patients:", error);
      res.status(500).json({ message: "Failed to fetch recent patients" });
    }
  });

  app.get("/api/dashboard/today-appointments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const therapistId = user?.role === "therapist" ? userId : undefined;
      
      const appointments = await storage.getTodayAppointments(therapistId);
      res.json(appointments);
    } catch (error) {
      console.error("Error fetching today's appointments:", error);
      res.status(500).json({ message: "Failed to fetch today's appointments" });
    }
  });

  // Patient routes
  app.get("/api/patients", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { limit = 50, offset = 0, search, status } = req.query;
      
      const result = await storage.getPatients(
        parseInt(limit as string),
        parseInt(offset as string),
        search as string,
        status as string
      );
      
      await logActivity(userId, "view", "patients", "list");
      res.json(result);
    } catch (error) {
      console.error("Error fetching patients:", error);
      res.status(500).json({ message: "Failed to fetch patients" });
    }
  });

  app.get("/api/patients/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const patientId = parseInt(req.params.id);
      
      const patient = await storage.getPatient(patientId);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }
      
      await logActivity(userId, "view", "patient", patientId.toString());
      res.json(patient);
    } catch (error) {
      console.error("Error fetching patient:", error);
      res.status(500).json({ message: "Failed to fetch patient" });
    }
  });

  app.post("/api/patients", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const patientData = insertPatientSchema.parse(req.body);
      
      const patient = await storage.createPatient(patientData);
      await logActivity(userId, "create", "patient", patient.id.toString(), patientData);
      
      res.status(201).json(patient);
    } catch (error) {
      console.error("Error creating patient:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid patient data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create patient" });
    }
  });

  app.patch("/api/patients/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const patientId = parseInt(req.params.id);
      const updates = insertPatientSchema.partial().parse(req.body);
      
      const patient = await storage.updatePatient(patientId, updates);
      await logActivity(userId, "update", "patient", patientId.toString(), updates);
      
      res.json(patient);
    } catch (error) {
      console.error("Error updating patient:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid patient data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update patient" });
    }
  });

  // Appointment routes
  app.get("/api/appointments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const { patientId, startDate, endDate } = req.query;
      
      const therapistId = user?.role === "therapist" ? userId : undefined;
      
      const appointments = await storage.getAppointments(
        therapistId,
        patientId ? parseInt(patientId as string) : undefined,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      
      await logActivity(userId, "view", "appointments", "list");
      res.json(appointments);
    } catch (error) {
      console.error("Error fetching appointments:", error);
      res.status(500).json({ message: "Failed to fetch appointments" });
    }
  });

  app.get("/api/appointments/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const appointmentId = parseInt(req.params.id);
      
      const appointment = await storage.getAppointment(appointmentId);
      if (!appointment) {
        return res.status(404).json({ message: "Appointment not found" });
      }
      
      await logActivity(userId, "view", "appointment", appointmentId.toString());
      res.json(appointment);
    } catch (error) {
      console.error("Error fetching appointment:", error);
      res.status(500).json({ message: "Failed to fetch appointment" });
    }
  });

  app.post("/api/appointments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const appointmentData = insertAppointmentSchema.parse(req.body);
      
      const appointment = await storage.createAppointment(appointmentData);
      await logActivity(userId, "create", "appointment", appointment.id.toString(), appointmentData);
      
      res.status(201).json(appointment);
    } catch (error) {
      console.error("Error creating appointment:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid appointment data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create appointment" });
    }
  });

  app.patch("/api/appointments/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const appointmentId = parseInt(req.params.id);
      const updates = insertAppointmentSchema.partial().parse(req.body);
      
      const appointment = await storage.updateAppointment(appointmentId, updates);
      await logActivity(userId, "update", "appointment", appointmentId.toString(), updates);
      
      res.json(appointment);
    } catch (error) {
      console.error("Error updating appointment:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid appointment data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update appointment" });
    }
  });

  // Treatment record routes
  app.get("/api/patients/:patientId/records", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const patientId = parseInt(req.params.patientId);
      
      const records = await storage.getTreatmentRecords(patientId);
      await logActivity(userId, "view", "treatment_records", patientId.toString());
      
      res.json(records);
    } catch (error) {
      console.error("Error fetching treatment records:", error);
      res.status(500).json({ message: "Failed to fetch treatment records" });
    }
  });

  app.get("/api/records/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const recordId = parseInt(req.params.id);
      
      const record = await storage.getTreatmentRecord(recordId);
      if (!record) {
        return res.status(404).json({ message: "Treatment record not found" });
      }
      
      await logActivity(userId, "view", "treatment_record", recordId.toString());
      res.json(record);
    } catch (error) {
      console.error("Error fetching treatment record:", error);
      res.status(500).json({ message: "Failed to fetch treatment record" });
    }
  });

  app.post("/api/records", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const recordData = insertTreatmentRecordSchema.parse(req.body);
      
      const record = await storage.createTreatmentRecord(recordData);
      await logActivity(userId, "create", "treatment_record", record.id.toString(), recordData);
      
      res.status(201).json(record);
    } catch (error) {
      console.error("Error creating treatment record:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid treatment record data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create treatment record" });
    }
  });

  app.patch("/api/records/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const recordId = parseInt(req.params.id);
      const updates = insertTreatmentRecordSchema.partial().parse(req.body);
      
      const record = await storage.updateTreatmentRecord(recordId, updates);
      await logActivity(userId, "update", "treatment_record", recordId.toString(), updates);
      
      res.json(record);
    } catch (error) {
      console.error("Error updating treatment record:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid treatment record data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update treatment record" });
    }
  });

  // Staff routes
  app.get("/api/staff", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      // Only admins can view all staff
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const staff = await storage.getStaff();
      await logActivity(userId, "view", "staff", "list");
      
      res.json(staff);
    } catch (error) {
      console.error("Error fetching staff:", error);
      res.status(500).json({ message: "Failed to fetch staff" });
    }
  });

  app.get("/api/therapists", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const therapists = await storage.getTherapists();
      await logActivity(userId, "view", "therapists", "list");
      
      res.json(therapists);
    } catch (error) {
      console.error("Error fetching therapists:", error);
      res.status(500).json({ message: "Failed to fetch therapists" });
    }
  });

  // Audit log routes
  app.get("/api/audit-logs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      // Only admins can view audit logs
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const { resourceId, auditUserId } = req.query;
      const logs = await storage.getAuditLogs(
        resourceId as string,
        auditUserId as string
      );
      
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
