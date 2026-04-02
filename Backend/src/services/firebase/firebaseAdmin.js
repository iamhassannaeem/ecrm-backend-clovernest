const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

let cached = null;

function initFirebaseAdmin() {
  if (cached) return cached;
  if (admin.apps && admin.apps.length > 0) {
    cached = admin;
    return cached;
  }

  let serviceAccount = null;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const p = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    const abs = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
    serviceAccount = JSON.parse(fs.readFileSync(abs, 'utf8'));
  }

  if (!serviceAccount) {
    throw new Error(
      'Firebase service account missing. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH.'
    );
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  cached = admin;
  return cached;
}

function getMessaging() {
  initFirebaseAdmin();
  return admin.messaging();
}

module.exports = { getMessaging };

