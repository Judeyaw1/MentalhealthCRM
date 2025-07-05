import mongoose from 'mongoose';
import { TreatmentRecord } from './server/models/TreatmentRecord.ts';
import { User } from './server/models/User.ts';

const mongoUri = 'mongodb://localhost:27017/mentalhealthtracker';

async function main() {
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  // Get all valid user IDs
  const users = await User.find({}, '_id firstName lastName email role').lean();
  const validUserIds = new Set(users.map(u => u._id.toString()));

  // Find all treatment records
  const records = await TreatmentRecord.find().lean();
  let badRecords = [];
  for (const record of records) {
    if (!record.therapistId || !validUserIds.has(record.therapistId.toString())) {
      badRecords.push(record);
    }
  }

  if (badRecords.length === 0) {
    console.log('✅ All treatment records have valid therapist references.');
  } else {
    console.log(`Found ${badRecords.length} treatment records with invalid therapist references.`);
    for (const record of badRecords) {
      console.log(`- Record ID: ${record._id}, therapistId: ${record.therapistId}`);
      await TreatmentRecord.deleteOne({ _id: record._id });
      console.log('  Deleted.');
    }
    console.log('✅ All bad treatment records have been deleted.');
  }

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB');
}

main().catch(e => { console.error(e); process.exit(1); }); 