const mongoose = require('mongoose');

// Connect to MongoDB using the same connection as the server
mongoose.connect('mongodb://localhost:27017/mental_health_tracker', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const Patient = require('../server/models/Patient');
const Appointment = require('../server/models/Appointment');
const TreatmentRecord = require('../server/models/TreatmentRecord');

async function debugPatientIds() {
  try {
    console.log('🔍 Debugging Patient IDs...\n');

    // Get all patients
    const patients = await Patient.find().lean();
    console.log('📋 All Patients:');
    patients.forEach(p => {
      console.log(`  - ${p.firstName} ${p.lastName}: ${p._id} (${typeof p._id})`);
    });

    // Get all appointments
    const appointments = await Appointment.find().populate('patientId', 'firstName lastName').lean();
    console.log('\n📅 All Appointments:');
    appointments.forEach(apt => {
      console.log(`  - ${apt.patientId.firstName} ${apt.patientId.lastName}: ${apt.patientId._id} (${typeof apt.patientId._id})`);
    });

    // Get all treatment records
    const records = await TreatmentRecord.find().populate('patientId', 'firstName lastName').lean();
    console.log('\n📝 All Treatment Records:');
    records.forEach(record => {
      console.log(`  - ${record.patientId.firstName} ${record.patientId.lastName}: ${record.patientId._id} (${typeof record.patientId._id})`);
    });

    // Test filtering for a specific patient
    if (patients.length > 0) {
      const testPatient = patients[0];
      console.log(`\n🧪 Testing filter for patient: ${testPatient.firstName} ${testPatient.lastName}`);
      console.log(`   Patient ID: ${testPatient._id} (${typeof testPatient._id})`);
      
      // Test as string
      const stringId = testPatient._id.toString();
      console.log(`   As string: ${stringId} (${typeof stringId})`);
      
      // Test as ObjectId
      const objectId = new mongoose.Types.ObjectId(testPatient._id);
      console.log(`   As ObjectId: ${objectId} (${typeof objectId})`);
      
      // Test filtering with string
      const recordsWithString = await TreatmentRecord.find({ patientId: stringId }).populate('patientId', 'firstName lastName').lean();
      console.log(`   Records found with string ID: ${recordsWithString.length}`);
      
      // Test filtering with ObjectId
      const recordsWithObjectId = await TreatmentRecord.find({ patientId: objectId }).populate('patientId', 'firstName lastName').lean();
      console.log(`   Records found with ObjectId: ${recordsWithObjectId.length}`);
      
      // Test filtering with original _id
      const recordsWithOriginal = await TreatmentRecord.find({ patientId: testPatient._id }).populate('patientId', 'firstName lastName').lean();
      console.log(`   Records found with original _id: ${recordsWithOriginal.length}`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.connection.close();
  }
}

debugPatientIds(); 