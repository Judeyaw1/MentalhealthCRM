import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { emailService } from "./emailService";
import { insertPatientSchema, insertAuditLogSchema } from "@shared/schema";
import { z } from "zod";
import { Patient } from "./models/Patient";
import { hashPassword, generateSecurePassword, comparePassword } from "./lib/passwordUtils";

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
        const therapistId = user?.role === "therapist" ? userId : undefined;

        const appointments = await storage.getTodayAppointments();
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
      const { limit = 50, offset = 0, search, status, createdBy } = req.query;

      const result = await storage.getPatients(
        parseInt(limit as string),
        parseInt(offset as string),
        search as string,
        status as string,
        createdBy as string
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
      console.log(
        "Creating patient with data:",
        JSON.stringify(req.body, null, 2),
      );

      const patientData = insertPatientSchema.parse(req.body);
      console.log("Parsed patient data:", JSON.stringify(patientData, null, 2));

      // Add the current user as the creator
      const patientWithCreator = {
        ...patientData,
        createdBy: userId,
      };

      const patient = await storage.createPatient(patientWithCreator);
      await logActivity(
        userId,
        "create",
        "patient",
        patient.id.toString(),
        patientData,
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

  app.patch("/api/patients/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const patientId = req.params.id;
      const updates = insertPatientSchema.partial().parse(req.body);

      const patient = await storage.updatePatient(patientId, updates);
      await logActivity(
        userId,
        "update",
        "patient",
        patientId.toString(),
        updates,
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
      if (search) query.$text = { $search: search };
      if (patientId) query.patientId = String(Array.isArray(patientId) ? patientId[0] : patientId);
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

      const therapistId = user?.role === "therapist" ? userId : undefined;

      let appointments = await storage.getAppointments(
        therapistId,
        patientId ? patientId.toString() : undefined,
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
      const emailSent = await emailService.sendStaffInvitation({
        to: email,
        firstName,
        lastName,
        role,
        message,
        inviteUrl,
      });

      if (!emailSent) {
        // If email fails, still create the user but warn about it
        console.warn(
          `Failed to send invitation email to ${email}, but user was created`,
        );
      }

      await logActivity(userId, "invite", "staff", newUser.id.toString(), {
        email,
        firstName,
        lastName,
        role,
        emailSent,
      });

      res.status(201).json({
        message: "Staff invitation sent successfully",
        user: {
          id: newUser.id,
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          role: newUser.role,
        },
        emailSent,
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
        const emailSent = await emailService.sendPasswordReset({
          to: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          defaultPassword,
        });

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
        status: "active",
      });

      const patient2 = await storage.createPatient({
        firstName: "Jane",
        lastName: "Smith",
        dateOfBirth: new Date("1985-03-22"),
        gender: "female",
        email: "jane.smith@example.com",
        phone: "555-0102",
        status: "active",
      });

      // Create sample therapist
      const therapist = await storage.createUser({
        email: "dr.therapist@example.com",
        firstName: "Dr. Sarah",
        lastName: "Johnson",
        role: "therapist",
        password: "password123",
      });

      // Create sample appointments
      const appointment1 = await storage.createAppointment({
        patientId: patient1.id,
        therapistId: therapist.id,
        appointmentDate: new Date(),
        duration: 60,
        type: "therapy-session",
        status: "scheduled",
      });

      const appointment2 = await storage.createAppointment({
        patientId: patient2.id,
        therapistId: therapist.id,
        appointmentDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        duration: 45,
        type: "consultation",
        status: "scheduled",
      });

      await logActivity(userId, "create", "sample_data", "all");
      res.json({
        message: "Sample data created successfully",
        created: {
          patients: 2,
          therapist: 1,
          appointments: 2,
        },
      });
    } catch (error) {
      console.error("Error creating sample data:", error);
      res.status(500).json({ message: "Failed to create sample data" });
    }
  });

  // --- SEARCH ENDPOINT ---
  app.get("/api/search", isAuthenticated, async (req: any, res) => {
    try {
      const q = (req.query.q || "").toString().trim();
      console.log("Search request received:", { q, length: q.length });

      if (!q || q.length < 2) {
        console.log("Query too short, returning empty results");
        return res.json([]);
      }

      console.log("Searching patients...");
      // Search patients
      const patientResult = await storage.getPatients(10, 0, q);
      const patients = (patientResult.patients || []).map((p: any) => ({
        id: p.id,
        type: "patient",
        title: `${p.firstName} ${p.lastName}`.trim(),
        subtitle: `${p.email || ""}${p.phone ? ` | ${p.phone}` : ""}`.trim(),
        href: `/patients/${p.id}`,
      }));
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

  const httpServer = createServer(app);
  return httpServer;
}
