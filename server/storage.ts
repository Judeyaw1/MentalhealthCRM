import { Patient as PatientModel } from "./models/Patient";
import { Appointment } from "./models/Appointment";
import { User } from "./models/User";
import mongoose from "mongoose";
import { TreatmentRecord } from "./models/TreatmentRecord";
import { TreatmentCompletionService } from "./treatmentCompletionService";
import { Notification as NotificationModel } from "./models/Notification";
import { Notification, NotificationType } from "./notificationService";
import { TreatmentOutcome } from "./models/TreatmentOutcome";
import { PatientNote } from "./models/PatientNote";

// Simplified MongoDB-only storage for now
export class DatabaseStorage {
  db: any; // MongoDB database instance
  
  setDatabase(db: any) {
    this.db = db;
  }
  
  // Patient operations
  async getPatients(limit = 50, offset = 0, search?: string, status?: string, createdBy?: string, clinical?: string, loc?: string, includeArchived = false, unassignedOnly = false) {
    let query: any = {};

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

    if (clinical) {
      query.assignedClinicalId = clinical;
    }

    if (loc) {
      query.loc = loc;
    }

    // Filter for unassigned patients only
    if (unassignedOnly) {
      query.$or = [
        { assignedClinicalId: { $exists: false } },
        { assignedClinicalId: null },
        { assignedClinicalId: "" }
      ];
    }

    // If not including archived, exclude only discharged patients (inactive should be visible)
    if (!includeArchived) {
      query.status = { $nin: ["discharged"] };
    }

    const total = await PatientModel.countDocuments(query);
    const patients = await PatientModel.find(query)
              .populate("assignedClinicalId", "firstName lastName email")
      .populate("createdBy", "firstName lastName email role")
      .limit(limit)
      .skip(offset)
      .sort({ createdAt: -1 })
      .lean()
      .catch((error) => {
        console.error("Error fetching patients with population:", error);
        // If population fails, try without createdBy population
        return PatientModel.find(query)
          .populate("assignedClinicalId", "firstName lastName email")
          .limit(limit)
          .skip(offset)
          .sort({ createdAt: -1 })
          .lean();
      });

    const patientsWithId = patients.map((p) => {
      const { _id, ...rest } = p;


      const transformed = {
        ...rest,
        id: _id.toString(),
        assignedClinical: rest.assignedClinicalId || undefined,
        createdBy: rest.createdBy
          ? {
              ...rest.createdBy,
              id: rest.createdBy._id.toString(),
            }
          : undefined,
      };

      return transformed;
    });

    return { patients: patientsWithId, total };
  }

  async getPatient(id: string) {
    const p = await PatientModel.findById(id)
      .populate("assignedClinicalId", "firstName lastName email")
      .populate("createdBy", "firstName lastName email role")
      .populate({
        path: "dischargeRequests.requestedBy",
        select: "firstName lastName"
      })
      .populate({
        path: "dischargeRequests.reviewedBy",
        select: "firstName lastName"
      })
      .lean();
    if (!p) return undefined;
    const { _id, ...rest } = p;
    return {
      ...rest,
      id: _id.toString(),
      assignedClinical: rest.assignedClinicalId
        ? {
            ...rest.assignedClinicalId,
            id: rest.assignedClinicalId._id.toString(),
          }
        : undefined,
      createdBy: rest.createdBy
        ? {
            ...rest.createdBy,
            id: rest.createdBy._id.toString(),
          }
        : undefined,
    };
  }

  async createPatient(patient: any) {


    try {
      // Clean up ObjectId fields - convert empty strings to null
      const cleanedPatient = {
        ...patient,
        assignedClinicalId:
          patient.assignedClinicalId === ""
            ? null
            : patient.assignedClinicalId,
      };



      const newPatient = new PatientModel(cleanedPatient);


      await newPatient.save();




      // Fetch the patient with populated fields
      const populatedPatient = await PatientModel.findById(newPatient._id)
        .populate("assignedClinicalId", "firstName lastName email")
        .populate("createdBy", "firstName lastName email role")
        .lean();

      if (!populatedPatient) {
        throw new Error("Failed to fetch created patient");
      }

      console.log("Storage: Populated patient data:", {
        createdBy: populatedPatient.createdBy,
        hasCreatedBy: !!populatedPatient.createdBy,
      });

      // Send notification if a clinical is assigned during creation
      console.log("🔍 Checking for clinical assignment:", {
        hasAssignedClinical: !!populatedPatient.assignedClinicalId,
        clinicalId: populatedPatient.assignedClinicalId?._id?.toString(),
        patientName: `${populatedPatient.firstName} ${populatedPatient.lastName}`
      });
      
      if (populatedPatient.assignedClinicalId) {
        try {
          console.log("📞 Attempting to send notification to clinical:", populatedPatient.assignedClinicalId._id.toString());
          const { notificationService } = await import("./notificationService");
          const patientName = `${populatedPatient.firstName} ${populatedPatient.lastName}`;
          
          await notificationService.sendPatientAssignmentNotification(
            populatedPatient.assignedClinicalId._id.toString(),
            {
              patientName,
              patientId: populatedPatient._id.toString(),
              reasonForVisit: populatedPatient.reasonForVisit ? populatedPatient.reasonForVisit : undefined,
              status: populatedPatient.status,
              assignedAt: new Date(),
            }
          );
          
  
        } catch (error) {
          console.error("❌ Failed to send new patient assignment notification:", error);
          if (error instanceof Error) {
            console.error("❌ Error details:", error.message, error.stack);
          }
        }
      } else {

      }

      const { _id, ...rest } = populatedPatient;
      return {
        ...rest,
        id: _id.toString(),
        assignedClinical: undefined,
        createdBy: rest.createdBy
          ? {
              ...rest.createdBy,
              id: rest.createdBy._id.toString(),
            }
          : undefined,
      };
    } catch (error) {
      console.error("Storage: Error saving patient:", error);
      throw error;
    }
  }

  async updatePatient(id: string, patient: any) {
    // Get the current patient to check for assignment changes
    const currentPatient = await PatientModel.findById(id).lean();
    if (!currentPatient) return undefined;

    // Clean up ObjectId fields - convert empty strings to null
    const cleanedPatient = {
      ...patient,
      assignedClinicalId:
        patient.assignedClinicalId === "" || !patient.assignedClinicalId
          ? null
          : patient.assignedClinicalId,
    };

          // Check if clinical assignment changed
      const prevClinicalId = currentPatient.assignedClinicalId?.toString();
      const newClinicalId = cleanedPatient.assignedClinicalId?.toString();



    // Only include fields that are actually being updated
    const updateFields: any = { updatedAt: new Date() };
    console.log("🔍 Storage: Input cleanedPatient:", JSON.stringify(cleanedPatient, null, 2));
    Object.keys(cleanedPatient).forEach(key => {
      if (cleanedPatient[key] !== undefined && cleanedPatient[key] !== null) {
        updateFields[key] = cleanedPatient[key];
        console.log(`🔍 Storage: Including field ${key}:`, cleanedPatient[key]);
      } else {
        console.log(`🔍 Storage: Excluding field ${key}:`, cleanedPatient[key]);
      }
    });
    console.log("🔍 Storage: Final updateFields:", JSON.stringify(updateFields, null, 2));



    const updatedPatient = await PatientModel.findByIdAndUpdate(id, updateFields, {
      new: true,
      runValidators: false // Disable validation for updates
    }).lean();
    if (!updatedPatient) return undefined;

    // Send notification if clinical assignment changed
    if (newClinicalId && newClinicalId !== prevClinicalId) {
      try {
        const { notificationService } = await import("./notificationService");
        const patientName = `${updatedPatient.firstName} ${updatedPatient.lastName}`;
        
        await notificationService.sendPatientAssignmentNotification(
          newClinicalId,
          {
            patientName,
            patientId: updatedPatient._id.toString(),
            reasonForVisit: updatedPatient.reasonForVisit ? updatedPatient.reasonForVisit : undefined,
            status: updatedPatient.status,
            assignedAt: new Date(),
          }
        );
        

      } catch (error) {
        console.error("❌ Failed to send patient assignment notification:", error);
        if (error instanceof Error) {
          console.error("❌ Error details:", error.message, error.stack);
        }
      }
    }

    const { _id, ...rest } = updatedPatient;
    return {
      ...rest,
      id: _id.toString(),
      assignedClinical: undefined,
    };
  }

