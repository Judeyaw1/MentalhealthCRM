const { MongoClient } = require('mongodb');
const uri = 'mongodb://localhost:27017/mentalhealthtracker';

async function checkAllPatientsAppointments() {
  try {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('mentalhealthtracker');
    
    console.log('🔍 Checking all patients for appointment mismatches...\n');
    
    // Get all patients
    const allPatients = await db.collection('patients').find({}).toArray();
    console.log(`📊 Total patients: ${allPatients.length}\n`);
    
    // Get all appointments
    const allAppointments = await db.collection('appointments').find({}).toArray();
    console.log(`📅 Total appointments: ${allAppointments.length}\n`);
    
    let patientsWithIssues = 0;
    let totalIssues = 0;
    
    // Check each patient
    for (const patient of allPatients) {
      console.log(`👤 Checking ${patient.firstName} ${patient.lastName} (ID: ${patient._id})...`);
      
      // Find appointments that should belong to this patient
      const correctAppointments = allAppointments.filter(apt => 
        apt.patientId && apt.patientId.toString() === patient._id.toString()
      );
      
      // Find appointments that might be incorrectly linked (by name or other fields)
      const potentiallyIncorrectAppointments = allAppointments.filter(apt => {
        // Skip appointments that are correctly linked
        if (apt.patientId && apt.patientId.toString() === patient._id.toString()) {
          return false;
        }
        
        // Check if appointment has patient name that matches this patient
        if (apt.patientName) {
          const aptName = apt.patientName.toLowerCase();
          const patientName = `${patient.firstName} ${patient.lastName}`.toLowerCase();
          return aptName.includes(patient.firstName.toLowerCase()) || 
                 aptName.includes(patient.lastName.toLowerCase());
        }
        
        // Check if appointment notes mention this patient
        if (apt.notes) {
          const notes = apt.notes.toLowerCase();
          const patientName = `${patient.firstName} ${patient.lastName}`.toLowerCase();
          return notes.includes(patient.firstName.toLowerCase()) || 
                 notes.includes(patient.lastName.toLowerCase());
        }
        
        return false;
      });
      
      if (correctAppointments.length > 0) {
        console.log(`   ✅ Correct appointments: ${correctAppointments.length}`);
        correctAppointments.forEach(apt => {
          console.log(`      - ${apt.appointmentDate} | ${apt.type} | ${apt.status}`);
        });
      }
      
      if (potentiallyIncorrectAppointments.length > 0) {
        console.log(`   ⚠️  POTENTIAL ISSUES: ${potentiallyIncorrectAppointments.length} appointments that might be incorrectly linked`);
        patientsWithIssues++;
        totalIssues += potentiallyIncorrectAppointments.length;
        
        potentiallyIncorrectAppointments.forEach(apt => {
          console.log(`      - ${apt.appointmentDate} | ${apt.type} | ${apt.status}`);
          console.log(`        Patient ID: ${apt.patientId} | Patient Name: ${apt.patientName || 'None'}`);
          console.log(`        Notes: ${apt.notes || 'None'}`);
        });
      }
      
      if (correctAppointments.length === 0 && potentiallyIncorrectAppointments.length === 0) {
        console.log(`   ℹ️  No appointments found`);
      }
      
      console.log('');
    }
    
    // Summary
    console.log('📋 SUMMARY:');
    console.log(`   Total patients: ${allPatients.length}`);
    console.log(`   Total appointments: ${allAppointments.length}`);
    console.log(`   Patients with potential issues: ${patientsWithIssues}`);
    console.log(`   Total potential issues: ${totalIssues}`);
    
    if (patientsWithIssues === 0) {
      console.log('   ✅ All patients appear to have correct appointment data!');
    } else {
      console.log('   ⚠️  Some patients may have appointment data issues');
    }
    
    // Check for orphaned appointments (no valid patient ID)
    const orphanedAppointments = allAppointments.filter(apt => {
      if (!apt.patientId) return true;
      
      // Check if the patientId exists in the patients collection
      const patientExists = allPatients.some(patient => 
        patient._id.toString() === apt.patientId.toString()
      );
      
      return !patientExists;
    });
    
    if (orphanedAppointments.length > 0) {
      console.log(`\n🚨 ORPHANED APPOINTMENTS: ${orphanedAppointments.length} appointments with invalid patient IDs`);
      orphanedAppointments.forEach(apt => {
        console.log(`   - ID: ${apt._id} | Patient ID: ${apt.patientId} | Date: ${apt.appointmentDate}`);
      });
    }
    
    await client.close();
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkAllPatientsAppointments();
