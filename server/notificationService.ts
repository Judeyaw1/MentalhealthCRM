import { storage } from './storage';
import { emailService } from './emailService';
import { v4 as uuidv4 } from 'uuid';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  read: boolean;
  createdAt: Date;
  expiresAt?: Date;
}

export type NotificationType = 
  | 'appointment_reminder'
  | 'patient_update'
  | 'system_alert'
  | 'treatment_completion'
  | 'discharge_reminder'
  | 'inquiry_received'
  | 'staff_invitation'
  | 'password_reset'
  | 'general';

export interface NotificationPreferences {
  emailNotifications: boolean;
  appointmentReminders: boolean;
  patientUpdates: boolean;
  systemAlerts: boolean;
  inAppNotifications: boolean;
  reminderTiming: '15min' | '30min' | '1hour' | '1day';
  quietHours: {
    enabled: boolean;
    start: string; // HH:mm format
    end: string; // HH:mm format
  };
}

export class NotificationService {
  private static instance: NotificationService;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  // Create a new notification
  async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, any>,
    expiresAt?: Date
  ): Promise<Notification> {
    const notification: Notification = {
      id: uuidv4(),
      userId,
      type,
      title,
      message,
      data,
      read: false,
      createdAt: new Date(),
      expiresAt,
    };

    await storage.createNotification(notification);
    
    // Check user preferences and send email if enabled
    await this.checkAndSendEmail(userId, type, title, message, data);
    
    return notification;
  }

  // Get notifications for a user
  async getUserNotifications(
    userId: string,
    options?: {
      unreadOnly?: boolean;
      limit?: number;
      offset?: number;
      type?: NotificationType;
    }
  ): Promise<Notification[]> {
    return storage.getUserNotifications(userId, options);
  }

  // Mark notification as read
  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    return storage.markNotificationAsRead(notificationId, userId);
  }

  // Mark all notifications as read for a user
  async markAllAsRead(userId: string): Promise<boolean> {
    return storage.markAllNotificationsAsRead(userId);
  }

  // Delete a notification
  async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    return storage.deleteNotification(notificationId, userId);
  }

  // Get notification count for a user
  async getUnreadCount(userId: string): Promise<number> {
    return storage.getUnreadNotificationCount(userId);
  }

  // Check user preferences and send email if appropriate
  private async checkAndSendEmail(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, any>
  ): Promise<void> {
    try {
      const user = await storage.getUser(userId);
      if (!user || !user.settings?.notifications) return;

      const prefs = user.settings.notifications;
      const userEmail = user.email;

      // Check if email notifications are enabled for this type
      let shouldSendEmail = false;
      
      switch (type) {
        case 'appointment_reminder':
          shouldSendEmail = prefs.emailNotifications && prefs.appointmentReminders;
          break;
        case 'patient_update':
          shouldSendEmail = prefs.emailNotifications && prefs.patientUpdates;
          break;
        case 'system_alert':
          shouldSendEmail = prefs.emailNotifications && prefs.systemAlerts;
          break;
        default:
          shouldSendEmail = prefs.emailNotifications;
      }

      if (shouldSendEmail && userEmail) {
        // Check quiet hours
        if (this.isInQuietHours(user.settings?.notifications)) {
          console.log(`Skipping email notification during quiet hours for user ${userId}`);
          return;
        }

        // Send appropriate email based on type
        switch (type) {
          case 'appointment_reminder':
            if (data?.appointmentData) {
              await emailService.sendAppointmentReminder(userEmail, data.appointmentData);
            }
            break;
          case 'patient_update':
            if (data?.patientData) {
              await emailService.sendPatientUpdate(userEmail, data.patientData);
            }
            break;
          case 'system_alert':
            if (data?.alertData) {
              await emailService.sendSystemAlert(userEmail, data.alertData);
            }
            break;
          default:
            // Send generic notification email
            await emailService.sendEmail({
              to: userEmail,
              template: {
                subject: title,
                html: `<div><h2>${title}</h2><p>${message}</p></div>`,
                text: `${title}\n\n${message}`,
              },
            });
        }
      }
    } catch (error) {
      console.error('Error sending email notification:', error);
    }
  }

  // Check if current time is in quiet hours
  private isInQuietHours(notifications?: any): boolean {
    if (!notifications?.quietHours?.enabled) return false;
    
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const [startHour, startMin] = notifications.quietHours.start.split(':').map(Number);
    const [endHour, endMin] = notifications.quietHours.end.split(':').map(Number);
    
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;
    
    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // Quiet hours span midnight
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  // Send appointment reminder
  async sendAppointmentReminder(
    userId: string,
    appointmentData: {
      patientName: string;
      appointmentDate: Date;
      appointmentTime: string;
      location?: string;
      notes?: string;
    }
  ): Promise<void> {
    const title = 'Appointment Reminder';
    const message = `Reminder: You have an appointment with ${appointmentData.patientName} on ${appointmentData.appointmentDate.toLocaleDateString()} at ${appointmentData.appointmentTime}`;
    
    await this.createNotification(
      userId,
      'appointment_reminder',
      title,
      message,
      { appointmentData }
    );
  }

  // Send patient update notification
  async sendPatientUpdate(
    userId: string,
    patientData: {
      patientName: string;
      status: string;
      updateType: string;
      details?: string;
    }
  ): Promise<void> {
    const title = 'Patient Update';
    const message = `${patientData.patientName}'s status has been updated to ${patientData.status}`;
    
    await this.createNotification(
      userId,
      'patient_update',
      title,
      message,
      { patientData }
    );
  }

  // Send system alert
  async sendSystemAlert(
    userId: string,
    alertData: {
      title: string;
      message: string;
      severity: 'info' | 'warning' | 'error';
      actionRequired?: boolean;
    }
  ): Promise<void> {
    await this.createNotification(
      userId,
      'system_alert',
      alertData.title,
      alertData.message,
      { alertData }
    );
  }

  // Send treatment completion notification
  async sendTreatmentCompletion(
    userId: string,
    patientName: string,
    completionType: 'manual' | 'automatic'
  ): Promise<void> {
    const title = 'Treatment Completed';
    const message = `${patientName}'s treatment has been ${completionType === 'manual' ? 'manually' : 'automatically'} completed and they are ready for discharge review.`;
    
    await this.createNotification(
      userId,
      'treatment_completion',
      title,
      message,
      { patientName, completionType }
    );
  }

  // Send discharge reminder
  async sendDischargeReminder(
    userId: string,
    patientName: string,
    daysSinceCompletion: number
  ): Promise<void> {
    const title = 'Discharge Review Needed';
    const message = `${patientName} completed treatment ${daysSinceCompletion} days ago and needs discharge review.`;
    
    await this.createNotification(
      userId,
      'discharge_reminder',
      title,
      message,
      { patientName, daysSinceCompletion }
    );
  }

  // Send inquiry received notification
  async sendInquiryNotification(
    userId: string,
    inquiryData: {
      patientName: string;
      inquiryType: string;
      message: string;
    }
  ): Promise<void> {
    const title = 'New Inquiry Received';
    const message = `New ${inquiryData.inquiryType} inquiry from ${inquiryData.patientName}`;
    
    await this.createNotification(
      userId,
      'inquiry_received',
      title,
      message,
      { inquiryData }
    );
  }

  // Send staff invitation notification
  async sendStaffInvitation(
    userEmail: string,
    invitedBy: string,
    role: string
  ): Promise<void> {
    const title = 'Staff Invitation';
    const message = `You have been invited to join the Mental Health Tracker system as a ${role}`;
    
    // Send email invitation
    await emailService.sendEmail({
      to: userEmail,
      template: {
        subject: 'Staff Invitation - Mental Health Tracker',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Staff Invitation</h2>
            <p>Hello,</p>
            <p>You have been invited by ${invitedBy} to join the Mental Health Tracker system.</p>
            
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Invitation Details</h3>
              <p><strong>Role:</strong> ${role}</p>
              <p><strong>Invited by:</strong> ${invitedBy}</p>
            </div>
            
            <p>Please contact your administrator to complete your account setup.</p>
            <p>Best regards,<br>Mental Health Tracker Team</p>
          </div>
        `,
        text: `
          Staff Invitation - Mental Health Tracker
          
          Hello,
          
          You have been invited by ${invitedBy} to join the Mental Health Tracker system.
          
          Invitation Details:
          Role: ${role}
          Invited by: ${invitedBy}
          
          Please contact your administrator to complete your account setup.
          
          Best regards,
          Mental Health Tracker Team
        `,
      },
    });
  }

  // Clean up expired notifications
  async cleanupExpiredNotifications(): Promise<number> {
    return storage.cleanupExpiredNotifications();
  }

  // Get notification statistics
  async getNotificationStats(userId: string): Promise<{
    total: number;
    unread: number;
    byType: Record<NotificationType, number>;
  }> {
    const notifications = await this.getUserNotifications(userId);
    const unread = notifications.filter(n => !n.read).length;
    
    const byType: Record<NotificationType, number> = {
      appointment_reminder: 0,
      patient_update: 0,
      system_alert: 0,
      treatment_completion: 0,
      discharge_reminder: 0,
      inquiry_received: 0,
      staff_invitation: 0,
      password_reset: 0,
      general: 0,
    };
    
    notifications.forEach(notification => {
      byType[notification.type]++;
    });
    
    return {
      total: notifications.length,
      unread,
      byType,
    };
  }
}

export const notificationService = NotificationService.getInstance(); 