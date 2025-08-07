import mongoose from 'mongoose';

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mentalhealthtracker';

async function getPatientIds() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get the Patient model
    const Patient = mongoose.model('Patient', new mongoose.Schema({
      firstName: String,
      lastName: String,
      email: String,
      status: String,
    }));

    // Find all patients
    const patients = await Patient.find({});
    
    console.log(`\nFound ${patients.length} patients:`);
    patients.forEach((patient, index) => {
      console.log(`${index + 1}. ${patient.firstName} ${patient.lastName} (${patient.email}) - ID: ${patient._id} - Status: ${patient.status}`);
    });

  } catch (error) {
    console.error('Error getting patient IDs:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the script
getPatientIds().then(() => {
  console.log('Script completed');
  process.exit(0);
}).catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
