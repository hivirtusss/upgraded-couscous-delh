/**
 * Purana React Native UI (Firestore device txt) — agar chahiye App.js mein import karo
 */
import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { HELPLINES, PROFILE } from './constants/profile';
import FirebaseUploadFetchPanel from './components/FirebaseUploadFetchPanel';
import DevicePinGate from './components/DevicePinGate';

export default function LegacyPanelsApp() {
  const [deviceListInject, setDeviceListInject] = useState(null);
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <FirebaseUploadFetchPanel
          onDeviceTxtReady={setDeviceListInject}
          onDeviceEntriesReady={setDeviceListInject}
        />
        <DevicePinGate injectedList={deviceListInject} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f1419' },
  scroll: { padding: 20, paddingTop: 56 },
});
