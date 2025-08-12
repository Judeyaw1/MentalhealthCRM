import { storage } from './storage';
import { AuditService } from './auditService';

export class AppointmentStatusService {
  /**
   * Automatically update appointment statuses based on current date and time
   */
  static async updateAppointmentStatuses() {
    try {
      console.log('🔄 Updating appointment statuses...');
      
      // Get all appointments
      const allAppointments = await storage.getAllAppointments();
      const now = new Date();
      let updatedCount = 0;
      
      for (const appointment of allAppointments) {
        const appointmentDate = new Date(appointment.appointmentDate);
        const currentStatus = appointment.status;
        let newStatus = currentStatus;
        let statusReason = '';
        
        // Skip appointments that are already in final states
        if (['completed', 'cancelled', 'no-show'].includes(currentStatus)) {
          continue;
        }
        
        // Check if appointment is overdue (past date and still scheduled)
        if (currentStatus === 'scheduled' && appointmentDate < now) {
          // If appointment is more than 24 hours old, mark as missed
          const hoursSinceAppointment = (now.getTime() - appointmentDate.getTime()) / (1000 * 60 * 60);
          
          if (hoursSinceAppointment > 24) {
            newStatus = 'no-show';
            statusReason = 'Automatically marked as no-show (appointment date passed)';
          } else {
            newStatus = 'overdue';
            statusReason = 'Appointment is overdue (date has passed)';
          }
        }
        
        // Update status if it changed
        if (newStatus !== currentStatus) {
          try {
            await storage.updateAppointmentStatus(appointment._id.toString(), newStatus);
            
            // Log the automatic status change
            await AuditService.logActivity(
              'system', // system user
              'update',
              'appointment_status',
              appointment._id.toString(),
              {
                oldStatus: currentStatus,
                newStatus: newStatus,
                reason: statusReason,
                automatic: true
              }
            );
            
            updatedCount++;
            console.log(`✅ Updated appointment ${appointment._id} from ${currentStatus} to ${newStatus}: ${statusReason}`);
          } catch (error) {
            console.error(`❌ Failed to update appointment ${appointment._id}:`, error);
          }
        }
      }
      
      console.log(`🔄 Appointment status update complete. Updated ${updatedCount} appointments.`);
      return updatedCount;
    } catch (error) {
      console.error('❌ Error updating appointment statuses:', error);
      throw error;
    }
  }
  
  /**
   * Get appointment status recommendations based on current state
   */
  static getStatusRecommendation(appointment: any): { recommendedStatus: string; reason: string } {
    const now = new Date();
    const appointmentDate = new Date(appointment.appointmentDate);
    const currentStatus = appointment.status;
    
    // If already in final state, no recommendation needed
    if (['completed', 'cancelled', 'no-show'].includes(currentStatus)) {
      return { recommendedStatus: currentStatus, reason: 'Status is final' };
    }
    
    // Check if appointment is overdue
    if (appointmentDate < now) {
      const hoursSinceAppointment = (now.getTime() - appointmentDate.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceAppointment > 24) {
        return { 
          recommendedStatus: 'no-show', 
          reason: 'Appointment date has passed more than 24 hours ago' 
        };
      } else {
        return { 
          recommendedStatus: 'overdue', 
          reason: 'Appointment date has passed but within 24 hours' 
        };
      }
    }
    
    // Check if appointment is today
    const today = new Date();
    const isToday = appointmentDate.toDateString() === today.toDateString();
    
    if (isToday) {
      return { 
        recommendedStatus: 'scheduled', 
        reason: 'Appointment is scheduled for today' 
      };
    }
    
    // Future appointment
    return { 
      recommendedStatus: 'scheduled', 
      reason: 'Appointment is scheduled for the future' 
    };
  }
  
  /**
   * Validate appointment status transition
   */
  static isValidStatusTransition(currentStatus: string, newStatus: string): boolean {
    const validTransitions: Record<string, string[]> = {
      'scheduled': ['completed', 'cancelled', 'overdue', 'no-show'],
      'overdue': ['completed', 'cancelled', 'no-show'],
      'completed': [], // Final state
      'cancelled': [], // Final state
      'no-show': ['completed', 'cancelled'], // Can be rescheduled
    };
    
    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }
}

// Export singleton instance
export const appointmentStatusService = new AppointmentStatusService();
