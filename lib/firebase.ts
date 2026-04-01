import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

// NEXT_PUBLIC_ vars are embedded at build time. When absent (e.g. CI, or running
// `next build` without .env.local) Firebase would throw during SSR prerendering.
// Emit a clear console error so the developer knows what to fix, but don't crash.
const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY             ?? '',
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN         ?? '',
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID          ?? '',
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET      ?? '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID              ?? '',
};

if (!firebaseConfig.apiKey || !firebaseConfig.authDomain || !firebaseConfig.projectId) {
  console.error(
    '[Firebase] Missing required environment variables: ' +
    'NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, NEXT_PUBLIC_FIREBASE_PROJECT_ID. ' +
    'Copy .env.example to .env.local and fill in your Firebase config.'
  );
}

// Firebase is browser-only. During Next.js SSR prerendering (typeof window ===
// 'undefined') we assign typed stubs — they are never invoked server-side.
// In the browser the SDK is initialized normally with the real config.
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

if (typeof window !== 'undefined') {
  const isNew = getApps().length === 0;
  app     = isNew ? initializeApp(firebaseConfig) : getApp();
  auth    = getAuth(app);
  db      = isNew
    ? initializeFirestore(app, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      })
    : getFirestore(app);
  storage = getStorage(app);
} else {
  // Server-side stubs — prerender-only, never called for real Firebase operations.
  app     = {} as FirebaseApp;
  auth    = {} as Auth;
  db      = {} as Firestore;
  storage = {} as FirebaseStorage;
}

export { auth, db, storage };
export default app;
