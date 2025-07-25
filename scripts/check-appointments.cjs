const { MongoClient } = require('mongodb');

async function checkAppointments() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mental-health-tracker';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db();
    const appointmentsCollection = db.collection('appointments');
    const patientsCollection = db.collection('patients');

    // Print ALL appointments, showing raw patientId
    const appointments = await appointmentsCollection.find({}).toArray();
    console.log(`Found ${appointments.length} appointments:`);
    
    for (let i = 0; i < appointments.length; i++) {
      const apt = appointments[i];
      console.log(`\nAppointment ${i + 1}:`);
      console.log(`  ID: ${apt._id}`);
      console.log(`  Raw patientId:`, apt.patientId);
      console.log(`  Therapist ID:`, apt.therapistId);
      console.log(`  Date:`, apt.appointmentDate);
      console.log(`  Type:`, apt.type);
      console.log(`  Status:`, apt.status);
      // Try to find patient by string or ObjectId
      let patient = null;
      if (apt.patientId) {
        patient = await patientsCollection.findOne({ _id: apt.patientId })
          || await patientsCollection.findOne({ _id: apt.patientId.toString() })
          || await patientsCollection.findOne({ id: apt.patientId })
          || await patientsCollection.findOne({ id: apt.patientId.toString() });
      }
      if (patient) {
        console.log(`  Patient: ${patient.firstName} ${patient.lastName} (${patient.email})`);
      } else {
        console.log(`  Patient: Not found in patients collection`);
      }
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkAppointments(); 