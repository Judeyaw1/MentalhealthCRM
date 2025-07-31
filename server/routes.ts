import express, { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { emailService } from "./emailService";
import type { InsertPatient, InsertAuditLog } from "@shared/types";
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
import { PatientNote } from "./models/PatientNote";

// Custom schema for MongoDB treatment records
const insertTreatmentRecordSchema = z.object({
  patientId: z.string().min(1, "Patient ID is required"),
  therapistId: z.string().min(1, "Therapist ID is required"),
  sessionDate: z
    .union([z.date(), z.string(), z.number()])
    .transform((val) => {
      if (typeof val === "string") return new Date(val);
      if (typeof val === "number") return new Date(val);
      return val;
    }),
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

  // Serve static files (React app production build) - only in production
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(process.cwd(), 'dist/public')));
  }
  
  // Serve uploads
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

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
        } else if (user?.role === "admin" || user?.role === "supervisor") {
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
      // Validate required fields manually since we removed the schema
      if (!patientData.firstName || !patientData.lastName || !patientData.dateOfBirth) {
        return res.status(400).json({ message: "First name, last name, and date of birth are required" });
      }
      const parsed = patientData;
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
        updates = req.body;
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

  // Bulk delete patients endpoint
  app.post("/api/patients/bulk-delete", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { patientIds } = req.body;
      if (!Array.isArray(patientIds) || patientIds.length === 0) {
        return res.status(400).json({ message: "No patient IDs provided" });
      }
      const results = [];
      for (const id of patientIds) {
        try {
          await storage.deletePatient(id);
          await logActivity(userId, "delete", "patient", id.toString());
          results.push({ id, success: true });
        } catch (error) {
          let message = "Failed to delete patient";
          if (error instanceof Error) {
            message = error.message;
          }
          results.push({ id, success: false, message });
        }
      }
      const failed = results.filter(r => !r.success);
      if (failed.length > 0) {
        return res.status(207).json({
          message: `Some patients could not be deleted`,
          results,
        });
      }
      res.json({ message: "All selected patients deleted successfully", results });
    } catch (error) {
      console.error("Bulk delete error:", error);
      res.status(500).json({ message: "Failed to delete patients" });
    }
  });

  // Bulk update patients endpoint
  app.post("/api/patients/bulk-update", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { patientIds, updates } = req.body;
      if (!Array.isArray(patientIds) || patientIds.length === 0) {
        return res.status(400).json({ message: "No patient IDs provided" });
      }
      if (!updates || typeof updates !== "object") {
        return res.status(400).json({ message: "No updates provided" });
      }
      const results = [];
      for (const id of patientIds) {
        try {
          const updated = await Patient.findByIdAndUpdate(id, updates, { new: true });
          await logActivity(userId, "update", "patient", id.toString(), updates);
          results.push({ id, success: true, updated });
        } catch (error) {
          let message = "Failed to update patient";
          if (error instanceof Error) {
            message = error.message;
          }
          results.push({ id, success: false, message });
        }
      }
      const failed = results.filter(r => !r.success);
      if (failed.length > 0) {
        return res.status(207).json({
          message: `Some patients could not be updated`,
          results,
        });
      }
      res.json({ message: "All selected patients updated successfully", results });
    } catch (error) {
      console.error("Bulk update error:", error);
      res.status(500).json({ message: "Failed to update patients" });
    }
  });

  // Bulk import patients endpoint
  app.post("/api/patients/bulk-import", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { patients } = req.body;
      if (!Array.isArray(patients) || patients.length === 0) {
        return res.status(400).json({ message: "No patients provided" });
      }
      let successCount = 0;
      const errors: string[] = [];
      for (const [i, data] of patients.entries()) {
        try {
          // Basic validation: require firstName, lastName, dateOfBirth, email
          if (!data.firstName || !data.lastName || !data.dateOfBirth || !data.email) {
            errors.push(`Row ${i + 1}: Missing required fields.`);
            continue;
          }
          // Parse dateOfBirth if needed
          if (typeof data.dateOfBirth === "string") {
            data.dateOfBirth = new Date(data.dateOfBirth);
          }
          // Create patient
          const patient = new Patient({ ...data });
          await patient.save();
          await logActivity(userId, "create", "patient", patient._id.toString(), data);
          successCount++;
        } catch (err: any) {
          errors.push(`Row ${i + 1}: ${err.message || "Unknown error"}`);
        }
      }
      res.json({ successCount, errors, message: `${successCount} patients imported. ${errors.length ? errors.length + ' errors.' : ''}` });
    } catch (error) {
      console.error("Bulk import error:", error);
      res.status(500).json({ message: "Failed to import patients" });
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

  app.put("/api/records/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const recordId = req.params.id;
      const record = await storage.getTreatmentRecord(recordId);
      if (!record) {
        return res.status(404).json({ message: "Treatment record not found" });
      }
      
      const updateData = insertTreatmentRecordSchema.parse(req.body);
      const updatedRecord = await storage.updateTreatmentRecord(recordId, updateData);
      
      await logActivity(
        userId,
        "update",
        "treatment_record",
        recordId.toString(),
        updateData,
      );
      
      res.json(updatedRecord);
    } catch (error) {
      console.error("Error updating treatment record:", error);
      res.status(500).json({ message: "Failed to update treatment record" });
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

      // Only admins and supervisors can view staff
      if (user?.role !== "admin" && user?.role !== "supervisor") {
        return res.status(403).json({ message: "Access denied" });
      }

      const staff = await storage.getStaff();
      
      // If supervisor, filter out admins
      if (user?.role === "supervisor") {
        const filteredStaff = staff.filter((member: any) => member.role !== "admin");
        await logActivity(userId, "view", "staff", "list");
        res.json(filteredStaff);
      } else {
        await logActivity(userId, "view", "staff", "list");
        res.json(staff);
      }
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

      // Only admins and supervisors can invite staff
      if (user?.role !== "admin" && user?.role !== "supervisor") {
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
      const validRoles = ["admin", "supervisor", "therapist", "staff", "frontdesk"];
      if (!validRoles.includes(role)) {
        console.log("Invalid role:", role);
        return res.status(400).json({
          message:
            "Invalid role. Must be one of: admin, supervisor, therapist, staff, frontdesk",
        });
      }

      // Supervisors cannot invite admins
      if (user?.role === "supervisor" && role === "admin") {
        return res.status(403).json({
          message: "Supervisors cannot invite administrators",
        });
      }

      // Supervisors cannot invite other supervisors
      if (user?.role === "supervisor" && role === "supervisor") {
        return res.status(403).json({
          message: "Supervisors cannot invite other supervisors",
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

      // Only admins and supervisors can delete staff
      if (user?.role !== "admin" && user?.role !== "supervisor") {
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

      // Supervisors cannot delete admins
      if (user?.role === "supervisor" && staff.role === "admin") {
        return res.status(403).json({ 
          message: "Supervisors cannot delete administrators" 
        });
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
          href: `/patients/${rec.patient?._id || rec.patientId}`,
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

  // Debug notification endpoint (no auth required)
  app.post(
    "/api/notifications/debug",
    async (req: any, res) => {
      try {
        const { userId, type, title, message, data } = req.body;
        
        console.log("🔍 Debug notification request:", { userId, type, title, message, data });

        const notification = await notificationService.createNotification(
          userId,
          type || 'patient_assigned',
          title || 'Debug Test Notification',
          message || 'This is a debug test notification',
          data
        );

        console.log("✅ Debug notification created:", notification);

        res.json({ 
          message: "Debug notification created", 
          notification 
        });
      } catch (error: any) {
        console.error("❌ Error creating debug notification:", error);
        res.status(500).json({ message: "Failed to create debug notification", error: error.message });
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

  // Reset (delete all) audit logs endpoint (admin only)
  app.post("/api/audit-logs/reset", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Access denied. Admin only." });
      }
      const db = Patient.db;
      const result = await db.collection("auditLogs").deleteMany({});
      res.json({ message: `All audit logs deleted (${result.deletedCount} logs).` });
    } catch (error) {
      console.error("Error resetting audit logs:", error);
      res.status(500).json({ message: "Failed to reset audit logs" });
    }
  });

  // Patient Notes API endpoints
  app.get("/api/patients/:id/notes", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = await storage.getUser(req.user.id);
      if (!user) { return res.status(404).json({ message: "User not found" }); }

      // Get all notes for this patient
      const allNotes = await PatientNote.find({ patientId: id })
        .sort({ createdAt: 1 })
        .lean();

      // Filter notes based on user permissions
      const filteredNotes = allNotes.filter((note) => {
        // General notes: visible to everyone
        if (!note.directedTo) return true;
        
        // Directed notes: only visible to recipient, author, or admin
        if (user.role === "admin") return true;
        if (note.authorId.toString() === user.id) return true;
        if (note.directedTo.toString() === user.id) return true;
        
        return false;
      });

      // Group notes by threads (parent notes and their replies)
      const groupedNotes = filteredNotes.reduce((acc: any, note) => {
        let threadKey;
        
        if (note.parentNoteId) {
          // This is a reply - group it with its parent
          threadKey = `thread_${note.parentNoteId}`;
        } else {
          // This is a parent note - create a new thread
          threadKey = note.directedTo ? `directed_${note.directedTo}` : 'general';
        }
        
        if (!acc[threadKey]) {
          acc[threadKey] = {
            threadId: threadKey,
            directedTo: note.directedTo,
            directedToName: note.directedToName,
            isGeneral: !note.directedTo,
            notes: []
          };
        }
        
        acc[threadKey].notes.push(note);
        return acc;
      }, {});

      // Convert to array and sort threads by most recent activity
      const threads = Object.values(groupedNotes).map((thread: any) => {
        // Sort notes within each thread by creation time
        thread.notes.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        return thread;
      });

      // Sort threads by most recent activity
      threads.sort((a: any, b: any) => {
        const aLatest = Math.max(...a.notes.map((n: any) => new Date(n.createdAt).getTime()));
        const bLatest = Math.max(...b.notes.map((n: any) => new Date(n.createdAt).getTime()));
        return bLatest - aLatest;
      });

      res.json(threads);
    } catch (error) {
      console.error("Error fetching notes:", error);
      res.status(500).json({ message: "Failed to fetch notes" });
    }
  });

  app.post("/api/patients/:id/notes", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { content, isPrivate = false, directedTo = null, directedToName = null, parentNoteId = null } = req.body;
      const user = await storage.getUser(req.user.id);
      if (!user) { return res.status(404).json({ message: "User not found" }); }
      if (user.role === "frontdesk") { return res.status(403).json({ message: "Front desk cannot add notes" }); }
      if (!content || content.trim().length === 0) { return res.status(400).json({ message: "Note content is required" }); }

      let finalDirectedTo = directedTo;
      let finalDirectedToName = directedToName;

      // If this is a reply, verify the parent note exists and inherit its directedTo
      if (parentNoteId) {
        const parentNote = await PatientNote.findOne({ 
          _id: parentNoteId, 
          patientId: id 
        });
        if (!parentNote) {
          return res.status(400).json({ message: "Parent note not found" });
        }
        
        // For replies, direct the response back to the original author
        finalDirectedTo = parentNote.authorId;
        finalDirectedToName = parentNote.authorName;
        
        console.log(`🔍 Reply inheritance debug:`, {
          parentNoteId: parentNoteId,
          parentAuthorId: parentNote.authorId,
          parentAuthorName: parentNote.authorName,
          finalDirectedTo: finalDirectedTo,
          finalDirectedToName: finalDirectedToName,
          currentUserId: user.id
        });
      }

      // Validate that the directedTo user exists (if specified)
      if (finalDirectedTo) {
        const targetUser = await storage.getUser(finalDirectedTo);
        if (!targetUser) {
          console.log(`⚠️ Warning: directedTo user ${finalDirectedTo} not found in database`);
          // Reset to null if user doesn't exist
          finalDirectedTo = null;
          finalDirectedToName = null;
        }
      }

      const note = new PatientNote({ 
        patientId: id, 
        authorId: user.id, 
        authorName: `${user.firstName} ${user.lastName}`, 
        content: content.trim(), 
        isPrivate, 
        directedTo: finalDirectedTo, 
        directedToName: finalDirectedToName,
        parentNoteId,
      });
      await note.save();

      console.log(`📝 Note created:`, {
        noteId: note._id,
        authorId: user.id,
        authorName: `${user.firstName} ${user.lastName}`,
        directedTo: finalDirectedTo,
        directedToName: finalDirectedToName,
        parentNoteId: parentNoteId,
        isReply: !!parentNoteId,
        content: content.trim().substring(0, 50) + '...'
      });

      // Create notification if note is directed to someone specific
      if (finalDirectedTo && finalDirectedTo !== user.id) {
        try {
          console.log(`🔔 Creating notification for reply:`, {
            recipientId: finalDirectedTo,
            authorId: user.id,
            authorName: `${user.firstName} ${user.lastName}`,
            isReply: !!parentNoteId,
            parentNoteId: parentNoteId
          });
          
          await notificationService.createNotification(
            finalDirectedTo,
            "directed_note",
            `New Note from ${user.firstName} ${user.lastName}`,
            `You have a new directed note for patient ${id}`,
            {
              patientId: id,
              noteId: note._id.toString(),
              authorName: `${user.firstName} ${user.lastName}`,
            },
            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
          );
        } catch (notificationError) {
          console.error("Failed to create notification for directed note:", notificationError);
          // Don't fail the note creation if notification fails
        }
      }

      await logActivity(user.id, "create_note", "note", note._id.toString(), { content: content.trim(), isPrivate, directedTo: finalDirectedTo, directedToName: finalDirectedToName, parentNoteId });
      res.status(201).json(note);
    } catch (error) {
      console.error("Error creating note:", error);
      res.status(500).json({ message: "Failed to create note" });
    }
  });

  app.put("/api/notes/:noteId", isAuthenticated, async (req: any, res) => {
    try {
      const { noteId } = req.params;
      const { content } = req.body;
      const user = await storage.getUser(req.user.id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const note = await PatientNote.findById(noteId);
      if (!note) {
        return res.status(404).json({ message: "Note not found" });
      }

      // Only author or admin can edit
      if (note.authorId.toString() !== user.id && user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized to edit this note" });
      }

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ message: "Note content is required" });
      }

      note.content = content.trim();
      await note.save();

      // Log activity
      await logActivity(user.id, "update_note", "note", note._id.toString(), {
        content: content.trim(),
      });

      res.json(note);
    } catch (error) {
      console.error("Error updating patient note:", error);
      res.status(500).json({ message: "Failed to update note" });
    }
  });

  app.delete("/api/notes/:noteId", isAuthenticated, async (req: any, res) => {
    try {
      const { noteId } = req.params;
      const user = await storage.getUser(req.user.id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const note = await PatientNote.findById(noteId);
      if (!note) {
        return res.status(404).json({ message: "Note not found" });
      }

      // Only author or admin can delete
      if (note.authorId.toString() !== user.id && user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized to delete this note" });
      }

      await PatientNote.findByIdAndDelete(noteId);

      // Log activity
      await logActivity(user.id, "delete_note", "note", note._id.toString());

      res.json({ message: "Note deleted successfully" });
    } catch (error) {
      console.error("Error deleting patient note:", error);
      res.status(500).json({ message: "Failed to delete note" });
    }
  });

  // Staff list endpoint for directed notes (accessible by admins, supervisors, and therapists)
  app.get("/api/staff/list", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      // Only admins, supervisors, and therapists can view staff list
      if (user?.role !== "admin" && user?.role !== "supervisor" && user?.role !== "therapist") {
        return res.status(403).json({ message: "Access denied" });
      }

      const staff = await storage.getStaff();
      
      // Return only basic info needed for directed notes
      const staffList = staff.map((member: any) => ({
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        role: member.role,
      }));

      console.log(`📋 Staff list for directed notes:`, staffList);

      // Validate that all staff members have valid IDs
      for (const member of staffList) {
        const user = await storage.getUser(member.id);
        if (!user) {
          console.log(`⚠️ Warning: Staff member ${member.firstName} ${member.lastName} has invalid ID: ${member.id}`);
        }
      }

      res.json(staffList);
    } catch (error) {
      console.error("Error fetching staff list:", error);
      res.status(500).json({ message: "Failed to fetch staff list" });
    }
  });

  // Get total note count for patient (admin only)
  app.get("/api/patients/:id/notes/count", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const user = await storage.getUser(req.user.id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Only admins can see total count
      if (user.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }

      const totalCount = await PatientNote.countDocuments({ patientId: id });
      res.json({ total: totalCount });
    } catch (error) {
      console.error("Error fetching note count:", error);
      res.status(500).json({ message: "Failed to fetch note count" });
    }
  });

  // Auto-cleanup old notes (older than 24 hours)
  app.post("/api/notes/cleanup", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Only admins can trigger cleanup
      if (user.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }

      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      
      const result = await PatientNote.deleteMany({
        createdAt: { $lt: oneDayAgo }
      });

      console.log(`🧹 Cleaned up ${result.deletedCount} old notes (older than 24 hours)`);

      // Log activity
      await logActivity(user.id, "cleanup_notes", "system", "notes_cleanup", {
        deletedCount: result.deletedCount,
        cutoffDate: oneDayAgo
      });

      res.json({ 
        message: `Cleaned up ${result.deletedCount} old notes`,
        deletedCount: result.deletedCount,
        cutoffDate: oneDayAgo
      });
    } catch (error) {
      console.error("Error cleaning up old notes:", error);
      res.status(500).json({ message: "Failed to cleanup old notes" });
    }
  });

  // Get cleanup statistics (admin only)
  app.get("/api/notes/cleanup-stats", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Only admins can see cleanup stats
      if (user.role !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }

      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const oldNotesCount = await PatientNote.countDocuments({
        createdAt: { $lt: oneDayAgo }
      });

      const totalNotesCount = await PatientNote.countDocuments({});

      res.json({
        oldNotesCount,
        totalNotesCount,
        cutoffDate: oneDayAgo,
        willBeCleaned: oldNotesCount
      });
    } catch (error) {
      console.error("Error fetching cleanup stats:", error);
      res.status(500).json({ message: "Failed to fetch cleanup stats" });
    }
  });

  // Close/Archive all threads for a patient (admin and therapists only)
  app.post("/api/patients/:patientId/notes/close-all", isAuthenticated, async (req: any, res) => {
    try {
      const { patientId } = req.params;
      const user = await storage.getUser(req.user.id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Only admins and therapists can close all threads
      if (user.role !== "admin" && user.role !== "therapist") {
        return res.status(403).json({ message: "Access denied" });
      }

      // Find all notes for the patient and mark them as archived
      const result = await PatientNote.updateMany(
        { 
          patientId: patientId,
          isArchived: { $ne: true } // Only archive non-archived notes
        },
        { 
          $set: { 
            isArchived: true,
            archivedAt: new Date(),
            archivedBy: user.id,
            archivedByName: `${user.firstName} ${user.lastName}`
          }
        }
      );

      console.log(`🔒 All threads closed for patient:`, {
        patientId,
        updatedCount: result.modifiedCount,
        closedBy: `${user.firstName} ${user.lastName}`,
        closedAt: new Date()
      });

      // Log activity
      await logActivity(user.id, "close_all_threads", "patient", patientId, {
        patientId,
        updatedCount: result.modifiedCount
      });

      res.json({ 
        message: `All threads closed successfully`,
        updatedCount: result.modifiedCount,
        patientId
      });
    } catch (error) {
      console.error("Error closing all threads:", error);
      res.status(500).json({ message: "Failed to close all threads" });
    }
  });

  // Auto-clear archived notes after 5 minutes
  app.post("/api/patients/:patientId/notes/clear-archived", isAuthenticated, async (req: any, res) => {
    try {
      const { patientId } = req.params;
      const user = await storage.getUser(req.user.id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Only admins and therapists can clear archived notes
      if (user.role !== "admin" && user.role !== "therapist") {
        return res.status(403).json({ message: "Access denied" });
      }

      // Find all archived notes for the patient and delete them
      const result = await PatientNote.deleteMany(
        { 
          patientId: patientId,
          isArchived: true
        }
      );

      console.log(`🗑️ Archived notes cleared for patient:`, {
        patientId,
        deletedCount: result.deletedCount,
        clearedBy: `${user.firstName} ${user.lastName}`,
        clearedAt: new Date()
      });

      // Log activity
      await logActivity(user.id, "clear_archived_notes", "patient", patientId, {
        patientId,
        deletedCount: result.deletedCount
      });

      res.json({ 
        message: `Archived notes cleared successfully`,
        deletedCount: result.deletedCount,
        patientId
      });
    } catch (error) {
      console.error("Error clearing archived notes:", error);
      res.status(500).json({ message: "Failed to clear archived notes" });
    }
  });

  // Get patient changes summary for front desk
  app.get("/api/patient-changes", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

          // Only front desk staff can access this
    if (user.role !== "frontdesk") {
      return res.status(403).json({ message: "Access denied" });
    }

      const { since, reset } = req.query;
      let startDate: Date;

      // If reset parameter is provided, use a shorter time range to show fresh data
      if (reset) {
        startDate = new Date(Date.now() - 60 * 60 * 1000); // Last 1 hour for refresh (increased from 10 minutes)
        console.log(`🔍 Patient changes debug - Reset requested, using 1 hour: ${startDate}`);
        console.log(`🔍 Patient changes debug - Current time: ${new Date()}`);
        console.log(`🔍 Patient changes debug - Time difference: ${Date.now() - startDate.getTime()} ms`);
      } else if (since === "last-login") {
        // Get user's last login from audit logs
        const lastLogin = await storage.db.collection("auditlogs").findOne(
          { 
            userId: user.id, 
            action: "login" 
          },
          { 
            sort: { createdAt: -1 },
            limit: 2 // Get second to last login (current login is the latest)
          }
        );
        
        if (lastLogin) {
          startDate = new Date(lastLogin.createdAt);
          console.log(`🔍 Patient changes debug - Last login found: ${startDate}`);
        } else {
          // If no previous login found, default to 7 days ago to show more recent changes
          startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          console.log(`🔍 Patient changes debug - No last login, using 7 days ago: ${startDate}`);
        }
      } else {
        // Use provided date or default to 7 days ago
        startDate = since ? new Date(since) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        console.log(`🔍 Patient changes debug - Using provided date: ${startDate}`);
      }

      const endDate = new Date();

      // Get new patients created
      const newPatients = await Patient.find({
        createdAt: { $gte: startDate, $lte: endDate }
      }).populate("createdBy", "firstName lastName");

      console.log(`🔍 Patient changes debug - New patients found: ${newPatients.length}`);

      // Get patients with status changes
      const statusChanges = await Patient.find({
        updatedAt: { $gte: startDate, $lte: endDate },
        $or: [
          { status: { $exists: true } },
          { assignedTherapistId: { $exists: true } },
          { important: { $exists: true } }
        ]
      }).populate("createdBy", "firstName lastName")
        .populate("assignedTherapistId", "firstName lastName");

      console.log(`🔍 Patient changes debug - Status changes found: ${statusChanges.length}`);
      statusChanges.forEach(patient => {
        console.log(`🔍 Patient changes debug - Patient: ${patient.firstName} ${patient.lastName}, Updated: ${patient.updatedAt}, Assigned: ${patient.assignedTherapistId ? 'Yes' : 'No'}`);
      });

      // Get audit logs for patient-related actions
      const patientActions = await storage.db.collection("auditlogs").find({
        createdAt: { $gte: startDate, $lte: endDate },
        resourceType: "patient",
        $or: [
          { action: "create" },
          { action: "update" },
          { action: "assign_therapist" },
          { action: "mark_important" }
        ]
      }).toArray();

      // Process and categorize changes
      const changes = {
        newPatients: newPatients.map(patient => ({
          id: patient._id,
          name: `${patient.firstName} ${patient.lastName}`,
          createdBy: patient.createdBy ? `${patient.createdBy.firstName} ${patient.createdBy.lastName}` : "Unknown",
          createdAt: patient.createdAt,
          status: patient.status,
          assignedTherapist: patient.assignedTherapistId ? `${(patient.assignedTherapistId as any).firstName} ${(patient.assignedTherapistId as any).lastName}` : null
        })),
        statusChanges: await Promise.all(statusChanges.filter(patient => {
          // Include patients that were updated within the time range (regardless of when they were created)
          const wasUpdatedInTimeRange = patient.updatedAt >= startDate;
          console.log(`🔍 Patient changes debug - ${patient.firstName} ${patient.lastName}: createdAt=${patient.createdAt}, updatedAt=${patient.updatedAt}, startDate=${startDate}, wasUpdatedInTimeRange=${wasUpdatedInTimeRange}`);
          return wasUpdatedInTimeRange;
        }).map(async (patient) => {
          // Find who made the most recent update for this patient from audit logs
          const patientAction = patientActions.find(log => 
            log.resourceId === patient._id.toString() && 
            log.action === "update" &&
            new Date(log.createdAt) >= startDate
          );
          
          // Get the user who made the change from audit logs
          let updatedBy = "Unknown";
          if (patientAction && patientAction.userId) {
            try {
              const user = await storage.getUser(patientAction.userId);
              if (user) {
                updatedBy = `${user.firstName} ${user.lastName}`;
              }
            } catch (error) {
              console.error(`Failed to get user for audit log: ${patientAction.userId}`, error);
            }
          } else if (patient.createdBy) {
            // Fallback to patient's createdBy field if audit log doesn't have user info
            try {
              const user = await storage.getUser(patient.createdBy);
              if (user) {
                updatedBy = `${user.firstName} ${user.lastName}`;
              }
            } catch (error) {
              console.error(`Failed to get user from patient createdBy: ${patient.createdBy}`, error);
            }
          }
          
          return {
            id: patient._id,
            name: `${patient.firstName} ${patient.lastName}`,
            status: patient.status,
            assignedTherapist: patient.assignedTherapistId ? `${(patient.assignedTherapistId as any).firstName} ${(patient.assignedTherapistId as any).lastName}` : null,
            important: patient.important,
            updatedAt: patient.updatedAt,
            updatedBy: updatedBy
          };
        })),
         therapistAssignments: await Promise.all(statusChanges.filter(patient => {
           const hasTherapist = !!patient.assignedTherapistId;
           console.log(`🔍 Therapist assignment debug - ${patient.firstName} ${patient.lastName}: hasTherapist=${hasTherapist}, assignedTherapistId=${patient.assignedTherapistId}`);
           return hasTherapist;
         }).map(async (patient) => {
           // Find who assigned the therapist
           const assignmentAction = patientActions.find(log => 
             log.resourceId === patient._id.toString() && 
             log.action === "assign_therapist" &&
             new Date(log.createdAt) >= startDate
           );
           
           // Get the user who assigned the therapist
           let assignedBy = "Unknown";
           if (assignmentAction && assignmentAction.userId) {
             try {
               const user = await storage.getUser(assignmentAction.userId);
               if (user) {
                 assignedBy = `${user.firstName} ${user.lastName}`;
               }
             } catch (error) {
               console.error(`Failed to get user for assignment: ${assignmentAction.userId}`, error);
             }
           } else if (patient.createdBy) {
             // Fallback to patient's createdBy field
             try {
               const user = await storage.getUser(patient.createdBy);
               if (user) {
                 assignedBy = `${user.firstName} ${user.lastName}`;
               }
             } catch (error) {
               console.error(`Failed to get user from patient createdBy: ${patient.createdBy}`, error);
             }
           }
           
           return {
             id: patient._id,
             name: `${patient.firstName} ${patient.lastName}`,
             therapist: patient.assignedTherapistId ? `${(patient.assignedTherapistId as any).firstName} ${(patient.assignedTherapistId as any).lastName}` : null,
             updatedAt: patient.updatedAt,
             assignedBy: assignedBy
           };
         })),
        importantUpdates: statusChanges.filter(patient => 
          patient.important && patient.createdAt < startDate
        ).map(patient => {
          // Find who marked the patient as important
          const importantAction = patientActions.find((log: any) => 
            log.resourceId === patient._id.toString() && 
            log.action === "mark_important" &&
            new Date(log.createdAt) >= startDate
          );
          
          return {
            id: patient._id,
            name: `${patient.firstName} ${patient.lastName}`,
            updatedAt: patient.updatedAt,
            markedBy: importantAction ? importantAction.userName || "Unknown" : "Unknown"
          };
        })
      };

      res.json({
        changes,
        summary: {
          newPatientsCount: changes.newPatients.length,
          statusChangesCount: changes.statusChanges.length,
          therapistAssignmentsCount: changes.therapistAssignments.length,
          importantUpdatesCount: changes.importantUpdates.length,
          totalChanges: changes.newPatients.length + changes.statusChanges.length + changes.therapistAssignments.length + changes.importantUpdates.length
        },
        dateRange: {
          start: startDate,
          end: endDate
        }
      });

      // Log the response for debugging
      if (reset) {
        console.log(`🔍 Patient changes debug - Reset response:`, {
          newPatientsCount: changes.newPatients.length,
          statusChangesCount: changes.statusChanges.length,
          therapistAssignmentsCount: changes.therapistAssignments.length,
          importantUpdatesCount: changes.importantUpdates.length,
          totalChanges: changes.newPatients.length + changes.statusChanges.length + changes.therapistAssignments.length + changes.importantUpdates.length,
          dateRange: {
            start: startDate,
            end: endDate
          }
        });
      }
    } catch (error) {
      console.error("Error fetching patient changes:", error);
      res.status(500).json({ message: "Failed to fetch patient changes" });
    }
  });

  // Staff update endpoint
  app.put("/api/staff/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      // Only admins and supervisors can update staff
      if (user?.role !== "admin" && user?.role !== "supervisor") {
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

      const { firstName, lastName, role } = req.body;

      // Validate required fields
      if (!firstName || !lastName || !role) {
        return res.status(400).json({
          message: "First name, last name, and role are required",
        });
      }

      // Validate role
      const validRoles = ["admin", "supervisor", "therapist", "staff", "frontdesk"];
      if (!validRoles.includes(role)) {
        return res.status(400).json({
          message: "Invalid role. Must be one of: admin, supervisor, therapist, staff, frontdesk",
        });
      }

      // Supervisors cannot change users to admin role
      if (user?.role === "supervisor" && role === "admin") {
        return res.status(403).json({
          message: "Supervisors cannot change users to administrator role",
        });
      }

      // Supervisors cannot change users to supervisor role
      if (user?.role === "supervisor" && role === "supervisor") {
        return res.status(403).json({
          message: "Supervisors cannot change users to supervisor role",
        });
      }

      // Supervisors cannot modify admin users
      if (user?.role === "supervisor" && staff.role === "admin") {
        return res.status(403).json({
          message: "Supervisors cannot modify administrator accounts",
        });
      }

      const updateData = {
        firstName,
        lastName,
        role,
      };

      const updatedUser = await storage.updateUser(staffId, updateData);
      await logActivity(userId, "update", "staff", staffId);

      res.json({
        message: "Staff member updated successfully",
        user: updatedUser,
      });
    } catch (error) {
      console.error("Error updating staff member:", error);
      res.status(500).json({ message: "Failed to update staff member" });
    }
  });

  // Catch-all route to serve React app for all non-API routes - only in production
  if (process.env.NODE_ENV === 'production') {
    app.get('*', (req, res) => {
      // Don't serve React app for API routes
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ message: 'API endpoint not found' });
      }
      
      // Serve the React app's index.html for all other routes
      res.sendFile(path.join(process.cwd(), 'dist/public/index.html'));
    });
  }

  const httpServer = createServer(app);
  return httpServer;
}
