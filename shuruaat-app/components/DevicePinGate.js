import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { fetchDeviceId } from '../lib/deviceId';
import {
  filterEntries,
  findEntryForDevice,
  parseDeviceListTxt,
} from '../lib/parseDeviceListTxt';
import { buildFilteredDeviceList } from '../lib/deviceFilters';
import { formatSmsAge } from '../lib/parseSmsTime';
import DeviceFilterToolbar from './DeviceFilterToolbar';

export default function DevicePinGate({ injectedList }) {
  const [deviceId, setDeviceId] = useState('');
  const [entries, setEntries] = useState([]);
  const [sortOrder, setSortOrder] = useState('high_to_low');
  const [pinMode, setPinMode] = useState('all');
  const [smsAgeKey, setSmsAgeKey] = useState('all');
  const [listName, setListName] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const [access, setAccess] = useState('idle'); // idle | allowed | need_pin | denied
  const [myEntry, setMyEntry] = useState(null);
  const [pinInput, setPinInput] = useState('');

  const loadDeviceId = useCallback(async () => {
    try {
      setBusy(true);
      const id = await fetchDeviceId();
      setDeviceId(id);
      setStatus('Device ID mil gayi — txt mein yahi ID dalo');
    } catch (e) {
      setStatus(e.message || 'Device ID fail');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    loadDeviceId();
  }, [loadDeviceId]);

  const filteredList = useMemo(
    () =>
      buildFilteredDeviceList(entries, {
        pinMode,
        smsAgeKey,
        sortOrder,
      }),
    [entries, pinMode, smsAgeKey, sortOrder],
  );

  const countWithPin = useMemo(
    () => filterEntries(entries, 'with_pin').length,
    [entries],
  );
  const countWithoutPin = useMemo(
    () => filterEntries(entries, 'without_pin').length,
    [entries],
  );

  const runAccessCheck = useCallback(
    async (list, name, warn) => {
      setEntries(list);
      setListName(name);

      const id = deviceId || (await fetchDeviceId());
      setDeviceId(id);

      if (warn) {
        setStatus(warn);
      } else {
        setStatus(`Loaded ${list.length} devices`);
      }

      const match = findEntryForDevice(list, id);
      if (!match) {
        setAccess('denied');
        setMyEntry(null);
        setStatus(`${list.length} devices — tumhari ID list mein nahi`);
        return;
      }
      setMyEntry(match);
      if (match.requiresPin) {
        setAccess('need_pin');
        setStatus(`PIN chahiye (${list.length} devices loaded)`);
      } else {
        setAccess('allowed');
        setStatus(`Bina PIN OK (${list.length} total)`);
      }
    },
    [deviceId],
  );

  const applyEntriesList = useCallback(
    async (list, name) => {
      try {
        setBusy(true);
        setAccess('idle');
        setMyEntry(null);
        setPinInput('');
        await runAccessCheck(list, name, null);
      } finally {
        setBusy(false);
      }
    },
    [runAccessCheck],
  );

  const applyRawList = useCallback(
    async (raw, name) => {
      try {
        setBusy(true);
        setAccess('idle');
        setMyEntry(null);
        setPinInput('');

        const parsed = parseDeviceListTxt(raw);
        const warn = parsed.errors.length ? `Warning: ${parsed.errors[0]}` : null;
        await runAccessCheck(parsed.entries, name, warn);
      } finally {
        setBusy(false);
      }
    },
    [runAccessCheck],
  );

  useEffect(() => {
    if (!injectedList) return;
    if (injectedList.entries?.length) {
      applyEntriesList(
        injectedList.entries,
        injectedList.name || 'Firestore',
      ).catch((e) => setStatus(e.message || 'List fail'));
      return;
    }
    if (injectedList.raw) {
      applyRawList(injectedList.raw, injectedList.name || 'Firebase').catch((e) => {
        setStatus(e.message || 'Firebase list fail');
      });
    }
  }, [injectedList, applyRawList, applyEntriesList]);

  async function loadDeviceTxt() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      const file = result.assets[0];
      const raw = await FileSystem.readAsStringAsync(file.uri);
      await applyRawList(raw, file.name);
    } catch (e) {
      setStatus(e.message || 'Txt load fail');
    }
  }

  function verifyPin() {
    if (!myEntry) return;
    if (pinInput.trim() === myEntry.pin) {
      setAccess('allowed');
      setStatus('PIN sahi — access OK');
    } else {
      setStatus('PIN galat');
    }
  }

  async function copyDeviceId() {
    await Clipboard.setStringAsync(deviceId);
    setStatus('Device ID copy ho gayi');
  }

  function recheckWithList() {
    if (!entries.length) {
      setStatus('Pehle device txt load karo');
      return;
    }
    const match = findEntryForDevice(entries, deviceId);
    if (!match) {
      setAccess('denied');
      setMyEntry(null);
      setStatus('List mein device nahi');
      return;
    }
    setMyEntry(match);
    if (match.requiresPin) {
      setAccess('need_pin');
      setPinInput('');
    } else {
      setAccess('allowed');
    }
  }

  return (
    <View>
      <Text style={styles.muted}>
        Txt mein device ID + PIN (ya khali = bina PIN). APK par Android ID aati hai.
      </Text>

      <View style={styles.idBox}>
        <Text style={styles.idLabel}>Meri Device ID</Text>
        <Text style={styles.idValue} selectable>
          {deviceId || '…'}
        </Text>
        <View style={styles.row}>
          <ActionBtn label="Refresh ID" onPress={loadDeviceId} disabled={busy} />
          <ActionBtn label="Copy ID" onPress={copyDeviceId} disabled={!deviceId} />
        </View>
      </View>

      <View style={styles.row}>
        <ActionBtn label="Device txt load" onPress={loadDeviceTxt} disabled={busy} />
      </View>
      {listName ? <Text style={styles.fileName}>{listName}</Text> : null}

      <View style={[styles.accessBanner, accessStyles[access]]}>
        <Text style={styles.accessText}>
          {access === 'allowed' && '✓ Access mil gaya'}
          {access === 'need_pin' && 'PIN enter karo'}
          {access === 'denied' && '✗ ID list mein nahi'}
          {access === 'idle' && 'Txt load karo, check hoga'}
        </Text>
      </View>

      {access === 'need_pin' && myEntry ? (
        <View style={styles.pinBlock}>
          <TextInput
            style={styles.pinInput}
            placeholder="PIN"
            placeholderTextColor="#6b7a8c"
            keyboardType="number-pad"
            secureTextEntry
            value={pinInput}
            onChangeText={setPinInput}
          />
          <ActionBtn label="PIN verify" onPress={verifyPin} />
        </View>
      ) : null}

      <DeviceFilterToolbar
        sortOrder={sortOrder}
        onSortOrder={setSortOrder}
        pinMode={pinMode}
        onPinMode={setPinMode}
        smsAgeKey={smsAgeKey}
        onSmsAgeKey={setSmsAgeKey}
        shownCount={filteredList.length}
        totalCount={entries.length}
      />

      {entries.length > 0 ? (
        <Text style={styles.statsLine}>
          Total {entries.length} · Bina PIN {countWithoutPin} · PIN {countWithPin}
        </Text>
      ) : null}

      <View style={styles.listBox}>
        {filteredList.length === 0 ? (
          <Text style={styles.muted}>Koi entry nahi — Firestore fetch / txt load</Text>
        ) : (
          <FlatList
            data={filteredList}
            keyExtractor={(e) => `${e.deviceId}-${e.label}`}
            style={styles.flatList}
            nestedScrollEnabled
            initialNumToRender={12}
            maxToRenderPerBatch={24}
            windowSize={8}
            renderItem={({ item: e }) => (
              <View style={styles.listRow}>
                <Text style={styles.listId}>{e.deviceIdRaw}</Text>
                <Text style={e.requiresPin ? styles.badgePin : styles.badgeOpen}>
                  {e.requiresPin ? 'PIN •••' : 'OPEN'}
                </Text>
                {e.label ? <Text style={styles.listLabel}>{e.label}</Text> : null}
                <Text style={styles.smsMeta}>
                  SMS: {formatSmsAge(e.lastSmsAt)} · Sort: {e.sortValue ?? 0}
                </Text>
                {e.deviceId === deviceId.trim().toLowerCase() ? (
                  <Text style={styles.thisDevice}>← yeh phone</Text>
                ) : null}
              </View>
            )}
          />
        )}
      </View>

      <ActionBtn label="Dubara check karo" onPress={recheckWithList} disabled={!entries.length} />

      {busy ? <ActivityIndicator color="#3dd6c3" style={{ marginTop: 8 }} /> : null}
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

const accessStyles = {
  idle: { backgroundColor: '#243044' },
  allowed: { backgroundColor: '#1a3d32' },
  need_pin: { backgroundColor: '#3d3420' },
  denied: { backgroundColor: '#3d2028' },
};

const styles = StyleSheet.create({
  muted: {
    color: '#9aa8b8',
    fontSize: 14,
    marginBottom: 12,
  },
  idBox: {
    backgroundColor: '#0f1419',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(107, 140, 255, 0.35)',
  },
  idLabel: {
    fontSize: 11,
    color: '#6b8cff',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  idValue: {
    color: '#e7ecf3',
    fontSize: 13,
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  btn: {
    backgroundColor: '#243044',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  btnDisabled: { opacity: 0.45 },
  btnText: { color: '#e7ecf3', fontSize: 13, fontWeight: '600' },
  fileName: { color: '#6b8cff', fontSize: 12, marginBottom: 8 },
  accessBanner: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  accessText: { color: '#e7ecf3', fontWeight: '600', textAlign: 'center' },
  pinBlock: { marginBottom: 12, gap: 8 },
  pinInput: {
    backgroundColor: '#0f1419',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    color: '#e7ecf3',
    padding: 12,
    fontSize: 18,
    letterSpacing: 4,
  },
  sectionTitle: {
    color: '#9aa8b8',
    fontSize: 12,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 4,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#3a4555',
  },
  chipOn: {
    borderColor: '#3dd6c3',
    backgroundColor: 'rgba(61, 214, 195, 0.12)',
  },
  chipText: { color: '#9aa8b8', fontSize: 12 },
  chipTextOn: { color: '#3dd6c3' },
  statsLine: {
    color: '#9aa8b8',
    fontSize: 12,
    marginBottom: 6,
  },
  listBox: {
    backgroundColor: '#0f1419',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    maxHeight: 240,
  },
  flatList: {
    maxHeight: 220,
  },
  listRow: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 8,
  },
  listId: { color: '#e7ecf3', fontSize: 12, fontFamily: 'monospace' },
  listLabel: { color: '#9aa8b8', fontSize: 12, marginTop: 2 },
  smsMeta: { color: '#6b7a8c', fontSize: 10, marginTop: 2 },
  badgePin: {
    alignSelf: 'flex-start',
    marginTop: 4,
    color: '#ffb84d',
    fontSize: 11,
    fontWeight: '700',
  },
  badgeOpen: {
    alignSelf: 'flex-start',
    marginTop: 4,
    color: '#3dd6c3',
    fontSize: 11,
    fontWeight: '700',
  },
  thisDevice: { color: '#6b8cff', fontSize: 11, marginTop: 2 },
  status: { marginTop: 8, color: '#3dd6c3', fontSize: 13 },
});
