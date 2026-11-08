#!/usr/bin/env bash
set -euo pipefail
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
mkdir -p "$ANDROID_HOME/cmdline-tools"
TMP=/tmp/android-cmdtools.zip
if [[ ! -x "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" ]]; then
  curl -fsSL -o "$TMP" \
    "https://dl.google.com/android/repository/commandlinetools-linux-13114758_latest.zip"
  rm -rf /tmp/cmdline-tools-unpack
  unzip -q -o "$TMP" -d /tmp/cmdline-tools-unpack
  rm -rf "$ANDROID_HOME/cmdline-tools/latest"
  mv /tmp/cmdline-tools-unpack/cmdline-tools "$ANDROID_HOME/cmdline-tools/latest"
fi
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
yes | sdkmanager --licenses >/dev/null || true
sdkmanager "platform-tools" "platforms;android-35" "build-tools;35.0.0"
echo "ANDROID_HOME=$ANDROID_HOME"
