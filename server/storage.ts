import { Patient as PatientModel } from './models/Patient';
import { Appointment } from './models/Appointment';
import { User } from './models/User';

// Simplified MongoDB-only storage for now
export class DatabaseStorage {
  // Patient operations
  async getPatients(limit = 50, offset = 0, search?: string, status?: string) {
    const query: any = {};
    if (search) {
      query.$or = [
        { firstName: new RegExp(search, 'i') },
        { lastName: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
      ];
    }
    if (status) {
      query.status = status;
    }
    const total = await PatientModel.countDocuments(query);
    const patients = await PatientModel.find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();
    const patientsWithId = patients.map((p: any) => ({
      ...p,
      id: p._id.toString(),
      assignedTherapist: undefined,
    }));
    return { patients: patientsWithId, total };
  }

  async getPatient(id: string) {
    const p = await PatientModel.findById(id).lean();
    if (!p) return undefined;
    return {
      ...p,
      id: p._id.toString(),
      assignedTherapist: undefined,
    };
  }

  async createPatient(patient: any) {
    const newPatient = new PatientModel(patient);
    await newPatient.save();
    const p = newPatient.toObject();
    return {
      ...p,
      id: p._id.toString(),
      assignedTherapist: undefined,
    };
  }

  async updatePatient(id: string, patient: any) {
    const updatedPatient = await PatientModel.findByIdAndUpdate(id, patient, { new: true }).lean();
    if (!updatedPatient) return undefined;
    return {
      ...updatedPatient,
      id: updatedPatient._id.toString(),
      assignedTherapist: undefined,
    };
  }

  // Mock methods for compatibility (return empty data for now)
  async getUser(id: string) {
    const user = await User.findById(id).lean();
    if (!user) return undefined;
    return {
      ...user,
      id: user._id.toString(),
    };
  }

  async getUserByEmail(email: string) {
    const user = await User.findOne({ email }).lean();
    if (!user) return undefined;
    return {
      ...user,
      id: user._id.toString(),
    };
  }

  async createUser(userData: any) {
    const user = new User(userData);
    await user.save();
    const userObj = user.toObject();
    return {
      ...userObj,
      id: userObj._id.toString(),
    };
  }

  // Removed upsertUser as it's no longer needed

  async getPatientsByTherapist(therapistId: string) {
    return [];
  }

  // Appointments
  async getAppointments() {
    return Appointment.find().lean();
  }

  async getAppointment(id: string) {
    return Appointment.findById(id).lean();
  }

  async createAppointment(data: any) {
    const appointment = new Appointment(data);
    await appointment.save();
    return appointment.toObject();
  }

  async updateAppointment(id: string, updates: any) {
    return Appointment.findByIdAndUpdate(id, updates, { new: true }).lean();
  }

  async getTodayAppointments() {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const appointments = await Appointment.find({
      appointmentDate: { $gte: startOfDay, $lt: endOfDay }
    }).populate('patientId', 'firstName lastName').populate('therapistId', 'firstName lastName').lean();
    
    return appointments.map((apt: any) => ({
      ...apt,
      id: apt._id.toString(),
      patient: apt.patientId,
      therapist: apt.therapistId,
    }));
  }

  async getTreatmentRecords(patientId: number) {
    return [];
  }

  async getTreatmentRecord(id: number) {
    return undefined;
  }

  async getAllTreatmentRecords() {
    return { records: [], total: 0 };
  }

  async createTreatmentRecord(record: any) {
    return { ...record, id: 1 };
  }

  async updateTreatmentRecord(id: number, record: any) {
    return { ...record, id };
  }

  async deleteTreatmentRecord(id: number) {
    // No-op
  }

  async getDashboardStats() {
    return {
      totalPatients: 0,
      todayAppointments: 0,
      activeTreatments: 0,
      monthlyRevenue: 0,
      monthlyAppointments: 0,
      completedAppointments: 0,
      upcomingAppointments: 0,
      appointmentsNeedingReview: 0,
    };
  }

  async createAuditLog(log: any) {
    return { ...log, id: 1 };
  }

  async getAuditLogs() {
    return [];
  }

  async getStaff() {
    const staff = await User.find().lean();
    return staff.map(user => ({
      ...user,
      id: user._id.toString(),
    }));
  }

  async getTherapists() {
    const therapists = await User.find({ role: 'therapist' }).lean();
    return therapists.map(user => ({
      ...user,
      id: user._id.toString(),
    }));
  }

  async updateUser(id: string, userData: any) {
    const updatedUser = await User.findByIdAndUpdate(id, userData, { new: true }).lean();
    if (!updatedUser) return undefined;
    return {
      ...updatedUser,
      id: updatedUser._id.toString(),
    };
  }

  async deleteUser(id: string) {
    await User.findByIdAndDelete(id);
  }
}

export const storage = new DatabaseStorage();
