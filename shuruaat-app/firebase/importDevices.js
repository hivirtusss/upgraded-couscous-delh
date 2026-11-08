import { collection, doc, writeBatch } from 'firebase/firestore';
import { FIRESTORE_DEVICES_COLLECTION } from '../constants/firebaseCollections';
import { entryToFirestoreDoc } from '../lib/deviceEntry';
import { getFirestoreInstance } from './client';

const BATCH_SIZE = 450;

/**
 * Txt se parse ki hui list → Firestore (1200 devices = ~3 batch)
 */
export async function importEntriesToFirestore(entries, onProgress) {
  const db = getFirestoreInstance();
  const col = collection(db, FIRESTORE_DEVICES_COLLECTION);

  let done = 0;
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const chunk = entries.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((entry) => {
      const id = entry.deviceIdRaw.replace(/[/\\]/g, '_').slice(0, 200);
      batch.set(doc(col, id), entryToFirestoreDoc(entry), { merge: true });
    });
    await batch.commit();
    done += chunk.length;
    onProgress?.({ done, total: entries.length });
  }
  return done;
}
