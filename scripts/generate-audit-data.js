import mongoose from 'mongoose';

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/mental-health-tracker');

// Sample audit log data
const sampleAuditLogs = [
  {
    userId: 'admin_123',
    action: 'create',
    resourceType: 'patient',
    resourceId: 'patient_001',
    details: JSON.stringify({
      patientName: 'John Doe',
      email: 'john@example.com',
      reason: 'Anxiety treatment'
    }),
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    sessionId: 'sess_abc123'
  },
  {
    userId: 'therapist_456',
    action: 'read',
    resourceType: 'patient',
    resourceId: 'patient_001',
    details: JSON.stringify({
      patientId: 'patient_001',
      accessReason: 'Treatment planning'
    }),
    timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
    ipAddress: '192.168.1.101',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    sessionId: 'sess_def456'
  },
  {
    userId: 'admin_123',
    action: 'create',
    resourceType: 'appointment',
    resourceId: 'apt_001',
    details: JSON.stringify({
      patientId: 'patient_001',
      therapistId: 'therapist_456',
      appointmentDate: new Date(),
      duration: 60,
      type: 'Initial Consultation'
    }),
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    sessionId: 'sess_abc123'
  },
  {
    userId: 'therapist_456',
    action: 'update',
    resourceType: 'appointment',
    resourceId: 'apt_001',
    details: JSON.stringify({
      oldStatus: 'scheduled',
      newStatus: 'completed',
      notes: 'Session completed successfully'
    }),
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    ipAddress: '192.168.1.101',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    sessionId: 'sess_def456'
  },
  {
    userId: 'therapist_456',
    action: 'create',
    resourceType: 'treatment_record',
    resourceId: 'record_001',
    details: JSON.stringify({
      patientId: 'patient_001',
      sessionDate: new Date(),
      sessionType: 'Individual Therapy',
      goals: 'Reduce anxiety symptoms',
      interventions: 'Cognitive Behavioral Therapy techniques'
    }),
    timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
    ipAddress: '192.168.1.101',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    sessionId: 'sess_def456'
  },
  {
    userId: 'admin_123',
    action: 'create',
    resourceType: 'user',
    resourceId: 'user_789',
    details: JSON.stringify({
      newUserEmail: 'dr.smith@clinic.com',
      role: 'therapist',
      invitedBy: 'admin_123'
    }),
    timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    sessionId: 'sess_abc123'
  },
  {
    userId: 'admin_123',
    action: 'login',
    resourceType: 'session',
    resourceId: 'session_001',
    details: JSON.stringify({
      loginMethod: 'password',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      ipAddress: '192.168.1.100'
    }),
    timestamp: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    sessionId: 'sess_abc123'
  },
  {
    userId: 'therapist_456',
    action: 'emergency_access',
    resourceType: 'patient',
    resourceId: 'patient_002',
    details: JSON.stringify({
      reason: 'Patient crisis situation',
      emergencyAccess: true,
      overrideReason: 'Immediate intervention required'
    }),
    timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
    ipAddress: '192.168.1.101',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    sessionId: 'sess_def456'
  }
];

async function generateAuditData() {
  try {
    console.log('Generating sample audit log data...');
    
    // Clear existing audit logs
    await mongoose.connection.db.collection('auditLogs').deleteMany({});
    console.log('Cleared existing audit logs');
    
    // Insert sample data
    const result = await mongoose.connection.db.collection('auditLogs').insertMany(sampleAuditLogs);
    console.log(`Generated ${result.insertedCount} audit log entries`);
    
    // Display the generated logs
    const logs = await mongoose.connection.db.collection('auditLogs').find({}).sort({ timestamp: -1 }).toArray();
    console.log('\nGenerated Audit Logs:');
    logs.forEach((log, index) => {
      console.log(`${index + 1}. ${log.action.toUpperCase()} - ${log.resourceType} (${log.resourceId}) by ${log.userId} at ${log.timestamp}`);
    });
    
    console.log('\n✅ Sample audit data generated successfully!');
    console.log('You can now view the audit logs in your application.');
    
  } catch (error) {
    console.error('Error generating audit data:', error);
  } finally {
    mongoose.connection.close();
  }
}

// Run the script
generateAuditData(); 