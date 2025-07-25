const { MongoClient } = require('mongodb');

async function addTheo() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mental-health-tracker';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db();
    const patientsCollection = db.collection('patients');

    // Check if Theo already exists
    const existingTheo = await patientsCollection.findOne({ 
      firstName: 'Theo', 
      lastName: 'Osafo' 
    });

    if (existingTheo) {
      console.log('Theo Osafo already exists in the database');
      return;
    }

    // Add Theo Osafo
    const theo = {
      firstName: 'Theo',
      lastName: 'Osafo',
      dateOfBirth: new Date('1995-06-15'),
      gender: 'male',
      email: 'theo.osafo@example.com',
      phone: '555-0104',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await patientsCollection.insertOne(theo);
    console.log('Added Theo Osafo to the database');
    console.log('Patient ID:', result.insertedId);

    // Verify he was added
    const allPatients = await patientsCollection.find({}).toArray();
    console.log(`Total patients now: ${allPatients.length}`);
    allPatients.forEach((patient, index) => {
      console.log(`${index + 1}. ${patient.firstName} ${patient.lastName} (${patient.email})`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

addTheo(); 