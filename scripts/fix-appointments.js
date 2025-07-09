import { MongoClient, ObjectId } from "mongodb";

async function fixAppointments() {
  const uri =
    process.env.MONGODB_URI || "mongodb://localhost:27017/mentalhealthtracker";

  try {
    const client = new MongoClient(uri);
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db();
    const appointments = db.collection("appointments");
    const patients = db.collection("patients");
    const users = db.collection("users");

    // Find all appointments
    const allAppointments = await appointments.find({}).toArray();
    console.log(`Found ${allAppointments.length} appointments`);

    let deletedCount = 0;

    for (const appointment of allAppointments) {
      let shouldDelete = false;
      // Check if patient exists
      if (
        !appointment.patientId ||
        !(await patients.findOne({ _id: new ObjectId(appointment.patientId) }))
      ) {
        console.log(
          `Appointment ${appointment._id} has invalid patient reference: ${appointment.patientId}`,
        );
        shouldDelete = true;
      }
      // Check if therapist exists
      if (
        !appointment.therapistId ||
        !(await users.findOne({ _id: new ObjectId(appointment.therapistId) }))
      ) {
        console.log(
          `Appointment ${appointment._id} has invalid therapist reference: ${appointment.therapistId}`,
        );
        shouldDelete = true;
      }
      if (shouldDelete) {
        await appointments.deleteOne({ _id: appointment._id });
        deletedCount++;
        console.log(`Deleted appointment ${appointment._id}`);
      }
    }

    console.log(`\nSummary:`);
    console.log(`- Deleted invalid appointments: ${deletedCount}`);

    await client.close();
    console.log("Disconnected from MongoDB");
  } catch (error) {
    console.error("Error:", error);
  }
}

fixAppointments();
