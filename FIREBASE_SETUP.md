# Firebase Setup Guide for Mental Health Tracker

## ✅ **Your Firebase Project is Ready!**

**Project Name:** mentalhealthcrm  
**Project ID:** mentalhealthcrm  
**Status:** ✅ Created and configured

## 🔧 **Next Steps to Complete Setup:**

### Step 1: Enable Firestore Database

1. Go to [Firebase Console](https://console.firebase.google.com/project/mentalhealthcrm)
2. Click "Firestore Database" in the left sidebar
3. Click "Create database"
4. Choose "Start in test mode" for development
5. Select a location close to your users (recommended: us-central1)
6. Click "Done"

### Step 2: Enable Authentication

1. Go to "Authentication" in the left sidebar
2. Click "Get started"
3. Go to "Sign-in method" tab
4. Enable "Email/Password" authentication
5. Click "Save"

### Step 3: Get Your Service Account Key

1. Go to Project Settings (gear icon)
2. Go to "Service accounts" tab
3. Click "Generate new private key"
4. Download the JSON file
5. **IMPORTANT:** Save this file securely and don't commit it to git

### Step 4: Set Up Environment Variables

Create a `.env` file in your project root using the template in `env.template`:

```bash
# Copy the template
cp env.template .env

# Edit the .env file with your actual values
```

Fill in your Firebase service account details from the downloaded JSON file.

### Step 5: Set Up Firestore Collections

Your Firestore database will automatically create these collections when you start using them:

```
users/
  - id: string
  - email: string
  - firstName: string
  - lastName: string
  - role: 'admin' | 'staff' | 'therapist'
  - password: string (hashed)
  - forcePasswordChange: boolean
  - createdAt: timestamp
  - updatedAt: timestamp

patients/
  - id: string
  - firstName: string
  - lastName: string
  - email: string
  - phone: string
  - dateOfBirth: timestamp
  - gender: 'male' | 'female' | 'other'
  - address: string
  - emergencyContact: object
  - assignedTherapistId: string
  - createdAt: timestamp
  - updatedAt: timestamp

appointments/
  - id: string
  - patientId: string
  - therapistId: string
  - appointmentDate: timestamp
  - duration: number
  - status: 'scheduled' | 'completed' | 'cancelled'
  - notes: string
  - createdAt: timestamp
  - updatedAt: timestamp

treatmentRecords/
  - id: string
  - patientId: string
  - therapistId: string
  - sessionDate: timestamp
  - sessionNotes: string
  - treatmentPlan: string
  - progress: string
  - nextSteps: string
  - createdAt: timestamp
  - updatedAt: timestamp

auditLogs/
  - id: string
  - userId: string
  - action: string
  - resource: string
  - resourceId: string
  - details: object
  - timestamp: timestamp
```

### Step 6: Set Up Security Rules

In Firestore Database > Rules, add these security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Staff can read all users
    match /users/{userId} {
      allow read: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'staff'];
    }

    // Patients - therapists can read their assigned patients
    match /patients/{patientId} {
      allow read, write: if request.auth != null &&
        (resource.data.assignedTherapistId == request.auth.uid ||
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'staff']);
    }

    // Appointments - therapists can manage their appointments
    match /appointments/{appointmentId} {
      allow read, write: if request.auth != null &&
        (resource.data.therapistId == request.auth.uid ||
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'staff']);
    }

    // Treatment records - therapists can manage their records
    match /treatmentRecords/{recordId} {
      allow read, write: if request.auth != null &&
        (resource.data.therapistId == request.auth.uid ||
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'staff']);
    }

    // Audit logs - only admins can read
    match /auditLogs/{logId} {
      allow read: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
      allow write: if request.auth != null;
    }
  }
}
```

## 🚀 **Test Your Firebase Integration**

Once you've completed the setup:

1. **Start your server:**

   ```bash
   npm run dev
   ```

2. **Test the connection:**
   - Your app should now connect to Firebase
   - Check the Firebase Console to see data being created
   - The dashboard stats should update in real-time

## 📊 **Firebase Console Features You'll Get:**

✅ **Real-time Database Viewer** - See data updates live  
✅ **Query Builder** - Test queries visually  
✅ **User Management** - Manage authentication users  
✅ **Analytics Dashboard** - Track app usage  
✅ **Performance Monitoring** - Monitor app performance  
✅ **Crash Reporting** - Get error reports

## 🔗 **Your Firebase Project Links:**

- **Firebase Console:** https://console.firebase.google.com/project/mentalhealthcrm
- **Firestore Database:** https://console.firebase.google.com/project/mentalhealthcrm/firestore
- **Authentication:** https://console.firebase.google.com/project/mentalhealthcrm/authentication
- **Project Settings:** https://console.firebase.google.com/project/mentalhealthcrm/settings

## 🆘 **Need Help?**

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Documentation](https://firebase.google.com/docs/firestore)
- [Firebase Console](https://console.firebase.google.com/project/mentalhealthcrm)

---

**🎉 Congratulations! Your Mental Health Tracker now has a professional, scalable Firebase backend!**
