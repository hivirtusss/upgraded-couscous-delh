# Virtus Panel Viewer Pro — APK kya hai?

Tumhari Drive wali APK (`virtus-panel-viewer-pro 7.apk`) yeh hai:

1. **WebView shell** — andar `assets/index.html` (poora panel UI + logic)
2. **TXT upload** = Firebase **Realtime Database** credentials (URL + Auth Key), device list nahi
3. **⚡ Fetch Live** = har panel se `clients` path → 1200+ devices
4. **Filters:** Online / Offline / PIN / No PIN (dono ek saath)
5. **Sort:** High 1L–20L, Boom 20L–1Cr, Medium 5K–8K, Low→High
6. **▶ Start Fetch** = bank SMS Firebase se (`messages/{deviceId}`)

## TXT format (asli Virtus)

```
Firebase URL: https://xxxx-default-rtdb.firebaseio.com
Auth Key: xxxxx
```

Har panel ke liye URL + KEY lines.

## Expo build

`App.js` ab WebView se `panel-viewer/index.html` load karta hai — reference APK jaisa.

APK: `npx eas-cli build -p android --profile preview`

## Purana React Native screen

Pin gate / Firestore wala code repo mein hai; Virtus jaisa experience = WebView app.
