#!/usr/bin/env node

/**
 * Cleanup script to remove old top-level discharge dates
 * Run this AFTER running the migration script
 */

const { MongoClient } = require('mongodb');

// Configuration - update these values for your environment
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mentalhealthtracker';
const DB_NAME = process.env.DB_NAME || 'mentalhealthtracker';

async function cleanupOldDischargeDates() {
  let client;
  
  try {
    console.log('🧹 Starting cleanup of old discharge dates...');
    
    // Connect to MongoDB
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db(DB_NAME);
    const patientsCollection = db.collection('patients');
    
    // Find all patients with top-level dischargeDate that should be removed
    console.log('🔍 Finding patients with old top-level discharge dates...');
    const patientsWithOldDates = await patientsCollection.find({ 
      dischargeDate: { $exists: true }
    }).toArray();
    
    console.log(`📊 Found ${patientsWithOldDates.length} patients with old discharge dates`);
    
    if (patientsWithOldDates.length === 0) {
      console.log('✅ No old discharge dates found. Cleanup complete.');
      return;
    }
    
    let cleanedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    // Process each patient
    for (const patient of patientsWithOldDates) {
      try {
        console.log(`\n👤 Processing patient: ${patient.firstName} ${patient.lastName} (ID: ${patient._id})`);
        
        // Check if they have the discharge date in the correct location
        if (patient.dischargeCriteria && patient.dischargeCriteria.dischargeDate) {
          console.log(`  ✅ Discharge date exists in correct location: ${patient.dischargeCriteria.dischargeDate}`);
          console.log(`  🗑️  Removing old top-level discharge date: ${patient.dischargeDate}`);
          
          // Remove the old top-level discharge date
          const result = await patientsCollection.updateOne(
            { _id: patient._id },
            { 
              $unset: { dischargeDate: "" },
              $set: { updatedAt: new Date() }
            }
          );
          
          if (result.modifiedCount > 0) {
            console.log(`  ✅ Successfully removed old discharge date`);
            cleanedCount++;
          } else {
            console.log(`  ⚠️  No changes made`);
            skippedCount++;
          }
          
        } else {
          console.log(`  ⚠️  No discharge date in correct location, skipping cleanup`);
          skippedCount++;
        }
        
      } catch (error) {
        console.error(`  ❌ Error processing patient ${patient._id}:`, error.message);
        errorCount++;
      }
    }
    
    // Summary
    console.log('\n📋 Cleanup Summary:');
    console.log(`  ✅ Successfully cleaned: ${cleanedCount} patients`);
    console.log(`  ⏭️  Skipped: ${skippedCount} patients`);
    console.log(`  ❌ Errors: ${errorCount} patients`);
    console.log(`  📊 Total processed: ${patientsWithOldDates.length} patients`);
    
    if (errorCount === 0) {
      console.log('\n🎉 Cleanup completed successfully!');
      console.log('💡 All discharge dates are now properly stored in dischargeCriteria.dischargeDate');
    } else {
      console.log('\n⚠️  Cleanup completed with some errors. Check the logs above.');
    }
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 Disconnected from MongoDB');
    }
  }
}

// Run the cleanup
cleanupOldDischargeDates().catch(console.error);
