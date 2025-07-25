// scripts/backfill-treatment-record-patient-names.js

const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mental-health-tracker';

async function main() {
  await mongoose.connect(MONGODB_URI);

  const Patient = mongoose.model('Patient', new mongoose.Schema({
    firstName: String,
    lastName: String,
  }), 'patients');

  const TreatmentRecord = mongoose.model('TreatmentRecord', new mongoose.Schema({
    patientId: mongoose.Schema.Types.ObjectId,
    patientName: String,
  }), 'treatmentrecords');

  const records = await TreatmentRecord.find({});
  let updatedCount = 0;

  for (const record of records) {
    if (!record.patientName && record.patientId) {
      const patient = await Patient.findById(record.patientId);
      if (patient) {
        record.patientName = `${patient.firstName} ${patient.lastName}`;
        await record.save();
        updatedCount++;
        console.log(`Updated record ${record._id} with patientName: ${record.patientName}`);
      }
    }
  }

  console.log(`Backfill complete. Updated ${updatedCount} records.`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Error during backfill:', err);
  process.exit(1);
}); 