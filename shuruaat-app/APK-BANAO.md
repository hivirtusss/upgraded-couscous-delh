# APK banaye

## Option A — signed release (local, test keystore)

```bash
cd shuruaat-app
npm install
bash scripts/setup-android-sdk.sh   # pehli baar
bash scripts/build-signed-apk.sh
```

Output: `virtus-panel-viewer-pro-signed.apk` (release, signed).

**Test keystore (sirf try ke liye):** password `virtustest` (Play Store ke liye alag production key chahiye).

## Option B — EAS cloud

```bash
npx eas-cli login
npx eas-cli build -p android --profile preview
```

Test: `npx expo start` → Expo Go (file picker limited); asli test signed APK pe karo.
