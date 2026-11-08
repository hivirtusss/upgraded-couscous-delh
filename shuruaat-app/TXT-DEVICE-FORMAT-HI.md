# Device txt (Firebase) — Hindi

## Line format

```
deviceId | PIN | naam | lastSMS | sortValue
```

| Part | Example |
|------|---------|
| deviceId | Android ID |
| PIN | `4521` ya `open` / khali = bina PIN |
| naam | optional |
| lastSMS | `12/03/2026` ya epoch ms — SMS time |
| sortValue | number — High↔Low isi se |

Example:

```
a1b2c3d4|open|Ram|10/11/2025|100
x9y8z7|1234|Shyam|1731000000000|50
```

## App filters

- **High → Low / Low → High** — `sortValue` (nahi to last SMS time)
- **With PIN / Without PIN**
- **SMS:** 1, 3, 7, 15, 30 din (last SMS us window mein) · **All time**

## Upload

1. Firebase config txt
2. **Txt → Firestore** — 1200 devices import
3. **Fetch 1200+ devices** — dobara load

Firestore rules: `devices` read/write (testing).
