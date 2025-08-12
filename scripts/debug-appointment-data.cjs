const { MongoClient } = require('mongodb');
const uri = 'mongodb://localhost:27017/mentalhealthtracker';

async function debugAppointmentData() {
  try {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('mentalhealthtracker');
    
    console.log('🔍 Debugging appointment data...\n');
    
    // Get the specific appointment - try both as string and as ObjectId
    const appointmentId = '6892e00276f2bb1f78fba0d0';
    let appointment = await db.collection('appointments').findOne({ 
      _id: appointmentId 
    });
    
    if (!appointment) {
      // Try with ObjectId
      const { ObjectId } = require('mongodb');
      appointment = await db.collection('appointments').findOne({ 
        _id: new ObjectId(appointmentId)
      });
    }
    
    if (appointment) {
      console.log('📅 Appointment found:');
      console.log('   ID:', appointment._id);
      console.log('   Patient ID:', appointment.patientId);
      console.log('   Patient ID type:', typeof appointment.patientId);
      console.log('   Date:', appointment.appointmentDate);
      console.log('   Type:', appointment.type);
      console.log('   Status:', appointment.status);
      console.log('   Created:', appointment.createdAt);
      console.log('   Created by:', appointment.createdBy);
      console.log('');
      
      // Check if the patientId exists in the patients collection
      const patient = await db.collection('patients').findOne({ 
        _id: appointment.patientId 
      });
      
      if (patient) {
        console.log('✅ Patient found for appointment:');
        console.log('   Name:', patient.firstName, patient.lastName);
        console.log('   ID:', patient._id);
        console.log('   Status:', patient.status);
      } else {
        console.log('❌ No patient found with ID:', appointment.patientId);
      }
      
      // Now check Yaa Jackson's actual ID
      const yaaJackson = await db.collection('patients').findOne({ 
        firstName: 'Yaa',
        lastName: 'Jackson'
      });
      
      if (yaaJackson) {
        console.log('\n👤 Yaa Jackson details:');
        console.log('   Name:', yaaJackson.firstName, yaaJackson.lastName);
        console.log('   ID:', yaaJackson._id);
        console.log('   Status:', yaaJackson.status);
        
        // Check if there are any appointments with Yaa Jackson's ID
        const yaaAppointments = await db.collection('appointments').find({ 
          patientId: yaaJackson._id.toString()
        }).toArray();
        
        console.log('\n📅 Appointments for Yaa Jackson (by her actual ID):', yaaAppointments.length);
        yaaAppointments.forEach((apt, index) => {
          console.log(`   ${index + 1}. Date: ${apt.appointmentDate} | Type: ${apt.type} | Status: ${apt.status}`);
        });
        
        // Check if there are any appointments with Yaa Jackson's name
        const appointmentsWithYaaName = await db.collection('appointments').find({ 
          $or: [
            { patientName: { $regex: 'Yaa', $options: 'i' } },
            { patientName: { $regex: 'Jackson', $options: 'i' } }
          ]
        }).toArray();
        
        if (appointmentsWithYaaName.length > 0) {
          console.log('\n⚠️  Appointments with Yaa Jackson name:', appointmentsWithYaaName.length);
          appointmentsWithYaaName.forEach((apt, index) => {
            console.log(`   ${index + 1}. Date: ${apt.appointmentDate} | Type: ${apt.type} | Patient Name: ${apt.patientName}`);
          });
        }
      }
      
      // Check if there's a mismatch in the frontend query
      console.log('\n🔍 Frontend query analysis:');
      console.log('   When PatientDetail fetches appointments, it uses patientId:', yaaJackson?._id);
      console.log('   The appointment has patientId:', appointment.patientId);
      console.log('   Are they equal?', yaaJackson?._id.toString() === appointment.patientId);
      
    } else {
      console.log('❌ Appointment not found');
    }
    
    await client.close();
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugAppointmentData();
