#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

if [[ ! -x "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" ]]; then
  echo "Android SDK missing. Run scripts/setup-android-sdk.sh first."
  exit 1
fi

if [[ ! -d "$ROOT/android" ]]; then
  npx expo prebuild --platform android --no-install
fi

KEYSTORE="$ROOT/android/app/virtus-release.keystore"
PROPS="$ROOT/android/keystore.properties"
mkdir -p "$(dirname "$KEYSTORE")"

if [[ ! -f "$KEYSTORE" ]]; then
  keytool -genkeypair -v -storetype PKCS12 \
    -keystore "$KEYSTORE" -alias virtus \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass virtustest -keypass virtustest \
    -dname "CN=Virtus Panel Test, OU=Dev, O=Shuruaat, L=Delhi, ST=DL, C=IN"
fi

cat > "$PROPS" <<'EOF'
storePassword=virtustest
keyPassword=virtustest
keyAlias=virtus
storeFile=app/virtus-release.keystore
EOF

GRADLE="$ROOT/android/app/build.gradle"
if ! grep -q 'keystore.properties' "$GRADLE" 2>/dev/null; then
  python3 <<'PY'
from pathlib import Path
p = Path("android/app/build.gradle")
text = p.read_text()
inject = """
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
"""
if "keystorePropertiesFile" not in text:
    text = text.replace("android {", inject + "\nandroid {", 1)
signing = """
        release {
            if (keystorePropertiesFile.exists()) {
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
            }
        }
"""
if "virtus-release" not in text and "keystoreProperties['keyAlias']" not in text:
    text = text.replace(
        "signingConfigs {",
        "signingConfigs {\n" + signing,
        1,
    )
    text = text.replace(
        "signingConfig signingConfigs.debug",
        "signingConfig signingConfigs.release",
        1,
    )
p.write_text(text)
print("Patched", p)
PY
fi

cd android
./gradlew assembleRelease --no-daemon

APK=$(find app/build/outputs/apk/release -name '*.apk' | head -1)
OUT="/opt/cursor/artifacts/virtus-panel-viewer-pro-signed.apk"
cp "$APK" "$OUT"
echo "APK: $OUT"
ls -lh "$OUT"
