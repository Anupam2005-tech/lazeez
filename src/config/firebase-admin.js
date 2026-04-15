// Lazy-loaded Firebase Admin SDK
// Only initializes when first accessed (not on server startup)

let admin = null;
let initialized = false;

function getAdmin() {
  if (initialized) return admin;

  try {
    const adminModule = require('firebase-admin');
    if (process.env.FIREBASE_PRIVATE_KEY && !adminModule.apps.length) {
      const rawKey = process.env.FIREBASE_PRIVATE_KEY;
      const formattedKey = rawKey
        .replace(/"/g, '')
        .replace(/\\n/g, '\n')
        .trim();

      adminModule.initializeApp({
        credential: adminModule.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: formattedKey,
        }),
      });
      if (process.env.NODE_ENV !== 'production') {
        console.log('Firebase Admin SDK initialized.');
      }
    }
    admin = adminModule;
    initialized = true;
  } catch (error) {
    console.error('Firebase Admin INIT error:', error.message);
    initialized = true;
  }

  return admin;
}

// Block direct module.exports access — force using getAdmin()
module.exports = {
  get auth() { return getAdmin()?.auth(); },
  get firestore() { return getAdmin()?.firestore(); },
};
