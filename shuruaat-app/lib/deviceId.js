import { Platform } from 'react-native';
import * as Application from 'expo-application';

export async function fetchDeviceId() {
  if (Platform.OS === 'android') {
    return Application.getAndroidId() ?? 'unknown-android';
  }
  if (Platform.OS === 'ios') {
    return (await Application.getIosIdForVendorAsync()) ?? 'unknown-ios';
  }
  return 'unknown-platform';
}
