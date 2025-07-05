// @ts-nocheck
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { emailService } from "./emailService";
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

  // Global search route
  app.get("/api/search", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { q: query } = req.query;
      
      if (!query || typeof query !== 'string' || query.length < 2) {
        return res.json([]);
      }
      
      const searchTerm = query.toLowerCase();
      const results: any[] = [];
      
      // Search patients
      const patients = await storage.getPatients(20, 0, searchTerm);
      patients.patients.forEach(patient => {
        results.push({
          id: patient.id,
          type: 'patient',
          title: `${patient.firstName} ${patient.lastName}`,
          subtitle: `${patient.email || 'No email'} • ${patient.phone || 'No phone'} • ${patient.status}`,
          href: `/patients/${patient.id}`
        });
      });
      
      // Search appointments
      const appointments = await storage.getAppointments();
      const matchingAppointments = appointments.filter((apt: any) => {
        const patientName = apt.patientId?.firstName && apt.patientId?.lastName 
          ? `${apt.patientId.firstName} ${apt.patientId.lastName}`.toLowerCase()
          : 'unknown patient';
        const therapistName = apt.therapistId?.firstName && apt.therapistId?.lastName
          ? `${apt.therapistId.firstName} ${apt.therapistId.lastName}`.toLowerCase()
          : 'unknown therapist';
        const appointmentDate = new Date(apt.appointmentDate).toLocaleDateString().toLowerCase();
        
        return patientName.includes(searchTerm) || 
               therapistName.includes(searchTerm) || 
               appointmentDate.includes(searchTerm) ||
               apt.type.toLowerCase().includes(searchTerm);
      }).slice(0, 5);
      
      matchingAppointments.forEach((apt: any) => {
        results.push({
          id: apt._id?.toString() || apt.id,
          type: 'appointment',
          title: `${apt.patientId?.firstName || 'Unknown'} ${apt.patientId?.lastName || 'Patient'} - ${apt.type}`,
          subtitle: `${new Date(apt.appointmentDate).toLocaleDateString()} with ${apt.therapistId?.firstName || 'Unknown'} ${apt.therapistId?.lastName || 'Therapist'}`,
          href: `/appointments/${apt._id?.toString() || apt.id}`
        });
      });
      
      // Search treatment records
      const allPatients = await storage.getPatients(100, 0);
      for (const patient of allPatients.patients.slice(0, 10)) {
        const records = await storage.getTreatmentRecords(patient.id);
        const matchingRecords = records.filter(record => {
          const patientName = `${patient.firstName} ${patient.lastName}`.toLowerCase();
          const sessionType = record.sessionType.toLowerCase();
          const notes = record.notes.toLowerCase();
          
          return patientName.includes(searchTerm) || 
                 sessionType.includes(searchTerm) || 
                 notes.includes(searchTerm);
        }).slice(0, 3);
        
        matchingRecords.forEach(record => {
          results.push({
            id: record.id,
            type: 'record',
            title: `${patient.firstName} ${patient.lastName} - ${record.sessionType}`,
            subtitle: `${new Date(record.sessionDate).toLocaleDateString()} • ${record.notes.substring(0, 50)}...`,
            href: `/patients/${patient.id}`
          });
        });
      }
      
      // Log search activity
      await logActivity(userId, "search", "global", "search", { query, resultCount: results.length });
      
      res.json(results.slice(0, 10)); // Limit to 10 results
    } catch (error) {
      console.error("Error performing global search:", error);
      res.status(500).json({ message: "Failed to perform search" });
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

  // Patient export route
  app.post("/api/patients/export", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { format = "csv", patientIds } = req.body;
      
      // Get patients to export
      let patients;
      if (patientIds && Array.isArray(patientIds) && patientIds.length > 0) {
        // Export specific patients
        patients = await Promise.all(
          patientIds.map((id: number) => storage.getPatient(id))
        );
        patients = patients.filter(Boolean); // Remove any null values
      } else {
        // Export all patients
        const result = await storage.getPatients(1000, 0); // Get all patients
        patients = result.patients;
      }
      
      if (patients.length === 0) {
        return res.status(404).json({ message: "No patients found to export" });
      }
      
      let exportData: string;
      let contentType: string;
      let filename: string;
      
      switch (format.toLowerCase()) {
        case "csv":
          exportData = generateCSV(patients);
          contentType = "text/csv";
          filename = `patients-export-${new Date().toISOString().split('T')[0]}.csv`;
          break;
        case "excel":
          exportData = generateExcel(patients);
          contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
          filename = `patients-export-${new Date().toISOString().split('T')[0]}.xlsx`;
          break;
        case "pdf":
          exportData = generatePDF(patients);
          contentType = "application/pdf";
          filename = `patients-export-${new Date().toISOString().split('T')[0]}.pdf`;
          break;
        default:
          return res.status(400).json({ message: "Unsupported export format" });
      }
      
      // Log the export activity
      await logActivity(userId, "export", "patients", "bulk", { 
        format, 
        count: patients.length,
        patientIds: patientIds || "all"
      });
      
      // Set headers for file download
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(exportData);
      
    } catch (error) {
      console.error("Error exporting patients:", error);
      res.status(500).json({ message: "Failed to export patients" });
    }
  });

  // Helper functions for export formats
  function generateCSV(patients: any[]): string {
    const headers = [
      "ID", "First Name", "Last Name", "Date of Birth", "Age", "Gender", 
      "Email", "Phone", "Emergency Contact", "Address", "Insurance", 
      "Reason for Visit", "Status", "Assigned Therapist", "Created At"
    ];
    
    const rows = patients.map(patient => [
      patient.id,
      patient.firstName,
      patient.lastName,
      new Date(patient.dateOfBirth).toLocaleDateString(),
      calculateAge(patient.dateOfBirth),
      patient.gender || "",
      patient.email || "",
      patient.phone || "",
      patient.emergencyContact || "",
      patient.address || "",
      patient.insurance || "",
      patient.reasonForVisit || "",
      patient.status,
      patient.assignedTherapist ? `${patient.assignedTherapist.firstName} ${patient.assignedTherapist.lastName}` : "Unassigned",
      new Date(patient.createdAt).toLocaleDateString()
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    
    return csvContent;
  }
  
  function generateExcel(patients: any[]): string {
    // For simplicity, we'll return CSV format with .xlsx extension
    // In a real implementation, you'd use a library like 'xlsx' or 'exceljs'
    return generateCSV(patients);
  }
  
  function generatePDF(patients: any[]): string {
    // For simplicity, we'll return a simple text format
    // In a real implementation, you'd use a library like 'pdfkit' or 'puppeteer'
    const lines = [
      "PATIENT EXPORT REPORT",
      `Generated on: ${new Date().toLocaleString()}`,
      `Total Patients: ${patients.length}`,
      "",
      ...patients.map(patient => [
        `ID: ${patient.id}`,
        `Name: ${patient.firstName} ${patient.lastName}`,
        `Age: ${calculateAge(patient.dateOfBirth)}`,
        `Email: ${patient.email || "N/A"}`,
        `Phone: ${patient.phone || "N/A"}`,
        `Status: ${patient.status}`,
        `Therapist: ${patient.assignedTherapist ? `${patient.assignedTherapist.firstName} ${patient.assignedTherapist.lastName}` : "Unassigned"}`,
        ""
      ].join("\n"))
    ];
    
    return lines.join("\n");
  }
  
  function calculateAge(dateOfBirth: string | number): number {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  // Appointment routes
  app.get("/api/appointments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      const { patientId, startDate, endDate, search } = req.query;
      
      const therapistId = user?.role === "therapist" ? userId : undefined;
      
      let appointments = await storage.getAppointments(
        therapistId,
        patientId ? parseInt(patientId as string) : undefined,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      
      // Filter appointments based on search query
      if (search) {
        appointments = appointments.filter((apt: any) => {
          const patientName = apt.patientId ? `${apt.patientId.firstName} ${apt.patientId.lastName}`.toLowerCase() : '';
          const therapistName = apt.therapistId ? `${apt.therapistId.firstName} ${apt.therapistId.lastName}`.toLowerCase() : '';
          const appointmentType = apt.type.toLowerCase();
          const notes = apt.notes?.toLowerCase() || '';
          
          return (
            patientName.includes(search.toLowerCase()) ||
            therapistName.includes(search.toLowerCase()) ||
            appointmentType.includes(search.toLowerCase()) ||
            notes.includes(search.toLowerCase())
          );
        });
      }

      // Transform appointments for response
      const transformedAppointments = appointments.map((apt: any) => ({
        id: apt._id?.toString() || apt.id,
        type: apt.type,
        status: apt.status,
        appointmentDate: apt.appointmentDate,
        duration: apt.duration,
        notes: apt.notes,
        title: `${apt.patientId?.firstName || 'Unknown'} ${apt.patientId?.lastName || 'Patient'} - ${apt.type}`,
        subtitle: `${new Date(apt.appointmentDate).toLocaleDateString()} with ${apt.therapistId?.firstName || 'Unknown'} ${apt.therapistId?.lastName || 'Therapist'}`,
        href: `/appointments/${apt._id?.toString() || apt.id}`
      }));
      
      await logActivity(userId, "view", "appointments", "list");
      res.json(transformedAppointments);
    } catch (error) {
      console.error("Error fetching appointments:", error);
      res.status(500).json({ message: "Failed to fetch appointments" });
    }
  });

  app.get("/api/appointments/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
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
      const userId = req.user.id;
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
      const userId = req.user.id;
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
  app.get("/api/records", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      const { limit = 50, offset = 0, search, patientId, therapistId, sessionType, startDate, endDate } = req.query;
      
      // If therapist, only show their records
      const therapistFilter = user?.role === "therapist" ? userId : therapistId;
      
      const records = await storage.getAllTreatmentRecords({
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        search: search as string,
        patientId: patientId ? parseInt(patientId as string) : undefined,
        therapistId: therapistFilter as string,
        sessionType: sessionType as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });
      
      await logActivity(userId, "view", "treatment_records", "list");
      res.json(records);
    } catch (error) {
      console.error("Error fetching treatment records:", error);
      res.status(500).json({ message: "Failed to fetch treatment records" });
    }
  });

  app.get("/api/patients/:patientId/records", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
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
      const userId = req.user.id;
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
      const userId = req.user.id;
      
      // Convert timestamp to Date object for validation
      const requestData = {
        ...req.body,
        sessionDate: new Date(req.body.sessionDate)
      };
      
      const recordData = insertTreatmentRecordSchema.parse(requestData);
      
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
      const userId = req.user.id;
      const recordId = parseInt(req.params.id);
      
      // Convert timestamp to Date object for validation if sessionDate is provided
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
      const recordId = parseInt(req.params.id);
      
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

  // Test email endpoint (remove in production)
  app.post("/api/test-email", isAuthenticated, async (req: any, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      
      const testResult = await emailService.sendStaffInvitation({
        to: email,
        firstName: "Test",
        lastName: "User",
        role: "therapist",
        message: "This is a test invitation email.",
        inviteUrl: "http://localhost:3000/login?test=true",
      });
      
      res.json({ 
        success: testResult,
        message: testResult ? "Test email sent successfully" : "Failed to send test email"
      });
    } catch (error) {
      console.error("Error sending test email:", error);
      res.status(500).json({ message: "Failed to send test email" });
    }
  });

  // Update staff member
  app.put("/api/staff/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      // Only admins can edit staff
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Access denied. Only administrators can edit staff members." });
      }
      
      const staffId = req.params.id;
      
      // Debug: Log the received data
      console.log("Received edit data:", req.body);
      
      // Validate edit data
      const editSchema = z.object({
        firstName: z.string().trim().min(1, "First name is required"),
        lastName: z.string().trim().min(1, "Last name is required"),
        role: z.enum(["admin", "therapist", "staff"], {
          errorMap: () => ({ message: "Role must be admin, therapist, or staff" })
        }),
      });
      
      const editData = editSchema.parse(req.body);
      
      // Check if staff member exists
      const existingStaff = await storage.getUser(staffId);
      if (!existingStaff) {
        return res.status(404).json({ message: "Staff member not found." });
      }
      
      // Update the staff member
      const updatedStaff = await storage.updateUser(staffId, {
        firstName: editData.firstName,
        lastName: editData.lastName,
        role: editData.role,
      });
      
      // Log the update
      await logActivity(userId, "update", "staff", staffId, {
        updatedFields: editData,
        previousData: {
          firstName: existingStaff.firstName,
          lastName: existingStaff.lastName,
          role: existingStaff.role,
        },
      });
      
      res.json({
        message: "Staff member updated successfully.",
        user: {
          id: updatedStaff.id,
          email: updatedStaff.email,
          firstName: updatedStaff.firstName,
          lastName: updatedStaff.lastName,
          role: updatedStaff.role,
        },
      });
    } catch (error) {
      console.error("Error updating staff member:", error);
      if (error instanceof z.ZodError) {
        console.log("Validation errors:", error.errors);
        return res.status(400).json({ 
          message: "Invalid update data", 
          errors: error.errors,
          receivedData: req.body
        });
      }
      res.status(500).json({ message: "Failed to update staff member" });
    }
  });

  // Delete staff member
  app.delete("/api/staff/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      // Only admins can delete staff
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Access denied. Only administrators can remove staff members." });
      }
      
      const staffId = req.params.id;
      
      // Check if staff member exists
      const existingStaff = await storage.getUser(staffId);
      if (!existingStaff) {
        return res.status(404).json({ message: "Staff member not found." });
      }
      
      // Prevent deleting the last admin
      if (existingStaff.role === "admin") {
        const allAdmins = await storage.getStaff();
        const adminCount = allAdmins.filter((staff: any) => staff.role === "admin").length;
        if (adminCount <= 1) {
          return res.status(400).json({ message: "Cannot remove the last administrator." });
        }
      }
      
      // Delete the staff member
      await storage.deleteUser(staffId);
      
      // Log the deletion
      await logActivity(userId, "delete", "staff", staffId, {
        deletedUser: {
          email: existingStaff.email,
          firstName: existingStaff.firstName,
          lastName: existingStaff.lastName,
          role: existingStaff.role,
        },
      });
      
      res.json({
        message: "Staff member removed successfully.",
      });
    } catch (error) {
      console.error("Error removing staff member:", error);
      res.status(500).json({ message: "Failed to remove staff member" });
    }
  });

  // Reset password for staff member with default password
  app.post("/api/staff/:id/reset-password", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      // Only admins can reset passwords
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Access denied. Only administrators can reset passwords." });
      }
      
      const staffId = req.params.id;
      
      // Check if staff member exists
      const existingStaff = await storage.getUser(staffId);
      if (!existingStaff) {
        return res.status(404).json({ message: "Staff member not found." });
      }
      
      // Generate a default password
      const defaultPassword = `NewLife${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      
      // Update the user's password to the default password
      await storage.updateUser(staffId, {
        password: defaultPassword, // This would be hashed in production
        forcePasswordChange: true, // Flag to force password change on next login
      });
      
      // Send password reset email with default password
      const emailSent = await emailService.sendPasswordReset({
        to: existingStaff.email,
        firstName: existingStaff.firstName || "Staff Member",
        lastName: existingStaff.lastName || "",
        defaultPassword: defaultPassword,
      });
      
      // Log the password reset
      await logActivity(userId, "reset_password", "staff", staffId, {
        resetEmail: existingStaff.email,
        emailSent: emailSent,
        defaultPasswordSet: true,
      });
      
      res.json({
        message: emailSent 
          ? "Password reset successfully. Default password sent via email." 
          : "Password reset completed, but email could not be sent.",
        emailSent: emailSent,
        defaultPassword: defaultPassword, // Include for development/testing
        note: "User will be required to change password on next login"
      });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Change password endpoint for users
  app.post("/api/auth/change-password", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { currentPassword, newPassword } = req.body;
      
      // Validate input
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current password and new password are required." });
      }
      
      if (newPassword.length < 8) {
        return res.status(400).json({ message: "New password must be at least 8 characters long." });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }
      
      // In production, you would hash and compare passwords
      // For now, we'll just check if the current password matches
      if (user.password !== currentPassword) {
        return res.status(400).json({ message: "Current password is incorrect." });
      }
      
      // Update password and remove force change flag
      await storage.updateUser(userId, {
        password: newPassword, // This would be hashed in production
        forcePasswordChange: false,
      });
      
      // Log the password change
      await logActivity(userId, "change_password", "user", userId, {
        passwordChanged: true,
      });
      
      res.json({
        message: "Password changed successfully.",
      });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  // Check if user needs to change password
  app.get("/api/auth/force-password-change", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }
      
      res.json({
        forcePasswordChange: user.forcePasswordChange || false,
      });
    } catch (error) {
      console.error("Error checking password change requirement:", error);
      res.status(500).json({ message: "Failed to check password change requirement" });
    }
  });

  // Get staff member details for editing
  app.get("/api/staff/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      // Only admins can view staff details
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Access denied. Only administrators can view staff details." });
      }
      
      const staffId = req.params.id;
      const staffMember = await storage.getUser(staffId);
      
      if (!staffMember) {
        return res.status(404).json({ message: "Staff member not found." });
      }
      
      // Log the view
      await logActivity(userId, "view", "staff", staffId);
      
      res.json(staffMember);
    } catch (error) {
      console.error("Error fetching staff member:", error);
      res.status(500).json({ message: "Failed to fetch staff member" });
    }
  });

  // Get audit logs for staff member
  app.get("/api/staff/:id/audit-logs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      // Only admins can view audit logs
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Access denied. Only administrators can view audit logs." });
      }
      
      const staffId = req.params.id;
      const auditLogs = await storage.getAuditLogs(staffId, staffId);
      
      res.json(auditLogs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  app.post("/api/staff/invite", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      // Only admins can invite staff
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Access denied. Only administrators can invite staff members." });
      }
      
      // Debug: Log the received data
      console.log("Received invitation data:", req.body);
      console.log("Role value:", req.body.role, "Type:", typeof req.body.role);
      
      // Validate invite data
      const inviteSchema = z.object({
        email: z.string().trim().email("Invalid email address"),
        firstName: z.string().trim().min(1, "First name is required"),
        lastName: z.string().trim().min(1, "Last name is required"),
        role: z.enum(["admin", "therapist", "staff"], {
          errorMap: () => ({ message: "Role must be admin, therapist, or staff" })
        }),
        message: z.string().optional(),
      });
      
      const inviteData = inviteSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(inviteData.email);
      if (existingUser) {
        return res.status(400).json({ message: "A user with this email address already exists." });
      }
      
      // Create the new user account
      const defaultPassword = `NewLife${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      const newUser = await storage.createUser({
        id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        email: inviteData.email,
        firstName: inviteData.firstName,
        lastName: inviteData.lastName,
        role: inviteData.role,
        password: defaultPassword, // Default password
        forcePasswordChange: true, // Force password change on first login
      });
      
      // Generate invitation URL (in production, this would be a secure token-based URL)
      const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
      const inviteUrl = `${baseUrl}/login?invite=${newUser.id}`;
      
      // Send invitation email
      const emailSent = await emailService.sendStaffInvitation({
        to: inviteData.email,
        firstName: inviteData.firstName,
        lastName: inviteData.lastName,
        role: inviteData.role,
        message: inviteData.message,
        inviteUrl: inviteUrl,
      });
      
      // Log the invitation
      await logActivity(userId, "invite", "staff", newUser.id, {
        invitedEmail: inviteData.email,
        role: inviteData.role,
        message: inviteData.message,
        emailSent: emailSent,
      });
      
      res.status(201).json({
        message: emailSent 
          ? "Staff member invited successfully. Invitation email has been sent." 
          : "Staff member created successfully, but invitation email could not be sent.",
        user: {
          id: newUser.id,
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          role: newUser.role,
        },
        defaultPassword: defaultPassword, // Include for admin to share with user
        emailSent: emailSent,
      });
    } catch (error) {
      console.error("Error inviting staff member:", error);
      if (error instanceof z.ZodError) {
        console.log("Validation errors:", error.errors);
        return res.status(400).json({ 
          message: "Invalid invitation data", 
          errors: error.errors,
          receivedData: req.body
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

  // Audit log routes
  app.get("/api/audit-logs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
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
