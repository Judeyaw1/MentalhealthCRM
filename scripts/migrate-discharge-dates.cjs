#!/usr/bin/env node

/**
 * Migration script to fix discharge dates for existing patients
 * Moves discharge dates from patient.dischargeDate to patient.dischargeCriteria.dischargeDate
 */

const { MongoClient } = require('mongodb');

// Configuration - update these values for your environment
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mentalhealthtracker';
const DB_NAME = process.env.DB_NAME || 'mentalhealthtracker';

async function migrateDischargeDates() {
  let client;
  
  try {
    console.log('🚀 Starting discharge date migration...');
    
    // Connect to MongoDB
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db(DB_NAME);
    const patientsCollection = db.collection('patients');
    
    // Find all patients with status 'discharged'
    console.log('🔍 Finding discharged patients...');
    const dischargedPatients = await patientsCollection.find({ 
      status: 'discharged' 
    }).toArray();
    
    console.log(`📊 Found ${dischargedPatients.length} discharged patients`);
    
    if (dischargedPatients.length === 0) {
      console.log('✅ No discharged patients found. Migration complete.');
      return;
    }
    
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    // Process each discharged patient
    for (const patient of dischargedPatients) {
      try {
        console.log(`\n👤 Processing patient: ${patient.firstName} ${patient.lastName} (ID: ${patient._id})`);
        
        // Check if patient has a discharge date at the top level
        if (patient.dischargeDate) {
          console.log(`  📅 Found discharge date at top level: ${patient.dischargeDate}`);
          
          // Check if it's already in the correct location
          if (patient.dischargeCriteria && patient.dischargeCriteria.dischargeDate) {
            console.log(`  ⚠️  Discharge date already exists in correct location: ${patient.dischargeCriteria.dischargeDate}`);
            console.log(`  🔄 Updating to use the top-level date...`);
          }
          
          // Prepare update
          const updateData = {
            $set: {
              'dischargeCriteria.dischargeDate': patient.dischargeDate,
              updatedAt: new Date()
            }
          };
          
          // Remove the old top-level discharge date
          if (!patient.dischargeCriteria) {
            updateData.$set.dischargeCriteria = {
              targetSessions: 12,
              autoDischarge: false
            };
          }
          
          // Update the patient
          const result = await patientsCollection.updateOne(
            { _id: patient._id },
            updateData
          );
          
          if (result.modifiedCount > 0) {
            console.log(`  ✅ Successfully migrated discharge date`);
            migratedCount++;
          } else {
            console.log(`  ⚠️  No changes made`);
            skippedCount++;
          }
          
        } else if (patient.dischargeCriteria && patient.dischargeCriteria.dischargeDate) {
          console.log(`  ✅ Discharge date already in correct location: ${patient.dischargeCriteria.dischargeDate}`);
          skippedCount++;
          
        } else {
          console.log(`  ❌ No discharge date found anywhere`);
          
          // If patient is discharged but has no discharge date, set one based on updatedAt
          const dischargeDate = patient.updatedAt || patient.createdAt || new Date();
          console.log(`  🔄 Setting discharge date to: ${dischargeDate}`);
          
          const updateData = {
            $set: {
              'dischargeCriteria.dischargeDate': dischargeDate,
              updatedAt: new Date()
            }
          };
          
          if (!patient.dischargeCriteria) {
            updateData.$set.dischargeCriteria = {
              targetSessions: 12,
              autoDischarge: false
            };
          }
          
          const result = await patientsCollection.updateOne(
            { _id: patient._id },
            updateData
          );
          
          if (result.modifiedCount > 0) {
            console.log(`  ✅ Successfully set discharge date`);
            migratedCount++;
          } else {
            console.log(`  ⚠️  No changes made`);
            skippedCount++;
          }
        }
        
      } catch (error) {
        console.error(`  ❌ Error processing patient ${patient._id}:`, error.message);
        errorCount++;
      }
    }
    
    // Summary
    console.log('\n📋 Migration Summary:');
    console.log(`  ✅ Successfully migrated: ${migratedCount} patients`);
    console.log(`  ⏭️  Skipped (already correct): ${skippedCount} patients`);
    console.log(`  ❌ Errors: ${errorCount} patients`);
    console.log(`  📊 Total processed: ${dischargedPatients.length} patients`);
    
    if (errorCount === 0) {
      console.log('\n🎉 Migration completed successfully!');
    } else {
      console.log('\n⚠️  Migration completed with some errors. Check the logs above.');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 Disconnected from MongoDB');
    }
  }
}

// Run the migration
migrateDischargeDates().catch(console.error);
