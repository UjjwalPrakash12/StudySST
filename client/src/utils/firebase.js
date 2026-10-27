import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

/**
 * Firebase Configuration for Google Sign-In & Sign-Up
 * 
 * You can provide your Firebase keys in any of these ways:
 * 1. Set environment variables in client/.env (VITE_FIREBASE_API_KEY, etc.)
 * 2. Paste your keys directly into the defaultFirebaseConfig object below
 * 3. Supply them when prompted in the UI
 */
const defaultFirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || ""
};

let app = null;
let auth = null;
let googleProvider = null;

export function isFirebaseConfigured(config = defaultFirebaseConfig) {
  return Boolean(
    config &&
    config.apiKey &&
    config.apiKey.length > 5 &&
    !config.apiKey.includes('your_api_key') &&
    config.authDomain &&
    !config.authDomain.includes('your_project_id')
  );
}

export function initFirebase(customConfig = null) {
  const config = customConfig || defaultFirebaseConfig;
  if (!isFirebaseConfigured(config)) {
    return { configured: false };
  }

  try {
    app = getApps().length > 0 ? getApp() : initializeApp(config);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });
    return { configured: true, app, auth, googleProvider };
  } catch (err) {
    console.error('Firebase initialization error:', err);
    return { configured: false, error: err.message };
  }
}

// Attempt initial setup
initFirebase();

/**
 * Triggers Google Sign-In with Popup using Firebase
 * Returns normalized profile data for StudyStream backend registration/login
 */
export async function signInWithGoogle() {
  if (!isFirebaseConfigured()) {
    throw new Error(
      "Firebase configuration keys required. Please provide your Firebase credentials in client/.env or client/src/utils/firebase.js"
    );
  }

  if (!auth || !googleProvider) {
    initFirebase();
  }

  const result = await signInWithPopup(auth, googleProvider);
  const user = result.user;
  const idToken = await user.getIdToken();

  return {
    email: user.email,
    displayName: user.displayName || user.email.split('@')[0],
    photoUrl: user.photoURL || null,
    uid: user.uid,
    idToken,
  };
}
