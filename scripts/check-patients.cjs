const { MongoClient } = require('mongodb');

async function checkPatients() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mental-health-tracker';
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db();
    const patientsCollection = db.collection('patients');

    // Check existing patients
    const existingPatients = await patientsCollection.find({}).toArray();
    console.log(`Found ${existingPatients.length} existing patients:`);
    
    if (existingPatients.length > 0) {
      existingPatients.forEach((patient, index) => {
        console.log(`${index + 1}. ${patient.firstName} ${patient.lastName} (${patient.email})`);
      });
    } else {
      console.log('No patients found. Creating test patients...');
      
      // Create test patients
      const testPatients = [
        {
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: new Date('1990-01-15'),
          gender: 'male',
          email: 'john.doe@example.com',
          phone: '555-0101',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          firstName: 'Jane',
          lastName: 'Smith',
          dateOfBirth: new Date('1985-03-22'),
          gender: 'female',
          email: 'jane.smith@example.com',
          phone: '555-0102',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          firstName: 'Michael',
          lastName: 'Johnson',
          dateOfBirth: new Date('1978-07-10'),
          gender: 'male',
          email: 'michael.johnson@example.com',
          phone: '555-0103',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const result = await patientsCollection.insertMany(testPatients);
      console.log(`Created ${result.insertedCount} test patients`);
      
      // Verify they were created
      const newPatients = await patientsCollection.find({}).toArray();
      console.log(`Total patients now: ${newPatients.length}`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkPatients(); 