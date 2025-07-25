// scripts/delete-non-user-appointments.cjs
const { MongoClient, ObjectId } = require('mongodb');

async function deleteNonUserAppointments() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mental-health-tracker';
  const client = new MongoClient(uri);

  // Add your real patient IDs here (as strings)
  const realPatientIds = [
    // '60f7c2b8e1d2c8a1b8e1d2c8',
    // 'another-real-patient-id',
  ].map(id => new ObjectId(id));

  try {
    await client.connect();
    const db = client.db();
    const appointments = db.collection('appointments');

    // Delete appointments NOT linked to your real patients
    const result = await appointments.deleteMany({
      patientId: { $nin: realPatientIds }
    });

    console.log(`Deleted ${result.deletedCount} non-user appointments.`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

deleteNonUserAppointments(); 