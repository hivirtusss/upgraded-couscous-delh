import { initializeApp, getApps, getApp } from 'firebase/app';
import { doc, getDoc, getFirestore, setDoc } from 'firebase/firestore';
import {
  getBytes,
  getStorage,
  listAll,
  ref,
  uploadBytes,
} from 'firebase/storage';
import { base64ToUint8Array, uint8ArrayToText } from '../lib/base64Bytes';

let firestore = null;
let storage = null;

export const STORAGE_PATHS = {
  root: 'gate',
  txtDir: 'gate/txt',
  zipDir: 'gate/zip',
  defaultDevicesTxt: 'gate/txt/devices.txt',
};

export function initFirebaseFromConfig(firebaseConfig) {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  firestore = getFirestore(app);
  storage = getStorage(app);
  return { firestore, storage };
}

export function isFirebaseReady() {
  return storage != null && firestore != null;
}

export function getFirestoreInstance() {
  if (!firestore) throw new Error('Firebase not configured — config txt kholo');
  return firestore;
}

function requireStorage() {
  if (!storage) throw new Error('Firebase not configured — config txt kholo');
  return storage;
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

export async function uploadUriToStorage(localUri, storagePath, contentType) {
  const FileSystem = await import('expo-file-system/legacy');
  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const bytes = base64ToUint8Array(base64);
  const storageRef = ref(requireStorage(), storagePath);
  await uploadBytes(storageRef, bytes, { contentType });
  return storagePath;
}

export async function fetchStorageText(storagePath) {
  const storageRef = ref(requireStorage(), storagePath);
  const bytes = await getBytes(storageRef);
  return uint8ArrayToText(bytes);
}

export async function fetchStorageBytes(storagePath) {
  const storageRef = ref(requireStorage(), storagePath);
  return getBytes(storageRef);
}

export async function listStorageInFolder(folderPath) {
  const folderRef = ref(requireStorage(), folderPath);
  const result = await listAll(folderRef);
  return result.items.map((item) => ({
    name: item.name,
    fullPath: item.fullPath,
  }));
}
