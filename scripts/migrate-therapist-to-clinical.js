#!/usr/bin/env node

/**
 * Database Migration Script: Therapist to Clinical
 * 
 * This script updates the database schema and data to change all "therapist" 
 * references to "clinical" while maintaining the same functionality.
 * 
 * IMPORTANT: Backup your database before running this migration!
 */

import { MongoClient } from 'mongodb';

// Configuration - update these values for your database
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mentalhealthtracker';
const DB_NAME = process.env.DB_NAME || 'mentalhealthtracker';

async function migrateTherapistToClinical() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('🔌 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db(DB_NAME);
    
    console.log('\n🔄 Starting migration: Therapist to Clinical...');
    
    // 1. Update User roles from 'therapist' to 'clinical'
    console.log('\n📝 Updating user roles...');
    const userResult = await db.collection('users').updateMany(
      { role: 'therapist' },
      { $set: { role: 'clinical' } }
    );
    console.log(`✅ Updated ${userResult.modifiedCount} user roles from 'therapist' to 'clinical'`);
    
    // 2. Update Patient assignedTherapistId to assignedClinicalId
    console.log('\n👥 Updating patient assignments...');
    const patientResult = await db.collection('patients').updateMany(
      { assignedTherapistId: { $exists: true } },
      [
        {
          $set: {
            assignedClinicalId: '$assignedTherapistId'
          }
        },
        {
          $unset: 'assignedTherapistId'
        }
      ]
    );
    console.log(`✅ Updated ${patientResult.modifiedCount} patient assignments`);
    
    // 3. Update Appointment therapistId to clinicalId
    console.log('\n📅 Updating appointment assignments...');
    const appointmentResult = await db.collection('appointments').updateMany(
      { therapistId: { $exists: true } },
      [
        {
          $set: {
            clinicalId: '$therapistId'
          }
        },
        {
          $unset: 'therapistId'
        }
      ]
    );
    console.log(`✅ Updated ${appointmentResult.modifiedCount} appointment assignments`);
    
    // 4. Update TreatmentRecord therapistId to clinicalId
    console.log('\n📋 Updating treatment record assignments...');
    const treatmentResult = await db.collection('treatmentrecords').updateMany(
      { therapistId: { $exists: true } },
      [
        {
          $set: {
            clinicalId: '$therapistId'
          }
        },
        {
          $unset: 'therapistId'
        }
      ]
    );
    console.log(`✅ Updated ${treatmentResult.modifiedCount} treatment record assignments`);
    
    // 5. Update Notification roles from 'assigned_therapist' to 'assigned_clinical'
    console.log('\n🔔 Updating notification roles...');
    const notificationResult = await db.collection('notifications').updateMany(
      { 'data.role': 'assigned_therapist' },
      { $set: { 'data.role': 'assigned_clinical' } }
    );
    console.log(`✅ Updated ${notificationResult.modifiedCount} notification roles`);
    
    // 6. Update Audit logs
    console.log('\n📊 Updating audit logs...');
    const auditResult = await db.collection('auditlogs').updateMany(
      { action: 'assign_therapist' },
      { $set: { action: 'assign_clinical' } }
    );
    console.log(`✅ Updated ${auditResult.modifiedCount} audit log actions`);
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📋 Summary of changes:');
    console.log(`   - User roles: ${userResult.modifiedCount} updated`);
    console.log(`   - Patient assignments: ${patientResult.modifiedCount} updated`);
    console.log(`   - Appointment assignments: ${appointmentResult.modifiedCount} updated`);
    console.log(`   - Treatment record assignments: ${treatmentResult.modifiedCount} updated`);
    console.log(`   - Notification roles: ${notificationResult.modifiedCount} updated`);
    console.log(`   - Audit log actions: ${auditResult.modifiedCount} updated`);
    
    console.log('\n⚠️  IMPORTANT: Please restart your application after this migration.');
    console.log('   The new field names (assignedClinicalId, clinicalId) are now active.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run migration
migrateTherapistToClinical()
  .then(() => {
    console.log('\n✅ Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration script failed:', error);
    process.exit(1);
  });
