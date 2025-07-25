const { MongoClient } = require('mongodb');

async function debugAppointments() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mental-health-tracker';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db();
    const appointmentsCollection = db.collection('appointments');

    // Get ALL appointments and show raw documents
    const appointments = await appointmentsCollection.find({}).toArray();
    console.log(`Found ${appointments.length} appointments in database:`);
    
    if (appointments.length === 0) {
      console.log('No appointments found in database.');
      return;
    }

    appointments.forEach((apt, index) => {
      console.log(`\n=== Appointment ${index + 1} ===`);
      console.log('Raw document:', JSON.stringify(apt, null, 2));
    });

    // Check for appointments with null/undefined patientId
    const nullPatientAppointments = appointments.filter(apt => !apt.patientId);
    if (nullPatientAppointments.length > 0) {
      console.log(`\n⚠️  Found ${nullPatientAppointments.length} appointments with null/undefined patientId:`);
      nullPatientAppointments.forEach((apt, index) => {
        console.log(`  ${index + 1}. ID: ${apt._id}, Type: ${apt.type}, Date: ${apt.appointmentDate}`);
      });
    }

    // Check for duplicate appointments
    const appointmentIds = appointments.map(apt => apt._id.toString());
    const uniqueIds = [...new Set(appointmentIds)];
    if (appointmentIds.length !== uniqueIds.length) {
      console.log(`\n⚠️  Found duplicate appointment IDs!`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

debugAppointments(); 