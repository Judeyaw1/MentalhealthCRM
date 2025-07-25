import express, { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { emailService } from "./emailService";
import { insertPatientSchema, insertAuditLogSchema } from "@shared/schema";
import { z } from "zod";
import { Patient } from "./models/Patient";
import { hashPassword, generateSecurePassword, comparePassword } from "./lib/passwordUtils";
import * as XLSX from 'xlsx';
import { createObjectCsvWriter } from 'csv-writer';
import { TreatmentCompletionService } from "./treatmentCompletionService";
import { notificationService } from "./notificationService";
import mongoose from "mongoose";
import multer from "multer";
import path from "path";
import fs from "fs";
import { PatientAssessment } from "./models/PatientAssessment";

// Custom schema for MongoDB treatment records
const insertTreatmentRecordSchema = z.object({
  patientId: z.string().min(1, "Patient ID is required"),
  therapistId: z.string().min(1, "Therapist ID is required"),
  sessionDate: z
    .union([z.date(), z.string()])
    .transform((val) => (typeof val === "string" ? new Date(val) : val)),
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
  appointmentDate: z
    .union([z.date(), z.string()])
    .transform((val) => (typeof val === "string" ? new Date(val) : val)),
  duration: z.number().default(60),
  type: z.string().min(1, "Appointment type is required"),
  status: z.string().default("scheduled"),
  notes: z.string().optional(),
});

// Set up multer storage for uploads
const uploadDir = path.join(path.dirname(new URL(import.meta.url).pathname), "../uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
const storageEngine = multer.diskStorage({
  destination: (req: any, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    cb(null, uploadDir);
  },
  filename: (req: any, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext);
    cb(null, `${base}-${Date.now()}${ext}`);
  },
});
const upload = multer({ storage: storageEngine });

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Helper function for audit logging
  const logActivity = async (
    userId: string,
    action: string,
    resourceType: string,
    resourceId: string,
    details?: any,
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
      
      // Log successful authentication
      await logActivity(userId, "login", "session", `session_${Date.now()}`, {
        loginMethod: "session",
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      });
      
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.post("/api/auth/logout", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      // Log logout event
      await logActivity(userId, "logout", "session", `session_${Date.now()}`, {
        logoutMethod: "manual",
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      });
      
      req.session.destroy((err: any) => {
        if (err) {
          console.error("Error destroying session:", err);
          return res.status(500).json({ message: "Failed to logout" });
        }
        res.json({ message: "Logged out successfully" });
      });
    } catch (error) {
      console.error("Error during logout:", error);
      res.status(500).json({ message: "Failed to logout" });
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

  app.get(
    "/api/dashboard/recent-patients",
    isAuthenticated,
    async (req: any, res) => {
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

        console.log(
          "Recent patients response:",
          patients.map((p) => ({
            id: p.id,
            type: typeof p.id,
            fullPatient: p,
          })),
        );
        res.json(patients.slice(0, 5));
      } catch (error) {
        console.error("Error fetching recent patients:", error);
        res.status(500).json({ message: "Failed to fetch recent patients" });
      }
    },
  );

  app.get(
    "/api/dashboard/today-appointments",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const user = await storage.getUser(userId);
        let therapistId: string | undefined = undefined;
        let allowAll = false;
        if (user?.role === "therapist") {
          therapistId = userId;
        } else if (user?.role === "admin") {
          allowAll = true;
        } else if (user?.role === "staff" || user?.role === "frontdesk") {
          // Staff and front desk cannot see any appointments
          return res.json([]);
        }

        const appointments = await storage.getTodayAppointments(allowAll ? undefined : therapistId);
        res.json(appointments);
      } catch (error) {
        console.error("Error fetching today's appointments:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch today's appointments" });
      }
    },
  );

  // Patient routes
  app.get("/api/patients", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { limit = 50, offset = 0, search, status, createdBy, therapist, loc } = req.query;

      const query: any = {};
      if (search) {
        query.$or = [
          { firstName: { $regex: search, $options: "i" } },
          { lastName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
        ];
      }
      if (status) {
        query.status = status;
      }
      if (createdBy) {
        query.createdBy = createdBy;
      }
      if (therapist) {
        query.assignedTherapistId = therapist;
      }
      if (loc) {
        query.loc = loc;
      }

      const result = await storage.getPatients(
        parseInt(limit as string),
        parseInt(offset as string),
        search as string,
        status as string,
        createdBy as string,
        therapist as string,
        loc as string
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

  app.post("/api/patients", isAuthenticated, upload.fields([
    { name: "insuranceCard", maxCount: 1 },
    { name: "photo", maxCount: 1 },
  ]), async (req: any, res) => {
    try {
      const userId = req.user.id;
      let patientData;
      if (req.is("multipart/form-data")) {
        // Parse FormData
        patientData = { ...req.body };
        if (req.files && req.files.insuranceCard) {
          patientData.insuranceCardUrl = `/uploads/${req.files.insuranceCard[0].filename}`;
        }
        if (req.files && req.files.photo) {
          patientData.photoUrl = `/uploads/${req.files.photo[0].filename}`;
        }
      } else {
        patientData = req.body;
      }
      // Parse/validate
      const parsed = insertPatientSchema.parse(patientData);
      // Add the current user as the creator
      const patientWithCreator = {
        ...parsed,
        createdBy: userId,
      };
      const patient = await storage.createPatient(patientWithCreator);
      await logActivity(
        userId,
        "create",
        "patient",
        patient.id.toString(),
        parsed,
      );
      res.status(201).json(patient);
    } catch (error) {
      console.error("Error creating patient:", error);
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid patient data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create patient" });
    }
  });

  app.patch("/api/patients/:id", upload.fields([
    { name: "insuranceCard", maxCount: 1 },
    { name: "photo", maxCount: 1 },
  ]), isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const patientId = req.params.id;
      let updates;
      if (req.is("multipart/form-data")) {
        updates = { ...req.body };
        if (req.files && req.files.insuranceCard) {
          updates.insuranceCardUrl = `/uploads/${req.files.insuranceCard[0].filename}`;
        }
        if (req.files && req.files.photo) {
          updates.photoUrl = `/uploads/${req.files.photo[0].filename}`;
        }
      } else {
        updates = insertPatientSchema.partial().parse(req.body);
      }
      // Clean up ObjectId fields - convert empty strings to null
      const cleanedUpdates = {
        ...updates,
        assignedTherapistId:
          updates.assignedTherapistId === "" || !updates.assignedTherapistId
            ? null
            : updates.assignedTherapistId,
      };
      const patient = await storage.updatePatient(patientId, cleanedUpdates);
      await logActivity(
        userId,
        "update",
        "patient",
        patientId.toString(),
        cleanedUpdates,
      );
      res.json(patient);
    } catch (error) {
      console.error("Error updating patient:", error);
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid patient data", errors: error.errors });
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
      if (
        error instanceof Error &&
        error.message.includes("Cannot delete patient")
      ) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to delete patient" });
    }
  });

  // Patient export endpoint
  app.post("/api/patients/export", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { format = "csv", patientIds } = req.body;

      // Get patients data
      let patients;
      if (patientIds && patientIds.length > 0) {
        // Export specific patients
        patients = await Promise.all(
          patientIds.map((id: string) => storage.getPatient(id))
        );
        patients = patients.filter(Boolean); // Remove any null results
      } else {
        // Export all patients
        const result = await storage.getPatients(10000, 0); // Get all patients
        patients = result.patients;
      }

      if (!patients || patients.length === 0) {
        return res.status(404).json({ message: "No patients found to export" });
      }

      // Transform data for export
      const exportData = patients.map((patient: any) => ({
        ID: patient.id,
        "First Name": patient.firstName,
        "Last Name": patient.lastName,
        "Date of Birth": new Date(patient.dateOfBirth).toLocaleDateString(),
        Age: getAge(patient.dateOfBirth),
        Gender: patient.gender,
        Email: patient.email || "",
        Phone: patient.phone || "",
        Address: patient.address || "",
        Status: patient.status,
        "Assigned Therapist": patient.assignedTherapist ? `${patient.assignedTherapist.firstName} ${patient.assignedTherapist.lastName}` : "",
        "Emergency Contact": patient.emergencyContact ? `${patient.emergencyContact.name} (${patient.emergencyContact.phone})` : "",
        "Created Date": new Date(patient.createdAt).toLocaleDateString(),
        "Last Updated": new Date(patient.updatedAt).toLocaleDateString(),
      }));

      // Helper function to calculate age
      function getAge(dateOfBirth: string | number | Date) {
        const today = new Date();
        const birthDate = new Date(dateOfBirth);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        return age;
      }

      if (format === "csv") {
        // Export as CSV - generate directly in memory
        const csvHeaders = [
          'ID',
          'First Name',
          'Last Name',
          'Date of Birth',
          'Age',
          'Gender',
          'Email',
          'Phone',
          'Address',
          'Status',
          'Assigned Therapist',
          'Emergency Contact',
          'Created Date',
          'Last Updated'
        ];

        const csvRows = exportData.map(row => [
          row.ID,
          `"${row['First Name']}"`,
          `"${row['Last Name']}"`,
          `"${row['Date of Birth']}"`,
          row.Age,
          `"${row.Gender}"`,
          `"${row.Email}"`,
          `"${row.Phone}"`,
          `"${row.Address}"`,
          `"${row.Status}"`,
          `"${row['Assigned Therapist']}"`,
          `"${row['Emergency Contact']}"`,
          `"${row['Created Date']}"`,
          `"${row['Last Updated']}"`
        ].join(','));

        const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="patients-export-${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csvContent);

      } else if (format === "excel") {
        // Export as Excel
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Patients');

        const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="patients-export-${new Date().toISOString().split('T')[0]}.xlsx"`);
        res.send(excelBuffer);

      } else if (format === "pdf") {
        // For PDF, we'll return a simple text representation for now
        // In a production app, you'd use a proper PDF library like pdfkit
        const pdfContent = exportData.map(row => 
          Object.entries(row).map(([key, value]) => `${key}: ${value}`).join('\n')
        ).join('\n\n');

        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="patients-export-${new Date().toISOString().split('T')[0]}.txt"`);
        res.send(pdfContent);

      } else {
        return res.status(400).json({ message: "Unsupported export format" });
      }

      // Log the export activity
      await logActivity(userId, "export", "patients", "list", {
        format,
        patientCount: patients.length,
        patientIds: patientIds || "all"
      });

    } catch (error) {
      console.error("Error exporting patients:", error);
      res.status(500).json({ message: "Failed to export patients" });
    }
  });

  // Treatment record routes
  app.get("/api/records", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      const {
        limit = 50,
        offset = 0,
        search,
        patientId,
        therapistId,
        sessionType,
        startDate,
        endDate,
      } = req.query;

      // If therapist, only show their records
      const therapistFilter = user?.role === "therapist" ? userId : therapistId;

      // Build query object
      const query: any = {};
      if (typeof search === "string" && search.trim() !== "") {
        query.$or = [
          { notes: { $regex: search, $options: "i" } },
          { goals: { $regex: search, $options: "i" } },
          { progress: { $regex: search, $options: "i" } },
          { sessionType: { $regex: search, $options: "i" } },
          { patientName: { $regex: search, $options: "i" } },
        ];
      }
      if (patientId) {
        const patientIdStr = String(Array.isArray(patientId) ? patientId[0] : patientId);
        query.patientId = patientIdStr;
        console.log('🔍 Records API - Filtering by patientId:', {
          originalPatientId: patientId,
          convertedPatientId: patientIdStr,
          query: query
        });
      }
      if (therapistFilter) query.therapistId = String(Array.isArray(therapistFilter) ? therapistFilter[0] : therapistFilter);
      if (sessionType) query.sessionType = sessionType;
      if (startDate || endDate) {
        query.sessionDate = {};
        if (startDate) query.sessionDate.$gte = new Date(startDate);
        if (endDate) query.sessionDate.$lte = new Date(endDate);
      }

      // Add cache-busting headers
      res.set({
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
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

  app.get(
    "/api/patients/:patientId/records",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const patientId = req.params.patientId;

        // Add cache-busting headers
        res.set({
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        });

        const records = await storage.getTreatmentRecords(patientId);
        await logActivity(userId, "view", "treatment_records", patientId);

        res.json(records);
      } catch (error) {
        console.error("Error fetching treatment records:", error);
        res.status(500).json({ message: "Failed to fetch treatment records" });
      }
    },
  );

  app.get("/api/records/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const recordId = req.params.id;
      const record = await storage.getTreatmentRecord(recordId);
      if (!record) {
        return res.status(404).json({ message: "Treatment record not found" });
      }
      await logActivity(
        userId,
        "view",
        "treatment_record",
        recordId.toString(),
      );
      res.json(record);
    } catch (error) {
      console.error("Error fetching treatment record:", error);
      res.status(500).json({ message: "Failed to fetch treatment record" });
    }
  });

  app.post("/api/records", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      const requestData = {
        ...req.body,
        sessionDate: new Date(req.body.sessionDate),
      };
      const recordData = insertTreatmentRecordSchema.parse(requestData);
      const record = await storage.createTreatmentRecord(recordData);

      // Debug: Log the record object
      console.log("Record object from storage:", record);
      console.log("Record _id:", record._id);
      console.log("Record _id type:", typeof record._id);

      // Safely get the record ID for logging
      const recordId = record._id ? record._id.toString() : "unknown";
      await logActivity(
        userId,
        "create",
        "treatment_record",
        recordId,
        recordData,
      );
      res.status(201).json(record);
    } catch (error) {
      console.error("Error creating treatment record:", error);
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({
            message: "Invalid treatment record data",
            errors: error.errors,
          });
      }
      res.status(500).json({ message: "Failed to create treatment record" });
    }
  });

  app.patch("/api/records/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const recordId = req.params.id;
      const requestData = req.body.sessionDate
        ? {
            ...req.body,
            sessionDate: new Date(req.body.sessionDate),
          }
        : req.body;
      const updates = insertTreatmentRecordSchema.partial().parse(requestData);
      const record = await storage.updateTreatmentRecord(recordId, updates);
      await logActivity(
        userId,
        "update",
        "treatment_record",
        recordId.toString(),
        updates,
      );
      res.json(record);
    } catch (error) {
      console.error("Error updating treatment record:", error);
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({
            message: "Invalid treatment record data",
            errors: error.errors,
          });
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
      await logActivity(
        userId,
        "delete",
        "treatment_record",
        recordId.toString(),
      );
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
      const { patientId, startDate, endDate, status, search } = req.query;

      let therapistId: string | undefined = undefined;
      let allowAll = false;
      if (user?.role === "therapist") {
        therapistId = userId;
      } else if (user?.role === "admin") {
        allowAll = true;
      } else if (user?.role === "staff") {
        // Staff cannot see any appointments
        return res.json([]);
      }

      let appointments = await storage.getAppointments(
        allowAll ? undefined : therapistId,
        patientId ? String(patientId) : undefined,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined,
        search as string,
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
      const user = await storage.getUser(userId);
      const appointmentData = insertAppointmentSchema.parse(req.body);

      const appointment = await storage.createAppointment(appointmentData);
      await logActivity(
        userId,
        "create",
        "appointment",
        appointment._id.toString(),
        appointmentData,
      );

      res.status(201).json(appointment);
    } catch (error) {
      console.error("Error creating appointment:", error);
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid appointment data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create appointment" });
    }
  });

  app.patch("/api/appointments/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const appointmentId = req.params.id;
      const updates = insertAppointmentSchema.partial().parse(req.body);

      const appointment = await storage.updateAppointment(
        appointmentId,
        updates,
      );
      await logActivity(
        userId,
        "update",
        "appointment",
        appointmentId,
        updates,
      );

      res.json(appointment);
    } catch (error) {
      console.error("Error updating appointment:", error);
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid appointment data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update appointment" });
    }
  });

  app.delete(
    "/api/appointments/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const appointmentId = req.params.id;

        console.log("Delete appointment request:", { userId, appointmentId });

        const deletedAppointment =
          await storage.deleteAppointment(appointmentId);
        console.log("Delete result:", deletedAppointment);

        if (!deletedAppointment) {
          console.log("Appointment not found for deletion");
          return res.status(404).json({ message: "Appointment not found" });
        }

        await logActivity(userId, "delete", "appointment", appointmentId);
        console.log("Appointment deleted successfully");
        res.json({ message: "Appointment deleted successfully" });
      } catch (error) {
        console.error("Error deleting appointment:", error);
        res.status(500).json({ message: "Failed to delete appointment" });
      }
    },
  );

  app.post(
    "/api/appointments/:id/reminder",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const appointmentId = req.params.id;

        const appointment = await storage.getAppointment(appointmentId);
        if (!appointment) {
          return res.status(404).json({ message: "Appointment not found" });
        }

        // For now, just log the reminder action
        // In a real app, this would send an email/SMS reminder
        await logActivity(
          userId,
          "send_reminder",
          "appointment",
          appointmentId,
        );

        res.json({ message: "Reminder sent successfully" });
      } catch (error) {
        console.error("Error sending reminder:", error);
        res.status(500).json({ message: "Failed to send reminder" });
      }
    },
  );

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

  // Staff invitation endpoint
  app.post("/api/staff/invite", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      // Only admins can invite staff
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }

      console.log(
        "Staff invitation request body:",
        JSON.stringify(req.body, null, 2),
      );
      const { email, firstName, lastName, role, message } = req.body;

      // Validate required fields
      if (!email || !firstName || !lastName || !role) {
        console.log("Missing required fields:", {
          email,
          firstName,
          lastName,
          role,
        });
        return res.status(400).json({
          message: "Email, first name, last name, and role are required",
        });
      }

      // Validate role
      const validRoles = ["admin", "therapist", "staff", "frontdesk"];
      if (!validRoles.includes(role)) {
        console.log("Invalid role:", role);
        return res.status(400).json({
          message:
            "Invalid role. Must be one of: admin, therapist, staff, frontdesk",
        });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        console.log("User already exists:", email);
        return res.status(400).json({
          message: "A user with this email already exists",
        });
      }

      // Generate a secure default password
      const defaultPassword = generateSecurePassword();

      console.log("Creating user with data:", {
        email,
        firstName,
        lastName,
        role,
        password: defaultPassword.substring(0, 3) + "...",
        forcePasswordChange: true,
      });

      // Hash the password before creating the user
      const hashedPassword = await hashPassword(defaultPassword);

      // Create the new user using the storage method (which handles validation)
      const newUser = await storage.createUser({
        email,
        firstName,
        lastName,
        role,
        password: hashedPassword,
        forcePasswordChange: true, // Force them to change password on first login
      });

      console.log("User created successfully:", newUser.id);

      // Generate invitation URL
      const inviteUrl = `${req.protocol}://${req.get("host")}/login`;

      // Send invitation email
      const emailSent = await emailService.sendStaffInvitation(
        email,
        firstName,
        lastName,
        role,
        inviteUrl,
        defaultPassword,
        message
      );

      await logActivity(userId, "invite", "staff", newUser.id.toString(), {
        email,
        firstName,
        lastName,
        role,
        emailSent,
      });

      if (!emailSent) {
        // If email fails, still create the user but warn about it
        console.warn(
          `Failed to send invitation email to ${email}, but user was created`,
        );
        return res.status(201).json({
          message: "User created, but invitation email failed.",
          user: {
            id: newUser.id,
            email: newUser.email,
            firstName: newUser.firstName,
            lastName: newUser.lastName,
            role: newUser.role,
          },
          emailSent: false,
        });
      }

      res.status(201).json({
        message: "Staff invitation sent successfully",
        user: {
          id: newUser.id,
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          role: newUser.role,
        },
        emailSent: true,
      });
    } catch (error: any) {
      console.error("Error inviting staff:", error);
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code,
        path: error.path,
        issues: error.issues,
      });

      // Handle validation errors specifically
      if (error instanceof z.ZodError) {
        console.error("Zod validation errors:", error.errors);
        return res.status(400).json({
          message: "Invalid data provided",
          errors: error.errors,
        });
      }

      // Handle Mongoose validation errors
      if (error.name === "ValidationError") {
        console.error("Mongoose validation errors:", error.errors);
        return res.status(400).json({
          message: "Validation failed",
          errors: Object.values(error.errors).map((e: any) => e.message),
        });
      }

      res.status(500).json({ message: "Failed to invite staff member" });
    }
  });

  // Staff deletion endpoint
  app.delete("/api/staff/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      // Only admins can delete staff
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }

      const staffId = req.params.id;
      if (!mongoose.Types.ObjectId.isValid(staffId)) {
        return res.status(400).json({ message: "Invalid staff ID format" });
      }
      const staff = await storage.getUser(staffId);

      if (!staff) {
        return res.status(404).json({ message: "Staff member not found" });
      }

      await storage.deleteUser(staffId);
      await logActivity(userId, "delete", "staff", staffId);

      res.json({ message: "Staff member deleted successfully" });
    } catch (error) {
      console.error("Error deleting staff member:", error);
      res.status(500).json({ message: "Failed to delete staff member" });
    }
  });

  // Get therapists endpoint
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

  // Password reset endpoint for staff members
  app.post(
    "/api/staff/:userId/reset-password",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const adminId = req.user.id;
        const admin = await storage.getUser(adminId);

        // Only admins can reset passwords
        if (admin?.role !== "admin") {
          return res.status(403).json({ message: "Access denied" });
        }

        const userId = req.params.userId;
        const user = await storage.getUser(userId);

        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        // Generate a secure default password
        const defaultPassword = generateSecurePassword();

        // Hash the password before updating
        const hashedPassword = await hashPassword(defaultPassword);

        // Update user with new password and force password change
        const updatedUser = await storage.updateUser(userId, {
          password: hashedPassword,
          forcePasswordChange: true,
        });

        if (!updatedUser) {
          return res
            .status(500)
            .json({ message: "Failed to update user password" });
        }

        // Send password reset email
        const emailSent = await emailService.sendAdminPasswordReset(
          user.email,
          user.firstName,
          user.lastName,
          defaultPassword
        );

        await logActivity(adminId, "reset_password", "user", userId, {
          targetEmail: user.email,
          emailSent,
        });

        res.json({
          message: "Password reset successfully",
          defaultPassword,
          emailSent,
        });
      } catch (error) {
        console.error("Error resetting password:", error);
        res.status(500).json({ message: "Failed to reset password" });
      }
    },
  );

  // Change password endpoint for authenticated users
  app.post(
    "/api/auth/change-password",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
          return res
            .status(400)
            .json({
              message: "Current password and new password are required",
            });
        }

        if (newPassword.length < 8) {
          return res
            .status(400)
            .json({
              message: "New password must be at least 8 characters long",
            });
        }

        const user = await storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        // Verify current password
        const isCurrentPasswordValid = await comparePassword(currentPassword, user.password);
        if (!isCurrentPasswordValid) {
          return res
            .status(400)
            .json({ message: "Current password is incorrect" });
        }

        // Hash the new password before updating
        const hashedNewPassword = await hashPassword(newPassword);

        // Update password and remove force password change flag
        const updatedUser = await storage.updateUser(userId, {
          password: hashedNewPassword,
          forcePasswordChange: false,
        });

        if (!updatedUser) {
          return res.status(500).json({ message: "Failed to update password" });
        }

        await logActivity(userId, "change_password", "user", userId);

        res.json({
          message: "Password changed successfully",
        });
      } catch (error: any) {
        console.error("Error changing password:", error);
        res.status(500).json({ message: "Failed to change password" });
      }
    },
  );

  // Update profile endpoint
  app.put(
    "/api/auth/update-profile",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const { firstName, lastName, email } = req.body;

        console.log("Update profile request:", { userId, firstName, lastName, email });

        if (!firstName || !lastName || !email) {
          return res
            .status(400)
            .json({
              message: "First name, last name, and email are required",
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return res
            .status(400)
            .json({
              message: "Please provide a valid email address",
            });
        }

        // Check if email is already taken by another user
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser && existingUser.id !== userId) {
          return res
            .status(400)
            .json({
              message: "Email address is already in use by another account",
            });
        }

        // Update user profile
        const updateData = {
          firstName,
          lastName,
          email,
        };

        console.log("Updating user with data:", updateData);

        const updatedUser = await storage.updateUser(userId, updateData);

        if (!updatedUser) {
          return res.status(500).json({ message: "Failed to update profile" });
        }

        console.log("User updated successfully:", updatedUser);

        await logActivity(userId, "update", "user", userId, {
          updatedFields: ["firstName", "lastName", "email"],
        });

        res.json({
          message: "Profile updated successfully",
          user: {
            id: updatedUser.id,
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            email: updatedUser.email,
            role: updatedUser.role,
            createdAt: updatedUser.createdAt,
            updatedAt: updatedUser.updatedAt,
          },
        });
      } catch (error: any) {
        console.error("Error updating profile:", error);
        console.error("Error details:", error.message, error.stack);
        res.status(500).json({ message: "Failed to update profile" });
      }
    },
  );

  // Update settings endpoint
  app.put(
    "/api/auth/update-settings",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const { notifications, appearance } = req.body;

        // Validate notification settings
        if (notifications) {
          const validNotificationKeys = [
            "emailNotifications",
            "appointmentReminders",
            "patientUpdates",
            "systemAlerts",
          ];
          
          for (const key of validNotificationKeys) {
            if (typeof notifications[key] !== "boolean") {
              return res
                .status(400)
                .json({
                  message: `Invalid notification setting: ${key}`,
                });
            }
          }
        }

        // Validate appearance settings
        if (appearance) {
          if (appearance.theme && !["light", "dark", "system"].includes(appearance.theme)) {
            return res
              .status(400)
              .json({
                message: "Invalid theme setting",
              });
          }

          if (typeof appearance.compactMode !== "boolean") {
            return res
              .status(400)
              .json({
                message: "Invalid compact mode setting",
              });
          }

          if (typeof appearance.showAnimations !== "boolean") {
            return res
              .status(400)
              .json({
                message: "Invalid animation setting",
              });
          }
        }

        // Store settings in user document or separate settings collection
        // For now, we'll store them in the user document as a settings field
        const settingsData = {
          notifications: notifications || {},
          appearance: appearance || {},
          updatedAt: new Date(),
        };

        const updatedUser = await storage.updateUser(userId, {
          settings: settingsData,
        });

        if (!updatedUser) {
          return res.status(500).json({ message: "Failed to update settings" });
        }

        await logActivity(userId, "update", "user", userId, {
          updatedFields: ["settings"],
        });

        res.json({
          message: "Settings updated successfully",
        });
      } catch (error: any) {
        console.error("Error updating settings:", error);
        res.status(500).json({ message: "Failed to update settings" });
      }
    },
  );

  // Get user settings endpoint
  app.get(
    "/api/auth/settings",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const user = await storage.getUser(userId);

        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }

        // Return default settings if none exist
        const defaultSettings = {
          notifications: {
            emailNotifications: true,
            appointmentReminders: true,
            patientUpdates: true,
            systemAlerts: true,
          },
          appearance: {
            theme: "system",
            compactMode: false,
            showAnimations: true,
          },
        };

        const settings = user.settings || defaultSettings;

        res.json(settings);
      } catch (error: any) {
        console.error("Error fetching settings:", error);
        res.status(500).json({ message: "Failed to fetch settings" });
      }
    },
  );

  // Migration endpoint to populate createdBy for existing patients
  app.post(
    "/api/migrate/patients-created-by",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const user = await storage.getUser(userId);

        // Only admins can run migrations
        if (user?.role !== "admin") {
          return res.status(403).json({ message: "Access denied" });
        }

        // Find all patients without createdBy field
        const patientsWithoutCreator = await Patient.find({
          $or: [
            { createdBy: { $exists: false } },
            { createdBy: null },
            { createdBy: "" },
          ],
        });

        console.log(
          `Found ${patientsWithoutCreator.length} patients without createdBy field`,
        );

        if (patientsWithoutCreator.length === 0) {
          return res.json({
            message: "No patients need migration",
            migrated: 0,
          });
        }

        // Update all patients without createdBy to use the current admin as creator
        const updateResult = await Patient.updateMany(
          {
            $or: [
              { createdBy: { $exists: false } },
              { createdBy: null },
              { createdBy: "" },
            ],
          },
          { createdBy: userId },
        );

        console.log(
          `Migration completed: ${updateResult.modifiedCount} patients updated`,
        );

        res.json({
          message: "Migration completed successfully",
          migrated: updateResult.modifiedCount,
        });
      } catch (error) {
        console.error("Migration error:", error);
        res.status(500).json({ message: "Migration failed" });
      }
    },
  );

  // --- SEARCH ENDPOINT ---
  app.get("/api/search", isAuthenticated, async (req: any, res) => {
    try {
      const q = (req.query.q || "").toString().trim();
      console.log("Search request received:", { q, length: q.length });

      if (!q || q.length < 2) {
        console.log("Query too short, returning empty results");
        return res.json([]);
      }

      // Helper function to calculate age
      function getAge(dateOfBirth: string | number | Date) {
        const today = new Date();
        const birthDate = new Date(dateOfBirth);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (
          monthDiff < 0 ||
          (monthDiff === 0 && today.getDate() < birthDate.getDate())
        ) {
          age--;
        }
        return age;
      }

      console.log("Searching patients...");
      // Search patients
      const patientResult = await storage.getPatients(10, 0, q);
      const patients = (patientResult.patients || []).map((p: any) => {
        const age = getAge(p.dateOfBirth);
        const status = p.status || 'active';
        const contactInfo = [];
        if (p.email) contactInfo.push(p.email);
        if (p.phone) contactInfo.push(p.phone);
        
        return {
          id: p.id,
          type: "patient",
          title: `${p.firstName} ${p.lastName}`.trim(),
          subtitle: `${age} years old • ${status}${contactInfo.length > 0 ? ` • ${contactInfo.join(' | ')}` : ''}`,
          href: `/patients/${p.id}`,
        };
      });
      console.log("Patient results:", patients.length);

      console.log("Searching appointments...");
      // Search appointments (by patient name or appointment id)
      const appointments = (await storage.getAppointments())
        .filter((apt: any) => {
          const patientName =
            apt.patient?.firstName + " " + apt.patient?.lastName;
          return (
            apt.id.includes(q) ||
            (patientName && patientName.toLowerCase().includes(q.toLowerCase()))
          );
        })
        .slice(0, 10)
        .map((apt: any) => ({
          id: apt.id,
          type: "appointment",
          title:
            `${apt.patient?.firstName || ""} ${apt.patient?.lastName || ""}`.trim(),
          subtitle: `Appointment on ${new Date(apt.appointmentDate).toLocaleString()}`,
          href: `/appointments/${apt.id}`,
        }));
      console.log("Appointment results:", appointments.length);

      console.log("Searching records...");
      // Search treatment records (by patient name or record id)
      const records = (await storage.getAllTreatmentRecords())
        .filter((rec: any) => {
          const patientName =
            rec.patient?.firstName + " " + rec.patient?.lastName;
          return (
            rec.id.includes(q) ||
            (patientName && patientName.toLowerCase().includes(q.toLowerCase()))
          );
        })
        .slice(0, 10)
        .map((rec: any) => ({
          id: rec.id,
          type: "record",
          title:
            `${rec.patient?.firstName || ""} ${rec.patient?.lastName || ""}`.trim(),
          subtitle: `Record on ${rec.sessionDate ? new Date(rec.sessionDate).toLocaleDateString() : "Unknown date"}`,
          href: `/records/${rec.id}`,
        }));
      console.log("Record results:", records.length);

      // Combine and return
      const results = [...patients, ...appointments, ...records];
      console.log("Total search results:", results.length);
      console.log("Sending response:", results);
      res.json(results);
    } catch (error) {
      console.error("/api/search error:", error);
      res.status(500).json({ message: "Search failed" });
    }
  });

  // Audit logs routes (admin only)
  app.get("/api/audit-logs", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Access denied. Admin only." });
      }

      const filters = {
        userId: req.query.userId,
        action: req.query.action,
        resourceType: req.query.resourceType,
        resourceId: req.query.resourceId,
        startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate) : undefined,
        search: req.query.search,
        limit: req.query.limit ? parseInt(req.query.limit) : 100,
        offset: req.query.offset ? parseInt(req.query.offset) : 0,
      };

      const logs = await storage.getAuditLogs(filters);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  app.get("/api/audit-logs/export", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Access denied. Admin only." });
      }

      const filters = {
        userId: req.query.userId,
        action: req.query.action,
        resourceType: req.query.resourceType,
        resourceId: req.query.resourceId,
        startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate) : undefined,
        search: req.query.search,
      };

      const logs = await storage.getAuditLogs(filters);
      
      // Convert to CSV
      const csvHeaders = "Timestamp,User ID,Action,Resource Type,Resource ID,IP Address,Session ID,Details\n";
      const csvRows = logs.map(log => {
        const details = log.details ? `"${log.details.replace(/"/g, '""')}"` : "";
        return `${log.timestamp},${log.userId},${log.action},${log.resourceType},${log.resourceId},${log.ipAddress || ""},${log.sessionId || ""},${details}`;
      }).join("\n");
      
      const csv = csvHeaders + csvRows;
      
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="audit-logs-${new Date().toISOString().split("T")[0]}.csv"`);
      res.send(csv);
    } catch (error) {
      console.error("Error exporting audit logs:", error);
      res.status(500).json({ message: "Failed to export audit logs" });
    }
  });

  app.get("/api/audit-logs/summary", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Access denied. Admin only." });
      }

      const days = req.query.days ? parseInt(req.query.days) : 30;
      const summary = await storage.getAuditSummary(days);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching audit summary:", error);
      res.status(500).json({ message: "Failed to fetch audit summary" });
    }
  });

  // Unique logins count endpoint
  app.get('/api/audit-logs/unique-logins', isAuthenticated, async (req, res) => {
    try {
      const days = req.query.days ? parseInt(req.query.days) : 7;
      const match: any = { action: 'login' };
      if (days) {
        const since = new Date();
        since.setDate(since.getDate() - days);
        match.timestamp = { $gte: since };
      }
      // Only count non-admin users
      const loginLogs = await storage.db.collection('auditLogs').find(match).toArray();
      const userIds = loginLogs.map((log: any) => log.userId);
      // Remove admin users
      const users = await storage.getStaff();
      const adminIds = users.filter((u: any) => u.role === 'admin').map((u: any) => u.id);
      const uniqueNonAdminUserIds = Array.from(new Set(userIds)) as string[];
      const filteredUniqueUserIds = uniqueNonAdminUserIds.filter((id: string) => !adminIds.includes(id));
      res.json({ count: filteredUniqueUserIds.length });
    } catch (error) {
      console.error('Error fetching unique logins:', error);
      res.status(500).json({ message: 'Failed to fetch unique logins' });
    }
  });

  // Treatment record history endpoint
  app.get("/api/records/:recordId/history", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const recordId = req.params.recordId;
      const user = await storage.getUser(userId);

      // Check if user has permission to view this record
      const record = await storage.getTreatmentRecord(recordId);
      if (!record) {
        return res.status(404).json({ message: "Treatment record not found" });
      }

      // Only allow access if user is admin, the record's therapist, or the record's patient's assigned therapist
      const canAccess = user?.role === "admin" || 
                       record.therapist?.id === userId ||
                       (record.patient && record.patient.assignedTherapistId?.toString() === userId);

      if (!canAccess) {
        return res.status(403).json({ message: "Access denied. You don't have permission to view this record's history." });
      }

      // Get audit logs for this specific treatment record
      const filters = {
        resourceType: "treatment_record",
        resourceId: recordId,
        limit: 50, // Limit to recent history
        offset: 0,
      };

      const logs = await storage.getAuditLogs(filters);

      // Enrich logs with user information
      const enrichedLogs = await Promise.all(
        logs.map(async (log: any) => {
          try {
            const logUser = await storage.getUser(log.userId);
            return {
              ...log,
              user: logUser ? {
                id: logUser.id,
                firstName: logUser.firstName,
                lastName: logUser.lastName,
                email: logUser.email,
                role: logUser.role,
              } : null,
              details: log.details ? JSON.parse(log.details) : null,
            };
          } catch (error) {
            console.error("Error enriching log with user data:", error);
            return {
              ...log,
              user: null,
              details: log.details ? JSON.parse(log.details) : null,
            };
          }
        })
      );

      res.json(enrichedLogs);
    } catch (error) {
      console.error("Error fetching treatment record history:", error);
      res.status(500).json({ message: "Failed to fetch treatment record history" });
    }
  });

  // Treatment completion endpoints
  app.post("/api/patients/:id/check-discharge", isAuthenticated, async (req: any, res) => {
    try {
      const patientId = req.params.id;
      const dischargeCheck = await TreatmentCompletionService.checkForAutoDischarge(patientId);
      
      res.json({
        shouldDischarge: dischargeCheck.shouldDischarge,
        reason: dischargeCheck.reason,
        criteria: dischargeCheck.criteria
      });
    } catch (error) {
      console.error("Error checking discharge criteria:", error);
      res.status(500).json({ message: "Failed to check discharge criteria" });
    }
  });

  app.post("/api/patients/:id/auto-discharge", isAuthenticated, async (req: any, res) => {
    try {
      const patientId = req.params.id;
      const result = await TreatmentCompletionService.autoDischargePatient(patientId);
      
      if (result.success) {
        // Log the auto-discharge
        await logActivity(req.user.id, "auto_discharge", "patient", patientId, {
          reason: result.reason,
          criteria: result.criteria
        });
        
        res.json({
          success: true,
          message: "Patient automatically discharged",
          reason: result.reason,
          criteria: result.criteria
        });
      } else {
        res.status(400).json({
          success: false,
          message: "Discharge criteria not met",
          criteria: result.criteria
        });
      }
    } catch (error) {
      console.error("Error auto-discharging patient:", error);
      res.status(500).json({ message: "Failed to auto-discharge patient" });
    }
  });

  app.post("/api/patients/:id/treatment-goals", isAuthenticated, async (req: any, res) => {
    try {
      const patientId = req.params.id;
      const { goals } = req.body;

      const patient = await storage.getPatient(patientId);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }

      // Update treatment goals
      await Patient.findByIdAndUpdate(patientId, {
        treatmentGoals: goals
      });

      // Log the update
      await logActivity(req.user.id, "update_treatment_goals", "patient", patientId, {
        goalsCount: goals.length
      });

      res.json({ success: true, message: "Treatment goals updated" });
    } catch (error) {
      console.error("Error updating treatment goals:", error);
      res.status(500).json({ message: "Failed to update treatment goals" });
    }
  });

  app.patch("/api/patients/:id/treatment-goals/:goalIndex", isAuthenticated, async (req: any, res) => {
    try {
      const patientId = req.params.id;
      const goalIndex = parseInt(req.params.goalIndex);
      const updates = req.body;

      const result = await TreatmentCompletionService.updateTreatmentGoal(patientId, goalIndex, updates);

      // Log the goal update
      await logActivity(req.user.id, "update_treatment_goal", "patient", patientId, {
        goalIndex,
        status: updates.status
      });

      // Check for auto-discharge if goal was achieved
      if (result.shouldCheckDischarge) {
        const dischargeCheck = await TreatmentCompletionService.checkForAutoDischarge(patientId);
        if (dischargeCheck.shouldDischarge) {
          await TreatmentCompletionService.autoDischargePatient(patientId);
          
          await logActivity(req.user.id, "auto_discharge", "patient", patientId, {
            reason: "Goal achievement triggered discharge",
            criteria: dischargeCheck.criteria
          });
        }
      }

      res.json({ 
        success: true, 
        message: "Treatment goal updated",
        shouldCheckDischarge: result.shouldCheckDischarge
      });
    } catch (error) {
      console.error("Error updating treatment goal:", error);
      res.status(500).json({ message: "Failed to update treatment goal" });
    }
  });

  // Notification routes
  app.get(
    "/api/notifications",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const { unreadOnly, limit, offset, type } = req.query;

        const notifications = await storage.getUserNotifications(userId, {
          unreadOnly: unreadOnly === 'true',
          limit: limit ? parseInt(limit) : undefined,
          offset: offset ? parseInt(offset) : undefined,
          type: type as any,
        });

        res.json(notifications);
      } catch (error: any) {
        console.error("Error fetching notifications:", error);
        res.status(500).json({ message: "Failed to fetch notifications" });
      }
    },
  );

  app.get(
    "/api/notifications/unread-count",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const count = await storage.getUnreadNotificationCount(userId);
        res.json({ count });
      } catch (error: any) {
        console.error("Error fetching unread count:", error);
        res.status(500).json({ message: "Failed to fetch unread count" });
      }
    },
  );

  app.put(
    "/api/notifications/:id/read",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const { id } = req.params;

        const success = await storage.markNotificationAsRead(id, userId);
        
        if (success) {
          res.json({ message: "Notification marked as read" });
        } else {
          res.status(404).json({ message: "Notification not found" });
        }
      } catch (error: any) {
        console.error("Error marking notification as read:", error);
        res.status(500).json({ message: "Failed to mark notification as read" });
      }
    },
  );

  app.put(
    "/api/notifications/mark-all-read",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const success = await storage.markAllNotificationsAsRead(userId);
        
        if (success) {
          res.json({ message: "All notifications marked as read" });
        } else {
          res.status(404).json({ message: "No notifications found" });
        }
      } catch (error: any) {
        console.error("Error marking all notifications as read:", error);
        res.status(500).json({ message: "Failed to mark notifications as read" });
      }
    },
  );

  app.delete(
    "/api/notifications/:id",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const { id } = req.params;

        const success = await storage.deleteNotification(id, userId);
        
        if (success) {
          res.json({ message: "Notification deleted" });
        } else {
          res.status(404).json({ message: "Notification not found" });
        }
      } catch (error: any) {
        console.error("Error deleting notification:", error);
        res.status(500).json({ message: "Failed to delete notification" });
      }
    },
  );

  app.get(
    "/api/notifications/stats",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const stats = await notificationService.getNotificationStats(userId);
        res.json(stats);
      } catch (error: any) {
        console.error("Error fetching notification stats:", error);
        res.status(500).json({ message: "Failed to fetch notification stats" });
      }
    },
  );

  // Test notification endpoint
  app.post(
    "/api/notifications/test",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const { type, title, message, data } = req.body;

        const notification = await notificationService.createNotification(
          userId,
          type || 'general',
          title || 'Test Notification',
          message || 'This is a test notification',
          data
        );

        res.json({ 
          message: "Test notification created", 
          notification 
        });
      } catch (error: any) {
        console.error("Error creating test notification:", error);
        res.status(500).json({ message: "Failed to create test notification" });
      }
    },
  );

  // Email test endpoint
  app.post(
    "/api/email/test",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const userId = req.user.id;
        const user = await storage.getUser(userId);
        
        if (!user?.email) {
          return res.status(400).json({ message: "User email not found" });
        }

        const { emailType, data } = req.body;
        let success = false;

        switch (emailType) {
          case 'appointment_reminder':
            success = await emailService.sendAppointmentReminder(user.email, data);
            break;
          case 'patient_update':
            success = await emailService.sendPatientUpdate(user.email, data);
            break;
          case 'system_alert':
            success = await emailService.sendSystemAlert(user.email, data);
            break;
          default:
            success = await emailService.sendEmail({
              to: user.email,
              template: {
                subject: 'Test Email',
                html: '<h1>Test Email</h1><p>This is a test email from the Mental Health Tracker system.</p>',
                text: 'Test Email\n\nThis is a test email from the Mental Health Tracker system.',
              },
            });
        }

        if (success) {
          res.json({ message: "Test email sent successfully" });
        } else {
          res.status(500).json({ message: "Failed to send test email" });
        }
      } catch (error: any) {
        console.error("Error sending test email:", error);
        res.status(500).json({ message: "Failed to send test email" });
      }
    },
  );

  // Patient Assessment API
  app.get("/api/patients/:id/assessments", isAuthenticated, async (req, res) => {
    const assessments = await PatientAssessment.find({ patientId: req.params.id }).sort({ date: -1 }).lean();
    res.json(assessments.map(a => ({ ...a, id: a._id.toString() })));
  });
  app.post("/api/patients/:id/assessments", isAuthenticated, async (req, res) => {
    try {
      let user = req.user;
      if (!user.firstName || !user.lastName || !user.role) {
        const dbUser = await storage.getUser(user.id);
        console.log('Fetched dbUser:', dbUser);
        if (dbUser) {
          user = { ...user, ...dbUser };
        }
      }
      // Use 'name' if firstName/lastName missing
      let name = user.firstName && user.lastName ? `${user.firstName} ${user.lastName}`.trim() : (user.name || '').trim();
      console.log('User for createdBy:', user, 'Resolved name:', name);
      const createdBy = {
        id: user.id,
        name: name || 'Unknown',
        role: user.role || 'N/A'
      };
      const assessment = new PatientAssessment({
        ...req.body,
        patientId: req.params.id,
        createdBy,
        updatedBy: createdBy
      });
      await assessment.save();
      // Schedule follow-up notification if followUpDate is set
      if (assessment.followUpDate) {
        // Find patient and assigned therapist
        const patient = await Patient.findById(req.params.id).lean();
        let userId = req.user.id;
        if (patient && patient.assignedTherapistId) {
          userId = patient.assignedTherapistId.toString();
        }
        const title = "Assessment Follow-Up Reminder";
        const message = `Follow-up for patient ${patient?.firstName || ""} ${patient?.lastName || ""} is due on ${assessment.followUpDate.toLocaleDateString()}.`;
        await notificationService.createNotification(
          userId,
          "assessment_followup",
          title,
          message,
          { patientId: req.params.id, assessmentId: assessment._id.toString(), followUpDate: assessment.followUpDate },
          assessment.followUpDate
        );
      }
      res.status(201).json({ ...assessment.toObject(), id: assessment._id.toString() });
    } catch (error) {
      res.status(400).json({ message: "Failed to create assessment", error });
    }
  });
  app.get("/api/assessments/:assessmentId", isAuthenticated, async (req, res) => {
    const assessment = await PatientAssessment.findById(req.params.assessmentId).lean();
    if (!assessment) return res.status(404).json({ message: "Not found" });
    res.json({ ...assessment, id: assessment._id.toString() });
  });
  app.patch("/api/assessments/:assessmentId", isAuthenticated, async (req, res) => {
    let user = req.user;
    if (!user.firstName || !user.lastName || !user.role) {
      const dbUser = await storage.getUser(user.id);
      console.log('Fetched dbUser:', dbUser);
      if (dbUser) {
        user = { ...user, ...dbUser };
      }
    }
    let name = user.firstName && user.lastName ? `${user.firstName} ${user.lastName}`.trim() : (user.name || '').trim();
    console.log('User for updatedBy:', user, 'Resolved name:', name);
    const updatedBy = {
      id: user.id,
      name: name || 'Unknown',
      role: user.role || 'N/A'
    };
    const allowedFields = [
      'presentingProblem', 'medicalHistory', 'psychiatricHistory', 'familyHistory',
      'socialHistory', 'mentalStatus', 'riskAssessment', 'diagnosis', 'impressions',
      'followUpDate', 'followUpNotes', 'status'
    ];
    const updates = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    updates.updatedBy = updatedBy;
    const oldAssessment = await PatientAssessment.findById(req.params.assessmentId).lean();
    const updated = await PatientAssessment.findByIdAndUpdate(req.params.assessmentId, updates, { new: true }).lean();
    if (!updated) return res.status(404).json({ message: "Not found" });
    // If followUpDate changed, remove previous notification
    if (updated.followUpDate && oldAssessment && String(updated.followUpDate) !== String(oldAssessment.followUpDate)) {
      const patient = await Patient.findById(updated.patientId).lean();
      let userId = req.user.id;
      if (patient && patient.assignedTherapistId) {
        userId = patient.assignedTherapistId.toString();
      }
      // Delete previous follow-up notification for this assessment
      await storage.deleteAssessmentFollowupNotification(userId, updated._id.toString());
      // Create new notification for the new date
      const title = "Assessment Follow-Up Reminder";
      const message = `Follow-up for patient ${patient?.firstName || ""} ${patient?.lastName || ""} is due on ${new Date(updated.followUpDate).toLocaleDateString()}.`;
      await notificationService.createNotification(
        userId,
        "assessment_followup",
        title,
        message,
        { patientId: updated.patientId.toString(), assessmentId: updated._id.toString(), followUpDate: updated.followUpDate },
        updated.followUpDate
      );
    } else if (updated.followUpDate) {
      // If not changed, just ensure notification exists (legacy support)
      const patient = await Patient.findById(updated.patientId).lean();
      let userId = req.user.id;
      if (patient && patient.assignedTherapistId) {
        userId = patient.assignedTherapistId.toString();
      }
      const title = "Assessment Follow-Up Reminder";
      const message = `Follow-up for patient ${patient?.firstName || ""} ${patient?.lastName || ""} is due on ${new Date(updated.followUpDate).toLocaleDateString()}.`;
      await notificationService.createNotification(
        userId,
        "assessment_followup",
        title,
        message,
        { patientId: updated.patientId.toString(), assessmentId: updated._id.toString(), followUpDate: updated.followUpDate },
        updated.followUpDate
      );
    }
    res.json({ ...updated, id: updated._id.toString() });
  });
  app.delete("/api/assessments/:assessmentId", isAuthenticated, async (req, res) => {
    await PatientAssessment.findByIdAndDelete(req.params.assessmentId);
    res.status(204).end();
  });

  const httpServer = createServer(app);
  return httpServer;
}
