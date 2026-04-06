const admin = require('firebase-admin');
const dotenv = require('dotenv');

dotenv.config();

try {
  if (process.env.FIREBASE_PRIVATE_KEY && admin.apps.length === 0) {
    const rawKey = process.env.FIREBASE_PRIVATE_KEY;
    // Handle various formatting issues: literal newlines, escaped newlines, and accidental quotes
    const formattedKey = rawKey
      .replace(/"/g, '') // remove accidental quotes
      .replace(/\\n/g, '\n') // handle escaped newlines
      .trim();

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: formattedKey,
      }),
    });
    console.log('Firebase Admin SDK initialized successfully.');
  } else if (!process.env.FIREBASE_PRIVATE_KEY) {
    console.warn('Firebase Admin SDK not fully initialized (missing keys). Dummy mode enabled.');
  }
} catch (error) {
  console.error('Firebase Admin INIT error:', error.message);
  // We don't throw here to allow the server to start, but subsequent calls will fail if keys were intended
}

module.exports = admin;
