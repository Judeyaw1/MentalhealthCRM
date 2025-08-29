import { Patient } from "./models/Patient";
import { TreatmentRecord } from "./models/TreatmentRecord";

export class TreatmentCompletionService {
  
  /**
   * Check if a patient should be automatically discharged based on criteria
   */
  static async checkForAutoDischarge(patientId: string): Promise<{
    shouldDischarge: boolean;
    reason: string;
    criteria: string[];
  }> {
    const patient = await Patient.findById(patientId).populate('assignedClinicalId');
    if (!patient) {
      throw new Error('Patient not found');
    }

    // Skip LOS calculations for archived patients
    if (patient.status === 'inactive' || patient.status === 'discharged') {
      return {
        shouldDischarge: false,
        reason: 'Patient is archived - activities on hold',
        criteria: []
      };
    }

    const criteria = [];
    let shouldDischarge = false;
    let reason = '';

    // Get treatment records for this patient
    const treatmentRecords = await TreatmentRecord.find({ patientId }).sort({ sessionDate: 1 });
    const completedSessions = treatmentRecords.filter(record => 
      record.sessionType && record.notes && record.progress
    ).length;

    // Check session count criteria
    const targetSessions = patient.dischargeCriteria?.targetSessions || 12;
    if (completedSessions >= targetSessions) {
      criteria.push(`Completed ${completedSessions} sessions (target: ${targetSessions})`);
      shouldDischarge = true;
      reason = 'Session target reached';
    }

    // Check target date criteria
    if (patient.dischargeCriteria?.targetDate && 
        new Date() >= new Date(patient.dischargeCriteria.targetDate)) {
      criteria.push(`Reached target date: ${new Date(patient.dischargeCriteria.targetDate).toLocaleDateString()}`);
      shouldDischarge = true;
      reason = 'Target date reached';
    }

    // Check goals achievement
    const treatmentGoals = patient.treatmentGoals || [];
    if (treatmentGoals.length > 0) {
      const achievedGoals = treatmentGoals.filter(goal => goal.status === 'achieved').length;
      const totalGoals = treatmentGoals.length;
      const goalCompletionRate = (achievedGoals / totalGoals) * 100;

      if (goalCompletionRate >= 80) { // 80% of goals achieved
        criteria.push(`Achieved ${achievedGoals}/${totalGoals} treatment goals (${goalCompletionRate.toFixed(0)}%)`);
        shouldDischarge = true;
        reason = 'Treatment goals achieved';
      }
    }

    // Check progress indicators in recent sessions
    if (treatmentRecords.length > 0) {
      const recentRecords = treatmentRecords.slice(-3); // Last 3 sessions
      const progressIndicators = recentRecords.filter(record => 
        record.progress && 
        (record.progress.toLowerCase().includes('significant improvement') ||
         record.progress.toLowerCase().includes('goals achieved') ||
         record.progress.toLowerCase().includes('ready for discharge'))
      ).length;

      if (progressIndicators >= 2) { // At least 2 recent sessions indicate readiness
        criteria.push('Recent sessions indicate treatment readiness');
        shouldDischarge = true;
        reason = 'Progress indicators suggest completion';
      }
    }

    return {
      shouldDischarge,
      reason,
      criteria
    };
  }

  /**
   * Calculate treatment completion rate with enhanced criteria
   */
  static async calculateTreatmentCompletionRate(): Promise<{
    rate: number;
    dischargedCount: number;
    totalCount: number;
    breakdown: {
      manuallyDischarged: number;
      autoDischarged: number;
      eligibleForDischarge: number;
    };
  }> {
    const totalPatients = await Patient.countDocuments();
    const dischargedPatients = await Patient.countDocuments({ status: 'discharged' });
    
    // Count patients eligible for discharge
    const activePatients = await Patient.find({ status: 'active' });
    let eligibleForDischarge = 0;
    let autoDischarged = 0;
    let manuallyDischarged = 0;

    for (const patient of activePatients) {
      try {
        const dischargeCheck = await this.checkForAutoDischarge(patient._id.toString());
        if (dischargeCheck.shouldDischarge) {
          eligibleForDischarge++;
        }
      } catch (error) {
        console.error(`Error checking discharge for patient ${patient._id}:`, error);
        // Continue with other patients even if one fails
      }
    }

    // Count auto vs manual discharges
    const dischargedPatientsList = await Patient.find({ status: 'discharged' });
    for (const patient of dischargedPatientsList) {
      const dischargeCriteria = patient.dischargeCriteria || {};
      if (dischargeCriteria.autoDischarge) {
        autoDischarged++;
      } else {
        manuallyDischarged++;
      }
    }

    const rate = totalPatients > 0 ? Math.round((dischargedPatients / totalPatients) * 100) : 0;

    return {
      rate,
      dischargedCount: dischargedPatients,
      totalCount: totalPatients,
      breakdown: {
        manuallyDischarged,
        autoDischarged,
        eligibleForDischarge
      }
    };
  }

  /**
   * Auto-discharge a patient if criteria are met
   */
  static async autoDischargePatient(patientId: string): Promise<{
    success: boolean;
    reason: string;
    criteria: string[];
  }> {
    const dischargeCheck = await this.checkForAutoDischarge(patientId);
    
    if (dischargeCheck.shouldDischarge) {
      await Patient.findByIdAndUpdate(patientId, {
        status: 'discharged',
        'dischargeCriteria.autoDischarge': true,
        'dischargeCriteria.dischargeReason': dischargeCheck.reason,
        'dischargeCriteria.dischargeDate': new Date()
      });

      return {
        success: true,
        reason: dischargeCheck.reason,
        criteria: dischargeCheck.criteria
      };
    }

    return {
      success: false,
      reason: 'Discharge criteria not met',
      criteria: dischargeCheck.criteria
    };
  }

  /**
   * Update treatment goals and check for completion
   */
  static async updateTreatmentGoal(
    patientId: string, 
    goalIndex: number, 
    updates: {
      status?: string;
      achievedDate?: Date;
      notes?: string;
    }
  ): Promise<{
    success: boolean;
    shouldCheckDischarge: boolean;
  }> {
    const patient = await Patient.findById(patientId);
    if (!patient) {
      throw new Error('Patient not found');
    }

    // Initialize treatmentGoals if it doesn't exist
    if (!patient.treatmentGoals) {
      patient.treatmentGoals = [];
    }

    if (!patient.treatmentGoals[goalIndex]) {
      throw new Error('Goal not found');
    }

    // Update the goal
    patient.treatmentGoals[goalIndex] = {
      ...patient.treatmentGoals[goalIndex],
      ...updates
    };

    await patient.save();

    // Check if this goal achievement should trigger discharge review
    const shouldCheckDischarge = updates.status === 'achieved';
    
    return {
      success: true,
      shouldCheckDischarge
    };
  }
} 