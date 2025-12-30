import * as admin from 'firebase-admin';

// Initialize Firebase with environment variables
if (!admin.apps.length) {
  if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PROJECT_ID) {
    // Use service account from environment variables
    const serviceAccount = {
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
    };
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } else {
    // Fallback to Application Default Credentials
    // In local dev, set GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
    // In Cloud Run, it uses the service account automatically.
    admin.initializeApp({
      credential: admin.credential.applicationDefault()
    });
  }
}

export const db = admin.firestore();
export const auth = admin.auth();
export const Timestamp = admin.firestore.Timestamp;
export default admin;