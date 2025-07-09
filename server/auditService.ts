import { storage } from "./storage";
import { v4 as uuidv4 } from "uuid";

export interface AuditLogEntry {
  userId: string;
  action: AuditAction;
  resourceType: ResourceType;
  resourceId: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

export type AuditAction = 
  | "create" | "read" | "update" | "delete"
  | "login" | "logout" | "password_reset" | "password_change"
  | "export" | "import" | "backup" | "restore"
  | "permission_change" | "role_change"
  | "consent_given" | "consent_revoked"
  | "emergency_access" | "break_glass";

export type ResourceType = 
  | "patient" | "appointment" | "treatment_record" | "user"
  | "session" | "consent" | "audit_log" | "system"
  | "inquiry" | "report" | "backup";

export class AuditService {
  private static instance: AuditService;

  private constructor() {}

  static getInstance(): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService();
    }
    return AuditService.instance;
  }

  async logActivity(
    entry: AuditLogEntry,
    request?: any
  ): Promise<void> {
    try {
      const auditLog = {
        id: uuidv4(),
        userId: entry.userId,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        details: entry.details ? JSON.stringify(entry.details) : null,
        timestamp: new Date(),
        ipAddress: entry.ipAddress || request?.ip,
        userAgent: entry.userAgent || request?.headers?.['user-agent'],
        sessionId: entry.sessionId || request?.sessionID,
      };

      await storage.createAuditLog(auditLog);
      
      // Log to console for development
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 AUDIT LOG:', {
          timestamp: auditLog.timestamp,
          user: entry.userId,
          action: entry.action,
          resource: `${entry.resourceType}:${entry.resourceId}`,
          details: entry.details
        });
      }
    } catch (error) {
      console.error('Failed to create audit log:', error);
      // Don't throw - audit logging should not break main functionality
    }
  }

  // Patient-related audit logging
  async logPatientActivity(
    userId: string,
    action: AuditAction,
    patientId: string,
    details?: Record<string, any>,
    request?: any
  ): Promise<void> {
    await this.logActivity({
      userId,
      action,
      resourceType: 'patient',
      resourceId: patientId,
      details,
      ipAddress: request?.ip,
      userAgent: request?.headers?.['user-agent'],
      sessionId: request?.sessionID,
    });
  }

  // Appointment-related audit logging
  async logAppointmentActivity(
    userId: string,
    action: AuditAction,
    appointmentId: string,
    details?: Record<string, any>,
    request?: any
  ): Promise<void> {
    await this.logActivity({
      userId,
      action,
      resourceType: 'appointment',
      resourceId: appointmentId,
      details,
      ipAddress: request?.ip,
      userAgent: request?.headers?.['user-agent'],
      sessionId: request?.sessionID,
    });
  }

  // Treatment record audit logging
  async logTreatmentRecordActivity(
    userId: string,
    action: AuditAction,
    recordId: string,
    details?: Record<string, any>,
    request?: any
  ): Promise<void> {
    await this.logActivity({
      userId,
      action,
      resourceType: 'treatment_record',
      resourceId: recordId,
      details,
      ipAddress: request?.ip,
      userAgent: request?.headers?.['user-agent'],
      sessionId: request?.sessionID,
    });
  }

  // User/staff management audit logging
  async logUserActivity(
    userId: string,
    action: AuditAction,
    targetUserId: string,
    details?: Record<string, any>,
    request?: any
  ): Promise<void> {
    await this.logActivity({
      userId,
      action,
      resourceType: 'user',
      resourceId: targetUserId,
      details,
      ipAddress: request?.ip,
      userAgent: request?.headers?.['user-agent'],
      sessionId: request?.sessionID,
    });
  }

  // Authentication audit logging
  async logAuthActivity(
    userId: string,
    action: 'login' | 'logout' | 'password_reset' | 'password_change',
    details?: Record<string, any>,
    request?: any
  ): Promise<void> {
    await this.logActivity({
      userId,
      action,
      resourceType: 'session',
      resourceId: `session_${Date.now()}`,
      details,
      ipAddress: request?.ip,
      userAgent: request?.headers?.['user-agent'],
      sessionId: request?.sessionID,
    });
  }

  // Consent management audit logging
  async logConsentActivity(
    userId: string,
    action: 'consent_given' | 'consent_revoked',
    patientId: string,
    details?: Record<string, any>,
    request?: any
  ): Promise<void> {
    await this.logActivity({
      userId,
      action,
      resourceType: 'consent',
      resourceId: patientId,
      details,
      ipAddress: request?.ip,
      userAgent: request?.headers?.['user-agent'],
      sessionId: request?.sessionID,
    });
  }

  // Emergency access audit logging
  async logEmergencyAccess(
    userId: string,
    patientId: string,
    reason: string,
    request?: any
  ): Promise<void> {
    await this.logActivity({
      userId,
      action: 'emergency_access',
      resourceType: 'patient',
      resourceId: patientId,
      details: { reason, emergencyAccess: true },
      ipAddress: request?.ip,
      userAgent: request?.headers?.['user-agent'],
      sessionId: request?.sessionID,
    });
  }

  // Get audit logs with filtering
  async getAuditLogs(filters?: {
    userId?: string;
    action?: AuditAction;
    resourceType?: ResourceType;
    resourceId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    try {
      const logs = await storage.getAuditLogs();
      
      // Apply filters
      let filteredLogs = logs.filter(log => {
        if (filters?.userId && log.userId !== filters.userId) return false;
        if (filters?.action && log.action !== filters.action) return false;
        if (filters?.resourceType && log.resourceType !== filters.resourceType) return false;
        if (filters?.resourceId && log.resourceId !== filters.resourceId) return false;
        if (filters?.startDate && new Date(log.timestamp) < filters.startDate) return false;
        if (filters?.endDate && new Date(log.timestamp) > filters.endDate) return false;
        return true;
      });

      // Sort by timestamp (newest first)
      filteredLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Apply pagination
      if (filters?.offset) {
        filteredLogs = filteredLogs.slice(filters.offset);
      }
      if (filters?.limit) {
        filteredLogs = filteredLogs.slice(0, filters.limit);
      }

      return filteredLogs;
    } catch (error) {
      console.error('Failed to get audit logs:', error);
      return [];
    }
  }

  // Get audit summary for dashboard
  async getAuditSummary(days: number = 30): Promise<{
    totalActions: number;
    actionsByType: Record<string, number>;
    actionsByUser: Record<string, number>;
    recentActivity: any[];
  }> {
    try {
      const logs = await storage.getAuditLogs();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const recentLogs = logs.filter(log => new Date(log.timestamp) >= cutoffDate);

      const actionsByType: Record<string, number> = {};
      const actionsByUser: Record<string, number> = {};

      recentLogs.forEach(log => {
        actionsByType[log.action] = (actionsByType[log.action] || 0) + 1;
        actionsByUser[log.userId] = (actionsByUser[log.userId] || 0) + 1;
      });

      return {
        totalActions: recentLogs.length,
        actionsByType,
        actionsByUser,
        recentActivity: recentLogs.slice(0, 10), // Last 10 activities
      };
    } catch (error) {
      console.error('Failed to get audit summary:', error);
      return {
        totalActions: 0,
        actionsByType: {},
        actionsByUser: {},
        recentActivity: [],
      };
    }
  }
}

export const auditService = AuditService.getInstance(); 