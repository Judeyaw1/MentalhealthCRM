import { Patient as PatientModel } from "./models/Patient";
import { Appointment } from "./models/Appointment";
import { User } from "./models/User";
import mongoose from "mongoose";
import { TreatmentRecord } from "./models/TreatmentRecord";
import { TreatmentCompletionService } from "./treatmentCompletionService";
import { Notification as NotificationModel } from "./models/Notification";
import { Notification, NotificationType } from "./notificationService";

// Simplified MongoDB-only storage for now
export class DatabaseStorage {
  db: any; // MongoDB database instance
  
  setDatabase(db: any) {
    this.db = db;
  }
  
  // Patient operations
  async getPatients(limit = 50, offset = 0, search?: string, status?: string, createdBy?: string, therapist?: string, loc?: string) {
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

    if (therapist) {
      query.assignedTherapistId = therapist;
    }

    if (loc) {
      query.loc = loc;
    }

    const total = await PatientModel.countDocuments(query);
    const patients = await PatientModel.find(query)
      .populate("assignedTherapistId", "firstName lastName email")
      .populate("createdBy", "firstName lastName email role")
      .limit(limit)
      .skip(offset)
      .sort({ createdAt: -1 })
      .lean()
      .catch((error) => {
        console.error("Error fetching patients with population:", error);
        // If population fails, try without createdBy population
        return PatientModel.find(query)
          .populate("assignedTherapistId", "firstName lastName email")
          .limit(limit)
          .skip(offset)
          .sort({ createdAt: -1 })
          .lean();
      });

    const patientsWithId = patients.map((p) => {
      const { _id, ...rest } = p;
      console.log("Patient createdBy debug:", {
        patientId: _id.toString(),
        hasCreatedBy: !!rest.createdBy,
        createdByData: rest.createdBy,
        createdByType: typeof rest.createdBy,
      });

      const transformed = {
        ...rest,
        id: _id.toString(),
        assignedTherapist: rest.assignedTherapistId || undefined,
        createdBy: rest.createdBy
          ? {
              ...rest.createdBy,
              id: rest.createdBy._id.toString(),
            }
          : undefined,
      };
      console.log("Patient transformation:", {
        originalId: _id,
        transformedId: transformed.id,
        type: typeof transformed.id,
      });
      return transformed;
    });
    console.log(
      "Transformed patients:",
      patientsWithId.map((p) => ({ id: p.id, type: typeof p.id })),
    );
    return { patients: patientsWithId, total };
  }

  async getPatient(id: string) {
    const p = await PatientModel.findById(id)
      .populate("assignedTherapistId", "firstName lastName email")
      .populate("createdBy", "firstName lastName email role")
      .lean();
    if (!p) return undefined;
    const { _id, ...rest } = p;
    return {
      ...rest,
      id: _id.toString(),
      assignedTherapist: undefined,
      createdBy: rest.createdBy
        ? {
            ...rest.createdBy,
            id: rest.createdBy._id.toString(),
          }
        : undefined,
    };
  }

