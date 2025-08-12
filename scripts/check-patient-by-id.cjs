const { MongoClient } = require('mongodb');
const uri = 'mongodb://localhost:27017/mentalhealthtracker';

async function checkPatientById() {
  try {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('mentalhealthtracker');
    
    console.log('🔍 Checking patient by appointment ID...\n');
    
    // The appointment has this patient ID
    const appointmentPatientId = '68916d2ffc4d57489f27e8';
    
    // Find the patient with this ID
    const patient = await db.collection('patients').findOne({ 
      _id: appointmentPatientId
    });
    
    if (patient) {
      console.log('✅ Patient found for appointment:');
      console.log(`   Name: ${patient.firstName} ${patient.lastName}`);
      console.log(`   ID: ${patient._id}`);
      console.log(`   Created: ${patient.createdAt}`);
      console.log(`   Created by: ${patient.createdBy || 'Unknown'}`);
    } else {
      console.log('❌ No patient found with ID:', appointmentPatientId);
      
      // Check if there are any patients with similar IDs
      const allPatients = await db.collection('patients').find({}).toArray();
      console.log('\n🔍 All patients in database:');
      allPatients.forEach(patient => {
        console.log(`   - ${patient.firstName} ${patient.lastName} (ID: ${patient._id})`);
      });
    }
    
    // Also check the user who created the appointment
    const appointmentCreatorId = '6868b33c2e6ad4dc0b1cb52a';
    const creator = await db.collection('users').findOne({ 
      _id: appointmentCreatorId
    });
    
    if (creator) {
      console.log('\n👤 Appointment creator:');
      console.log(`   Name: ${creator.firstName} ${creator.lastName}`);
      console.log(`   Email: ${creator.email}`);
      console.log(`   Role: ${creator.role}`);
    } else {
      console.log('\n❌ Appointment creator not found');
    }
    
    await client.close();
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkPatientById();
