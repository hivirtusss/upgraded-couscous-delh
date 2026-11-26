import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import { parseFirebaseConfigTxt } from '../config/parseFirebaseTxt';
import {
  initFirebaseFromConfig,
  isFirebaseReady,
  loadNoteFromFirebase,
  saveNoteToFirebase,
} from '../firebase/client';

async function readUriAsString(uri) {
  return FileSystem.readAsStringAsync(uri);
}

async function readBundledWelcomeTxt() {
  const asset = Asset.fromModule(require('../assets/notes/welcome.txt'));
  await asset.downloadAsync();
  return readUriAsString(asset.localUri);
}

export default function TxtFirebasePanel() {
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [firebaseOk, setFirebaseOk] = useState(isFirebaseReady());
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function openTxtFile() {
    try {
      setBusy(true);
      setStatus('');
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      const content = await readUriAsString(file.uri);
      setText(content);
      setFileName(file.name);
      setStatus(`Khuli file: ${file.name}`);
    } catch (e) {
      setStatus(e.message || 'File open fail');
    } finally {
      setBusy(false);
    }
  }

  async function openWelcomeTxt() {
    try {
      setBusy(true);
      const content = await readBundledWelcomeTxt();
      setText(content);
      setFileName('welcome.txt');
      setStatus('Sample welcome.txt khuli');
    } catch (e) {
      setStatus(e.message || 'Sample load fail');
    } finally {
      setBusy(false);
    }
  }

  async function openFirebaseConfigTxt() {
    try {
      setBusy(true);
      setStatus('');
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      const raw = await readUriAsString(file.uri);
      const parsed = parseFirebaseConfigTxt(raw);
      if (!parsed.ok) {
        setStatus(parsed.error);
        return;
      }
      initFirebaseFromConfig(parsed.config);
      setFirebaseOk(true);
      setStatus(`Firebase connect: ${parsed.config.projectId}`);
    } catch (e) {
      setStatus(e.message || 'Firebase config fail');
    } finally {
      setBusy(false);
    }
  }

  async function saveFirebase() {
    try {
      setBusy(true);
      await saveNoteToFirebase(text);
      setStatus('Firebase par save ho gaya');
    } catch (e) {
      setStatus(e.message || 'Save fail');
    } finally {
      setBusy(false);
    }
  }

  async function loadFirebase() {
    try {
      setBusy(true);
      const content = await loadNoteFromFirebase();
      setText(content);
      setFileName('firebase: notes/default');
      setStatus('Firebase se load ho gaya');
    } catch (e) {
      setStatus(e.message || 'Load fail');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View>
      <Text style={styles.muted}>
        .txt kholo · Firebase config txt se connect · note save/load
      </Text>

      <View style={styles.row}>
        <ActionBtn label="Txt kholo" onPress={openTxtFile} disabled={busy} />
        <ActionBtn label="Sample txt" onPress={openWelcomeTxt} disabled={busy} />
      </View>

      <View style={styles.row}>
        <ActionBtn
          label="Firebase config txt"
          onPress={openFirebaseConfigTxt}
          disabled={busy}
        />
        <View style={styles.pill}>
          <Text style={firebaseOk ? styles.pillOn : styles.pillOff}>
            {firebaseOk ? 'Firebase ON' : 'Firebase OFF'}
          </Text>
        </View>
      </View>

      <View style={styles.row}>
        <ActionBtn
          label="Save Firebase"
          onPress={saveFirebase}
          disabled={busy || !firebaseOk}
        />
        <ActionBtn
          label="Load Firebase"
          onPress={loadFirebase}
          disabled={busy || !firebaseOk}
        />
      </View>

      {fileName ? <Text style={styles.fileLabel}>{fileName}</Text> : null}

      <TextInput
        style={styles.input}
        multiline
        placeholder="Yahan txt ka content dikhega..."
        placeholderTextColor="#6b7a8c"
        value={text}
        onChangeText={setText}
      />

      {busy ? (
        <ActivityIndicator color="#3dd6c3" style={{ marginTop: 8 }} />
      ) : null}
      {status ? <Text style={styles.status}>{status}</Text> : null}
    </View>
  );
}

function ActionBtn({ label, onPress, disabled }) {
  return (
    <Pressable
      style={[styles.btn, disabled && styles.btnDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  muted: {
    color: '#9aa8b8',
    fontSize: 14,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  btn: {
    backgroundColor: '#243044',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  btnText: {
    color: '#e7ecf3',
    fontSize: 13,
    fontWeight: '600',
  },
  pill: {
    paddingHorizontal: 8,
  },
  pillOn: {
    color: '#3dd6c3',
    fontWeight: '700',
    fontSize: 12,
  },
  pillOff: {
    color: '#9aa8b8',
    fontSize: 12,
  },
  fileLabel: {
    color: '#6b8cff',
    fontSize: 12,
    marginBottom: 6,
  },
  input: {
    minHeight: 140,
    backgroundColor: '#0f1419',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    color: '#e7ecf3',
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  status: {
    marginTop: 8,
    color: '#3dd6c3',
    fontSize: 13,
  },
});