  async archivePatient(id: string, status: "inactive" | "discharged" = "inactive") {
    try {
      console.log("Storage: Attempting to archive patient with ID:", id, "with status:", status);

      const patient = await PatientModel.findById(id);
      if (!patient) {
        throw new Error("Patient not found");
      }

      // Allow archiving any patient (active, inactive, or discharged)
      // This provides flexibility for admin/supervisor to manage patient status

      // Update patient status to archived
      const updatedPatient = await PatientModel.findByIdAndUpdate(
        id,
        { 
          status,
          updatedAt: new Date()
        },
        { new: true }
      );

      if (!updatedPatient) {
        throw new Error("Failed to archive patient");
      }

      console.log("Storage: Patient archived successfully with status:", status);
      console.log("Storage: Updated patient data:", {
        id: updatedPatient._id,
        firstName: updatedPatient.firstName,
        lastName: updatedPatient.lastName,
        status: updatedPatient.status,
        updatedAt: updatedPatient.updatedAt
      });
      return { success: true, message: `Patient archived successfully as ${status}` };
    } catch (error) {
      console.error("Storage: Error archiving patient:", error);
      throw error;
    }
  }

  async deletePatient(id: string) {
    console.log("Storage: Deleting patient with ID:", id);
    try {
      // First, check if patient has any appointments or treatment records
      const appointments = await Appointment.find({ patientId: id }).lean();
      const treatmentRecords = await TreatmentRecord.find({
        patientId: id,
      }).lean();

      const appointmentCount = appointments.length;
      const treatmentRecordCount = treatmentRecords.length;

      if (appointmentCount > 0 || treatmentRecordCount > 0) {
        const errorMessage = `Cannot delete patient. Patient has ${appointmentCount} appointment(s) and ${treatmentRecordCount} treatment record(s). Please delete these first.`;

        // Provide details about what needs to be deleted
        const details = {
          appointments: appointments.map((apt) => ({
            id: apt._id.toString(),
            date: apt.appointmentDate,
            status: apt.status,
          })),
          treatmentRecords: treatmentRecords.map((record) => ({
            id: record._id.toString(),
            date: record.sessionDate,
            type: record.sessionType,
          })),
        };

        throw new Error(JSON.stringify({ message: errorMessage, details }));
      }

      const deletedPatient = await PatientModel.findByIdAndDelete(id);
      if (!deletedPatient) {
        throw new Error("Patient not found");
      }

      console.log("Storage: Patient deleted successfully");
      return { success: true, message: "Patient deleted successfully" };
    } catch (error) {
      console.error("Storage: Error deleting patient:", error);
      throw error;
    }
  }

  // Mock methods for compatibility (return empty data for now)
  async getUser(id: string) {
    const user = await User.findById(id).lean();
    if (!user) return undefined;
    const { _id, ...rest } = user;
    return {
      ...rest,
      id: _id.toString(),
    };
  }

