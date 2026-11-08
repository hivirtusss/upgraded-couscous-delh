import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { parseFirebaseConfigTxt } from '../config/parseFirebaseTxt';
import {
  STORAGE_PATHS,
  fetchStorageBytes,
  fetchStorageText,
  initFirebaseFromConfig,
  isFirebaseReady,
  listStorageInFolder,
  uploadUriToStorage,
} from '../firebase/client';
import { extractTxtFromZipBytes } from '../lib/zipTxt';
import { fetchAllDevicesFromFirestore } from '../firebase/fetchDevices';
import { FIRESTORE_DEVICES_COLLECTION } from '../constants/firebaseCollections';
import { parseDeviceListTxt } from '../lib/parseDeviceListTxt';
import { importEntriesToFirestore } from '../firebase/importDevices';

export default function FirebaseUploadFetchPanel({
  onDeviceTxtReady,
  onDeviceEntriesReady,
}) {
  const [firebaseOk, setFirebaseOk] = useState(isFirebaseReady());
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [txtFiles, setTxtFiles] = useState([]);
  const [zipFiles, setZipFiles] = useState([]);

  async function loadFirebaseConfigTxt() {
    try {
      setBusy(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const raw = await FileSystem.readAsStringAsync(result.assets[0].uri);
      const parsed = parseFirebaseConfigTxt(raw);
      if (!parsed.ok) {
        setStatus(parsed.error);
        return;
      }
      initFirebaseFromConfig(parsed.config);
      setFirebaseOk(true);
      setStatus(`Firebase ON — ${parsed.config.projectId}`);
    } catch (e) {
      setStatus(e.message || 'Config fail');
    } finally {
      setBusy(false);
    }
  }

  async function refreshLists() {
    const txt = await listStorageInFolder(STORAGE_PATHS.txtDir);
    const zip = await listStorageInFolder(STORAGE_PATHS.zipDir);
    setTxtFiles(txt);
    setZipFiles(zip);
  }

  async function uploadTxt() {
    try {
      setBusy(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      const path = `${STORAGE_PATHS.txtDir}/${file.name}`;
      await uploadUriToStorage(file.uri, path, 'text/plain');
      setStatus(`Uploaded txt: ${file.name}`);
      await refreshLists();
    } catch (e) {
      setStatus(e.message || 'Upload txt fail');
    } finally {
      setBusy(false);
    }
  }

  /** Txt → Firestore devices (1200 lines) + Storage backup */
  async function uploadTxtToFirestore() {
    try {
      setBusy(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      const raw = await FileSystem.readAsStringAsync(file.uri);
      const parsed = parseDeviceListTxt(raw);
      if (!parsed.entries.length) {
        setStatus('Txt mein koi device nahi mili');
        return;
      }
      setStatus(`Import… 0 / ${parsed.entries.length}`);
      await importEntriesToFirestore(parsed.entries, ({ done, total }) => {
        setStatus(`Firestore import… ${done} / ${total}`);
      });
      const path = `${STORAGE_PATHS.txtDir}/${file.name}`;
      await uploadUriToStorage(file.uri, path, 'text/plain');
      setStatus(`✓ ${parsed.entries.length} devices Firestore + Storage`);
      onDeviceEntriesReady?.({
        entries: parsed.entries,
        name: file.name,
      });
      await refreshLists();
    } catch (e) {
      setStatus(e.message || 'Firestore import fail');
    } finally {
      setBusy(false);
    }
  }

  async function uploadZip() {
    try {
      setBusy(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/zip', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      const path = `${STORAGE_PATHS.zipDir}/${file.name}`;
      await uploadUriToStorage(file.uri, path, 'application/zip');
      setStatus(`Uploaded zip: ${file.name}`);
      await refreshLists();
    } catch (e) {
      setStatus(e.message || 'Upload zip fail');
    } finally {
      setBusy(false);
    }
  }

  async function fetchTxtPath(fullPath, label) {
    try {
      setBusy(true);
      const text = await fetchStorageText(fullPath);
      setStatus(`Fetched: ${label}`);
      onDeviceTxtReady?.({ raw: text, name: label });
    } catch (e) {
      setStatus(e.message || 'Fetch txt fail');
    } finally {
      setBusy(false);
    }
  }

  async function fetchZipPath(fullPath, label) {
    try {
      setBusy(true);
      const bytes = await fetchStorageBytes(fullPath);
      const { name, text } = await extractTxtFromZipBytes(bytes);
      setStatus(`ZIP se txt: ${name}`);
      onDeviceTxtReady?.({ raw: text, name: `${label} → ${name}` });
    } catch (e) {
      setStatus(e.message || 'Fetch zip fail');
    } finally {
      setBusy(false);
    }
  }

  async function fetchFirestoreDevices() {
    try {
      setBusy(true);
      setStatus(`Firestore "${FIRESTORE_DEVICES_COLLECTION}" se fetch…`);
      const entries = await fetchAllDevicesFromFirestore(({ loaded, page }) => {
        setStatus(`Loading… ${loaded} devices (page ${page})`);
      });
      setStatus(`✓ ${entries.length} devices — filter neeche`);
      onDeviceEntriesReady?.({
        entries,
        name: `Firestore ${entries.length}`,
      });
    } catch (e) {
      setStatus(e.message || 'Firestore fetch fail');
    } finally {
      setBusy(false);
    }
  }

  async function startFetch() {
    try {
      setBusy(true);
      setStatus('Fetch start…');
      await refreshLists();
      try {
        const text = await fetchStorageText(STORAGE_PATHS.defaultDevicesTxt);
        onDeviceTxtReady?.({ raw: text, name: 'devices.txt (default)' });
        setStatus('Default devices.txt mil gayi — device check update');
        return;
      } catch {
        // fallback latest txt
      }
      const txt = await listStorageInFolder(STORAGE_PATHS.txtDir);
      if (txt.length > 0) {
        const last = txt[txt.length - 1];
        await fetchTxtPath(last.fullPath, last.name);
        return;
      }
      const zip = await listStorageInFolder(STORAGE_PATHS.zipDir);
      if (zip.length > 0) {
        const last = zip[zip.length - 1];
        await fetchZipPath(last.fullPath, last.name);
        return;
      }
      setStatus('Storage khali — pehle txt/zip upload karo');
    } catch (e) {
      setStatus(e.message || 'Start fetch fail');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (firebaseOk) {
      refreshLists().catch(() => {});
    }
  }, [firebaseOk]);

  return (
    <View>
      <Text style={styles.muted}>
        Firebase Storage: txt/zip upload + Start fetch → device list upar lag jati hai
      </Text>

      <View style={styles.row}>
        <Btn label="Firebase config txt" onPress={loadFirebaseConfigTxt} disabled={busy} />
        <Text style={firebaseOk ? styles.on : styles.off}>
          {firebaseOk ? 'ON' : 'OFF'}
        </Text>
      </View>

      <View style={styles.row}>
        <Btn label="Upload TXT" onPress={uploadTxt} disabled={busy || !firebaseOk} />
        <Btn label="Txt → Firestore" onPress={uploadTxtToFirestore} disabled={busy || !firebaseOk} />
        <Btn label="Upload ZIP" onPress={uploadZip} disabled={busy || !firebaseOk} />
      </View>

      <Pressable
        style={[styles.startBtn, (busy || !firebaseOk) && styles.btnDisabled]}
        onPress={fetchFirestoreDevices}
        disabled={busy || !firebaseOk}
      >
        <Text style={styles.startText}>▶ Fetch 1200+ devices (Firestore)</Text>
      </Pressable>

      <Pressable
        style={[styles.startBtnSecondary, (busy || !firebaseOk) && styles.btnDisabled]}
        onPress={startFetch}
        disabled={busy || !firebaseOk}
      >
        <Text style={styles.startTextSecondary}>▶ Start fetch (Storage txt/zip)</Text>
      </Pressable>

      {txtFiles.length > 0 ? (
        <>
          <Text style={styles.section}>Txt on Firebase</Text>
          {txtFiles.map((f) => (
            <Pressable
              key={f.fullPath}
              style={styles.fileRow}
              onPress={() => fetchTxtPath(f.fullPath, f.name)}
            >
              <Text style={styles.fileName}>{f.name}</Text>
            </Pressable>
          ))}
        </>
      ) : null}

      {zipFiles.length > 0 ? (
        <>
          <Text style={styles.section}>Zip on Firebase</Text>
          {zipFiles.map((f) => (
            <Pressable
              key={f.fullPath}
              style={styles.fileRow}
              onPress={() => fetchZipPath(f.fullPath, f.name)}
            >
              <Text style={styles.fileName}>{f.name}</Text>
            </Pressable>
          ))}
        </>
      ) : null}

      {busy ? <ActivityIndicator color="#3dd6c3" style={{ marginTop: 8 }} /> : null}
      {status ? <Text style={styles.status}>{status}</Text> : null}
    </View>
  );
}

function Btn({ label, onPress, disabled }) {
  return (
    <Pressable style={[styles.btn, disabled && styles.btnDisabled]} onPress={onPress} disabled={disabled}>
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  muted: { color: '#9aa8b8', fontSize: 14, marginBottom: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8, alignItems: 'center' },
  btn: {
    backgroundColor: '#243044',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  btnDisabled: { opacity: 0.45 },
  btnText: { color: '#e7ecf3', fontSize: 13, fontWeight: '600' },
  startBtn: {
    backgroundColor: '#1a3d32',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#3dd6c3',
  },
  startText: { color: '#3dd6c3', fontWeight: '700', textAlign: 'center', fontSize: 16 },
  startBtnSecondary: {
    backgroundColor: '#243044',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#3a4555',
  },
  startTextSecondary: {
    color: '#9aa8b8',
    fontWeight: '600',
    textAlign: 'center',
    fontSize: 14,
  },
  on: { color: '#3dd6c3', fontWeight: '700' },
  off: { color: '#9aa8b8' },
  section: {
    color: '#9aa8b8',
    fontSize: 11,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: 4,
  },
  fileRow: {
    backgroundColor: '#0f1419',
    padding: 10,
    borderRadius: 8,
    marginBottom: 4,
  },
  fileName: { color: '#6b8cff', fontSize: 13 },
  status: { marginTop: 8, color: '#3dd6c3', fontSize: 13 },
});
