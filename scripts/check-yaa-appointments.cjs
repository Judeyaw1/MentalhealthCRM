const { MongoClient } = require('mongodb');
const uri = 'mongodb://localhost:27017/mentalhealthtracker';

async function checkAppointments() {
  try {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('mentalhealthtracker');
    
    console.log('🔍 Checking appointments for Yaa Jackson...\n');
    
    // Find Yaa Jackson
    const patient = await db.collection('patients').findOne({ 
      $or: [
        { firstName: 'Yaa' },
        { lastName: 'Jackson' },
        { firstName: 'Yaa', lastName: 'Jackson' }
      ]
    });
    
    if (patient) {
      console.log('✅ Patient found:', patient.firstName, patient.lastName);
      console.log('   ID:', patient._id);
      console.log('   Created:', patient.createdAt);
      console.log('   Created by:', patient.createdBy || 'Unknown');
      console.log('');
      
      // Find appointments for this patient by ID
      const appointments = await db.collection('appointments').find({ 
        patientId: patient._id.toString() 
      }).toArray();
      
      console.log('📅 Appointments for Yaa Jackson (by ID):', appointments.length);
      appointments.forEach((apt, index) => {
        console.log(`   ${index + 1}. Date: ${apt.date} | Time: ${apt.time} | Type: ${apt.appointmentType}`);
        console.log(`      Created: ${apt.createdAt} | Created by: ${apt.createdBy || 'Unknown'}`);
        console.log(`      Status: ${apt.status} | Notes: ${apt.notes || 'None'}`);
        console.log('');
      });
      
      // Check appointments with patient name instead of ID (possible data inconsistency)
      const appointmentsByName = await db.collection('appointments').find({ 
        $or: [
          { patientName: { $regex: 'Yaa', $options: 'i' } },
          { patientName: { $regex: 'Jackson', $options: 'i' } }
        ]
      }).toArray();
      
      if (appointmentsByName.length > 0) {
        console.log('⚠️  Appointments found by name (possible data inconsistency):', appointmentsByName.length);
        appointmentsByName.forEach((apt, index) => {
          console.log(`   ${index + 1}. Date: ${apt.date} | Time: ${apt.time} | Type: ${apt.appointmentType}`);
          console.log(`      Patient Name: ${apt.patientName} | Created: ${apt.createdAt}`);
          console.log(`      Created by: ${apt.createdBy || 'Unknown'}`);
          console.log('');
        });
      }
      
      // Check if there are any appointments with this patient's name in the notes or description
      const appointmentsWithNameInNotes = await db.collection('appointments').find({ 
        $or: [
          { notes: { $regex: 'Yaa', $options: 'i' } },
          { notes: { $regex: 'Jackson', $options: 'i' } },
          { description: { $regex: 'Yaa', $options: 'i' } },
          { description: { $regex: 'Jackson', $options: 'i' } }
        ]
      }).toArray();
      
      if (appointmentsWithNameInNotes.length > 0) {
        console.log('📝 Appointments with Yaa Jackson mentioned in notes:', appointmentsWithNameInNotes.length);
        appointmentsWithNameInNotes.forEach((apt, index) => {
          console.log(`   ${index + 1}. Date: ${apt.date} | Time: ${apt.time} | Type: ${apt.appointmentType}`);
          console.log(`      Notes: ${apt.notes || 'None'}`);
          console.log(`      Description: ${apt.description || 'None'}`);
          console.log('');
        });
      }
      
    } else {
      console.log('❌ Patient Yaa Jackson not found');
      
      // Check if there are any patients with similar names
      const similarPatients = await db.collection('patients').find({ 
        $or: [
          { firstName: { $regex: 'Yaa', $options: 'i' } },
          { lastName: { $regex: 'Jackson', $options: 'i' } }
        ]
      }).toArray();
      
      if (similarPatients.length > 0) {
        console.log('\n🔍 Similar patients found:');
        similarPatients.forEach(patient => {
          console.log(`   - ${patient.firstName} ${patient.lastName} (ID: ${patient._id})`);
        });
      }
    }
    
    // Check all appointments to see if there are any orphaned ones
    const allAppointments = await db.collection('appointments').find({}).toArray();
    console.log(`\n📊 Total appointments in database: ${allAppointments.length}`);
    
    // Check for appointments without valid patient IDs
    const orphanedAppointments = allAppointments.filter(apt => !apt.patientId || apt.patientId === '');
    if (orphanedAppointments.length > 0) {
      console.log(`⚠️  Orphaned appointments (no patient ID): ${orphanedAppointments.length}`);
      orphanedAppointments.forEach(apt => {
        console.log(`   - Date: ${apt.date} | Time: ${apt.time} | Patient Name: ${apt.patientName || 'Unknown'}`);
      });
    }
    
    await client.close();
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkAppointments();
