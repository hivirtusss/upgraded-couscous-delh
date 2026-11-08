import { initializeApp, getApps, getApp } from 'firebase/app';
import { doc, getDoc, getFirestore, setDoc } from 'firebase/firestore';

let firestore = null;

export function initFirebaseFromConfig(firebaseConfig) {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  firestore = getFirestore(app);
  return firestore;
}

export function isFirebaseReady() {
  return firestore != null;
}

const NOTE_COLLECTION = 'notes';
const NOTE_ID = 'default';

export async function saveNoteToFirebase(text) {
  if (!firestore) throw new Error('Firebase not configured');
  await setDoc(doc(firestore, NOTE_COLLECTION, NOTE_ID), {
    content: text,
    updatedAt: Date.now(),
  });
}

export async function loadNoteFromFirebase() {
  if (!firestore) throw new Error('Firebase not configured');
  const snap = await getDoc(doc(firestore, NOTE_COLLECTION, NOTE_ID));
  if (!snap.exists()) return '';
  return snap.data().content ?? '';
}
