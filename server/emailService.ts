import dotenv from "dotenv";
dotenv.config();
import nodemailer from 'nodemailer';
import { storage } from './storage';

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface EmailData {
  to: string;
  template: EmailTemplate;
  data?: Record<string, any>;
}

export class EmailService {
  private static instance: EmailService;
  private transporter: nodemailer.Transporter | null = null;

  private constructor() {
    this.initializeTransporter();
  }

  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }



  private async initializeTransporter() {
    console.log("SMTP config:", {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE,
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS ? "***" : undefined,
    });
    // Always use SMTP config from environment variables
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: process.env.SMTP_SECURE === 'true' || true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendEmail(emailData: EmailData): Promise<boolean> {
    try {
      if (!this.transporter) {
        await this.initializeTransporter();
      }

      if (!this.transporter) {
        console.error('Email transporter not initialized');
        return false;
      }

      const mailOptions = {
        from: process.env.SMTP_FROM || '"Mental Health Tracker" <noreply@mentalhealthtracker.com>',
        to: emailData.to,
        subject: emailData.template.subject,
        html: emailData.template.html,
        text: emailData.template.text,
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('📧 Email sent:', {
          messageId: info.messageId,
          previewURL: nodemailer.getTestMessageUrl(info),
        });
      }

      return true;
    } catch (error) {
      console.error('Failed to send email:', error);
      return false;
    }
  }

  // Appointment reminder email
  async sendAppointmentReminder(
    userEmail: string,
    appointmentData: {
      patientName: string;
      appointmentDate: Date;
      appointmentTime: string;
      location?: string;
      notes?: string;
    }
  ): Promise<boolean> {
    const template: EmailTemplate = {
      subject: `Appointment Reminder - ${appointmentData.patientName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Appointment Reminder</h2>
          <p>Hello,</p>
          <p>This is a reminder for your upcoming appointment:</p>
          
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Appointment Details</h3>
            <p><strong>Patient:</strong> ${appointmentData.patientName}</p>
            <p><strong>Date:</strong> ${appointmentData.appointmentDate.toLocaleDateString()}</p>
            <p><strong>Time:</strong> ${appointmentData.appointmentTime}</p>
            ${appointmentData.location ? `<p><strong>Location:</strong> ${appointmentData.location}</p>` : ''}
            ${appointmentData.notes ? `<p><strong>Notes:</strong> ${appointmentData.notes}</p>` : ''}
          </div>
          
          <p>Please ensure you're prepared for this appointment.</p>
          <p>Best regards,<br>Mental Health Tracker Team</p>
        </div>
      `,
      text: `
        Appointment Reminder - ${appointmentData.patientName}
        
        Hello,
        
        This is a reminder for your upcoming appointment:
        
        Patient: ${appointmentData.patientName}
        Date: ${appointmentData.appointmentDate.toLocaleDateString()}
        Time: ${appointmentData.appointmentTime}
        ${appointmentData.location ? `Location: ${appointmentData.location}` : ''}
        ${appointmentData.notes ? `Notes: ${appointmentData.notes}` : ''}
        
        Please ensure you're prepared for this appointment.
        
        Best regards,
        Mental Health Tracker Team
      `,
    };

    return this.sendEmail({ to: userEmail, template });
  }

  // Patient status update email
  async sendPatientUpdate(
    userEmail: string,
    patientData: {
      patientName: string;
      status: string;
      updateType: string;
      details?: string;
    }
  ): Promise<boolean> {
    const template: EmailTemplate = {
      subject: `Patient Update - ${patientData.patientName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Patient Update</h2>
          <p>Hello,</p>
          <p>There has been an update to a patient's information:</p>
          
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Update Details</h3>
            <p><strong>Patient:</strong> ${patientData.patientName}</p>
            <p><strong>Status:</strong> ${patientData.status}</p>
            <p><strong>Update Type:</strong> ${patientData.updateType}</p>
            ${patientData.details ? `<p><strong>Details:</strong> ${patientData.details}</p>` : ''}
          </div>
          
          <p>Please review this information in the system.</p>
          <p>Best regards,<br>Mental Health Tracker Team</p>
        </div>
      `,
      text: `
        Patient Update - ${patientData.patientName}
        
        Hello,
        
        There has been an update to a patient's information:
        
        Patient: ${patientData.patientName}
        Status: ${patientData.status}
        Update Type: ${patientData.updateType}
        ${patientData.details ? `Details: ${patientData.details}` : ''}
        
        Please review this information in the system.
        
        Best regards,
        Mental Health Tracker Team
      `,
    };

    return this.sendEmail({ to: userEmail, template });
  }

  // System alert email
  async sendSystemAlert(
    userEmail: string,
    alertData: {
      title: string;
      message: string;
      severity: 'info' | 'warning' | 'error';
      actionRequired?: boolean;
    }
  ): Promise<boolean> {
    const severityColors = {
      info: '#3b82f6',
      warning: '#f59e0b',
      error: '#ef4444',
    };

    const template: EmailTemplate = {
      subject: `System Alert - ${alertData.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: ${severityColors[alertData.severity]};">System Alert</h2>
          <p>Hello,</p>
          <p>You have received a system alert:</p>
          
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${severityColors[alertData.severity]};">
            <h3 style="margin-top: 0;">${alertData.title}</h3>
            <p>${alertData.message}</p>
            ${alertData.actionRequired ? '<p><strong>⚠️ Action Required</strong></p>' : ''}
          </div>
          
          <p>Please log into the system to review this alert.</p>
          <p>Best regards,<br>Mental Health Tracker Team</p>
        </div>
      `,
      text: `
        System Alert - ${alertData.title}
        
        Hello,
        
        You have received a system alert:
        
        ${alertData.title}
        ${alertData.message}
        ${alertData.actionRequired ? '⚠️ Action Required' : ''}
        
        Please log into the system to review this alert.
        
        Best regards,
        Mental Health Tracker Team
      `,
    };

    return this.sendEmail({ to: userEmail, template });
  }

  // Welcome email for new users
  async sendWelcomeEmail(
    userEmail: string,
    userData: {
      firstName: string;
      lastName: string;
      role: string;
    }
  ): Promise<boolean> {
    const template: EmailTemplate = {
      subject: 'Welcome to Mental Health Tracker',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Welcome to Mental Health Tracker</h2>
          <p>Hello ${userData.firstName},</p>
          <p>Welcome to the Mental Health Tracker system! Your account has been successfully created.</p>
          
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Account Details</h3>
            <p><strong>Name:</strong> ${userData.firstName} ${userData.lastName}</p>
            <p><strong>Email:</strong> ${userEmail}</p>
            <p><strong>Role:</strong> ${userData.role}</p>
          </div>
          
          <p>You can now log into the system and start managing patient records and appointments.</p>
          <p>If you have any questions, please contact your system administrator.</p>
          <p>Best regards,<br>Mental Health Tracker Team</p>
        </div>
      `,
      text: `
        Welcome to Mental Health Tracker
        
        Hello ${userData.firstName},
        
        Welcome to the Mental Health Tracker system! Your account has been successfully created.
        
        Account Details:
        Name: ${userData.firstName} ${userData.lastName}
        Email: ${userEmail}
        Role: ${userData.role}
        
        You can now log into the system and start managing patient records and appointments.
        
        If you have any questions, please contact your system administrator.
        
        Best regards,
        Mental Health Tracker Team
      `,
    };

    return this.sendEmail({ to: userEmail, template });
  }

  // Password reset email
  async sendPasswordReset(
    userEmail: string,
    resetToken: string,
    resetUrl: string
  ): Promise<boolean> {
    const template: EmailTemplate = {
      subject: 'Password Reset Request',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Password Reset Request</h2>
          <p>Hello,</p>
          <p>You have requested to reset your password for the Mental Health Tracker system.</p>
          
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p>Click the button below to reset your password:</p>
            <a href="${resetUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a>
            <p style="margin-top: 15px; font-size: 14px; color: #6b7280;">
              If the button doesn't work, copy and paste this link into your browser:<br>
              <a href="${resetUrl}">${resetUrl}</a>
            </p>
          </div>
          
          <p>This link will expire in 1 hour for security reasons.</p>
          <p>If you didn't request this password reset, please ignore this email.</p>
          <p>Best regards,<br>Mental Health Tracker Team</p>
        </div>
      `,
      text: `
        Password Reset Request
        
        Hello,
        
        You have requested to reset your password for the Mental Health Tracker system.
        
        Click the link below to reset your password:
        ${resetUrl}
        
        This link will expire in 1 hour for security reasons.
        
        If you didn't request this password reset, please ignore this email.
        
        Best regards,
        Mental Health Tracker Team
      `,
    };

    return this.sendEmail({ to: userEmail, template });
  }

  // Staff invitation email
  async sendStaffInvitation(
    to: string,
    firstName: string,
    lastName: string,
    role: string,
    inviteUrl: string,
    tempPassword: string,
    message?: string
  ): Promise<boolean> {
    const template: EmailTemplate = {
      subject: 'Staff Invitation - Mental Health Tracker',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Staff Invitation</h2>
          <p>Hello ${firstName} ${lastName},</p>
          <p>You have been invited to join the Mental Health Tracker system as a <strong>${role}</strong>.</p>
          ${message ? `<p><em>${message}</em></p>` : ''}
          <p><strong>Temporary Password:</strong> <code>${tempPassword}</code></p>
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Login Link</h3>
            <p><a href="${inviteUrl}" style="color: #2563eb;">Click here to log in</a></p>
            <p>Or visit: ${inviteUrl}</p>
          </div>
          <p>Best regards,<br>Mental Health Tracker Team</p>
        </div>
      `,
      text: `
        Staff Invitation - Mental Health Tracker\n\nHello ${firstName} ${lastName},\n\nYou have been invited to join the Mental Health Tracker system as a ${role}.\n${message ? `\n${message}\n` : ''}\nTemporary Password: ${tempPassword}\n\nLogin Link: ${inviteUrl}\n\nBest regards,\nMental Health Tracker Team\n      `,
    };
    return this.sendEmail({ to, template });
  }

  // Admin-initiated password reset email
  async sendAdminPasswordReset(
    to: string,
    firstName: string,
    lastName: string,
    tempPassword: string
  ): Promise<boolean> {
    const template: EmailTemplate = {
      subject: 'Your Password Has Been Reset',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Password Reset by Administrator</h2>
          <p>Hello ${firstName} ${lastName},</p>
          <p>Your account password has been reset by an administrator.</p>
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Temporary Password</h3>
            <p><strong>Temporary Password:</strong> <code>${tempPassword}</code></p>
            <p>For security, you will be required to change your password after logging in.</p>
          </div>
          <p>If you did not request this change, please contact your system administrator immediately.</p>
          <p>Best regards,<br>Mental Health Tracker Team</p>
        </div>
      `,
      text: `
        Your account password has been reset by an administrator.\n\nTemporary Password: ${tempPassword}\n\nYou will be required to change your password after logging in.\nIf you did not request this change, please contact your system administrator immediately.\n\nBest regards,\nMental Health Tracker Team\n      `,
    };
    return this.sendEmail({ to, template });
  }
}

export const emailService = EmailService.getInstance();
