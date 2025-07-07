// Run this script with: node fix-bad-patients.js
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mentalhealthtracker';

async function main() {
  await mongoose.connect(MONGO_URI);
  const Patient = mongoose.model('Patient', new mongoose.Schema({}, { strict: false }));

  // Fix top-level fields
  const result1 = await Patient.updateMany(
    { createdBy: "" },
    { $set: { createdBy: null } }
  );
  const result2 = await Patient.updateMany(
    { assignedTherapistId: "" },
    { $set: { assignedTherapistId: null } }
  );

  // Fix inquiries.assignedTo and inquiries.createdBy
  const result3 = await Patient.updateMany(
    { "inquiries.assignedTo": "" },
    { $set: { "inquiries.$[elem].assignedTo": null } },
    { arrayFilters: [{ "elem.assignedTo": "" }] }
  );
  const result4 = await Patient.updateMany(
    { "inquiries.createdBy": "" },
    { $set: { "inquiries.$[elem].createdBy": null } },
    { arrayFilters: [{ "elem.createdBy": "" }] }
  );

  console.log(`Updated patients: createdBy=${result1.modifiedCount}, assignedTherapistId=${result2.modifiedCount}, inquiries.assignedTo=${result3.modifiedCount}, inquiries.createdBy=${result4.modifiedCount}`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
}); 