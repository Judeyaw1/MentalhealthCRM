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
import { TreatmentOutcome } from "./models/TreatmentOutcome";

// Custom schema for MongoDB treatment records
const insertTreatmentRecordSchema = z.object({
  patientId: z.string().min(1, "Patient ID is required"),
  clinicalId: z.string().min(1, "Clinical ID is required"),
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
  clinicalId: z.string().min(1, "Clinical ID is required"),
  appointmentDate: z
    .union([z.date(), z.string()])
    .transform((val) => (typeof val === "string" ? new Date(val) : val)),
  duration: z.number().default(60),
  type: z.string().min(1, "Appointment type is required"),
  status: z.string().default("scheduled"),
  notes: z.string().optional(),
});

// Set up multer storage for uploads
const uploadDir = path.join(process.cwd(), "uploads");
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
  // Health check endpoint for Railway
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "healthy", 
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development"
    });
  });

  // Auth middleware
  await setupAuth(app);

  // Static file serving is now handled in the main server file
  
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

      const auditLog = await storage.createAuditLog(auditLogData);
      
      // Emit WebSocket event for real-time updates
      const io = (global as any).io;
      if (io && auditLog) {
        io.emit('audit_log_created', auditLog);
      }
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
      const clinicalId = user?.role === "clinical" ? userId : undefined;

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
        const clinicalId = user?.role === "clinical" ? userId : undefined;

        let patients;
        if (clinicalId) {
          patients = await storage.getPatientsByClinical(clinicalId);
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
        let clinicalId: string | undefined = undefined;
        let allowAll = false;
        if (user?.role === "clinical") {
          clinicalId = userId;
        } else if (user?.role === "admin" || user?.role === "supervisor") {
          allowAll = true;
        } else if (user?.role === "staff" || user?.role === "frontdesk") {
          // Staff and front desk cannot see any appointments
          return res.json([]);
        }

        const appointments = await storage.getTodayAppointments(allowAll ? undefined : clinicalId);
        res.json(appointments);
      } catch (error) {
        console.error("Error fetching today's appointments:", error);
        res
          .status(500)
          .json({ message: "Failed to fetch today's appointments" });
      }
    },
  );

  // Get archived patients (inactive and discharged)
  app.get("/api/patients/archived", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Only admin and supervisor can access archive
      if (user.role !== "admin" && user.role !== "supervisor") {
        return res.status(403).json({ message: "Access denied" });
      }

      const patients = await storage.getPatients(1000, 0, undefined, undefined, undefined, undefined, undefined, true);
      
      // Filter to only discharged patients (completed treatment)
      const archivedPatients = patients.patients.filter((patient: any) => 
        patient.status === "discharged"
      );

      res.json(archivedPatients);
    } catch (error) {
      console.error("Error fetching archived patients:", error);
      res.status(500).json({ message: "Failed to fetch archived patients" });
    }
  });

  // Restore patient from archive
  app.post("/api/patients/:id/restore", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Only admin and supervisor can restore patients
      if (user.role !== "admin" && user.role !== "supervisor") {
        return res.status(403).json({ message: "Only administrators and supervisors can restore patients" });
      }

      const patientId = req.params.id;
      const patient = await storage.getPatient(patientId);
      
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }

      // Only allow restoring inactive or discharged patients
      if (patient.status !== "inactive" && patient.status !== "discharged") {
        return res.status(400).json({ message: "Only inactive or discharged patients can be restored" });
      }

      // Restore patient by setting status to active
      const updatedPatient = await storage.updatePatient(patientId, {
        ...patient,
        status: "active",
        updatedAt: new Date(),
      });

      // Log the restore action
      await logActivity(req.user.id, "update", "patient", patientId, {
        action: "restore_from_archive",
        previousStatus: patient.status,
        newStatus: "active",
        restoredBy: `${user.firstName} ${user.lastName}`,
      });

      res.json(updatedPatient);
    } catch (error) {
      console.error("Error restoring patient:", error);
      res.status(500).json({ message: "Failed to restore patient" });
    }
  });

  // Patient routes
  app.get("/api/patients", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { limit = 50, offset = 0, search, status, createdBy, clinical, loc, unassignedOnly } = req.query;

      const result = await storage.getPatients(
        parseInt(limit as string),
        parseInt(offset as string),
        search as string,
        status as string,
        createdBy as string,
                  clinical as string,
        loc as string,
        false, // Don't include archived patients in main list
        unassignedOnly === "true"
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

  app.get("/api/patients/:id/appointments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const patientId = req.params.id;

      // Get user and check permissions
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      let clinicalId: string | undefined = undefined;
      let allowAll = false;
      if (user?.role === "clinical") {
        clinicalId = userId;
      } else if (user?.role === "admin") {
        allowAll = true;
      } else if (user?.role === "staff") {
        // Staff cannot see appointments
        return res.json([]);
      }

      // Get appointments specifically for this patient
      const appointments = await storage.getAppointments(
        allowAll ? undefined : clinicalId,
        patientId,
        undefined, // startDate
        undefined, // endDate
        undefined  // search
      );

      await logActivity(userId, "view", "patient_appointments", patientId);
      res.json(appointments);
    } catch (error) {
      console.error("Error fetching patient appointments:", error);
      res.status(500).json({ message: "Failed to fetch patient appointments" });
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
      
      // Sync emergency contact to miscellaneous if provided
      if (patientData.emergencyContact && patientData.emergencyContact.name) {
        try {
          const { PatientMiscellaneous } = await import("./models/PatientMiscellaneous");
          await PatientMiscellaneous.findOneAndUpdate(
            { patientId: patient.id.toString() },
            {
              $set: {
                emergencyContacts: [{
                  name: patientData.emergencyContact.name,
                  relationship: patientData.emergencyContact.relationship || "Emergency Contact",
                  phone: patientData.emergencyContact.phone || "",
                  email: "",
                  isPrimary: true
                }]
              }
            },
            { upsert: true }
          );
        } catch (syncError) {
          console.warn("Failed to sync emergency contact to miscellaneous:", syncError);
        }
      }
      
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

      // Get user and check permissions for patient updates
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if status is being updated and validate permissions
      if (updates.status) {
        // Only admin, supervisor, and front desk can change patient status
        if (user.role !== "admin" && user.role !== "supervisor" && user.role !== "frontdesk") {
          return res.status(403).json({ 
            message: "Only administrators, supervisors, and front desk staff can change patient status" 
          });
        }
      }

      // General permission check for patient updates
      // Allow: admin, supervisor, and clinicals for their assigned patients
      let canUpdate = 
        user.role === "admin" || 
        user.role === "supervisor";

      // Check if clinical is assigned to this patient
      if (user.role === "clinical") {
        const currentPatient = await Patient.findById(patientId as any);
        if (!currentPatient) {
          return res.status(404).json({ message: "Patient not found" });
        }

        // Check if clinical is assigned to this patient
        const isAssigned = currentPatient.assignedClinicalId && 
          currentPatient.assignedClinicalId.toString() === user.id.toString();
        
        if (isAssigned) {
          canUpdate = true;
  
        } else {
  
        }
      }



      if (canUpdate) {

      } else {

        return res.status(403).json({ 
          message: "NEW PERMISSION CHECK: You don't have permission to update patient information. Only administrators, supervisors, front desk staff, and assigned clinicals can update patients." 
        });
      }

      // Clean up ObjectId fields - convert empty strings to null
      const cleanedUpdates = {
        ...updates,
        assignedClinicalId:
          updates.assignedClinicalId === "" || !updates.assignedClinicalId
            ? null
            : updates.assignedClinicalId,
      };

      // Automatically set discharge date when status is changed to "discharged"
      console.log("🔍 Patient update - Status:", updates.status);
      console.log("🔍 Patient update - Updates object:", updates);
      if (updates.status === "discharged") {
        console.log("🔍 Setting automatic discharge date for patient:", patientId);
        const dischargeDate = new Date();
        // Set discharge date in the correct nested location according to the Patient model
        cleanedUpdates['dischargeCriteria.dischargeDate'] = dischargeDate;
        console.log("🔍 Discharge date set to:", cleanedUpdates['dischargeCriteria.dischargeDate']);
        console.log("🔍 Discharge date type:", typeof cleanedUpdates['dischargeCriteria.dischargeDate']);
        console.log("🔍 Discharge date value:", cleanedUpdates['dischargeCriteria.dischargeDate']);
      }
      console.log("🔍 Final cleanedUpdates object:", cleanedUpdates);
      console.log("🔍 About to call storage.updatePatient with:", JSON.stringify(cleanedUpdates, null, 2));
      
      const patient = await storage.updatePatient(patientId, cleanedUpdates);
      
      // Sync emergency contact to miscellaneous if it was updated
      if (updates.emergencyContact) {
        try {
          const { PatientMiscellaneous } = await import("./models/PatientMiscellaneous");
          const existingMisc = await PatientMiscellaneous.findOne({ patientId });
          
          if (existingMisc && existingMisc.emergencyContacts && existingMisc.emergencyContacts.length > 0) {
            // Update the primary contact if it exists
            const updatedContacts = existingMisc.emergencyContacts.map((contact, index) => 
              index === 0 ? {
                ...contact,
                name: updates.emergencyContact.name || contact.name,
                relationship: updates.emergencyContact.relationship || contact.relationship,
                phone: updates.emergencyContact.phone || contact.phone
              } : contact
            );
            
            await PatientMiscellaneous.findOneAndUpdate(
              { patientId },
              { $set: { emergencyContacts: updatedContacts } }
            );
          } else if (updates.emergencyContact.name) {
            // Create new emergency contact in miscellaneous
            await PatientMiscellaneous.findOneAndUpdate(
              { patientId },
              {
                $set: {
                  emergencyContacts: [{
                    name: updates.emergencyContact.name,
                    relationship: updates.emergencyContact.relationship || "Emergency Contact",
                    phone: updates.emergencyContact.phone || "",
                    email: "",
                    isPrimary: true
                  }]
                }
              },
              { upsert: true }
            );
          }
        } catch (syncError) {
          console.warn("Failed to sync emergency contact to miscellaneous:", syncError);
        }
      }
      
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
      console.error("Error details:", {
        message: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        patientId: req.params.id,
        updates: req.body
      });
      
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid patient data", errors: error.errors });
      }
      
      // Check for MongoDB validation errors
      if (error instanceof Error && error.message.includes("validation failed")) {
        return res.status(400).json({ 
          message: "Patient data validation failed", 
          error: error.message 
        });
      }
      
      res.status(500).json({ message: "Failed to update patient" });
    }
  });

  // Archive patient endpoint (admin/supervisor only)
  app.patch("/api/patients/:id/archive", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const patientId = req.params.id;
      const { status = "inactive" } = req.body; // Default to inactive, can be "discharged"

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Only admin and supervisor can archive patients
      if (user.role !== "admin" && user.role !== "supervisor") {
        return res.status(403).json({ message: "Only administrators and supervisors can archive patients" });
      }

      const patient = await storage.getPatient(patientId);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }

      // Allow archiving any patient (active, inactive, or discharged)
      // This provides flexibility for admin/supervisor to manage patient status

      await storage.archivePatient(patientId, status);
      await logActivity(userId, "archive", "patient", patientId.toString(), {
        previousStatus: patient.status,
        newStatus: status,
        archivedBy: userId,
        archivedByRole: user.role
      });

      res.json({ message: "Patient archived successfully" });
    } catch (error) {
      console.error("Error archiving patient:", error);
      let errorMessage = "Failed to archive patient";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      res.status(500).json({ message: errorMessage });
    }
  });

  // Bulk archive patients endpoint
  app.post("/api/patients/bulk-archive", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { patientIds, status = "inactive" } = req.body;
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!Array.isArray(patientIds) || patientIds.length === 0) {
        return res.status(400).json({ message: "No patient IDs provided" });
      }

      // Only admin and supervisor can bulk archive patients
      if (user.role !== "admin" && user.role !== "supervisor") {
        return res.status(403).json({ message: "Only administrators and supervisors can archive patients" });
      }

      const results = [];
      for (const id of patientIds) {
        try {
          await storage.archivePatient(id, status);
          await logActivity(userId, "archive", "patient", id.toString(), {
            newStatus: status,
            archivedBy: userId,
            archivedByRole: user.role
          });
          results.push({ id, success: true });
        } catch (error) {
          let message = "Failed to archive patient";
          if (error instanceof Error) {
            message = error.message;
          }
          results.push({ id, success: false, message });
        }
      }
      const failed = results.filter(r => !r.success);
      if (failed.length > 0) {
        return res.status(207).json({
          message: `Some patients could not be archived`,
          results,
        });
      }
      res.json({ message: "All selected patients archived successfully", results });
    } catch (error) {
      console.error("Bulk archive error:", error);
      res.status(500).json({ message: "Failed to archive patients" });
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
      
      for (let i = 0; i < patients.length; i++) {
        const data = patients[i];
        try {
          
          // Basic validation: require firstName, lastName, dateOfBirth (email is optional)
          if (!data.firstName || !data.lastName || !data.dateOfBirth) {
            const missingFields = [];
            if (!data.firstName) missingFields.push('firstName');
            if (!data.lastName) missingFields.push('lastName');
            if (!data.dateOfBirth) missingFields.push('dateOfBirth');
            errors.push(`Row ${i + 1}: Missing required fields: ${missingFields.join(', ')}`);
            continue;
          }
          // Parse dateOfBirth if needed
          if (typeof data.dateOfBirth === "string") {
            data.dateOfBirth = new Date(data.dateOfBirth);
          }
          
          // Clean and validate data
          const cleanedData = {
            ...data,
            // Set default values for optional fields
            status: data.status === "active" || data.status === "inactive" || data.status === "discharged" ? data.status : "active",
            hipaaConsent: data.hipaaConsent === "true" || data.hipaaConsent === true || data.hipaaConsent === "1",
            loc: data.loc || "3.3",
            important: data.important === "true" || data.important === true || data.important === "1",
            // Clean phone numbers (remove extensions and format)
            phone: data.phone ? data.phone.replace(/x\d+$/, '').replace(/[^\d-]/g, '').substring(0, 15) : undefined,
            // Clean email
            email: data.email ? data.email.trim() : undefined,
            // Clean address
            address: data.address ? data.address.trim() : undefined,
            // Clean insurance
            insurance: data.insurance ? data.insurance.trim() : undefined,
            // Clean reasonForVisit
            reasonForVisit: data.reasonForVisit ? data.reasonForVisit.trim() : undefined,
            // Clean SSN (remove non-alphanumeric characters)
            ssn: data.ssn ? data.ssn.replace(/[^\w-]/g, '') : undefined,
            // Clean authNumber
            authNumber: data.authNumber ? data.authNumber.trim() : undefined,
            // Clean URLs
            insuranceCardUrl: data.insuranceCardUrl ? data.insuranceCardUrl.trim() : undefined,
            photoUrl: data.photoUrl ? data.photoUrl.trim() : undefined,
            // Clean treatment goals and discharge criteria
            treatmentGoals: data.treatmentGoals ? data.treatmentGoals.trim() : undefined,
            dischargeCriteria: data.dischargeCriteria ? data.dischargeCriteria.trim() : undefined,
            // Map emergency contact fields from flat structure to nested structure
            emergencyContact: {
              name: data.emergencyContactName ? data.emergencyContactName.trim() : undefined,
              relationship: data.emergencyContactRelationship ? data.emergencyContactRelationship.trim() : undefined,
              phone: data.emergencyContactPhone ? data.emergencyContactPhone.replace(/x\d+$/, '').replace(/[^\d-]/g, '').substring(0, 15) : undefined,
            },
            // Map assignedTherapistId to assignedClinicalId for backward compatibility
            assignedClinicalId: data.assignedClinicalId || data.assignedTherapistId,
          };

          // Remove the old flat emergency contact fields to avoid conflicts
          delete (cleanedData as any).emergencyContactName;
          delete (cleanedData as any).emergencyContactRelationship;
          delete (cleanedData as any).emergencyContactPhone;
          delete (cleanedData as any).assignedTherapistId;
          
          // Validate that status is a valid enum value
          if (cleanedData.status && !["active", "inactive", "discharged"].includes(cleanedData.status)) {
            errors.push(`Row ${i + 1}: Invalid status value "${cleanedData.status}". Must be "active", "inactive", or "discharged".`);
            continue;
          }
          
          // Create patient with createdBy field
          const patient = new Patient({
            ...cleanedData,
            createdBy: userId
          });
          await patient.save();
          await logActivity(userId, "create", "patient", patient._id.toString(), data);
          successCount++;
        } catch (err: any) {
          console.error(`Error creating patient in row ${i + 1}:`, err);
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
        "Assigned Clinical": patient.assignedClinical ? `${patient.assignedClinical.firstName} ${patient.assignedClinical.lastName}` : "",
        "Emergency Contact": patient.emergencyContact ? `${patient.emergencyContact.name} (${patient.emergencyContact.phone})` : "",
        "Created Date": new Date(patient.createdAt).toLocaleDateString(),
        "Last Updated": new Date(patient.updatedAt).toLocaleDateString(),
      }));

      // Helper function to calculate age
      const getAge = (dateOfBirth: string | number | Date) => {
        const today = new Date();
        const birthDate = new Date(dateOfBirth);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        return age;
      };

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
          'Assigned Clinical',
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
          `"${row['Assigned Clinical']}"`,
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
        clinicalId,
        sessionType,
        startDate,
        endDate,
      } = req.query;

              // If clinical, only show their records
        const clinicalFilter = user?.role === "clinical" ? userId : clinicalId;

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
              if (clinicalFilter) query.clinicalId = String(Array.isArray(clinicalFilter) ? clinicalFilter[0] : clinicalFilter);
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

      // Check if patient is archived
      const patient = await storage.getPatient(recordData.patientId);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }

      if (patient.status === 'inactive' || patient.status === 'discharged') {
        return res.status(400).json({ 
          message: `Cannot create treatment record for archived patient. Patient status: ${patient.status}. Please restore the patient first.` 
        });
      }

      const record = await storage.createTreatmentRecord(recordData);



      // Safely get the record ID for logging
      const recordId = record._id ? record._id.toString() : "unknown";
      await logActivity(
        userId,
        "create",
        "treatment_record",
        recordId,
        recordData,
      );

      // Emit WebSocket event for real-time updates
      const io = (global as any).io;
      if (io && record) {
        io.emit('treatment_record_created', record);
      }

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
      
      // Check if patient is archived
      const currentRecord = await storage.getTreatmentRecord(recordId);
      if (currentRecord) {
        const patient = await storage.getPatient(currentRecord.patientId);
        if (patient && (patient.status === 'inactive' || patient.status === 'discharged')) {
          return res.status(400).json({ 
            message: `Cannot update treatment record for archived patient. Patient status: ${patient.status}. Please restore the patient first.` 
          });
        }
      }
      
      const record = await storage.updateTreatmentRecord(recordId, updates);
      await logActivity(
        userId,
        "update",
        "treatment_record",
        recordId,
        updates,
      );

      // Emit WebSocket event for real-time updates
      const io = (global as any).io;
      if (io && record) {
        io.emit('treatment_record_updated', record);
      }

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
        recordId,
      );

      // Emit WebSocket event for real-time updates
      const io = (global as any).io;
      if (io && record) {
        io.emit('treatment_record_deleted', record);
      }

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
        recordId,
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

      let clinicalId: string | undefined = undefined;
      let allowAll = false;
      if (user?.role === "clinical") {
        clinicalId = userId;
      } else if (user?.role === "admin") {
        allowAll = true;
      } else if (user?.role === "staff") {
        // Staff cannot see any appointments
        return res.json([]);
      }

      let appointments = await storage.getAppointments(
        allowAll ? undefined : clinicalId,
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

  // Manual appointment status update endpoint (for testing)
  app.post("/api/appointments/update-statuses", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      // Only admins can manually trigger status updates
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Only admins can trigger status updates" });
      }

      const { AppointmentStatusService } = await import('./appointmentStatusService');
      const updatedCount = await AppointmentStatusService.updateAppointmentStatuses();
      
      await logActivity(userId, "trigger", "appointment_status_update", "manual");
      
      res.json({ 
        message: "Appointment statuses updated successfully", 
        updatedCount 
      });
    } catch (error) {
      console.error("Error updating appointment statuses:", error);
      res.status(500).json({ message: "Failed to update appointment statuses" });
    }
  });

  app.post("/api/appointments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      const appointmentData = insertAppointmentSchema.parse(req.body);

      // Check if patient is archived
      const patient = await storage.getPatient(appointmentData.patientId);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }

      if (patient.status === 'inactive' || patient.status === 'discharged') {
        return res.status(400).json({ 
          message: `Cannot create appointment for archived patient. Patient status: ${patient.status}. Please restore the patient first.` 
        });
      }

      const appointment = await storage.createAppointment({
        ...appointmentData,
        createdBy: userId
      });
      await logActivity(
        userId,
        "create",
        "appointment",
        appointment._id.toString(),
        appointmentData,
      );

      // Emit WebSocket event for real-time updates
      const io = (global as any).io;
      if (io && appointment) {
        io.emit('appointment_created', appointment);
      }

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

      // Get current appointment to check status
      const currentAppointment = await storage.getAppointment(appointmentId);
      if (!currentAppointment) {
        return res.status(404).json({ message: "Appointment not found" });
      }

      // Check if patient is archived
      const patient = await storage.getPatient(currentAppointment.patientId);
      if (patient && (patient.status === 'inactive' || patient.status === 'discharged')) {
        return res.status(400).json({ 
          message: `Cannot update appointment for archived patient. Patient status: ${patient.status}. Please restore the patient first.` 
        });
      }

      // Validate status transitions
      if (updates.status) {
        const currentStatus = currentAppointment.status;
        const newStatus = updates.status;

        // Prevent cancelling completed appointments
        if (newStatus === "cancelled" && currentStatus === "completed") {
          return res.status(400).json({ 
            message: "Cannot cancel a completed appointment" 
          });
        }

        // Prevent marking cancelled appointments as completed
        if (newStatus === "completed" && currentStatus === "cancelled") {
          return res.status(400).json({ 
            message: "Cannot mark a cancelled appointment as completed" 
          });
        }
      }

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

      // Send notification for status changes
      if (updates.status && currentAppointment.status !== updates.status && appointment) {
        const user = await storage.getUser(userId);
        const { notificationService } = await import("./notificationService");
        
        await notificationService.sendAppointmentStatusChangeNotification({
          appointmentId,
          patientName: appointment.patient?.firstName && appointment.patient?.lastName 
            ? `${appointment.patient.firstName} ${appointment.patient.lastName}` 
            : "Unknown Patient",
                  clinicalName: appointment.clinical?.firstName && appointment.clinical?.lastName
          ? `${appointment.clinical.firstName} ${appointment.clinical.lastName}`
          : "Unknown Clinical",
          appointmentDate: appointment.appointmentDate,
          oldStatus: currentAppointment.status,
          newStatus: updates.status,
          changedBy: userId,
          changedByName: user ? `${user.firstName} ${user.lastName}` : "Unknown User",
        });
      }

      // Emit WebSocket event for real-time updates
      const io = (global as any).io;
      if (io && appointment) {
        io.emit('appointment_updated', appointment);
      }

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



        const deletedAppointment =
          await storage.deleteAppointment(appointmentId);


        if (!deletedAppointment) {
          return res.status(404).json({ message: "Appointment not found" });
        }

        await logActivity(userId, "delete", "appointment", appointmentId);
        
        // Emit WebSocket event for real-time updates
        const io = (global as any).io;
        if (io && deletedAppointment) {
          io.emit('appointment_deleted', deletedAppointment);
        }
        

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


      const { email, firstName, lastName, role, message } = req.body;

      // Validate required fields
      if (!email || !firstName || !lastName || !role) {

        return res.status(400).json({
          message: "Email, first name, last name, and role are required",
        });
      }

      // Validate role
      const validRoles = ["admin", "supervisor", "clinical", "staff", "frontdesk"];
      if (!validRoles.includes(role)) {

        return res.status(400).json({
          message:
            "Invalid role. Must be one of: admin, supervisor, clinical, staff, frontdesk",
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

        return res.status(400).json({
          message: "A user with this email already exists",
        });
      }

      // Generate a secure default password
      const defaultPassword = generateSecurePassword();



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

      // Emit WebSocket event for real-time updates
      const io = (global as any).io;
      if (io && newUser) {
        io.emit('staff_created', newUser);
      }

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


      // Handle validation errors specifically
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid data provided",
          errors: error.errors,
        });
      }

      // Handle Mongoose validation errors
      if (error.name === "ValidationError") {
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

      // Emit WebSocket event for real-time updates
      const io = (global as any).io;
      if (io && staff) {
        io.emit('staff_deleted', staff);
      }

      res.json({ message: "Staff member deleted successfully" });
    } catch (error) {
      console.error("Error deleting staff member:", error);
      res.status(500).json({ message: "Failed to delete staff member" });
    }
  });

  // Get clinicals endpoint
  app.get("/api/clinicals", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const clinicals = await storage.getClinicals();
      
      await logActivity(userId, "view", "clinicals", "list");
      res.json(clinicals);
    } catch (error) {
      console.error("Error fetching clinicals:", error);
      res.status(500).json({ message: "Failed to fetch clinicals" });
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

        // Only admins and supervisors can reset passwords
        if (admin?.role !== "admin" && admin?.role !== "supervisor") {
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



        const updatedUser = await storage.updateUser(userId, updateData);

        if (!updatedUser) {
          return res.status(500).json({ message: "Failed to update profile" });
        }



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

      if (!q || q.length < 2) {
        return res.json([]);
      }

      // Helper function to calculate age
      const getAge = (dateOfBirth: string | number | Date) => {
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
      };

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

      // Combine and return
      const results = [...patients, ...appointments, ...records];
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

  // Unique logins details endpoint
  app.get('/api/audit-logs/unique-logins-details', isAuthenticated, async (req, res) => {
    try {
      const days = req.query.days ? parseInt(req.query.days) : 7;
      const match: any = { action: 'login' };
      if (days) {
        const since = new Date();
        since.setDate(since.getDate() - days);
        match.timestamp = { $gte: since };
      }
      
      // Get login logs with user details
      const loginLogs = await storage.db.collection('auditLogs').find(match).toArray();
      
      // Get unique user IDs and their latest login time
      const userLoginMap = new Map();
      loginLogs.forEach((log: any) => {
        if (!userLoginMap.has(log.userId) || new Date(log.timestamp) > new Date(userLoginMap.get(log.userId).timestamp)) {
          userLoginMap.set(log.userId, {
            userId: log.userId,
            timestamp: log.timestamp,
            ipAddress: log.ipAddress || 'Unknown'
          });
        }
      });

      // Get user details for each unique login
      const users = await storage.getStaff();
      const adminIds = users.filter((u: any) => u.role === 'admin').map((u: any) => u.id);
      
      const uniqueLogins = Array.from(userLoginMap.values())
        .filter((login: any) => !adminIds.includes(login.userId))
        .map((login: any) => {
          const user = users.find((u: any) => u.id === login.userId);
          return {
            userId: login.userId,
            firstName: user?.firstName || 'Unknown',
            lastName: user?.lastName || 'Unknown',
            email: user?.email || 'Unknown',
            role: user?.role || 'Unknown',
            lastLogin: login.timestamp,
            ipAddress: login.ipAddress
          };
        })
        .sort((a: any, b: any) => new Date(b.lastLogin).getTime() - new Date(a.lastLogin).getTime());

      res.json({ users: uniqueLogins });
    } catch (error) {
      console.error('Error fetching unique logins details:', error);
      res.status(500).json({ message: 'Failed to fetch unique logins details' });
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

      // Only allow access if user is admin, the record's clinical, or the record's patient's assigned clinical
      const canAccess = user?.role === "admin" || 
                       record.clinical?.id === userId ||
                       (record.patient && record.patient.assignedClinicalId?.toString() === userId);

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
          // Emit WebSocket event for real-time updates
          const io = (global as any).io;
          if (io) {
            io.emit('notification_read', { notificationId: id, userId });
          }
          
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
        


        const notification = await notificationService.createNotification(
          userId,
          type || 'patient_assigned',
          title || 'Debug Test Notification',
          message || 'This is a debug test notification',
          data
        );



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
      
      // Role-based access control for chat functionality
      const allowedRoles = ['admin', 'supervisor', 'clinical'];
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ 
          message: "Access denied. Only admin, supervisor, and clinical roles can access chat functionality." 
        });
      }

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

      // Group notes by conversation threads
      const groupedNotes = filteredNotes.reduce((acc: any, note) => {
        let threadKey;
        
        if (note.directedTo) {
          // Directed note - create chat with specific person
          const authorId = note.authorId;
          const directedToId = note.directedTo;
          
          // Always create a consistent thread key for the conversation between these two people
          // This ensures all messages between the same two people go to the same thread
          const sortedIds = [authorId, directedToId].sort();
          threadKey = `chat_${sortedIds[0]}_${sortedIds[1]}`;
        } else {
          // General note - create general chat thread
          threadKey = 'general_chat';
        }
        

        
        if (!acc[threadKey]) {
          acc[threadKey] = {
            threadId: threadKey,
            directedTo: note.directedTo,
            directedToName: note.directedToName,
            isGeneral: !note.directedTo,
            isChat: true,
            chatWith: note.directedTo ? note.directedToName : 'General Chat',
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
      
      // Role-based access control for chat functionality
      const allowedRoles = ['admin', 'supervisor', 'clinical'];
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ 
          message: "Access denied. Only admin, supervisor, and clinical roles can use chat functionality." 
        });
      }
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
        
        // For replies, keep the same chat thread (don't change directedTo)
        finalDirectedTo = parentNote.directedTo;
        finalDirectedToName = parentNote.directedToName;
        

      }

      // Validate that the directedTo user exists (if specified)
      if (finalDirectedTo) {
        const targetUser = await storage.getUser(finalDirectedTo);
        if (!targetUser) {

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



      // Create notification if note is directed to someone specific
      if (finalDirectedTo && finalDirectedTo !== user.id) {
        try {

          
          const notification = await notificationService.createNotification(
            finalDirectedTo,
            "directed_note",
            `New message from ${user.firstName} ${user.lastName}`,
            `${content.trim().substring(0, 100)}${content.trim().length > 100 ? '...' : ''}`,
            {
              patientId: id,
              noteId: note._id.toString(),
              authorName: `${user.firstName} ${user.lastName}`,
              messageContent: content.trim(),
            },
            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
          );

          // Emit WebSocket event for real-time notification updates
          const io = (global as any).io;
          if (io && notification) {
            io.emit('notification_created', notification);
          }
        } catch (notificationError) {
          console.error("Failed to create notification for directed note:", notificationError);
          // Don't fail the note creation if notification fails
        }
      }

      await logActivity(user.id, "create_note", "note", note._id.toString(), { content: content.trim(), isPrivate, directedTo: finalDirectedTo, directedToName: finalDirectedToName, parentNoteId });
      
      // Emit WebSocket event for real-time updates
      const io = (global as any).io;
      if (io) {

        
        io.to(`patient_${id}`).emit('note_created', {
          note,
          patientId: id,
          authorId: user.id,
          authorName: `${user.firstName} ${user.lastName}`,
          directedTo: finalDirectedTo,
          directedToName: finalDirectedToName,
          parentNoteId
        });
        
        console.log(`✅ Note created event emitted to patient_${id}`);
      } else {
        console.log(`❌ No WebSocket io instance available`);
      }
      
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
      
      // Role-based access control for chat functionality
      const allowedRoles = ['admin', 'supervisor', 'clinical'];
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ 
          message: "Access denied. Only admin, supervisor, and clinical roles can use chat functionality." 
        });
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

      // Emit WebSocket event for real-time updates
      const io = (global as any).io;
      if (io) {
        io.to(`patient_${note.patientId}`).emit('note_updated', {
          note,
          patientId: note.patientId,
          authorId: user.id,
          authorName: `${user.firstName} ${user.lastName}`,
          content: content.trim()
        });
      }

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
      
      // Role-based access control for chat functionality
      const allowedRoles = ['admin', 'supervisor', 'clinical'];
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ 
          message: "Access denied. Only admin, supervisor, and clinical roles can use chat functionality." 
        });
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

      // Emit WebSocket event for real-time updates
      const io = (global as any).io;
      if (io) {
        io.to(`patient_${note.patientId}`).emit('note_deleted', {
          noteId,
          patientId: note.patientId,
          authorId: user.id,
          authorName: `${user.firstName} ${user.lastName}`
        });
      }

      res.json({ message: "Note deleted successfully" });
    } catch (error) {
      console.error("Error deleting patient note:", error);
      res.status(500).json({ message: "Failed to delete note" });
    }
  });

        // Staff list endpoint for directed notes (accessible by admins, supervisors, and clinicals)
  app.get("/api/staff/list", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      // Only admins, supervisors, and clinicals can view staff list
      if (user?.role !== "admin" && user?.role !== "supervisor" && user?.role !== "clinical") {
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

        // Close/Archive all threads for a patient (admin and clinicals only)
  app.post("/api/patients/:patientId/notes/close-all", isAuthenticated, async (req: any, res) => {
    try {
      const { patientId } = req.params;
      const user = await storage.getUser(req.user.id);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Only admins, supervisors, and clinicals can close all threads
      if (user.role !== "admin" && user.role !== "supervisor" && user.role !== "clinical") {
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

      // Only admins, supervisors, and clinicals can clear archived notes
      if (user.role !== "admin" && user.role !== "supervisor" && user.role !== "clinical") {
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
        } else {
          // If no previous login found, default to 7 days ago to show more recent changes
          startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        }
      } else {
        // Use provided date or default to 7 days ago
        startDate = since ? new Date(since) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      }

      const endDate = new Date();

      // Get new patients created
      const newPatients = await Patient.find({
        createdAt: { $gte: startDate, $lte: endDate }
      }).populate("createdBy", "firstName lastName");

      // Get patients with status changes
      const statusChanges = await Patient.find({
        updatedAt: { $gte: startDate, $lte: endDate },
        $or: [
          { status: { $exists: true } },
          { assignedClinicalId: { $exists: true } },
          { important: { $exists: true } }
        ]
      }).populate("createdBy", "firstName lastName")
        .populate("assignedClinicalId", "firstName lastName");

      // Get audit logs for patient-related actions
      const patientActions = await storage.db.collection("auditlogs").find({
        createdAt: { $gte: startDate, $lte: endDate },
        resourceType: "patient",
        $or: [
          { action: "create" },
          { action: "update" },
          { action: "assign_clinical" },
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
          assignedClinical: patient.assignedClinicalId ? `${(patient.assignedClinicalId as any).firstName} ${(patient.assignedClinicalId as any).lastName}` : null
        })),
        statusChanges: await Promise.all(statusChanges.filter(patient => {
          // Include patients that were updated within the time range (regardless of when they were created)
          const wasUpdatedInTimeRange = patient.updatedAt >= startDate;
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
            assignedClinical: patient.assignedClinicalId ? `${(patient.assignedClinicalId as any).firstName} ${(patient.assignedClinicalId as any).lastName}` : null,
            important: patient.important,
            updatedAt: patient.updatedAt,
            updatedBy: updatedBy
          };
        })),
         clinicalAssignments: await Promise.all(statusChanges.filter(patient => {
           const hasClinical = !!patient.assignedClinicalId;
           return hasClinical;
         }).map(async (patient) => {
           // Find who assigned the clinical
           const assignmentAction = patientActions.find(log => 
             log.resourceId === patient._id.toString() && 
             log.action === "assign_clinical" &&
             new Date(log.createdAt) >= startDate
           );
           
           // Get the user who assigned the clinical
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
             clinical: patient.assignedClinicalId ? `${(patient.assignedClinicalId as any).firstName} ${(patient.assignedClinicalId as any).lastName}` : null,
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
          clinicalAssignmentsCount: changes.clinicalAssignments.length,
          importantUpdatesCount: changes.importantUpdates.length,
          totalChanges: changes.newPatients.length + changes.statusChanges.length + changes.clinicalAssignments.length + changes.importantUpdates.length
        },
        dateRange: {
          start: startDate,
          end: endDate
        }
      });


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
      const validRoles = ["admin", "supervisor", "clinical", "staff", "frontdesk"];
      if (!validRoles.includes(role)) {
        return res.status(400).json({
          message: "Invalid role. Must be one of: admin, supervisor, clinical, staff, frontdesk",
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

  // Assessment role check middleware
  const canPerformAssessment = (req: any, res: any, next: any) => {
    const userRole = req.user?.role;
    const allowedRoles = ['admin', 'supervisor', 'clinical'];
    
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ 
        message: "Access denied. Only admin, supervisor, and clinical roles can perform assessments." 
      });
    }
    
    next();
  };

  // Assessment routes
  app.post("/api/patients/:patientId/assessments", isAuthenticated, canPerformAssessment, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const patientId = req.params.patientId;
      
      if (!mongoose.Types.ObjectId.isValid(patientId)) {
        return res.status(400).json({ message: "Invalid patient ID format" });
      }

      const patient = await storage.getPatient(patientId);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }

      const {
        presentingProblem,
        medicalHistory,
        psychiatricHistory,
        familyHistory,
        socialHistory,
        mentalStatus,
        riskAssessment,
        diagnosis,
        impressions,
        followUpDate,
        followUpNotes,
      } = req.body;

      // Validate required fields
      if (!presentingProblem || !impressions) {
        return res.status(400).json({
          message: "Presenting problem and impressions are required",
        });
      }

      const assessment = {
        patientId,
        presentingProblem,
        medicalHistory,
        psychiatricHistory,
        familyHistory,
        socialHistory,
        mentalStatus,
        riskAssessment,
        diagnosis,
        impressions,
        followUpDate,
        followUpNotes,
        status: "in_progress",
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const savedAssessment = await storage.createAssessment(assessment);
      await logActivity(userId, "create", "assessment", savedAssessment.id);

      res.status(201).json({
        message: "Assessment created successfully",
        assessment: savedAssessment,
      });
    } catch (error) {
      console.error("Error creating assessment:", error);
      res.status(500).json({ message: "Failed to create assessment" });
    }
  });

  app.get("/api/patients/:patientId/assessments", isAuthenticated, canPerformAssessment, async (req: any, res) => {
    try {
      const patientId = req.params.patientId;
      
      if (!mongoose.Types.ObjectId.isValid(patientId)) {
        return res.status(400).json({ message: "Invalid patient ID format" });
      }

      const patient = await storage.getPatient(patientId);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }

      const assessments = await storage.getAssessments(patientId);
      res.json(assessments);
    } catch (error) {
      console.error("Error fetching assessments:", error);
      res.status(500).json({ message: "Failed to fetch assessments" });
    }
  });

  app.patch("/api/assessments/:assessmentId", isAuthenticated, canPerformAssessment, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const assessmentId = req.params.assessmentId;
      
      if (!mongoose.Types.ObjectId.isValid(assessmentId)) {
        return res.status(400).json({ message: "Invalid assessment ID format" });
      }

      const assessment = await storage.getAssessment(assessmentId);
      if (!assessment) {
        return res.status(404).json({ message: "Assessment not found" });
      }

      const updateData = {
        ...req.body,
        updatedAt: new Date(),
      };

      const updatedAssessment = await storage.updateAssessment(assessmentId, updateData);
      await logActivity(userId, "update", "assessment", assessmentId);

      res.json({
        message: "Assessment updated successfully",
        assessment: updatedAssessment,
      });
    } catch (error) {
      console.error("Error updating assessment:", error);
      res.status(500).json({ message: "Failed to update assessment" });
    }
  });

  app.delete("/api/assessments/:assessmentId", isAuthenticated, canPerformAssessment, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const assessmentId = req.params.assessmentId;
      
      if (!mongoose.Types.ObjectId.isValid(assessmentId)) {
        return res.status(400).json({ message: "Invalid assessment ID format" });
      }

      const assessment = await storage.getAssessment(assessmentId);
      if (!assessment) {
        return res.status(404).json({ message: "Assessment not found" });
      }

      await storage.deleteAssessment(assessmentId);
      await logActivity(userId, "delete", "assessment", assessmentId);

      res.json({ message: "Assessment deleted successfully" });
    } catch (error) {
      console.error("Error deleting assessment:", error);
      res.status(500).json({ message: "Failed to delete assessment" });
    }
  });



  // Note: Catch-all route for SPA is now handled in the main server file
  // to ensure proper static file serving order

  // Get patient demographics for reports
  app.get("/api/reports/demographics", isAuthenticated, async (req: any, res) => {
    try {
      const patients = await storage.getPatients(1000, 0, undefined, undefined, undefined, undefined, undefined, true);
      
      // Calculate age groups
      const ageGroups = {
        "18-25": 0,
        "26-35": 0,
        "36-45": 0,
        "46-55": 0,
        "55+": 0
      };

      // Calculate gender distribution
      const genderDistribution = {
        "male": 0,
        "female": 0,
        "non-binary": 0,
        "other": 0
      };

      // Calculate level of care distribution
      const locDistribution = {
        "2.1": 0,
        "3.1": 0,
        "3.3": 0,
        "0.0": 0,
        "unassigned": 0
      };

      // Calculate insurance distribution
      const insuranceDistribution: { [key: string]: number } = {};

      // Calculate status distribution
      const statusDistribution = {
        "active": 0,
        "inactive": 0,
        "discharged": 0
      };

      // Calculate geographic distribution (by first letter of address for privacy)
      const geographicDistribution: { [key: string]: number } = {};

      // Calculate treatment duration (for discharged patients)
      const treatmentDurations: number[] = [];

      let totalPatients = 0;
      let totalAge = 0;
      let validAgeCount = 0;

      patients.patients.forEach((patient: any) => {
        totalPatients++;
        
        // Calculate age accurately (same as frontend)
        if (patient.dateOfBirth) {
          try {
            const today = new Date();
            const birthDate = new Date(patient.dateOfBirth);
            
            // Validate birth date is not in the future
            if (birthDate > today) {
              console.warn(`Future birth date for patient ${patient.id}: ${patient.dateOfBirth}`);
            } else {
              // Calculate accurate age
              let age = today.getFullYear() - birthDate.getFullYear();
              const monthDiff = today.getMonth() - birthDate.getMonth();
              
              // Adjust age if birthday hasn't occurred yet this year
              if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
              }
              
              // Validate reasonable age range (0-120 years)
              if (age >= 0 && age <= 120) {
                console.log(`✅ Valid age for patient ${patient.id}: ${age} years (birth: ${patient.dateOfBirth})`);
                totalAge += age;
                validAgeCount++;
                
                // Age group categorization
                if (age >= 18 && age <= 25) ageGroups["18-25"]++;
                else if (age >= 26 && age <= 35) ageGroups["26-35"]++;
                else if (age >= 36 && age <= 45) ageGroups["36-45"]++;
                else if (age >= 46 && age <= 55) ageGroups["46-55"]++;
                else if (age > 55) ageGroups["55+"]++;
              } else {
                console.warn(`❌ Unreasonable age calculated for patient ${patient.id}: ${age} years (birth date: ${patient.dateOfBirth})`);
              }
            }
          } catch (error) {
            console.warn(`❌ Error calculating age for patient ${patient.id}: ${patient.dateOfBirth}`, error);
          }
        }

        // Gender distribution
        if (patient.gender) {
          const gender = patient.gender.toLowerCase();
          if (gender === "male" || gender === "female" || gender === "non-binary") {
            genderDistribution[gender]++;
          } else {
            genderDistribution["other"]++;
          }
        }

        // Level of care distribution
        if (patient.loc) {
          if (locDistribution.hasOwnProperty(patient.loc)) {
            locDistribution[patient.loc]++;
          } else {
            locDistribution["unassigned"]++;
          }
        } else {
          locDistribution["unassigned"]++;
        }

        // Insurance distribution
        if (patient.insurance) {
          const insurance = patient.insurance.trim();
          insuranceDistribution[insurance] = (insuranceDistribution[insurance] || 0) + 1;
        }

        // Status distribution
        if (patient.status) {
          statusDistribution[patient.status]++;
        }

        // Geographic distribution (first letter of address for privacy)
        if (patient.address) {
          const firstLetter = patient.address.charAt(0).toUpperCase();
          geographicDistribution[firstLetter] = (geographicDistribution[firstLetter] || 0) + 1;
        }

        // Treatment duration for discharged patients
        if (patient.status === "discharged" && patient.createdAt && patient.updatedAt) {
          const createdDate = new Date(patient.createdAt);
          const dischargedDate = new Date(patient.updatedAt);
          const durationInDays = Math.round((dischargedDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
          if (durationInDays > 0) {
            treatmentDurations.push(durationInDays);
          }
        }
      });

      // Calculate averages
      const averageAge = validAgeCount > 0 ? Math.round(totalAge / validAgeCount) : 0;
      const averageTreatmentDuration = treatmentDurations.length > 0 
        ? Math.round(treatmentDurations.reduce((a, b) => a + b, 0) / treatmentDurations.length)
        : 0;

      // Get top insurance providers
      const topInsuranceProviders = Object.entries(insuranceDistribution)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([provider, count]) => ({ provider, count }));

      // Get top geographic areas
      const topGeographicAreas = Object.entries(geographicDistribution)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([area, count]) => ({ area, count }));

      const demographics = {
        totalPatients,
        averageAge,
        averageAgeDetails: {
          average: averageAge,
          totalAge,
          validAgeCount,
          patientsWithValidAge: validAgeCount,
          patientsWithoutAge: totalPatients - validAgeCount
        },
        averageTreatmentDuration,
        ageGroups,
        genderDistribution,
        locDistribution,
        statusDistribution,
        topInsuranceProviders,
        topGeographicAreas,
        treatmentDurations: {
          average: averageTreatmentDuration,
          min: treatmentDurations.length > 0 ? Math.min(...treatmentDurations) : 0,
          max: treatmentDurations.length > 0 ? Math.max(...treatmentDurations) : 0,
          distribution: {
            "0-30 days": treatmentDurations.filter(d => d <= 30).length,
            "31-60 days": treatmentDurations.filter(d => d > 30 && d <= 60).length,
            "61-90 days": treatmentDurations.filter(d => d > 60 && d <= 90).length,
            "90+ days": treatmentDurations.filter(d => d > 90).length
          }
        }
      };

      res.json(demographics);
    } catch (error) {
      console.error("Error fetching demographics:", error);
      res.status(500).json({ message: "Failed to fetch demographics data" });
    }
  });

  // Get appointment analytics for reports
  app.get("/api/reports/appointment-analytics", isAuthenticated, async (req: any, res) => {
    try {
      const appointments = await storage.getAppointments();
      
      // Calculate basic metrics
      const totalAppointments = appointments.length;
      const today = new Date();
      const todayAppointments = appointments.filter(apt => {
        const aptDate = new Date(apt.appointmentDate);
        return aptDate.toDateString() === today.toDateString();
      }).length;

      // Calculate status distribution
      const statusDistribution = {
        "scheduled": 0,
        "completed": 0,
        "cancelled": 0,
        "no-show": 0
      };

      // Calculate monthly trends (last 12 months)
      const monthlyTrends: { [key: string]: number } = {};
      const currentMonth = new Date();
      for (let i = 0; i < 12; i++) {
        const month = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - i, 1);
        const monthKey = month.toISOString().slice(0, 7); // YYYY-MM format
        monthlyTrends[monthKey] = 0;
      }

      // Calculate day of week distribution
      const dayOfWeekDistribution = {
        "Sunday": 0,
        "Monday": 0,
        "Tuesday": 0,
        "Wednesday": 0,
        "Thursday": 0,
        "Friday": 0,
        "Saturday": 0
      };

      // Calculate time slot preferences
      const timeSlotDistribution: { [key: string]: number } = {};

      // Calculate clinical utilization
      const clinicalUtilization: { [key: string]: number } = {};

      // Calculate session duration analysis
      const sessionDurations: number[] = [];
      let totalDuration = 0;

      // Calculate no-show rate
      let noShowCount = 0;
      let completedCount = 0;

      appointments.forEach((appointment: any) => {
        // Status distribution
        if (statusDistribution.hasOwnProperty(appointment.status)) {
          statusDistribution[appointment.status]++;
        }

        // Monthly trends
        const aptDate = new Date(appointment.appointmentDate);
        const monthKey = aptDate.toISOString().slice(0, 7);
        if (monthlyTrends.hasOwnProperty(monthKey)) {
          monthlyTrends[monthKey]++;
        }

        // Day of week
        const dayName = aptDate.toLocaleDateString('en-US', { weekday: 'long' });
        if (dayOfWeekDistribution.hasOwnProperty(dayName)) {
          dayOfWeekDistribution[dayName]++;
        }

        // Time slot (hour)
        const hour = aptDate.getHours();
        const timeSlot = `${hour}:00`;
        timeSlotDistribution[timeSlot] = (timeSlotDistribution[timeSlot] || 0) + 1;

        // Clinical utilization
        if (appointment.clinicalId) {
          const clinicalId = appointment.clinicalId.toString();
          clinicalUtilization[clinicalId] = (clinicalUtilization[clinicalId] || 0) + 1;
        }

        // Session duration
        if (appointment.duration) {
          sessionDurations.push(appointment.duration);
          totalDuration += appointment.duration;
        }

        // No-show and completion rates
        if (appointment.status === "no-show") {
          noShowCount++;
        } else if (appointment.status === "completed") {
          completedCount++;
        }
      });

      // Calculate averages and rates
      const averageSessionDuration = sessionDurations.length > 0 
        ? Math.round(totalDuration / sessionDurations.length)
        : 0;

      const noShowRate = totalAppointments > 0 
        ? ((noShowCount / totalAppointments) * 100).toFixed(1)
        : "0.0";

      const completionRate = totalAppointments > 0 
        ? ((completedCount / totalAppointments) * 100).toFixed(1)
        : "0.0";

      // Get upcoming appointments (next 30 days)
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(today.getDate() + 30);
      const upcomingAppointments = appointments.filter(apt => {
        const aptDate = new Date(apt.appointmentDate);
        return aptDate >= today && aptDate <= thirtyDaysFromNow && apt.status === "scheduled";
      }).length;

      // Get top time slots
      const topTimeSlots = Object.entries(timeSlotDistribution)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([time, count]) => ({ time, count }));

      // Get top clinicals
      const topClinicals = Object.entries(clinicalUtilization)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([clinicalId, count]) => ({ clinicalId, count }));

      // Calculate session type distribution
      const sessionTypeDistribution: { [key: string]: number } = {};
      appointments.forEach((apt: any) => {
        const type = apt.type || "Unknown";
        sessionTypeDistribution[type] = (sessionTypeDistribution[type] || 0) + 1;
      });

      const analytics = {
        totalAppointments,
        todayAppointments,
        upcomingAppointments,
        averageSessionDuration,
        noShowRate: parseFloat(noShowRate),
        completionRate: parseFloat(completionRate),
        statusDistribution,
        monthlyTrends,
        dayOfWeekDistribution,
        topTimeSlots,
        topClinicals,
        sessionTypeDistribution,
        sessionDurations: {
          average: averageSessionDuration,
          min: sessionDurations.length > 0 ? Math.min(...sessionDurations) : 0,
          max: sessionDurations.length > 0 ? Math.max(...sessionDurations) : 0,
          distribution: {
            "30 min": sessionDurations.filter(d => d === 30).length,
            "45 min": sessionDurations.filter(d => d === 45).length,
            "60 min": sessionDurations.filter(d => d === 60).length,
            "90 min": sessionDurations.filter(d => d === 90).length,
            "120+ min": sessionDurations.filter(d => d > 120).length
          }
        }
      };

      res.json(analytics);
    } catch (error) {
      console.error("Error fetching appointment analytics:", error);
      res.status(500).json({ message: "Failed to fetch appointment analytics data" });
    }
  });

  // Get treatment completion rate analytics for reports
  app.get("/api/reports/treatment-completion", isAuthenticated, async (req: any, res) => {
    try {
      const patientsResult = await storage.getPatients(1000, 0, undefined, undefined, undefined, undefined, undefined, true);
      const patients = (patientsResult.patients || []) as any[];
      const treatmentRecords = await storage.getAllTreatmentRecords();
      
      // Calculate completion metrics
      const totalPatients = patients.length;
      const dischargedPatients = patients.filter(p => p.status === 'discharged').length;
      const activePatients = patients.filter(p => p.status === 'active').length;
      const inactivePatients = patients.filter(p => p.status === 'inactive').length;
      
      // Calculate treatment completion rate
      const completionRate = totalPatients > 0 ? ((dischargedPatients / totalPatients) * 100).toFixed(1) : "0.0";
      
      // Calculate average length of stay for discharged patients
      const dischargedWithDates = patients.filter(p => p.status === 'discharged' && p.createdAt && p.updatedAt);
      const totalLOS = dischargedWithDates.reduce((sum, patient) => {
        const created = new Date(patient.createdAt);
        const discharged = new Date(patient.updatedAt);
        const los = Math.ceil((discharged.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        return sum + los;
      }, 0);
      const averageLOS = dischargedWithDates.length > 0 ? Math.round(totalLOS / dischargedWithDates.length) : 0;
      
      // Calculate treatment record completion
      const totalRecords = treatmentRecords.length;
      const completedRecords = treatmentRecords.filter(r => r.status === 'completed').length;
      const inProgressRecords = treatmentRecords.filter(r => r.status === 'in-progress').length;
      const pendingRecords = treatmentRecords.filter(r => r.status === 'pending').length;
      
      const recordCompletionRate = totalRecords > 0 ? ((completedRecords / totalRecords) * 100).toFixed(1) : "0.0";
      
      // Calculate treatment goals completion
      const patientsWithGoals = (patients as any[]).filter(p => p.treatmentGoals && p.treatmentGoals.length > 0);
      const totalGoals = patientsWithGoals.reduce((sum, patient) => {
        return sum + (patient.treatmentGoals?.length || 0);
      }, 0);
      
      const completedGoals = patientsWithGoals.reduce((sum, patient) => {
        return sum + (patient.treatmentGoals?.filter(goal => goal.status === 'completed').length || 0);
      }, 0);
      
      const goalCompletionRate = totalGoals > 0 ? ((completedGoals / totalGoals) * 100).toFixed(1) : "0.0";
      
      // Calculate monthly discharge trends
      const monthlyDischarges: { [key: string]: number } = {};
      const currentMonth = new Date();
      for (let i = 0; i < 12; i++) {
        const month = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - i, 1);
        const monthKey = month.toISOString().slice(0, 7);
        monthlyDischarges[monthKey] = 0;
      }
      
      dischargedWithDates.forEach(patient => {
        const dischargeDate = new Date(patient.updatedAt);
        const monthKey = dischargeDate.toISOString().slice(0, 7);
        if (monthlyDischarges.hasOwnProperty(monthKey)) {
          monthlyDischarges[monthKey]++;
        }
      });
      
      // Calculate treatment duration distribution
      const treatmentDurations = dischargedWithDates.map(patient => {
        const created = new Date(patient.createdAt);
        const discharged = new Date(patient.updatedAt);
        return Math.ceil((discharged.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
      });
      
      const durationDistribution = {
        "0-30 days": treatmentDurations.filter(d => d <= 30).length,
        "31-60 days": treatmentDurations.filter(d => d > 30 && d <= 60).length,
        "61-90 days": treatmentDurations.filter(d => d > 60 && d <= 90).length,
        "91-180 days": treatmentDurations.filter(d => d > 90 && d <= 180).length,
        "180+ days": treatmentDurations.filter(d => d > 180).length
      };
      
      const analytics = {
        totalPatients,
        dischargedPatients,
        activePatients,
        inactivePatients,
        completionRate: parseFloat(completionRate),
        averageLOS,
        totalRecords,
        completedRecords,
        inProgressRecords,
        pendingRecords,
        recordCompletionRate: parseFloat(recordCompletionRate),
        totalGoals,
        completedGoals,
        goalCompletionRate: parseFloat(goalCompletionRate),
        monthlyDischarges,
        durationDistribution,
        treatmentDurations: {
          average: averageLOS,
          min: treatmentDurations.length > 0 ? Math.min(...treatmentDurations) : 0,
          max: treatmentDurations.length > 0 ? Math.max(...treatmentDurations) : 0,
          total: treatmentDurations.length
        }
      };
      
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching treatment completion analytics:", error);
      res.status(500).json({ message: "Failed to fetch treatment completion data" });
    }
  });

  // Get staff performance analytics for reports
  app.get("/api/reports/staff-performance", isAuthenticated, async (req: any, res) => {
    try {
      const users = await storage.getStaff();
      const appointments = await storage.getAppointments();
      const treatmentRecords = await storage.getAllTreatmentRecords();
      const patientsResult = await storage.getPatients(1000, 0, undefined, undefined, undefined, undefined, undefined, true);
      const patients = (patientsResult.patients || []) as any[];
      
      // Filter only staff members (non-admin users)
      const staffMembers = users.filter(user => user.role !== 'admin');
      
      // Calculate staff performance metrics
      const staffPerformance = staffMembers.map(staff => {
                // Get appointments for this staff member (only if clinicalId exists and matches)
        const staffAppointments = appointments.filter(apt => {
          return apt.clinicalId &&
            apt.clinicalId.toString() === (staff as any)._id?.toString();
        });
        const completedAppointments = staffAppointments.filter(apt => apt.status === 'completed');
        const cancelledAppointments = staffAppointments.filter(apt => apt.status === 'cancelled');
        const noShowAppointments = staffAppointments.filter(apt => apt.status === 'no-show');
        
                // Get treatment records for this staff member (only if clinicalId exists and matches)
        const staffRecords = treatmentRecords.filter(record => {
          return record.clinicalId &&
            record.clinicalId.toString() === (staff as any)._id?.toString();
        });
        const completedRecords = staffRecords.filter(record => record.status === 'completed');
        
        // Get patients assigned to this staff member (only if assignedClinicalId exists and matches)
        const assignedPatients = (patients as any[]).filter(patient => {
          return patient.assignedClinicalId && 
                 patient.assignedClinicalId.toString() === (staff as any)._id?.toString();
        });
        const dischargedPatients = assignedPatients.filter(patient => patient.status === 'discharged');
        

        
        // Calculate metrics
        const appointmentCompletionRate = staffAppointments.length > 0 
          ? ((completedAppointments.length / staffAppointments.length) * 100).toFixed(1)
          : "0.0";
          
        const recordCompletionRate = staffRecords.length > 0
          ? ((completedRecords.length / staffRecords.length) * 100).toFixed(1)
          : "0.0";
          
        const patientDischargeRate = assignedPatients.length > 0
          ? ((dischargedPatients.length / assignedPatients.length) * 100).toFixed(1)
          : "0.0";
        
        // Calculate average session duration
        const sessionDurations = completedAppointments
          .filter(apt => apt.duration && typeof apt.duration === 'number' && !isNaN(apt.duration))
          .map(apt => apt.duration);
        const averageSessionDuration = sessionDurations.length > 0
          ? Math.round(sessionDurations.reduce((sum, duration) => sum + duration, 0) / sessionDurations.length)
          : 0;
        
        // Calculate monthly performance
        const currentMonth = new Date();
        const monthKey = currentMonth.toISOString().slice(0, 7);
        const monthlyAppointments = staffAppointments.filter(apt => {
          try {
            if (!apt.dateTime) return false;
            const aptDate = new Date(apt.dateTime);
            // Check if the date is valid
            if (isNaN(aptDate.getTime())) return false;
            return aptDate.toISOString().slice(0, 7) === monthKey;
          } catch (error) {
            // Skip appointments with invalid dates
            return false;
          }
        }).length;
        
        return {
          staffId: (staff as any)._id,
          firstName: staff.firstName,
          lastName: staff.lastName,
          email: staff.email,
          role: staff.role,
          totalAppointments: staffAppointments.length,
          completedAppointments: completedAppointments.length,
          cancelledAppointments: cancelledAppointments.length,
          noShowAppointments: noShowAppointments.length,
          appointmentCompletionRate: parseFloat(appointmentCompletionRate),
          totalRecords: staffRecords.length,
          completedRecords: completedRecords.length,
          recordCompletionRate: parseFloat(recordCompletionRate),
          assignedPatients: assignedPatients.length,
          dischargedPatients: dischargedPatients.length,
          patientDischargeRate: parseFloat(patientDischargeRate),
          averageSessionDuration,
          monthlyAppointments
        };
      });
      
      // Calculate overall staff statistics
      const totalStaff = staffMembers.length;
      const totalStaffAppointments = staffPerformance.reduce((sum, staff) => sum + staff.totalAppointments, 0);
      const totalStaffRecords = staffPerformance.reduce((sum, staff) => sum + staff.totalRecords, 0);
      const totalStaffPatients = staffPerformance.reduce((sum, staff) => sum + staff.assignedPatients, 0);
      
      const averageAppointmentCompletionRate = totalStaff > 0
        ? (staffPerformance.reduce((sum, staff) => sum + staff.appointmentCompletionRate, 0) / totalStaff).toFixed(1)
        : "0.0";
        
      const averageRecordCompletionRate = totalStaff > 0
        ? (staffPerformance.reduce((sum, staff) => sum + staff.recordCompletionRate, 0) / totalStaff).toFixed(1)
        : "0.0";
        
      const averagePatientDischargeRate = totalStaff > 0
        ? (staffPerformance.reduce((sum, staff) => sum + staff.patientDischargeRate, 0) / totalStaff).toFixed(1)
        : "0.0";
      
      // Get top performers
      const topAppointmentPerformers = staffPerformance
        .sort((a, b) => b.appointmentCompletionRate - a.appointmentCompletionRate)
        .slice(0, 5);
        
      const topRecordPerformers = staffPerformance
        .sort((a, b) => b.recordCompletionRate - a.recordCompletionRate)
        .slice(0, 5);
        
      const topPatientDischargers = staffPerformance
        .sort((a, b) => b.patientDischargeRate - a.patientDischargeRate)
        .slice(0, 5);
      
      const analytics = {
        totalStaff,
        totalStaffAppointments,
        totalStaffRecords,
        totalStaffPatients,
        averageAppointmentCompletionRate: parseFloat(averageAppointmentCompletionRate),
        averageRecordCompletionRate: parseFloat(averageRecordCompletionRate),
        averagePatientDischargeRate: parseFloat(averagePatientDischargeRate),
        staffPerformance,
        topAppointmentPerformers,
        topRecordPerformers,
        topPatientDischargers
      };
      
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching staff performance analytics:", error);
      console.error("Stack trace:", error.stack);
      res.status(500).json({ message: "Failed to fetch staff performance data", error: error.message });
    }
  });

  // Patient report endpoint for comprehensive patient information
  app.get("/api/patients/:id/report", isAuthenticated, async (req: any, res) => {
    // Disable caching for reports to ensure fresh data
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    try {
      const { id } = req.params;
      const { user } = req;

      // Check if user has access to this patient - use direct DB query for fresh data
      const patient = await Patient.findById(id).populate('assignedClinicalId');
      if (!patient) {
        return res.status(404).json({ error: "Patient not found" });
      }
      
      // Debug: Check what patient data we have
      console.log("🔍 Report endpoint - Patient data (direct DB query):", {
        patientId: patient.id,
        status: patient.status,
        dischargeDate: patient.dischargeCriteria?.dischargeDate,
        dischargeDateType: typeof patient.dischargeCriteria?.dischargeDate,
        hasDischargeDate: !!patient.dischargeCriteria?.dischargeDate,
        fullPatient: patient
      });

      // Get all related data for the patient
      const [
        appointments,
        treatmentRecords,
        treatmentOutcomesResult,
        patientNotes
      ] = await Promise.all([
        storage.getAppointments(undefined, id),
        storage.getPatientTreatmentRecords(id),
        storage.getPatientTreatmentOutcomes(id),
        storage.getPatientNotes(id)
      ]);

      // Extract outcomes array from the result object with defensive programming
      const treatmentOutcomes = (treatmentOutcomesResult && treatmentOutcomesResult.outcomes) || [];
      
      // Debug logging for data structure
      console.log("🔍 Report data structure:", {
        appointments: appointments?.length || 0,
        treatmentRecords: treatmentRecords?.length || 0,
        treatmentOutcomesResult: treatmentOutcomesResult ? 'exists' : 'null',
        treatmentOutcomes: treatmentOutcomes?.length || 0,
        patientNotes: patientNotes?.length || 0
      });

      // Calculate statistics with defensive programming
      const totalSessions = (appointments && appointments.length) || 0;
      const completedSessions = appointments ? appointments.filter(apt => apt && apt.status === 'completed').length : 0;
      const attendanceRate = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

      // Calculate average scores from treatment outcomes with defensive programming
      const averageMoodScore = treatmentOutcomes && treatmentOutcomes.length > 0 
        ? Math.round(treatmentOutcomes.reduce((sum, outcome) => {
            if (!outcome) return sum;
            const score = outcome.moodState === 'stable' ? 5 : outcome.moodState === 'elevated' ? 8 : outcome.moodState === 'low' ? 3 : outcome.moodState === 'depressed' ? 2 : outcome.moodState === 'anxious' ? 4 : 5;
            return sum + score;
          }, 0) / treatmentOutcomes.length * 10) / 10
        : 0;
      
      const averageAnxietyScore = treatmentOutcomes && treatmentOutcomes.length > 0 
        ? Math.round(treatmentOutcomes.reduce((sum, outcome) => sum + (outcome && outcome.anxietyScore ? outcome.anxietyScore : 0), 0) / treatmentOutcomes.length * 10) / 10
        : 0;
      
      const averageDepressionScore = treatmentOutcomes && treatmentOutcomes.length > 0 
        ? Math.round(treatmentOutcomes.reduce((sum, outcome) => sum + (outcome && outcome.depressionScore ? outcome.depressionScore : 0), 0) / treatmentOutcomes.length * 10) / 10
        : 0;

      // Calculate goal achievement and functional improvement rates with defensive programming
      const goalAchievementRate = treatmentOutcomes && treatmentOutcomes.length > 0 
        ? Math.round(treatmentOutcomes.reduce((sum, outcome) => {
            if (!outcome) return sum;
            const score = outcome.goalProgress === 'achieved' ? 100 : outcome.goalProgress === 'exceeded' ? 120 : outcome.goalProgress === 'progressing' ? 75 : outcome.goalProgress === 'beginning' ? 25 : 0;
            return sum + score;
          }, 0) / treatmentOutcomes.length)
        : 0;
      
      const functionalImprovementRate = treatmentOutcomes && treatmentOutcomes.length > 0 
        ? Math.round(treatmentOutcomes.reduce((sum, outcome) => {
            if (!outcome) return sum;
            const score = outcome.dailyFunctioning === 'excellent' ? 100 : outcome.dailyFunctioning === 'good' ? 80 : outcome.dailyFunctioning === 'fair' ? 60 : outcome.dailyFunctioning === 'poor' ? 40 : outcome.dailyFunctioning === 'severe' ? 20 : 0;
            return sum + score;
          }, 0) / treatmentOutcomes.length)
        : 0;

      const reportData = {
        patient: {
          id: patient.id,
          firstName: patient.firstName,
          lastName: patient.lastName,
          dateOfBirth: patient.dateOfBirth,
          gender: patient.gender,
          email: patient.email,
          phone: patient.phone,
          address: patient.address,
          insurance: patient.insurance,
          reasonForVisit: patient.reasonForVisit,
          authNumber: patient.authNumber,
          loc: patient.loc,
          status: patient.status,
          hipaaConsent: patient.hipaaConsent,
          important: patient.important,
          createdAt: patient.createdAt,
          dischargeCriteria: patient.dischargeCriteria || {
            targetSessions: 12,
            autoDischarge: false,
            dischargeDate: patient.dischargeCriteria?.dischargeDate
          },
          assignedClinical: patient.assignedClinicalId && typeof patient.assignedClinicalId === 'object' && 'firstName' in patient.assignedClinicalId && 'lastName' in patient.assignedClinicalId && 'email' in patient.assignedClinicalId ? {
            firstName: patient.assignedClinicalId.firstName,
            lastName: patient.assignedClinicalId.lastName,
            email: patient.assignedClinicalId.email
          } : undefined
        },
        appointments: (appointments || []).map(apt => ({
          id: apt?.id || 'unknown',
          date: apt?.date || '',
          time: apt?.time || '',
          status: apt?.status || 'unknown',
          notes: apt?.notes || '',
          clinical: {
            firstName: apt?.clinical?.firstName || 'Unknown',
            lastName: apt?.clinical?.lastName || 'Clinical'
          }
        })),
        treatmentRecords: (treatmentRecords || []).map(record => ({
          id: record?._id?.toString() || record?._id || 'unknown',
          assessmentDate: record?.sessionDate || '',
          symptoms: [], // Not available in current model
          moodScore: 0, // Not available in current model
          anxietyScore: 0, // Not available in current model
          depressionScore: 0, // Not available in current model
          functionalScore: 0, // Not available in current model
          riskLevel: 'Unknown', // Not available in current model
          notes: record?.notes || '',
          clinical: {
            firstName: record?.clinicalId && typeof record.clinicalId === 'object' && 'firstName' in record.clinicalId ? record.clinicalId.firstName : 'Unknown',
            lastName: record?.clinicalId && typeof record.clinicalId === 'object' && 'lastName' in record.clinicalId ? record.clinicalId.lastName : 'Clinical'
          }
        })),
        treatmentOutcomes: (treatmentOutcomes || []).map(outcome => ({
          id: outcome?._id?.toString() || outcome?._id || 'unknown',
          assessmentDate: outcome?.assessmentDate || '',
          symptomScores: {
            anxiety: outcome?.anxietyScore || 0,
            depression: outcome?.depressionScore || 0,
            stress: outcome?.stressScore || 0,
            sleep: 0, // Not available in current model
            social: outcome?.socialEngagement === 'very_active' ? 10 : outcome?.socialEngagement === 'active' ? 8 : outcome?.socialEngagement === 'moderate' ? 6 : outcome?.socialEngagement === 'limited' ? 4 : outcome?.socialEngagement === 'isolated' ? 2 : 0
          },
          moodRating: outcome?.moodState === 'stable' ? 5 : outcome?.moodState === 'elevated' ? 8 : outcome?.moodState === 'low' ? 3 : outcome?.moodState === 'depressed' ? 2 : outcome?.moodState === 'anxious' ? 4 : 5,
          goalAchievement: outcome?.goalProgress === 'achieved' ? 100 : outcome?.goalProgress === 'exceeded' ? 120 : outcome?.goalProgress === 'progressing' ? 75 : outcome?.goalProgress === 'beginning' ? 25 : 0,
          functionalImprovement: outcome?.dailyFunctioning === 'excellent' ? 100 : outcome?.dailyFunctioning === 'good' ? 80 : outcome?.dailyFunctioning === 'fair' ? 60 : outcome?.dailyFunctioning === 'poor' ? 40 : outcome?.dailyFunctioning === 'severe' ? 20 : 0,
          notes: outcome?.clinicalNotes || ''
        })),
        dischargeRequests: (patient.dischargeRequests || []).map(request => ({
          id: request?._id?.toString() || request?._id || 'unknown',
          requestDate: request?.requestedAt || '',
          status: request?.status || 'unknown',
          reason: request?.reason || '',
          requestedBy: {
            firstName: request?.requestedBy && typeof request.requestedBy === 'object' && 'firstName' in request.requestedBy ? request.requestedBy.firstName : 'Unknown',
            lastName: request?.requestedBy && typeof request.requestedBy === 'object' && 'lastName' in request.requestedBy ? request.requestedBy.lastName : 'Staff'
          }
        })),
        patientNotes: (patientNotes || []).map(note => ({
          id: note?._id?.toString() || note?._id || 'unknown',
          date: note?.createdAt || '',
          note: note?.content || '',
          author: {
            firstName: note?.authorName ? note.authorName.split(' ')[0] : 'Unknown',
            lastName: note?.authorName ? note.authorName.split(' ').slice(1).join(' ') : 'Staff'
          },
          type: 'General' // Not available in current model
        })),
        statistics: {
          totalSessions,
          attendanceRate,
          averageMoodScore,
          averageAnxietyScore,
          averageDepressionScore,
          goalAchievementRate,
          functionalImprovementRate
        }
      };

      res.json(reportData);
    } catch (error) {
      console.error("Error generating patient report:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        patientId: req.params.id,
        userId: req.user?.id
      });
      res.status(500).json({ 
        error: "Failed to generate patient report",
        details: error.message 
      });
    }
  });

  // Discharge request endpoints
  app.post("/api/patients/:id/discharge-request", isAuthenticated, async (req: any, res) => {
    try {
      const patientId = req.params.id;
      const userId = req.user.id;
      const { reason } = req.body;

      if (!reason || reason.trim().length === 0) {
        return res.status(400).json({ message: "Discharge reason is required" });
      }

      const patient = await storage.getPatient(patientId);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }

      if (patient.status === "discharged") {
        return res.status(400).json({ message: "Patient is already discharged" });
      }

      // Check if there's already a pending request
      const existingPendingRequest = patient.dischargeRequests?.find(
        (req: any) => req.status === "pending"
      );

      if (existingPendingRequest) {
        return res.status(400).json({ message: "A discharge request is already pending for this patient" });
      }

      // Add discharge request
      const dischargeRequest = {
        requestedBy: userId,
        requestedAt: new Date(),
        reason: reason.trim(),
        status: "pending"
      };

      await Patient.findByIdAndUpdate(patientId, {
        $push: { dischargeRequests: dischargeRequest }
      });

      // Log the discharge request
      await logActivity(userId, "discharge_request", "patient", patientId, {
        reason: reason.trim()
      });

      // Send notification to admins and supervisors
      await notificationService.sendDischargeRequestCreatedNotification({
        patientName: `${patient.firstName} ${patient.lastName}`,
        patientId: patientId,
        requestedBy: {
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          role: req.user.role
        },
        reason: reason.trim(),
        requestId: dischargeRequest._id || new mongoose.Types.ObjectId().toString()
      });

      // Emit WebSocket event
      const io = (global as any).io;
      if (io) {
        io.emit('discharge_request_created', { patientId, request: dischargeRequest });
      }

      res.json({
        success: true,
        message: "Discharge request submitted successfully",
        request: dischargeRequest
      });
    } catch (error) {
      console.error("Error creating discharge request:", error);
      res.status(500).json({ message: "Failed to create discharge request" });
    }
  });

  app.get("/api/patients/:id/discharge-requests", isAuthenticated, async (req: any, res) => {
    try {
      const patientId = req.params.id;
      const patient = await Patient.findById(patientId).populate([
        { path: "dischargeRequests.requestedBy", select: "firstName lastName role" },
        { path: "dischargeRequests.reviewedBy", select: "firstName lastName role" }
      ]);
      
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }

      // Add patient information to each discharge request
      const dischargeRequestsWithPatient = (patient.dischargeRequests || []).map((request: any) => ({
        ...request.toObject(),
        patient: {
          id: patient._id,
          firstName: patient.firstName,
          lastName: patient.lastName,
          fullName: `${patient.firstName} ${patient.lastName}`
        }
      }));

      res.json(dischargeRequestsWithPatient);
    } catch (error) {
      console.error("Error fetching discharge requests:", error);
      res.status(500).json({ message: "Failed to fetch discharge requests" });
    }
  });



  app.patch("/api/patients/:id/discharge-requests/:requestId", isAuthenticated, async (req: any, res) => {
    try {
      const patientId = req.params.id;
      const requestId = req.params.requestId;
      const userId = req.user.id;
      const { status, reviewNotes } = req.body;

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Only admin and supervisor can review discharge requests
      if (user.role !== "admin" && user.role !== "supervisor") {
        return res.status(403).json({ message: "Only administrators and supervisors can review discharge requests" });
      }

      const patient = await storage.getPatient(patientId);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }

      const request = patient.dischargeRequests?.find((req: any) => req._id.toString() === requestId);
      if (!request) {
        return res.status(404).json({ message: "Discharge request not found" });
      }

      if (request.status !== "pending") {
        return res.status(400).json({ message: "Request has already been reviewed" });
      }

      // Update the request
      await Patient.updateOne(
        { 
          _id: patientId, 
          "dischargeRequests._id": requestId 
        },
        { 
          $set: { 
            "dischargeRequests.$.status": status,
            "dischargeRequests.$.reviewedBy": userId,
            "dischargeRequests.$.reviewedAt": new Date(),
            ...(reviewNotes && { "dischargeRequests.$.reviewNotes": reviewNotes })
          }
        }
      );

      // If approved, discharge the patient
      if (status === "approved") {
        const dischargeUpdates = { 
          status: "discharged",
          'dischargeCriteria.dischargeDate': new Date()
        };
        console.log("🔍 Approving discharge request - Setting automatic discharge date for patient:", patientId);
        console.log("🔍 Discharge updates:", dischargeUpdates);
        await storage.updatePatient(patientId, dischargeUpdates);
        
        // Log the discharge
        await logActivity(userId, "discharge_approved", "patient", patientId, {
          originalRequest: request,
          reviewNotes
        });

        // Send notification to the requester
        
        try {
          await notificationService.sendDischargeRequestApprovedNotification({
            patientName: `${patient.firstName} ${patient.lastName}`,
            patientId: patientId,
            requestedBy: {
              userId: request.requestedBy.toString(),
              firstName: req.user.firstName,
              lastName: req.user.lastName
            },
            reviewedBy: {
              firstName: req.user.firstName,
              lastName: req.user.lastName,
              role: req.user.role
            },
            reviewNotes
          });

        } catch (error) {
          console.error("❌ Error sending discharge request approved notification:", error);
        }

        // Emit WebSocket event
        const io = (global as any).io;
        if (io) {
          io.emit('patient_updated', { id: patientId, status: 'discharged' });
          io.emit('discharge_request_updated', { patientId, requestId, status });
        }
      } else {
        // Log the denial
        await logActivity(userId, "discharge_denied", "patient", patientId, {
          originalRequest: request,
          reviewNotes
        });

        // Send notification to the requester
        
        try {
          await notificationService.sendDischargeRequestDeniedNotification({
            patientName: `${patient.firstName} ${patient.lastName}`,
            patientId: patientId,
            requestedBy: {
              userId: request.requestedBy.toString(),
              firstName: req.user.firstName,
              lastName: req.user.lastName
            },
            reviewedBy: {
              firstName: req.user.firstName,
              lastName: req.user.lastName,
              role: req.user.role
            },
            reviewNotes
          });

        } catch (error) {
          console.error("❌ Error sending discharge request denied notification:", error);
        }

        // Emit WebSocket event
        const io = (global as any).io;
        if (io) {
          io.emit('discharge_request_updated', { patientId, requestId, status });
        }
      }

      res.json({
        success: true,
        message: `Discharge request ${status}`,
        status
      });
    } catch (error) {
      console.error("Error updating discharge request:", error);
      res.status(500).json({ message: "Failed to update discharge request" });
    }
  });

  app.get("/api/discharge-requests/pending", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Only admin and supervisor can view pending requests
      if (user.role !== "admin" && user.role !== "supervisor") {
        return res.status(403).json({ message: "Only administrators and supervisors can view pending discharge requests" });
      }

      const patients = await Patient.find({
        "dischargeRequests.status": "pending"
      }).populate([
        { path: "dischargeRequests.requestedBy", select: "firstName lastName role" },
        { path: "assignedClinicalId", select: "firstName lastName" }
      ]);

      const pendingRequests = patients.flatMap(patient => 
        patient.dischargeRequests
          .filter((req: any) => req.status === "pending")
          .map((req: any) => ({
            ...req.toObject(),
            patientId: patient._id,
            patientName: `${patient.firstName} ${patient.lastName}`,
            assignedClinical: patient.assignedClinicalId
          }))
      );

      res.json(pendingRequests);
    } catch (error) {
      console.error("Error fetching pending discharge requests:", error);
      res.status(500).json({ message: "Failed to fetch pending discharge requests" });
    }
  });

  // Treatment Outcomes API Endpoints
  
  // Create a new treatment outcome assessment
  app.post("/api/treatment-outcomes", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      console.log("Creating treatment outcome with data:", JSON.stringify(req.body, null, 2));
      console.log("User ID:", userId);
      
      const outcomeData = {
        ...req.body,
        createdBy: userId,
      };

      console.log("Final outcome data:", JSON.stringify(outcomeData, null, 2));

      const outcome = await storage.createTreatmentOutcome(outcomeData);
      res.json(outcome);
    } catch (error) {
      console.error("Error creating treatment outcome:", error);
      res.status(500).json({ error: "Failed to create treatment outcome" });
    }
  });

  // Summary route must come BEFORE the generic :id route to avoid conflicts
  app.get("/api/treatment-outcomes/summary", isAuthenticated, async (req: any, res) => {
    try {
      const { patientId, clinicalId, startDate, endDate } = req.query;
      
      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;
      
      const summary = await storage.getTreatmentOutcomesSummary(
        patientId as string,
        clinicalId as string,
        start,
        end
      );

      res.json(summary);
    } catch (error) {
      console.error("Error getting treatment outcomes summary:", error);
      res.status(500).json({ error: "Failed to get treatment outcomes summary" });
    }
  });

  // Analytics route for comprehensive treatment outcomes data
  app.get("/api/treatment-outcomes/analytics", isAuthenticated, async (req: any, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;
      
      const analytics = await storage.getTreatmentOutcomesAnalytics(start, end);

      res.json(analytics);
    } catch (error) {
      console.error("Error getting treatment outcomes analytics:", error);
      res.status(500).json({ error: "Failed to get treatment outcomes analytics" });
    }
  });

  app.get("/api/treatment-outcomes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const outcome = await storage.getTreatmentOutcome(id);
      
      if (!outcome) {
        return res.status(404).json({ error: "Treatment outcome not found" });
      }

      res.json(outcome);
    } catch (error) {
      console.error("Error getting treatment outcome:", error);
      res.status(500).json({ error: "Failed to get treatment outcome" });
    }
  });

  app.get("/api/treatment-outcomes", isAuthenticated, async (req: any, res) => {
    try {
      const { limit, offset, patientId, clinicalId, startDate, endDate } = req.query;
      
      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;
      
      const result = await storage.getAllTreatmentOutcomes(
        parseInt(limit as string) || 50,
        parseInt(offset as string) || 0,
        undefined,
        patientId as string,
        clinicalId as string,
        start,
        end
      );

      res.json(result);
    } catch (error) {
      console.error("Error getting treatment outcomes:", error);
      res.status(500).json({ error: "Failed to get treatment outcomes" });
    }
  });

  app.get("/api/patients/:patientId/treatment-outcomes", isAuthenticated, async (req: any, res) => {
    try {
      const { patientId } = req.params;
      const { limit, offset } = req.query;
      
      const result = await storage.getPatientTreatmentOutcomes(
        patientId,
        parseInt(limit as string) || 50,
        parseInt(offset as string) || 0
      );

      res.json(result);
    } catch (error) {
      console.error("Error getting patient treatment outcomes:", error);
      res.status(500).json({ error: "Failed to get patient treatment outcomes" });
    }
  });

  app.get("/api/clinicals/:clinicalId/treatment-outcomes", isAuthenticated, async (req: any, res) => {
    try {
      const { clinicalId } = req.params;
      const { limit, offset } = req.query;
      
      const result = await storage.getClinicalTreatmentOutcomes(
        clinicalId,
        parseInt(limit as string) || 50,
        parseInt(offset as string) || 0
      );

      res.json(result);
    } catch (error) {
      console.error("Error getting clinical treatment outcomes:", error);
      res.status(500).json({ error: "Failed to get clinical treatment outcomes" });
    }
  });

  app.patch("/api/treatment-outcomes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      
      const outcome = await storage.updateTreatmentOutcome(id, req.body, userId);
      res.json(outcome);
    } catch (error) {
      console.error("Error updating treatment outcome:", error);
      res.status(500).json({ error: "Failed to update treatment outcome" });
    }
  });

  app.delete("/api/treatment-outcomes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteTreatmentOutcome(id);
      res.json({ message: "Treatment outcome deleted successfully" });
    } catch (error) {
      console.error("Error deleting treatment outcome:", error);
      res.status(500).json({ error: "Failed to delete treatment outcome" });
    }
  });

  app.get("/api/treatment-outcomes/summary", isAuthenticated, async (req: any, res) => {
    try {
      const { patientId, clinicalId, startDate, endDate } = req.query;
      
      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;
      
      const summary = await storage.getTreatmentOutcomesSummary(
        patientId as string,
        clinicalId as string,
        start,
        end
      );

      res.json(summary);
    } catch (error) {
      console.error("Error getting treatment outcomes summary:", error);
      res.status(500).json({ error: "Failed to get treatment outcomes summary" });
    }
  });

  // ===== PATIENT MISCELLANEOUS DATA ENDPOINTS =====
  
  // Get patient miscellaneous data
  app.get("/api/patients/:patientId/miscellaneous", isAuthenticated, async (req: any, res) => {
    try {
      const { patientId } = req.params;
      
      // Import the model here to avoid circular dependencies
      const { PatientMiscellaneous } = await import("./models/PatientMiscellaneous");
      
      let miscData = await PatientMiscellaneous.findOne({ patientId });
      
      if (!miscData) {
        // Create empty miscellaneous data if none exists
        miscData = new PatientMiscellaneous({ patientId });
        await miscData.save();
      }
      
      res.json(miscData);
    } catch (error) {
      console.error("Error getting patient miscellaneous data:", error);
      res.status(500).json({ error: "Failed to get patient miscellaneous data" });
    }
  });

  // Update patient miscellaneous data
  app.patch("/api/patients/:patientId/miscellaneous", isAuthenticated, async (req: any, res) => {
    try {
      const { patientId } = req.params;
      const userId = req.user.id;
      const updateData = req.body;
      
      // Import the model here to avoid circular dependencies
      const { PatientMiscellaneous } = await import("./models/PatientMiscellaneous");
      
      const miscData = await PatientMiscellaneous.findOneAndUpdate(
        { patientId },
        { $set: updateData },
        { new: true, upsert: true }
      );
      
      // Sync emergency contacts back to patient if they were updated
      if (updateData.emergencyContacts) {
        try {
          const { Patient } = await import("./models/Patient");
          const primaryContact = updateData.emergencyContacts.find((contact: any) => contact.isPrimary);
          
          if (primaryContact) {
            await Patient.findOneAndUpdate(
              { _id: patientId },
              {
                emergencyContact: {
                  name: primaryContact.name,
                  relationship: primaryContact.relationship,
                  phone: primaryContact.phone
                }
              }
            );
          }
        } catch (syncError) {
          console.warn("Failed to sync emergency contact to patient:", syncError);
        }
      }
      
      // Log the activity
      await logActivity(userId, "updated", "patient_miscellaneous", patientId, updateData);
      
      res.json(miscData);
    } catch (error) {
      console.error("Error updating patient miscellaneous data:", error);
      res.status(500).json({ error: "Failed to update patient miscellaneous data" });
    }
  });

  // ===== FILE MANAGEMENT ENDPOINTS =====
  
  // Upload file for a patient
  app.post("/api/patients/:patientId/files", isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      const { patientId } = req.params;
      const userId = req.user.id;
      const { category, description, notes } = req.body;
      
      console.log("🔍 File upload request:", { patientId, userId, category, description, notes });
      console.log("🔍 Uploaded file:", req.file);
      
      if (!req.file) {
        console.log("❌ No file uploaded");
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      const fileData = {
        fileId: req.file.filename,
        originalName: req.file.originalname,
        fileName: req.file.filename,
        category: category || 'general',
        description: description || '',
        uploadedBy: userId,
        uploadedAt: new Date(),
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        notes: notes || ''
      };
      
      console.log("🔍 File data to save:", fileData);
      
      // Import the model here to avoid circular dependencies
      const { PatientMiscellaneous } = await import("./models/PatientMiscellaneous");
      
      const miscData = await PatientMiscellaneous.findOneAndUpdate(
        { patientId },
        { $push: { uploadedFiles: fileData } },
        { new: true, upsert: true }
      );
      
      // Log the activity
      await logActivity(userId, "uploaded", "patient_file", patientId, {
        fileName: req.file.originalname,
        category,
        fileSize: req.file.size
      });
      
      res.json({
        message: "File uploaded successfully",
        file: fileData,
        miscData
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // Get all files for a patient
  app.get("/api/patients/:patientId/files", isAuthenticated, async (req: any, res) => {
    try {
      const { patientId } = req.params;
      const { category } = req.query;
      
      // Import the model here to avoid circular dependencies
      const { PatientMiscellaneous } = await import("./models/PatientMiscellaneous");
      
      const miscData = await PatientMiscellaneous.findOne({ patientId });
      
      if (!miscData || !miscData.uploadedFiles) {
        return res.json([]);
      }
      
      let files = miscData.uploadedFiles;
      
      // Filter by category if specified
      if (category) {
        files = files.filter(file => file.category === category);
      }
      
      res.json(files);
    } catch (error) {
      console.error("Error getting patient files:", error);
      res.status(500).json({ error: "Failed to get patient files" });
    }
  });

  // Download a specific file
  app.get("/api/patients/:patientId/files/:fileId", isAuthenticated, async (req: any, res) => {
    try {
      const { patientId, fileId } = req.params;
      
      // Import the model here to avoid circular dependencies
      const { PatientMiscellaneous } = await import("./models/PatientMiscellaneous");
      
      const miscData = await PatientMiscellaneous.findOne({ patientId });
      
      if (!miscData || !miscData.uploadedFiles) {
        return res.status(404).json({ error: "File not found" });
      }
      
      const fileData = miscData.uploadedFiles.find(file => file.fileId === fileId);
      
      if (!fileData) {
        return res.status(404).json({ error: "File not found" });
      }
      
      const filePath = path.join(uploadDir, fileData.fileName);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found on disk" });
      }
      
      // Log the download activity
      await logActivity(req.user.id, "downloaded", "patient_file", patientId, {
        fileName: fileData.originalName,
        fileId
      });
      
      // Set headers for file download
      res.setHeader('Content-Disposition', `attachment; filename="${fileData.originalName}"`);
      res.setHeader('Content-Type', fileData.mimeType);
      
      // Stream the file
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      res.status(500).json({ error: "Failed to download file" });
    }
  });

  // Delete a file
  app.delete("/api/patients/:patientId/files/:fileId", isAuthenticated, async (req: any, res) => {
    try {
      const { patientId, fileId } = req.params;
      const userId = req.user.id;
      
      // Import the model here to avoid circular dependencies
      const { PatientMiscellaneous } = await import("./models/PatientMiscellaneous");
      
      const miscData = await PatientMiscellaneous.findOne({ patientId });
      
      if (!miscData || !miscData.uploadedFiles) {
        return res.status(404).json({ error: "File not found" });
      }
      
      const fileData = miscData.uploadedFiles.find(file => file.fileId === fileId);
      
      if (!fileData) {
        return res.status(404).json({ error: "File not found" });
      }
      
      // Remove file from database
      await PatientMiscellaneous.updateOne(
        { patientId },
        { $pull: { uploadedFiles: { fileId } } }
      );
      
      // Delete file from disk
      const filePath = path.join(uploadDir, fileData.fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      // Log the activity
      await logActivity(userId, "deleted", "patient_file", patientId, {
        fileName: fileData.originalName,
        fileId
      });
      
      res.json({ message: "File deleted successfully" });
    } catch (error) {
      console.error("Error deleting file:", error);
      res.status(500).json({ error: "Failed to delete file" });
    }
  });

  // Bulk download files by category
  app.get("/api/patients/:patientId/files/download/category/:category", isAuthenticated, async (req: any, res) => {
    try {
      const { patientId, category } = req.params;
      
      // Import the model here to avoid circular dependencies
      const { PatientMiscellaneous } = await import("./models/PatientMiscellaneous");
      
      const miscData = await PatientMiscellaneous.findOne({ patientId });
      
      if (!miscData || !miscData.uploadedFiles) {
        return res.status(404).json({ error: "No files found" });
      }
      
      const files = miscData.uploadedFiles.filter(file => file.category === category);
      
      if (files.length === 0) {
        return res.status(404).json({ error: "No files found in category" });
      }
      
      // Create a temporary ZIP file
      const archiver = await import('archiver');
      const zip = archiver('zip');
      
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${category}_files.zip"`);
      
      zip.pipe(res);
      
      // Add files to ZIP
      for (const file of files) {
        const filePath = path.join(uploadDir, file.fileName);
        if (fs.existsSync(filePath)) {
          zip.file(filePath, { name: file.originalName });
        }
      }
      
      await zip.finalize();
      
      // Log the bulk download activity
      await logActivity(req.user.id, "bulk_downloaded", "patient_files", patientId, {
        category,
        fileCount: files.length
      });
    } catch (error) {
      console.error("Error bulk downloading files:", error);
      res.status(500).json({ error: "Failed to bulk download files" });
    }
  });

  // ========================================
  // PATIENT INQUIRIES MANAGEMENT
  // ========================================

  // Get all inquiries for a patient
  app.get("/api/patients/:patientId/inquiries", isAuthenticated, async (req: any, res) => {
    try {
      const { patientId } = req.params;
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      // Check if patient exists
      const patient = await storage.getPatient(patientId);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }

      // Check access permissions
      if (user?.role === "clinical" && patient.assignedClinicalId !== userId) {
        return res.status(403).json({ message: "Access denied to patient inquiries" });
      }

      // Get inquiries from patient record
      const patientWithInquiries = await Patient.findById(patientId).populate('inquiries.assignedTo', 'firstName lastName').populate('inquiries.createdBy', 'firstName lastName');
      
      if (!patientWithInquiries) {
        return res.status(404).json({ message: "Patient not found" });
      }

      res.json({ inquiries: patientWithInquiries.inquiries || [] });
    } catch (error) {
      console.error("Error fetching patient inquiries:", error);
      res.status(500).json({ message: "Failed to fetch inquiries" });
    }
  });

  // Create a new inquiry for a patient
  app.post("/api/patients/:patientId/inquiries", isAuthenticated, async (req: any, res) => {
    try {
      const { patientId } = req.params;
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      const inquiryData = req.body;

      // Check if patient exists
      const patient = await storage.getPatient(patientId);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }

      // Validate inquiry data
      if (!inquiryData.inquiryType || !inquiryData.notes || !inquiryData.contactMethod) {
        return res.status(400).json({ message: "Missing required inquiry fields" });
      }

      // Create new inquiry
      const newInquiry = {
        inquiryType: inquiryData.inquiryType,
        status: inquiryData.status || 'pending',
        priority: inquiryData.priority || 'medium',
        notes: inquiryData.notes,
        assignedTo: inquiryData.assignedTo || null,
        createdBy: userId,
        contactMethod: inquiryData.contactMethod,
        contactInfo: inquiryData.contactInfo || '',
        followUpDate: inquiryData.followUpDate || null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Add inquiry to patient
      const updatedPatient = await Patient.findByIdAndUpdate(
        patientId,
        { $push: { inquiries: newInquiry } },
        { new: true }
      ).populate('inquiries.assignedTo', 'firstName lastName').populate('inquiries.createdBy', 'firstName lastName');

      if (!updatedPatient) {
        return res.status(404).json({ message: "Patient not found" });
      }

      const createdInquiry = updatedPatient.inquiries[updatedPatient.inquiries.length - 1];

      // Log the activity
      await logActivity(userId, "created", "patient_inquiry", patientId, {
        inquiryType: inquiryData.inquiryType,
        priority: inquiryData.priority,
        assignedTo: inquiryData.assignedTo
      });

      // Send notification if assigned to someone
      if (inquiryData.assignedTo && inquiryData.assignedTo !== userId) {
        try {
          const { notificationService } = await import("./notificationService");
          await notificationService.createNotification(
            inquiryData.assignedTo,
            "inquiry_assigned",
            "New Inquiry Assigned",
            `You have been assigned a new ${inquiryData.inquiryType} inquiry for patient ${patient.firstName} ${patient.lastName}`,
            {
              patientId,
              inquiryId: createdInquiry._id,
              inquiryType: inquiryData.inquiryType,
              priority: inquiryData.priority
            }
          );
        } catch (error) {
          console.error("Failed to send inquiry assignment notification:", error);
        }
      }

      res.status(201).json({ 
        message: "Inquiry created successfully", 
        inquiry: createdInquiry 
      });
    } catch (error) {
      console.error("Error creating inquiry:", error);
      res.status(500).json({ message: "Failed to create inquiry" });
    }
  });

  // Update an inquiry
  app.put("/api/patients/:patientId/inquiries/:inquiryId", isAuthenticated, async (req: any, res) => {
    try {
      const { patientId, inquiryId } = req.params;
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      const updateData = req.body;

      // Check if patient exists
      const patient = await storage.getPatient(patientId);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }

      // Find and update the specific inquiry
      const updatedPatient = await Patient.findOneAndUpdate(
        { 
          _id: patientId, 
          'inquiries._id': inquiryId 
        },
        { 
          $set: {
            'inquiries.$.status': updateData.status,
            'inquiries.$.priority': updateData.priority,
            'inquiries.$.notes': updateData.notes,
            'inquiries.$.assignedTo': updateData.assignedTo,
            'inquiries.$.followUpDate': updateData.followUpDate,
            'inquiries.$.updatedAt': new Date()
          }
        },
        { new: true }
      ).populate('inquiries.assignedTo', 'firstName lastName').populate('inquiries.createdBy', 'firstName lastName');

      if (!updatedPatient) {
        return res.status(404).json({ message: "Patient or inquiry not found" });
      }

      const updatedInquiry = updatedPatient.inquiries.find(inq => inq._id.toString() === inquiryId);

      // Log the activity
      await logActivity(userId, "updated", "patient_inquiry", patientId, {
        inquiryId,
        status: updateData.status,
        priority: updateData.priority
      });

      // Send notification if reassigned
      if (updateData.assignedTo && updateData.assignedTo !== userId) {
        try {
          const { notificationService } = await import("./notificationService");
          await notificationService.createNotification(
            updateData.assignedTo,
            "inquiry_assigned",
            "Inquiry Reassigned",
            `You have been assigned a ${updatedInquiry?.inquiryType} inquiry for patient ${patient.firstName} ${patient.lastName}`,
            {
              patientId,
              inquiryId,
              inquiryType: updatedInquiry?.inquiryType,
              priority: updateData.priority
            }
          );
        } catch (error) {
          console.error("Failed to send inquiry reassignment notification:", error);
        }
      }

      res.json({ 
        message: "Inquiry updated successfully", 
        inquiry: updatedInquiry 
      });
    } catch (error) {
      console.error("Error updating inquiry:", error);
      res.status(500).json({ message: "Failed to update inquiry" });
    }
  });

  // Resolve an inquiry
  app.patch("/api/patients/:patientId/inquiries/:inquiryId/resolve", isAuthenticated, async (req: any, res) => {
    try {
      const { patientId, inquiryId } = req.params;
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      const { resolutionNotes } = req.body;

      // Check if patient exists
      const patient = await storage.getPatient(patientId);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }

      // Find and resolve the specific inquiry
      const updatedPatient = await Patient.findOneAndUpdate(
        { 
          _id: patientId, 
          'inquiries._id': inquiryId 
        },
        { 
          $set: {
            'inquiries.$.status': 'completed',
            'inquiries.$.notes': resolutionNotes ? `${updatedPatient?.inquiries.find(inq => inq._id.toString() === inquiryId)?.notes}\n\nResolution: ${resolutionNotes}` : updatedPatient?.inquiries.find(inq => inq._id.toString() === inquiryId)?.notes,
            'inquiries.$.resolvedAt': new Date(),
            'inquiries.$.updatedAt': new Date()
          }
        },
        { new: true }
      ).populate('inquiries.assignedTo', 'firstName lastName').populate('inquiries.createdBy', 'firstName lastName');

      if (!updatedPatient) {
        return res.status(404).json({ message: "Patient or inquiry not found" });
      }

      const resolvedInquiry = updatedPatient.inquiries.find(inq => inq._id.toString() === inquiryId);

      // Log the activity
      await logActivity(userId, "resolved", "patient_inquiry", patientId, {
        inquiryId,
        resolutionNotes
      });

      res.json({ 
        message: "Inquiry resolved successfully", 
        inquiry: resolvedInquiry 
      });
    } catch (error) {
      console.error("Error resolving inquiry:", error);
      res.status(500).json({ message: "Failed to resolve inquiry" });
    }
  });

  // Delete an inquiry
  app.delete("/api/patients/:patientId/inquiries/:inquiryId", isAuthenticated, async (req: any, res) => {
    try {
      const { patientId, inquiryId } = req.params;
      const userId = req.user.id;
      const user = await storage.getUser(userId);

      // Check if patient exists
      const patient = await storage.getPatient(patientId);
      if (!patient) {
        return res.status(404).json({ message: "Patient not found" });
      }

      // Only admins and supervisors can delete inquiries
      if (user?.role !== "admin" && user?.role !== "supervisor") {
        return res.status(403).json({ message: "Access denied" });
      }

      // Remove the inquiry
      const updatedPatient = await Patient.findByIdAndUpdate(
        patientId,
        { $pull: { inquiries: { _id: inquiryId } } },
        { new: true }
      );

      if (!updatedPatient) {
        return res.status(404).json({ message: "Patient not found" });
      }

      // Log the activity
      await logActivity(userId, "deleted", "patient_inquiry", patientId, {
        inquiryId
      });

      res.json({ message: "Inquiry deleted successfully" });
    } catch (error) {
      console.error("Error deleting inquiry:", error);
      res.status(500).json({ message: "Failed to delete inquiry" });
    }
  });

  // Get all inquiries across all patients (for staff management)
  app.get("/api/inquiries", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      const { status, priority, assignedTo, inquiryType } = req.query;

      // Build query based on user role and filters
      let query: any = {};

      // Role-based access control
      if (user?.role === "clinical") {
        // Clinical staff can only see inquiries for their assigned patients
        const assignedPatients = await Patient.find({ assignedClinicalId: userId });
        query._id = { $in: assignedPatients.map(p => p._id) };
      } else if (user?.role === "staff") {
        // Staff can see inquiries they're assigned to
        query['inquiries.assignedTo'] = userId;
      } else if (user?.role === "frontdesk") {
        // Front desk can see inquiries they created
        query['inquiries.createdBy'] = userId;
      }
      // Admin and supervisor can see all inquiries

      // Apply filters
      if (status) query['inquiries.status'] = status;
      if (priority) query['inquiries.priority'] = priority;
      if (assignedTo) query['inquiries.assignedTo'] = assignedTo;
      if (inquiryType) query['inquiries.inquiryType'] = inquiryType;

      const patients = await Patient.find(query)
        .populate('inquiries.assignedTo', 'firstName lastName')
        .populate('inquiries.createdBy', 'firstName lastName')
        .select('firstName lastName inquiries');

      // Flatten inquiries with patient info
      const allInquiries = patients.flatMap(patient => 
        patient.inquiries.map(inquiry => ({
          ...inquiry.toObject(),
          patientName: `${patient.firstName} ${patient.lastName}`,
          patientId: patient._id
        }))
      );

      res.json({ inquiries: allInquiries });
    } catch (error) {
      console.error("Error fetching all inquiries:", error);
      res.status(500).json({ message: "Failed to fetch inquiries" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
