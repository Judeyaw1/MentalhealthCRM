import { Patient as PatientModel } from './models/Patient';
import { Appointment } from './models/Appointment';
import { User } from './models/User';
import mongoose from 'mongoose';
import { TreatmentRecord } from './models/TreatmentRecord';

// Simplified MongoDB-only storage for now
export class DatabaseStorage {
  // Patient operations
  async getPatients(limit = 50, offset = 0, search?: string, status?: string) {
    let query: any = {};
    
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status) {
      query.status = status;
    }
    
    const total = await PatientModel.countDocuments(query);
    const patients = await PatientModel.find(query)
      .limit(limit)
      .skip(offset)
      .sort({ createdAt: -1 })
      .lean();
    
    const patientsWithId = patients.map((p) => {
      const { _id, ...rest } = p;
      const transformed = {
        ...rest,
        id: _id.toString(),
        assignedTherapist: undefined,
      };
      console.log('Patient transformation:', { originalId: _id, transformedId: transformed.id, type: typeof transformed.id });
      return transformed;
    });
    console.log('Transformed patients:', patientsWithId.map(p => ({ id: p.id, type: typeof p.id })));
    return { patients: patientsWithId, total };
  }

  async getPatient(id: string) {
    const p = await PatientModel.findById(id).lean();
    if (!p) return undefined;
    const { _id, ...rest } = p;
    return {
      ...rest,
      id: _id.toString(),
      assignedTherapist: undefined,
    };
  }

  async createPatient(patient: any) {
    console.log('Storage: Creating patient with data:', JSON.stringify(patient, null, 2));
    
    try {
      // Clean up ObjectId fields - convert empty strings to null
      const cleanedPatient = {
        ...patient,
        assignedTherapistId: patient.assignedTherapistId === "" ? null : patient.assignedTherapistId
      };
      
      console.log('Storage: Cleaned patient data:', JSON.stringify(cleanedPatient, null, 2));
      
      const newPatient = new PatientModel(cleanedPatient);
      console.log('Storage: Patient model created, attempting to save...');
      
      await newPatient.save();
      console.log('Storage: Patient saved successfully with ID:', newPatient._id);
      
      const p = newPatient.toObject();
      const { _id, ...rest } = p;
      return {
        ...rest,
        id: _id.toString(),
        assignedTherapist: undefined,
      };
    } catch (error) {
      console.error('Storage: Error saving patient:', error);
      throw error;
    }
  }

  async updatePatient(id: string, patient: any) {
    const updatedPatient = await PatientModel.findByIdAndUpdate(id, patient, { new: true }).lean();
    if (!updatedPatient) return undefined;
    const { _id, ...rest } = updatedPatient;
    return {
      ...rest,
      id: _id.toString(),
      assignedTherapist: undefined,
    };
  }

  async deletePatient(id: string) {
    console.log('Storage: Deleting patient with ID:', id);
    try {
      // First, check if patient has any appointments or treatment records
      const appointments = await Appointment.find({ patientId: id }).lean();
      const treatmentRecords = await TreatmentRecord.find({ patientId: id }).lean();
      
      const appointmentCount = appointments.length;
      const treatmentRecordCount = treatmentRecords.length;
      
      if (appointmentCount > 0 || treatmentRecordCount > 0) {
        const errorMessage = `Cannot delete patient. Patient has ${appointmentCount} appointment(s) and ${treatmentRecordCount} treatment record(s). Please delete these first.`;
        
        // Provide details about what needs to be deleted
        const details = {
          appointments: appointments.map(apt => ({
            id: apt._id.toString(),
            date: apt.appointmentDate,
            status: apt.status
          })),
          treatmentRecords: treatmentRecords.map(record => ({
            id: record._id.toString(),
            date: record.sessionDate,
            type: record.sessionType
          }))
        };
        
        throw new Error(JSON.stringify({ message: errorMessage, details }));
      }
      
      const deletedPatient = await PatientModel.findByIdAndDelete(id);
      if (!deletedPatient) {
        throw new Error('Patient not found');
      }
      
      console.log('Storage: Patient deleted successfully');
      return { success: true, message: 'Patient deleted successfully' };
    } catch (error) {
      console.error('Storage: Error deleting patient:', error);
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
  async getAppointments(therapistId?: string, patientId?: string, startDate?: Date, endDate?: Date) {
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
    
    const appointments = await Appointment.find(query)
      .populate('patientId', 'firstName lastName')
      .populate('therapistId', 'firstName lastName')
      .sort({ createdAt: -1 })
      .lean();
    
    // Debug logging to verify sorting
    if (appointments.length > 0) {
      console.log('Appointments sorted by createdAt (newest first):');
      appointments.slice(0, 3).forEach((apt, index) => {
        console.log(`${index + 1}. ID: ${apt._id}, Created: ${apt.createdAt}, Patient: ${apt.patientId?.firstName} ${apt.patientId?.lastName}`);
      });
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
      .populate('patientId', 'firstName lastName')
      .populate('therapistId', 'firstName lastName')
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
      updatedAt: new Date()
    };
    
    console.log('Creating appointment with timestamp:', appointmentData.createdAt);
    
    const appointment = new Appointment(appointmentData);
    await appointment.save();
    
    console.log('Appointment created with ID:', appointment._id, 'Created at:', appointment.createdAt);
    
    // Fetch the appointment with populated data
    const populatedAppointment = await Appointment.findById(appointment._id)
      .populate('patientId', 'firstName lastName')
      .populate('therapistId', 'firstName lastName')
      .lean();
    
    if (!populatedAppointment) {
      throw new Error('Failed to create appointment');
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
    const appointment = await Appointment.findByIdAndUpdate(id, updates, { new: true })
      .populate('patientId', 'firstName lastName')
      .populate('therapistId', 'firstName lastName')
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

  async deleteAppointment(id: string) {
    console.log('Storage: Deleting appointment with ID:', id);
    try {
      const deletedAppointment = await Appointment.findByIdAndDelete(id);
      console.log('Storage: Delete result:', deletedAppointment);
      return deletedAppointment;
    } catch (error) {
      console.error('Storage: Error deleting appointment:', error);
      throw error;
    }
  }

  async getTodayAppointments() {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    
    console.log('getTodayAppointments - Date range:', {
      today: today.toISOString(),
      startOfDay: startOfDay.toISOString(),
      endOfDay: endOfDay.toISOString()
    });
    
    const appointments = await Appointment.find({
      appointmentDate: { $gte: startOfDay, $lt: endOfDay }
    }).populate('patientId', 'firstName lastName').populate('therapistId', 'firstName lastName').sort({ createdAt: -1 }).lean();
    
    console.log('getTodayAppointments - Found appointments:', appointments.length);
    if (appointments.length > 0) {
      appointments.forEach((apt, index) => {
        console.log(`Today's appointment ${index + 1}:`, {
          id: apt._id,
          patient: apt.patientId && typeof apt.patientId === 'object' ? `${apt.patientId.firstName} ${apt.patientId.lastName}` : 'Unknown',
          appointmentDate: apt.appointmentDate,
          status: apt.status
        });
      });
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

  async getAllTreatmentRecords(query: any = {}) {
    console.log('Fetching treatment records with query:', query);
    const records = await TreatmentRecord.find(query)
      .populate('patientId', 'firstName lastName')
      .populate('therapistId', 'firstName lastName')
      .lean();
    const total = await TreatmentRecord.countDocuments(query);
    console.log('Fetched records:', records.length, 'Total:', total);
    
    const transformedRecords = records.map((record: any) => ({
      ...record,
      id: record._id.toString(),
      patient: record.patientId,
      therapist: record.therapistId,
    }));
    
    return transformedRecords;
  }

  async getTreatmentRecords(patientId: string) {
    console.log('getTreatmentRecords called with patientId:', patientId);
    
    const records = await TreatmentRecord.find({ patientId })
      .populate('patientId', 'firstName lastName')
      .populate('therapistId', 'firstName lastName')
      .lean();
    
    console.log('Raw records from DB:', records.length);
    if (records.length > 0) {
      console.log('First raw record:', JSON.stringify(records[0], null, 2));
    }
    
    const transformedRecords = records.map((record: any) => {
      const transformed = {
        ...record,
        id: record._id.toString(),
        patient: record.patientId,
        therapist: record.therapistId,
      };
      console.log('Transformed record therapist:', transformed.therapist);
      return transformed;
    });
    
    console.log('Transformed records count:', transformedRecords.length);
    return transformedRecords;
  }

  async getTreatmentRecord(id: string) {
    const record = await TreatmentRecord.findById(id)
      .populate('patientId', 'firstName lastName')
      .populate('therapistId', 'firstName lastName')
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
    console.log('Creating treatment record:', record);
    const newRecord = new TreatmentRecord(record);
    await newRecord.save();
    
    // Fetch the record with populated data
    const populatedRecord = await TreatmentRecord.findById(newRecord._id)
      .populate('patientId', 'firstName lastName')
      .populate('therapistId', 'firstName lastName')
      .lean();
    
    if (!populatedRecord) {
      throw new Error('Failed to create treatment record');
    }
    
    const obj = {
      ...populatedRecord,
      id: populatedRecord._id.toString(),
      patient: populatedRecord.patientId,
      therapist: populatedRecord.therapistId,
    };
    console.log('Saved treatment record:', obj);
    return obj;
  }

  async updateTreatmentRecord(id: string, record: any) {
    const updated = await TreatmentRecord.findByIdAndUpdate(id, record, { new: true })
      .populate('patientId', 'firstName lastName')
      .populate('therapistId', 'firstName lastName')
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
    console.log('Dashboard stats - totalPatients from DB:', totalPatients);
    
    // Get today's appointments
    const todayAppointments = await this.getTodayAppointments();
    const todayAppointmentsCount = todayAppointments.length;
    
    // Get all appointments for stats
    const allAppointments = await Appointment.find().lean();
    
    // Calculate stats
    const completedAppointments = allAppointments.filter(apt => apt.status === 'completed').length;
    const upcomingAppointments = allAppointments.filter(apt => apt.status === 'scheduled').length;
    const appointmentsNeedingReview = allAppointments.filter(apt => apt.status === 'completed' && !apt.notes).length;
    
    // Calculate monthly stats (current month)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    
    const monthlyAppointments = allAppointments.filter(apt => {
      const aptDate = new Date(apt.appointmentDate);
      return aptDate >= startOfMonth && aptDate < endOfMonth;
    }).length;
    
    // Calculate monthly revenue (assuming $100 per appointment for now)
    const monthlyRevenue = monthlyAppointments * 100;
    
    // Count active treatments (treatment records created this month)
    const activeTreatments = await TreatmentRecord.countDocuments({
      createdAt: { $gte: startOfMonth, $lt: endOfMonth }
    });
    
    const stats = {
      totalPatients,
      todayAppointments: todayAppointmentsCount,
      activeTreatments,
      monthlyRevenue,
      monthlyAppointments,
      completedAppointments,
      upcomingAppointments,
      appointmentsNeedingReview,
    };
    
    console.log('Dashboard stats response:', stats);
    return stats;
  }

  async createAuditLog(log: any) {
    return { ...log, id: 1 };
  }

  async getAuditLogs() {
    return [];
  }

  async getStaff() {
    const staff = await User.find().lean();
    return staff.map(user => {
      const { _id, ...rest } = user;
      return {
        ...rest,
        id: _id.toString(),
      };
    });
  }

  async getTherapists() {
    const therapists = await User.find({ role: 'therapist' }).lean();
    return therapists.map(user => {
      const { _id, ...rest } = user;
      return {
        ...rest,
        id: _id.toString(),
      };
    });
  }

  async updateUser(id: string, userData: any) {
    const updatedUser = await User.findByIdAndUpdate(id, userData, { new: true }).lean();
    if (!updatedUser) return undefined;
    const { _id, ...rest } = updatedUser;
    return {
      ...rest,
      id: _id.toString(),
    };
  }

  async deleteUser(id: string) {
    await User.findByIdAndDelete(id);
  }

  // Inquiry management methods
  async addInquiry(patientId: string, inquiryData: any) {
    const patient = await PatientModel.findById(patientId);
    if (!patient) {
      throw new Error('Patient not found');
    }
    
    const inquiry = {
      _id: new mongoose.Types.ObjectId(),
      ...inquiryData,
      createdAt: new Date(),
      updatedAt: new Date()
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
      throw new Error('Patient not found');
    }
    
    const inquiry = patient.inquiries.id(inquiryId);
    if (!inquiry) {
      throw new Error('Inquiry not found');
    }
    
    Object.assign(inquiry, updateData, { updatedAt: new Date() });
    await patient.save();
    
    const { _id, ...rest } = patient.toObject();
    return {
      ...rest,
      id: _id.toString(),
      assignedTherapist: undefined,
    };
  }

  async getInquiries(filters: { status?: string; priority?: string; assignedTo?: string }) {
    const query: any = {};
    
    if (filters.status) {
      query['inquiries.status'] = filters.status;
    }
    if (filters.priority) {
      query['inquiries.priority'] = filters.priority;
    }
    if (filters.assignedTo) {
      query['inquiries.assignedTo'] = filters.assignedTo;
    }
    
    const patients = await PatientModel.find(query)
      .populate('inquiries.assignedTo', 'firstName lastName email')
      .populate('inquiries.createdBy', 'firstName lastName email')
      .lean();
    
    const inquiries: any[] = [];
    patients.forEach(patient => {
      patient.inquiries?.forEach((inquiry: any) => {
        if (this.matchesFilters(inquiry, filters)) {
          inquiries.push({
            ...inquiry,
            id: inquiry._id.toString(),
            patientId: patient._id.toString(),
            patientName: `${patient.firstName} ${patient.lastName}`,
            patientEmail: patient.email,
            patientPhone: patient.phone
          });
        }
      });
    });
    
    return inquiries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  private matchesFilters(inquiry: any, filters: { status?: string; priority?: string; assignedTo?: string }) {
    if (filters.status && inquiry.status !== filters.status) return false;
    if (filters.priority && inquiry.priority !== filters.priority) return false;
    if (filters.assignedTo && inquiry.assignedTo?.toString() !== filters.assignedTo) return false;
    return true;
  }
}

export const storage = new DatabaseStorage();
