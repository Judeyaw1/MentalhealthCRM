const { MongoClient } = require('mongodb');
const uri = 'mongodb://localhost:27017/mentalhealthtracker';

async function checkAllAppointments() {
  try {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('mentalhealthtracker');
    
    console.log('🔍 Checking all appointments in database...\n');
    
    // Get all appointments
    const allAppointments = await db.collection('appointments').find({}).toArray();
    console.log(`📊 Total appointments: ${allAppointments.length}\n`);
    
    allAppointments.forEach((apt, index) => {
      console.log(`📅 Appointment ${index + 1}:`);
      console.log(`   Date: ${apt.date}`);
      console.log(`   Time: ${apt.time}`);
      console.log(`   Type: ${apt.appointmentType}`);
      console.log(`   Patient ID: ${apt.patientId || 'MISSING'}`);
      console.log(`   Patient Name: ${apt.patientName || 'MISSING'}`);
      console.log(`   Status: ${apt.status}`);
      console.log(`   Created: ${apt.createdAt}`);
      console.log(`   Created by: ${apt.createdBy || 'Unknown'}`);
      console.log(`   Notes: ${apt.notes || 'None'}`);
      console.log(`   Description: ${apt.description || 'None'}`);
      console.log(`   Full appointment object:`, JSON.stringify(apt, null, 2));
      console.log('');
    });
    
    // Check for appointments with missing patient IDs
    const appointmentsWithoutPatientId = allAppointments.filter(apt => !apt.patientId || apt.patientId === '');
    if (appointmentsWithoutPatientId.length > 0) {
      console.log(`⚠️  Appointments without patient ID: ${appointmentsWithoutPatientId.length}`);
      appointmentsWithoutPatientId.forEach(apt => {
        console.log(`   - Date: ${apt.date} | Time: ${apt.time} | Patient Name: ${apt.patientName || 'Unknown'}`);
      });
    }
    
    // Check for appointments with patient names but no IDs
    const appointmentsWithNameNoId = allAppointments.filter(apt => apt.patientName && (!apt.patientId || apt.patientId === ''));
    if (appointmentsWithNameNoId.length > 0) {
      console.log(`⚠️  Appointments with patient name but no ID: ${appointmentsWithNameNoId.length}`);
      appointmentsWithNameNoId.forEach(apt => {
        console.log(`   - Date: ${apt.date} | Time: ${apt.time} | Patient Name: ${apt.patientName}`);
      });
    }
    
    await client.close();
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkAllAppointments();
