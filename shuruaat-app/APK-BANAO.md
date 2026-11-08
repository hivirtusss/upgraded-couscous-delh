# Meri pehli APK — phone par kaise banaye

Yeh **Expo** app hai. Test free hai; **APK file** banane ke liye PC chahiye (Windows ok).

## Pehle apna naam daalo (5 min)

File kholo: `constants/profile.js`  
`name`, `tagline`, `about`, `skills` apni language mein likho.

---

## Option A — Phone pe turant test (APK nahi, Expo Go)

1. Play Store se **Expo Go** install karo.
2. PC / laptop pe project folder mein:
   ```bash
   cd shuruaat-app
   npm install
   npx expo start
   ```
3. QR code **Expo Go** se scan — app dikhegi.

Internet chahiye. Yeh step **apk se pehle** recommended hai.

---

## Option B — Asli APK file (cloud build, free account)

1. [expo.dev](https://expo.dev) par free account banao.
2. Terminal:
   ```bash
   cd shuruaat-app
   npm install
   npx eas-cli login
   npx eas-cli init
   ```
   `app.json` mein `projectId` auto fill ho jayega.
3. APK banwao:
   ```bash
   npx eas-cli build -p android --profile preview
   ```
4. Build khatam hone par **download link** milega — `.apk` phone par install (unknown sources allow).

**Note:** Pehli build 10–20 min lag sakti hai. Paise nahi lagte basic tier pe (limits ho sakti hain).

---

## Option C — Android Studio (advanced)

`npx expo prebuild` → Android Studio se local build. Zyada heavy; abhi **Option A + B** kaafi.

---

## Agar sirf phone hai, PC nahi

- Kisi cyber café / dost ke laptop pe **Option B** ek baar chala sakte ho **ya**
- Pehle **HTML portfolio** (`shuruaat-portfolio`) phone browser mein
- Baad mein PC milte hi APK

---

## Madad

Chat mein likho:

- `profile.js mein naam ___ hai` — main edit bata dunga
- `PC hai / nahi hai`
- Build error ka screenshot/text

Agar andar se bahut bura lage: app mein **14416** button hai — use karna weak nahi.
