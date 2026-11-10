import {
  collection,
  documentId,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
} from 'firebase/firestore';
import {
  FIRESTORE_DEVICES_COLLECTION,
  FIRESTORE_DEVICES_PAGE_SIZE,
} from '../constants/firebaseCollections';
import { mapFirestoreDocToEntry } from '../lib/deviceEntry';
import { getFirestoreInstance } from './client';

/**
 * Saari devices Firestore se — 1200+ ke liye pages
 * @param {function({loaded:number,page:number})} onProgress
 */
export async function fetchAllDevicesFromFirestore(
  onProgress,
  collectionName = FIRESTORE_DEVICES_COLLECTION,
) {
  const db = getFirestoreInstance();
  const col = collection(db, collectionName);
  const pageSize = FIRESTORE_DEVICES_PAGE_SIZE;

  const all = [];
  let lastDoc = null;
  let page = 0;

  while (true) {
    page += 1;
    const q = lastDoc
      ? query(col, orderBy(documentId()), limit(pageSize), startAfter(lastDoc))
      : query(col, orderBy(documentId()), limit(pageSize));

    const snap = await getDocs(q);
    if (snap.empty) break;

    snap.docs.forEach((d) => {
      const entry = mapFirestoreDocToEntry(d.id, d.data());
      if (entry) all.push(entry);
    });

    onProgress?.({ loaded: all.length, page });

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < pageSize) break;

    if (page > 50) {
      throw new Error('Bahut bade data — collection naam check karo');
    }
  }

  return all;
}
