const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config();

const { initializeApp, getApps, getApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

let firebaseApp = null;
let firebaseAuth = null;
let resolvedProjectId = null;
let customVerifierForTesting = null;

/**
 * Determine the Firebase Project ID from server or client environment configuration.
 */
function resolveFirebaseProjectId() {
  return (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    'studysst-39152'
  );
}

/**
 * Securely initialize Firebase Admin SDK.
 * Supports service account credentials via environment variables if provided,
 * otherwise initializes with Project ID for Google Public Key token verification.
 */
function initFirebaseAdmin() {
  if (firebaseApp && firebaseAuth) {
    return { app: firebaseApp, auth: firebaseAuth, projectId: resolvedProjectId };
  }

  resolvedProjectId = resolveFirebaseProjectId();

  try {
    if (getApps().length > 0) {
      firebaseApp = getApp();
      firebaseAuth = getAuth(firebaseApp);
      return { app: firebaseApp, auth: firebaseAuth, projectId: resolvedProjectId };
    }

    let credential = null;
    const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    if (serviceAccountRaw) {
      try {
        let parsed = null;
        const trimmed = serviceAccountRaw.trim();
        if (trimmed.startsWith('{')) {
          parsed = JSON.parse(trimmed);
        } else {
          const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
          parsed = JSON.parse(decoded);
        }
        if (parsed && parsed.project_id) {
          resolvedProjectId = parsed.project_id;
        }
        credential = cert(parsed);
      } catch (e) {
        console.warn('⚠️ Could not parse FIREBASE_SERVICE_ACCOUNT credentials:', e.message);
      }
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
      try {
        const fileContent = fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8');
        const parsed = JSON.parse(fileContent);
        if (parsed && parsed.project_id) {
          resolvedProjectId = parsed.project_id;
        }
        credential = cert(parsed);
      } catch (e) {
        console.warn('⚠️ Could not load GOOGLE_APPLICATION_CREDENTIALS file:', e.message);
      }
    }

    const appOptions = { projectId: resolvedProjectId };
    if (credential) {
      appOptions.credential = credential;
    }

    firebaseApp = initializeApp(appOptions);
    firebaseAuth = getAuth(firebaseApp);
    console.log(`🔥 Firebase Admin SDK initialized for project [${resolvedProjectId}] (mode: ${credential ? 'Service Account' : 'Public Key Verification'})`);
    return { app: firebaseApp, auth: firebaseAuth, projectId: resolvedProjectId };
  } catch (err) {
    console.error('❌ Failed to initialize Firebase Admin SDK:', err.message);
    throw err;
  }
}

/**
 * Verify a Firebase ID token using Firebase Admin SDK.
 * Guarantees that token signature, expiration, project audience, and issuer are authentic.
 * 
 * @param {string} idToken
 * @returns {Promise<import('firebase-admin/auth').DecodedIdToken>}
 */
async function verifyFirebaseIdToken(idToken) {
  if (!idToken || typeof idToken !== 'string' || !idToken.trim()) {
    const error = new Error('Firebase ID token is required');
    error.code = 'auth/missing-id-token';
    throw error;
  }

  const cleanToken = idToken.trim();

  // Test-only mock hook (strictly forbidden in production)
  const isTestEnv = process.env.NODE_ENV !== 'production' && (
    process.env.NODE_ENV === 'test' || process.env.ALLOW_TEST_TOKENS === 'true'
  );

  if (isTestEnv) {
    if (customVerifierForTesting) {
      return await customVerifierForTesting(cleanToken);
    }
    if (cleanToken === 'test-token-expired') {
      const error = new Error('Firebase ID token has expired. Get a fresh token from your client app.');
      error.code = 'auth/id-token-expired';
      throw error;
    }
    if (cleanToken === 'test-token-invalid' || cleanToken === 'test-token-fabricated') {
      const error = new Error('Decoding Firebase ID token failed. Token is malformed or invalid.');
      error.code = 'auth/argument-error';
      throw error;
    }
    if (cleanToken === 'test-token-service-failure') {
      const error = new Error('Internal Firebase service error during verification.');
      error.code = 'auth/service-unavailable';
      throw error;
    }
    if (cleanToken.startsWith('test-token-mock:')) {
      try {
        const payloadJson = cleanToken.slice('test-token-mock:'.length);
        const claims = JSON.parse(payloadJson);
        return {
          aud: resolveFirebaseProjectId(),
          iss: `https://securetoken.google.com/${resolveFirebaseProjectId()}`,
          sub: claims.uid,
          uid: claims.uid,
          email: claims.email,
          email_verified: claims.email_verified !== undefined ? claims.email_verified : true,
          name: claims.name || claims.displayName || '',
          picture: claims.picture || claims.photoUrl || '',
          auth_time: Math.floor(Date.now() / 1000),
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
          ...claims
        };
      } catch (err) {
        const error = new Error('Malformed test mock token');
        error.code = 'auth/argument-error';
        throw error;
      }
    }
  }

  // Real Firebase Admin verification
  const { auth, projectId } = initFirebaseAdmin();
  if (!auth) {
    const error = new Error('Firebase Admin Auth service is unavailable');
    error.code = 'auth/service-unavailable';
    throw error;
  }

  const decodedToken = await auth.verifyIdToken(cleanToken);

  // Defense-in-depth audience & project matching check
  if (projectId && decodedToken.aud && decodedToken.aud !== projectId) {
    const error = new Error(`Firebase ID token audience mismatch: expected ${projectId}, got ${decodedToken.aud}`);
    error.code = 'auth/invalid-audience';
    throw error;
  }

  return decodedToken;
}

/**
 * Set custom verifier for isolated automated security test suites.
 */
function setCustomVerifierForTesting(verifier) {
  if (process.env.NODE_ENV === 'test' || process.env.ALLOW_TEST_VERIFIER === 'true') {
    customVerifierForTesting = verifier;
  }
}

module.exports = {
  initFirebaseAdmin,
  verifyFirebaseIdToken,
  setCustomVerifierForTesting,
  resolveFirebaseProjectId,
};
