import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getAnalytics } from 'firebase/analytics';

// Your Firebase configuration
// You'll need to replace these with your actual Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyC4gmTVgQaCquyjduEqNexQppxShccl6YQ",
  authDomain: "mentalhealthcrm.firebaseapp.com",
  databaseURL: "https://mentalhealthcrm-default-rtdb.firebaseio.com",
  projectId: "mentalhealthcrm",
  storageBucket: "mentalhealthcrm.firebasestorage.app",
  messagingSenderId: "929079713021",
  appId: "1:929079713021:web:8ee461a479eeaceacf3294",
  measurementId: "G-T8X4JQEB7N"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Auth
export const auth = getAuth(app);

// Initialize Analytics (optional)
export const analytics = getAnalytics(app);

export default app; 