  async getUserByEmail(email: string) {
    const user = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } }).lean();
    if (!user) return undefined;
    const { _id, ...rest } = user;
    return {
      ...rest,
      id: _id.toString(),
    };
  }

  async createUser(userData: any) {
    const user = new User({ ...userData, email: userData.email.toLowerCase() });
    await user.save();
    const userObj = user.toObject();
    const { _id, ...rest } = userObj;
    return {
      ...rest,
      id: _id.toString(),
    };
  }

  // Removed upsertUser as it's no longer needed

  async getPatientsByClinical(clinicalId: string) {
    return [];
  }

  // Appointments
  async getAppointments(
    clinicalId?: string,
    patientId?: string,
    startDate?: Date,
    endDate?: Date,
    search?: string,
  ) {
    const query: any = {};

    if (clinicalId && typeof clinicalId === 'string') {
      query.clinicalId = new mongoose.Types.ObjectId(clinicalId);
    }

    if (patientId && typeof patientId === 'string') {
      query.patientId = new mongoose.Types.ObjectId(patientId);
    }

    if (startDate && endDate) {
      query.appointmentDate = { $gte: startDate, $lte: endDate };
    }

    let appointments = await Appointment.find(query)
      .populate("patientId", "firstName lastName")
      .populate("clinicalId", "firstName lastName")
      .sort({ createdAt: -1 })
      .lean();


    if (search) {
      const searchLower = search.toLowerCase();
      appointments = appointments.filter((apt: any) => {
        let patientName = "";
        if (
          apt.patientId &&
          typeof apt.patientId === "object" &&
          "firstName" in apt.patientId &&
          "lastName" in apt.patientId
        ) {
          patientName = (
            apt.patientId.firstName + " " + apt.patientId.lastName
          ).toLowerCase();
        }
        const match = patientName.includes(searchLower);
  
        return match;
      });

    }

    return appointments.map((apt: any) => ({
      ...apt,
      id: apt._id.toString(),
      patient: apt.patientId ? {
        ...apt.patientId,
        id: apt.patientId._id.toString(),
      } : null,
      clinical: apt.clinicalId ? {
        ...apt.clinicalId,
        id: apt.clinicalId._id.toString(),
      } : null,
    }));
  }

  async getAppointment(id: string) {
    const appointment = await Appointment.findById(id)
      .populate("patientId", "firstName lastName")
      .populate("clinicalId", "firstName lastName")
      .lean();

    if (!appointment) return null;

    return {
      ...appointment,
      id: appointment._id.toString(),
      patient: appointment.patientId ? {
        ...appointment.patientId,
        id: appointment.patientId._id.toString(),
      } : null,
      clinical: appointment.clinicalId ? {
        ...appointment.clinicalId,
        id: appointment.clinicalId._id.toString(),
      } : null,
    };
  }

  async createAppointment(data: any) {
    const appointmentData = {
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };



    const appointment = new Appointment(appointmentData);
    await appointment.save();



    // Fetch the appointment with populated data
    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate("patientId", "firstName lastName")
      .populate("clinicalId", "firstName lastName")
      .lean();

    if (!populatedAppointment) {
      throw new Error("Failed to create appointment");
    }

    // Send notification to the assigned clinical
    try {
      const { notificationService } = await import("./notificationService");
      // Type-safe access to populated patient data
      const patientData = populatedAppointment.patientId as any;
      const patientName = patientData && typeof patientData === 'object' && 'firstName' in patientData && 'lastName' in patientData
        ? `${patientData.firstName} ${patientData.lastName}`
        : 'Unknown Patient';
      const appointmentDate = new Date(populatedAppointment.appointmentDate).toLocaleDateString();
      const notificationTitle = "New Appointment Assigned";
      const notificationMessage = `You have a new appointment with ${patientName} on ${appointmentDate}.`;
      const notificationData = {
        appointmentId: populatedAppointment._id.toString(),
        patientId: patientData && patientData._id ? patientData._id.toString() : "",
        patientName,
        appointmentDate: populatedAppointment.appointmentDate,
        appointmentType: populatedAppointment.type,
        duration: populatedAppointment.duration,
      };

      await notificationService.createNotification(
        populatedAppointment.clinicalId._id.toString(),
        "general",
        notificationTitle,
        notificationMessage,
        notificationData
      );
    } catch (error) {
      console.error("Failed to send appointment assignment notification:", error);
    }

    return {
      ...populatedAppointment,
      id: populatedAppointment._id.toString(),
      patient: {
        ...populatedAppointment.patientId,
        id: populatedAppointment.patientId._id.toString(),
      },
      clinical: {
        ...populatedAppointment.clinicalId,
        id: populatedAppointment.clinicalId._id.toString(),
      },
    };
  }

  async updateAppointment(id: string, updates: any) {
    console.log("🔍 updateAppointment called with:", { id, updates });
    
    // Fetch the current appointment to check for clinical reassignment
    const currentAppointment = await Appointment.findById(id).lean();
    if (!currentAppointment) {
      console.log("❌ Current appointment not found");
      return null;
    }

    const prevClinicalId = currentAppointment.clinicalId?.toString();
    const newClinicalId = updates.clinicalId?.toString();
    


    const appointment = await Appointment.findByIdAndUpdate(id, updates, {
      new: true,
    })
      .populate("patientId", "firstName lastName")
      .populate("clinicalId", "firstName lastName")
      .lean();

    if (!appointment) return null;

    // Send notification if clinical assignment changed
    if (newClinicalId && newClinicalId !== prevClinicalId) {

      try {
        const { notificationService } = await import("./notificationService");
        // Defensive: patientId may be ObjectId or object
        let patientName = "";
        if (appointment.patientId && typeof appointment.patientId === "object" && 'firstName' in appointment.patientId && 'lastName' in appointment.patientId) {
          patientName = `${appointment.patientId.firstName} ${appointment.patientId.lastName}`;
        }
        const appointmentDate = new Date(appointment.appointmentDate).toLocaleDateString();
        const notificationTitle = "New Appointment Assigned";
        const notificationMessage = `You have a new appointment with ${patientName} on ${appointmentDate}.`;
        const notificationData = {
          appointmentId: appointment._id.toString(),
          patientId: appointment.patientId && appointment.patientId._id ? appointment.patientId._id.toString() : "",
          patientName,
          appointmentDate: appointment.appointmentDate,
          appointmentType: appointment.type,
          duration: appointment.duration,
        };



        await notificationService.createNotification(
          newClinicalId,
          "general",
          notificationTitle,
          notificationMessage,
          notificationData
        );

      } catch (error) {
        console.error("❌ Failed to send appointment reassignment notification:", error);
      }
    } else {

    }

    return {
      ...appointment,
      id: appointment._id.toString(),
      patient: {
        ...appointment.patientId,
        id: appointment.patientId && appointment.patientId._id ? appointment.patientId._id.toString() : appointment.patientId?.toString?.() || "",
      },
      clinical: {
        ...appointment.clinicalId,
        id: appointment.clinicalId && appointment.clinicalId._id ? appointment.clinicalId._id.toString() : appointment.clinicalId?.toString?.() || "",
      },
    };
  }

  async updateAppointmentStatus(id: string, newStatus: string) {
    try {
      const appointment = await Appointment.findByIdAndUpdate(
        id,
        { 
          status: newStatus,
          updatedAt: new Date()
        },
        { new: true }
      ).populate("patientId", "firstName lastName")
       .populate("clinicalId", "firstName lastName")
       .lean();

      if (!appointment) {
        throw new Error("Appointment not found");
      }

      return {
        ...appointment,
        id: appointment._id.toString(),
        patient: appointment.patientId ? {
          ...appointment.patientId,
          id: appointment.patientId._id.toString(),
        } : null,
        clinical: appointment.clinicalId ? {
          ...appointment.clinicalId,
          id: appointment.clinicalId._id.toString(),
        } : null,
      };
    } catch (error) {
      console.error("Storage: Error updating appointment status:", error);
      throw error;
    }
  }

  async deleteAppointment(id: string) {

    try {
      const deletedAppointment = await Appointment.findByIdAndDelete(id);

      return deletedAppointment;
    } catch (error) {
      console.error("Storage: Error deleting appointment:", error);
      throw error;
    }
  }

  async getAllAppointments() {
    try {
      const appointments = await Appointment.find({})
        .populate("patientId", "firstName lastName")
        .populate("clinicalId", "firstName lastName")
        .sort({ createdAt: -1 })
        .lean();

      return appointments.map((apt: any) => ({
        ...apt,
        id: apt._id.toString(),
        patient: apt.patientId ? {
          ...apt.patientId,
          id: apt.patientId._id.toString(),
        } : null,
        clinical: apt.clinicalId ? {
          ...apt.clinicalId,
          id: apt.clinicalId._id.toString(),
        } : null,
      }));
    } catch (error) {
      console.error("Storage: Error getting all appointments:", error);
      throw error;
    }
  }

  async getTodayAppointments(clinicalId?: string) {
    const today = new Date();
    const startOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    const endOfDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + 1,
    );

    const query: any = {
      appointmentDate: { $gte: startOfDay, $lt: endOfDay },
    };
    if (clinicalId) {
      query.clinicalId = clinicalId;
    }

    const appointments = await Appointment.find(query)
      .populate("patientId", "firstName lastName")
      .populate("clinicalId", "firstName lastName")
      .sort({ createdAt: -1 })
      .lean();

    return appointments.map((apt: any) => ({
      ...apt,
      id: apt._id.toString(),
      patient: apt.patientId ? {
        ...apt.patientId,
        id: apt.patientId._id.toString(),
      } : null,
      clinical: apt.clinicalId ? {
        ...apt.clinicalId,
        id: apt.clinicalId._id.toString(),
      } : null,
    }));
  }

  async getAllTreatmentRecords(query: any = {}) {

    // If searching by patientName, use aggregation
    let useAggregation = false;
    let searchRegex = null;
    if (query.$or) {
      for (const cond of query.$or) {
        if (cond.patientName && cond.patientName.$regex) {
          useAggregation = true;
          searchRegex = cond.patientName.$regex;
          break;
        }
      }
    }
    if (useAggregation && searchRegex) {
      // Remove patientName from $or
      const newOr = query.$or.filter((cond: any) => !cond.patientName);
      // Build aggregation pipeline
      const pipeline: any[] = [
        { $lookup: {
            from: "patients",
            localField: "patientId",
            foreignField: "_id",
            as: "patientObj"
        }},
        { $unwind: "$patientObj" },
        { $lookup: {
            from: "users",
            localField: "therapistId",
            foreignField: "_id",
            as: "therapistObj"
        }},
        { $unwind: { path: "$therapistObj", preserveNullAndEmptyArrays: true } },
        { $match: {
            $or: [
              ...newOr,
              { "patientObj.firstName": { $regex: searchRegex, $options: "i" } },
              { "patientObj.lastName": { $regex: searchRegex, $options: "i" } }
            ],
            ...(query.patientId ? { patientId: query.patientId } : {}),
            ...(query.therapistId ? { therapistId: query.therapistId } : {}),
            ...(query.sessionType ? { sessionType: query.sessionType } : {}),
            ...(query.sessionDate ? { sessionDate: query.sessionDate } : {}),
          }
        },
        { $sort: { sessionDate: -1 } },
      ];
      const records = await TreatmentRecord.aggregate(pipeline);
      // Transform for frontend
      const transformedRecords = records.map((record: any) => ({
        ...record,
        id: record._id.toString(),
        patient: {
          _id: record.patientObj._id,
          firstName: record.patientObj.firstName,
          lastName: record.patientObj.lastName,
        },
        therapist: record.therapistObj
          ? {
              _id: record.therapistObj._id,
              firstName: record.therapistObj.firstName,
              lastName: record.therapistObj.lastName,
            }
          : undefined,
      }));
      return transformedRecords;
    } else {
      // Fallback to normal query
      const records = await TreatmentRecord.find(query)
        .sort({ sessionDate: -1 })
        .populate("patientId", "firstName lastName")
        .populate("clinicalId", "firstName lastName")
        .lean();
      const transformedRecords = records.map((record: any) => ({
        ...record,
        id: record._id.toString(),
        patient:
          record.patientId && typeof record.patientId === 'object' && 'firstName' in record.patientId
            ? record.patientId
            : undefined,
        therapist:
          record.therapistId && typeof record.therapistId === 'object' && 'firstName' in record.therapistId
            ? record.therapistId
            : undefined,
      }));
      return transformedRecords;
    }
  }

  async getTreatmentRecords(patientId: string) {


    const records = await TreatmentRecord.find({ patientId })
      .sort({ sessionDate: -1 })
      .populate("patientId", "firstName lastName")
      .populate("clinicalId", "firstName lastName")
      .lean();



    const transformedRecords = records.map((record: any) => {
      const transformed = {
        ...record,
        id: record._id.toString(),
        patient: record.patientId,
        clinical: record.clinicalId,
      };
      console.log("Transformed record clinical:", transformed.clinical);
      return transformed;
    });

    console.log("Transformed records count:", transformedRecords.length);
    return transformedRecords;
  }

  async getTreatmentRecord(id: string) {
    const record = await TreatmentRecord.findById(id)
      .populate("patientId", "firstName lastName")
      .populate("clinicalId", "firstName lastName")
      .lean();

    if (!record) return null;

    return {
      ...record,
      id: record._id.toString(),
      patient: record.patientId,
      clinical: record.clinicalId,
    };
  }

  async createTreatmentRecord(record: any) {
    // Fetch patient to get name
    const patient = await PatientModel.findById(record.patientId).lean();
    const patientName = patient ? `${patient.firstName} ${patient.lastName}` : '';
    const newRecord = new TreatmentRecord({ ...record, patientName });
    await newRecord.save();

    // Fetch the record with populated data
    const populatedRecord = await TreatmentRecord.findById(newRecord._id)
      .populate("patientId", "firstName lastName")
      .populate("clinicalId", "firstName lastName")
      .lean();

    if (!populatedRecord) {
      throw new Error("Failed to create treatment record");
    }

    // Send notification to the assigned therapist
    try {
      const { notificationService } = require("./notificationService");
      // Type-safe access to populated patient data
      const patientData = populatedRecord.patientId as any;
      const patientName = patientData && typeof patientData === 'object' && 'firstName' in patientData && 'lastName' in patientData
        ? `${patientData.firstName} ${patientData.lastName}`
        : 'Unknown Patient';
      const sessionDate = new Date(populatedRecord.sessionDate).toLocaleDateString();
      const notificationTitle = "New Treatment Record Assigned";
      const notificationMessage = `You have a new treatment record for ${patientName} from ${sessionDate}.`;
      const notificationData = {
        treatmentRecordId: populatedRecord._id.toString(),
        patientId: patientData && patientData._id ? patientData._id.toString() : "",
        patientName,
        sessionDate: populatedRecord.sessionDate,
        sessionType: populatedRecord.sessionType,
      };

      await notificationService.createNotification(
        populatedRecord.clinicalId._id.toString(),
        "general",
        notificationTitle,
        notificationMessage,
        notificationData
      );
    } catch (error) {
      console.error("Failed to send treatment record assignment notification:", error);
    }

    const obj = {
      ...populatedRecord,
      id: populatedRecord._id.toString(),
      patient: populatedRecord.patientId,
      clinical: populatedRecord.clinicalId,
    };

    return obj;
  }

  async updateTreatmentRecord(id: string, record: any) {
    // Fetch patient to get name
    let patientName = record.patientName;
    if (!patientName && record.patientId) {
      const patient = await PatientModel.findById(record.patientId).lean();
      patientName = patient ? `${patient.firstName} ${patient.lastName}` : '';
    }
    const updated = await TreatmentRecord.findByIdAndUpdate(id, { ...record, patientName }, {
      new: true,
    })
      .populate("patientId", "firstName lastName")
      .populate("clinicalId", "firstName lastName")
      .lean();

    if (!updated) return null;

    return {
      ...updated,
      id: updated._id.toString(),
      patient: updated.patientId,
      therapist: updated.clinicalId,
    };
  }

  async deleteTreatmentRecord(id: string) {
    await TreatmentRecord.findByIdAndDelete(id);
  }

  async countTreatmentRecords(query: any = {}) {
    // If searching by patientName, use aggregation for accurate count
    let useAggregation = false;
    let searchRegex = null;
    if (query.$or) {
      for (const cond of query.$or) {
        if (cond.patientName && cond.patientName.$regex) {
          useAggregation = true;
          searchRegex = cond.patientName.$regex;
          break;
        }
      }
    }
    
    if (useAggregation && searchRegex) {
      // Remove patientName from $or
      const newOr = query.$or.filter((cond: any) => !cond.patientName);
      // Build aggregation pipeline for counting
      const pipeline: any[] = [
        { $lookup: {
            from: "patients",
            localField: "patientId",
            foreignField: "_id",
            as: "patientObj"
        }},
        { $unwind: "$patientObj" },
        { $lookup: {
            from: "users",
            localField: "therapistId",
            foreignField: "_id",
            as: "therapistObj"
        }},
        { $unwind: { path: "$therapistObj", preserveNullAndEmptyArrays: true } },
        { $match: {
            $or: [
              ...newOr,
              { "patientObj.firstName": { $regex: searchRegex, $options: "i" } },
              { "patientObj.lastName": { $regex: searchRegex, $options: "i" } }
            ],
            ...(query.patientId ? { patientId: query.patientId } : {}),
            ...(query.therapistId ? { therapistId: query.therapistId } : {}),
            ...(query.sessionType ? { sessionType: query.sessionType } : {}),
            ...(query.sessionDate ? { sessionDate: query.sessionDate } : {}),
          }
        },
        { $count: "total" }
      ];
      const result = await TreatmentRecord.aggregate(pipeline);
      return result.length > 0 ? result[0].total : 0;
    } else {
      // Fallback to normal count
      return await TreatmentRecord.countDocuments(query);
    }
  }

  async getDashboardStats() {
    const totalPatients = await PatientModel.countDocuments();


    // Get today's appointments
    const todayAppointments = await this.getTodayAppointments();
    const todayAppointmentsCount = todayAppointments.length;

    // Get all appointments for stats
    const allAppointments = await Appointment.find().lean();

    // Calculate stats
    const completedAppointments = allAppointments.filter(
      (apt) => apt.status === "completed",
    ).length;
    const upcomingAppointments = allAppointments.filter(
      (apt) => apt.status === "scheduled",
    ).length;
    const appointmentsNeedingReview = allAppointments.filter(
      (apt) => apt.status === "completed" && !apt.notes,
    ).length;

    // Calculate monthly stats (current month)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const monthlyAppointments = allAppointments.filter((apt) => {
      const aptDate = new Date(apt.appointmentDate);
      return aptDate >= startOfMonth && aptDate < endOfMonth;
    }).length;

    // Calculate new patients added this month
    const newPatientsThisMonth = await PatientModel.countDocuments({
      createdAt: { $gte: startOfMonth, $lt: endOfMonth }
    });

    // Calculate enhanced treatment completion rate
    let completionStats;
    try {
      const { TreatmentCompletionService } = await import('./treatmentCompletionService');
      completionStats = await TreatmentCompletionService.calculateTreatmentCompletionRate();
    } catch (error) {
      console.error('Error calculating treatment completion rate:', error);
      // Fallback to simple calculation for existing patients
      const dischargedPatients = await PatientModel.countDocuments({ status: "discharged" });
      const totalPatientsEver = await PatientModel.countDocuments();
      const treatmentCompletionRate = totalPatientsEver > 0 
        ? Math.round((dischargedPatients / totalPatientsEver) * 100) 
        : 0;
      
      completionStats = {
        rate: treatmentCompletionRate,
        breakdown: {
          manuallyDischarged: dischargedPatients,
          autoDischarged: 0,
          eligibleForDischarge: 0
        }
      };
    }

    // Count active treatments (patients with active status)
    const activeTreatments = await PatientModel.countDocuments({
      status: "active",
    });

    // Count discharged patients only (for archive page consistency)
    const archivedPatients = await PatientModel.countDocuments({
      status: "discharged"
    });

    const stats = {
      totalPatients,
      todayAppointments: todayAppointmentsCount,
      activeTreatments,
      treatmentCompletionRate: completionStats.rate,
      treatmentCompletionBreakdown: completionStats.breakdown,
      monthlyAppointments,
      newPatientsThisMonth,
      completedAppointments,
      upcomingAppointments,
      appointmentsNeedingReview,
      archivedPatients,
    };


    return stats;
  }

  async createAuditLog(log: any) {
    try {
      // Check if database is initialized
      if (!this.db) {
        console.warn("Database not initialized, skipping audit log creation");
        return null;
      }

      // Log all user activities (including admin users) for proper tracking
      // Removed admin user exclusion to ensure proper audit trail

      const auditLog = {
        _id: new mongoose.Types.ObjectId(),
        userId: log.userId,
        action: log.action,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        details: log.details,
        timestamp: log.timestamp || new Date(),
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        sessionId: log.sessionId,
      };

      await this.db.collection("auditLogs").insertOne(auditLog);
      return auditLog;
    } catch (error) {
      console.error("Error creating audit log:", error);
      // Don't throw error to prevent breaking the main operation
      return null;
    }
  }

  async getAuditLogs(filters?: any) {
    try {
      let query: any = {};

      if (filters?.userId) {
        query.userId = filters.userId;
      }
      if (filters?.action) {
        query.action = filters.action;
      }
      if (filters?.resourceType) {
        query.resourceType = filters.resourceType;
      }
      if (filters?.resourceId) {
        query.resourceId = filters.resourceId;
      }
      if (filters?.startDate || filters?.endDate) {
        query.timestamp = {};
        if (filters.startDate) {
          query.timestamp.$gte = filters.startDate;
        }
        if (filters.endDate) {
          query.timestamp.$lte = filters.endDate;
        }
      }
      if (filters?.search) {
        query.$or = [
          { userId: { $regex: filters.search, $options: "i" } },
          { action: { $regex: filters.search, $options: "i" } },
          { resourceType: { $regex: filters.search, $options: "i" } },
          { resourceId: { $regex: filters.search, $options: "i" } },
        ];
      }

      const logs = await this.db
        .collection("auditLogs")
        .find(query)
        .sort({ timestamp: -1 })
        .limit(filters?.limit || 100)
        .skip(filters?.offset || 0)
        .toArray();

      // Sort logs to prioritize system activities at the top
      const systemActions = ['login', 'logout', 'password_reset', 'emergency_access'];
      
      const sortedLogs = logs.sort((a: any, b: any) => {
        const aIsSystem = systemActions.includes(a.action);
        const bIsSystem = systemActions.includes(b.action);
        
        // If both are system actions or both are not, sort by timestamp (newest first)
        if (aIsSystem === bIsSystem) {
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        }
        
        // System actions come first
        return aIsSystem ? -1 : 1;
      });

      return sortedLogs;
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      return [];
    }
  }

  async getAuditSummary(days: number = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const logs = await this.db
        .collection("auditLogs")
        .find({ timestamp: { $gte: cutoffDate } })
        .toArray();

      const actionsByType: Record<string, number> = {};
      const actionsByUser: Record<string, number> = {};

      logs.forEach((log: any) => {
        actionsByType[log.action] = (actionsByType[log.action] || 0) + 1;
        actionsByUser[log.userId] = (actionsByUser[log.userId] || 0) + 1;
      });

      return {
        totalActions: logs.length,
        actionsByType,
        actionsByUser,
        recentActivity: logs.slice(0, 10),
      };
    } catch (error) {
      console.error("Error getting audit summary:", error);
      return {
        totalActions: 0,
        actionsByType: {},
        actionsByUser: {},
        recentActivity: [],
      };
    }
  }

  async getStaff() {
    const staff = await User.find().lean();
    return staff.map((user) => {
      const { _id, ...rest } = user;
      return {
        ...rest,
        id: _id.toString(),
      };
    });
  }

  async getClinicals() {
    const clinicals = await User.find({ role: "clinical" }).lean();
    return clinicals.map((user) => {
      const { _id, ...rest } = user;
      return {
        ...rest,
        id: _id.toString(),
      };
    });
  }

  async getTherapists() {
    const therapists = await User.find({ role: "therapist" }).lean();
    return therapists.map((user) => {
      const { _id, ...rest } = user;
      return {
        ...rest,
        id: _id.toString(),
      };
    });
  }

  async updateUser(id: string, userData: any) {
    try {
      // Remove updatedAt from userData if it exists, let Mongoose handle it
      const { updatedAt, ...dataToUpdate } = userData;
      

      
      const updatedUser = await User.findByIdAndUpdate(
        id, 
        { ...dataToUpdate, updatedAt: new Date() }, 
        { 
          new: true,
          runValidators: true 
        }
      ).lean();
      
      if (!updatedUser) {

        return undefined;
      }
      
      const { _id, ...rest } = updatedUser;
      return {
        ...rest,
        id: _id.toString(),
      };
    } catch (error) {
      console.error("Error in updateUser:", error);
      throw error;
    }
  }

  async deleteUser(id: string) {
    await User.findByIdAndDelete(id);
  }

  async getUsersByRole(roles: string[]) {
    return User.find({ role: { $in: roles } }).select('_id firstName lastName email role');
  }

  // Inquiry management methods
  async addInquiry(patientId: string, inquiryData: any) {
    const patient = await PatientModel.findById(patientId);
    if (!patient) {
      throw new Error("Patient not found");
    }

    const inquiry = {
      _id: new mongoose.Types.ObjectId(),
      ...inquiryData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    patient.inquiries.push(inquiry);
    await patient.save();

    const { _id, ...rest } = patient.toObject();
    return {
      ...rest,
      id: _id.toString(),
      assignedTherapist: undefined,
    };
  }

  async updateInquiry(patientId: string, inquiryId: string, updateData: any) {
    const patient = await PatientModel.findById(patientId);
    if (!patient) {
      throw new Error("Patient not found");
    }

    const inquiry = patient.inquiries.id(inquiryId);
    if (!inquiry) {
      throw new Error("Inquiry not found");
    }

    // Detect assignment change
    const prevAssignedTo = inquiry.assignedTo?.toString();
    Object.assign(inquiry, updateData, { updatedAt: new Date() });
    await patient.save();

    // If assignedTo is set and changed, send notification
    if (
      updateData.assignedTo &&
      updateData.assignedTo.toString() !== prevAssignedTo
    ) {
      // Fetch assigned user for name/email
      const assignedUser = await User.findById(updateData.assignedTo).lean();
      if (assignedUser) {
        const patientName = `${patient.firstName} ${patient.lastName}`;
        const notificationTitle = "New Inquiry Assigned";
        const notificationMessage = `You have been assigned a new inquiry for patient ${patientName}.`;
        const notificationData = {
          inquiryId: inquiry._id.toString(),
          patientId: patient._id.toString(),
          patientName,
          inquiryType: inquiry.inquiryType,
          priority: inquiry.priority,
        };
        // In-app notification only
        const { notificationService } = require("./notificationService");
        await notificationService.createNotification(
          assignedUser._id.toString(),
          "inquiry_received",
          notificationTitle,
          notificationMessage,
          notificationData
        );
      }
    }

    const { _id, ...rest } = patient.toObject();
    return {
      ...rest,
      id: _id.toString(),
      assignedTherapist: undefined,
    };
  }

  async getInquiries(filters: {
    status?: string;
    priority?: string;
    assignedTo?: string;
  }) {
    const query: any = {};

    if (filters.status) {
      query["inquiries.status"] = filters.status;
    }
    if (filters.priority) {
      query["inquiries.priority"] = filters.priority;
    }
    if (filters.assignedTo) {
      query["inquiries.assignedTo"] = filters.assignedTo;
    }

    const patients = await PatientModel.find(query)
      .populate("inquiries.assignedTo", "firstName lastName email")
      .populate("inquiries.createdBy", "firstName lastName email")
      .lean();

    const inquiries: any[] = [];
    patients.forEach((patient) => {
      patient.inquiries?.forEach((inquiry: any) => {
        if (this.matchesFilters(inquiry, filters)) {
          inquiries.push({
            ...inquiry,
            id: inquiry._id.toString(),
            patientId: patient._id.toString(),
            patientName: `${patient.firstName} ${patient.lastName}`,
            patientEmail: patient.email,
            patientPhone: patient.phone,
          });
        }
      });
    });

    return inquiries.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  private matchesFilters(
    inquiry: any,
    filters: { status?: string; priority?: string; assignedTo?: string },
  ) {
    if (filters.status && inquiry.status !== filters.status) return false;
    if (filters.priority && inquiry.priority !== filters.priority) return false;
    if (filters.assignedTo && inquiry.assignedTo !== filters.assignedTo) return false;
    return true;
  }

  // Settings operations
  async getPracticeSettings() {
    try {
      // For now, we'll use a simple approach - store settings in a collection
      // In a real app, you might want to use a more sophisticated approach
      const settings = await this.db.collection('practice_settings').findOne({});
      
      if (!settings) {
        // Return default settings if none exist
        return {
          practiceName: "New Life Mental Health",
          address: "123 Main Street, City, State 12345",
          phone: "(555) 123-4567",
          email: "info@newlife.com",
          businessHours: "Monday - Friday: 9:00 AM - 6:00 PM\nSaturday: 10:00 AM - 2:00 PM\nSunday: Closed",
          updatedAt: new Date(),
          updatedBy: null
        };
      }
      
      return {
        practiceName: settings.practiceName || "",
        address: settings.address || "",
        phone: settings.phone || "",
        email: settings.email || "",
        businessHours: settings.businessHours || "",
        updatedAt: settings.updatedAt || new Date(),
        updatedBy: settings.updatedBy || null
      };
    } catch (error) {
      console.error("Error fetching practice settings:", error);
      throw error;
    }
  }

  async updatePracticeSettings(settings: any, userId: string) {
    // Implementation for updating practice settings

    return { success: true };
  }

  // Notification methods
  async createNotification(notification: Notification): Promise<void> {

    
    try {
      await NotificationModel.create(notification);

    } catch (error) {
      console.error("❌ Failed to create notification:", error);
      throw error;
    }
  }

  async getUserNotifications(
    userId: string,
    options?: {
      unreadOnly?: boolean;
      limit?: number;
      offset?: number;
      type?: NotificationType;
    }
  ): Promise<Notification[]> {
    let query: any = { userId };

    if (options?.unreadOnly) {
      query.read = false;
    }

    if (options?.type) {
      query.type = options.type;
    }

    let queryBuilder = NotificationModel.find(query).sort({ createdAt: -1 });

    if (options?.offset) {
      queryBuilder = queryBuilder.skip(options.offset);
    }

    if (options?.limit) {
      queryBuilder = queryBuilder.limit(options.limit);
    }

    const notifications = await queryBuilder.lean();
    // Transform the lean result to match the Notification interface
    return notifications.map((notification: any) => ({
      id: notification.id,
      userId: notification.userId,
      type: notification.type as NotificationType,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      read: notification.read,
      createdAt: notification.createdAt,
      expiresAt: notification.expiresAt,
    }));
  }

  async markNotificationAsRead(notificationId: string, userId: string): Promise<boolean> {
    const result = await NotificationModel.updateOne(
      { id: notificationId, userId },
      { read: true }
    );

    return result.modifiedCount > 0;
  }

  async markAllNotificationsAsRead(userId: string): Promise<boolean> {
    const result = await NotificationModel.updateMany(
      { userId, read: false },
      { read: true }
    );

    return result.modifiedCount > 0;
  }

  async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    const result = await NotificationModel.deleteOne({ id: notificationId, userId });
    return result.deletedCount > 0;
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    return NotificationModel.countDocuments({ userId, read: false });
  }

  async cleanupExpiredNotifications(): Promise<number> {
    const result = await NotificationModel.deleteMany({
      expiresAt: { $lt: new Date() }
    });

    return result.deletedCount || 0;
  }

  // Assessment methods
  async createAssessment(assessment: any) {
    try {
      const savedAssessment = await this.db.collection("assessments").insertOne(assessment);
      const { _id, ...rest } = assessment;
      return {
        ...rest,
        id: savedAssessment.insertedId.toString(),
      };
    } catch (error) {
      console.error("Error creating assessment:", error);
      throw error;
    }
  }

  async getAssessments(patientId: string) {
    try {
      const assessments = await this.db
        .collection("assessments")
        .find({ patientId })
        .sort({ createdAt: -1 })
        .toArray();

      // Populate user information for each assessment
      const assessmentsWithUsers = await Promise.all(
        assessments.map(async (assessment: any) => {
          const { _id, createdBy, ...rest } = assessment;
          
          // Get user information if createdBy exists
          let userInfo = null;
          if (createdBy) {
            try {
              const user = await this.getUser(createdBy);
              if (user) {
                userInfo = {
                  id: user.id,
                  name: `${user.firstName} ${user.lastName}`,
                  role: user.role,
                };
              }
            } catch (error) {
              console.error("Error fetching user for assessment:", error);
            }
          }

          return {
            ...rest,
            id: _id.toString(),
            createdBy: userInfo,
          };
        })
      );

      return assessmentsWithUsers;
    } catch (error) {
      console.error("Error fetching assessments:", error);
      throw error;
    }
  }

  async getAssessment(assessmentId: string) {
    try {
      const assessment = await this.db
        .collection("assessments")
        .findOne({ _id: new mongoose.Types.ObjectId(assessmentId) });

      if (!assessment) return null;

      const { _id, createdBy, ...rest } = assessment;
      
      // Get user information if createdBy exists
      let userInfo = null;
      if (createdBy) {
        try {
          const user = await this.getUser(createdBy);
          if (user) {
            userInfo = {
              id: user.id,
              name: `${user.firstName} ${user.lastName}`,
              role: user.role,
            };
          }
        } catch (error) {
          console.error("Error fetching user for assessment:", error);
        }
      }

      return {
        ...rest,
        id: _id.toString(),
        createdBy: userInfo,
      };
    } catch (error) {
      console.error("Error fetching assessment:", error);
      throw error;
    }
  }

  async updateAssessment(assessmentId: string, updateData: any) {
    try {
      const result = await this.db
        .collection("assessments")
        .findOneAndUpdate(
          { _id: new mongoose.Types.ObjectId(assessmentId) },
          { $set: updateData },
          { returnDocument: "after" }
        );

      if (!result) return null;

      const { _id, ...rest } = result;
      return {
        ...rest,
        id: _id.toString(),
      };
    } catch (error) {
      console.error("Error updating assessment:", error);
      throw error;
    }
  }

  async deleteAssessment(assessmentId: string) {
    try {
      const result = await this.db
        .collection("assessments")
        .deleteOne({ _id: new mongoose.Types.ObjectId(assessmentId) });

      return result.deletedCount > 0;
    } catch (error) {
      console.error("Error deleting assessment:", error);
      throw error;
    }
  }

  // Treatment Outcomes Storage Functions
  async createTreatmentOutcome(data: any) {
    try {
      console.log("Storage: Creating treatment outcome with data:", JSON.stringify(data, null, 2));
      
      const outcome = new TreatmentOutcome(data);
      console.log("Storage: TreatmentOutcome model created:", outcome);
      
      const savedOutcome = await outcome.save();
      console.log("Storage: Treatment outcome saved successfully:", savedOutcome._id);
      
      const populatedOutcome = await outcome.populate([
        { path: "patientId", select: "firstName lastName dateOfBirth" },
        { path: "therapistId", select: "firstName lastName" },
        { path: "createdBy", select: "firstName lastName" },
      ]);
      
      console.log("Storage: Treatment outcome populated and returned:", populatedOutcome._id);
      return populatedOutcome;
    } catch (error) {
      console.error("Storage: Error creating treatment outcome:", error);
      if (error instanceof Error) {
        console.error("Storage: Error details:", error.message);
        console.error("Storage: Error stack:", error.stack);
      }
      throw error;
    }
  }

  async getTreatmentOutcome(id: string) {
    try {
      const outcome = await TreatmentOutcome.findById(id).populate([
        { path: "patientId", select: "firstName lastName dateOfBirth" },
        { path: "therapistId", select: "firstName lastName" },
        { path: "createdBy", select: "firstName lastName" },
        { path: "updatedBy", select: "firstName lastName" },
      ]);
      return outcome;
    } catch (error) {
      console.error("Error getting treatment outcome:", error);
      throw error;
    }
  }

  async getPatientTreatmentOutcomes(
    patientId: string,
    limit: number = 50,
    offset: number = 0
  ) {
    try {
      const outcomes = await TreatmentOutcome.find({ patientId })
        .sort({ assessmentDate: -1 })
        .limit(limit)
        .skip(offset)
        .populate([
          { path: "therapistId", select: "firstName lastName" },
          { path: "createdBy", select: "firstName lastName" },
        ]);

      const total = await TreatmentOutcome.countDocuments({ patientId });

      return {
        outcomes,
        total,
        hasMore: offset + outcomes.length < total,
      };
    } catch (error) {
      console.error("Error getting patient treatment outcomes:", error);
      throw error;
    }
  }

  async getPatientTreatmentRecords(patientId: string) {
    try {
      const records = await TreatmentRecord.find({ patientId })
        .populate('clinicalId', 'firstName lastName')
        .sort({ assessmentDate: -1 });
      return records;
    } catch (error) {
      console.error("Error getting patient treatment records:", error);
      throw error;
    }
  }

  async getPatientDischargeRequests(patientId: string) {
    try {
      const patient = await PatientModel.findById(patientId).lean();
      if (!patient || !patient.dischargeRequests) {
        return [];
      }
      return patient.dischargeRequests;
    } catch (error) {
      console.error("Error getting patient discharge requests:", error);
      throw error;
    }
  }

  async getPatientNotes(patientId: string) {
    try {
      const notes = await PatientNote.find({ patientId })
        .populate('createdBy', 'firstName lastName')
        .sort({ createdAt: -1 });
      return notes;
    } catch (error) {
      console.error("Error getting patient notes:", error);
      throw error;
    }
  }

  async getTherapistTreatmentOutcomes(
    therapistId: string,
    limit: number = 50,
    offset: number = 0
  ) {
    try {
      const outcomes = await TreatmentOutcome.find({ therapistId })
        .sort({ assessmentDate: -1 })
        .limit(limit)
        .skip(offset)
        .populate([
          { path: "patientId", select: "firstName lastName dateOfBirth" },
          { path: "createdBy", select: "firstName lastName" },
        ]);

      const total = await TreatmentOutcome.countDocuments({ therapistId });

      return {
        outcomes,
        total,
        hasMore: offset + outcomes.length < total,
      };
    } catch (error) {
      console.error("Error getting therapist treatment outcomes:", error);
      throw error;
    }
  }

  async getAllTreatmentOutcomes(
    limit: number = 50,
    offset: number = 0,
    search?: string,
    patientId?: string,
    therapistId?: string,
    startDate?: Date,
    endDate?: Date
  ) {
    try {
      const filter: any = {};

      if (patientId) filter.patientId = patientId;
      if (therapistId) filter.therapistId = therapistId;
      if (startDate || endDate) {
        filter.assessmentDate = {};
        if (startDate) filter.assessmentDate.$gte = startDate;
        if (endDate) filter.assessmentDate.$lte = endDate;
      }

      const outcomes = await TreatmentOutcome.find(filter)
        .sort({ assessmentDate: -1 })
        .limit(limit)
        .skip(offset)
        .populate([
          { path: "patientId", select: "firstName lastName dateOfBirth" },
          { path: "therapistId", select: "firstName lastName" },
          { path: "createdBy", select: "firstName lastName" },
        ]);

      const total = await TreatmentOutcome.countDocuments(filter);

      return {
        outcomes,
        total,
        hasMore: offset + outcomes.length < total,
      };
    } catch (error) {
      console.error("Error getting all treatment outcomes:", error);
      throw error;
    }
  }

  async updateTreatmentOutcome(
    id: string,
    data: any,
    userId: string
  ) {
    try {
      const outcome = await TreatmentOutcome.findByIdAndUpdate(
        id,
        { ...data, updatedBy: userId },
        { new: true, runValidators: true }
      ).populate([
        { path: "patientId", select: "firstName lastName dateOfBirth" },
        { path: "therapistId", select: "firstName lastName" },
        { path: "createdBy", select: "firstName lastName" },
        { path: "updatedBy", select: "firstName lastName" },
      ]);

      if (!outcome) {
        throw new Error("Treatment outcome not found");
      }

      return outcome;
    } catch (error) {
      console.error("Error updating treatment outcome:", error);
      throw error;
    }
  }

  async deleteTreatmentOutcome(id: string) {
    try {
      const outcome = await TreatmentOutcome.findByIdAndDelete(id);
      if (!outcome) {
        throw new Error("Treatment outcome not found");
      }
      return outcome;
    } catch (error) {
      console.error("Error deleting treatment outcome:", error);
      throw error;
    }
  }

  async getTreatmentOutcomesSummary(
    patientId?: string,
    therapistId?: string,
    startDate?: Date,
    endDate?: Date
  ) {
    try {
      console.log("Storage: getTreatmentOutcomesSummary called with:", { patientId, therapistId, startDate, endDate });
      
      const filter: any = {};

      if (patientId) {
        // Convert string ID to ObjectId for MongoDB query
        filter.patientId = new mongoose.Types.ObjectId(patientId);
        console.log("Storage: Converted patientId to ObjectId:", filter.patientId);
      }
      if (therapistId) {
        filter.therapistId = new mongoose.Types.ObjectId(therapistId);
      }
      if (startDate || endDate) {
        filter.assessmentDate = {};
        if (startDate) filter.assessmentDate.$gte = startDate;
        if (endDate) filter.assessmentDate.$lte = endDate;
      }

      console.log("Storage: Final filter:", JSON.stringify(filter, null, 2));
      
      const outcomes = await TreatmentOutcome.find(filter).sort({
        assessmentDate: -1,
      });
      
      console.log("Storage: Found outcomes count:", outcomes.length);

      if (outcomes.length === 0) {
        return {
          totalAssessments: 0,
          averageDepressionScore: 0,
          averageAnxietyScore: 0,
          averageStressScore: 0,
          improvementTrend: "no_data",
          goalAchievementRate: 0,
          riskLevels: {},
          functionalImprovement: "no_data",
        };
      }

      // Calculate averages
      const depressionScores = outcomes
        .map((o) => o.depressionScore)
        .filter((s) => s !== undefined && s !== null);
      const anxietyScores = outcomes
        .map((o) => o.anxietyScore)
        .filter((s) => s !== undefined && s !== null);
      const stressScores = outcomes
        .map((o) => o.stressScore)
        .filter((s) => s !== undefined && s !== null);

      const averageDepressionScore =
        depressionScores.length > 0
          ? depressionScores.reduce((a, b) => a + b, 0) / depressionScores.length
          : 0;
      const averageAnxietyScore =
        anxietyScores.length > 0
          ? anxietyScores.reduce((a, b) => a + b, 0) / anxietyScores.length
          : 0;
      const averageStressScore =
        stressScores.length > 0
          ? stressScores.reduce((a, b) => a + b, 0) / stressScores.length
          : 0;

      // Calculate improvement trend
      let improvementTrend = "no_data";
      if (outcomes.length >= 2) {
        const first = outcomes[outcomes.length - 1];
        const last = outcomes[0];
        
        if (first.depressionScore && last.depressionScore) {
          const depressionChange = first.depressionScore - last.depressionScore;
          if (depressionChange > 2) improvementTrend = "improving";
          else if (depressionChange < -2) improvementTrend = "declining";
          else improvementTrend = "stable";
        }
      }

      // Calculate goal achievement rate
      const goalProgressCounts = outcomes.reduce((acc, outcome) => {
        if (outcome.goalProgress) {
          acc[outcome.goalProgress] = (acc[outcome.goalProgress] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      const achievedGoals = goalProgressCounts.achieved || 0;
      const exceededGoals = goalProgressCounts.exceeded || 0;
      const totalGoals = Object.values(goalProgressCounts).reduce((a, b) => a + b, 0);
      const goalAchievementRate = totalGoals > 0 ? ((achievedGoals + exceededGoals) / totalGoals) * 100 : 0;

      // Risk level analysis
      const riskLevels = outcomes.reduce((acc, outcome) => {
        if (outcome.riskFactors && outcome.riskFactors.length > 0) {
          outcome.riskFactors.forEach((risk: string) => {
            acc[risk] = (acc[risk] || 0) + 1;
          });
        }
        return acc;
      }, {} as Record<string, number>);

      // Functional improvement analysis
      let functionalImprovement = "no_data";
      if (outcomes.length >= 2) {
        const first = outcomes[outcomes.length - 1];
        const last = outcomes[0];
        
        if (first.dailyFunctioning && last.dailyFunctioning) {
          const functionLevels = ["severe", "poor", "fair", "good", "excellent"];
          const firstIndex = functionLevels.indexOf(first.dailyFunctioning);
          const lastIndex = functionLevels.indexOf(last.dailyFunctioning);
          
          if (lastIndex > firstIndex) functionalImprovement = "improving";
          else if (lastIndex < firstIndex) functionalImprovement = "declining";
          else functionalImprovement = "stable";
        }
      }

      return {
        totalAssessments: outcomes.length,
        averageDepressionScore: Math.round(averageDepressionScore * 100) / 100,
        averageAnxietyScore: Math.round(averageAnxietyScore * 100) / 100,
        averageStressScore: Math.round(averageStressScore * 100) / 100,
        improvementTrend,
        goalAchievementRate: Math.round(goalAchievementRate * 100) / 100,
        riskLevels,
        functionalImprovement,
        lastAssessmentDate: outcomes[0]?.assessmentDate,
        firstAssessmentDate: outcomes[outcomes.length - 1]?.assessmentDate,
      };
    } catch (error) {
      console.error("Error getting treatment outcomes summary:", error);
      throw error;
    }
  }

  async getTreatmentOutcomesAnalytics(startDate?: Date, endDate?: Date) {
    try {
      console.log("Storage: getTreatmentOutcomesAnalytics called with:", { startDate, endDate });
      
      const filter: any = {};

      if (startDate || endDate) {
        filter.assessmentDate = {};
        if (startDate) filter.assessmentDate.$gte = startDate;
        if (endDate) filter.assessmentDate.$lte = endDate;
      }

      const outcomes = await TreatmentOutcome.find(filter)
        .populate('patientId', 'firstName lastName')
        .populate('therapistId', 'firstName lastName')
        .sort({ assessmentDate: -1 });

      if (outcomes.length === 0) {
        return {
          totalAssessments: 0,
          totalPatients: 0,
          averageDepressionScore: 0,
          averageAnxietyScore: 0,
          averageStressScore: 0,
          improvementTrend: "no_data",
          goalAchievementRate: 0,
          riskLevels: {},
          functionalImprovement: "no_data",
          moodDistribution: {},
          therapyEngagement: {},
          medicationEffectiveness: {},
          recentOutcomes: [],
        };
      }

      // Calculate basic metrics
      const uniquePatients = new Set(outcomes.map(o => o.patientId.toString()));
      const totalPatients = uniquePatients.size;

      // Calculate averages
      const depressionScores = outcomes
        .map((o) => o.depressionScore)
        .filter((s) => s !== undefined && s !== null);
      const anxietyScores = outcomes
        .map((o) => o.anxietyScore)
        .filter((s) => s !== undefined && s !== null);
      const stressScores = outcomes
        .map((o) => o.stressScore)
        .filter((s) => s !== undefined && s !== null);

      const averageDepressionScore =
        depressionScores.length > 0
          ? depressionScores.reduce((a, b) => a + b, 0) / depressionScores.length
          : 0;
      const averageAnxietyScore =
        anxietyScores.length > 0
          ? anxietyScores.reduce((a, b) => a + b, 0) / anxietyScores.length
          : 0;
      const averageStressScore =
        stressScores.length > 0
          ? stressScores.reduce((a, b) => a + b, 0) / stressScores.length
          : 0;

      // Calculate improvement trend
      let improvementTrend = "no_data";
      if (outcomes.length >= 2) {
        const first = outcomes[outcomes.length - 1];
        const last = outcomes[0];
        
        if (first.depressionScore && last.depressionScore) {
          const depressionChange = first.depressionScore - last.depressionScore;
          if (depressionChange > 2) improvementTrend = "improving";
          else if (depressionChange < -2) improvementTrend = "declining";
          else improvementTrend = "stable";
        }
      }

      // Calculate goal achievement rate
      const goalProgressCounts = outcomes.reduce((acc, outcome) => {
        if (outcome.goalProgress) {
          acc[outcome.goalProgress] = (acc[outcome.goalProgress] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      const achievedGoals = goalProgressCounts.achieved || 0;
      const exceededGoals = goalProgressCounts.exceeded || 0;
      const totalGoals = Object.values(goalProgressCounts).reduce((a, b) => a + b, 0);
      const goalAchievementRate = totalGoals > 0 ? ((achievedGoals + exceededGoals) / totalGoals) * 100 : 0;

      // Risk level analysis
      const riskLevels = outcomes.reduce((acc, outcome) => {
        if (outcome.riskFactors && outcome.riskFactors.length > 0) {
          outcome.riskFactors.forEach((risk: string) => {
            acc[risk] = (acc[risk] || 0) + 1;
          });
        }
        return acc;
      }, {} as Record<string, number>);

      // Functional improvement analysis
      let functionalImprovement = "no_data";
      if (outcomes.length >= 2) {
        const first = outcomes[outcomes.length - 1];
        const last = outcomes[0];
        
        if (first.dailyFunctioning && last.dailyFunctioning) {
          const functionLevels = ["severe", "poor", "fair", "good", "excellent"];
          const firstIndex = functionLevels.indexOf(first.dailyFunctioning);
          const lastIndex = functionLevels.indexOf(last.dailyFunctioning);
          
          if (lastIndex > firstIndex) functionalImprovement = "improving";
          else if (lastIndex < firstIndex) functionalImprovement = "declining";
          else functionalImprovement = "stable";
        }
      }

      // Mood distribution
      const moodDistribution = outcomes.reduce((acc, outcome) => {
        if (outcome.moodState) {
          acc[outcome.moodState] = (acc[outcome.moodState] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      // Therapy engagement
      const therapyEngagement = outcomes.reduce((acc, outcome) => {
        if (outcome.therapyEngagement) {
          acc[outcome.therapyEngagement] = (acc[outcome.therapyEngagement] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      // Medication effectiveness
      const medicationEffectiveness = outcomes.reduce((acc, outcome) => {
        if (outcome.medicationEffectiveness) {
          acc[outcome.medicationEffectiveness] = (acc[outcome.medicationEffectiveness] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      // Recent outcomes for detailed view
      const recentOutcomes = outcomes.slice(0, 20).map(outcome => ({
        patientName: `Patient ${outcome.patientId || 'Unknown'}`,
        assessmentDate: outcome.assessmentDate,
        depressionScore: outcome.depressionScore || 0,
        anxietyScore: outcome.anxietyScore || 0,
        stressScore: outcome.stressScore || 0,
        goalProgress: outcome.goalProgress || 'not_started',
        moodState: outcome.moodState || 'unknown',
      }));

      return {
        totalAssessments: outcomes.length,
        totalPatients,
        averageDepressionScore: Math.round(averageDepressionScore * 100) / 100,
        averageAnxietyScore: Math.round(averageAnxietyScore * 100) / 100,
        averageStressScore: Math.round(averageStressScore * 100) / 100,
        improvementTrend,
        goalAchievementRate: Math.round(goalAchievementRate * 100) / 100,
        riskLevels,
        functionalImprovement,
        moodDistribution,
        therapyEngagement,
        medicationEffectiveness,
        recentOutcomes,
        lastAssessmentDate: outcomes[0]?.assessmentDate,
        firstAssessmentDate: outcomes[outcomes.length - 1]?.assessmentDate,
      };
    } catch (error) {
      console.error("Error getting treatment outcomes analytics:", error);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();
