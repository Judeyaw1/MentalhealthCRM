const { MongoClient } = require('mongodb');
const uri = 'mongodb://localhost:27017/mentalhealthtracker';

async function testAppointmentStatusUpdate() {
  try {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db('mentalhealthtracker');
    
    console.log('🧪 Testing appointment status update service...\n');
    
    // First, let's see the current state
    console.log('📅 Current appointment statuses:');
    const appointments = await db.collection('appointments').find({}).toArray();
    
    appointments.forEach((apt, index) => {
      const appointmentDate = new Date(apt.appointmentDate);
      const now = new Date();
      const hoursSinceAppointment = (now.getTime() - appointmentDate.getTime()) / (1000 * 60 * 60);
      
      console.log(`   ${index + 1}. Date: ${apt.appointmentDate} | Status: ${apt.status} | Hours since: ${hoursSinceAppointment.toFixed(1)}`);
    });
    
    console.log('\n🔍 John Doe\'s appointment details:');
    const johnDoeAppointment = appointments.find(apt => apt.patientId === '68916d2ffc4d57489f27e8');
    
    if (johnDoeAppointment) {
      const appointmentDate = new Date(johnDoeAppointment.appointmentDate);
      const now = new Date();
      const hoursSinceAppointment = (now.getTime() - appointmentDate.getTime()) / (1000 * 60 * 60);
      
      console.log(`   Current Status: ${johnDoeAppointment.status}`);
      console.log(`   Appointment Date: ${johnDoeAppointment.appointmentDate}`);
      console.log(`   Hours Since Appointment: ${hoursSinceAppointment.toFixed(1)}`);
      console.log(`   Should be marked as: ${hoursSinceAppointment > 24 ? 'no-show' : 'overdue'}`);
    }
    
    // Now let's manually update the status
    console.log('\n🔄 Manually updating appointment statuses...');
    
    for (const appointment of appointments) {
      const appointmentDate = new Date(appointment.appointmentDate);
      const now = new Date();
      const currentStatus = appointment.status;
      
      // Skip appointments that are already in final states
      if (['completed', 'cancelled', 'no-show'].includes(currentStatus)) {
        continue;
      }
      
      // Check if appointment is overdue (past date and still scheduled)
      if (currentStatus === 'scheduled' && appointmentDate < now) {
        // If appointment is more than 24 hours old, mark as missed
        const hoursSinceAppointment = (now.getTime() - appointmentDate.getTime()) / (1000 * 60 * 60);
        
        let newStatus = currentStatus;
        if (hoursSinceAppointment > 24) {
          newStatus = 'no-show';
        } else {
          newStatus = 'overdue';
        }
        
        // Update the appointment status
        await db.collection('appointments').updateOne(
          { _id: appointment._id },
          { 
            $set: { 
              status: newStatus,
              updatedAt: new Date()
            }
          }
        );
        
        console.log(`✅ Updated appointment ${appointment._id} from ${currentStatus} to ${newStatus}`);
      }
    }
    
    // Check the updated statuses
    console.log('\n📅 Updated appointment statuses:');
    const updatedAppointments = await db.collection('appointments').find({}).toArray();
    
    updatedAppointments.forEach((apt, index) => {
      const appointmentDate = new Date(apt.appointmentDate);
      const now = new Date();
      const hoursSinceAppointment = (now.getTime() - appointmentDate.getTime()) / (1000 * 60 * 60);
      
      console.log(`   ${index + 1}. Date: ${apt.appointmentDate} | Status: ${apt.status} | Hours since: ${hoursSinceAppointment.toFixed(1)}`);
    });
    
    await client.close();
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testAppointmentStatusUpdate();
