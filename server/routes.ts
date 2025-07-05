import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { emailService } from "./emailService";
import {
  insertPatientSchema,
  insertAuditLogSchema,
} from "@shared/schema";
import { z } from "zod";

// Custom schema for MongoDB treatment records
const insertTreatmentRecordSchema = z.object({
  patientId: z.string().min(1, "Patient ID is required"),
  therapistId: z.string().min(1, "Therapist ID is required"),
  sessionDate: z.union([z.date(), z.string()]).transform((val) => 
    typeof val === 'string' ? new Date(val) : val
  ),
  sessionType: z.string().min(1, "Session type is required"),
  notes: z.string().optional(),
  goals: z.string().optional(),
  interventions: z.string().optional(),
  progress: z.string().optional(),
  planForNextSession: z.string().optional(),
});

// Custom schema for MongoDB appointments
const insertAppointmentSchema = z.object({
  patientId: z.string().min(1, "Patient ID is required"),
  therapistId: z.string().min(1, "Therapist ID is required"),
  appointmentDate: z.union([z.date(), z.string()]).transform((val) => 
    typeof val === 'string' ? new Date(val) : val
  ),
  duration: z.number().default(60),
  type: z.string().min(1, "Appointment type is required"),
  status: z.string().default("scheduled"),
  notes: z.string().optional(),
});

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
      const auditLogData: any = {
        userId,
        action,
        resourceType,
        resourceId,
      };
      
      if (details) {
        auditLogData.details = JSON.stringify(details);
      }
      
      await storage.createAuditLog(auditLogData);
    } catch (error) {
      console.error("Failed to create audit log:", error);
    }
  };

  // Auth routes
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
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
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      const therapistId = user?.role === "therapist" ? userId : undefined;
      
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  app.get("/api/dashboard/recent-patients", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      const therapistId = user?.role === "therapist" ? userId : undefined;
      
      let patients;
      if (therapistId) {
        patients = await storage.getPatientsByTherapist(therapistId);
      } else {
        const result = await storage.getPatients(5, 0);
        patients = result.patients;
      }
      
      console.log('Recent patients response:', patients.map(p => ({ id: p.id, type: typeof p.id, fullPatient: p })));
      res.json(patients.slice(0, 5));
    } catch (error) {
      console.error("Error fetching recent patients:", error);
      res.status(500).json({ message: "Failed to fetch recent patients" });
    }
  });

  app.get("/api/dashboard/today-appointments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      const therapistId = user?.role === "therapist" ? userId : undefined;
      
      const appointments = await storage.getTodayAppointments();
      res.json(appointments);
    } catch (error) {
      console.error("Error fetching today's appointments:", error);
      res.status(500).json({ message: "Failed to fetch today's appointments" });
    }
  });

  // Patient routes
  app.get("/api/patients", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
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
      const userId = req.user.id;
      const patientId = req.params.id;
      
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
      const userId = req.user.id;
      console.log('Creating patient with data:', JSON.stringify(req.body, null, 2));
      
      const patientData = insertPatientSchema.parse(req.body);
      console.log('Parsed patient data:', JSON.stringify(patientData, null, 2));
      
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
      const userId = req.user.id;
      const patientId = req.params.id;
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

  app.delete("/api/patients/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const patientId = req.params.id;
      
      const patient = await storage.getPatient(patientId);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }
      
      await storage.deletePatient(patientId);
      await logActivity(userId, "delete", "patient", patientId.toString());
      
      res.json({ message: "Patient deleted successfully" });
    } catch (error) {
      console.error("Error deleting patient:", error);
      if (error instanceof Error && error.message.includes("Cannot delete patient")) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to delete patient" });
    }
  });

  // Treatment record routes
  app.get("/api/records", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      const { limit = 50, offset = 0, search, patientId, therapistId, sessionType, startDate, endDate } = req.query;

      // If therapist, only show their records
      const therapistFilter = user?.role === "therapist" ? userId : therapistId;

      // Build query object
      const query: any = {};
      if (search) query.$text = { $search: search };
      if (patientId) query.patientId = patientId;
      if (therapistFilter) query.therapistId = therapistFilter;
      if (sessionType) query.sessionType = sessionType;
      if (startDate || endDate) {
        query.sessionDate = {};
        if (startDate) query.sessionDate.$gte = new Date(startDate);
        if (endDate) query.sessionDate.$lte = new Date(endDate);
      }

      // Add cache-busting headers
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });

      const records = await storage.getAllTreatmentRecords(query);
      const total = await storage.countTreatmentRecords(query);

      await logActivity(userId, "view", "treatment_records", "list");
      res.json({ records, total });
    } catch (error) {
      console.error("Error fetching treatment records:", error);
      res.status(500).json({ message: "Failed to fetch treatment records" });
    }
  });

  app.get("/api/patients/:patientId/records", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const patientId = req.params.patientId;
      
      // Add cache-busting headers
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      const records = await storage.getTreatmentRecords(patientId);
      await logActivity(userId, "view", "treatment_records", patientId);
      
      res.json(records);
    } catch (error) {
      console.error("Error fetching treatment records:", error);
      res.status(500).json({ message: "Failed to fetch treatment records" });
    }
  });

  app.get("/api/records/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const recordId = req.params.id;
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
      const userId = req.user.id;
      const requestData = {
        ...req.body,
        sessionDate: new Date(req.body.sessionDate)
      };
      const recordData = insertTreatmentRecordSchema.parse(requestData);
      const record = await storage.createTreatmentRecord(recordData);
      
      // Debug: Log the record object
      console.log('Record object from storage:', record);
      console.log('Record _id:', record._id);
      console.log('Record _id type:', typeof record._id);
      
      // Safely get the record ID for logging
      const recordId = record._id ? record._id.toString() : 'unknown';
      await logActivity(userId, "create", "treatment_record", recordId, recordData);
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
      const userId = req.user.id;
      const recordId = req.params.id;
      const requestData = req.body.sessionDate ? {
        ...req.body,
        sessionDate: new Date(req.body.sessionDate)
      } : req.body;
      const updates = insertTreatmentRecordSchema.partial().parse(requestData);
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

  app.delete("/api/records/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const recordId = req.params.id;
      const record = await storage.getTreatmentRecord(recordId);
      if (!record) {
        return res.status(404).json({ message: "Treatment record not found" });
      }
      await storage.deleteTreatmentRecord(recordId);
      await logActivity(userId, "delete", "treatment_record", recordId.toString());
      res.json({ message: "Treatment record deleted successfully" });
    } catch (error) {
      console.error("Error deleting treatment record:", error);
      res.status(500).json({ message: "Failed to delete treatment record" });
    }
  });

  // Appointment routes
  app.get("/api/appointments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      const { patientId, startDate, endDate, status } = req.query;
      
      const therapistId = user?.role === "therapist" ? userId : undefined;
      
      let appointments = await storage.getAppointments(
        therapistId,
        patientId ? patientId.toString() : undefined,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      
      // Filter by status if provided
      if (status) {
        appointments = appointments.filter((apt: any) => apt.status === status);
      }

      await logActivity(userId, "view", "appointments", "list");
      res.json(appointments);
    } catch (error) {
      console.error("Error fetching appointments:", error);
      res.status(500).json({ message: "Failed to fetch appointments" });
    }
  });

  app.get("/api/appointments/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const appointmentId = req.params.id;
      
      const appointment = await storage.getAppointment(appointmentId);
      if (!appointment) {
        return res.status(404).json({ message: "Appointment not found" });
      }
      
      await logActivity(userId, "view", "appointment", appointmentId);
      res.json(appointment);
    } catch (error) {
      console.error("Error fetching appointment:", error);
      res.status(500).json({ message: "Failed to fetch appointment" });
    }
  });

  app.post("/api/appointments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const appointmentData = insertAppointmentSchema.parse(req.body);
      
      const appointment = await storage.createAppointment(appointmentData);
      await logActivity(userId, "create", "appointment", appointment._id.toString(), appointmentData);
      
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
      const userId = req.user.id;
      const appointmentId = req.params.id;
      const updates = insertAppointmentSchema.partial().parse(req.body);
      
      const appointment = await storage.updateAppointment(appointmentId, updates);
      await logActivity(userId, "update", "appointment", appointmentId, updates);
      
      res.json(appointment);
    } catch (error) {
      console.error("Error updating appointment:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid appointment data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update appointment" });
    }
  });

  app.delete("/api/appointments/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const appointmentId = req.params.id;
      
      console.log('Delete appointment request:', { userId, appointmentId });
      
      const deletedAppointment = await storage.deleteAppointment(appointmentId);
      console.log('Delete result:', deletedAppointment);
      
      if (!deletedAppointment) {
        console.log('Appointment not found for deletion');
        return res.status(404).json({ message: "Appointment not found" });
      }
      
      await logActivity(userId, "delete", "appointment", appointmentId);
      console.log('Appointment deleted successfully');
      res.json({ message: "Appointment deleted successfully" });
    } catch (error) {
      console.error("Error deleting appointment:", error);
      res.status(500).json({ message: "Failed to delete appointment" });
    }
  });

  app.post("/api/appointments/:id/reminder", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const appointmentId = req.params.id;
      
      const appointment = await storage.getAppointment(appointmentId);
      if (!appointment) {
        return res.status(404).json({ message: "Appointment not found" });
      }
      
      // For now, just log the reminder action
      // In a real app, this would send an email/SMS reminder
      await logActivity(userId, "send_reminder", "appointment", appointmentId);
      
      res.json({ message: "Reminder sent successfully" });
    } catch (error) {
      console.error("Error sending reminder:", error);
      res.status(500).json({ message: "Failed to send reminder" });
    }
  });

  // Staff routes
  app.get("/api/staff", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
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
      const userId = req.user.id;
      const therapists = await storage.getTherapists();
      await logActivity(userId, "view", "therapists", "list");
      
      res.json(therapists);
    } catch (error) {
      console.error("Error fetching therapists:", error);
      res.status(500).json({ message: "Failed to fetch therapists" });
    }
  });

  // Sample data creation endpoint
  app.post("/api/sample-data", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      // Only admins can create sample data
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }

      // Create sample patients
      const patient1 = await storage.createPatient({
        firstName: "John",
        lastName: "Doe",
        dateOfBirth: new Date("1990-01-15"),
        gender: "male",
        email: "john.doe@example.com",
        phone: "555-0101",
        status: "active"
      });

      const patient2 = await storage.createPatient({
        firstName: "Jane",
        lastName: "Smith",
        dateOfBirth: new Date("1985-03-22"),
        gender: "female",
        email: "jane.smith@example.com",
        phone: "555-0102",
        status: "active"
      });

      // Create sample therapist
      const therapist = await storage.createUser({
        email: "dr.therapist@example.com",
        firstName: "Dr. Sarah",
        lastName: "Johnson",
        role: "therapist",
        password: "password123"
      });

      // Create sample appointments
      const appointment1 = await storage.createAppointment({
        patientId: patient1.id,
        therapistId: therapist.id,
        appointmentDate: new Date(),
        duration: 60,
        type: "therapy-session",
        status: "scheduled"
      });

      const appointment2 = await storage.createAppointment({
        patientId: patient2.id,
        therapistId: therapist.id,
        appointmentDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        duration: 45,
        type: "consultation",
        status: "scheduled"
      });

      await logActivity(userId, "create", "sample_data", "all");
      res.json({ 
        message: "Sample data created successfully",
        created: {
          patients: 2,
          therapist: 1,
          appointments: 2
        }
      });
    } catch (error) {
      console.error("Error creating sample data:", error);
      res.status(500).json({ message: "Failed to create sample data" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
} 