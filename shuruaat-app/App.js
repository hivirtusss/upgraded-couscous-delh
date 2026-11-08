import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useEffect, useState } from 'react';
import { Asset } from 'expo-asset';

const PANEL_HTML = require('./assets/panel-viewer/index.html');

export default function App() {
  const [uri, setUri] = useState(null);

  useEffect(() => {
    (async () => {
      const asset = Asset.fromModule(PANEL_HTML);
      await asset.downloadAsync();
      setUri(asset.localUri);
    })();
  }, []);

  if (!uri) {
    return (
      <View style={styles.load}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#00c8ff" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <WebView
        source={{ uri }}
        style={styles.web}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess
        allowUniversalAccessFromFileURLs
        mixedContentMode="always"
        setSupportMultipleWindows={false}
        thirdPartyCookiesEnabled
        cacheEnabled
        onFileDownload={() => {}}
        {...(Platform.OS === 'android'
          ? {
              allowFileAccessFromFileURLs: true,
              geolocationEnabled: false,
              nestedScrollEnabled: true,
            }
          : {})}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#040810' },
  web: { flex: 1, backgroundColor: '#040810' },
  load: {
    flex: 1,
    backgroundColor: '#040810',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