  async createPatient(patient: any) {
    console.log(
      "Storage: Creating patient with data:",
      JSON.stringify(patient, null, 2),
    );

    try {
      // Clean up ObjectId fields - convert empty strings to null
      const cleanedPatient = {
        ...patient,
        assignedTherapistId:
          patient.assignedTherapistId === ""
            ? null
            : patient.assignedTherapistId,
      };

      console.log(
        "Storage: Cleaned patient data:",
        JSON.stringify(cleanedPatient, null, 2),
      );

      const newPatient = new PatientModel(cleanedPatient);
      console.log("Storage: Patient model created, attempting to save...");

      await newPatient.save();
      console.log(
        "Storage: Patient saved successfully with ID:",
        newPatient._id,
      );

      // Debug: Check if createdBy was saved
      console.log("Storage: Checking createdBy field:", {
        savedCreatedBy: newPatient.createdBy,
        createdByType: typeof newPatient.createdBy,
        patientData: newPatient.toObject(),
      });

      // Fetch the patient with populated fields
      const populatedPatient = await PatientModel.findById(newPatient._id)
        .populate("assignedTherapistId", "firstName lastName email")
        .populate("createdBy", "firstName lastName email role")
        .lean();

      if (!populatedPatient) {
        throw new Error("Failed to fetch created patient");
      }

      console.log("Storage: Populated patient data:", {
        createdBy: populatedPatient.createdBy,
        hasCreatedBy: !!populatedPatient.createdBy,
      });

      const { _id, ...rest } = populatedPatient;
      return {
        ...rest,
        id: _id.toString(),
        assignedTherapist: undefined,
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
      assignedTherapistId:
        patient.assignedTherapistId === "" || !patient.assignedTherapistId
          ? null
          : patient.assignedTherapistId,
    };

    // Check if therapist assignment changed
    const prevTherapistId = currentPatient.assignedTherapistId?.toString();
    const newTherapistId = cleanedPatient.assignedTherapistId?.toString();

    const updatedPatient = await PatientModel.findByIdAndUpdate(id, cleanedPatient, {
      new: true,
    }).lean();
    if (!updatedPatient) return undefined;

    // Send notification if therapist assignment changed
    if (newTherapistId && newTherapistId !== prevTherapistId) {
      try {
        const { notificationService } = require("./notificationService");
        const patientName = `${updatedPatient.firstName} ${updatedPatient.lastName}`;
        const notificationTitle = "New Patient Assigned";
        const notificationMessage = `You have been assigned patient ${patientName}.`;
        const notificationData = {
          patientId: updatedPatient._id.toString(),
          patientName,
          reasonForVisit: updatedPatient.reasonForVisit,
          status: updatedPatient.status,
        };

        await notificationService.createNotification(
          newTherapistId,
          "patient_assigned",
          notificationTitle,
          notificationMessage,
          notificationData
        );
      } catch (error) {
        console.error("Failed to send patient assignment notification:", error);
      }
    }

    const { _id, ...rest } = updatedPatient;
    return {
      ...rest,
      id: _id.toString(),
      assignedTherapist: undefined,
    };
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
    const user = await User.findOne({ email }).lean();
    if (!user) return undefined;
    const { _id, ...rest } = user;
    return {
      ...rest,
      id: _id.toString(),
    };
  }

  async createUser(userData: any) {
    const user = new User(userData);
    await user.save();
    const userObj = user.toObject();
    const { _id, ...rest } = userObj;
    return {
      ...rest,
      id: _id.toString(),
    };
  }

  // Removed upsertUser as it's no longer needed

  async getPatientsByTherapist(therapistId: string) {
    return [];
  }

  // Appointments
  async getAppointments(
    therapistId?: string,
    patientId?: string,
    startDate?: Date,
    endDate?: Date,
    search?: string,
  ) {
    const query: any = {};

    if (therapistId) {
      query.therapistId = therapistId;
    }

    if (patientId) {
      query.patientId = patientId;
    }

    if (startDate && endDate) {
      query.appointmentDate = { $gte: startDate, $lte: endDate };
    }

    let appointments = await Appointment.find(query)
      .populate("patientId", "firstName lastName")
      .populate("therapistId", "firstName lastName")
      .sort({ createdAt: -1 })
      .lean();

    console.log("[getAppointments] search:", search);
    console.log(
      "[getAppointments] appointments before filter:",
      appointments.slice(0, 3),
    );
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
        console.log(`[search filter] search='${searchLower}' patientName='${patientName}' match=${match}`);
        return match;
      });
      console.log(
        "[getAppointments] appointments after filter:",
        appointments.slice(0, 3),
      );
    }

    return appointments.map((apt: any) => ({
      ...apt,
      id: apt._id.toString(),
      patient: {
        ...apt.patientId,
        id: apt.patientId._id.toString(),
      },
      therapist: {
        ...apt.therapistId,
        id: apt.therapistId._id.toString(),
      },
    }));
  }

  async getAppointment(id: string) {
    const appointment = await Appointment.findById(id)
      .populate("patientId", "firstName lastName")
      .populate("therapistId", "firstName lastName")
      .lean();

    if (!appointment) return null;

    return {
      ...appointment,
      id: appointment._id.toString(),
      patient: {
        ...appointment.patientId,
        id: appointment.patientId._id.toString(),
      },
      therapist: {
        ...appointment.therapistId,
        id: appointment.therapistId._id.toString(),
      },
    };
  }

  async createAppointment(data: any) {
    const appointmentData = {
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    console.log(
      "Creating appointment with timestamp:",
      appointmentData.createdAt,
    );

    const appointment = new Appointment(appointmentData);
    await appointment.save();

    console.log(
      "Appointment created with ID:",
      appointment._id,
      "Created at:",
      appointment.createdAt,
    );

    // Fetch the appointment with populated data
    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate("patientId", "firstName lastName")
      .populate("therapistId", "firstName lastName")
      .lean();

    if (!populatedAppointment) {
      throw new Error("Failed to create appointment");
    }

    // Send notification to the assigned therapist
    try {
      const { notificationService } = await import("./notificationService");
      const patientName = `${populatedAppointment.patientId.firstName} ${populatedAppointment.patientId.lastName}`;
      const appointmentDate = new Date(populatedAppointment.appointmentDate).toLocaleDateString();
      const notificationTitle = "New Appointment Assigned";
      const notificationMessage = `You have a new appointment with ${patientName} on ${appointmentDate}.`;
      const notificationData = {
        appointmentId: populatedAppointment._id.toString(),
        patientId: populatedAppointment.patientId._id.toString(),
        patientName,
        appointmentDate: populatedAppointment.appointmentDate,
        appointmentType: populatedAppointment.type,
        duration: populatedAppointment.duration,
      };

      await notificationService.createNotification(
        populatedAppointment.therapistId._id.toString(),
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
      therapist: {
        ...populatedAppointment.therapistId,
        id: populatedAppointment.therapistId._id.toString(),
      },
    };
  }

  async updateAppointment(id: string, updates: any) {
    console.log("🔍 updateAppointment called with:", { id, updates });
    
    // Fetch the current appointment to check for therapist reassignment
    const currentAppointment = await Appointment.findById(id).lean();
    if (!currentAppointment) {
      console.log("❌ Current appointment not found");
      return null;
    }

    const prevTherapistId = currentAppointment.therapistId?.toString();
    const newTherapistId = updates.therapistId?.toString();
    
    console.log("🔍 Therapist assignment check:", {
      prevTherapistId,
      newTherapistId,
      hasChanged: newTherapistId && newTherapistId !== prevTherapistId
    });

    const appointment = await Appointment.findByIdAndUpdate(id, updates, {
      new: true,
    })
      .populate("patientId", "firstName lastName")
      .populate("therapistId", "firstName lastName")
      .lean();

    if (!appointment) return null;

    // Send notification if therapist assignment changed
    if (newTherapistId && newTherapistId !== prevTherapistId) {
      console.log("🔔 Sending appointment reassignment notification to:", newTherapistId);
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

        console.log("🔔 Notification data:", notificationData);

        await notificationService.createNotification(
          newTherapistId,
          "general",
          notificationTitle,
          notificationMessage,
          notificationData
        );
        console.log("✅ Appointment reassignment notification sent successfully");
      } catch (error) {
        console.error("❌ Failed to send appointment reassignment notification:", error);
      }
    } else {
      console.log("ℹ️ No therapist change detected, skipping notification");
    }

    return {
      ...appointment,
      id: appointment._id.toString(),
      patient: {
        ...appointment.patientId,
        id: appointment.patientId && appointment.patientId._id ? appointment.patientId._id.toString() : appointment.patientId?.toString?.() || "",
      },
      therapist: {
        ...appointment.therapistId,
        id: appointment.therapistId && appointment.therapistId._id ? appointment.therapistId._id.toString() : appointment.therapistId?.toString?.() || "",
      },
    };
  }

  async deleteAppointment(id: string) {
    console.log("Storage: Deleting appointment with ID:", id);
    try {
      const deletedAppointment = await Appointment.findByIdAndDelete(id);
      console.log("Storage: Delete result:", deletedAppointment);
      return deletedAppointment;
    } catch (error) {
      console.error("Storage: Error deleting appointment:", error);
      throw error;
    }
  }

  async getTodayAppointments(therapistId?: string) {
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
    if (therapistId) {
      query.therapistId = therapistId;
    }

    const appointments = await Appointment.find(query)
      .populate("patientId", "firstName lastName")
      .populate("therapistId", "firstName lastName")
      .sort({ createdAt: -1 })
      .lean();

    return appointments.map((apt: any) => ({
      ...apt,
      id: apt._id.toString(),
      patient: {
        ...apt.patientId,
        id: apt.patientId._id.toString(),
      },
      therapist: {
        ...apt.therapistId,
        id: apt.therapistId._id.toString(),
      },
    }));
  }

  async getAllTreatmentRecords(query: any = {}) {
    console.log("🔍 Storage - getAllTreatmentRecords called with query:", query);
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
        .populate("patientId", "firstName lastName")
        .populate("therapistId", "firstName lastName")
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
    console.log("getTreatmentRecords called with patientId:", patientId);

    const records = await TreatmentRecord.find({ patientId })
      .populate("patientId", "firstName lastName")
      .populate("therapistId", "firstName lastName")
      .lean();

    console.log("Raw records from DB:", records.length);
    if (records.length > 0) {
      console.log("First raw record:", JSON.stringify(records[0], null, 2));
    }

    const transformedRecords = records.map((record: any) => {
      const transformed = {
        ...record,
        id: record._id.toString(),
        patient: record.patientId,
        therapist: record.therapistId,
      };
      console.log("Transformed record therapist:", transformed.therapist);
      return transformed;
    });

    console.log("Transformed records count:", transformedRecords.length);
    return transformedRecords;
  }

  async getTreatmentRecord(id: string) {
    const record = await TreatmentRecord.findById(id)
      .populate("patientId", "firstName lastName")
      .populate("therapistId", "firstName lastName")
      .lean();

    if (!record) return null;

    return {
      ...record,
      id: record._id.toString(),
      patient: record.patientId,
      therapist: record.therapistId,
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
      .populate("therapistId", "firstName lastName")
      .lean();

    if (!populatedRecord) {
      throw new Error("Failed to create treatment record");
    }

    // Send notification to the assigned therapist
    try {
      const { notificationService } = require("./notificationService");
      const patientName = `${populatedRecord.patientId.firstName} ${populatedRecord.patientId.lastName}`;
      const sessionDate = new Date(populatedRecord.sessionDate).toLocaleDateString();
      const notificationTitle = "New Treatment Record Assigned";
      const notificationMessage = `You have a new treatment record for ${patientName} from ${sessionDate}.`;
      const notificationData = {
        treatmentRecordId: populatedRecord._id.toString(),
        patientId: populatedRecord.patientId._id.toString(),
        patientName,
        sessionDate: populatedRecord.sessionDate,
        sessionType: populatedRecord.sessionType,
      };

      await notificationService.createNotification(
        populatedRecord.therapistId._id.toString(),
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
      therapist: populatedRecord.therapistId,
    };
    console.log("Saved treatment record:", obj);
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
      .populate("therapistId", "firstName lastName")
      .lean();

    if (!updated) return null;

    return {
      ...updated,
      id: updated._id.toString(),
      patient: updated.patientId,
      therapist: updated.therapistId,
    };
  }

  async deleteTreatmentRecord(id: string) {
    await TreatmentRecord.findByIdAndDelete(id);
  }

  async countTreatmentRecords(query: any = {}) {
    return await TreatmentRecord.countDocuments(query);
  }

  async getDashboardStats() {
    const totalPatients = await PatientModel.countDocuments();
    console.log("Dashboard stats - totalPatients from DB:", totalPatients);

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

    // Count active treatments (treatment records created this month)
    const activeTreatments = await TreatmentRecord.countDocuments({
      createdAt: { $gte: startOfMonth, $lt: endOfMonth },
    });

    const stats = {
      totalPatients,
      todayAppointments: todayAppointmentsCount,
      activeTreatments,
      treatmentCompletionRate: completionStats.rate,
      treatmentCompletionBreakdown: completionStats.breakdown,
      monthlyAppointments,
      completedAppointments,
      upcomingAppointments,
      appointmentsNeedingReview,
    };

    console.log("Dashboard stats response:", stats);
    return stats;
  }

  async createAuditLog(log: any) {
    try {
      // Check if database is initialized
      if (!this.db) {
        console.warn("Database not initialized, skipping audit log creation");
        return null;
      }

      // Skip logging for admin users
      if (log.userId) {
        const user = await this.getUser(log.userId);
        if (user && user.role === 'admin') {
          console.log("Skipping audit log for admin user:", user.email);
          return null;
        }
      }

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
      
      const sortedLogs = logs.sort((a, b) => {
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
      
      console.log("Storage updateUser called with:", { id, dataToUpdate });
      
      const updatedUser = await User.findByIdAndUpdate(
        id, 
        { ...dataToUpdate, updatedAt: new Date() }, 
        { 
          new: true,
          runValidators: true 
        }
      ).lean();
      
      if (!updatedUser) {
        console.log("No user found with id:", id);
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
    console.log("Updating practice settings:", settings);
    return { success: true };
  }

  // Notification methods
  async createNotification(notification: Notification): Promise<void> {
    console.log("🔔 Creating notification:", {
      id: notification.id,
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      message: notification.message
    });
    
    try {
      await NotificationModel.create(notification);
      console.log("✅ Notification created successfully");
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
    return notifications;
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
}

export const storage = new DatabaseStorage();
