const { MongoClient } = require('mongodb');

async function testPatientAppointments() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mental-health-tracker';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db();
    const patientsCollection = db.collection('patients');
    const appointmentsCollection = db.collection('appointments');

    // Get all patients
    const patients = await patientsCollection.find({}).toArray();
    console.log(`Found ${patients.length} patients:`);
    
    patients.forEach((patient, index) => {
      console.log(`${index + 1}. ${patient.firstName} ${patient.lastName} (ID: ${patient._id})`);
    });

    // Test appointments for each patient
    for (const patient of patients) {
      console.log(`\n=== Testing appointments for ${patient.firstName} ${patient.lastName} ===`);
      
      // Get appointments for this specific patient
      const patientAppointments = await appointmentsCollection.find({
        patientId: patient._id
      }).toArray();
      
      console.log(`Found ${patientAppointments.length} appointments for ${patient.firstName}:`);
      
      if (patientAppointments.length > 0) {
        patientAppointments.forEach((apt, index) => {
          console.log(`  ${index + 1}. ${apt.type} on ${apt.appointmentDate} (Status: ${apt.status})`);
        });
      } else {
        console.log('  No appointments found');
      }
    }

    // Also check if there are any appointments with null patientId
    const nullPatientAppointments = await appointmentsCollection.find({
      patientId: null
    }).toArray();
    
    if (nullPatientAppointments.length > 0) {
      console.log(`\n⚠️  Found ${nullPatientAppointments.length} appointments with null patientId!`);
      nullPatientAppointments.forEach((apt, index) => {
        console.log(`  ${index + 1}. ID: ${apt._id}, Type: ${apt.type}, Date: ${apt.appointmentDate}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

testPatientAppointments(); 